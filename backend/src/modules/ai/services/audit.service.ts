import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  AuditLogEntry,
  OverrideRecord,
  OverrideDecision,
  ReasoningChain,
  QualityIndicators,
  ProvenanceInfo,
  AgentModeType,
} from '../types/agent.types';

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
  overrideRate: number;
  lowConfidenceInteractions: number;
  missingReasoningCount: number;
}

export interface AuditLogFilter {
  startDate: Date;
  endDate: Date;
  userId?: string;
  decisionType?: OverrideDecision;
  toolName?: string;
}

/**
 * Service for logging and querying AI audit trail
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private supabase: SupabaseService) {}

  /**
   * Log an AI interaction to the audit trail
   */
  async logInteraction(entry: AuditLogEntry): Promise<string | null> {
    try {
      const client = this.supabase.getClient();
      
      const { data, error } = await client
        .from('ai_audit_log')
        .insert({
          financial_statement_id: entry.financialStatementId,
          user_id: entry.userId,
          request_text: entry.requestText,
          request_mode: entry.requestMode,
          request_timestamp: entry.requestTimestamp.toISOString(),
          response_summary: entry.responseSummary,
          ai_recommendation: entry.aiRecommendation,
          ai_confidence: entry.aiConfidence,
          reasoning_chain: entry.reasoningChain,
          quality_indicators: entry.qualityIndicators,
          provenance: entry.provenance,
          session_id: entry.sessionId,
          tool_name: entry.toolName,
          processing_time_ms: entry.processingTimeMs,
        })
        .select('id')
        .single();

      if (error) {
        this.logger.error(`Failed to log AI interaction: ${error.message}`);
        return null;
      }

      return data?.id || null;
    } catch (err: any) {
      this.logger.error(`Exception logging AI interaction: ${err.message}`);
      return null;
    }
  }

  /**
   * Update an audit log entry with user decision
   */
  async logUserDecision(
    auditLogId: string,
    decision: OverrideDecision,
    reasoning?: string,
    actionTaken?: string,
    actionResult?: any,
  ): Promise<boolean> {
    try {
      const client = this.supabase.getClient();
      
      const { error } = await client
        .from('ai_audit_log')
        .update({
          user_decision: decision,
          user_reasoning: reasoning,
          decision_timestamp: new Date().toISOString(),
          action_taken: actionTaken,
          action_result: actionResult,
        })
        .eq('id', auditLogId);

      if (error) {
        this.logger.error(`Failed to log user decision: ${error.message}`);
        return false;
      }

      // If user rejected or modified, also log to override_log
      if (decision === 'reject' || decision === 'modify') {
        await this.logOverride(auditLogId, decision, reasoning);
      }

      return true;
    } catch (err: any) {
      this.logger.error(`Exception logging user decision: ${err.message}`);
      return false;
    }
  }

  /**
   * Log an override to the separate override log
   */
  private async logOverride(
    auditLogId: string,
    decision: OverrideDecision,
    reasoning?: string,
  ): Promise<void> {
    try {
      const client = this.supabase.getClient();
      
      // Get the original audit log entry
      const { data: auditEntry } = await client
        .from('ai_audit_log')
        .select('ai_recommendation, ai_confidence, user_id')
        .eq('id', auditLogId)
        .single();

      if (!auditEntry) return;

      await client
        .from('ai_override_log')
        .insert({
          ai_audit_log_id: auditLogId,
          ai_recommendation: auditEntry.ai_recommendation,
          ai_confidence: auditEntry.ai_confidence,
          wp_decision: decision,
          wp_reasoning: reasoning || 'Keine Begründung angegeben',
          wp_user_id: auditEntry.user_id,
        });
    } catch (err: any) {
      this.logger.error(`Exception logging override: ${err.message}`);
    }
  }

  /**
   * Get audit log entries with filters
   */
  async getAuditLog(filter: AuditLogFilter): Promise<AuditLogEntry[]> {
    try {
      const client = this.supabase.getClient();
      
      let query = client
        .from('ai_audit_log')
        .select('*')
        .gte('request_timestamp', filter.startDate.toISOString())
        .lte('request_timestamp', filter.endDate.toISOString())
        .order('request_timestamp', { ascending: false });

      if (filter.userId) {
        query = query.eq('user_id', filter.userId);
      }
      if (filter.decisionType) {
        query = query.eq('user_decision', filter.decisionType);
      }
      if (filter.toolName) {
        query = query.eq('tool_name', filter.toolName);
      }

      const { data, error } = await query;

      if (error) {
        this.logger.error(`Failed to get audit log: ${error.message}`);
        return [];
      }

      return (data || []).map(this.mapDbToEntry);
    } catch (err: any) {
      this.logger.error(`Exception getting audit log: ${err.message}`);
      return [];
    }
  }

  /**
   * Get override log entries
   */
  async getOverrideLog(filter: { startDate: Date; endDate: Date }): Promise<OverrideRecord[]> {
    try {
      const client = this.supabase.getClient();
      
      const { data, error } = await client
        .from('ai_override_log')
        .select('*')
        .gte('created_at', filter.startDate.toISOString())
        .lte('created_at', filter.endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error(`Failed to get override log: ${error.message}`);
        return [];
      }

      return (data || []).map(row => ({
        id: row.id,
        aiRecommendationId: row.ai_audit_log_id,
        originalRecommendation: row.ai_recommendation,
        wpDecision: row.wp_decision,
        wpAlternative: row.wp_alternative,
        wpReasoning: row.wp_reasoning,
        wpUserId: row.wp_user_id,
        timestamp: new Date(row.created_at),
        aiConfidence: row.ai_confidence,
        dataPointsConsidered: [],
      }));
    } catch (err: any) {
      this.logger.error(`Exception getting override log: ${err.message}`);
      return [];
    }
  }

  /**
   * Calculate audit statistics
   */
  async calculateStatistics(filter: { startDate: Date; endDate: Date }): Promise<AuditStatistics> {
    try {
      const client = this.supabase.getClient();
      
      const { data: entries, error } = await client
        .from('ai_audit_log')
        .select('*')
        .gte('request_timestamp', filter.startDate.toISOString())
        .lte('request_timestamp', filter.endDate.toISOString());

      if (error || !entries) {
        return this.getEmptyStatistics(filter);
      }

      const totalInteractions = entries.length;
      
      // Count by decision
      const byDecision = {
        accept: entries.filter(e => e.user_decision === 'accept').length,
        reject: entries.filter(e => e.user_decision === 'reject').length,
        modify: entries.filter(e => e.user_decision === 'modify').length,
        ignore: entries.filter(e => e.user_decision === 'ignore' || !e.user_decision).length,
      };

      // Count by tool
      const byTool: Record<string, number> = {};
      entries.forEach(e => {
        if (e.tool_name) {
          byTool[e.tool_name] = (byTool[e.tool_name] || 0) + 1;
        }
      });

      // Group by user
      const userMap = new Map<string, { interactions: number; accepts: number }>();
      entries.forEach(e => {
        const existing = userMap.get(e.user_id) || { interactions: 0, accepts: 0 };
        existing.interactions++;
        if (e.user_decision === 'accept') existing.accepts++;
        userMap.set(e.user_id, existing);
      });

      const byUser = Array.from(userMap.entries()).map(([userId, data]) => ({
        userId,
        userName: userId, // Would need to join with users table for name
        interactions: data.interactions,
        acceptRate: data.interactions > 0 ? data.accepts / data.interactions : 0,
      }));

      // Calculate averages
      const confidences = entries
        .filter(e => e.ai_confidence != null)
        .map(e => e.ai_confidence);
      const averageConfidence = confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0;

      // Override rate
      const overrideRate = totalInteractions > 0
        ? (byDecision.reject + byDecision.modify) / totalInteractions
        : 0;

      // Low confidence interactions
      const lowConfidenceInteractions = entries.filter(
        e => e.ai_confidence != null && e.ai_confidence < 0.65
      ).length;

      // Missing reasoning count (overrides without reasoning)
      const { data: overrides } = await client
        .from('ai_override_log')
        .select('wp_reasoning')
        .gte('created_at', filter.startDate.toISOString())
        .lte('created_at', filter.endDate.toISOString());

      const missingReasoningCount = (overrides || []).filter(
        o => !o.wp_reasoning || o.wp_reasoning === 'Keine Begründung angegeben'
      ).length;

      return {
        period: {
          startDate: filter.startDate,
          endDate: filter.endDate,
        },
        totalInteractions,
        byDecision,
        byTool,
        byUser,
        averageConfidence,
        overrideRate,
        lowConfidenceInteractions,
        missingReasoningCount,
      };
    } catch (err: any) {
      this.logger.error(`Exception calculating statistics: ${err.message}`);
      return this.getEmptyStatistics(filter);
    }
  }

  /**
   * Get empty statistics object
   */
  private getEmptyStatistics(filter: { startDate: Date; endDate: Date }): AuditStatistics {
    return {
      period: {
        startDate: filter.startDate,
        endDate: filter.endDate,
      },
      totalInteractions: 0,
      byDecision: { accept: 0, reject: 0, modify: 0, ignore: 0 },
      byTool: {},
      byUser: [],
      averageConfidence: 0,
      overrideRate: 0,
      lowConfidenceInteractions: 0,
      missingReasoningCount: 0,
    };
  }

  /**
   * Map database row to AuditLogEntry
   */
  private mapDbToEntry(row: any): AuditLogEntry {
    return {
      id: row.id,
      financialStatementId: row.financial_statement_id,
      userId: row.user_id,
      requestText: row.request_text,
      requestMode: row.request_mode,
      requestTimestamp: new Date(row.request_timestamp),
      responseSummary: row.response_summary,
      aiRecommendation: row.ai_recommendation,
      aiConfidence: row.ai_confidence,
      reasoningChain: row.reasoning_chain,
      qualityIndicators: row.quality_indicators,
      provenance: row.provenance,
      userDecision: row.user_decision,
      userReasoning: row.user_reasoning,
      decisionTimestamp: row.decision_timestamp ? new Date(row.decision_timestamp) : undefined,
      actionTaken: row.action_taken,
      actionResult: row.action_result,
      sessionId: row.session_id,
      toolName: row.tool_name,
      processingTimeMs: row.processing_time_ms,
    };
  }
}
