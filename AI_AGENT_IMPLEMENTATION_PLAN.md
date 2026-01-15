# AI Agent Implementation Plan

**Version:** 1.0  
**Date:** January 2026  
**Scope:** Evolve chatbot from Q&A tool to intelligent agent with task execution capabilities

---

## Executive Summary

This document outlines the implementation plan to transform the current AI chatbot into a full-fledged **AI Agent** capable of:

1. **Answering questions** with data provenance
2. **Executing tasks** within the app framework
3. **Navigating users** to relevant screens
4. **Generating documents** and exports
5. **Suggesting corrections** and executing them with approval

---

## Architecture Evolution

### Current State: Q&A Chatbot
```
User Question → Chat Service → Gemini → Text Response
```

### Target State: AI Agent with Tools
```
User Request → Agent Orchestrator → Tool Selection → Tool Execution → Response with Provenance
                                  ↓
                           [Available Tools]
                           - QueryTool (read data)
                           - NavigateTool (open screens)
                           - ExportTool (generate documents)
                           - ActionTool (create/update records)
```

---

## Core Agent Infrastructure

### 1. Tool Definition System

```typescript
// backend/src/modules/ai/tools/tool.interface.ts

export interface AgentTool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  requiresConfirmation: boolean;
  execute: (params: Record<string, any>, context: AgentContext) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  message: string;
  provenance: ProvenanceInfo[];
  suggestedAction?: SuggestedAction;
}

export interface ProvenanceInfo {
  source: 'database' | 'calculation' | 'external_api' | 'user_input';
  table?: string;
  recordId?: string;
  field?: string;
  timestamp?: Date;
  hgbReference?: string;
  lineageNodeId?: string;
}

export interface SuggestedAction {
  type: 'navigate' | 'create' | 'update' | 'export' | 'confirm';
  label: string;
  payload: any;
}
```

### 2. Agent Orchestrator

```typescript
// backend/src/modules/ai/services/agent-orchestrator.service.ts

@Injectable()
export class AgentOrchestratorService {
  private tools: Map<string, AgentTool> = new Map();

  constructor(
    private gemini: GeminiService,
    private queryTool: QueryToolService,
    private navigateTool: NavigateToolService,
    private exportTool: ExportToolService,
    private actionTool: ActionToolService,
  ) {
    this.registerTools();
  }

  async processRequest(
    request: string,
    context: AgentContext,
  ): Promise<AgentResponse> {
    // 1. Analyze intent
    const intent = await this.analyzeIntent(request, context);
    
    // 2. Select tools
    const toolCalls = await this.selectTools(intent, context);
    
    // 3. Execute tools
    const results = await this.executeTools(toolCalls, context);
    
    // 4. Generate response with provenance
    return this.generateResponse(request, results, context);
  }

  private async analyzeIntent(request: string, context: AgentContext): Promise<Intent> {
    const prompt = `
      Analyze this user request and determine the intent:
      Request: "${request}"
      
      Context:
      - Current page: ${context.currentPage}
      - Financial Statement ID: ${context.financialStatementId}
      - Available tools: ${this.getToolDescriptions()}
      
      Return JSON with:
      - intent: 'query' | 'action' | 'navigation' | 'export' | 'explanation'
      - entities: extracted entities (company names, amounts, dates, etc.)
      - requiredTools: list of tools needed
    `;
    
    const response = await this.gemini.complete(prompt);
    return JSON.parse(response);
  }
}
```

### 3. Provenance Tracking

```typescript
// backend/src/modules/ai/services/provenance.service.ts

@Injectable()
export class ProvenanceService {
  constructor(
    private supabase: SupabaseService,
    private lineage: LineageService,
  ) {}

  async trackQuery(
    query: string,
    tableName: string,
    recordIds: string[],
  ): Promise<ProvenanceInfo[]> {
    const provenance: ProvenanceInfo[] = [];
    
    for (const recordId of recordIds) {
      // Get lineage information if available
      const lineageNode = await this.lineage.findNodeForRecord(tableName, recordId);
      
      provenance.push({
        source: 'database',
        table: tableName,
        recordId,
        timestamp: new Date(),
        lineageNodeId: lineageNode?.id,
      });
    }
    
    return provenance;
  }

  formatProvenanceForDisplay(provenance: ProvenanceInfo[]): string {
    return provenance.map(p => {
      if (p.table === 'consolidation_entries') {
        return `📊 Konsolidierungsbuchung #${p.recordId?.slice(0, 8)}`;
      }
      if (p.table === 'ic_reconciliations') {
        return `🔗 IC-Abstimmung #${p.recordId?.slice(0, 8)}`;
      }
      if (p.hgbReference) {
        return `📖 ${p.hgbReference}`;
      }
      return `📁 ${p.table}`;
    }).join(' | ');
  }
}
```

---

## Use Case Implementations

---

### Use Case 1: IC-Differenz-Analyse

**Priority:** KRITISCH  
**Type:** Query + Action

#### Tools Required

```typescript
// backend/src/modules/ai/tools/ic-analysis.tool.ts

export class ICAnalysisTool implements AgentTool {
  name = 'analyze_ic_difference';
  description = 'Analyzes intercompany differences and suggests resolutions';
  requiresConfirmation = false;
  
  parameters = [
    { name: 'company_a', type: 'string', required: false },
    { name: 'company_b', type: 'string', required: false },
    { name: 'account', type: 'string', required: false },
    { name: 'reconciliation_id', type: 'uuid', required: false },
  ];

  async execute(params: any, context: AgentContext): Promise<ToolResult> {
    const client = this.supabase.getClient();
    
    // Build query based on params
    let query = client
      .from('ic_reconciliations')
      .select(`
        *,
        company_a:companies!ic_reconciliations_company_a_id_fkey(id, name),
        company_b:companies!ic_reconciliations_company_b_id_fkey(id, name),
        account_a:accounts!ic_reconciliations_account_a_id_fkey(account_number, name),
        account_b:accounts!ic_reconciliations_account_b_id_fkey(account_number, name)
      `)
      .eq('financial_statement_id', context.financialStatementId)
      .eq('status', 'open')
      .order('difference_amount', { ascending: false });

    if (params.company_a) {
      query = query.ilike('company_a.name', `%${params.company_a}%`);
    }

    const { data, error } = await query.limit(10);
    
    if (error) throw error;

    // Analyze each difference
    const analyses = await Promise.all(
      data.map(rec => this.analyzeReconciliation(rec))
    );

    return {
      success: true,
      data: { reconciliations: data, analyses },
      message: this.formatAnalysisMessage(data, analyses),
      provenance: data.map(d => ({
        source: 'database',
        table: 'ic_reconciliations',
        recordId: d.id,
        timestamp: new Date(),
      })),
      suggestedAction: data.length > 0 ? {
        type: 'navigate',
        label: 'IC-Abstimmung öffnen',
        payload: { route: `/consolidation?tab=ic&id=${data[0].id}` },
      } : undefined,
    };
  }

  private async analyzeReconciliation(rec: any): Promise<ICAnalysis> {
    const diff = Math.abs(rec.difference_amount);
    
    // Rule-based analysis with AI enhancement
    let likelyCause: string;
    let suggestion: string;
    
    if (diff < 10) {
      likelyCause = 'Rundungsdifferenz';
      suggestion = 'Als unwesentlich akzeptieren';
    } else if (diff < 1000 && this.looksLikeTimingDiff(rec)) {
      likelyCause = 'Timing-Differenz';
      suggestion = 'Stichtagsanpassung prüfen';
    } else {
      // Use AI for complex cases
      const aiAnalysis = await this.gemini.complete(
        this.buildAnalysisPrompt(rec)
      );
      const parsed = this.parseAIAnalysis(aiAnalysis);
      likelyCause = parsed.cause;
      suggestion = parsed.suggestion;
    }

    return {
      reconciliationId: rec.id,
      likelyCause,
      suggestion,
      confidence: this.calculateConfidence(rec, likelyCause),
    };
  }
}
```

#### Actions Available

| Action | Description | Requires Confirmation |
|--------|-------------|----------------------|
| `accept_difference` | Mark as explained | No |
| `create_correction` | Create correction entry | Yes |
| `navigate_to_ic` | Open IC reconciliation page | No |
| `export_analysis` | Generate analysis report | No |

#### Example Interactions

```
User: "Analysiere die IC-Differenzen mit der Schweizer Tochter"

Agent Response:
┌─────────────────────────────────────────────────────────────┐
│ IC-Differenzen mit Swiss Holding AG                         │
├─────────────────────────────────────────────────────────────┤
│ 3 offene Differenzen gefunden (Gesamt: €45.230)            │
│                                                             │
│ 1. Konto 1600 (Forderungen): €32.500                       │
│    → Wahrscheinlich: Timing-Differenz (Buchung 28.12.)     │
│    → Empfehlung: Stichtagsanpassung                        │
│    📊 IC-Abstimmung #a1b2c3d4                              │
│                                                             │
│ 2. Konto 4400 (Erlöse): €12.500                            │
│    → Wahrscheinlich: Währungsdifferenz (CHF/EUR)           │
│    → Empfehlung: Einheitlichen Kurs verwenden              │
│    📊 IC-Abstimmung #e5f6g7h8                              │
│                                                             │
│ 3. Konto 6200 (Aufwendungen): €230                         │
│    → Wahrscheinlich: Rundungsdifferenz                     │
│    → Empfehlung: Als unwesentlich akzeptieren              │
│    📊 IC-Abstimmung #i9j0k1l2                              │
├─────────────────────────────────────────────────────────────┤
│ [IC-Abstimmung öffnen] [Alle akzeptieren] [Report erstellen]│
└─────────────────────────────────────────────────────────────┘
```

---

### Use Case 2: Kontextbasierte Datenabfrage

**Priority:** HOCH  
**Type:** Query

#### Tools Required

```typescript
// backend/src/modules/ai/tools/data-query.tool.ts

export class DataQueryTool implements AgentTool {
  name = 'query_consolidation_data';
  description = 'Query any consolidation data with natural language';
  requiresConfirmation = false;
  
  // Dynamic query builder based on intent
  async execute(params: any, context: AgentContext): Promise<ToolResult> {
    const queryType = this.classifyQuery(params.query);
    
    switch (queryType) {
      case 'companies':
        return this.queryCompanies(params, context);
      case 'goodwill':
        return this.queryGoodwill(params, context);
      case 'ic_transactions':
        return this.queryICTransactions(params, context);
      case 'consolidation_entries':
        return this.queryEntries(params, context);
      case 'balance_sheet':
        return this.queryBalanceSheet(params, context);
      case 'income_statement':
        return this.queryIncomeStatement(params, context);
      default:
        return this.generalQuery(params, context);
    }
  }

  private async queryGoodwill(params: any, context: AgentContext): Promise<ToolResult> {
    const client = this.supabase.getClient();
    
    const { data, error } = await client
      .from('consolidation_entries')
      .select(`
        id,
        amount,
        description,
        affected_company_ids,
        created_at,
        companies:affected_company_ids(name)
      `)
      .eq('financial_statement_id', context.financialStatementId)
      .eq('adjustment_type', 'capital_consolidation')
      .ilike('description', '%goodwill%');

    const totalGoodwill = data?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
    
    // Get breakdown by subsidiary
    const bySubsidiary = this.groupBySubsidiary(data);

    return {
      success: true,
      data: { totalGoodwill, bySubsidiary, entries: data },
      message: this.formatGoodwillResponse(totalGoodwill, bySubsidiary),
      provenance: data?.map(d => ({
        source: 'database',
        table: 'consolidation_entries',
        recordId: d.id,
        hgbReference: '§ 301 Abs. 3 HGB',
        timestamp: new Date(),
      })) || [],
    };
  }

  private formatGoodwillResponse(total: number, bySubsidiary: Map<string, number>): string {
    let response = `**Konzern-Goodwill: €${total.toLocaleString('de-DE')}**\n\n`;
    response += `Aufgliederung nach Tochterunternehmen:\n`;
    
    for (const [company, amount] of bySubsidiary) {
      response += `- ${company}: €${amount.toLocaleString('de-DE')}\n`;
    }
    
    response += `\n_Gemäß § 301 Abs. 3 HGB_`;
    return response;
  }
}
```

#### Supported Query Types

| Query Type | Example | Data Source |
|------------|---------|-------------|
| Companies | "Welche Gesellschaften sind konsolidiert?" | `companies` |
| Goodwill | "Wie hoch ist der Goodwill?" | `consolidation_entries` |
| IC Transactions | "IC-Transaktionen mit Company X" | `intercompany_transactions` |
| Balance Sheet | "Aktiva der Konzernbilanz" | `balance_sheet_items` |
| Income Statement | "Konzern-Umsatz 2025" | `income_statement_items` |
| Minorities | "Minderheitsanteile gesamt" | `consolidation_entries` |
| Participations | "Beteiligungsquoten" | `participations` |

---

### Use Case 3: Automatische Prüfpfad-Dokumentation

**Priority:** HOCH  
**Type:** Query + Export

#### Tools Required

```typescript
// backend/src/modules/ai/tools/audit-documentation.tool.ts

export class AuditDocumentationTool implements AgentTool {
  name = 'generate_audit_documentation';
  description = 'Generate audit trail documentation for consolidation entries';
  requiresConfirmation = false;

  async execute(params: any, context: AgentContext): Promise<ToolResult> {
    const docType = params.type || 'pruefvermerk';
    
    switch (docType) {
      case 'pruefvermerk':
        return this.generatePruefvermerk(params, context);
      case 'arbeitspapier':
        return this.generateArbeitspapier(params, context);
      case 'zusammenfassung':
        return this.generateZusammenfassung(params, context);
    }
  }

  private async generatePruefvermerk(params: any, context: AgentContext): Promise<ToolResult> {
    // Gather all relevant data
    const [entries, checks, lineage] = await Promise.all([
      this.getConsolidationEntries(context),
      this.getPlausibilityChecks(context),
      this.getLineageData(context),
    ]);

    // Generate document using AI
    const prompt = `
      Erstelle einen Prüfvermerk nach IDW PS 240 für die Konsolidierung:
      
      Konsolidierungsbuchungen:
      ${JSON.stringify(entries, null, 2)}
      
      Plausibilitätsprüfungen:
      ${JSON.stringify(checks, null, 2)}
      
      Format:
      1. Prüfungsgegenstand
      2. Durchgeführte Prüfungshandlungen
      3. Feststellungen
      4. Ergebnis
      
      Verwende formelle WP-Sprache und referenziere relevante HGB-Paragraphen.
    `;

    const document = await this.gemini.complete(prompt);

    return {
      success: true,
      data: { 
        document,
        entries: entries.length,
        checksPerformed: checks.length,
      },
      message: document,
      provenance: [
        ...entries.map(e => ({
          source: 'database' as const,
          table: 'consolidation_entries',
          recordId: e.id,
        })),
        ...checks.map(c => ({
          source: 'database' as const,
          table: 'plausibility_checks',
          recordId: c.id,
        })),
      ],
      suggestedAction: {
        type: 'export',
        label: 'Als PDF exportieren',
        payload: { format: 'pdf', content: document },
      },
    };
  }
}
```

#### Document Templates

| Template | Purpose | HGB Reference |
|----------|---------|---------------|
| `pruefvermerk` | Audit confirmation | IDW PS 240 |
| `arbeitspapier` | Working paper | IDW PS 460 |
| `zusammenfassung` | Executive summary | - |
| `konsolidierungsnachweis` | Consolidation proof | § 301 HGB |
| `ic_dokumentation` | IC elimination proof | § 303 HGB |

---

### Use Case 4: HGB-Paragraph-Referenz

**Priority:** MITTEL  
**Type:** Query (Knowledge Base)

#### Implementation

```typescript
// backend/src/modules/ai/tools/hgb-reference.tool.ts

export class HGBReferenceTool implements AgentTool {
  name = 'lookup_hgb';
  description = 'Look up HGB paragraphs and explain their application';
  requiresConfirmation = false;

  // Pre-loaded HGB knowledge base
  private hgbKnowledge = new Map<string, HGBParagraph>([
    ['§ 290', { 
      title: 'Pflicht zur Aufstellung',
      content: '...',
      relevantFor: ['consolidation_circle'],
    }],
    ['§ 301', {
      title: 'Kapitalkonsolidierung',
      content: '...',
      relevantFor: ['capital_consolidation', 'goodwill'],
    }],
    // ... more paragraphs
  ]);

  async execute(params: any, context: AgentContext): Promise<ToolResult> {
    const paragraph = params.paragraph;
    const applicationContext = params.context;

    // Get HGB paragraph info
    const hgbInfo = this.hgbKnowledge.get(paragraph);
    
    // Get relevant data from current consolidation
    const relevantData = await this.getRelevantData(
      hgbInfo.relevantFor,
      context
    );

    // Generate contextual explanation
    const explanation = await this.gemini.complete(`
      Erkläre ${paragraph} HGB im Kontext dieser Konsolidierung:
      
      Paragraph: ${hgbInfo.title}
      ${hgbInfo.content}
      
      Aktuelle Daten:
      ${JSON.stringify(relevantData, null, 2)}
      
      Erkläre:
      1. Was der Paragraph fordert
      2. Wie es in dieser Konsolidierung umgesetzt wurde
      3. Ob Handlungsbedarf besteht
    `);

    return {
      success: true,
      data: { hgbInfo, relevantData },
      message: explanation,
      provenance: [{
        source: 'external_api',
        hgbReference: paragraph,
      }],
    };
  }
}
```

---

### Use Case 5: Plausibilitätsprüfungs-Erklärung

**Priority:** MITTEL  
**Type:** Query + Action

#### Implementation

```typescript
// backend/src/modules/ai/tools/plausibility-explain.tool.ts

export class PlausibilityExplainTool implements AgentTool {
  name = 'explain_plausibility_check';
  description = 'Explain why a plausibility check failed and suggest fixes';
  requiresConfirmation = false;

  async execute(params: any, context: AgentContext): Promise<ToolResult> {
    const client = this.supabase.getClient();
    
    // Get failed checks
    const { data: failedChecks } = await client
      .from('plausibility_checks')
      .select('*')
      .eq('financial_statement_id', context.financialStatementId)
      .eq('result', 'FAIL')
      .eq('acknowledged', false);

    const explanations = await Promise.all(
      failedChecks.map(check => this.explainCheck(check, context))
    );

    return {
      success: true,
      data: { failedChecks, explanations },
      message: this.formatExplanations(explanations),
      provenance: failedChecks.map(c => ({
        source: 'database',
        table: 'plausibility_checks',
        recordId: c.id,
        hgbReference: c.hgb_reference,
      })),
      suggestedAction: failedChecks.length > 0 ? {
        type: 'navigate',
        label: 'Plausibilitätsprüfungen öffnen',
        payload: { route: `/controls/${context.financialStatementId}` },
      } : undefined,
    };
  }

  private async explainCheck(check: any, context: AgentContext): Promise<CheckExplanation> {
    // Get related data based on check type
    const relatedData = await this.getRelatedData(check.rule_type, context);
    
    const explanation = await this.gemini.complete(`
      Diese Plausibilitätsprüfung ist fehlgeschlagen:
      
      Prüfung: ${check.rule_name}
      Typ: ${check.rule_type}
      Details: ${check.details}
      HGB-Referenz: ${check.hgb_reference}
      
      Relevante Daten:
      ${JSON.stringify(relatedData, null, 2)}
      
      Erkläre:
      1. Warum die Prüfung fehlgeschlagen ist
      2. Was das Problem verursacht haben könnte
      3. Konkrete Schritte zur Behebung
    `);

    return {
      checkId: check.id,
      ruleName: check.rule_name,
      explanation,
      suggestedFix: this.extractSuggestedFix(explanation),
    };
  }
}
```

#### Actions Available

| Action | Description | Requires Confirmation |
|--------|-------------|----------------------|
| `acknowledge_check` | Mark check as acknowledged | No |
| `waive_check` | Waive with reason | Yes |
| `create_correction` | Create correction entry | Yes |
| `rerun_check` | Re-run the check | No |

---

### Use Case 6: Konzernanhang-Textbausteine

**Priority:** MITTEL  
**Type:** Query + Export

#### Implementation

```typescript
// backend/src/modules/ai/tools/notes-generator.tool.ts

export class NotesGeneratorTool implements AgentTool {
  name = 'generate_notes_section';
  description = 'Generate consolidated notes sections according to HGB';
  requiresConfirmation = false;

  private templates = {
    consolidation_circle: {
      hgbRef: '§ 313 Abs. 2 HGB',
      dataNeeded: ['companies', 'participations'],
    },
    accounting_policies: {
      hgbRef: '§ 313 Abs. 1 HGB',
      dataNeeded: ['policy_mappings'],
    },
    capital_consolidation: {
      hgbRef: '§ 301 HGB',
      dataNeeded: ['consolidation_entries', 'goodwill'],
    },
    related_parties: {
      hgbRef: '§ 314 Abs. 1 Nr. 13 HGB',
      dataNeeded: ['ic_transactions'],
    },
  };

  async execute(params: any, context: AgentContext): Promise<ToolResult> {
    const section = params.section;
    const template = this.templates[section];
    
    // Gather required data
    const data = await this.gatherData(template.dataNeeded, context);
    
    // Generate section text
    const sectionText = await this.generateSection(section, data, template.hgbRef);

    return {
      success: true,
      data: { section, text: sectionText },
      message: `**${section} (${template.hgbRef})**\n\n${sectionText}`,
      provenance: this.buildProvenance(data, template.hgbRef),
      suggestedAction: {
        type: 'export',
        label: 'In Konzernanhang einfügen',
        payload: { section, text: sectionText },
      },
    };
  }

  private async generateSection(
    section: string,
    data: any,
    hgbRef: string,
  ): Promise<string> {
    const prompt = `
      Erstelle den Konzernanhang-Abschnitt "${section}" nach ${hgbRef}.
      
      Daten:
      ${JSON.stringify(data, null, 2)}
      
      Anforderungen:
      - Formelle Sprache (Geschäftsbericht-Stil)
      - Alle Pflichtangaben nach HGB
      - Zahlen in €-Format mit Tausendertrennzeichen
      - Keine Platzhalter - nur vorhandene Daten verwenden
    `;

    return this.gemini.complete(prompt);
  }
}
```

#### Available Sections

| Section | HGB Reference | Data Required |
|---------|---------------|---------------|
| `consolidation_circle` | § 313 Abs. 2 | Companies, Participations |
| `accounting_policies` | § 313 Abs. 1 | Policy mappings |
| `capital_consolidation` | § 301 | Entries, Goodwill |
| `debt_consolidation` | § 303 | IC eliminations |
| `related_parties` | § 314 Abs. 1 Nr. 13 | IC transactions |
| `contingent_liabilities` | § 314 Abs. 1 Nr. 2 | Commitments |

---

### Use Case 7: Vorjahresvergleich und Varianzanalyse

**Priority:** MITTEL  
**Type:** Query

#### Implementation

```typescript
// backend/src/modules/ai/tools/variance-analysis.tool.ts

export class VarianceAnalysisTool implements AgentTool {
  name = 'analyze_variance';
  description = 'Compare current vs prior year and explain significant changes';
  requiresConfirmation = false;

  async execute(params: any, context: AgentContext): Promise<ToolResult> {
    const threshold = params.threshold || 0.1; // 10% default
    
    // Get current and prior year data
    const [currentYear, priorYear] = await Promise.all([
      this.getYearData(context.financialStatementId),
      this.getPriorYearData(context.financialStatementId),
    ]);

    // Calculate variances
    const variances = this.calculateVariances(currentYear, priorYear);
    
    // Filter significant variances
    const significant = variances.filter(v => 
      Math.abs(v.percentChange) >= threshold * 100
    );

    // Get AI explanations for top variances
    const explanations = await this.explainVariances(
      significant.slice(0, 5),
      context
    );

    return {
      success: true,
      data: { variances: significant, explanations },
      message: this.formatVarianceReport(significant, explanations),
      provenance: [
        {
          source: 'database',
          table: 'balance_sheet_items',
          recordId: context.financialStatementId,
        },
        {
          source: 'calculation',
          table: 'variance_analysis',
        },
      ],
    };
  }

  private async explainVariances(
    variances: Variance[],
    context: AgentContext,
  ): Promise<VarianceExplanation[]> {
    return Promise.all(
      variances.map(async v => {
        // Get related transactions that might explain the variance
        const relatedEntries = await this.getRelatedEntries(v.account, context);
        
        const explanation = await this.gemini.complete(`
          Erkläre diese Veränderung zum Vorjahr:
          
          Position: ${v.accountName}
          Vorjahr: €${v.priorYear.toLocaleString('de-DE')}
          Aktuell: €${v.currentYear.toLocaleString('de-DE')}
          Veränderung: ${v.percentChange.toFixed(1)}%
          
          Relevante Buchungen:
          ${JSON.stringify(relatedEntries, null, 2)}
          
          Gib eine kurze, präzise Erklärung (2-3 Sätze).
        `);

        return {
          account: v.account,
          explanation,
          relatedEntries,
        };
      })
    );
  }
}
```

---

### Use Case 8: Konsolidierungsbuchungen erklären

**Priority:** NIEDRIG  
**Type:** Query

#### Implementation

```typescript
// backend/src/modules/ai/tools/entry-explain.tool.ts

export class EntryExplainTool implements AgentTool {
  name = 'explain_consolidation_entry';
  description = 'Explain what a consolidation entry does and why';
  requiresConfirmation = false;

  async execute(params: any, context: AgentContext): Promise<ToolResult> {
    const entryId = params.entry_id;
    
    const { data: entry } = await this.supabase.getClient()
      .from('consolidation_entries')
      .select(`
        *,
        companies:affected_company_ids(name),
        lineage:lineage_nodes(*)
      `)
      .eq('id', entryId)
      .single();

    const explanation = await this.generateExplanation(entry);

    return {
      success: true,
      data: { entry, explanation },
      message: explanation,
      provenance: [{
        source: 'database',
        table: 'consolidation_entries',
        recordId: entry.id,
        hgbReference: this.getHGBReference(entry.adjustment_type),
        lineageNodeId: entry.lineage_node_id,
      }],
      suggestedAction: {
        type: 'navigate',
        label: 'Lineage anzeigen',
        payload: { route: `/lineage/${entry.lineage_node_id}` },
      },
    };
  }

  private async generateExplanation(entry: any): Promise<string> {
    const typeLabels = {
      capital_consolidation: 'Kapitalkonsolidierung',
      debt_consolidation: 'Schuldenkonsolidierung',
      elimination: 'Zwischenergebnis-Eliminierung',
      reclassification: 'Umbuchung',
    };

    return this.gemini.complete(`
      Erkläre diese Konsolidierungsbuchung in einfachen Worten:
      
      Typ: ${typeLabels[entry.adjustment_type]}
      Betrag: €${entry.amount.toLocaleString('de-DE')}
      Beschreibung: ${entry.description}
      Betroffene Unternehmen: ${entry.companies?.map(c => c.name).join(', ')}
      
      Erkläre:
      1. Was macht diese Buchung? (1 Satz)
      2. Warum ist sie notwendig? (1 Satz)
      3. Welche Auswirkung hat sie auf die Konzernbilanz? (1 Satz)
    `);
  }
}
```

---

### Use Case 9: Export und Berichtsformatierung

**Priority:** NIEDRIG  
**Type:** Export

#### Implementation

```typescript
// backend/src/modules/ai/tools/export.tool.ts

export class ExportTool implements AgentTool {
  name = 'export_report';
  description = 'Generate and export reports in various formats';
  requiresConfirmation = false;

  async execute(params: any, context: AgentContext): Promise<ToolResult> {
    const reportType = params.report_type;
    const format = params.format || 'pdf';

    switch (reportType) {
      case 'executive_summary':
        return this.generateExecutiveSummary(context, format);
      case 'audit_report':
        return this.generateAuditReport(context, format);
      case 'balance_sheet':
        return this.generateBalanceSheet(context, format);
      case 'income_statement':
        return this.generateIncomeStatement(context, format);
    }
  }

  private async generateExecutiveSummary(
    context: AgentContext,
    format: string,
  ): Promise<ToolResult> {
    // Gather key metrics
    const metrics = await this.gatherKeyMetrics(context);
    
    const summary = await this.gemini.complete(`
      Erstelle eine Executive Summary der Konzern-Konsolidierung:
      
      Kennzahlen:
      ${JSON.stringify(metrics, null, 2)}
      
      Format:
      - Überschrift
      - 3-5 Key Highlights (Bullet Points)
      - Wichtigste Veränderungen zum Vorjahr
      - Handlungsempfehlungen (falls vorhanden)
      
      Länge: ca. 200 Wörter
    `);

    // Generate download link
    const downloadUrl = await this.createExportFile(summary, format);

    return {
      success: true,
      data: { summary, downloadUrl, format },
      message: `${summary}\n\n📥 [Download ${format.toUpperCase()}](${downloadUrl})`,
      provenance: [{
        source: 'calculation',
        table: 'executive_summary',
      }],
    };
  }
}
```

---

## Frontend Agent UI

### Enhanced Chat Response Component

```typescript
// frontend/src/components/ai/AgentResponse.tsx

interface AgentResponseProps {
  response: AgentResponse;
  onActionClick: (action: SuggestedAction) => void;
}

export const AgentResponse: React.FC<AgentResponseProps> = ({
  response,
  onActionClick,
}) => {
  return (
    <div className="agent-response">
      {/* Main message with markdown support */}
      <div className="agent-message">
        <ReactMarkdown>{response.message}</ReactMarkdown>
      </div>

      {/* Provenance section */}
      {response.provenance?.length > 0 && (
        <div className="agent-provenance">
          <span className="provenance-label">Quellen:</span>
          {response.provenance.map((p, i) => (
            <ProvenanceBadge key={i} provenance={p} />
          ))}
        </div>
      )}

      {/* Suggested actions */}
      {response.suggestedAction && (
        <div className="agent-actions">
          <button
            className="agent-action-btn"
            onClick={() => onActionClick(response.suggestedAction)}
          >
            {response.suggestedAction.label}
          </button>
        </div>
      )}

      {/* Confirmation dialog for destructive actions */}
      {response.requiresConfirmation && (
        <ConfirmationDialog
          action={response.pendingAction}
          onConfirm={() => executeAction(response.pendingAction)}
          onCancel={() => cancelAction()}
        />
      )}
    </div>
  );
};
```

### Provenance Badge Component

```typescript
// frontend/src/components/ai/ProvenanceBadge.tsx

export const ProvenanceBadge: React.FC<{ provenance: ProvenanceInfo }> = ({
  provenance,
}) => {
  const getIcon = () => {
    switch (provenance.source) {
      case 'database': return '📊';
      case 'calculation': return '🔢';
      case 'external_api': return '🌐';
      default: return '📁';
    }
  };

  const getLabel = () => {
    if (provenance.hgbReference) return provenance.hgbReference;
    if (provenance.table) {
      const tableLabels = {
        consolidation_entries: 'Buchung',
        ic_reconciliations: 'IC-Abstimmung',
        companies: 'Unternehmen',
        plausibility_checks: 'Prüfung',
      };
      return tableLabels[provenance.table] || provenance.table;
    }
    return 'Quelle';
  };

  const handleClick = () => {
    if (provenance.lineageNodeId) {
      navigate(`/lineage/${provenance.lineageNodeId}`);
    } else if (provenance.recordId) {
      navigate(`/record/${provenance.table}/${provenance.recordId}`);
    }
  };

  return (
    <button className="provenance-badge" onClick={handleClick}>
      {getIcon()} {getLabel()}
      {provenance.recordId && (
        <span className="record-id">#{provenance.recordId.slice(0, 6)}</span>
      )}
    </button>
  );
};
```

---

## Database Schema Extensions

```sql
-- migrations/010_ai_agent_features.sql

-- Store agent actions for audit trail
CREATE TABLE IF NOT EXISTS ai_agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_statement_id UUID REFERENCES financial_statements(id),
  user_id UUID,
  action_type TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  parameters JSONB,
  result JSONB,
  provenance JSONB,
  requires_confirmation BOOLEAN DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Store HGB knowledge base for RAG
CREATE TABLE IF NOT EXISTS hgb_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paragraph TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  keywords TEXT[],
  relevant_tables TEXT[],
  examples JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX idx_hgb_paragraph ON hgb_knowledge_base(paragraph);
CREATE INDEX idx_hgb_keywords ON hgb_knowledge_base USING GIN(keywords);

-- Agent conversation history
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_statement_id UUID REFERENCES financial_statements(id),
  user_id UUID,
  messages JSONB NOT NULL DEFAULT '[]',
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Implementation Roadmap

### Phase 1: Core Agent Infrastructure (Week 1-2)
- [ ] Tool interface and registry
- [ ] Agent orchestrator service
- [ ] Provenance tracking service
- [ ] Basic query tools (companies, goodwill, IC)

### Phase 2: Advanced Query Tools (Week 3-4)
- [ ] Data query tool with NL understanding
- [ ] HGB reference tool with knowledge base
- [ ] Variance analysis tool
- [ ] Entry explanation tool

### Phase 3: Action Tools (Week 5-6)
- [ ] IC analysis with correction suggestions
- [ ] Plausibility check explanations
- [ ] Navigation tool
- [ ] Confirmation flow for destructive actions

### Phase 4: Export & Documentation (Week 7-8)
- [ ] Audit documentation generator
- [ ] Notes section generator
- [ ] Export tool (PDF, Excel, Word)
- [ ] Executive summary generator

### Phase 5: UI Enhancements (Week 9-10)
- [ ] Agent response component with provenance
- [ ] Action buttons in chat
- [ ] Confirmation dialogs
- [ ] Navigation from chat to app screens

---

## Summary

This implementation plan transforms the chatbot from a simple Q&A tool into a powerful **AI Agent** that can:

1. **Answer any question** about consolidation data with full provenance
2. **Execute actions** (create corrections, acknowledge checks, export reports)
3. **Navigate users** to relevant screens
4. **Generate documents** (audit trails, notes sections, summaries)
5. **Explain everything** (entries, checks, variances, HGB paragraphs)

The key differentiator is **provenance** - every piece of information is traceable back to its source, which is critical for audit requirements.
