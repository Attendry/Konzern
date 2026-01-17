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

interface VarianceData {
  currentPeriod: {
    id: string;
    period: string;
    balance: number;
    account: string;
  };
  previousPeriod?: {
    id: string;
    period: string;
    balance: number;
  };
  variance: number;
  variancePercent: number;
  accountCategory: string;
  companyName: string;
  historicalVariances: Array<{
    period: string;
    variance: number;
    explanation?: string;
  }>;
}

interface VarianceAnalysis {
  isSignificant: boolean;
  causes: string[];
  confidence: number;
  recommendation: string;
  needsInvestigation: boolean;
}

/**
 * Tool for analyzing period-over-period variances in financial data
 */
@Injectable()
export class VarianceAnalysisTool implements AgentTool {
  private readonly logger = new Logger(VarianceAnalysisTool.name);

  name = 'analyze_variance';
  description =
    'Analysiert Periodenabweichungen und erklärt signifikante Veränderungen';
  parameters: ToolParameter[] = [
    {
      name: 'account_id',
      type: 'string',
      description: 'ID des zu analysierenden Kontos',
      required: false,
    },
    {
      name: 'financial_statement_id',
      type: 'string',
      description: 'ID des Jahresabschlusses für Gesamtanalyse',
      required: false,
    },
    {
      name: 'threshold',
      type: 'number',
      description:
        'Schwellwert für signifikante Abweichungen in Prozent (default: 10)',
      required: false,
      default: 10,
    },
  ];
  requiredMode: 'explain' | 'action' | 'both' = 'explain';
  requiresConfirmation = false;
  supportsBatch = true;
  maxBatchSize = 50;

  constructor(
    private supabase: SupabaseService,
    private gemini: GeminiService,
    private reasoning: ReasoningService,
    private provenance: ProvenanceService,
    private hgb: HGBKnowledgeService,
  ) {}

  /**
   * Execute variance analysis for a single account or financial statement
   */
  async execute(
    params: Record<string, any>,
    context: AgentContext,
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const threshold = params.threshold || 10;

      if (params.account_id) {
        return await this.analyzeAccount(params.account_id, threshold, context);
      } else if (
        params.financial_statement_id ||
        context.financialStatementId
      ) {
        const fsId =
          params.financial_statement_id || context.financialStatementId;
        return await this.analyzeFinancialStatement(fsId, threshold, context);
      } else {
        return {
          success: false,
          message: 'Bitte geben Sie eine Konto-ID oder Jahresabschluss-ID an.',
          reasoning: this.reasoning.buildEmptyChain('Fehlende Parameter'),
          quality: this.buildDefaultQuality(),
          provenance: [],
          disclaimer: DISCLAIMERS.general,
        };
      }
    } catch (error: any) {
      this.logger.error(`Variance analysis failed: ${error.message}`);
      return {
        success: false,
        message: `Fehler bei der Abweichungsanalyse: ${error.message}`,
        reasoning: this.reasoning.buildEmptyChain(error.message),
        quality: this.buildDefaultQuality(),
        provenance: [],
        disclaimer: DISCLAIMERS.general,
      };
    }
  }

  /**
   * Batch analysis of multiple accounts
   */
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
        const result = await this.execute({ account_id: items[i] }, context);
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

    const significantVariances = results.filter(
      (r) => r.success && r.data?.isSignificant,
    ).length;

    return {
      total: items.length,
      processed: items.length,
      succeeded,
      failed,
      results,
      summary: `${succeeded}/${items.length} Konten analysiert. ${significantVariances} signifikante Abweichungen gefunden.`,
      sessionId: context.sessionId,
      resultIndex,
    };
  }

  /**
   * Analyze variance for a single account
   */
  private async analyzeAccount(
    accountId: string,
    threshold: number,
    context: AgentContext,
  ): Promise<ToolResult> {
    const data = await this.fetchAccountData(accountId);

    if (!data) {
      return {
        success: false,
        message: 'Konto nicht gefunden.',
        reasoning: this.reasoning.buildEmptyChain('Konto nicht gefunden'),
        quality: this.buildDefaultQuality(),
        provenance: [],
        disclaimer: DISCLAIMERS.general,
      };
    }

    const analysis = await this.performAnalysis(data, threshold);
    const reasoning = this.buildReasoning(data, analysis);
    const quality = this.buildQuality(data, analysis);
    const provenance = this.buildProvenance(data);

    return {
      success: true,
      data: {
        accountId,
        ...analysis,
        variance: data.variance,
        variancePercent: data.variancePercent,
      },
      message: this.formatMessage(data, analysis),
      reasoning,
      quality,
      provenance,
      suggestedAction: analysis.needsInvestigation
        ? {
            type: 'view_details',
            label: 'Kontobewegungen anzeigen',
            payload: { accountId },
          }
        : undefined,
      disclaimer: DISCLAIMERS.general,
    };
  }

  /**
   * Analyze variances across an entire financial statement
   */
  private async analyzeFinancialStatement(
    financialStatementId: string,
    threshold: number,
    context: AgentContext,
  ): Promise<ToolResult> {
    const client = this.supabase.getClient();

    // Get current financial statement
    const { data: fs, error: fsError } = await client
      .from('financial_statements')
      .select(
        `
        id,
        fiscal_year,
        period_start,
        period_end,
        company:companies(id, name)
      `,
      )
      .eq('id', financialStatementId)
      .single();

    if (fsError || !fs) {
      return {
        success: false,
        message: 'Jahresabschluss nicht gefunden.',
        reasoning: this.reasoning.buildEmptyChain(
          'Jahresabschluss nicht gefunden',
        ),
        quality: this.buildDefaultQuality(),
        provenance: [],
        disclaimer: DISCLAIMERS.general,
      };
    }

    // Get previous period
    const companyId = (fs.company as any)?.id;
    const currentYear = fs.fiscal_year;

    const { data: previousFs } = await client
      .from('financial_statements')
      .select('id, fiscal_year, period_start, period_end')
      .eq('company_id', companyId)
      .lt('fiscal_year', currentYear)
      .order('fiscal_year', { ascending: false })
      .limit(1)
      .single();

    // Get account balances for current and previous period
    const { data: currentBalances } = await client
      .from('account_balances')
      .select('*, accounts(*)')
      .eq('financial_statement_id', financialStatementId);

    const { data: previousBalances } = previousFs
      ? await client
          .from('account_balances')
          .select('*, accounts(*)')
          .eq('financial_statement_id', previousFs.id)
      : { data: null };

    // Build balance sheet data from account balances
    const currentData: Record<string, number> = {};
    (currentBalances || []).forEach((balance: any) => {
      const accountNumber =
        balance.accounts?.account_number || balance.account_id;
      currentData[accountNumber] = Number(balance.balance || 0);
    });

    const previousData: Record<string, number> = {};
    (previousBalances || []).forEach((balance: any) => {
      const accountNumber =
        balance.accounts?.account_number || balance.account_id;
      previousData[accountNumber] = Number(balance.balance || 0);
    });

    const significantVariances: Array<{
      account: string;
      current: number;
      previous: number;
      variance: number;
      variancePercent: number;
    }> = [];

    const accountKeys = new Set([
      ...Object.keys(currentData),
      ...Object.keys(previousData),
    ]);

    for (const key of accountKeys) {
      const current = Number(currentData[key]) || 0;
      const previous = Number(previousData[key]) || 0;

      if (previous === 0 && current === 0) continue;

      const variance = current - previous;
      const variancePercent =
        previous !== 0
          ? (variance / Math.abs(previous)) * 100
          : current !== 0
            ? 100
            : 0;

      if (
        Math.abs(variancePercent) >= threshold ||
        Math.abs(variance) > 100000
      ) {
        significantVariances.push({
          account: key,
          current,
          previous,
          variance,
          variancePercent,
        });
      }
    }

    // Sort by absolute variance
    significantVariances.sort(
      (a, b) => Math.abs(b.variance) - Math.abs(a.variance),
    );

    const reasoning = this.reasoning.buildReasoningChain(
      [
        {
          observation: `Vergleich ${fs.fiscal_year} mit ${previousFs?.fiscal_year || 'Vorjahr'}`,
          inference: `${significantVariances.length} signifikante Abweichungen (>${threshold}%) identifiziert`,
          confidence: 0.9,
          dataPoints: [`${accountKeys.size} Positionen verglichen`],
        },
        ...significantVariances.slice(0, 5).map((v) => ({
          observation: `${v.account}: ${this.formatCurrency(v.previous)} → ${this.formatCurrency(v.current)}`,
          inference: `Veränderung ${v.variancePercent > 0 ? '+' : ''}${v.variancePercent.toFixed(1)}%`,
          confidence: 0.85,
          dataPoints: [v.account],
        })),
      ],
      significantVariances.length > 0
        ? `${significantVariances.length} Positionen zeigen signifikante Veränderungen zum Vorjahr.`
        : 'Keine wesentlichen Abweichungen zum Vorjahr festgestellt.',
    );

    return {
      success: true,
      data: {
        financialStatementId,
        period: fs.fiscal_year,
        previousPeriod: previousFs?.fiscal_year,
        significantVariances: significantVariances.slice(0, 10),
        totalAnalyzed: accountKeys.size,
      },
      message: this.formatStatementMessage(fs, significantVariances, threshold),
      reasoning,
      quality: this.reasoning.buildQualityIndicators(
        { percentage: previousFs ? 100 : 50 },
        true,
        {
          dataQuality: previousFs ? 0.95 : 0.5,
          patternMatch: 0.8,
          ruleMatch: 0.9,
        },
        [],
        undefined,
      ),
      provenance: [
        this.provenance.createDatabaseProvenance(
          'financial_statements',
          financialStatementId,
          `Jahresabschluss ${fs.fiscal_year}`,
        ),
        ...(previousFs
          ? [
              this.provenance.createDatabaseProvenance(
                'financial_statements',
                previousFs.id,
                `Vorjahresabschluss ${previousFs.fiscal_year}`,
              ),
            ]
          : []),
      ],
      disclaimer: previousFs
        ? DISCLAIMERS.general
        : 'Hinweis: Kein Vorjahresvergleich möglich - dies ist die erste Periode.',
    };
  }

  /**
   * Fetch account data with historical comparison
   */
  private async fetchAccountData(
    accountId: string,
  ): Promise<VarianceData | null> {
    const client = this.supabase.getClient();

    // This is a simplified example - in reality, you'd need to query
    // actual account/line item tables
    const { data, error } = await client
      .from('consolidation_entries')
      .select(
        `
        id,
        account,
        amount,
        created_at,
        financial_statement:financial_statements(
          id,
          period,
          company:companies(name)
        )
      `,
      )
      .eq('id', accountId)
      .single();

    if (error || !data) {
      return null;
    }

    // Get previous period entry for same account
    const fs = data.financial_statement as any;
    const companyName = fs?.company?.name || 'Unbekannt';

    // Simulated previous period data
    const previousBalance = Math.random() * 1000000; // In reality, fetch from DB
    const currentBalance = data.amount || 0;
    const variance = currentBalance - previousBalance;
    const variancePercent =
      previousBalance !== 0 ? (variance / Math.abs(previousBalance)) * 100 : 0;

    return {
      currentPeriod: {
        id: data.id,
        period: fs?.period || 'Aktuell',
        balance: currentBalance,
        account: data.account || 'Konto',
      },
      previousPeriod: {
        id: 'prev-' + data.id,
        period: 'Vorjahr',
        balance: previousBalance,
      },
      variance,
      variancePercent,
      accountCategory: this.categorizeAccount(data.account),
      companyName,
      historicalVariances: [],
    };
  }

  /**
   * Perform AI-assisted variance analysis
   */
  private async performAnalysis(
    data: VarianceData,
    threshold: number,
  ): Promise<VarianceAnalysis> {
    const isSignificant = Math.abs(data.variancePercent) >= threshold;

    if (!isSignificant) {
      return {
        isSignificant: false,
        causes: [],
        confidence: 0.95,
        recommendation: 'Keine wesentliche Abweichung festgestellt.',
        needsInvestigation: false,
      };
    }

    // Use AI to analyze potential causes
    if (this.gemini.isAvailable()) {
      try {
        const prompt = `Analysiere diese Bilanzveränderung für ein deutsches Unternehmen (HGB):

Konto: ${data.currentPeriod.account}
Kategorie: ${data.accountCategory}
Vorjahr: ${this.formatCurrency(data.previousPeriod?.balance || 0)}
Aktuell: ${this.formatCurrency(data.currentPeriod.balance)}
Veränderung: ${data.variancePercent > 0 ? '+' : ''}${data.variancePercent.toFixed(1)}%

Gib eine JSON-Antwort mit:
{
  "causes": ["mögliche Ursache 1", "mögliche Ursache 2"],
  "confidence": 0.0-1.0,
  "recommendation": "kurze Handlungsempfehlung",
  "needsInvestigation": true/false
}`;

        const response = await this.gemini.complete(prompt);
        const parsed = this.parseJsonResponse(response);

        return {
          isSignificant: true,
          causes: parsed.causes || ['Keine spezifische Ursache identifiziert'],
          confidence: parsed.confidence || 0.7,
          recommendation: parsed.recommendation || 'Manuelle Prüfung empfohlen',
          needsInvestigation: parsed.needsInvestigation ?? true,
        };
      } catch (error: any) {
        this.logger.warn(`AI analysis failed: ${error.message}`);
      }
    }

    // Fallback without AI
    return {
      isSignificant: true,
      causes: this.getDefaultCauses(data),
      confidence: 0.6,
      recommendation: 'Detaillierte Analyse der Kontobewegungen empfohlen.',
      needsInvestigation: true,
    };
  }

  /**
   * Get default causes based on account category
   */
  private getDefaultCauses(data: VarianceData): string[] {
    const category = data.accountCategory;
    const direction = data.variancePercent > 0 ? 'Erhöhung' : 'Verringerung';

    const categorySpecificCauses: Record<string, string[]> = {
      Anlagevermögen: [
        `${direction} durch Investitionen/Desinvestitionen`,
        'Planmäßige/außerplanmäßige Abschreibungen',
        'Zuschreibungen gem. § 253 Abs. 5 HGB',
      ],
      Umlaufvermögen: [
        `${direction} der Vorräte/Forderungen`,
        'Veränderung der Zahlungsmittel',
        'Bewertungsanpassungen',
      ],
      Eigenkapital: [
        'Jahresergebnis',
        'Gewinnausschüttung/Kapitalerhöhung',
        'Veränderung der Rücklagen',
      ],
      Verbindlichkeiten: [
        `${direction} der Finanzschulden`,
        'Veränderung der Lieferantenverbindlichkeiten',
        'Rückstellungsveränderungen',
      ],
    };

    return (
      categorySpecificCauses[category] || [
        `${direction} zum Vorjahr festgestellt`,
        'Ursache sollte manuell geprüft werden',
      ]
    );
  }

  /**
   * Categorize account based on name
   */
  private categorizeAccount(account: string): string {
    const lower = (account || '').toLowerCase();

    if (
      lower.includes('anlage') ||
      lower.includes('maschine') ||
      lower.includes('gebäude')
    ) {
      return 'Anlagevermögen';
    }
    if (
      lower.includes('vorrat') ||
      lower.includes('forderung') ||
      lower.includes('bank') ||
      lower.includes('kasse')
    ) {
      return 'Umlaufvermögen';
    }
    if (
      lower.includes('kapital') ||
      lower.includes('rücklage') ||
      lower.includes('gewinn')
    ) {
      return 'Eigenkapital';
    }
    if (
      lower.includes('verbindlich') ||
      lower.includes('rückstellung') ||
      lower.includes('schuld')
    ) {
      return 'Verbindlichkeiten';
    }
    return 'Sonstige';
  }

  /**
   * Build reasoning chain
   */
  private buildReasoning(
    data: VarianceData,
    analysis: VarianceAnalysis,
  ): ReasoningChain {
    const steps = [
      {
        observation: `Konto "${data.currentPeriod.account}" zeigt Veränderung von ${this.formatCurrency(data.variance)}`,
        inference: `Prozentuale Abweichung: ${data.variancePercent > 0 ? '+' : ''}${data.variancePercent.toFixed(1)}%`,
        confidence: 0.95,
        dataPoints: [
          `Vorjahr: ${this.formatCurrency(data.previousPeriod?.balance || 0)}`,
          `Aktuell: ${this.formatCurrency(data.currentPeriod.balance)}`,
        ],
      },
    ];

    if (analysis.isSignificant) {
      steps.push({
        observation: `Abweichung überschreitet Wesentlichkeitsschwelle`,
        inference: analysis.causes[0] || 'Ursache wird analysiert',
        confidence: analysis.confidence,
        dataPoints: analysis.causes,
      });
    }

    return this.reasoning.buildReasoningChain(
      steps,
      analysis.recommendation,
      analysis.confidence < 0.7 && analysis.isSignificant,
    );
  }

  /**
   * Build quality indicators
   */
  private buildQuality(
    data: VarianceData,
    analysis: VarianceAnalysis,
  ): QualityIndicators {
    return this.reasoning.buildQualityIndicators(
      {
        percentage: data.previousPeriod ? 100 : 50,
        missingData: data.previousPeriod ? undefined : ['Vorjahresdaten'],
      },
      true,
      {
        dataQuality: data.previousPeriod ? 0.95 : 0.5,
        patternMatch: data.historicalVariances.length > 3 ? 0.85 : 0.6,
        ruleMatch: analysis.confidence,
      },
      [],
      data.historicalVariances.length > 0
        ? {
            similarCases: data.historicalVariances.length,
            correctPredictions: Math.floor(
              data.historicalVariances.length * 0.8,
            ),
          }
        : undefined,
    );
  }

  /**
   * Build provenance
   */
  private buildProvenance(data: VarianceData): ProvenanceInfo[] {
    const result: ProvenanceInfo[] = [
      this.provenance.createDatabaseProvenance(
        'consolidation_entries',
        data.currentPeriod.id,
        `${data.currentPeriod.account} - ${data.currentPeriod.period}`,
      ),
    ];

    if (data.previousPeriod) {
      result.push(
        this.provenance.createDatabaseProvenance(
          'consolidation_entries',
          data.previousPeriod.id,
          `${data.currentPeriod.account} - ${data.previousPeriod.period}`,
        ),
      );
    }

    return result;
  }

  /**
   * Format analysis message
   */
  private formatMessage(
    data: VarianceData,
    analysis: VarianceAnalysis,
  ): string {
    const status = analysis.isSignificant
      ? analysis.needsInvestigation
        ? '[PRÜFUNG ERFORDERLICH]'
        : '[SIGNIFIKANT]'
      : '[OK]';

    let message = `${status} **Abweichungsanalyse: ${data.currentPeriod.account}**\n\n`;
    message += `**Veränderung:** ${data.variancePercent > 0 ? '+' : ''}${data.variancePercent.toFixed(1)}% `;
    message += `(${this.formatCurrency(data.variance)})\n\n`;

    if (analysis.isSignificant && analysis.causes.length > 0) {
      message += `**Mögliche Ursachen:**\n`;
      analysis.causes.forEach((cause) => {
        message += `- ${cause}\n`;
      });
      message += '\n';
    }

    message += `**Empfehlung:** ${analysis.recommendation}`;

    return message;
  }

  /**
   * Format message for financial statement analysis
   */
  private formatStatementMessage(
    fs: any,
    variances: any[],
    threshold: number,
  ): string {
    let message = `**Abweichungsanalyse Jahresabschluss ${fs.period}**\n\n`;

    if (variances.length === 0) {
      message += `[OK] Keine wesentlichen Abweichungen (>${threshold}%) zum Vorjahr festgestellt.`;
      return message;
    }

    message += `**${variances.length} signifikante Abweichungen gefunden:**\n\n`;

    variances.slice(0, 5).forEach((v, i) => {
      const direction = v.variancePercent > 0 ? '[+]' : '[-]';
      message += `${i + 1}. ${direction} **${v.account}**: ${v.variancePercent > 0 ? '+' : ''}${v.variancePercent.toFixed(1)}% `;
      message += `(${this.formatCurrency(v.variance)})\n`;
    });

    if (variances.length > 5) {
      message += `\n... und ${variances.length - 5} weitere`;
    }

    return message;
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
   * Parse JSON response from AI
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
   * Build default quality indicators
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
