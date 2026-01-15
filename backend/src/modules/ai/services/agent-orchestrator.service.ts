import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { ModeService } from './mode.service';
import { ReasoningService } from './reasoning.service';
import { AuditService } from './audit.service';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  AgentContext,
  AgentResponse,
  AgentTool,
  ToolResult,
  BatchResult,
  ReasoningChain,
  QualityIndicators,
  ProvenanceInfo,
  SuggestedAction,
  OverrideOption,
  getDisclaimer,
  AuditLogEntry,
} from '../types/agent.types';
import { v4 as uuidv4 } from 'uuid';

interface Intent {
  toolName: string;
  params: Record<string, any>;
  requiresActionMode: boolean;
  isBatchOperation: boolean;
  batchItems?: string[];
}

/**
 * Main orchestrator for AI Agent operations
 */
@Injectable()
export class AgentOrchestratorService {
  private readonly logger = new Logger(AgentOrchestratorService.name);
  private tools: Map<string, AgentTool> = new Map();

  constructor(
    private gemini: GeminiService,
    private modeService: ModeService,
    private reasoningService: ReasoningService,
    private auditService: AuditService,
    private supabase: SupabaseService,
  ) {}

  /**
   * Register a tool with the orchestrator
   */
  registerTool(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
    this.logger.log(`Registered tool: ${tool.name}`);
  }

  /**
   * Get all registered tools
   */
  getTools(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Process a user request
   */
  async processRequest(
    request: string,
    userId: string,
    financialStatementId?: string,
    sessionId?: string,
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    const currentSessionId = sessionId || uuidv4();

    // 1. Get current mode
    const mode = this.modeService.getCurrentMode(userId);

    // 2. Create context
    const context: AgentContext = {
      userId,
      financialStatementId,
      mode,
      sessionId: currentSessionId,
    };

    try {
      // 3. Check for special commands
      const specialResponse = await this.handleSpecialCommands(request, context);
      if (specialResponse) {
        return specialResponse;
      }

      // 4. Analyze intent using Gemini
      const intent = await this.analyzeIntent(request, context);

      // 5. Validate mode allows requested action
      if (intent.requiresActionMode && mode.type === 'explain') {
        const activationPrompt = this.modeService.getActivationPrompt();
        
        return {
          success: false,
          message: `Diese Aktion erfordert den Aktions-Modus.\n\n**${activationPrompt.title}**\n\n${activationPrompt.description}\n${activationPrompt.capabilities.map(c => `• ${c}`).join('\n')}\n\n${activationPrompt.warning}`,
          requiresModeChange: true,
          suggestedAction: {
            type: 'activate_action_mode',
            label: 'Aktions-Modus aktivieren',
          },
        };
      }

      // 6. Execute tool(s)
      const tool = this.tools.get(intent.toolName);
      
      if (!tool) {
        // No specific tool matched, use chat fallback
        return await this.handleChatFallback(request, context);
      }

      let result: ToolResult | BatchResult;

      if (intent.isBatchOperation && intent.batchItems && tool.executeBatch) {
        result = await tool.executeBatch(intent.batchItems, context);
      } else {
        result = await tool.execute(intent.params, context);
      }

      // 7. Build response
      const response = this.buildResponse(result, context, intent.isBatchOperation);

      // 8. Log to audit trail
      const processingTime = Date.now() - startTime;
      await this.logToAudit(request, response, context, intent.toolName, processingTime);

      return response;

    } catch (error: any) {
      this.logger.error(`Error processing request: ${error.message}`);
      
      return {
        success: false,
        message: `Fehler bei der Verarbeitung: ${error.message}`,
        disclaimer: getDisclaimer(context),
      };
    }
  }

  /**
   * Handle special commands (mode activation, etc.)
   */
  private async handleSpecialCommands(
    request: string,
    context: AgentContext,
  ): Promise<AgentResponse | null> {
    const lowerRequest = request.toLowerCase().trim();

    // Activate action mode
    if (
      lowerRequest.includes('aktiviere aktions-modus') ||
      lowerRequest.includes('aktions-modus aktivieren') ||
      lowerRequest.includes('activate action mode')
    ) {
      const newMode = this.modeService.activateActionMode(context.userId);
      const remaining = this.modeService.getActionModeRemainingTime(context.userId);
      
      return {
        success: true,
        message: `**Aktions-Modus aktiviert**\n\nSie können jetzt Aktionen wie Korrekturbuchungen erstellen und Prüfungen markieren.\n\nDer Modus wird in ${Math.floor((remaining || 1800) / 60)} Minuten automatisch deaktiviert.`,
        disclaimer: getDisclaimer({ ...context, mode: newMode }),
      };
    }

    // Deactivate action mode
    if (
      lowerRequest.includes('deaktiviere aktions-modus') ||
      lowerRequest.includes('aktions-modus deaktivieren') ||
      lowerRequest.includes('beende aktions-modus') ||
      lowerRequest.includes('deactivate action mode')
    ) {
      this.modeService.deactivateActionMode(context.userId);
      
      return {
        success: true,
        message: `**Aktions-Modus deaktiviert**\n\nSie befinden sich wieder im Erklär-Modus (nur Lesezugriff).`,
        disclaimer: getDisclaimer(context),
      };
    }

    // Check current mode
    if (
      lowerRequest.includes('welcher modus') ||
      lowerRequest.includes('aktueller modus') ||
      lowerRequest.includes('current mode')
    ) {
      const mode = this.modeService.getCurrentMode(context.userId);
      const remaining = this.modeService.getActionModeRemainingTime(context.userId);
      
      const modeLabel = mode.type === 'action' ? 'Aktions-Modus' : 'Erklär-Modus';
      let message = `**Aktueller Modus: ${modeLabel}**\n\n`;
      
      if (mode.type === 'action' && remaining) {
        message += `Verbleibende Zeit: ${Math.floor(remaining / 60)} Minuten`;
      } else {
        message += 'Im Erklär-Modus haben Sie nur Lesezugriff. Aktionen erfordern die Aktivierung des Aktions-Modus.';
      }
      
      return {
        success: true,
        message,
      };
    }

    return null;
  }

  /**
   * Analyze user intent using Gemini
   */
  private async analyzeIntent(
    request: string,
    context: AgentContext,
  ): Promise<Intent> {
    // Get list of available tools
    const toolDescriptions = Array.from(this.tools.values())
      .map(t => `- ${t.name}: ${t.description} (Modus: ${t.requiredMode})`)
      .join('\n');

    const prompt = `Analysiere die folgende Benutzeranfrage und bestimme:
1. Welches Tool am besten passt
2. Welche Parameter extrahiert werden können
3. Ob es sich um eine Batch-Operation handelt

Verfügbare Tools:
${toolDescriptions}

Benutzeranfrage: "${request}"

Antworte im JSON-Format:
{
  "toolName": "name_des_tools oder 'none'",
  "params": { ... },
  "requiresActionMode": true/false,
  "isBatchOperation": true/false,
  "batchItems": ["id1", "id2"] oder null
}`;

    try {
      const response = await this.gemini.complete(prompt);
      
      // Parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          toolName: parsed.toolName || 'none',
          params: parsed.params || {},
          requiresActionMode: parsed.requiresActionMode || false,
          isBatchOperation: parsed.isBatchOperation || false,
          batchItems: parsed.batchItems,
        };
      }
    } catch (error: any) {
      this.logger.warn(`Failed to parse intent: ${error.message}`);
    }

    // Default to no specific tool
    return {
      toolName: 'none',
      params: {},
      requiresActionMode: false,
      isBatchOperation: false,
    };
  }

  /**
   * Handle chat fallback when no tool matches
   */
  private async handleChatFallback(
    request: string,
    context: AgentContext,
  ): Promise<AgentResponse> {
    // Use existing chat service logic
    const systemPrompt = `Du bist ein AI-Assistent für die HGB-Konzernkonsolidierung.
Du hilfst Wirtschaftsprüfern bei der Analyse von Konsolidierungsdaten.
Aktueller Modus: ${context.mode.type === 'action' ? 'Aktions-Modus' : 'Erklär-Modus'}

Beantworte Fragen klar und präzise. Verweise auf HGB-Paragraphen wo relevant.`;

    const response = await this.gemini.complete(request, systemPrompt);

    return {
      success: true,
      message: response,
      disclaimer: getDisclaimer(context),
      provenance: [{
        type: 'ai_inference',
        source: 'Gemini AI',
        description: 'Antwort basiert auf AI-Analyse',
      }],
    };
  }

  /**
   * Build response from tool result
   */
  private buildResponse(
    result: ToolResult | BatchResult,
    context: AgentContext,
    isBatch: boolean,
  ): AgentResponse {
    if (isBatch && 'total' in result) {
      // Batch result
      const batchResult = result as BatchResult;
      
      // Merge quality indicators from all results
      const qualities = batchResult.results
        .filter(r => r.quality)
        .map(r => r.quality);
      
      const mergedQuality = qualities.length > 0
        ? this.reasoningService.mergeQualityIndicators(qualities)
        : undefined;

      return {
        success: batchResult.succeeded > 0,
        message: batchResult.summary,
        quality: mergedQuality,
        batchResult,
        disclaimer: getDisclaimer(context, mergedQuality),
      };
    }

    // Single result
    const toolResult = result as ToolResult;

    return {
      success: toolResult.success,
      message: toolResult.message,
      reasoning: toolResult.reasoning,
      quality: toolResult.quality,
      provenance: toolResult.provenance,
      suggestedAction: toolResult.suggestedAction,
      overrideOptions: toolResult.overrideOptions,
      disclaimer: toolResult.disclaimer || getDisclaimer(context, toolResult.quality),
      data: toolResult.data,
    };
  }

  /**
   * Log to audit trail
   */
  private async logToAudit(
    request: string,
    response: AgentResponse,
    context: AgentContext,
    toolName: string,
    processingTimeMs: number,
  ): Promise<void> {
    const entry: AuditLogEntry = {
      financialStatementId: context.financialStatementId,
      userId: context.userId,
      requestText: request,
      requestMode: context.mode.type,
      requestTimestamp: new Date(),
      responseSummary: response.message.substring(0, 500),
      aiRecommendation: response.suggestedAction?.label,
      aiConfidence: response.quality?.confidenceBreakdown.overall,
      reasoningChain: response.reasoning,
      qualityIndicators: response.quality,
      provenance: response.provenance,
      sessionId: context.sessionId,
      toolName,
      processingTimeMs,
    };

    await this.auditService.logInteraction(entry);
  }

  /**
   * Record user decision on an AI recommendation
   */
  async recordUserDecision(
    auditLogId: string,
    decision: 'accept' | 'reject' | 'modify' | 'ignore',
    reasoning?: string,
    actionTaken?: string,
    actionResult?: any,
  ): Promise<boolean> {
    return this.auditService.logUserDecision(
      auditLogId,
      decision,
      reasoning,
      actionTaken,
      actionResult,
    );
  }
}
