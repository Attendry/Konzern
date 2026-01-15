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
  AlternativeInterpretation,
  QualityIndicators,
  ProvenanceInfo,
  OverrideOption,
  DISCLAIMERS,
  getConfidenceLevel,
} from '../types/agent.types';

interface PlausibilityCheckData {
  check: any;
  relatedEntries: any[];
  historicalChecks: any[];
}

/**
 * Plausibilitätsprüfungs-Erklärung Tool
 * Explains plausibility check results and suggests fixes
 */
@Injectable()
export class PlausibilityCheckTool implements AgentTool {
  private readonly logger = new Logger(PlausibilityCheckTool.name);

  name = 'explain_plausibility_check';
  description = 'Erklärt Plausibilitätsprüfungen und schlägt Korrekturen vor';
  
  parameters: ToolParameter[] = [
    {
      name: 'check_id',
      type: 'string',
      description: 'ID der Plausibilitätsprüfung',
      required: false,
    },
    {
      name: 'financial_statement_id',
      type: 'string',
      description: 'ID des Jahresabschlusses für Batch-Analyse',
      required: false,
    },
    {
      name: 'check_type',
      type: 'string',
      description: 'Typ der Prüfung (balance, completeness, consistency, etc.)',
      required: false,
    },
  ];

  requiredMode: 'explain' | 'action' | 'both' = 'both';
  requiresConfirmation = true;
  supportsBatch = true;
  maxBatchSize = 50;

  constructor(
    private supabase: SupabaseService,
    private gemini: GeminiService,
    private reasoning: ReasoningService,
    private provenance: ProvenanceService,
    private hgbKnowledge: HGBKnowledgeService,
  ) {}

  /**
   * Execute check explanation
   */
  async execute(
    params: Record<string, any>,
    context: AgentContext,
  ): Promise<ToolResult> {
    const checkId = params.check_id;
    const financialStatementId = params.financial_statement_id;
    const checkType = params.check_type;

    // If no specific check, analyze all failed checks
    if (!checkId && financialStatementId) {
      return this.analyzeAllChecks(financialStatementId, checkType, context);
    }

    if (!checkId) {
      return this.createErrorResult('Keine Prüfungs-ID oder Abschluss-ID angegeben');
    }

    try {
      // 1. Fetch check data
      const data = await this.fetchCheckData(checkId);
      if (!data.check) {
        return this.createErrorResult('Prüfung nicht gefunden');
      }

      // 2. Analyze the check
      const analysis = await this.analyzeCheck(data);

      // 3. Build reasoning chain
      const reasoningSteps = this.buildReasoningSteps(data, analysis);
      const reasoningChain = this.reasoning.buildReasoningChain(
        'plausibility_check',
        reasoningSteps,
        analysis.alternatives,
      );

      // 4. Build quality indicators
      const quality = this.buildQualityIndicators(data, analysis);

      // 5. Get provenance
      const provenanceInfo = await this.provenance.buildPlausibilityCheckProvenance(checkId);
      provenanceInfo.push(this.provenance.createAIProvenance('Gemini', 'AI-gestützte Analyse'));

      // 6. Format message
      const message = this.formatCheckMessage(data, analysis);

      return {
        success: true,
        data: {
          checkId,
          checkType: data.check.check_type,
          result: data.check.result,
          explanation: analysis.explanation,
          suggestedFix: analysis.suggestedFix,
          confidence: analysis.confidence,
        },
        message,
        reasoning: reasoningChain,
        quality,
        provenance: provenanceInfo,
        overrideOptions: this.getOverrideOptions(data.check.result),
        disclaimer: DISCLAIMERS.general,
        suggestedAction: this.getSuggestedAction(data, analysis, context),
      };

    } catch (error: any) {
      this.logger.error(`Check analysis failed: ${error.message}`);
      return this.createErrorResult(`Analyse fehlgeschlagen: ${error.message}`);
    }
  }

  /**
   * Execute batch analysis for multiple checks
   */
  async executeBatch(
    ids: string[],
    context: AgentContext,
  ): Promise<BatchResult> {
    const results: ToolResult[] = [];
    const resultIndex: Record<number, string> = {};

    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < ids.length; i++) {
      try {
        const result = await this.execute({ check_id: ids[i] }, context);
        results.push(result);
        resultIndex[i + 1] = ids[i];

        if (result.success) {
          succeeded++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        results.push(this.createErrorResult('Verarbeitung fehlgeschlagen'));
      }
    }

    const summary = this.generateBatchSummary(results);

    return {
      total: ids.length,
      processed: ids.length,
      succeeded,
      failed,
      results,
      summary,
      sessionId: context.sessionId,
      resultIndex,
    };
  }

  /**
   * Analyze all checks for a financial statement
   */
  private async analyzeAllChecks(
    financialStatementId: string,
    checkType: string | undefined,
    context: AgentContext,
  ): Promise<ToolResult> {
    const client = this.supabase.getClient();

    let query = client
      .from('plausibility_checks')
      .select('*')
      .eq('financial_statement_id', financialStatementId);

    if (checkType) {
      query = query.eq('check_type', checkType);
    }

    const { data: checks, error } = await query;

    if (error || !checks) {
      return this.createErrorResult('Keine Prüfungen gefunden');
    }

    const passed = checks.filter(c => c.result === 'PASS');
    const failed = checks.filter(c => c.result === 'FAIL');
    const warnings = checks.filter(c => c.result === 'WARNING');

    const message = this.formatSummaryMessage(checks, passed, failed, warnings);

    return {
      success: true,
      data: {
        total: checks.length,
        passed: passed.length,
        failed: failed.length,
        warnings: warnings.length,
        failedChecks: failed.map(c => ({ id: c.id, type: c.check_type, message: c.message })),
      },
      message,
      reasoning: {
        steps: [
          {
            observation: `${checks.length} Plausibilitätsprüfungen analysiert`,
            inference: `${passed.length} bestanden, ${failed.length} fehlgeschlagen, ${warnings.length} Warnungen`,
            confidence: 1.0,
            dataPoints: checks.slice(0, 5).map(c => c.id),
          },
        ],
        conclusion: failed.length === 0 
          ? 'Alle Prüfungen bestanden'
          : `${failed.length} Prüfung(en) erfordern Aufmerksamkeit`,
        showAlternativesProminent: false,
      },
      quality: this.reasoning.buildQualityIndicators(
        { percentage: 100 },
        failed.length === 0,
        { dataQuality: 1.0, patternMatch: 0.9, ruleMatch: passed.length / checks.length },
        failed.map(f => f.check_type),
        undefined,
      ),
      provenance: [
        this.provenance.createDatabaseProvenance(
          'plausibility_checks',
          financialStatementId,
          `${checks.length} Prüfungen`,
        ),
      ],
      disclaimer: DISCLAIMERS.general,
      suggestedAction: failed.length > 0
        ? {
            type: 'view_details',
            label: `${failed.length} fehlgeschlagene Prüfungen anzeigen`,
            payload: { checkIds: failed.map(c => c.id) },
          }
        : undefined,
    };
  }

  /**
   * Fetch check data
   */
  private async fetchCheckData(checkId: string): Promise<PlausibilityCheckData> {
    const client = this.supabase.getClient();

    const { data: check } = await client
      .from('plausibility_checks')
      .select('*')
      .eq('id', checkId)
      .single();

    if (!check) {
      return { check: null, relatedEntries: [], historicalChecks: [] };
    }

    // Get related consolidation entries
    const { data: entries } = await client
      .from('consolidation_entries')
      .select('*')
      .eq('financial_statement_id', check.financial_statement_id)
      .limit(10);

    // Get historical checks of same type
    const { data: historical } = await client
      .from('plausibility_checks')
      .select('result, created_at')
      .eq('check_type', check.check_type)
      .neq('id', checkId)
      .order('created_at', { ascending: false })
      .limit(10);

    return {
      check,
      relatedEntries: entries || [],
      historicalChecks: historical || [],
    };
  }

  /**
   * Analyze the check result
   */
  private async analyzeCheck(data: PlausibilityCheckData): Promise<{
    explanation: string;
    suggestedFix: string;
    confidence: number;
    alternatives: AlternativeInterpretation[];
  }> {
    const check = data.check;
    const checkType = check.check_type;
    const result = check.result;
    const message = check.message || '';

    let explanation = '';
    let suggestedFix = '';
    let confidence = 0.85;
    const alternatives: AlternativeInterpretation[] = [];

    // Get base explanation from check type
    explanation = this.getCheckTypeExplanation(checkType, result, message);

    // Use AI for more detailed analysis if check failed
    if (result === 'FAIL' || result === 'WARNING') {
      try {
        const aiAnalysis = await this.getAIExplanation(data);
        explanation = aiAnalysis.explanation;
        suggestedFix = aiAnalysis.suggestedFix;
        confidence = aiAnalysis.confidence;
        
        if (aiAnalysis.alternatives) {
          alternatives.push(...aiAnalysis.alternatives);
        }
      } catch (error) {
        suggestedFix = this.getDefaultFix(checkType);
      }
    } else {
      suggestedFix = 'Keine Aktion erforderlich';
    }

    return { explanation, suggestedFix, confidence, alternatives };
  }

  /**
   * Get AI-powered explanation
   */
  private async getAIExplanation(data: PlausibilityCheckData): Promise<{
    explanation: string;
    suggestedFix: string;
    confidence: number;
    alternatives?: AlternativeInterpretation[];
  }> {
    const check = data.check;
    
    const prompt = `Als Wirtschaftsprüfer erkläre diese fehlgeschlagene Plausibilitätsprüfung:

Prüfungstyp: ${check.check_type}
Ergebnis: ${check.result}
Fehlermeldung: ${check.message || 'Keine'}
Details: ${JSON.stringify(check.details || {}).substring(0, 500)}

Kontext: ${data.relatedEntries.length} verwandte Buchungen vorhanden.
Historische Prüfungen: ${data.historicalChecks.length} ähnliche Prüfungen gefunden.

Gib eine kurze Erklärung (max 3 Sätze) und einen konkreten Lösungsvorschlag.
Format:
ERKLÄRUNG: [deine Erklärung]
LÖSUNG: [konkreter Lösungsvorschlag]
KONFIDENZ: [0-100]`;

    const response = await this.gemini.complete(prompt);

    const explanationMatch = response.match(/ERKLÄRUNG:\s*(.+?)(?=\n|LÖSUNG:)/s);
    const fixMatch = response.match(/LÖSUNG:\s*(.+?)(?=\n|KONFIDENZ:)/s);
    const confidenceMatch = response.match(/KONFIDENZ:\s*(\d+)/);

    return {
      explanation: explanationMatch?.[1]?.trim() || this.getCheckTypeExplanation(check.check_type, check.result, check.message),
      suggestedFix: fixMatch?.[1]?.trim() || this.getDefaultFix(check.check_type),
      confidence: confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : 0.75,
    };
  }

  /**
   * Build reasoning steps
   */
  private buildReasoningSteps(
    data: PlausibilityCheckData,
    analysis: any,
  ): ReasoningStep[] {
    const check = data.check;
    const steps: ReasoningStep[] = [];

    steps.push({
      observation: `Prüfungstyp: ${this.getCheckTypeLabel(check.check_type)}`,
      inference: `Ergebnis: ${this.getResultLabel(check.result)}`,
      confidence: 1.0,
      dataPoints: [check.id],
    });

    if (check.message) {
      steps.push({
        observation: `Fehlermeldung: "${check.message}"`,
        inference: 'Spezifischer Hinweis auf die Ursache',
        confidence: 0.9,
        dataPoints: [check.id],
      });
    }

    if (data.historicalChecks.length > 0) {
      const passRate = data.historicalChecks.filter(h => h.result === 'PASS').length / data.historicalChecks.length;
      steps.push({
        observation: `${data.historicalChecks.length} historische Prüfungen des gleichen Typs`,
        inference: `Erfolgsquote: ${Math.round(passRate * 100)}%`,
        confidence: 0.8,
        dataPoints: [],
      });
    }

    return steps;
  }

  /**
   * Build quality indicators
   */
  private buildQualityIndicators(
    data: PlausibilityCheckData,
    analysis: any,
  ): QualityIndicators {
    const check = data.check;
    
    return this.reasoning.buildQualityIndicators(
      { percentage: 100 },
      check.result === 'PASS',
      {
        dataQuality: 0.95,
        patternMatch: data.historicalChecks.length > 5 ? 0.85 : 0.5,
        ruleMatch: analysis.confidence,
      },
      check.result === 'FAIL' ? [check.message || check.check_type] : [],
      data.historicalChecks.length > 0
        ? {
            similarCases: data.historicalChecks.length,
            correctPredictions: data.historicalChecks.filter(h => h.result === 'PASS').length,
          }
        : undefined,
    );
  }

  /**
   * Format check message
   */
  private formatCheckMessage(data: PlausibilityCheckData, analysis: any): string {
    const check = data.check;
    const resultLabel = check.result === 'PASS' ? '[OK]' : check.result === 'WARNING' ? '[WARNUNG]' : '[FEHLER]';
    const confidenceLabel = this.getConfidenceLabel(analysis.confidence);

    return `**Plausibilitätsprüfung: ${this.getCheckTypeLabel(check.check_type)}**

**Ergebnis:** ${resultLabel} ${this.getResultLabel(check.result)}
**Konfidenz:** [${confidenceLabel}] ${Math.round(analysis.confidence * 100)}%

${analysis.explanation}

${check.result !== 'PASS' ? `**Empfohlene Lösung:** ${analysis.suggestedFix}` : ''}`;
  }

  /**
   * Format summary message
   */
  private formatSummaryMessage(
    checks: any[],
    passed: any[],
    failed: any[],
    warnings: any[],
  ): string {
    let message = `**Plausibilitätsprüfungen: Übersicht**\n\n`;
    message += `**Gesamt:** ${checks.length} Prüfungen\n`;
    message += `**Bestanden:** ${passed.length}\n`;
    message += `**Warnungen:** ${warnings.length}\n`;
    message += `**Fehlgeschlagen:** ${failed.length}\n\n`;

    if (failed.length > 0) {
      message += '**Fehlgeschlagene Prüfungen:**\n';
      for (const f of failed.slice(0, 5)) {
        message += `- ${this.getCheckTypeLabel(f.check_type)}: ${f.message || 'Keine Details'}\n`;
      }
      if (failed.length > 5) {
        message += `- ... und ${failed.length - 5} weitere\n`;
      }
    }

    return message;
  }

  /**
   * Generate batch summary
   */
  private generateBatchSummary(results: ToolResult[]): string {
    const total = results.length;
    const byResult: Record<string, number> = {};

    for (const r of results) {
      if (r.success && r.data) {
        const result = r.data.result || 'unknown';
        byResult[result] = (byResult[result] || 0) + 1;
      }
    }

    let summary = `**Batch-Analyse: ${total} Plausibilitätsprüfungen**\n\n`;
    
    for (const [result, count] of Object.entries(byResult)) {
      const label = result === 'PASS' ? '[OK]' : result === 'WARNING' ? '[WARNUNG]' : '[FEHLER]';
      summary += `${label} ${this.getResultLabel(result)}: ${count}\n`;
    }

    return summary;
  }

  /**
   * Get suggested action based on analysis
   */
  private getSuggestedAction(
    data: PlausibilityCheckData,
    analysis: any,
    context: AgentContext,
  ): any {
    const check = data.check;

    if (check.result === 'PASS') {
      return undefined;
    }

    if (context.mode.type === 'action') {
      return {
        type: 'mark_resolved',
        label: 'Als geprüft markieren',
        payload: { checkId: check.id },
        requiresConfirmation: true,
      };
    }

    return {
      type: 'view_details',
      label: 'Details anzeigen',
      payload: { route: `/plausibility-check/${check.id}` },
    };
  }

  /**
   * Get override options
   */
  private getOverrideOptions(result: string): OverrideOption[] {
    if (result === 'PASS') {
      return [];
    }

    return [
      { id: 'accept', label: 'Als korrekt akzeptieren', requiresReasoning: true },
      { id: 'materiality', label: 'Unwesentlich', requiresReasoning: true },
      { id: 'will_fix', label: 'Wird korrigiert', requiresReasoning: false },
      { id: 'other', label: 'Andere Begründung', requiresReasoning: true },
    ];
  }

  // Helper methods
  private getCheckTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'balance': 'Bilanzgleichung',
      'completeness': 'Vollständigkeit',
      'consistency': 'Konsistenz',
      'ic_elimination': 'IC-Eliminierung',
      'minority_interest': 'Minderheitenanteile',
      'goodwill': 'Goodwill-Prüfung',
      'equity_movement': 'Eigenkapitalentwicklung',
    };
    return labels[type] || type;
  }

  private getResultLabel(result: string): string {
    const labels: Record<string, string> = {
      'PASS': 'Bestanden',
      'FAIL': 'Fehlgeschlagen',
      'WARNING': 'Warnung',
    };
    return labels[result] || result;
  }

  private getCheckTypeExplanation(type: string, result: string, message: string): string {
    if (result === 'PASS') {
      return 'Die Prüfung wurde erfolgreich bestanden. Keine Auffälligkeiten festgestellt.';
    }

    const explanations: Record<string, string> = {
      'balance': 'Die Bilanzgleichung (Aktiva = Passiva) ist nicht erfüllt. Dies deutet auf unvollständige oder fehlerhafte Buchungen hin.',
      'completeness': 'Nicht alle erforderlichen Daten wurden erfasst. Prüfen Sie, ob alle Gesellschaften vollständig konsolidiert wurden.',
      'consistency': 'Es wurden Inkonsistenzen zwischen verschiedenen Positionen festgestellt.',
      'ic_elimination': 'Die IC-Eliminierung ist nicht vollständig. Konzerninterne Salden müssen vollständig eliminiert werden gemäß § 303 HGB.',
    };

    return message || explanations[type] || 'Die Prüfung hat eine Auffälligkeit ergeben, die manuell untersucht werden sollte.';
  }

  private getDefaultFix(type: string): string {
    const fixes: Record<string, string> = {
      'balance': 'Überprüfen Sie alle Buchungen auf Vollständigkeit und korrigieren Sie etwaige Fehler.',
      'completeness': 'Ergänzen Sie die fehlenden Daten und führen Sie die Prüfung erneut durch.',
      'consistency': 'Gleichen Sie die inkonsistenten Positionen ab und korrigieren Sie die Buchungen.',
      'ic_elimination': 'Vervollständigen Sie die IC-Eliminierungsbuchungen gemäß § 303 HGB.',
    };
    return fixes[type] || 'Manuelle Prüfung und Korrektur erforderlich.';
  }

  private getConfidenceLabel(confidence: number): string {
    const level = getConfidenceLevel(confidence);
    switch (level) {
      case 'high': return 'HOCH';
      case 'medium': return 'MITTEL';
      case 'low': return 'NIEDRIG';
    }
  }

  private createErrorResult(message: string): ToolResult {
    return {
      success: false,
      message: `[FEHLER] ${message}`,
      reasoning: {
        steps: [],
        conclusion: 'Analyse konnte nicht durchgeführt werden',
        showAlternativesProminent: false,
      },
      quality: this.reasoning.createDefaultQualityIndicators(),
      provenance: [],
      disclaimer: DISCLAIMERS.general,
    };
  }
}
