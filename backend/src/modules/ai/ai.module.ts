import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIController } from './ai.controller';
import { AuditExportController } from './controllers/audit-export.controller';
import { GeminiService } from './services/gemini.service';
import { ChatService } from './services/chat.service';
import { ICAnalysisService } from './services/ic-analysis.service';
import { AgentOrchestratorService } from './services/agent-orchestrator.service';
import { ModeService } from './services/mode.service';
import { ReasoningService } from './services/reasoning.service';
import { AuditService } from './services/audit.service';
import { ProvenanceService } from './services/provenance.service';
import { HGBKnowledgeService } from './services/hgb-knowledge.service';
import { HGBLegalService } from './services/hgb-legal.service';
import { ExportService } from './services/export.service';
import { SupabaseModule } from '../supabase/supabase.module';

// Tools - Phase 3
import { ICAnalysisTool } from './tools/ic-analysis.tool';
import { AuditDocumentationTool } from './tools/audit-documentation.tool';
import { PlausibilityCheckTool } from './tools/plausibility-check.tool';
// Tools - Phase 5
import { VarianceAnalysisTool } from './tools/variance-analysis.tool';
import { DataQueryTool } from './tools/data-query.tool';
import { EntryExplanationTool } from './tools/entry-explanation.tool';

@Module({
  imports: [
    ConfigModule,
    SupabaseModule,
  ],
  controllers: [AIController, AuditExportController],
  providers: [
    // Core services
    GeminiService,
    ChatService,
    ICAnalysisService,
    
    // Agent services
    AgentOrchestratorService,
    ModeService,
    ReasoningService,
    AuditService,
    ProvenanceService,
    HGBKnowledgeService,
    HGBLegalService,
    ExportService,
    
    // Tools - Phase 3
    ICAnalysisTool,
    AuditDocumentationTool,
    PlausibilityCheckTool,
    // Tools - Phase 5
    VarianceAnalysisTool,
    DataQueryTool,
    EntryExplanationTool,
  ],
  exports: [
    GeminiService,
    ChatService,
    ICAnalysisService,
    AgentOrchestratorService,
    ModeService,
    ReasoningService,
    AuditService,
    ProvenanceService,
    HGBKnowledgeService,
    HGBLegalService,
    ExportService,
    ICAnalysisTool,
    AuditDocumentationTool,
    PlausibilityCheckTool,
    VarianceAnalysisTool,
    DataQueryTool,
    EntryExplanationTool,
  ],
})
export class AIModule implements OnModuleInit {
  constructor(
    private orchestrator: AgentOrchestratorService,
    // Phase 3 Tools
    private icAnalysisTool: ICAnalysisTool,
    private auditDocTool: AuditDocumentationTool,
    private plausibilityTool: PlausibilityCheckTool,
    // Phase 5 Tools
    private varianceAnalysisTool: VarianceAnalysisTool,
    private dataQueryTool: DataQueryTool,
    private entryExplanationTool: EntryExplanationTool,
  ) {}

  onModuleInit() {
    // Register all tools with the orchestrator
    // Phase 3
    this.orchestrator.registerTool(this.icAnalysisTool);
    this.orchestrator.registerTool(this.auditDocTool);
    this.orchestrator.registerTool(this.plausibilityTool);
    // Phase 5
    this.orchestrator.registerTool(this.varianceAnalysisTool);
    this.orchestrator.registerTool(this.dataQueryTool);
    this.orchestrator.registerTool(this.entryExplanationTool);
  }
}
