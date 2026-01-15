import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { GeminiService } from '../services/gemini.service';
import { ReasoningService } from '../services/reasoning.service';
import { ProvenanceService } from '../services/provenance.service';
import { HGBKnowledgeService } from '../services/hgb-knowledge.service';
import { HGBLegalService } from '../services/hgb-legal.service';
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

export type ICCauseType = 'timing' | 'fx' | 'rounding' | 'missing_entry' | 'error' | 'unknown';

interface ICAnalysisData {
  reconciliation: any;
  companyA: any;
  companyB: any;
  historicalCases: number;
  historicalTimingPercent: number;
  historicalCorrect: number;
}

interface ICAnalysisResult {
  likelyCause: ICCauseType;
  confidence: number;
  explanation: string;
  suggestedAction: string;
  alternatives: AlternativeInterpretation[];
}

/**
 * IC Differenz-Analyse Tool
 * Analyzes intercompany differences and suggests resolutions
 */
@Injectable()
export class ICAnalysisTool implements AgentTool {
  private readonly logger = new Logger(ICAnalysisTool.name);

  name = 'analyze_ic_difference';
  description = 'Analysiert IC-Differenzen und schlägt Lösungen vor';
  
  parameters: ToolParameter[] = [
    {
      name: 'reconciliation_id',
      type: 'string',
      description: 'ID der IC-Abstimmung',
      required: true,
    },
  ];

  requiredMode: 'explain' | 'action' | 'both' = 'both';
  requiresConfirmation = true;
  supportsBatch = true;
  maxBatchSize = 100;

  constructor(
    private supabase: SupabaseService,
    private gemini: GeminiService,
    private reasoning: ReasoningService,
    private provenance: ProvenanceService,
    private hgbKnowledge: HGBKnowledgeService,
    private hgbLegal: HGBLegalService,
  ) {}

  /**
   * Execute analysis for a single IC reconciliation
   */
  async execute(
    params: Record<string, any>,
    context: AgentContext,
  ): Promise<ToolResult> {
    const reconciliationId = params.reconciliation_id;

    try {
      // 1. Fetch IC data
      const data = await this.fetchICData(reconciliationId);
      if (!data) {
        return this.createErrorResult('IC-Abstimmung nicht gefunden');
      }

      // 2. Analyze the reconciliation
      const analysis = await this.analyzeReconciliation(data);

      // 3. Build reasoning chain
      const reasoningSteps = this.buildReasoningSteps(data, analysis);
      const reasoningChain = this.reasoning.buildReasoningChain(
        'ic_analysis',
        reasoningSteps,
        analysis.alternatives,
      );

      // 4. Build quality indicators
      const quality = this.buildQualityIndicators(data, analysis);

      // 5. Get provenance
      const provenanceInfo = await this.provenance.buildICReconciliationProvenance(
        reconciliationId,
      );

      // 6. Add AI provenance
      provenanceInfo.push(this.provenance.createAIProvenance(
        'Gemini',
        'AI-gestützte Ursachenanalyse',
      ));

      // 7. Format message
      let message = this.formatAnalysisMessage(data, analysis);

      // 8. Add legal context if available
      try {
        const legalContext = await this.hgbLegal.getLegalContext('debt_consolidation', {
          includeRelated: true,
          includeIdw: true,
        });
        
        if (legalContext) {
          const legalInfo = this.hgbLegal.formatLegalContextForDisplay(legalContext);
          message += '\n\n---\n\n**Rechtlicher Kontext:**\n\n' + legalInfo;
          
          // Add legal provenance
          provenanceInfo.push({
            type: 'hgb_paragraph',
            source: legalContext.primaryParagraph.fullReference,
            hgbParagraph: legalContext.primaryParagraph.fullReference,
            description: legalContext.primaryParagraph.title,
            timestamp: new Date(),
          });
        }
      } catch (error: any) {
        this.logger.warn(`Failed to get legal context: ${error.message}`);
        // Continue without legal context
      }

      return {
        success: true,
        data: {
          reconciliationId,
          likelyCause: analysis.likelyCause,
          confidence: analysis.confidence,
          explanation: analysis.explanation,
          suggestedAction: analysis.suggestedAction,
        },
        message,
        reasoning: reasoningChain,
        quality,
        provenance: provenanceInfo,
        overrideOptions: this.getOverrideOptions(),
        disclaimer: DISCLAIMERS.general,
        suggestedAction: context.mode.type === 'action' 
          ? {
              type: 'create_correction',
              label: 'Korrekturbuchung erstellen',
              payload: { reconciliationId, cause: analysis.likelyCause },
              requiresConfirmation: true,
            }
          : {
              type: 'navigate',
              label: 'Details anzeigen',
              payload: { route: `/ic-reconciliation/${reconciliationId}` },
            },
      };

    } catch (error: any) {
      this.logger.error(`IC analysis failed: ${error.message}`);
      return this.createErrorResult(`Analyse fehlgeschlagen: ${error.message}`);
    }
  }

  /**
   * Execute batch analysis for multiple reconciliations
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
        const result = await this.execute({ reconciliation_id: ids[i] }, context);
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

    // Generate summary
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
   * Fetch IC reconciliation data
   */
  private async fetchICData(reconciliationId: string): Promise<ICAnalysisData | null> {
    const client = this.supabase.getClient();

    const { data: recon, error } = await client
      .from('ic_reconciliations')
      .select(`
        *,
        company_a:companies!ic_reconciliations_company_a_id_fkey(*),
        company_b:companies!ic_reconciliations_company_b_id_fkey(*)
      `)
      .eq('id', reconciliationId)
      .single();

    if (error || !recon) {
      return null;
    }

    // Get historical cases between these companies
    const { data: historical } = await client
      .from('ic_reconciliations')
      .select('status, resolution_type')
      .or(`and(company_a_id.eq.${recon.company_a_id},company_b_id.eq.${recon.company_b_id}),and(company_a_id.eq.${recon.company_b_id},company_b_id.eq.${recon.company_a_id})`)
      .neq('id', reconciliationId);

    const historicalCases = historical?.length || 0;
    const timingCases = historical?.filter(h => h.resolution_type === 'timing').length || 0;
    const resolvedCases = historical?.filter(h => h.status === 'resolved').length || 0;

    return {
      reconciliation: recon,
      companyA: recon.company_a,
      companyB: recon.company_b,
      historicalCases,
      historicalTimingPercent: historicalCases > 0 ? (timingCases / historicalCases) * 100 : 0,
      historicalCorrect: resolvedCases,
    };
  }

  /**
   * Analyze the reconciliation using AI and rules
   */
  private async analyzeReconciliation(data: ICAnalysisData): Promise<ICAnalysisResult> {
    const recon = data.reconciliation;
    const diffAmount = Math.abs(recon.difference_amount || 0);
    const amountA = recon.amount_company_a || 0;
    const amountB = recon.amount_company_b || 0;

    // Rule-based initial assessment
    let likelyCause: ICCauseType = 'unknown';
    let confidence = 0.5;
    const alternatives: AlternativeInterpretation[] = [];

    // Check for rounding differences (small amounts)
    if (diffAmount < 1) {
      likelyCause = 'rounding';
      confidence = 0.95;
    } else if (diffAmount < 100) {
      likelyCause = 'rounding';
      confidence = 0.85;
      alternatives.push({
        interpretation: 'Buchungsfehler',
        probability: 0.1,
        checkQuestion: 'Wurde der Betrag korrekt erfasst?',
      });
    }
    // Check for timing differences based on booking dates
    else if (recon.booking_date_a !== recon.booking_date_b) {
      const dateA = new Date(recon.booking_date_a);
      const dateB = new Date(recon.booking_date_b);
      const daysDiff = Math.abs((dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff <= 5) {
        likelyCause = 'timing';
        confidence = 0.88;
        alternatives.push({
          interpretation: 'Währungsdifferenz',
          probability: 0.08,
          checkQuestion: 'Unterschiedliche Kurse am Buchungstag?',
        });
      } else if (daysDiff <= 30) {
        likelyCause = 'timing';
        confidence = 0.75;
        alternatives.push({
          interpretation: 'Fehlende Buchung',
          probability: 0.15,
          checkQuestion: 'Wurde die Gegenbuchung vergessen?',
        });
        alternatives.push({
          interpretation: 'Währungsdifferenz',
          probability: 0.10,
          checkQuestion: 'Unterschiedliche Kurse?',
        });
      }
    }
    // Check for currency differences
    else if (recon.currency_a !== recon.currency_b) {
      likelyCause = 'fx';
      confidence = 0.90;
    }
    // Missing entry check
    else if (amountA === 0 || amountB === 0) {
      likelyCause = 'missing_entry';
      confidence = 0.92;
    }

    // Adjust confidence based on historical data
    if (data.historicalCases > 5) {
      if (likelyCause === 'timing' && data.historicalTimingPercent > 60) {
        confidence = Math.min(0.95, confidence + 0.05);
      }
    }

    // Use AI for additional context if still uncertain
    let explanation = '';
    let suggestedAction = '';

    if (confidence < 0.8) {
      try {
        const aiAnalysis = await this.getAIAnalysis(data, likelyCause, confidence);
        explanation = aiAnalysis.explanation;
        suggestedAction = aiAnalysis.suggestedAction;
        
        // AI might adjust our assessment
        if (aiAnalysis.adjustedCause) {
          likelyCause = aiAnalysis.adjustedCause;
          confidence = aiAnalysis.adjustedConfidence;
        }
      } catch (error) {
        explanation = this.getDefaultExplanation(likelyCause, data);
        suggestedAction = this.getDefaultSuggestedAction(likelyCause);
      }
    } else {
      explanation = this.getDefaultExplanation(likelyCause, data);
      suggestedAction = this.getDefaultSuggestedAction(likelyCause);
    }

    return {
      likelyCause,
      confidence,
      explanation,
      suggestedAction,
      alternatives,
    };
  }

  /**
   * Get AI-powered analysis for uncertain cases
   */
  private async getAIAnalysis(
    data: ICAnalysisData,
    initialCause: ICCauseType,
    initialConfidence: number,
  ): Promise<{
    explanation: string;
    suggestedAction: string;
    adjustedCause?: ICCauseType;
    adjustedConfidence: number;
  }> {
    const prompt = `Analysiere diese IC-Differenz für einen Wirtschaftsprüfer:

Gesellschaft A: ${data.companyA?.name}
  - Betrag: €${data.reconciliation.amount_company_a?.toLocaleString('de-DE')}
  - Buchungsdatum: ${data.reconciliation.booking_date_a || 'nicht angegeben'}
  - Währung: ${data.reconciliation.currency_a || 'EUR'}

Gesellschaft B: ${data.companyB?.name}
  - Betrag: €${data.reconciliation.amount_company_b?.toLocaleString('de-DE')}
  - Buchungsdatum: ${data.reconciliation.booking_date_b || 'nicht angegeben'}
  - Währung: ${data.reconciliation.currency_b || 'EUR'}

Differenz: €${Math.abs(data.reconciliation.difference_amount).toLocaleString('de-DE')}

Historische Fälle zwischen diesen Gesellschaften: ${data.historicalCases}
Davon Timing-Differenzen: ${data.historicalTimingPercent.toFixed(0)}%

Initiale Einschätzung: ${initialCause} (Konfidenz: ${(initialConfidence * 100).toFixed(0)}%)

Gib eine kurze Erklärung (max 3 Sätze) und eine empfohlene Aktion.
Format:
ERKLÄRUNG: [deine Erklärung]
AKTION: [empfohlene Aktion]
URSACHE: [timing|fx|rounding|missing_entry|error|unknown]
KONFIDENZ: [0-100]`;

    const response = await this.gemini.complete(prompt);

    // Parse response
    const explanationMatch = response.match(/ERKLÄRUNG:\s*(.+?)(?=\n|AKTION:)/s);
    const actionMatch = response.match(/AKTION:\s*(.+?)(?=\n|URSACHE:)/s);
    const causeMatch = response.match(/URSACHE:\s*(timing|fx|rounding|missing_entry|error|unknown)/i);
    const confidenceMatch = response.match(/KONFIDENZ:\s*(\d+)/);

    return {
      explanation: explanationMatch?.[1]?.trim() || this.getDefaultExplanation(initialCause, data),
      suggestedAction: actionMatch?.[1]?.trim() || this.getDefaultSuggestedAction(initialCause),
      adjustedCause: causeMatch?.[1]?.toLowerCase() as ICCauseType,
      adjustedConfidence: confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : initialConfidence,
    };
  }

  /**
   * Build reasoning steps for the analysis
   */
  private buildReasoningSteps(
    data: ICAnalysisData,
    analysis: ICAnalysisResult,
  ): ReasoningStep[] {
    const steps: ReasoningStep[] = [];
    const recon = data.reconciliation;

    // Step 1: Data observation
    steps.push({
      observation: `Buchungsdatum Gesellschaft A: ${recon.booking_date_a || 'nicht angegeben'}, Gesellschaft B: ${recon.booking_date_b || 'nicht angegeben'}`,
      inference: recon.booking_date_a !== recon.booking_date_b
        ? `Differenz von ${this.calculateDaysDiff(recon.booking_date_a, recon.booking_date_b)} Tagen`
        : 'Gleiche Buchungsdaten',
      confidence: 0.95,
      dataPoints: [recon.id],
    });

    // Step 2: Amount comparison
    steps.push({
      observation: `Betrag Gesellschaft A: €${(recon.amount_company_a || 0).toLocaleString('de-DE')}, Gesellschaft B: €${(recon.amount_company_b || 0).toLocaleString('de-DE')}`,
      inference: `Differenz: €${Math.abs(recon.difference_amount).toLocaleString('de-DE')}`,
      confidence: 1.0,
      dataPoints: [recon.id],
    });

    // Step 3: Historical pattern
    if (data.historicalCases > 0) {
      steps.push({
        observation: `Historische Fälle zwischen diesen Gesellschaften: ${data.historicalCases}`,
        inference: `Davon ${data.historicalTimingPercent.toFixed(0)}% waren Timing-Differenzen`,
        confidence: data.historicalCases > 5 ? 0.85 : 0.6,
        dataPoints: [],
      });
    }

    // Step 4: Conclusion
    steps.push({
      observation: `Regelbasierte und AI-gestützte Analyse durchgeführt`,
      inference: `Wahrscheinlichste Ursache: ${this.getCauseLabel(analysis.likelyCause)}`,
      confidence: analysis.confidence,
      dataPoints: [recon.id],
    });

    return steps;
  }

  /**
   * Build quality indicators
   */
  private buildQualityIndicators(
    data: ICAnalysisData,
    analysis: ICAnalysisResult,
  ): QualityIndicators {
    const recon = data.reconciliation;
    const missingData: string[] = [];

    // Check data completeness
    if (!recon.booking_date_a) missingData.push('Buchungsdatum A');
    if (!recon.booking_date_b) missingData.push('Buchungsdatum B');
    if (!recon.reference_a) missingData.push('Referenz A');
    if (!recon.reference_b) missingData.push('Referenz B');

    const completeness = 1 - (missingData.length / 4);

    return this.reasoning.buildQualityIndicators(
      {
        percentage: completeness * 100,
        missingData: missingData.length > 0 ? missingData : undefined,
      },
      true, // HGB conformity
      {
        dataQuality: completeness,
        patternMatch: data.historicalCases > 5 ? 0.85 : 0.5,
        ruleMatch: analysis.confidence,
      },
      [],   // No deviations
      data.historicalCases > 0
        ? {
            similarCases: data.historicalCases,
            correctPredictions: data.historicalCorrect,
          }
        : undefined,
    );
  }

  /**
   * Format the analysis message for display
   */
  private formatAnalysisMessage(
    data: ICAnalysisData,
    analysis: ICAnalysisResult,
  ): string {
    const recon = data.reconciliation;
    const confidenceLabel = this.getConfidenceLabel(analysis.confidence);
    
    return `**IC-Differenz: ${Math.abs(recon.difference_amount).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}**

**Gesellschaften:** ${data.companyA?.name} - ${data.companyB?.name}

**Wahrscheinliche Ursache:** ${this.getCauseLabel(analysis.likelyCause)}
**Konfidenz:** [${confidenceLabel}] ${Math.round(analysis.confidence * 100)}%

${analysis.explanation}

**Empfohlene Aktion:** ${analysis.suggestedAction}`;
  }

  /**
   * Generate batch summary
   */
  private generateBatchSummary(results: ToolResult[]): string {
    const total = results.length;
    const byCause: Record<string, number> = {};
    let totalAmount = 0;
    let criticalCount = 0;

    for (const r of results) {
      if (r.success && r.data) {
        const cause = r.data.likelyCause || 'unknown';
        byCause[cause] = (byCause[cause] || 0) + 1;
        
        // Would need actual amount from data
        if (r.data.confidence && r.data.confidence < 0.65) {
          criticalCount++;
        }
      }
    }

    let summary = `**Batch-Analyse abgeschlossen: ${total} IC-Differenzen**\n\n`;
    summary += '**Zusammenfassung nach Ursache:**\n';

    for (const [cause, count] of Object.entries(byCause)) {
      const percent = ((count / total) * 100).toFixed(0);
      summary += `• ${this.getCauseLabel(cause as ICCauseType)}: ${count} (${percent}%)\n`;
    }

    if (criticalCount > 0) {
      summary += `\n[ACHTUNG] **${criticalCount} Positionen mit niedriger Konfidenz erfordern manuelle Prüfung**`;
    }

    return summary;
  }

  /**
   * Get override options for WP
   */
  private getOverrideOptions(): OverrideOption[] {
    return [
      { id: 'timing', label: 'Timing-Differenz', requiresReasoning: false },
      { id: 'fx', label: 'Währungsdifferenz', requiresReasoning: false },
      { id: 'rounding', label: 'Rundungsdifferenz', requiresReasoning: false },
      { id: 'error', label: 'Buchungsfehler', requiresReasoning: true },
      { id: 'missing', label: 'Fehlende Buchung', requiresReasoning: true },
      { id: 'other', label: 'Andere Ursache', requiresReasoning: true },
    ];
  }

  /**
   * Create error result
   */
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

  // Helper methods
  private calculateDaysDiff(dateA: string, dateB: string): number {
    if (!dateA || !dateB) return 0;
    const a = new Date(dateA);
    const b = new Date(dateB);
    return Math.abs((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
  }

  private getCauseLabel(cause: ICCauseType): string {
    const labels: Record<ICCauseType, string> = {
      timing: 'Timing-Differenz',
      fx: 'Währungsdifferenz',
      rounding: 'Rundungsdifferenz',
      missing_entry: 'Fehlende Buchung',
      error: 'Buchungsfehler',
      unknown: 'Unbekannt',
    };
    return labels[cause] || cause;
  }

  private getDefaultExplanation(cause: ICCauseType, data: ICAnalysisData): string {
    const explanations: Record<ICCauseType, string> = {
      timing: `Die Buchungen wurden zu unterschiedlichen Zeitpunkten erfasst. Dies ist typisch für Periodenabgrenzungen am Jahresende.`,
      fx: `Die Differenz resultiert aus unterschiedlichen Wechselkursen bei der Umrechnung.`,
      rounding: `Es handelt sich um eine geringfügige Rundungsdifferenz, die im Rahmen der Wesentlichkeit liegt.`,
      missing_entry: `Eine der Gesellschaften hat die Gegenbuchung noch nicht erfasst.`,
      error: `Die Differenz deutet auf einen Buchungsfehler hin, der geprüft werden sollte.`,
      unknown: `Die Ursache konnte nicht eindeutig ermittelt werden und erfordert manuelle Prüfung.`,
    };
    return explanations[cause];
  }

  private getDefaultSuggestedAction(cause: ICCauseType): string {
    const actions: Record<ICCauseType, string> = {
      timing: 'Als Timing-Differenz akzeptieren und im Folgejahr auflösen',
      fx: 'Kursdifferenz prüfen und ggf. Umbuchung auf Währungsergebnis',
      rounding: 'Als unwesentlich akzeptieren (§ 303 Abs. 2 HGB)',
      missing_entry: 'Gegenbuchung bei der betroffenen Gesellschaft anfordern',
      error: 'Buchung korrigieren lassen',
      unknown: 'Manuelle Prüfung durch Wirtschaftsprüfer erforderlich',
    };
    return actions[cause];
  }

  private getConfidenceLabel(confidence: number): string {
    const level = getConfidenceLevel(confidence);
    switch (level) {
      case 'high': return 'HOCH';
      case 'medium': return 'MITTEL';
      case 'low': return 'NIEDRIG';
    }
  }
}
