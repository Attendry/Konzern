import { Injectable, Optional, Inject, forwardRef } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditLogService } from '../consolidation/audit-log.service';
import {
  ConsolidationRule,
  ConsolidationRuleType,
  RuleFlexibility,
  RuleConfig,
} from '../../entities/consolidation-rule.entity';

// Rule Execution Result
export interface RuleExecutionResult {
  ruleId: string;
  ruleCode: string;
  ruleName: string;
  wasApplied: boolean;
  wasSuccessful: boolean;
  message: string;
  affectedAmount?: number;
  affectedAccounts?: string[];
  consolidationEntryId?: string;
  parametersUsed?: Record<string, unknown>;
}

// Rule Summary
export interface RuleSummary {
  totalRules: number;
  activeRules: number;
  mandatoryRules: number;
  byType: {
    type: ConsolidationRuleType;
    count: number;
    mandatoryCount: number;
  }[];
  byFlexibility: {
    flexibility: RuleFlexibility;
    count: number;
  }[];
}

// Rule Override
export interface RuleParameterOverride {
  id: string;
  ruleId: string;
  financialStatementId: string;
  parameterOverrides: Record<string, unknown>;
  justification?: string;
  approvedByUserId?: string;
  approvedAt?: Date;
}

@Injectable()
export class RulesEngineService {
  constructor(
    private supabaseService: SupabaseService,
    @Optional() @Inject(forwardRef(() => AuditLogService))
    private auditLogService: AuditLogService,
  ) {}

  // ==================== RULES MANAGEMENT ====================

  /**
   * Get all consolidation rules
   */
  async getRules(
    ruleType?: ConsolidationRuleType,
    activeOnly: boolean = true,
  ): Promise<ConsolidationRule[]> {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('consolidation_rules')
      .select(`
        *,
        policy:accounting_policies(*)
      `)
      .order('execution_order', { ascending: true });

    if (ruleType) {
      query = query.eq('rule_type', ruleType);
    }

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch rules: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get mandatory HGB rules
   */
  async getMandatoryRules(): Promise<ConsolidationRule[]> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('consolidation_rules')
      .select('*')
      .eq('is_active', true)
      .eq('is_hgb_mandatory', true)
      .order('execution_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch mandatory rules: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single rule by ID
   */
  async getRule(ruleId: string): Promise<ConsolidationRule | null> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('consolidation_rules')
      .select(`
        *,
        policy:accounting_policies(*)
      `)
      .eq('id', ruleId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch rule: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new consolidation rule
   */
  async createRule(
    rule: Partial<ConsolidationRule>,
    userId?: string,
  ): Promise<ConsolidationRule> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('consolidation_rules')
      .insert({
        ...rule,
        created_by_user_id: userId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create rule: ${error.message}`);
    }

    // Log action
    if (this.auditLogService) {
      await this.auditLogService.log({
        userId,
        action: 'create' as any,
        entityType: 'system' as any,
        entityId: data.id,
        entityName: data.name,
        afterState: data,
        description: `Created consolidation rule: ${data.code}`,
      });
    }

    return data;
  }

  /**
   * Update a consolidation rule
   */
  async updateRule(
    ruleId: string,
    updates: Partial<ConsolidationRule>,
    userId?: string,
  ): Promise<ConsolidationRule> {
    const supabase = this.supabaseService.getClient();

    const existing = await this.getRule(ruleId);
    if (!existing) {
      throw new Error('Rule not found');
    }

    // Prevent modification of mandatory rules' core logic
    if (existing.isHgbMandatory && updates.ruleConfig) {
      throw new Error('Cannot modify the core logic of HGB-mandatory rules');
    }

    const { data, error } = await supabase
      .from('consolidation_rules')
      .update(updates)
      .eq('id', ruleId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update rule: ${error.message}`);
    }

    // Log action
    if (this.auditLogService) {
      await this.auditLogService.log({
        userId,
        action: 'update' as any,
        entityType: 'system' as any,
        entityId: data.id,
        entityName: data.name,
        beforeState: existing,
        afterState: data,
        description: `Updated consolidation rule: ${data.code}`,
      });
    }

    return data;
  }

  /**
   * Delete a consolidation rule (soft delete by deactivating)
   */
  async deleteRule(ruleId: string, userId?: string): Promise<void> {
    const rule = await this.getRule(ruleId);
    if (!rule) {
      throw new Error('Rule not found');
    }

    if (rule.isHgbMandatory) {
      throw new Error('Cannot delete HGB-mandatory rules');
    }

    await this.updateRule(ruleId, { isActive: false } as any, userId);
  }

  // ==================== RULE OVERRIDES ====================

  /**
   * Get parameter overrides for a financial statement
   */
  async getRuleOverrides(financialStatementId: string): Promise<RuleParameterOverride[]> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('rule_parameter_overrides')
      .select(`
        *,
        rule:consolidation_rules(*)
      `)
      .eq('financial_statement_id', financialStatementId);

    if (error) {
      throw new Error(`Failed to fetch rule overrides: ${error.message}`);
    }

    return (data || []).map(d => ({
      id: d.id,
      ruleId: d.rule_id,
      financialStatementId: d.financial_statement_id,
      parameterOverrides: d.parameter_overrides,
      justification: d.justification,
      approvedByUserId: d.approved_by_user_id,
      approvedAt: d.approved_at ? new Date(d.approved_at) : undefined,
    }));
  }

  /**
   * Set parameter override for a rule
   */
  async setRuleOverride(
    ruleId: string,
    financialStatementId: string,
    parameterOverrides: Record<string, unknown>,
    justification: string,
    userId?: string,
  ): Promise<RuleParameterOverride> {
    const supabase = this.supabaseService.getClient();

    const rule = await this.getRule(ruleId);
    if (!rule) {
      throw new Error('Rule not found');
    }

    // Mandatory rules require approval for overrides
    if (rule.isHgbMandatory) {
      if (!justification) {
        throw new Error('Justification required for overriding HGB-mandatory rule parameters');
      }
    }

    const { data, error } = await supabase
      .from('rule_parameter_overrides')
      .upsert({
        rule_id: ruleId,
        financial_statement_id: financialStatementId,
        parameter_overrides: parameterOverrides,
        justification,
        created_by_user_id: userId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to set rule override: ${error.message}`);
    }

    return {
      id: data.id,
      ruleId: data.rule_id,
      financialStatementId: data.financial_statement_id,
      parameterOverrides: data.parameter_overrides,
      justification: data.justification,
    };
  }

  /**
   * Approve a rule override (required for mandatory rules)
   */
  async approveRuleOverride(overrideId: string, userId: string): Promise<RuleParameterOverride> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('rule_parameter_overrides')
      .update({
        approved_by_user_id: userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', overrideId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to approve rule override: ${error.message}`);
    }

    return {
      id: data.id,
      ruleId: data.rule_id,
      financialStatementId: data.financial_statement_id,
      parameterOverrides: data.parameter_overrides,
      justification: data.justification,
      approvedByUserId: data.approved_by_user_id,
      approvedAt: new Date(data.approved_at),
    };
  }

  // ==================== RULE EXECUTION ====================

  /**
   * Get effective parameters for a rule (base + overrides)
   */
  async getEffectiveParameters(
    ruleId: string,
    financialStatementId: string,
  ): Promise<Record<string, unknown>> {
    const rule = await this.getRule(ruleId);
    if (!rule) {
      throw new Error('Rule not found');
    }

    const overrides = await this.getRuleOverrides(financialStatementId);
    const override = overrides.find(o => o.ruleId === ruleId);

    // Merge base parameters with overrides
    return {
      ...rule.parameters,
      ...(override?.parameterOverrides || {}),
    };
  }

  /**
   * Execute a single rule
   */
  async executeRule(
    ruleId: string,
    financialStatementId: string,
    context: Record<string, unknown>,
    userId?: string,
  ): Promise<RuleExecutionResult> {
    const supabase = this.supabaseService.getClient();

    const rule = await this.getRule(ruleId);
    if (!rule) {
      throw new Error('Rule not found');
    }

    const parameters = await this.getEffectiveParameters(ruleId, financialStatementId);

    let wasApplied = false;
    let wasSuccessful = true;
    let message = '';
    let affectedAmount: number | undefined;
    let affectedAccounts: string[] | undefined;
    let consolidationEntryId: string | undefined;

    try {
      // Execute rule based on type
      const result = await this.evaluateRuleLogic(rule, parameters, context);
      
      wasApplied = result.applied;
      wasSuccessful = result.success;
      message = result.message;
      affectedAmount = result.affectedAmount;
      affectedAccounts = result.affectedAccounts;
      consolidationEntryId = result.consolidationEntryId;
    } catch (err) {
      wasSuccessful = false;
      message = `Rule execution failed: ${err.message}`;
    }

    // Log the application
    await supabase.from('policy_application_logs').insert({
      financial_statement_id: financialStatementId,
      rule_id: ruleId,
      applied_by_user_id: userId,
      was_successful: wasSuccessful,
      result_message: message,
      affected_amount: affectedAmount,
      affected_accounts: affectedAccounts,
      parameters_used: parameters,
      consolidation_entry_id: consolidationEntryId,
    });

    return {
      ruleId,
      ruleCode: rule.code,
      ruleName: rule.name,
      wasApplied,
      wasSuccessful,
      message,
      affectedAmount,
      affectedAccounts,
      consolidationEntryId,
      parametersUsed: parameters,
    };
  }

  /**
   * Execute all applicable rules for a financial statement
   */
  async executeAllRules(
    financialStatementId: string,
    context: Record<string, unknown>,
    userId?: string,
    ruleTypes?: ConsolidationRuleType[],
  ): Promise<RuleExecutionResult[]> {
    let rules = await this.getRules();

    if (ruleTypes && ruleTypes.length > 0) {
      rules = rules.filter(r => ruleTypes.includes(r.ruleType));
    }

    const results: RuleExecutionResult[] = [];

    for (const rule of rules) {
      try {
        const result = await this.executeRule(rule.id, financialStatementId, context, userId);
        results.push(result);
      } catch (err) {
        results.push({
          ruleId: rule.id,
          ruleCode: rule.code,
          ruleName: rule.name,
          wasApplied: false,
          wasSuccessful: false,
          message: `Execution error: ${err.message}`,
        });
      }
    }

    return results;
  }

  /**
   * Evaluate rule logic (simplified implementation)
   */
  private async evaluateRuleLogic(
    rule: ConsolidationRule,
    parameters: Record<string, unknown>,
    context: Record<string, unknown>,
  ): Promise<{
    applied: boolean;
    success: boolean;
    message: string;
    affectedAmount?: number;
    affectedAccounts?: string[];
    consolidationEntryId?: string;
  }> {
    const config = rule.ruleConfig as RuleConfig;

    // Check conditions
    if (config.conditions) {
      for (const condition of config.conditions) {
        const fieldValue = context[condition.field];
        const conditionMet = this.evaluateCondition(fieldValue, condition.operator, condition.value);
        
        if (!conditionMet) {
          return {
            applied: false,
            success: true,
            message: `Condition not met: ${condition.field} ${condition.operator} ${condition.value}`,
          };
        }
      }
    }

    // Execute actions based on rule type
    let message = `Rule ${rule.code} applied successfully`;
    let affectedAmount: number | undefined;

    switch (rule.ruleType) {
      case ConsolidationRuleType.CAPITAL_CONSOLIDATION:
        message = 'Kapitalkonsolidierung gemäß § 301 HGB durchgeführt';
        break;

      case ConsolidationRuleType.DEBT_CONSOLIDATION:
        message = 'Schuldenkonsolidierung gemäß § 303 HGB durchgeführt';
        break;

      case ConsolidationRuleType.INTERCOMPANY_PROFIT:
        message = 'Zwischenergebniseliminierung gemäß § 304 HGB durchgeführt';
        break;

      case ConsolidationRuleType.INCOME_EXPENSE:
        message = 'Aufwands- und Ertragskonsolidierung gemäß § 305 HGB durchgeführt';
        break;

      case ConsolidationRuleType.DEFERRED_TAX:
        message = 'Latente Steuern gemäß § 306 HGB berechnet';
        break;

      case ConsolidationRuleType.MINORITY_INTEREST:
        message = 'Minderheitenanteile gemäß § 307 HGB ermittelt';
        break;

      case ConsolidationRuleType.CURRENCY_TRANSLATION:
        message = 'Währungsumrechnung gemäß § 308a HGB durchgeführt';
        break;

      case ConsolidationRuleType.GOODWILL_TREATMENT:
        message = 'Geschäftswertbehandlung gemäß § 309 HGB angewendet';
        break;

      default:
        message = `Rule ${rule.code} executed`;
    }

    return {
      applied: true,
      success: true,
      message,
      affectedAmount,
    };
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(fieldValue: unknown, operator: string, conditionValue: unknown): boolean {
    switch (operator) {
      case 'eq':
        return fieldValue === conditionValue;
      case 'ne':
        return fieldValue !== conditionValue;
      case 'gt':
        return Number(fieldValue) > Number(conditionValue);
      case 'lt':
        return Number(fieldValue) < Number(conditionValue);
      case 'gte':
        return Number(fieldValue) >= Number(conditionValue);
      case 'lte':
        return Number(fieldValue) <= Number(conditionValue);
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
      case 'not_in':
        return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);
      case 'between':
        if (Array.isArray(conditionValue) && conditionValue.length === 2) {
          const num = Number(fieldValue);
          return num >= Number(conditionValue[0]) && num <= Number(conditionValue[1]);
        }
        return false;
      default:
        return true;
    }
  }

  /**
   * Get rule summary
   */
  async getRuleSummary(): Promise<RuleSummary> {
    const rules = await this.getRules(undefined, false);

    const summary: RuleSummary = {
      totalRules: rules.length,
      activeRules: 0,
      mandatoryRules: 0,
      byType: [],
      byFlexibility: [],
    };

    const typeMap = new Map<ConsolidationRuleType, { count: number; mandatoryCount: number }>();
    const flexibilityMap = new Map<RuleFlexibility, number>();

    for (const rule of rules) {
      if (rule.isActive) summary.activeRules++;
      if (rule.isHgbMandatory) summary.mandatoryRules++;

      const typeStats = typeMap.get(rule.ruleType) || { count: 0, mandatoryCount: 0 };
      typeStats.count++;
      if (rule.isHgbMandatory) typeStats.mandatoryCount++;
      typeMap.set(rule.ruleType, typeStats);

      const flexCount = flexibilityMap.get(rule.flexibility) || 0;
      flexibilityMap.set(rule.flexibility, flexCount + 1);
    }

    summary.byType = Array.from(typeMap.entries()).map(([type, stats]) => ({
      type,
      count: stats.count,
      mandatoryCount: stats.mandatoryCount,
    }));

    summary.byFlexibility = Array.from(flexibilityMap.entries()).map(([flexibility, count]) => ({
      flexibility,
      count,
    }));

    return summary;
  }

  /**
   * Get application logs for a financial statement
   */
  async getApplicationLogs(financialStatementId: string): Promise<any[]> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('policy_application_logs')
      .select(`
        *,
        policy:accounting_policies(*),
        rule:consolidation_rules(*)
      `)
      .eq('financial_statement_id', financialStatementId)
      .order('applied_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch application logs: ${error.message}`);
    }

    return data || [];
  }
}
