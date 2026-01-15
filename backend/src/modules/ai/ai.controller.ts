import { Controller, Post, Get, Body, Query, Logger } from '@nestjs/common';
import { ChatService } from './services/chat.service';
import { ICAnalysisService } from './services/ic-analysis.service';
import { GeminiService } from './services/gemini.service';
import { AgentOrchestratorService } from './services/agent-orchestrator.service';
import { ModeService } from './services/mode.service';
import { AuditService } from './services/audit.service';
import { HGBLegalService } from './services/hgb-legal.service';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';
import { ICExplainRequestDto, BatchAnalyzeRequestDto, ICExplanationDto } from './dto/ic-analysis.dto';
import {
  AgentRequestDto,
  AgentResponseDto,
  ActivateModeDto,
  RecordDecisionDto,
  ModeStatusDto,
  AuditExportDto,
  AuditStatisticsDto,
} from './dto/agent.dto';

@Controller('ai')
export class AIController {
  private readonly logger = new Logger(AIController.name);

  constructor(
    private chatService: ChatService,
    private icAnalysisService: ICAnalysisService,
    private geminiService: GeminiService,
    private agentOrchestrator: AgentOrchestratorService,
    private modeService: ModeService,
    private auditService: AuditService,
    private hgbLegalService: HGBLegalService,
  ) {}

  // ==========================================
  // HEALTH CHECK
  // ==========================================

  @Get('health')
  async healthCheck(): Promise<{
    status: string;
    model: string;
    available: boolean;
  }> {
    const available = this.geminiService.isAvailable();
    
    if (!available) {
      return {
        status: 'not configured',
        model: 'none',
        available: false,
      };
    }

    try {
      // Quick test
      const response = await this.geminiService.complete('Antworte nur mit "OK".');
      const isWorking = response.toLowerCase().includes('ok');
      
      return {
        status: isWorking ? 'healthy' : 'degraded',
        model: this.geminiService.getModelName(),
        available: true,
      };
    } catch (error: any) {
      this.logger.error(`Health check failed: ${error.message}`);
      return {
        status: `error: ${error.message}`,
        model: this.geminiService.getModelName(),
        available: false,
      };
    }
  }

  // ==========================================
  // CHAT
  // ==========================================

  @Post('chat')
  async chat(@Body() dto: ChatRequestDto): Promise<ChatResponseDto> {
    this.logger.log(`Chat request: "${dto.message.substring(0, 50)}..."`);
    
    const response = await this.chatService.processMessage(
      dto.message,
      dto.history || [],
      dto.financialStatementId,
    );

    return response;
  }

  // ==========================================
  // IC ANALYSIS
  // ==========================================

  @Post('ic/explain')
  async explainDifference(@Body() dto: ICExplainRequestDto): Promise<ICExplanationDto> {
    this.logger.log(`IC explain request for: ${dto.reconciliationId}`);
    return this.icAnalysisService.explainDifference(dto.reconciliationId);
  }

  @Post('ic/batch-analyze')
  async batchAnalyze(@Body() dto: BatchAnalyzeRequestDto): Promise<ICExplanationDto[]> {
    this.logger.log(`Batch analyze request for statement: ${dto.financialStatementId}`);
    return this.icAnalysisService.batchAnalyze(dto.financialStatementId);
  }

  // ==========================================
  // AGENT ENDPOINTS
  // ==========================================

  /**
   * Process a request through the AI Agent
   */
  @Post('agent/process')
  async processAgentRequest(@Body() dto: AgentRequestDto): Promise<AgentResponseDto> {
    this.logger.log(`Agent request: "${dto.message.substring(0, 50)}..."`);
    
    // Use a default user ID if not provided (in production, get from auth)
    const userId = dto.userId || 'default-user';
    
    const response = await this.agentOrchestrator.processRequest(
      dto.message,
      userId,
      dto.financialStatementId,
      dto.sessionId,
    );

    // Convert response to DTO (convert Date fields to strings)
    return {
      ...response,
      provenance: response.provenance?.map(p => ({
        ...p,
        timestamp: p.timestamp instanceof Date ? p.timestamp.toISOString() : p.timestamp,
      })),
    } as AgentResponseDto;
  }

  /**
   * Get current mode status for a user
   */
  @Get('agent/mode')
  async getModeStatus(@Query('userId') userId?: string): Promise<ModeStatusDto> {
    const effectiveUserId = userId || 'default-user';
    const mode = this.modeService.getCurrentMode(effectiveUserId);
    const remaining = this.modeService.getActionModeRemainingTime(effectiveUserId);

    return {
      type: mode.type,
      activatedAt: mode.activatedAt?.toISOString(),
      expiresAt: mode.expiresAt?.toISOString(),
      remainingSeconds: remaining ?? undefined,
    };
  }

  /**
   * Activate or deactivate a mode
   */
  @Post('agent/mode')
  async setMode(@Body() dto: ActivateModeDto): Promise<ModeStatusDto> {
    const userId = dto.userId || 'default-user';

    let mode;
    if (dto.mode === 'action') {
      mode = this.modeService.activateActionMode(userId);
    } else {
      mode = this.modeService.deactivateActionMode(userId);
    }

    const remaining = this.modeService.getActionModeRemainingTime(userId);

    return {
      type: mode.type,
      activatedAt: mode.activatedAt?.toISOString(),
      expiresAt: mode.expiresAt?.toISOString(),
      remainingSeconds: remaining ?? undefined,
    };
  }

  /**
   * Record user decision on an AI recommendation
   */
  @Post('agent/decision')
  async recordDecision(@Body() dto: RecordDecisionDto): Promise<{ success: boolean }> {
    this.logger.log(`Recording decision for audit log: ${dto.auditLogId}`);
    
    const success = await this.agentOrchestrator.recordUserDecision(
      dto.auditLogId,
      dto.decision,
      dto.reasoning,
      dto.actionTaken,
      dto.actionResult,
    );

    return { success };
  }

  // ==========================================
  // AUDIT ENDPOINTS
  // ==========================================

  /**
   * Get audit statistics
   */
  @Get('audit/statistics')
  async getAuditStatistics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<AuditStatisticsDto> {
    const stats = await this.auditService.calculateStatistics({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    return {
      ...stats,
      period: {
        startDate: stats.period.startDate.toISOString(),
        endDate: stats.period.endDate.toISOString(),
      },
    };
  }

  /**
   * Get audit log entries
   */
  @Get('audit/log')
  async getAuditLog(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('userId') userId?: string,
    @Query('decisionType') decisionType?: 'accept' | 'reject' | 'modify' | 'ignore',
    @Query('toolName') toolName?: string,
  ) {
    const entries = await this.auditService.getAuditLog({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      userId,
      decisionType,
      toolName,
    });

    return entries;
  }

  /**
   * Get override log entries
   */
  @Get('audit/overrides')
  async getOverrideLog(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const entries = await this.auditService.getOverrideLog({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    return entries;
  }

  // ==========================================
  // LEGAL AWARENESS ENDPOINTS
  // ==========================================

  /**
   * Get legal change alerts for a user
   */
  @Get('legal/alerts')
  async getLegalAlerts(@Query('userId') userId?: string) {
    const effectiveUserId = userId || 'default-user';
    const alerts = await this.hgbLegalService.getChangeAlerts(effectiveUserId);
    
    // Convert Date objects to ISO strings for JSON serialization
    return alerts.map(alert => ({
      ...alert,
      change: {
        ...alert.change,
        announcedDate: alert.change.announcedDate?.toISOString(),
        effectiveDate: alert.change.effectiveDate.toISOString(),
        notificationSentAt: alert.change.notificationSentAt?.toISOString(),
      },
      paragraph: {
        ...alert.paragraph,
        effectiveDate: alert.paragraph.effectiveDate.toISOString(),
        supersededDate: alert.paragraph.supersededDate?.toISOString(),
        verifiedDate: alert.paragraph.verifiedDate.toISOString(),
      },
    }));
  }

  /**
   * Mark a legal change as seen by user
   */
  @Post('legal/alerts/dismiss')
  async dismissLegalAlert(
    @Body() body: { userId?: string; changeId: string },
  ): Promise<{ success: boolean }> {
    const userId = body.userId || 'default-user';
    await this.hgbLegalService.markChangeSeen(userId, body.changeId);
    return { success: true };
  }
}
