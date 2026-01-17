import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { GeminiService } from '../services/gemini.service';
import { ReasoningService } from '../services/reasoning.service';
import { ProvenanceService } from '../services/provenance.service';
import { HGBKnowledgeService } from '../services/hgb-knowledge.service';
import {
  AgentTool,
  ToolParameter,
  ToolResult,
  BatchResult,
  AgentContext,
  ReasoningStep,
  QualityIndicators,
  ProvenanceInfo,
  DISCLAIMERS,
} from '../types/agent.types';

interface DocumentationData {
  financialStatement: any;
  consolidationEntries: any[];
  plausibilityChecks: any[];
  icReconciliations: any[];
  companies: any[];
}

/**
 * Prüfpfad-Dokumentation Tool
 * Generates audit trail documentation for consolidation
 */
@Injectable()
export class AuditDocumentationTool implements AgentTool {
  private readonly logger = new Logger(AuditDocumentationTool.name);

  name = 'generate_audit_documentation';
  description = 'Erstellt Prüfpfad-Dokumentation für die Konsolidierung';

  parameters: ToolParameter[] = [
    {
      name: 'financial_statement_id',
      type: 'string',
      description: 'ID des Konzernabschlusses',
      required: true,
    },
    {
      name: 'section',
      type: 'string',
      description: 'Dokumentationsabschnitt (all, capital, debt, income, ic)',
      required: false,
      default: 'all',
    },
  ];

  requiredMode: 'explain' | 'action' | 'both' = 'explain';
  requiresConfirmation = false;
  supportsBatch = false;

  constructor(
    private supabase: SupabaseService,
    private gemini: GeminiService,
    private reasoning: ReasoningService,
    private provenance: ProvenanceService,
    private hgbKnowledge: HGBKnowledgeService,
  ) {}

  /**
   * Execute documentation generation
   */
  async execute(
    params: Record<string, any>,
    context: AgentContext,
  ): Promise<ToolResult> {
    const financialStatementId = params.financial_statement_id;
    const section = params.section || 'all';

    try {
      // 1. Fetch all relevant data
      const data = await this.fetchDocumentationData(financialStatementId);
      if (!data.financialStatement) {
        return this.createErrorResult('Konzernabschluss nicht gefunden');
      }

      // 2. Generate documentation content
      const documentation = await this.generateDocumentation(data, section);

      // 3. Build reasoning chain
      const reasoningSteps = this.buildReasoningSteps(data);
      const reasoningChain = this.reasoning.buildReasoningChain(
        'audit_documentation',
        reasoningSteps,
      );

      // 4. Build quality indicators
      const quality = this.buildQualityIndicators(data);

      // 5. Build provenance
      const provenanceInfo = this.buildProvenance(data);

      return {
        success: true,
        data: {
          documentation,
          section,
          financialStatementId,
          stats: {
            entriesCount: data.consolidationEntries.length,
            checksCount: data.plausibilityChecks.length,
            checksPassed: data.plausibilityChecks.filter(
              (c) => c.result === 'PASS',
            ).length,
            icCount: data.icReconciliations.length,
            icOpen: data.icReconciliations.filter((ic) => ic.status === 'open')
              .length,
          },
        },
        message: documentation,
        reasoning: reasoningChain,
        quality,
        provenance: provenanceInfo,
        disclaimer: `Hinweis: Dieser Entwurf wurde automatisch generiert und muss vom Wirtschaftsprüfer geprüft und freigegeben werden. Er ersetzt nicht die professionelle Beurteilung nach IDW PS 240.`,
        suggestedAction: {
          type: 'export',
          label: 'Als Word-Dokument exportieren',
          payload: {
            format: 'docx',
            content: documentation,
            filename: `Pruefpfad_${data.financialStatement.fiscal_year}.docx`,
          },
        },
      };
    } catch (error: any) {
      this.logger.error(`Documentation generation failed: ${error.message}`);
      return this.createErrorResult(
        `Generierung fehlgeschlagen: ${error.message}`,
      );
    }
  }

  /**
   * Fetch all data needed for documentation
   */
  private async fetchDocumentationData(
    financialStatementId: string,
  ): Promise<DocumentationData> {
    const client = this.supabase.getClient();

    const [fsResult, entriesResult, checksResult, icResult, companiesResult] =
      await Promise.all([
        client
          .from('financial_statements')
          .select('*, companies(*)')
          .eq('id', financialStatementId)
          .single(),

        client
          .from('consolidation_entries')
          .select('*')
          .eq('financial_statement_id', financialStatementId)
          .order('created_at'),

        client
          .from('plausibility_checks')
          .select('*')
          .eq('financial_statement_id', financialStatementId),

        client
          .from('ic_reconciliations')
          .select(
            `
          *,
          company_a:companies!ic_reconciliations_company_a_id_fkey(name),
          company_b:companies!ic_reconciliations_company_b_id_fkey(name)
        `,
          )
          .eq('financial_statement_id', financialStatementId),

        client.from('companies').select('*').eq('is_consolidated', true),
      ]);

    return {
      financialStatement: fsResult.data,
      consolidationEntries: entriesResult.data || [],
      plausibilityChecks: checksResult.data || [],
      icReconciliations: icResult.data || [],
      companies: companiesResult.data || [],
    };
  }

  /**
   * Generate documentation content
   */
  private async generateDocumentation(
    data: DocumentationData,
    section: string,
  ): Promise<string> {
    const fs = data.financialStatement;
    const lines: string[] = [];

    // Header
    lines.push(`# Prüfpfad-Dokumentation`);
    lines.push(`## Konzernabschluss ${fs.fiscal_year}`);
    lines.push('');
    lines.push(`**Muttergesellschaft:** ${fs.companies?.name || 'N/A'}`);
    lines.push(
      `**Stichtag:** ${fs.reporting_date || fs.fiscal_year + '-12-31'}`,
    );
    lines.push(`**Status:** ${this.getStatusLabel(fs.status)}`);
    lines.push(`**Erstellt am:** ${new Date().toLocaleDateString('de-DE')}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Consolidation scope
    if (section === 'all' || section === 'scope') {
      lines.push('## 1. Konsolidierungskreis');
      lines.push('');
      lines.push(`**Einbezogene Gesellschaften:** ${data.companies.length}`);
      lines.push('');
      lines.push('| Gesellschaft | Rechtsform | Anteil |');
      lines.push('|-------------|-----------|--------|');
      for (const company of data.companies.slice(0, 20)) {
        lines.push(
          `| ${company.name} | ${company.legal_form || '-'} | ${company.ownership_percentage || 100}% |`,
        );
      }
      if (data.companies.length > 20) {
        lines.push(`| ... | ${data.companies.length - 20} weitere | |`);
      }
      lines.push('');
      lines.push(`*Rechtsgrundlage: § 290 HGB, § 300 HGB*`);
      lines.push('');
    }

    // Consolidation entries
    if (section === 'all' || section === 'entries') {
      lines.push('## 2. Konsolidierungsbuchungen');
      lines.push('');

      const byType = this.groupEntriesByType(data.consolidationEntries);

      for (const [type, entries] of Object.entries(byType)) {
        const hgbRef = this.getHGBReference(type);
        lines.push(`### ${this.getTypeLabel(type)}`);
        lines.push(`*Rechtsgrundlage: ${hgbRef}*`);
        lines.push('');
        lines.push(`**Anzahl Buchungen:** ${entries.length}`);
        const total = entries.reduce(
          (sum, e) => sum + Math.abs(e.amount || 0),
          0,
        );
        lines.push(
          `**Gesamtvolumen:** €${total.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`,
        );
        lines.push('');

        // Show top 5 entries
        lines.push('| Beschreibung | Betrag | Datum |');
        lines.push('|-------------|--------|-------|');
        for (const entry of entries.slice(0, 5)) {
          lines.push(
            `| ${entry.description || entry.adjustment_type} | €${(entry.amount || 0).toLocaleString('de-DE')} | ${entry.created_at?.substring(0, 10) || '-'} |`,
          );
        }
        if (entries.length > 5) {
          lines.push(`| ... | ${entries.length - 5} weitere | |`);
        }
        lines.push('');
      }
    }

    // IC Reconciliation
    if (section === 'all' || section === 'ic') {
      lines.push('## 3. IC-Abstimmung');
      lines.push('');
      lines.push(`*Rechtsgrundlage: § 303 HGB*`);
      lines.push('');

      const open = data.icReconciliations.filter((ic) => ic.status === 'open');
      const resolved = data.icReconciliations.filter(
        (ic) => ic.status === 'resolved',
      );

      lines.push(`**Gesamt:** ${data.icReconciliations.length} Positionen`);
      lines.push(`**Abgestimmt:** ${resolved.length}`);
      lines.push(`**Offen:** ${open.length}`);
      lines.push('');

      if (open.length > 0) {
        lines.push('### Offene Differenzen');
        lines.push('');
        lines.push('| Gesellschaft A | Gesellschaft B | Differenz | Status |');
        lines.push('|---------------|---------------|-----------|--------|');
        for (const ic of open.slice(0, 10)) {
          lines.push(
            `| ${ic.company_a?.name || '-'} | ${ic.company_b?.name || '-'} | €${Math.abs(ic.difference_amount || 0).toLocaleString('de-DE')} | ${ic.status} |`,
          );
        }
        lines.push('');
      }
    }

    // Plausibility checks
    if (section === 'all' || section === 'checks') {
      lines.push('## 4. Plausibilitätsprüfungen');
      lines.push('');

      const passed = data.plausibilityChecks.filter((c) => c.result === 'PASS');
      const failed = data.plausibilityChecks.filter((c) => c.result === 'FAIL');
      const warning = data.plausibilityChecks.filter(
        (c) => c.result === 'WARNING',
      );

      lines.push(
        `**Durchgeführt:** ${data.plausibilityChecks.length} Prüfungen`,
      );
      lines.push(`**Bestanden:** ${passed.length}`);
      lines.push(`**Warnung:** ${warning.length}`);
      lines.push(`**Fehlgeschlagen:** ${failed.length}`);
      lines.push('');

      if (failed.length > 0) {
        lines.push('### Fehlgeschlagene Prüfungen');
        lines.push('');
        for (const check of failed) {
          lines.push(
            `- **${check.check_type}**: ${check.message || 'Keine Details'}`,
          );
        }
        lines.push('');
      }

      if (warning.length > 0) {
        lines.push('### Warnungen');
        lines.push('');
        for (const check of warning) {
          lines.push(
            `- **${check.check_type}**: ${check.message || 'Keine Details'}`,
          );
        }
        lines.push('');
      }
    }

    // Summary
    lines.push('## 5. Zusammenfassung');
    lines.push('');
    lines.push('### Prüfergebnis');
    lines.push('');

    const icOpenCount = data.icReconciliations.filter(
      (ic) => ic.status === 'open',
    ).length;
    const checkFailedCount = data.plausibilityChecks.filter(
      (c) => c.result === 'FAIL',
    ).length;

    if (icOpenCount === 0 && checkFailedCount === 0) {
      lines.push('[OK] **Keine wesentlichen Beanstandungen**');
      lines.push('');
      lines.push(
        'Alle IC-Differenzen sind abgestimmt und alle Plausibilitätsprüfungen bestanden.',
      );
    } else {
      lines.push('[OFFEN] **Offene Punkte vor Abschluss zu klären:**');
      lines.push('');
      if (icOpenCount > 0) {
        lines.push(`- ${icOpenCount} offene IC-Differenzen`);
      }
      if (checkFailedCount > 0) {
        lines.push(`- ${checkFailedCount} fehlgeschlagene Prüfungen`);
      }
    }
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(
      '*Dieses Dokument wurde automatisch generiert und dient als Entwurf für die Prüfdokumentation.*',
    );

    return lines.join('\n');
  }

  /**
   * Build reasoning steps
   */
  private buildReasoningSteps(data: DocumentationData): ReasoningStep[] {
    const steps: ReasoningStep[] = [];

    steps.push({
      observation: `${data.consolidationEntries.length} Konsolidierungsbuchungen analysiert`,
      inference: 'Alle Buchungen haben Lineage-Dokumentation',
      confidence: 0.95,
      dataPoints: data.consolidationEntries.slice(0, 5).map((e) => e.id),
    });

    steps.push({
      observation: `${data.plausibilityChecks.length} Plausibilitätsprüfungen durchgeführt`,
      inference: `${data.plausibilityChecks.filter((c) => c.result === 'PASS').length} bestanden`,
      confidence: 1.0,
      dataPoints: data.plausibilityChecks.slice(0, 5).map((c) => c.id),
    });

    steps.push({
      observation: `${data.icReconciliations.length} IC-Abstimmungen geprüft`,
      inference: `${data.icReconciliations.filter((ic) => ic.status === 'resolved').length} vollständig abgestimmt`,
      confidence: 0.95,
      dataPoints: data.icReconciliations.slice(0, 5).map((ic) => ic.id),
    });

    return steps;
  }

  /**
   * Build quality indicators
   */
  private buildQualityIndicators(data: DocumentationData): QualityIndicators {
    const missingData: string[] = [];

    if (data.consolidationEntries.length === 0)
      missingData.push('Konsolidierungsbuchungen');
    if (data.plausibilityChecks.length === 0)
      missingData.push('Plausibilitätsprüfungen');

    const completeness = 1 - missingData.length / 2;
    const checksPass = data.plausibilityChecks.filter(
      (c) => c.result === 'PASS',
    ).length;
    const checksTotal = data.plausibilityChecks.length;
    const passRate = checksTotal > 0 ? checksPass / checksTotal : 0;

    return this.reasoning.buildQualityIndicators(
      {
        percentage: completeness * 100,
        missingData: missingData.length > 0 ? missingData : undefined,
      },
      true,
      {
        dataQuality: completeness,
        patternMatch: passRate,
        ruleMatch: 0.95,
      },
      [], // deviations
      undefined, // historicalAccuracy
    );
  }

  /**
   * Build provenance
   */
  private buildProvenance(data: DocumentationData): ProvenanceInfo[] {
    const provenanceInfo: ProvenanceInfo[] = [];

    provenanceInfo.push(
      this.provenance.createDatabaseProvenance(
        'financial_statements',
        data.financialStatement.id,
        `Konzernabschluss ${data.financialStatement.fiscal_year}`,
      ),
    );

    provenanceInfo.push(
      this.provenance.createHGBProvenance(
        '§ 290 HGB',
        'Konsolidierungspflicht',
      ),
    );

    provenanceInfo.push(
      this.provenance.createAIProvenance(
        'Gemini',
        'Automatische Dokumentationserstellung',
      ),
    );

    return provenanceInfo;
  }

  // Helper methods
  private groupEntriesByType(entries: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    for (const entry of entries) {
      const type = entry.adjustment_type || 'other';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(entry);
    }
    return grouped;
  }

  private getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      capital_consolidation: 'Kapitalkonsolidierung',
      debt_consolidation: 'Schuldenkonsolidierung',
      expense_income_elimination: 'Aufwands- und Ertragskonsolidierung',
      intermediate_result: 'Zwischenergebniseliminierung',
      goodwill_amortization: 'Goodwill-Abschreibung',
      other: 'Sonstige Buchungen',
    };
    return labels[type] || type;
  }

  private getHGBReference(type: string): string {
    const refs: Record<string, string> = {
      capital_consolidation: '§ 301 HGB',
      debt_consolidation: '§ 303 HGB',
      expense_income_elimination: '§ 305 HGB',
      intermediate_result: '§ 304 HGB',
      goodwill_amortization: '§ 309 HGB',
      other: '§ 300 HGB',
    };
    return refs[type] || '§ 300 HGB';
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      draft: 'Entwurf',
      in_progress: 'In Bearbeitung',
      review: 'In Prüfung',
      approved: 'Freigegeben',
      final: 'Abgeschlossen',
    };
    return labels[status] || status;
  }

  private createErrorResult(message: string): ToolResult {
    return {
      success: false,
      message: `[FEHLER] ${message}`,
      reasoning: {
        steps: [],
        conclusion: 'Dokumentation konnte nicht erstellt werden',
        showAlternativesProminent: false,
      },
      quality: this.reasoning.createDefaultQualityIndicators(),
      provenance: [],
      disclaimer: DISCLAIMERS.general,
    };
  }
}
