import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { GeminiService } from '../services/gemini.service';
import { ReasoningService } from '../services/reasoning.service';
import { ProvenanceService } from '../services/provenance.service';
import {
  AgentTool,
  ToolParameter,
  ToolResult,
  AgentContext,
  QualityIndicators,
  ReasoningChain,
  ProvenanceInfo,
  DISCLAIMERS,
} from '../types/agent.types';

interface QueryResult {
  query: string;
  results: any[];
  count: number;
  tableName: string;
  columns: string[];
}

/**
 * Tool for natural language data queries
 */
@Injectable()
export class DataQueryTool implements AgentTool {
  private readonly logger = new Logger(DataQueryTool.name);

  name = 'query_data';
  description = 'Beantwortet Fragen zu Finanzdaten mit natürlicher Sprache';
  parameters: ToolParameter[] = [
    {
      name: 'question',
      type: 'string',
      description: 'Die Frage in natürlicher Sprache',
      required: true,
    },
    {
      name: 'financial_statement_id',
      type: 'string',
      description: 'Optional: Einschränkung auf bestimmten Jahresabschluss',
      required: false,
    },
  ];
  requiredMode: 'explain' | 'action' | 'both' = 'explain';
  requiresConfirmation = false;
  supportsBatch = false;

  // Allowed tables for queries (security)
  private allowedTables = [
    'companies',
    'financial_statements',
    'consolidation_entries',
    'intercompany_transactions',
    'ic_reconciliations',
    'participations',
    'plausibility_checks',
  ];

  constructor(
    private supabase: SupabaseService,
    private gemini: GeminiService,
    private reasoning: ReasoningService,
    private provenance: ProvenanceService,
  ) {}

  async execute(
    params: Record<string, any>,
    context: AgentContext,
  ): Promise<ToolResult> {
    const question = params.question;
    const financialStatementId = params.financial_statement_id || context.financialStatementId;

    if (!question) {
      return this.errorResult('Bitte stellen Sie eine Frage.');
    }

    try {
      // Analyze the question and determine what data is needed
      const queryIntent = await this.analyzeQuestion(question, financialStatementId);
      
      if (!queryIntent.success) {
        return this.errorResult(queryIntent.message);
      }

      // Execute the query
      const result = await this.executeQuery(queryIntent, financialStatementId);
      
      if (!result.success) {
        return this.errorResult(result.message);
      }

      // Format the answer
      const answer = await this.formatAnswer(question, result.data!);
      
      const reasoning = this.buildReasoning(question, queryIntent, result.data!);
      const quality = this.buildQuality(result.data!);
      const provenance = this.buildProvenance(result.data!);

      return {
        success: true,
        data: {
          question,
          answer: answer.text,
          resultCount: result.data!.count,
          tableName: result.data!.tableName,
        },
        message: answer.text,
        reasoning,
        quality,
        provenance,
        disclaimer: DISCLAIMERS.general,
      };
    } catch (error: any) {
      this.logger.error(`Data query failed: ${error.message}`);
      return this.errorResult(`Fehler bei der Datenabfrage: ${error.message}`);
    }
  }

  /**
   * Analyze the question to determine query intent
   */
  private async analyzeQuestion(
    question: string,
    financialStatementId?: string,
  ): Promise<{
    success: boolean;
    message: string;
    table?: string;
    filters?: Record<string, any>;
    aggregation?: string;
    columns?: string[];
  }> {
    // Simple keyword-based analysis first
    const lower = question.toLowerCase();
    
    // Company queries
    if (lower.includes('unternehmen') || lower.includes('gesellschaft') || lower.includes('firma')) {
      return {
        success: true,
        message: 'Query companies',
        table: 'companies',
        columns: ['id', 'name', 'legal_form', 'parent_company_id', 'is_consolidated', 'consolidation_type', 'is_ultimate_parent'],
      };
    }

    // IC transactions
    if (lower.includes('ic') || lower.includes('intercompany') || lower.includes('konzernintern')) {
      return {
        success: true,
        message: 'Query IC transactions',
        table: 'intercompany_transactions',
        columns: ['id', 'from_company_id', 'to_company_id', 'amount', 'transaction_date', 'description'],
        filters: financialStatementId ? { financial_statement_id: financialStatementId } : undefined,
      };
    }

    // IC reconciliation
    if (lower.includes('abstimmung') || lower.includes('differenz') || lower.includes('reconciliation')) {
      return {
        success: true,
        message: 'Query IC reconciliation',
        table: 'ic_reconciliations',
        columns: ['id', 'company_a_id', 'company_b_id', 'amount_company_a', 'amount_company_b', 'difference_amount', 'status', 'difference_reason'],
        filters: financialStatementId ? { financial_statement_id: financialStatementId } : undefined,
      };
    }

    // Plausibility checks
    if (lower.includes('prüfung') || lower.includes('kontrolle') || lower.includes('plausibilität')) {
      return {
        success: true,
        message: 'Query plausibility checks',
        table: 'plausibility_checks',
        columns: ['id', 'check_type', 'result', 'message', 'created_at'],
        filters: financialStatementId ? { financial_statement_id: financialStatementId } : undefined,
      };
    }

    // Consolidation entries
    if (lower.includes('buchung') || lower.includes('konsolidierung') || lower.includes('eintrag')) {
      return {
        success: true,
        message: 'Query consolidation entries',
        table: 'consolidation_entries',
        columns: ['id', 'adjustment_type', 'account_id', 'debit_account_id', 'credit_account_id', 'amount', 'description', 'hgb_reference', 'created_at'],
        filters: financialStatementId ? { financial_statement_id: financialStatementId } : undefined,
      };
    }

    // Financial statements
    if (lower.includes('abschluss') || lower.includes('bilanz') || lower.includes('jahres')) {
      return {
        success: true,
        message: 'Query financial statements',
        table: 'financial_statements',
        columns: ['id', 'company_id', 'fiscal_year', 'period_start', 'period_end', 'status'],
      };
    }

    // Participations
    if (lower.includes('beteiligung') || lower.includes('anteil') || lower.includes('tochter')) {
      return {
        success: true,
        message: 'Query participations',
        table: 'participations',
        columns: ['id', 'parent_company_id', 'subsidiary_company_id', 'ownership_percentage', 'acquisition_date'],
      };
    }

    // Use AI for more complex questions if available
    if (this.gemini.isAvailable()) {
      return await this.analyzeWithAI(question);
    }

    return {
      success: false,
      message: 'Ich konnte die Frage nicht interpretieren. Bitte fragen Sie nach Unternehmen, IC-Transaktionen, Abstimmungen, Prüfungen oder Konsolidierungsbuchungen.',
    };
  }

  /**
   * Use AI to analyze complex questions
   */
  private async analyzeWithAI(question: string): Promise<{
    success: boolean;
    message: string;
    table?: string;
    filters?: Record<string, any>;
    columns?: string[];
  }> {
    const prompt = `Analysiere diese Frage zu Konsolidierungsdaten:
"${question}"

Verfügbare Tabellen:
- companies: Unternehmen im Konzern (name, company_type, ownership_percentage)
- financial_statements: Jahresabschlüsse (period, status, balance_sheet_data)
- consolidation_entries: Konsolidierungsbuchungen (entry_type, account, amount)
- ic_transactions: IC-Transaktionen (sender, receiver, amount, status)
- ic_reconciliation: IC-Abstimmungen (company_a, company_b, difference, status)
- participations: Beteiligungen (parent, subsidiary, ownership_percentage)
- plausibility_checks: Prüfungen (check_type, result, message)

Antworte mit JSON:
{
  "table": "tabellenname",
  "columns": ["spalte1", "spalte2"],
  "filters": {"spalte": "wert"} oder null,
  "understood": true/false
}`;

    try {
      const response = await this.gemini.complete(prompt);
      const parsed = this.parseJsonResponse(response);
      
      if (!parsed.understood || !parsed.table) {
        return {
          success: false,
          message: 'Diese Frage kann ich leider nicht beantworten.',
        };
      }

      if (!this.allowedTables.includes(parsed.table)) {
        return {
          success: false,
          message: 'Zugriff auf diese Daten ist nicht erlaubt.',
        };
      }

      return {
        success: true,
        message: 'AI analysis successful',
        table: parsed.table,
        columns: parsed.columns || ['*'],
        filters: parsed.filters,
      };
    } catch (error: any) {
      this.logger.warn(`AI analysis failed: ${error.message}`);
      return {
        success: false,
        message: 'Fehler bei der Fragenanalyse.',
      };
    }
  }

  /**
   * Execute the database query
   */
  private async executeQuery(
    intent: any,
    financialStatementId?: string,
  ): Promise<{ success: boolean; message: string; data?: QueryResult }> {
    const client = this.supabase.getClient();
    
    try {
      // For companies table, use '*' to get all columns to avoid column name issues
      const selectColumns = intent.table === 'companies' 
        ? '*' 
        : (intent.columns?.join(',') || '*');
      
      let query = client
        .from(intent.table)
        .select(selectColumns)
        .limit(100);

      // Apply filters
      if (intent.filters) {
        for (const [key, value] of Object.entries(intent.filters)) {
          query = query.eq(key, value);
        }
      }

      // Apply financial statement filter if provided
      // Note: intercompany_transactions doesn't have financial_statement_id in the base schema
      if (financialStatementId && 
          intent.table !== 'companies' && 
          intent.table !== 'participations' &&
          intent.table !== 'intercompany_transactions') {
        query = query.eq('financial_statement_id', financialStatementId);
      }

      const { data, error } = await query;

      if (error) {
        this.logger.error(`Database query error for table ${intent.table}:`, error);
        return {
          success: false,
          message: `Datenbankfehler: ${error.message}`,
        };
      }

      // Log query result for debugging
      this.logger.log(`Query ${intent.table}: Found ${data?.length || 0} results`);

      return {
        success: true,
        message: 'Query successful',
        data: {
          query: `SELECT ${intent.columns?.join(', ') || '*'} FROM ${intent.table}`,
          results: data || [],
          count: data?.length || 0,
          tableName: intent.table,
          columns: intent.columns || [],
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Query-Fehler: ${error.message}`,
      };
    }
  }

  /**
   * Format the answer based on query results
   */
  private async formatAnswer(
    question: string,
    result: QueryResult,
  ): Promise<{ text: string }> {
    // Log for debugging
    this.logger.log(`Formatting answer for ${result.tableName} with ${result.count} results`);
    const { tableName, results, count } = result;

    if (count === 0) {
      return {
        text: `Keine Daten gefunden für Ihre Anfrage zu ${this.getTableLabel(tableName)}.`,
      };
    }

    // Create a summary based on table type
    let text = `**Ergebnis: ${count} ${this.getTableLabel(tableName)}**\n\n`;

    switch (tableName) {
      case 'companies':
        text += this.formatCompaniesResult(results);
        break;
      case 'ic_reconciliation':
        text += this.formatReconciliationResult(results);
        break;
      case 'plausibility_checks':
        text += this.formatChecksResult(results);
        break;
      case 'consolidation_entries':
        text += this.formatEntriesResult(results);
        break;
      case 'ic_transactions':
        text += this.formatTransactionsResult(results);
        break;
      default:
        text += this.formatGenericResult(results);
    }

    return { text };
  }

  /**
   * Format companies result
   */
  private formatCompaniesResult(results: any[]): string {
    if (!results || results.length === 0) {
      return 'Keine Unternehmen gefunden.';
    }
    
    let text = '';
    results.slice(0, 10).forEach((company, i) => {
      // Determine if it's a parent or subsidiary
      const isParent = !company.parent_company_id || company.is_ultimate_parent;
      const typeLabel = isParent ? '[MU]' : '[TU]';
      const consolidationLabel = company.is_consolidated ? ' (konsolidiert)' : ' (nicht konsolidiert)';
      text += `${i + 1}. ${typeLabel} **${company.name}**`;
      if (company.legal_form) {
        text += ` - ${company.legal_form}`;
      }
      text += consolidationLabel;
      if (company.consolidation_type && company.consolidation_type !== 'full') {
        text += ` [${company.consolidation_type}]`;
      }
      text += '\n';
    });
    if (results.length > 10) {
      text += `\n... und ${results.length - 10} weitere`;
    }
    return text;
  }

  /**
   * Format reconciliation result
   */
  private formatReconciliationResult(results: any[]): string {
    if (!results || results.length === 0) {
      return 'Keine IC-Abstimmungen gefunden.';
    }
    
    let text = '';
    const withDiff = results.filter(r => Math.abs(r.difference_amount || 0) > 0.01);
    const matched = results.length - withDiff.length;

    text += `${matched} abgestimmt | ${withDiff.length} mit Differenz\n\n`;
    
    withDiff.slice(0, 5).forEach((r, i) => {
      const diff = r.difference_amount || 0;
      const reason = r.difference_reason ? ` (${r.difference_reason})` : '';
      text += `${i + 1}. Differenz: ${this.formatCurrency(diff)} - Status: ${r.status}${reason}\n`;
    });
    
    return text;
  }

  /**
   * Format checks result
   */
  private formatChecksResult(results: any[]): string {
    let text = '';
    const passed = results.filter(r => r.result === 'PASS').length;
    const failed = results.filter(r => r.result === 'FAIL').length;
    const warnings = results.filter(r => r.result === 'WARNING').length;

    text += `${passed} bestanden | ${warnings} Warnung | ${failed} fehlgeschlagen\n\n`;
    
    const issues = results.filter(r => r.result !== 'PASS');
    issues.slice(0, 5).forEach((check, i) => {
      const status = check.result === 'FAIL' ? '[FEHLER]' : '[WARNUNG]';
      text += `${status} ${check.check_type}: ${check.message || 'Keine Details'}\n`;
    });
    
    return text;
  }

  /**
   * Format entries result
   */
  private formatEntriesResult(results: any[]): string {
    if (!results || results.length === 0) {
      return 'Keine Konsolidierungsbuchungen gefunden.';
    }
    
    let text = '';
    const totalAmount = results.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    
    text += `Gesamtbetrag: ${this.formatCurrency(totalAmount)}\n\n`;
    
    const byType: Record<string, number> = {};
    results.forEach(e => {
      const type = e.adjustment_type || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
    });
    
    for (const [type, count] of Object.entries(byType)) {
      text += `• ${type}: ${count} Buchungen\n`;
    }
    
    return text;
  }

  /**
   * Format transactions result
   */
  private formatTransactionsResult(results: any[]): string {
    let text = '';
    const totalAmount = results.reduce((sum, t) => sum + (t.amount || 0), 0);
    
    text += `Gesamtvolumen: ${this.formatCurrency(totalAmount)}\n\n`;
    
    const byStatus: Record<string, number> = {};
    results.forEach(t => {
      byStatus[t.status || 'unbekannt'] = (byStatus[t.status || 'unbekannt'] || 0) + 1;
    });
    
    for (const [status, count] of Object.entries(byStatus)) {
      text += `• ${status}: ${count} Transaktionen\n`;
    }
    
    return text;
  }

  /**
   * Format generic result
   */
  private formatGenericResult(results: any[]): string {
    if (results.length === 1) {
      return '```json\n' + JSON.stringify(results[0], null, 2) + '\n```';
    }
    return `${results.length} Datensätze gefunden. Details sind in den Rohdaten verfügbar.`;
  }

  /**
   * Build reasoning chain
   */
  private buildReasoning(
    question: string,
    intent: any,
    result: QueryResult,
  ): ReasoningChain {
    return this.reasoning.buildReasoningChain(
      [
        {
          observation: `Frage: "${question}"`,
          inference: `Interpretation: Abfrage von ${this.getTableLabel(intent.table)}`,
          confidence: 0.85,
          dataPoints: [`Tabelle: ${intent.table}`],
        },
        {
          observation: `Datenbankabfrage ausgeführt`,
          inference: `${result.count} Ergebnisse gefunden`,
          confidence: 0.95,
          dataPoints: result.columns,
        },
      ],
      `Basierend auf ${result.count} Datensätzen aus ${this.getTableLabel(result.tableName)}.`,
    );
  }

  /**
   * Build quality indicators
   */
  private buildQuality(result: QueryResult): QualityIndicators {
    return this.reasoning.buildQualityIndicators(
      { percentage: 100 },
      true,
      {
        dataQuality: 0.95,
        patternMatch: result.count > 0 ? 0.9 : 0.5,
        ruleMatch: 0.85,
      },
      [],
      undefined,
    );
  }

  /**
   * Build provenance
   */
  private buildProvenance(result: QueryResult): ProvenanceInfo[] {
    return [
      this.provenance.createDatabaseProvenance(
        result.tableName,
        'query',
        `${result.count} Datensätze`,
      ),
    ];
  }

  /**
   * Get German label for table
   */
  private getTableLabel(table: string): string {
    const labels: Record<string, string> = {
      companies: 'Unternehmen',
      financial_statements: 'Jahresabschlüsse',
      consolidation_entries: 'Konsolidierungsbuchungen',
      ic_transactions: 'IC-Transaktionen',
      ic_reconciliation: 'IC-Abstimmungen',
      participations: 'Beteiligungen',
      plausibility_checks: 'Plausibilitätsprüfungen',
    };
    return labels[table] || table;
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
   * Create error result
   */
  private errorResult(message: string): ToolResult {
    return {
      success: false,
      message,
      reasoning: this.reasoning.buildEmptyChain(message),
      quality: this.reasoning.buildQualityIndicators(
        { percentage: 0 },
        false,
        { dataQuality: 0, patternMatch: 0, ruleMatch: 0 },
        [],
        undefined,
      ),
      provenance: [],
      disclaimer: DISCLAIMERS.general,
    };
  }
}
