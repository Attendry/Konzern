# AI Agent Implementation Plan

**Version:** 2.1 (Final WP Review Incorporated)  
**Date:** January 2026  
**Scope:** Evolve chatbot from Q&A tool to intelligent agent with task execution capabilities

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 2026 | Initial draft |
| 2.0 | Jan 2026 | Incorporated WP feedback: reasoning transparency, quality indicators, disclaimers, batch processing, mode separation, override protocol |
| 2.1 | Jan 2026 | Added: confidence thresholds with traffic light, prominent alternatives display, audit trail export for external auditors, session context for batch follow-ups |

---

## Executive Summary

This document outlines the implementation plan to transform the current AI chatbot into a full-fledged **AI Agent** capable of:

1. **Answering questions** with data provenance and **transparent reasoning**
2. **Executing tasks** within the app framework (with explicit mode activation)
3. **Navigating users** to relevant screens
4. **Generating documents** and exports
5. **Suggesting corrections** with professional override capabilities
6. **Batch processing** for enterprise-scale operations

### Key Principles (from WP Feedback)

| Principle | Implementation |
|-----------|----------------|
| **Reasoning Transparency** | Every recommendation shows WHY the AI reached that conclusion |
| **Quality Indicators** | Data completeness, confidence, and historical accuracy shown |
| **Professional Override** | WP can disagree with documented reasoning |
| **Mode Separation** | Explicit "Erklär-Modus" (default) vs "Aktions-Modus" |
| **Audit Trail** | All AI interactions logged with accept/reject decisions |
| **Batch Processing** | All tools support single + batch operations |

---

## Architecture Evolution

### Current State: Q&A Chatbot
```
User Question → Chat Service → Gemini → Text Response
```

### Target State: AI Agent with Tools + Professional Controls
```
User Request → Mode Check → Agent Orchestrator → Tool Selection → Tool Execution
                   ↓                                      ↓
            [Erklär-Modus]                         [Response Builder]
            [Aktions-Modus]                              ↓
                                              ┌─────────────────────────┐
                                              │ Response Components:    │
                                              │ - Message               │
                                              │ - Reasoning Chain       │
                                              │ - Quality Indicators    │
                                              │ - Provenance            │
                                              │ - Suggested Actions     │
                                              │ - Override Option       │
                                              │ - Disclaimer            │
                                              └─────────────────────────┘
```

---

## NEW: Mode System

### Erklär-Modus (Default)

The agent operates in **read-only explanation mode** by default:
- Can query data
- Can explain entries, checks, differences
- Can generate documentation drafts
- **Cannot** execute actions that modify data
- **Cannot** create entries or mark items as resolved

```typescript
interface AgentMode {
  type: 'explain' | 'action';
  activatedAt?: Date;
  activatedBy?: string;
  expiresAt?: Date; // Auto-revert to explain after 30 minutes
}
```

### Aktions-Modus (Explicit Activation)

User must explicitly activate action mode:

```
User: "Aktiviere Aktions-Modus"

Agent: 
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ AKTIONS-MODUS AKTIVIEREN                                 │
│                                                             │
│ Im Aktions-Modus kann der AI-Agent:                        │
│ • Korrekturbuchungen vorschlagen und erstellen             │
│ • Prüfungen als erledigt markieren                         │
│ • IC-Differenzen akzeptieren                               │
│                                                             │
│ Alle Aktionen erfordern Ihre Bestätigung.                  │
│ Der Modus wird nach 30 Minuten automatisch deaktiviert.    │
│                                                             │
│ [Aktivieren] [Abbrechen]                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## NEW: Reasoning Transparency

Every AI recommendation includes a **reasoning chain** that shows the logic:

### Enhanced ToolResult Interface

```typescript
export interface ToolResult {
  success: boolean;
  data?: any;
  message: string;
  
  // NEW: Reasoning transparency
  reasoning: ReasoningChain;
  
  // NEW: Quality indicators
  quality: QualityIndicators;
  
  // Existing
  provenance: ProvenanceInfo[];
  suggestedAction?: SuggestedAction;
  
  // NEW: Professional disclaimer
  disclaimer: string;
}

export interface ReasoningChain {
  steps: ReasoningStep[];
  conclusion: string;
  alternativeInterpretations?: AlternativeInterpretation[];
  
  // NEW: Flag to show alternatives prominently when confidence < 80%
  showAlternativesProminent: boolean;
}

export interface AlternativeInterpretation {
  interpretation: string;
  probability: number;          // e.g., 0.18 for 18%
  checkQuestion: string;        // What to verify, e.g., "Unterschiedliche Kurse?"
}

export interface ReasoningStep {
  observation: string;      // What the AI observed
  inference: string;        // What it concluded from that
  confidence: number;       // How confident (0-1)
  dataPoints: string[];     // Which data supported this
}
```

### Example Reasoning Display

```
User: "Analysiere IC-Differenz #a1b2c3"

Agent Response:
┌─────────────────────────────────────────────────────────────┐
│ IC-Differenz: €32.500 (Konto 1600)                         │
│ Wahrscheinliche Ursache: Timing-Differenz                   │
│ Konfidenz: 85%                                              │
├─────────────────────────────────────────────────────────────┤
│ 📊 Quellen: IC-Abstimmung #a1b2c3 | § 303 HGB              │
├─────────────────────────────────────────────────────────────┤
│ [Zeige Begründung ▼]                                        │
└─────────────────────────────────────────────────────────────┘

[Expanded Reasoning:]
┌─────────────────────────────────────────────────────────────┐
│ 🔍 BEGRÜNDUNG                                               │
├─────────────────────────────────────────────────────────────┤
│ Schritt 1: Buchungsdaten analysiert                        │
│   • Company A buchte am 28.12.2025 (Beleg #4567)           │
│   • Company B buchte am 02.01.2026 (Beleg #8901)           │
│   → Inferenz: 5 Tage Differenz über Jahreswechsel          │
│   → Konfidenz: 90%                                          │
│                                                             │
│ Schritt 2: Beträge verglichen                              │
│   • Company A: €132.500 (Soll)                              │
│   • Company B: €100.000 (Haben)                             │
│   → Differenz: €32.500 entspricht exakt offener Posten     │
│   → Konfidenz: 95%                                          │
│                                                             │
│ Schritt 3: Historische Muster geprüft                      │
│   • Ähnliche Fälle zwischen diesen Gesellschaften: 3       │
│   • Davon Timing-Differenzen: 2 (67%)                      │
│   → Konfidenz: 70%                                          │
│                                                             │
│ FAZIT: Mit 85% Wahrscheinlichkeit Timing-Differenz         │
├─────────────────────────────────────────────────────────────┤
│ Alternative Interpretationen:                               │
│ • Währungsdifferenz (10% Wahrscheinlichkeit)               │
│ • Fehlbuchung (5% Wahrscheinlichkeit)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## NEW: Quality Indicators

Every response includes quality metrics:

```typescript
// Confidence thresholds with traffic light system
export const CONFIDENCE_THRESHOLDS = {
  high: 0.85,      // 🟢 Grün - Empfehlung kann verwendet werden
  medium: 0.65,    // 🟡 Gelb - Manuelle Prüfung empfohlen
  low: 0.50,       // 🔴 Rot - Nicht verlässlich, manuelle Analyse erforderlich
};

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= CONFIDENCE_THRESHOLDS.high) return 'high';
  if (confidence >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
  return 'low';
}

export interface QualityIndicators {
  // Data completeness
  dataCompleteness: {
    percentage: number;        // e.g., 95%
    missingData?: string[];    // What's missing
  };
  
  // Rule compliance
  ruleCompliance: {
    hgbConformity: boolean;
    deviations?: string[];
  };
  
  // Historical accuracy
  historicalAccuracy?: {
    similarCases: number;
    correctPredictions: number;
    accuracy: number;          // e.g., 0.87
  };
  
  // Confidence breakdown
  confidenceBreakdown: {
    dataQuality: number;       // 0-1
    patternMatch: number;      // 0-1
    ruleMatch: number;         // 0-1
    overall: number;           // 0-1
  };
  
  // NEW: Computed confidence level for UI
  confidenceLevel: ConfidenceLevel;
}
```

### Quality Display with Traffic Light System

```
┌─────────────────────────────────────────────────────────────┐
│ 📊 QUALITÄTSINDIKATOREN                          🟢 85%    │
├─────────────────────────────────────────────────────────────┤
│ Datenvollständigkeit: ████████░░ 80%                       │
│   ⚠️ Fehlend: Swiss Sub Q4 Daten                           │
│                                                             │
│ HGB-Konformität: ✅ § 303 HGB eingehalten                  │
│                                                             │
│ Historische Trefferquote: 87% (13/15 ähnliche Fälle)       │
│                                                             │
│ Gesamt-Konfidenz: ████████░░ 85%                           │
└─────────────────────────────────────────────────────────────┘
```

### Traffic Light Legend

| Level | Threshold | Color | Bedeutung |
|-------|-----------|-------|-----------|
| High | ≥ 85% | 🟢 Grün | Empfehlung kann verwendet werden |
| Medium | 65-84% | 🟡 Gelb | Manuelle Prüfung empfohlen |
| Low | < 65% | 🔴 Rot | Nicht verlässlich, manuelle Analyse erforderlich |

### Low Confidence Warning Display

When confidence < 80%, alternative interpretations are prominently displayed:

```
┌─────────────────────────────────────────────────────────────┐
│ IC-Differenz: €32.500 (Konto 1600)                         │
│ Wahrscheinliche Ursache: Timing-Differenz                   │
│ Konfidenz: 🟡 72%                                           │
├─────────────────────────────────────────────────────────────┤
│ ⚠️ ALTERNATIVE URSACHEN PRÜFEN                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Die Konfidenz liegt unter 80%. Bitte prüfen Sie auch:  │ │
│ │                                                         │ │
│ │ • Währungsdifferenz (18% Wahrscheinlichkeit)           │ │
│ │   → Unterschiedliche Kurse am Buchungstag?             │ │
│ │                                                         │ │
│ │ • Fehlbuchung (10% Wahrscheinlichkeit)                 │ │
│ │   → Falsches Gegenkonto verwendet?                     │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ 📊 Quellen: IC-Abstimmung #a1b2c3 | § 303 HGB              │
└─────────────────────────────────────────────────────────────┘
```

---

## NEW: Professional Override Protocol

WPs can disagree with AI recommendations:

```typescript
export interface OverrideRecord {
  id: string;
  aiRecommendationId: string;
  originalRecommendation: string;
  wpDecision: 'accept' | 'reject' | 'modify';
  wpReasoning: string;           // Required when rejecting
  wpUserId: string;
  timestamp: Date;
  
  // For audit trail
  aiConfidence: number;
  dataPointsConsidered: string[];
}
```

### Override UI Flow

```
Agent: "Empfehlung: Als Timing-Differenz akzeptieren"

[Zustimmen] [Ablehnen] [Modifizieren]

---

User clicks [Ablehnen]:

┌─────────────────────────────────────────────────────────────┐
│ 📝 EMPFEHLUNG ABLEHNEN                                      │
├─────────────────────────────────────────────────────────────┤
│ Die AI empfahl: Timing-Differenz                           │
│                                                             │
│ Ihre Einschätzung:                                         │
│ ○ Währungsdifferenz                                        │
│ ○ Fehlbuchung                                              │
│ ○ Andere Ursache: [________________]                       │
│                                                             │
│ Begründung (Pflichtfeld):                                  │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Die Buchungsdaten zeigen unterschiedliche Kurse...     ││
│ │                                                         ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ [Ablehnung protokollieren]                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## NEW: Batch Processing

All tools support batch operations:

```typescript
export interface BatchRequest {
  tool: string;
  items: string[];              // IDs to process
  options: {
    parallelism: number;        // How many concurrent
    stopOnError: boolean;
    generateReport: boolean;
  };
}

export interface BatchResult {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  results: ToolResult[];
  summary: string;
  reportUrl?: string;
  
  // NEW: Session context for follow-up queries
  sessionId: string;
  resultIndex: Map<number, string>;  // Position -> Result ID for "show me #23"
}
```

### Batch Examples

```
User: "Analysiere alle offenen IC-Differenzen"

Agent:
┌─────────────────────────────────────────────────────────────┐
│ 📋 BATCH-ANALYSE: IC-Differenzen                            │
├─────────────────────────────────────────────────────────────┤
│ Gefunden: 47 offene Differenzen                            │
│ Analysiert: 47/47 ✅                                        │
├─────────────────────────────────────────────────────────────┤
│ ZUSAMMENFASSUNG:                                            │
│ • Timing-Differenzen: 23 (49%)                             │
│ • Währungsdifferenzen: 12 (26%)                            │
│ • Rundungsdifferenzen: 8 (17%)                             │
│ • Unklare Ursache: 4 (8%)                                  │
│                                                             │
│ Gesamtvolumen: €1.234.567                                  │
│ Davon kritisch (>€10.000): 7 Positionen                    │
├─────────────────────────────────────────────────────────────┤
│ [Vollständigen Report herunterladen (Excel)]               │
│ [Kritische Fälle anzeigen]                                 │
│ [Alle Rundungsdifferenzen akzeptieren] ← Aktions-Modus     │
└─────────────────────────────────────────────────────────────┘
```

### Session Context for Batch Follow-ups

Users can reference batch results in follow-up queries:

```
User: "Zeige mir Details zu Position 23 aus dem letzten Batch"

Agent:
┌─────────────────────────────────────────────────────────────┐
│ 📋 DETAILS: Position #23 aus Batch vom 14.01.2026 10:42    │
├─────────────────────────────────────────────────────────────┤
│ IC-Differenz: Company A ↔ Company C                        │
│ Betrag: €8.750                                              │
│ Klassifizierung: Währungsdifferenz (🟡 72% Konfidenz)       │
│                                                             │
│ [Vollständige Analyse anzeigen]                            │
└─────────────────────────────────────────────────────────────┘
```

```typescript
// Session context management
export interface SessionContext {
  sessionId: string;
  userId: string;
  
  // Last batch operation for follow-up references
  lastBatchResult?: {
    timestamp: Date;
    toolName: string;
    totalItems: number;
    resultIndex: Map<number, string>;
  };
  
  // Conversation history for context
  recentQueries: Array<{
    query: string;
    resultIds: string[];
    timestamp: Date;
  }>;
}
```

---

## NEW: Professional Disclaimers

Every AI response includes appropriate disclaimers:

```typescript
const DISCLAIMERS = {
  general: `
    ⚠️ Hinweis: Diese AI-Analyse dient als Unterstützung und ersetzt 
    nicht die professionelle Beurteilung des Wirtschaftsprüfers. 
    Alle Empfehlungen sind zu prüfen und zu dokumentieren.
  `,
  
  action: `
    ⚠️ Aktions-Modus: Änderungen werden erst nach Ihrer expliziten 
    Bestätigung durchgeführt. Sie tragen die Verantwortung für alle 
    durchgeführten Aktionen.
  `,
  
  hgb: `
    📖 Die HGB-Referenzen basieren auf dem aktuellen Rechtsstand. 
    Bei Zweifelsfällen konsultieren Sie bitte die Fachliteratur 
    oder einen Rechtsberater.
  `,
  
  dataQuality: (completeness: number) => completeness < 0.9 
    ? `⚠️ Datenqualität: Nur ${Math.round(completeness * 100)}% der 
       erforderlichen Daten liegen vor. Die Analyse ist entsprechend 
       eingeschränkt.`
    : null,
};
```

---

## NEW: AI Usage Audit Trail

Complete logging of all AI interactions:

```sql
-- migrations/010_ai_agent_features.sql

-- Store all AI interactions with decisions
CREATE TABLE IF NOT EXISTS ai_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_statement_id UUID REFERENCES financial_statements(id),
  user_id UUID NOT NULL,
  
  -- Request
  request_text TEXT NOT NULL,
  request_mode TEXT NOT NULL CHECK (mode IN ('explain', 'action')),
  request_timestamp TIMESTAMPTZ DEFAULT now(),
  
  -- Response
  response_summary TEXT,
  ai_recommendation TEXT,
  ai_confidence DECIMAL(3,2),
  reasoning_chain JSONB,
  quality_indicators JSONB,
  provenance JSONB,
  
  -- User decision
  user_decision TEXT CHECK (user_decision IN ('accept', 'reject', 'modify', 'ignore')),
  user_reasoning TEXT,  -- Required when reject/modify
  decision_timestamp TIMESTAMPTZ,
  
  -- Action taken (if any)
  action_taken TEXT,
  action_result JSONB,
  
  -- Metadata
  session_id UUID,
  tool_name TEXT,
  processing_time_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for audit queries
CREATE INDEX idx_ai_audit_user ON ai_audit_log(user_id, created_at DESC);
CREATE INDEX idx_ai_audit_fs ON ai_audit_log(financial_statement_id, created_at DESC);
CREATE INDEX idx_ai_audit_decision ON ai_audit_log(user_decision, created_at DESC);

-- Store override history separately for compliance
CREATE TABLE IF NOT EXISTS ai_override_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_audit_log_id UUID REFERENCES ai_audit_log(id),
  
  ai_recommendation TEXT NOT NULL,
  ai_confidence DECIMAL(3,2),
  
  wp_decision TEXT NOT NULL,
  wp_alternative TEXT,
  wp_reasoning TEXT NOT NULL,
  wp_user_id UUID NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## NEW: Audit Trail Export for External Auditors

External auditors (Abschlussprüfer) need access to AI usage logs for compliance verification.

### Export Endpoints

```typescript
// backend/src/modules/ai/controllers/audit-export.controller.ts

@Controller('ai/audit')
export class AuditExportController {
  
  @Get('export')
  @UseGuards(AuthGuard)
  async exportAuditLog(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('userId') userId?: string,
    @Query('decisionType') decisionType?: 'accept' | 'reject' | 'modify' | 'ignore',
    @Query('format') format: 'csv' | 'xlsx' = 'xlsx',
  ): Promise<StreamableFile> {
    const data = await this.auditService.getAuditLog({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      userId,
      decisionType,
    });
    
    return this.exportService.generateReport(data, format);
  }
  
  @Get('statistics')
  @UseGuards(AuthGuard)
  async getAuditStatistics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<AuditStatistics> {
    return this.auditService.calculateStatistics({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
  }
  
  @Get('overrides')
  @UseGuards(AuthGuard)
  async getOverrideLog(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('format') format: 'csv' | 'xlsx' = 'xlsx',
  ): Promise<StreamableFile> {
    // Separate export for override decisions - required for compliance
    const data = await this.auditService.getOverrideLog({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
    
    return this.exportService.generateOverrideReport(data, format);
  }
}
```

### Audit Statistics Interface

```typescript
export interface AuditStatistics {
  period: {
    startDate: Date;
    endDate: Date;
  };
  
  totalInteractions: number;
  
  byDecision: {
    accept: number;
    reject: number;
    modify: number;
    ignore: number;
  };
  
  byTool: Record<string, number>;
  
  byUser: Array<{
    userId: string;
    userName: string;
    interactions: number;
    acceptRate: number;
  }>;
  
  averageConfidence: number;
  
  overrideRate: number;  // % of recommendations rejected/modified
  
  // For compliance reporting
  lowConfidenceInteractions: number;  // Where AI confidence < 65%
  missingReasoningCount: number;      // Overrides without reasoning (should be 0)
}
```

### Audit Dashboard UI

```typescript
// frontend/src/pages/AIAuditDashboard.tsx

export const AIAuditDashboard: React.FC = () => {
  const [dateRange, setDateRange] = useState<DateRange>({ ... });
  const [stats, setStats] = useState<AuditStatistics | null>(null);
  const [filters, setFilters] = useState<AuditFilters>({});

  return (
    <div className="ai-audit-dashboard">
      <h1>AI-Nutzungsprotokoll</h1>
      
      {/* Date range selector */}
      <DateRangePicker value={dateRange} onChange={setDateRange} />
      
      {/* Summary cards */}
      <div className="stats-grid">
        <StatCard 
          title="Gesamt-Interaktionen" 
          value={stats?.totalInteractions} 
        />
        <StatCard 
          title="Akzeptanzrate" 
          value={`${stats?.byDecision.accept / stats?.totalInteractions * 100}%`} 
        />
        <StatCard 
          title="Override-Rate" 
          value={`${stats?.overrideRate}%`}
          warning={stats?.overrideRate > 30}  // Highlight if high
        />
        <StatCard 
          title="Ø Konfidenz" 
          value={`${Math.round(stats?.averageConfidence * 100)}%`} 
        />
      </div>
      
      {/* Charts */}
      <div className="charts-row">
        <DecisionPieChart data={stats?.byDecision} />
        <ToolUsageBarChart data={stats?.byTool} />
        <ConfidenceTrendLineChart dateRange={dateRange} />
      </div>
      
      {/* Filters */}
      <AuditFilters 
        value={filters} 
        onChange={setFilters}
        options={{
          users: stats?.byUser,
          tools: Object.keys(stats?.byTool || {}),
          decisions: ['accept', 'reject', 'modify', 'ignore'],
        }}
      />
      
      {/* Detail table */}
      <AuditLogTable 
        dateRange={dateRange} 
        filters={filters}
        onExport={(format) => exportAuditLog(dateRange, filters, format)}
      />
      
      {/* Export buttons */}
      <div className="export-actions">
        <Button onClick={() => exportFullLog('xlsx')}>
          📥 Vollständiges Protokoll (Excel)
        </Button>
        <Button onClick={() => exportOverrides('xlsx')}>
          📥 Override-Protokoll (Excel)
        </Button>
        <Button onClick={() => exportStatistics('pdf')}>
          📥 Statistik-Bericht (PDF)
        </Button>
      </div>
    </div>
  );
};
```

### Export Report Format

The Excel export includes multiple sheets:

| Sheet | Content |
|-------|---------|
| Übersicht | Summary statistics, date range, generated by |
| Interaktionen | All AI interactions with timestamps, decisions |
| Overrides | All cases where WP disagreed with AI |
| Nach Benutzer | Breakdown by user |
| Nach Tool | Breakdown by tool type |
| Konfidenz-Analyse | Low confidence interactions highlighted |

---

## Revised Use Case Priorities

Based on WP feedback, priorities have been adjusted:

| Rang | Use Case | Original Priority | Revised Priority | Justification |
|------|----------|-------------------|------------------|---------------|
| 1 | IC-Differenz-Analyse | KRITISCH | **KRITISCH** | Unchanged - biggest time saver |
| 2 | Prüfpfad-Dokumentation | HOCH | **KRITISCH** ↑ | Legal requirement, high time savings |
| 3 | Plausibilitätsprüfungs-Erklärung | MITTEL | **HOCH** ↑ | Directly audit-relevant |
| 4 | Kontextbasierte Datenabfrage | HOCH | **HOCH** | Unchanged |
| 5 | Varianzanalyse | MITTEL | **HOCH** ↑ | Required for every audit |
| 6 | Konzernanhang-Textbausteine | MITTEL | MITTEL | Unchanged |
| 7 | Konsolidierungsbuchungen erklären | NIEDRIG | MITTEL ↑ | Supports understanding |
| 8 | HGB-Referenz | MITTEL | **MITTEL** ↔ | Contextual legal awareness (see Appendix A) |
| 9 | Export/Formatierung | NIEDRIG | NIEDRIG | Unchanged |

---

## Core Agent Infrastructure

### 1. Enhanced Tool Definition System

```typescript
// backend/src/modules/ai/tools/tool.interface.ts

export interface AgentTool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  
  // Mode requirements
  requiredMode: 'explain' | 'action' | 'both';
  requiresConfirmation: boolean;
  
  // Batch support
  supportsBatch: boolean;
  maxBatchSize?: number;
  
  // Execution
  execute: (params: Record<string, any>, context: AgentContext) => Promise<ToolResult>;
  executeBatch?: (items: string[], context: AgentContext) => Promise<BatchResult>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  message: string;
  
  // Reasoning (NEW)
  reasoning: ReasoningChain;
  
  // Quality (NEW)
  quality: QualityIndicators;
  
  // Provenance
  provenance: ProvenanceInfo[];
  
  // Actions
  suggestedAction?: SuggestedAction;
  
  // Override support (NEW)
  overrideOptions?: OverrideOption[];
  
  // Disclaimer (NEW)
  disclaimer: string;
}

export interface OverrideOption {
  id: string;
  label: string;
  requiresReasoning: boolean;
}
```

### 2. Agent Orchestrator with Mode Awareness

```typescript
// backend/src/modules/ai/services/agent-orchestrator.service.ts

@Injectable()
export class AgentOrchestratorService {
  private tools: Map<string, AgentTool> = new Map();

  async processRequest(
    request: string,
    context: AgentContext,
  ): Promise<AgentResponse> {
    // 1. Check mode
    const mode = await this.getCurrentMode(context.userId);
    
    // 2. Analyze intent
    const intent = await this.analyzeIntent(request, context);
    
    // 3. Validate mode allows requested action
    if (intent.requiresActionMode && mode.type === 'explain') {
      return {
        success: false,
        message: 'Diese Aktion erfordert den Aktions-Modus.',
        suggestedAction: {
          type: 'activate_action_mode',
          label: 'Aktions-Modus aktivieren',
        },
      };
    }
    
    // 4. Select and execute tools
    const toolCalls = await this.selectTools(intent, context);
    const results = await this.executeTools(toolCalls, context);
    
    // 5. Build response with all components
    const response = await this.buildResponse(request, results, context);
    
    // 6. Log to audit trail
    await this.logToAudit(request, response, context);
    
    return response;
  }

  private async buildResponse(
    request: string,
    results: ToolResult[],
    context: AgentContext,
  ): Promise<AgentResponse> {
    // Combine results
    const combined = this.combineResults(results);
    
    // Generate reasoning chain
    const reasoning = this.buildReasoningChain(results);
    
    // Calculate quality indicators
    const quality = this.calculateQuality(results, context);
    
    // Get appropriate disclaimer
    const disclaimer = this.getDisclaimer(results, context);
    
    return {
      ...combined,
      reasoning,
      quality,
      disclaimer,
      overrideOptions: this.getOverrideOptions(results),
    };
  }
}
```

### 3. Reasoning Chain Builder

```typescript
// backend/src/modules/ai/services/reasoning.service.ts

@Injectable()
export class ReasoningService {
  
  buildReasoningChain(
    data: any,
    analysisType: string,
  ): ReasoningChain {
    const steps: ReasoningStep[] = [];
    
    // Step 1: Data observation
    steps.push({
      observation: this.describeData(data),
      inference: this.inferFromData(data),
      confidence: this.calculateDataConfidence(data),
      dataPoints: this.extractDataPoints(data),
    });
    
    // Step 2: Pattern matching
    const patterns = this.findPatterns(data, analysisType);
    steps.push({
      observation: `${patterns.length} ähnliche historische Fälle gefunden`,
      inference: this.inferFromPatterns(patterns),
      confidence: patterns.length > 5 ? 0.9 : 0.6,
      dataPoints: patterns.map(p => p.id),
    });
    
    // Step 3: Rule application
    const rules = this.applyRules(data, analysisType);
    steps.push({
      observation: `${rules.matching} Regeln angewendet`,
      inference: this.inferFromRules(rules),
      confidence: rules.confidence,
      dataPoints: rules.appliedRules,
    });
    
    return {
      steps,
      conclusion: this.synthesizeConclusion(steps),
      alternativeInterpretations: this.findAlternatives(steps),
    };
  }

  private synthesizeConclusion(steps: ReasoningStep[]): string {
    const avgConfidence = steps.reduce((sum, s) => sum + s.confidence, 0) / steps.length;
    const mainInference = steps
      .sort((a, b) => b.confidence - a.confidence)[0]
      .inference;
    
    return `Mit ${Math.round(avgConfidence * 100)}% Wahrscheinlichkeit: ${mainInference}`;
  }
}
```

---

## Use Case Implementations (Updated)

### Use Case 1: IC-Differenz-Analyse (KRITISCH)

**Enhanced with reasoning, batch, and override support:**

```typescript
export class ICAnalysisTool implements AgentTool {
  name = 'analyze_ic_difference';
  description = 'Analyzes intercompany differences and suggests resolutions';
  requiredMode = 'both';  // Explain for analysis, Action for corrections
  requiresConfirmation = true;  // For action mode
  supportsBatch = true;
  maxBatchSize = 100;

  async execute(params: any, context: AgentContext): Promise<ToolResult> {
    const data = await this.fetchICData(params, context);
    const analysis = await this.analyzeReconciliation(data);
    
    return {
      success: true,
      data: { reconciliation: data, analysis },
      message: this.formatMessage(data, analysis),
      
      // NEW: Reasoning chain
      reasoning: {
        steps: [
          {
            observation: `Buchungsdatum Company A: ${data.dateA}, Company B: ${data.dateB}`,
            inference: `Differenz von ${this.daysDiff(data.dateA, data.dateB)} Tagen`,
            confidence: 0.9,
            dataPoints: [data.entryA.id, data.entryB.id],
          },
          {
            observation: `Betrag Company A: €${data.amountA}, Company B: €${data.amountB}`,
            inference: `Differenz: €${Math.abs(data.amountA - data.amountB)}`,
            confidence: 0.95,
            dataPoints: [data.entryA.id, data.entryB.id],
          },
          {
            observation: `Historische Fälle zwischen diesen Gesellschaften: ${analysis.historicalCases}`,
            inference: `Davon ${analysis.timingDiffPercent}% waren Timing-Differenzen`,
            confidence: analysis.historicalCases > 5 ? 0.8 : 0.5,
            dataPoints: analysis.historicalCaseIds,
          },
        ],
        conclusion: analysis.conclusion,
        alternativeInterpretations: analysis.alternatives,
      },
      
      // NEW: Quality indicators
      quality: {
        dataCompleteness: {
          percentage: data.completeness,
          missingData: data.missingFields,
        },
        ruleCompliance: {
          hgbConformity: true,
          deviations: [],
        },
        historicalAccuracy: {
          similarCases: analysis.historicalCases,
          correctPredictions: analysis.historicalCorrect,
          accuracy: analysis.historicalAccuracy,
        },
        confidenceBreakdown: {
          dataQuality: 0.9,
          patternMatch: 0.8,
          ruleMatch: 0.85,
          overall: analysis.confidence,
        },
      },
      
      provenance: [...],
      
      // NEW: Override options
      overrideOptions: [
        { id: 'timing', label: 'Timing-Differenz', requiresReasoning: false },
        { id: 'fx', label: 'Währungsdifferenz', requiresReasoning: false },
        { id: 'error', label: 'Buchungsfehler', requiresReasoning: true },
        { id: 'other', label: 'Andere Ursache', requiresReasoning: true },
      ],
      
      disclaimer: DISCLAIMERS.general,
      
      suggestedAction: context.mode === 'action' ? {
        type: 'create_correction',
        label: 'Korrekturbuchung erstellen',
        payload: analysis.suggestedCorrection,
      } : {
        type: 'navigate',
        label: 'Details anzeigen',
        payload: { route: `/ic/${data.id}` },
      },
    };
  }

  // NEW: Batch processing
  async executeBatch(ids: string[], context: AgentContext): Promise<BatchResult> {
    const results: ToolResult[] = [];
    
    for (const id of ids) {
      const result = await this.execute({ reconciliation_id: id }, context);
      results.push(result);
    }
    
    // Generate summary
    const summary = this.generateBatchSummary(results);
    
    return {
      total: ids.length,
      processed: results.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
      summary,
      reportUrl: await this.generateReport(results),
    };
  }
}
```

### Use Case 2: Prüfpfad-Dokumentation (KRITISCH - Upgraded)

**Now includes reasoning transparency for generated documents:**

```typescript
export class AuditDocumentationTool implements AgentTool {
  name = 'generate_audit_documentation';
  requiredMode = 'explain';  // Read-only, generates drafts
  requiresConfirmation = false;
  supportsBatch = true;

  async execute(params: any, context: AgentContext): Promise<ToolResult> {
    const [entries, checks, lineage] = await Promise.all([
      this.getConsolidationEntries(context),
      this.getPlausibilityChecks(context),
      this.getLineageData(context),
    ]);

    const document = await this.generateDocument(entries, checks, lineage);

    return {
      success: true,
      data: { document },
      message: document.content,
      
      reasoning: {
        steps: [
          {
            observation: `${entries.length} Konsolidierungsbuchungen analysiert`,
            inference: 'Alle Buchungen haben Lineage-Dokumentation',
            confidence: 0.95,
            dataPoints: entries.map(e => e.id),
          },
          {
            observation: `${checks.length} Plausibilitätsprüfungen durchgeführt`,
            inference: `${checks.filter(c => c.result === 'PASS').length} bestanden`,
            confidence: 1.0,
            dataPoints: checks.map(c => c.id),
          },
        ],
        conclusion: 'Prüfvermerk basiert auf vollständiger Datenbasis',
        alternativeInterpretations: [],
      },
      
      quality: {
        dataCompleteness: {
          percentage: this.calculateCompleteness(entries, checks),
          missingData: this.findMissingData(entries, checks),
        },
        ruleCompliance: {
          hgbConformity: true,
          deviations: [],
        },
        confidenceBreakdown: {
          dataQuality: 0.95,
          patternMatch: 1.0,
          ruleMatch: 1.0,
          overall: 0.97,
        },
      },
      
      provenance: [...],
      
      disclaimer: `
        ⚠️ Dieser Entwurf wurde automatisch generiert und muss vom 
        Wirtschaftsprüfer geprüft und freigegeben werden. Er ersetzt 
        nicht die professionelle Beurteilung nach IDW PS 240.
      `,
      
      suggestedAction: {
        type: 'export',
        label: 'Als Word-Dokument exportieren',
        payload: { format: 'docx', content: document },
      },
    };
  }
}
```

---

## Frontend Components (Updated)

### Enhanced Agent Response Component

```typescript
// frontend/src/components/ai/AgentResponse.tsx

interface AgentResponseProps {
  response: AgentResponse;
  onActionClick: (action: SuggestedAction) => void;
  onOverride: (option: OverrideOption, reasoning?: string) => void;
}

export const AgentResponse: React.FC<AgentResponseProps> = ({
  response,
  onActionClick,
  onOverride,
}) => {
  const [showReasoning, setShowReasoning] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);

  return (
    <div className="agent-response">
      {/* Main message */}
      <div className="agent-message">
        <ReactMarkdown>{response.message}</ReactMarkdown>
      </div>

      {/* Quality summary bar */}
      <QualitySummaryBar 
        quality={response.quality}
        onClick={() => setShowQuality(!showQuality)}
      />

      {/* Provenance section */}
      <ProvenanceSection provenance={response.provenance} />

      {/* NEW: Reasoning toggle */}
      <button 
        className="reasoning-toggle"
        onClick={() => setShowReasoning(!showReasoning)}
      >
        {showReasoning ? '🔍 Begründung ausblenden' : '🔍 Zeige Begründung'}
      </button>

      {showReasoning && (
        <ReasoningDisplay reasoning={response.reasoning} />
      )}

      {showQuality && (
        <QualityDetails quality={response.quality} />
      )}

      {/* Disclaimer */}
      <div className="agent-disclaimer">
        {response.disclaimer}
      </div>

      {/* Action buttons */}
      <div className="agent-actions">
        {response.suggestedAction && (
          <button
            className="agent-action-btn primary"
            onClick={() => onActionClick(response.suggestedAction)}
          >
            {response.suggestedAction.label}
          </button>
        )}
        
        {/* NEW: Override button */}
        {response.overrideOptions && (
          <button
            className="agent-action-btn secondary"
            onClick={() => setOverrideDialogOpen(true)}
          >
            Anderer Meinung
          </button>
        )}
      </div>

      {/* Override dialog */}
      {overrideDialogOpen && (
        <OverrideDialog
          options={response.overrideOptions}
          aiRecommendation={response.reasoning.conclusion}
          onSubmit={(option, reasoning) => {
            onOverride(option, reasoning);
            setOverrideDialogOpen(false);
          }}
          onCancel={() => setOverrideDialogOpen(false)}
        />
      )}
    </div>
  );
};
```

### Reasoning Display Component

```typescript
// frontend/src/components/ai/ReasoningDisplay.tsx

export const ReasoningDisplay: React.FC<{ reasoning: ReasoningChain }> = ({
  reasoning,
}) => {
  return (
    <div className="reasoning-display">
      <h4>🔍 Begründung</h4>
      
      {reasoning.steps.map((step, i) => (
        <div key={i} className="reasoning-step">
          <div className="step-header">
            <span className="step-number">Schritt {i + 1}</span>
            <span className="step-confidence">
              Konfidenz: {Math.round(step.confidence * 100)}%
            </span>
          </div>
          <div className="step-content">
            <p><strong>Beobachtung:</strong> {step.observation}</p>
            <p><strong>Schlussfolgerung:</strong> {step.inference}</p>
            <div className="data-points">
              {step.dataPoints.map(dp => (
                <ProvenanceBadge key={dp} recordId={dp} />
              ))}
            </div>
          </div>
        </div>
      ))}
      
      <div className="reasoning-conclusion">
        <strong>Fazit:</strong> {reasoning.conclusion}
      </div>
      
      {/* NEW: Prominent alternatives when showAlternativesProminent is true */}
      {reasoning.showAlternativesProminent && 
       reasoning.alternativeInterpretations?.length > 0 && (
        <div className="alternatives-prominent">
          <div className="alternatives-warning">
            ⚠️ ALTERNATIVE URSACHEN PRÜFEN
          </div>
          <p className="alternatives-explanation">
            Die Konfidenz liegt unter 80%. Bitte prüfen Sie auch:
          </p>
          <div className="alternatives-list">
            {reasoning.alternativeInterpretations.map((alt, i) => (
              <div key={i} className="alternative-card">
                <div className="alternative-header">
                  <span className="alternative-name">{alt.interpretation}</span>
                  <span className="alternative-probability">
                    {Math.round(alt.probability * 100)}%
                  </span>
                </div>
                <div className="alternative-check">
                  → {alt.checkQuestion}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Standard alternatives display when not prominent */}
      {!reasoning.showAlternativesProminent && 
       reasoning.alternativeInterpretations?.length > 0 && (
        <div className="alternatives-standard">
          <h5>Alternative Interpretationen:</h5>
          <ul>
            {reasoning.alternativeInterpretations.map((alt, i) => (
              <li key={i}>
                {alt.interpretation} ({Math.round(alt.probability * 100)}%)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
```

### Alternatives CSS Styling

```css
/* Prominent alternatives warning box */
.alternatives-prominent {
  background: var(--color-warning-bg, #fef3c7);
  border: 2px solid var(--color-warning-border, #f59e0b);
  border-radius: 8px;
  padding: 16px;
  margin-top: 16px;
}

.alternatives-warning {
  font-weight: 600;
  color: var(--color-warning-text, #92400e);
  font-size: 14px;
  margin-bottom: 8px;
}

.alternatives-explanation {
  color: var(--color-text-secondary);
  font-size: 13px;
  margin-bottom: 12px;
}

.alternative-card {
  background: white;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 8px;
}

.alternative-header {
  display: flex;
  justify-content: space-between;
  font-weight: 500;
}

.alternative-probability {
  color: var(--color-text-muted);
}

.alternative-check {
  color: var(--color-text-secondary);
  font-size: 13px;
  margin-top: 4px;
}

/* Standard alternatives (when confidence is high) */
.alternatives-standard {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
  font-size: 13px;
  color: var(--color-text-secondary);
}
```

---

## Revised Implementation Roadmap

### Phase 1: Core Infrastructure + Mode System (Week 1-2)
- [ ] Mode system (Erklär/Aktions-Modus)
- [ ] Tool interface with reasoning support
- [ ] Agent orchestrator with mode awareness
- [ ] Basic audit logging

### Phase 2: Reasoning & Quality (Week 3-4)
- [ ] Reasoning chain builder
- [ ] Quality indicators calculator
- [ ] Disclaimer system
- [ ] Enhanced provenance tracking

### Phase 3: Top Priority Tools (Week 5-6)
- [ ] IC-Differenz-Analyse with full reasoning
- [ ] Prüfpfad-Dokumentation generator
- [ ] Plausibilitätsprüfungs-Erklärung
- [ ] Batch processing for all three

### Phase 4: Override & Audit (Week 7-8)
- [ ] Override protocol UI
- [ ] Override logging to database
- [ ] AI audit trail queries/reports
- [ ] Compliance dashboard
- [ ] Audit Trail Export (CSV/Excel) for external auditors
- [ ] Filter-Dashboard for AI usage statistics
- [ ] Override-specific export report

### Phase 5: Remaining Tools (Week 9-10)
- [ ] Data query tool
- [ ] Variance analysis
- [ ] Entry explanation
- [ ] Export tools

### Phase 6: UI Polish (Week 11-12)
- [ ] Reasoning display component
- [ ] Quality indicators visualization
- [ ] Mode switcher UI
- [ ] Batch operation UI

---

## Summary

This revised plan addresses all WP feedback:

| Feedback | Implementation |
|----------|----------------|
| "Show me WHY" | Reasoning chain with steps, observations, inferences |
| Quality indicators | Data completeness, HGB conformity, historical accuracy |
| Disclaimers | Context-appropriate professional disclaimers |
| Override protocol | Documented disagreement with reasoning requirement |
| Mode separation | Explicit Erklär-Modus (default) vs Aktions-Modus |
| Batch processing | All tools support single + batch operations |
| Audit trail | Complete logging of all AI interactions + decisions |
| Priority adjustment | UC2/UC5 upgraded, UC8 downgraded |

### Additional Enhancements (v2.1)

| Enhancement | Implementation |
|-------------|----------------|
| Confidence thresholds | 🟢/🟡/🔴 traffic light system (85%/65%/50%) |
| Prominent alternatives | Warning box when confidence < 80% with check questions |
| Audit export | CSV/Excel export for external auditors with filter dashboard |
| Session context | Batch result references for follow-up queries |

**Expected ROI:** €3.000-4.500/month in time savings with professional-grade controls suitable for audit environments.

---

## Appendix A: HGB Legal Awareness Feature Extension

**Added:** January 2026  
**Priority:** MITTEL (upgraded from NIEDRIG)  
**Rationale:** Contextual legal awareness integrated with analysis tools provides genuine time savings

### A.1 Feature Overview

This extension adds **real-time HGB legal awareness** to the AI agent, focusing on:

1. **Legislative change tracking** - Automated monitoring of HGB amendments
2. **Contextual legal hints** - Relevant paragraphs shown inline during analysis
3. **IDW standards integration** - Key pronouncements for consolidation
4. **Currency indicators** - Clear "last verified" dates on all legal content
5. **Authoritative source linking** - Deep links to official legal databases

### A.2 Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Legal Assistant, not Legal Database** | Provide guidance and links, not comprehensive commentary |
| **Always cite sources** | Every legal reference links to authoritative source |
| **Currency transparency** | All content shows verification date |
| **Contextual integration** | Legal info appears within tool outputs, not standalone |
| **Professional disclaimer** | Clear statement that this is guidance, not legal advice |

### A.3 Data Model

```sql
-- migrations/011_hgb_legal_awareness.sql

-- Versioned HGB content with change tracking
CREATE TABLE IF NOT EXISTS hgb_paragraphs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Paragraph identification
  paragraph TEXT NOT NULL,              -- "§ 303"
  full_reference TEXT NOT NULL,         -- "§ 303 HGB"
  title TEXT NOT NULL,                  -- "Schuldenkonsolidierung"
  
  -- Content
  content_summary TEXT NOT NULL,        -- Brief summary (200 chars)
  content_full TEXT,                    -- Full text if available
  consolidation_relevance TEXT,         -- Why it matters for consolidation
  
  -- Versioning
  effective_date DATE NOT NULL,         -- When this version became effective
  superseded_date DATE,                 -- When replaced by newer version (NULL = current)
  is_current BOOLEAN DEFAULT true,
  
  -- Source tracking
  source_reference TEXT,                -- "BGBl. I 2021, S. 3338" (DiRUG)
  source_url TEXT,                      -- Link to official source
  verified_date DATE NOT NULL,          -- Last manual verification
  verified_by TEXT,                     -- Who verified
  
  -- Categorization
  category TEXT NOT NULL,               -- 'Konsolidierung', 'Bewertung', etc.
  subcategory TEXT,
  tags TEXT[],                          -- ['Schuldenkonsolidierung', 'IC']
  
  -- Related content
  related_paragraphs TEXT[],            -- ['§ 304 HGB', '§ 305 HGB']
  related_idw_standards TEXT[],         -- ['IDW RS HFA 2']
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Track legislative changes
CREATE TABLE IF NOT EXISTS hgb_legislative_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Change identification
  paragraph TEXT NOT NULL,              -- "§ 303 HGB"
  change_type TEXT NOT NULL CHECK (change_type IN ('amendment', 'addition', 'repeal', 'clarification')),
  
  -- Timing
  announced_date DATE,                  -- When announced/passed
  effective_date DATE NOT NULL,         -- When it takes effect
  
  -- Content
  change_summary TEXT NOT NULL,         -- Brief description
  change_details TEXT,                  -- Full details
  impact_on_consolidation TEXT,         -- Specific impact
  
  -- Legal reference
  law_name TEXT,                        -- "DiRUG", "BilRUG", "CSRD-UmsG"
  source_reference TEXT,                -- "BGBl. I 2021, S. 3338"
  source_url TEXT,
  
  -- Status
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'effective', 'superseded')),
  
  -- Notification tracking
  notify_users BOOLEAN DEFAULT true,
  notification_sent_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- IDW standards relevant to consolidation
CREATE TABLE IF NOT EXISTS idw_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Standard identification
  standard_id TEXT NOT NULL,            -- "IDW RS HFA 2"
  title TEXT NOT NULL,                  -- "Konzernrechnungslegung"
  
  -- Content
  summary TEXT NOT NULL,                -- Brief summary
  key_points TEXT[],                    -- Key takeaways for consolidation
  
  -- Versioning
  version TEXT,                         -- "Stand: 01.01.2023"
  effective_date DATE NOT NULL,
  superseded_date DATE,
  is_current BOOLEAN DEFAULT true,
  
  -- Source
  source_url TEXT,                      -- Link to IDW or purchase
  verified_date DATE NOT NULL,
  
  -- Relationships
  related_hgb_paragraphs TEXT[],        -- ['§ 303 HGB', '§ 304 HGB']
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Track which legal content users have seen (for change alerts)
CREATE TABLE IF NOT EXISTS user_legal_content_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- What they viewed
  content_type TEXT NOT NULL CHECK (content_type IN ('paragraph', 'change', 'idw_standard')),
  content_id UUID NOT NULL,
  
  -- When
  viewed_at TIMESTAMPTZ DEFAULT now(),
  dismissed_alert BOOLEAN DEFAULT false
);

-- Indexes
CREATE INDEX idx_hgb_paragraphs_current ON hgb_paragraphs(paragraph) WHERE is_current = true;
CREATE INDEX idx_hgb_paragraphs_category ON hgb_paragraphs(category) WHERE is_current = true;
CREATE INDEX idx_hgb_changes_effective ON hgb_legislative_changes(effective_date, status);
CREATE INDEX idx_hgb_changes_paragraph ON hgb_legislative_changes(paragraph);
CREATE INDEX idx_idw_current ON idw_standards(standard_id) WHERE is_current = true;
CREATE INDEX idx_user_views ON user_legal_content_views(user_id, content_type, content_id);
```

### A.4 TypeScript Interfaces

```typescript
// backend/src/modules/ai/types/legal.types.ts

export interface HGBParagraph {
  id: string;
  paragraph: string;              // "§ 303"
  fullReference: string;          // "§ 303 HGB"
  title: string;
  
  // Content
  contentSummary: string;
  contentFull?: string;
  consolidationRelevance: string;
  
  // Versioning
  effectiveDate: Date;
  supersededDate?: Date;
  isCurrent: boolean;
  
  // Source
  sourceReference?: string;
  sourceUrl?: string;
  verifiedDate: Date;
  
  // Categorization
  category: string;
  subcategory?: string;
  tags: string[];
  
  // Related
  relatedParagraphs: string[];
  relatedIdwStandards: string[];
}

export interface LegislativeChange {
  id: string;
  paragraph: string;
  changeType: 'amendment' | 'addition' | 'repeal' | 'clarification';
  
  announcedDate?: Date;
  effectiveDate: Date;
  
  changeSummary: string;
  changeDetails?: string;
  impactOnConsolidation?: string;
  
  lawName?: string;               // "DiRUG", "CSRD-UmsG"
  sourceReference?: string;
  sourceUrl?: string;
  
  status: 'upcoming' | 'effective' | 'superseded';
}

export interface IDWStandard {
  id: string;
  standardId: string;             // "IDW RS HFA 2"
  title: string;
  
  summary: string;
  keyPoints: string[];
  
  version?: string;
  effectiveDate: Date;
  isCurrent: boolean;
  
  sourceUrl?: string;
  verifiedDate: Date;
  
  relatedHgbParagraphs: string[];
}

export interface LegalContext {
  // Primary paragraph for this context
  primaryParagraph: HGBParagraph;
  
  // Related paragraphs
  relatedParagraphs: HGBParagraph[];
  
  // Relevant IDW standards
  idwStandards: IDWStandard[];
  
  // Pending/recent changes
  upcomingChanges: LegislativeChange[];
  recentChanges: LegislativeChange[];  // Last 12 months
  
  // Meta
  lastVerified: Date;
  disclaimer: string;
}

export interface LegalChangeAlert {
  change: LegislativeChange;
  paragraph: HGBParagraph;
  daysUntilEffective: number;
  userHasSeen: boolean;
  impactSeverity: 'low' | 'medium' | 'high';
}
```

### A.5 Enhanced HGB Knowledge Service

```typescript
// backend/src/modules/ai/services/hgb-legal.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { 
  HGBParagraph, 
  LegislativeChange, 
  IDWStandard, 
  LegalContext,
  LegalChangeAlert 
} from '../types/legal.types';

@Injectable()
export class HGBLegalService {
  private readonly logger = new Logger(HGBLegalService.name);
  
  // Cache with TTL
  private cache: Map<string, { data: any; expiry: Date }> = new Map();
  private readonly CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

  constructor(private supabase: SupabaseService) {}

  /**
   * Get legal context for a consolidation type or analysis
   * This is the main entry point for contextual legal information
   */
  async getLegalContext(
    consolidationType: string,
    options?: { includeRelated?: boolean; includeIdw?: boolean }
  ): Promise<LegalContext> {
    const primaryRef = this.mapConsolidationTypeToHGB(consolidationType);
    
    const [
      primaryParagraph,
      relatedParagraphs,
      idwStandards,
      upcomingChanges,
      recentChanges,
    ] = await Promise.all([
      this.getCurrentParagraph(primaryRef),
      options?.includeRelated !== false 
        ? this.getRelatedParagraphs(primaryRef) 
        : Promise.resolve([]),
      options?.includeIdw !== false 
        ? this.getRelevantIDWStandards(primaryRef) 
        : Promise.resolve([]),
      this.getUpcomingChanges(primaryRef),
      this.getRecentChanges(primaryRef, 12), // Last 12 months
    ]);

    return {
      primaryParagraph: primaryParagraph!,
      relatedParagraphs,
      idwStandards,
      upcomingChanges,
      recentChanges,
      lastVerified: primaryParagraph?.verifiedDate || new Date(),
      disclaimer: this.getLegalDisclaimer(),
    };
  }

  /**
   * Get current version of a paragraph
   */
  async getCurrentParagraph(reference: string): Promise<HGBParagraph | null> {
    const cacheKey = `paragraph:${reference}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const client = this.supabase.getClient();
      const { data, error } = await client
        .from('hgb_paragraphs')
        .select('*')
        .eq('full_reference', reference)
        .eq('is_current', true)
        .single();

      if (error || !data) {
        return this.getLocalFallback(reference);
      }

      const result = this.mapParagraphFromDb(data);
      this.setCache(cacheKey, result);
      return result;

    } catch (error: any) {
      this.logger.warn(`Failed to get paragraph ${reference}: ${error.message}`);
      return this.getLocalFallback(reference);
    }
  }

  /**
   * Get upcoming legislative changes (effective date in future)
   */
  async getUpcomingChanges(paragraph?: string): Promise<LegislativeChange[]> {
    try {
      const client = this.supabase.getClient();
      let query = client
        .from('hgb_legislative_changes')
        .select('*')
        .eq('status', 'upcoming')
        .gte('effective_date', new Date().toISOString())
        .order('effective_date', { ascending: true });

      if (paragraph) {
        query = query.eq('paragraph', paragraph);
      }

      const { data, error } = await query;
      if (error || !data) return [];

      return data.map(this.mapChangeFromDb);

    } catch (error: any) {
      this.logger.warn(`Failed to get upcoming changes: ${error.message}`);
      return [];
    }
  }

  /**
   * Get changes that became effective in the last N months
   */
  async getRecentChanges(paragraph?: string, months: number = 12): Promise<LegislativeChange[]> {
    try {
      const client = this.supabase.getClient();
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - months);

      let query = client
        .from('hgb_legislative_changes')
        .select('*')
        .eq('status', 'effective')
        .gte('effective_date', cutoffDate.toISOString())
        .lte('effective_date', new Date().toISOString())
        .order('effective_date', { descending: true });

      if (paragraph) {
        query = query.eq('paragraph', paragraph);
      }

      const { data, error } = await query;
      if (error || !data) return [];

      return data.map(this.mapChangeFromDb);

    } catch (error: any) {
      this.logger.warn(`Failed to get recent changes: ${error.message}`);
      return [];
    }
  }

  /**
   * Get relevant IDW standards for a paragraph
   */
  async getRelevantIDWStandards(paragraph: string): Promise<IDWStandard[]> {
    try {
      const client = this.supabase.getClient();
      const { data, error } = await client
        .from('idw_standards')
        .select('*')
        .contains('related_hgb_paragraphs', [paragraph])
        .eq('is_current', true);

      if (error || !data) return [];

      return data.map(this.mapIdwFromDb);

    } catch (error: any) {
      this.logger.warn(`Failed to get IDW standards: ${error.message}`);
      return [];
    }
  }

  /**
   * Get alerts for changes the user hasn't seen
   */
  async getChangeAlerts(userId: string): Promise<LegalChangeAlert[]> {
    const upcomingChanges = await this.getUpcomingChanges();
    const alerts: LegalChangeAlert[] = [];

    for (const change of upcomingChanges) {
      const userHasSeen = await this.hasUserSeenChange(userId, change.id);
      const paragraph = await this.getCurrentParagraph(change.paragraph);
      
      if (!paragraph) continue;

      const daysUntil = Math.ceil(
        (change.effectiveDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      alerts.push({
        change,
        paragraph,
        daysUntilEffective: daysUntil,
        userHasSeen,
        impactSeverity: this.assessImpactSeverity(change, daysUntil),
      });
    }

    // Sort by severity and date
    return alerts.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      const sevDiff = severityOrder[a.impactSeverity] - severityOrder[b.impactSeverity];
      if (sevDiff !== 0) return sevDiff;
      return a.daysUntilEffective - b.daysUntilEffective;
    });
  }

  /**
   * Mark a change as seen by user
   */
  async markChangeSeen(userId: string, changeId: string): Promise<void> {
    try {
      const client = this.supabase.getClient();
      await client.from('user_legal_content_views').insert({
        user_id: userId,
        content_type: 'change',
        content_id: changeId,
        dismissed_alert: true,
      });
    } catch (error: any) {
      this.logger.warn(`Failed to mark change seen: ${error.message}`);
    }
  }

  /**
   * Format legal context for display in tool results
   */
  formatLegalContextForDisplay(context: LegalContext): string {
    const lines: string[] = [];
    
    lines.push(`📖 **${context.primaryParagraph.fullReference}** - ${context.primaryParagraph.title}`);
    lines.push(`Stand: ${this.formatDate(context.primaryParagraph.verifiedDate)}`);
    lines.push('');
    lines.push(context.primaryParagraph.consolidationRelevance);
    
    if (context.idwStandards.length > 0) {
      lines.push('');
      lines.push('💡 **IDW Hinweise:**');
      for (const idw of context.idwStandards) {
        lines.push(`• ${idw.standardId}: ${idw.summary}`);
      }
    }
    
    if (context.upcomingChanges.length > 0) {
      lines.push('');
      lines.push('⚠️ **Bevorstehende Änderungen:**');
      for (const change of context.upcomingChanges) {
        lines.push(`• Ab ${this.formatDate(change.effectiveDate)}: ${change.changeSummary}`);
      }
    }
    
    if (context.primaryParagraph.sourceUrl) {
      lines.push('');
      lines.push(`[🔗 Volltext bei dejure.org](${context.primaryParagraph.sourceUrl})`);
    }
    
    return lines.join('\n');
  }

  /**
   * Map consolidation type to relevant HGB paragraph
   */
  private mapConsolidationTypeToHGB(consolidationType: string): string {
    const mapping: Record<string, string> = {
      'capital_consolidation': '§ 301 HGB',
      'debt_consolidation': '§ 303 HGB',
      'ic_elimination': '§ 303 HGB',
      'expense_income_elimination': '§ 305 HGB',
      'intermediate_result': '§ 304 HGB',
      'goodwill': '§ 309 HGB',
      'consolidation_obligation': '§ 290 HGB',
      'consolidation_scope': '§ 300 HGB',
      'minority_interests': '§ 307 HGB',
      'associated_companies': '§ 312 HGB',
      'currency_translation': '§ 308a HGB',
      'deferred_taxes': '§ 306 HGB',
    };

    return mapping[consolidationType] || '§ 290 HGB';
  }

  private getLegalDisclaimer(): string {
    return `Die HGB-Referenzen basieren auf dem aktuellen Rechtsstand und dienen als Orientierung. ` +
      `Bei Zweifelsfällen konsultieren Sie bitte die Fachliteratur, aktuelle Kommentare ` +
      `oder einen Rechtsberater. Diese Informationen stellen keine Rechtsberatung dar.`;
  }

  private assessImpactSeverity(
    change: LegislativeChange, 
    daysUntil: number
  ): 'low' | 'medium' | 'high' {
    // High if major change coming soon
    if (change.changeType === 'amendment' && daysUntil < 90) return 'high';
    if (change.changeType === 'repeal') return 'high';
    
    // Medium if change is coming or is an amendment
    if (daysUntil < 180) return 'medium';
    if (change.changeType === 'amendment') return 'medium';
    
    return 'low';
  }

  // Helper methods for DB mapping and caching...
  private mapParagraphFromDb(data: any): HGBParagraph {
    return {
      id: data.id,
      paragraph: data.paragraph,
      fullReference: data.full_reference,
      title: data.title,
      contentSummary: data.content_summary,
      contentFull: data.content_full,
      consolidationRelevance: data.consolidation_relevance,
      effectiveDate: new Date(data.effective_date),
      supersededDate: data.superseded_date ? new Date(data.superseded_date) : undefined,
      isCurrent: data.is_current,
      sourceReference: data.source_reference,
      sourceUrl: data.source_url,
      verifiedDate: new Date(data.verified_date),
      category: data.category,
      subcategory: data.subcategory,
      tags: data.tags || [],
      relatedParagraphs: data.related_paragraphs || [],
      relatedIdwStandards: data.related_idw_standards || [],
    };
  }

  private mapChangeFromDb(data: any): LegislativeChange {
    return {
      id: data.id,
      paragraph: data.paragraph,
      changeType: data.change_type,
      announcedDate: data.announced_date ? new Date(data.announced_date) : undefined,
      effectiveDate: new Date(data.effective_date),
      changeSummary: data.change_summary,
      changeDetails: data.change_details,
      impactOnConsolidation: data.impact_on_consolidation,
      lawName: data.law_name,
      sourceReference: data.source_reference,
      sourceUrl: data.source_url,
      status: data.status,
    };
  }

  private mapIdwFromDb(data: any): IDWStandard {
    return {
      id: data.id,
      standardId: data.standard_id,
      title: data.title,
      summary: data.summary,
      keyPoints: data.key_points || [],
      version: data.version,
      effectiveDate: new Date(data.effective_date),
      isCurrent: data.is_current,
      sourceUrl: data.source_url,
      verifiedDate: new Date(data.verified_date),
      relatedHgbParagraphs: data.related_hgb_paragraphs || [],
    };
  }

  private async hasUserSeenChange(userId: string, changeId: string): Promise<boolean> {
    try {
      const client = this.supabase.getClient();
      const { data } = await client
        .from('user_legal_content_views')
        .select('id')
        .eq('user_id', userId)
        .eq('content_id', changeId)
        .eq('dismissed_alert', true)
        .single();
      
      return !!data;
    } catch {
      return false;
    }
  }

  private async getRelatedParagraphs(reference: string): Promise<HGBParagraph[]> {
    const primary = await this.getCurrentParagraph(reference);
    if (!primary?.relatedParagraphs?.length) return [];

    const related: HGBParagraph[] = [];
    for (const ref of primary.relatedParagraphs) {
      const p = await this.getCurrentParagraph(ref);
      if (p) related.push(p);
    }
    return related;
  }

  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiry < new Date()) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expiry: new Date(Date.now() + this.CACHE_TTL_MS),
    });
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /**
   * Local fallback for common paragraphs
   */
  private getLocalFallback(reference: string): HGBParagraph | null {
    const fallbacks: Record<string, HGBParagraph> = {
      '§ 290 HGB': {
        id: 'fallback-290',
        paragraph: '§ 290',
        fullReference: '§ 290 HGB',
        title: 'Pflicht zur Aufstellung',
        contentSummary: 'Regelt die Pflicht zur Aufstellung eines Konzernabschlusses bei beherrschendem Einfluss.',
        consolidationRelevance: 'Grundnorm für die Konzernrechnungslegungspflicht. Prüfen Sie: Beherrschender Einfluss gem. Abs. 2 (Stimmrechtsmehrheit, Bestellungsrecht, etc.)',
        effectiveDate: new Date('2021-08-01'),
        isCurrent: true,
        verifiedDate: new Date('2026-01-01'),
        sourceUrl: 'https://dejure.org/gesetze/HGB/290.html',
        category: 'Konsolidierung',
        tags: ['Konzernabschluss', 'Aufstellungspflicht'],
        relatedParagraphs: ['§ 291 HGB', '§ 292 HGB', '§ 293 HGB'],
        relatedIdwStandards: ['IDW RS HFA 2'],
      },
      '§ 303 HGB': {
        id: 'fallback-303',
        paragraph: '§ 303',
        fullReference: '§ 303 HGB',
        title: 'Schuldenkonsolidierung',
        contentSummary: 'Forderungen und Verbindlichkeiten zwischen Konzernunternehmen sind wegzulassen.',
        consolidationRelevance: 'Kernvorschrift für IC-Abstimmung. Abs. 1: Vollständige Eliminierung. Abs. 2: Unwesentliche Beträge dürfen beibehalten werden (Wesentlichkeitsgrenze typisch 1%).',
        effectiveDate: new Date('2021-08-01'),
        isCurrent: true,
        verifiedDate: new Date('2026-01-01'),
        sourceUrl: 'https://dejure.org/gesetze/HGB/303.html',
        category: 'Konsolidierung',
        tags: ['Schuldenkonsolidierung', 'IC', 'Intercompany'],
        relatedParagraphs: ['§ 304 HGB', '§ 305 HGB'],
        relatedIdwStandards: ['IDW RS HFA 2'],
      },
      // ... additional fallbacks as needed
    };

    return fallbacks[reference] || null;
  }
}
```

### A.6 Integration with Existing Tools

The legal context integrates seamlessly with existing agent tools:

```typescript
// Example: Enhanced IC Analysis Tool with Legal Context

export class ICAnalysisTool implements AgentTool {
  constructor(
    private hgbLegalService: HGBLegalService,
    // ... other dependencies
  ) {}

  async execute(params: any, context: AgentContext): Promise<ToolResult> {
    const data = await this.fetchICData(params, context);
    const analysis = await this.analyzeReconciliation(data);
    
    // NEW: Get legal context for IC elimination
    const legalContext = await this.hgbLegalService.getLegalContext(
      'debt_consolidation',
      { includeRelated: true, includeIdw: true }
    );

    return {
      success: true,
      data: { reconciliation: data, analysis, legalContext },
      message: this.formatMessage(data, analysis),
      
      reasoning: { /* ... existing reasoning chain ... */ },
      quality: { 
        /* ... existing quality indicators ... */
        ruleCompliance: {
          hgbConformity: true,
          appliedParagraphs: [legalContext.primaryParagraph.fullReference],
          idwConformity: legalContext.idwStandards.map(s => s.standardId),
        },
      },
      
      provenance: [
        ...existingProvenance,
        // NEW: Add legal references to provenance
        {
          type: 'legal_reference',
          reference: legalContext.primaryParagraph.fullReference,
          verifiedDate: legalContext.lastVerified,
          sourceUrl: legalContext.primaryParagraph.sourceUrl,
        },
      ],
      
      // NEW: Include formatted legal context
      legalContext: this.hgbLegalService.formatLegalContextForDisplay(legalContext),
      
      disclaimer: DISCLAIMERS.hgb,
    };
  }
}
```

### A.7 Frontend Components

#### Legal Context Display

```typescript
// frontend/src/components/ai/LegalContextCard.tsx

interface LegalContextCardProps {
  context: LegalContext;
  expanded?: boolean;
  onToggle?: () => void;
}

export const LegalContextCard: React.FC<LegalContextCardProps> = ({
  context,
  expanded = false,
  onToggle,
}) => {
  return (
    <div className="legal-context-card">
      <div className="legal-header" onClick={onToggle}>
        <span className="legal-icon">📖</span>
        <span className="legal-title">
          {context.primaryParagraph.fullReference} - {context.primaryParagraph.title}
        </span>
        <span className="legal-verified">
          Stand: {formatDate(context.primaryParagraph.verifiedDate)}
        </span>
        <span className="toggle-icon">{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div className="legal-content">
          <p className="legal-relevance">
            {context.primaryParagraph.consolidationRelevance}
          </p>

          {context.idwStandards.length > 0 && (
            <div className="legal-idw">
              <h5>💡 IDW Hinweise</h5>
              {context.idwStandards.map(idw => (
                <div key={idw.id} className="idw-item">
                  <strong>{idw.standardId}</strong>: {idw.summary}
                </div>
              ))}
            </div>
          )}

          {context.upcomingChanges.length > 0 && (
            <LegalChangeWarning changes={context.upcomingChanges} />
          )}

          {context.primaryParagraph.sourceUrl && (
            <a 
              href={context.primaryParagraph.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="legal-source-link"
            >
              🔗 Volltext bei dejure.org
            </a>
          )}

          <div className="legal-disclaimer">
            {context.disclaimer}
          </div>
        </div>
      )}
    </div>
  );
};
```

#### Legal Change Alert Banner

```typescript
// frontend/src/components/ai/LegalChangeAlert.tsx

interface LegalChangeAlertProps {
  alert: LegalChangeAlert;
  onDismiss: () => void;
}

export const LegalChangeAlert: React.FC<LegalChangeAlertProps> = ({
  alert,
  onDismiss,
}) => {
  const severityColors = {
    high: 'var(--color-error)',
    medium: 'var(--color-warning)',
    low: 'var(--color-info)',
  };

  return (
    <div 
      className="legal-change-alert"
      style={{ borderColor: severityColors[alert.impactSeverity] }}
    >
      <div className="alert-header">
        <span className="alert-icon">⚠️</span>
        <span className="alert-title">Rechtliche Änderung</span>
        <span className="alert-date">
          Ab {formatDate(alert.change.effectiveDate)} 
          ({alert.daysUntilEffective} Tage)
        </span>
      </div>
      
      <div className="alert-content">
        <p><strong>{alert.paragraph.fullReference}</strong></p>
        <p>{alert.change.changeSummary}</p>
        
        {alert.change.impactOnConsolidation && (
          <p className="alert-impact">
            <strong>Auswirkung:</strong> {alert.change.impactOnConsolidation}
          </p>
        )}
        
        {alert.change.lawName && (
          <p className="alert-law">
            Quelle: {alert.change.lawName} ({alert.change.sourceReference})
          </p>
        )}
      </div>
      
      <div className="alert-actions">
        {alert.change.sourceUrl && (
          <a 
            href={alert.change.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            Details ansehen
          </a>
        )}
        <button onClick={onDismiss} className="btn btn-text">
          Verstanden
        </button>
      </div>
    </div>
  );
};
```

### A.8 Data Sources & Maintenance

| Source | Content | Update Frequency | Method |
|--------|---------|------------------|--------|
| **bundesgesetzblatt.de** | Legislative changes | When published | Manual review + RSS |
| **dejure.org** | HGB full text, deep links | On change | Link verification |
| **gesetze-im-internet.de** | Official HGB text | On change | Comparison check |
| **IDW Website** | IDW standards updates | Quarterly | Manual review |
| **BFH/BGH decisions** | Relevant case law | Quarterly | Curated selection |

**Maintenance workflow:**
1. Weekly automated check for HGB text changes on gesetze-im-internet.de
2. Manual quarterly review of IDW publications
3. Manual update when major legislation passes (BilRUG, DiRUG, CSRD-UmsG, etc.)
4. All content marked with `verified_date` for transparency

### A.9 Seed Data

```sql
-- database/seeds/005_hgb_legal_content_seed.sql

-- Key consolidation paragraphs
INSERT INTO hgb_paragraphs (
  paragraph, full_reference, title, content_summary, 
  consolidation_relevance, effective_date, verified_date,
  source_url, category, tags, related_paragraphs, related_idw_standards
) VALUES 
(
  '§ 290', '§ 290 HGB', 'Pflicht zur Aufstellung',
  'Kapitalgesellschaften mit beherrschendem Einfluss auf Tochterunternehmen müssen Konzernabschluss aufstellen.',
  'Grundnorm für Konzernrechnungslegungspflicht. Prüfkriterien: Stimmrechtsmehrheit (Abs. 2 Nr. 1), Bestellungsrecht (Nr. 2), beherrschender Einfluss kraft Vertrag (Nr. 3), Zweckgesellschaften (Abs. 2 Nr. 4).',
  '2021-08-01', '2026-01-15',
  'https://dejure.org/gesetze/HGB/290.html',
  'Konsolidierung', 
  ARRAY['Aufstellungspflicht', 'Konzernabschluss', 'beherrschender Einfluss'],
  ARRAY['§ 291 HGB', '§ 292 HGB', '§ 293 HGB', '§ 300 HGB'],
  ARRAY['IDW RS HFA 2']
),
(
  '§ 303', '§ 303 HGB', 'Schuldenkonsolidierung',
  'Forderungen, Verbindlichkeiten und RAP zwischen Konzernunternehmen sind wegzulassen.',
  'Kernvorschrift für IC-Abstimmung. Abs. 1: Vollständige Eliminierung erforderlich. Abs. 2: Unwesentliche Unterschiedsbeträge dürfen beibehalten werden (IDW: typisch 1% Wesentlichkeitsgrenze). Aufrechnungsdifferenzen sind zu analysieren (Timing, Währung, Fehler).',
  '2021-08-01', '2026-01-15',
  'https://dejure.org/gesetze/HGB/303.html',
  'Konsolidierung',
  ARRAY['Schuldenkonsolidierung', 'IC', 'Intercompany', 'Abstimmung'],
  ARRAY['§ 304 HGB', '§ 305 HGB'],
  ARRAY['IDW RS HFA 2']
),
-- ... additional paragraphs ...
;

-- IDW Standards
INSERT INTO idw_standards (
  standard_id, title, summary, key_points,
  effective_date, verified_date, source_url, related_hgb_paragraphs
) VALUES
(
  'IDW RS HFA 2', 'Konzernrechnungslegung',
  'Grundsätze ordnungsmäßiger Konzernrechnungslegung nach HGB',
  ARRAY[
    'Wesentlichkeitsgrenze für IC-Differenzen: typisch 1% der Bilanzsumme',
    'Einheitliche Stichtage: max. 3 Monate Abweichung',
    'Vereinheitlichung der Bewertung vor Konsolidierung'
  ],
  '2023-01-01', '2026-01-15',
  NULL, -- IDW requires subscription
  ARRAY['§ 290 HGB', '§ 300 HGB', '§ 301 HGB', '§ 303 HGB', '§ 304 HGB', '§ 305 HGB']
);

-- Upcoming changes (example: CSRD implementation)
INSERT INTO hgb_legislative_changes (
  paragraph, change_type, announced_date, effective_date,
  change_summary, impact_on_consolidation, law_name, source_reference, status
) VALUES
(
  '§ 315b HGB', 'amendment', '2024-07-01', '2027-01-01',
  'CSRD-Umsetzung: Erweiterte Nachhaltigkeitsberichterstattung im Konzernlagebericht',
  'Große Konzerne (>500 MA, >40M€ Umsatz, >20M€ Bilanz) müssen erweiterte ESG-Berichterstattung nach ESRS erstellen. Prüfungspflicht durch WP.',
  'CSRD-Umsetzungsgesetz',
  'BGBl. I 2024',
  'upcoming'
);
```

### A.10 Implementation Roadmap Addition

Add to Phase 3 or create new Phase 3.5:

| Task | Effort | Dependencies |
|------|--------|--------------|
| Create `hgb_paragraphs` table + seed data | 2h | None |
| Create `hgb_legislative_changes` table | 1h | None |
| Create `idw_standards` table | 1h | None |
| Implement `HGBLegalService` | 4h | Database tables |
| Integrate with IC Analysis Tool | 2h | HGBLegalService |
| Integrate with Audit Documentation Tool | 2h | HGBLegalService |
| Create `LegalContextCard` component | 3h | None |
| Create `LegalChangeAlert` component | 2h | None |
| Add legal alerts to dashboard | 2h | Components |
| Initial content population | 4h | Database tables |

**Total estimated effort: ~3-4 days**

### A.11 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Legal context shown in tool outputs | 100% of relevant tools | Logging |
| Content currency | <30 days since verification | Automated check |
| User engagement with legal hints | >60% expand to view | Analytics |
| Change alerts dismissed | >90% acknowledged | User tracking |
| Source link clicks | Track usage | Analytics |

---

**Note:** This feature extension enhances the agent's value proposition for WPs by providing contextual legal guidance without attempting to replace professional legal resources. All content includes clear source citations and verification dates.
