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
  AgentContext,
  BatchResult,
  QualityIndicators,
  ReasoningChain,
  ProvenanceInfo,
  DISCLAIMERS,
} from '../types/agent.types';

interface ConsolidationEntry {
  id: string;
  entryType: string;
  account: string;
  debitAccount?: string;
  creditAccount?: string;
  amount: number;
  description: string;
  reference?: string;
  companyName?: string;
  period?: string;
  createdAt: Date;
}

interface EntryExplanation {
  purpose: string;
  hgbBasis: string;
  hgbParagraph?: string;
  effect: string;
  relatedEntries: string[];
  confidence: number;
}

/**
 * Tool for explaining consolidation entries
 */
@Injectable()
export class EntryExplanationTool implements AgentTool {
  private readonly logger = new Logger(EntryExplanationTool.name);

  name = 'explain_entry';
  description = 'Erklärt Konsolidierungsbuchungen und deren HGB-Grundlage';
  parameters: ToolParameter[] = [
    {
      name: 'entry_id',
      type: 'string',
      description: 'ID der zu erklärenden Buchung',
      required: false,
    },
    {
      name: 'entry_type',
      type: 'string',
      description: 'Buchungstyp für allgemeine Erklärung (z.B. CAPITAL, IC_DEBT, IC_EXPENSE)',
      required: false,
    },
  ];
  requiredMode: 'explain' | 'action' | 'both' = 'explain';
  requiresConfirmation = false;
  supportsBatch = true;
  maxBatchSize = 20;

  // Entry type explanations
  private readonly entryTypeInfo: Record<string, {
    name: string;
    hgbParagraph: string;
    description: string;
    purpose: string;
  }> = {
    'CAPITAL': {
      name: 'Kapitalkonsolidierung',
      hgbParagraph: '§ 301 HGB',
      description: 'Verrechnung des Beteiligungsbuchwerts mit dem anteiligen Eigenkapital der Tochtergesellschaft',
      purpose: 'Eliminierung der konzerninternen Kapitalverflechtungen',
    },
    'IC_DEBT': {
      name: 'Schuldenkonsolidierung',
      hgbParagraph: '§ 303 HGB',
      description: 'Eliminierung von Forderungen und Verbindlichkeiten zwischen Konzernunternehmen',
      purpose: 'Darstellung der Konzernbilanz ohne interne Verflechtungen',
    },
    'IC_EXPENSE': {
      name: 'Aufwands- und Ertragskonsolidierung',
      hgbParagraph: '§ 305 HGB',
      description: 'Eliminierung konzerninterner Aufwendungen und Erträge',
      purpose: 'Vermeidung von Doppelerfassungen in der Konzern-GuV',
    },
    'INTERCOMPANY': {
      name: 'Zwischenergebniseliminierung',
      hgbParagraph: '§ 304 HGB',
      description: 'Eliminierung von Gewinnen aus konzerninternen Lieferungen und Leistungen',
      purpose: 'Bewertung zum Konzern-Anschaffungskosten',
    },
    'GOODWILL': {
      name: 'Geschäfts- oder Firmenwert',
      hgbParagraph: '§ 309 HGB',
      description: 'Behandlung des Unterschiedsbetrags aus der Kapitalkonsolidierung',
      purpose: 'Planmäßige Abschreibung des aktivierten Geschäftswerts',
    },
    'MINORITY': {
      name: 'Minderheitenanteile',
      hgbParagraph: '§ 307 HGB',
      description: 'Ausweis der Anteile anderer Gesellschafter am Eigenkapital',
      purpose: 'Getrennte Darstellung fremder Anteile am Konzerneigenkapital',
    },
    'EQUITY_METHOD': {
      name: 'Equity-Methode',
      hgbParagraph: '§ 312 HGB',
      description: 'Bewertung assoziierter Unternehmen nach der Equity-Methode',
      purpose: 'Fortschreibung des Beteiligungsbuchwerts mit dem anteiligen Jahresergebnis',
    },
    'CURRENCY': {
      name: 'Währungsumrechnung',
      hgbParagraph: '§ 308a HGB',
      description: 'Umrechnung von Abschlüssen in fremder Währung',
      purpose: 'Vereinheitlichung auf die Konzernwährung',
    },
    'ADJUSTMENT': {
      name: 'Anpassungsbuchung',
      hgbParagraph: '§ 300 HGB',
      description: 'Vereinheitlichung von Bilanzierungs- und Bewertungsmethoden',
      purpose: 'Konzerneinheitliche Bilanzierung (HB II Anpassung)',
    },
  };

  constructor(
    private supabase: SupabaseService,
    private gemini: GeminiService,
    private reasoning: ReasoningService,
    private provenance: ProvenanceService,
    private hgb: HGBKnowledgeService,
  ) {}

  async execute(
    params: Record<string, any>,
    context: AgentContext,
  ): Promise<ToolResult> {
    try {
      // If entry_id provided, explain specific entry
      if (params.entry_id) {
        return await this.explainSpecificEntry(params.entry_id, context);
      }
      
      // If entry_type provided, give general explanation
      if (params.entry_type) {
        return this.explainEntryType(params.entry_type);
      }

      // Default: list and explain all entry types
      return this.explainAllEntryTypes();
    } catch (error: any) {
      this.logger.error(`Entry explanation failed: ${error.message}`);
      return {
        success: false,
        message: `Fehler bei der Buchungserklärung: ${error.message}`,
        reasoning: this.reasoning.buildEmptyChain(error.message),
        quality: this.buildDefaultQuality(),
        provenance: [],
        disclaimer: DISCLAIMERS.general,
      };
    }
  }

  async executeBatch(
    items: string[],
    context: AgentContext,
  ): Promise<BatchResult> {
    const results: ToolResult[] = [];
    let succeeded = 0;
    let failed = 0;
    const resultIndex: Record<number, string> = {};

    for (let i = 0; i < items.length; i++) {
      try {
        const result = await this.execute({ entry_id: items[i] }, context);
        results.push(result);
        if (result.success) {
          succeeded++;
        } else {
          failed++;
        }
        resultIndex[i] = items[i];
      } catch (error: any) {
        failed++;
        results.push({
          success: false,
          message: error.message,
          reasoning: this.reasoning.buildEmptyChain(error.message),
          quality: this.buildDefaultQuality(),
          provenance: [],
          disclaimer: DISCLAIMERS.general,
        });
      }
    }

    return {
      total: items.length,
      processed: items.length,
      succeeded,
      failed,
      results,
      summary: `${succeeded}/${items.length} Buchungen erklärt.`,
      sessionId: context.sessionId,
      resultIndex,
    };
  }

  /**
   * Explain a specific consolidation entry
   */
  private async explainSpecificEntry(
    entryId: string,
    context: AgentContext,
  ): Promise<ToolResult> {
    const entry = await this.fetchEntry(entryId);
    
    if (!entry) {
      return {
        success: false,
        message: 'Buchung nicht gefunden.',
        reasoning: this.reasoning.buildEmptyChain('Buchung nicht gefunden'),
        quality: this.buildDefaultQuality(),
        provenance: [],
        disclaimer: DISCLAIMERS.general,
      };
    }

    const explanation = await this.generateExplanation(entry);
    const hgbInfo = await this.hgb.getParagraph(explanation.hgbParagraph || '');
    const reasoning = this.buildReasoning(entry, explanation, hgbInfo);
    const quality = this.buildQuality(entry, explanation);
    const provenance = this.buildProvenance(entry, explanation);

    return {
      success: true,
      data: {
        entryId,
        entryType: entry.entryType,
        explanation,
      },
      message: this.formatExplanation(entry, explanation, hgbInfo),
      reasoning,
      quality,
      provenance,
      disclaimer: DISCLAIMERS.hgb,
    };
  }

  /**
   * Explain a general entry type
   */
  private explainEntryType(entryType: string): ToolResult {
    const info = this.entryTypeInfo[entryType.toUpperCase()];
    
    if (!info) {
      const availableTypes = Object.keys(this.entryTypeInfo).join(', ');
      return {
        success: false,
        message: `Unbekannter Buchungstyp: ${entryType}. Verfügbare Typen: ${availableTypes}`,
        reasoning: this.reasoning.buildEmptyChain('Unbekannter Buchungstyp'),
        quality: this.buildDefaultQuality(),
        provenance: [],
        disclaimer: DISCLAIMERS.general,
      };
    }

    const message = this.formatTypeExplanation(entryType.toUpperCase(), info);
    
    return {
      success: true,
      data: {
        entryType: entryType.toUpperCase(),
        ...info,
      },
      message,
      reasoning: this.reasoning.buildReasoningChain(
        [
          {
            observation: `Buchungstyp: ${info.name}`,
            inference: `Rechtsgrundlage: ${info.hgbParagraph}`,
            confidence: 0.95,
            dataPoints: [info.hgbParagraph],
          },
        ],
        info.purpose,
      ),
      quality: this.reasoning.buildQualityIndicators(
        { percentage: 100 },
        true,
        { dataQuality: 1.0, patternMatch: 1.0, ruleMatch: 1.0 },
        [],
        undefined,
      ),
      provenance: [
        this.provenance.createHGBProvenance(info.hgbParagraph, info.name),
      ],
      disclaimer: DISCLAIMERS.hgb,
    };
  }

  /**
   * Explain all available entry types
   */
  private explainAllEntryTypes(): ToolResult {
    let message = `**Übersicht der Konsolidierungsbuchungen**\n\n`;
    
    for (const [type, info] of Object.entries(this.entryTypeInfo)) {
      message += `### ${info.name} (${type})\n`;
      message += `Rechtsgrundlage: ${info.hgbParagraph}\n`;
      message += `${info.description}\n\n`;
    }

    message += `\n*Für Details zu einem Buchungstyp fragen Sie z.B. "Erkläre CAPITAL-Buchungen"*`;

    return {
      success: true,
      data: {
        entryTypes: Object.keys(this.entryTypeInfo),
        count: Object.keys(this.entryTypeInfo).length,
      },
      message,
      reasoning: this.reasoning.buildReasoningChain(
        [
          {
            observation: `${Object.keys(this.entryTypeInfo).length} Konsolidierungsbuchungstypen verfügbar`,
            inference: 'Übersicht aller HGB-konformen Buchungsarten erstellt',
            confidence: 1.0,
            dataPoints: Object.keys(this.entryTypeInfo),
          },
        ],
        'Vollständige Übersicht der Konsolidierungsbuchungen nach HGB',
      ),
      quality: this.reasoning.buildQualityIndicators(
        { percentage: 100 },
        true,
        { dataQuality: 1.0, patternMatch: 1.0, ruleMatch: 1.0 },
        [],
        undefined,
      ),
      provenance: Object.values(this.entryTypeInfo).map(info =>
        this.provenance.createHGBProvenance(info.hgbParagraph, info.name),
      ),
      disclaimer: DISCLAIMERS.hgb,
    };
  }

  /**
   * Fetch entry from database
   */
  private async fetchEntry(entryId: string): Promise<ConsolidationEntry | null> {
    const client = this.supabase.getClient();
    
    const { data, error } = await client
      .from('consolidation_entries')
      .select(`
        id,
        entry_type,
        account,
        debit_account,
        credit_account,
        amount,
        description,
        reference,
        created_at,
        financial_statement:financial_statements(
          period,
          company:companies(name)
        )
      `)
      .eq('id', entryId)
      .single();

    if (error || !data) {
      return null;
    }

    const fs = data.financial_statement as any;
    
    return {
      id: data.id,
      entryType: data.entry_type,
      account: data.account,
      debitAccount: data.debit_account,
      creditAccount: data.credit_account,
      amount: data.amount,
      description: data.description || '',
      reference: data.reference,
      companyName: fs?.company?.name,
      period: fs?.period,
      createdAt: new Date(data.created_at),
    };
  }

  /**
   * Generate explanation for entry
   */
  private async generateExplanation(entry: ConsolidationEntry): Promise<EntryExplanation> {
    const typeInfo = this.entryTypeInfo[entry.entryType];
    
    if (!typeInfo) {
      // Use AI for unknown types
      if (this.gemini.isAvailable()) {
        return await this.generateAIExplanation(entry);
      }
      
      return {
        purpose: 'Konsolidierungsbuchung',
        hgbBasis: 'HGB Konzernrechnungslegung',
        effect: `Buchung über ${this.formatCurrency(entry.amount)}`,
        relatedEntries: [],
        confidence: 0.5,
      };
    }

    return {
      purpose: typeInfo.purpose,
      hgbBasis: `${typeInfo.hgbParagraph}: ${typeInfo.description}`,
      hgbParagraph: typeInfo.hgbParagraph,
      effect: this.describeEffect(entry, typeInfo),
      relatedEntries: [],
      confidence: 0.9,
    };
  }

  /**
   * Generate AI-powered explanation
   */
  private async generateAIExplanation(entry: ConsolidationEntry): Promise<EntryExplanation> {
    const prompt = `Erkläre diese Konsolidierungsbuchung nach HGB:

Typ: ${entry.entryType}
Konto: ${entry.account}
Betrag: ${this.formatCurrency(entry.amount)}
Beschreibung: ${entry.description}

Antworte mit JSON:
{
  "purpose": "Zweck der Buchung",
  "hgbBasis": "Rechtsgrundlage nach HGB",
  "hgbParagraph": "§ XXX HGB",
  "effect": "Auswirkung auf den Konzernabschluss",
  "confidence": 0.0-1.0
}`;

    try {
      const response = await this.gemini.complete(prompt);
      const parsed = this.parseJsonResponse(response);
      
      return {
        purpose: parsed.purpose || 'Konsolidierungsbuchung',
        hgbBasis: parsed.hgbBasis || 'HGB Konzernrechnungslegung',
        hgbParagraph: parsed.hgbParagraph,
        effect: parsed.effect || `Buchung über ${this.formatCurrency(entry.amount)}`,
        relatedEntries: [],
        confidence: parsed.confidence || 0.7,
      };
    } catch (error: any) {
      this.logger.warn(`AI explanation failed: ${error.message}`);
      return {
        purpose: 'Konsolidierungsbuchung',
        hgbBasis: 'HGB Konzernrechnungslegung',
        effect: `Buchung über ${this.formatCurrency(entry.amount)}`,
        relatedEntries: [],
        confidence: 0.5,
      };
    }
  }

  /**
   * Describe the effect of an entry
   */
  private describeEffect(entry: ConsolidationEntry, typeInfo: any): string {
    const amount = this.formatCurrency(entry.amount);
    
    switch (entry.entryType) {
      case 'CAPITAL':
        return `Eliminiert Beteiligungsbuchwert von ${amount} gegen anteiliges Eigenkapital`;
      case 'IC_DEBT':
        return `Eliminiert konzerninterne Forderungen/Verbindlichkeiten von ${amount}`;
      case 'IC_EXPENSE':
        return `Eliminiert konzerninternen Aufwand/Ertrag von ${amount}`;
      case 'GOODWILL':
        return `Geschäftswert-Anpassung von ${amount}`;
      case 'MINORITY':
        return `Minderheitenanteile von ${amount} am Eigenkapital ausgewiesen`;
      default:
        return `${typeInfo.name}: ${amount}`;
    }
  }

  /**
   * Format explanation message
   */
  private formatExplanation(
    entry: ConsolidationEntry,
    explanation: EntryExplanation,
    hgbInfo: any,
  ): string {
    const typeInfo = this.entryTypeInfo[entry.entryType];
    
    let message = `**${typeInfo?.name || entry.entryType}** [${entry.entryType}]\n\n`;
    
    if (entry.companyName) {
      message += `${entry.companyName}`;
      if (entry.period) message += ` | ${entry.period}`;
      message += '\n\n';
    }

    message += `**Betrag:** ${this.formatCurrency(entry.amount)}\n`;
    if (entry.debitAccount) message += `**Soll:** ${entry.debitAccount}\n`;
    if (entry.creditAccount) message += `**Haben:** ${entry.creditAccount}\n`;
    message += '\n';

    message += `**HGB-Grundlage:** ${explanation.hgbParagraph || 'HGB Konzernrechnungslegung'}\n`;
    message += `${explanation.hgbBasis}\n\n`;

    message += `**Zweck:** ${explanation.purpose}\n\n`;
    message += `**Auswirkung:** ${explanation.effect}`;

    if (entry.description) {
      message += `\n\n*Anmerkung: ${entry.description}*`;
    }

    return message;
  }

  /**
   * Format type explanation
   */
  private formatTypeExplanation(entryType: string, info: any): string {
    let message = `**${info.name}** [${entryType}]\n\n`;
    message += `**Rechtsgrundlage:** ${info.hgbParagraph}\n\n`;
    message += `**Beschreibung:**\n${info.description}\n\n`;
    message += `**Zweck:**\n${info.purpose}\n\n`;
    
    // Add practical examples
    message += `**Typische Buchungsvorgänge:**\n`;
    message += this.getExamples(entryType);

    return message;
  }

  /**
   * Get examples for entry type
   */
  private getExamples(entryType: string): string {
    const examples: Record<string, string> = {
      'CAPITAL': '- Eliminierung Beteiligung gegen Eigenkapital\n- Ausweis passiver Unterschiedsbetrag\n- Aufdeckung stiller Reserven',
      'IC_DEBT': '- Forderung Mutter an Tochter\n- Darlehen zwischen Konzerngesellschaften\n- Verrechnungskonten',
      'IC_EXPENSE': '- Konzerninterne Warenlieferungen\n- Managementgebühren\n- Lizenzgebühren im Konzern',
      'INTERCOMPANY': '- Marge auf konzerninterne Vorräte\n- Gewinn aus Anlagenverkauf im Konzern',
      'GOODWILL': '- Planmäßige AfA Geschäftswert\n- Außerplanmäßige Abschreibung',
      'MINORITY': '- Anteil fremder Gesellschafter am EK\n- Anteil am Jahresergebnis',
      'EQUITY_METHOD': '- Anteil am assoziierten Unternehmen\n- Dividendenverrechnung',
      'CURRENCY': '- Umrechnung Aktiva zum Stichtagskurs\n- GuV zum Durchschnittskurs',
      'ADJUSTMENT': '- LIFO zu FIFO Anpassung\n- Aktivierung Entwicklungskosten',
    };
    return examples[entryType] || '- Keine Beispiele verfügbar';
  }

  /**
   * Build reasoning chain
   */
  private buildReasoning(
    entry: ConsolidationEntry,
    explanation: EntryExplanation,
    hgbInfo: any,
  ): ReasoningChain {
    const typeInfo = this.entryTypeInfo[entry.entryType];
    
    return this.reasoning.buildReasoningChain(
      [
        {
          observation: `Buchungstyp: ${typeInfo?.name || entry.entryType}`,
          inference: `Identifiziert als ${typeInfo?.description || 'Konsolidierungsbuchung'}`,
          confidence: 0.95,
          dataPoints: [entry.entryType, entry.account],
        },
        {
          observation: `Betrag: ${this.formatCurrency(entry.amount)}`,
          inference: explanation.effect,
          confidence: explanation.confidence,
          dataPoints: entry.debitAccount && entry.creditAccount 
            ? [entry.debitAccount, entry.creditAccount] 
            : [entry.account],
        },
        {
          observation: `HGB-Grundlage: ${explanation.hgbParagraph || 'HGB'}`,
          inference: explanation.purpose,
          confidence: 0.9,
          dataPoints: [explanation.hgbParagraph || 'HGB Konzernrechnungslegung'],
        },
      ],
      `${typeInfo?.name || entry.entryType}: ${explanation.purpose}`,
    );
  }

  /**
   * Build quality indicators
   */
  private buildQuality(
    entry: ConsolidationEntry,
    explanation: EntryExplanation,
  ): QualityIndicators {
    const typeInfo = this.entryTypeInfo[entry.entryType];
    
    return this.reasoning.buildQualityIndicators(
      {
        percentage: entry.description ? 100 : 80,
        missingData: entry.description ? undefined : ['Buchungsbeschreibung'],
      },
      true,
      {
        dataQuality: 0.95,
        patternMatch: typeInfo ? 1.0 : 0.7,
        ruleMatch: explanation.confidence,
      },
      [],
      undefined,
    );
  }

  /**
   * Build provenance
   */
  private buildProvenance(
    entry: ConsolidationEntry,
    explanation: EntryExplanation,
  ): ProvenanceInfo[] {
    const result: ProvenanceInfo[] = [
      this.provenance.createDatabaseProvenance(
        'consolidation_entries',
        entry.id,
        `${entry.entryType}: ${this.formatCurrency(entry.amount)}`,
      ),
    ];

    if (explanation.hgbParagraph) {
      result.push(
        this.provenance.createHGBProvenance(
          explanation.hgbParagraph,
          this.entryTypeInfo[entry.entryType]?.name || entry.entryType,
        ),
      );
    }

    return result;
  }

  /**
   * Format currency
   */
  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  }

  /**
   * Parse JSON response
   */
  private parseJsonResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      this.logger.warn('Failed to parse AI response as JSON');
    }
    return {};
  }

  /**
   * Build default quality
   */
  private buildDefaultQuality(): QualityIndicators {
    return this.reasoning.buildQualityIndicators(
      { percentage: 0 },
      false,
      { dataQuality: 0, patternMatch: 0, ruleMatch: 0 },
      [],
      undefined,
    );
  }
}
