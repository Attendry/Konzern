import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AccountingPolicy } from './accounting-policy.entity';

// Rule Type
export enum ConsolidationRuleType {
  CAPITAL_CONSOLIDATION = 'capital_consolidation',
  DEBT_CONSOLIDATION = 'debt_consolidation',
  INTERCOMPANY_PROFIT = 'intercompany_profit',
  INCOME_EXPENSE = 'income_expense',
  DEFERRED_TAX = 'deferred_tax',
  MINORITY_INTEREST = 'minority_interest',
  UNIFORM_VALUATION = 'uniform_valuation',
  CURRENCY_TRANSLATION = 'currency_translation',
  GOODWILL_TREATMENT = 'goodwill_treatment',
  EQUITY_METHOD = 'equity_method',
  PROPORTIONAL_CONSOLIDATION = 'proportional_consolidation',
  CONSOLIDATION_SCOPE = 'consolidation_scope',
  DISCLOSURE = 'disclosure',
  OTHER = 'other',
}

// Rule Flexibility
export enum RuleFlexibility {
  MANDATORY = 'mandatory',
  RECOMMENDED = 'recommended',
  OPTIONAL = 'optional',
  PROHIBITED = 'prohibited',
}

// Rule Configuration Interface
export interface RuleConfig {
  type: string;
  method?: string;
  calculation?: string;
  conditions?: RuleCondition[];
  actions?: RuleAction[];
  parameters?: Record<string, unknown>;
}

export interface RuleCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not_in' | 'between';
  value: unknown;
}

export interface RuleAction {
  type: 'create_entry' | 'adjust_value' | 'validate' | 'warn' | 'block';
  config: Record<string, unknown>;
}

@Entity('consolidation_rules')
export class ConsolidationRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: ConsolidationRuleType,
    name: 'rule_type',
  })
  ruleType: ConsolidationRuleType;

  // HGB Reference
  @Column({ type: 'varchar', length: 100, name: 'hgb_reference', nullable: true })
  hgbReference: string | null;

  @Column({ type: 'text', name: 'hgb_description', nullable: true })
  hgbDescription: string | null;

  // Rule Configuration
  @Column({
    type: 'enum',
    enum: RuleFlexibility,
    default: RuleFlexibility.RECOMMENDED,
  })
  flexibility: RuleFlexibility;

  @Column({ type: 'boolean', name: 'is_hgb_mandatory', default: false })
  isHgbMandatory: boolean;

  // Rule Logic
  @Column({ type: 'jsonb', name: 'rule_config' })
  ruleConfig: RuleConfig;

  // Parameters
  @Column({ type: 'jsonb', default: {} })
  parameters: Record<string, unknown>;

  // Thresholds
  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'threshold_amount', nullable: true })
  thresholdAmount: number | null;

  @Column({ type: 'decimal', precision: 8, scale: 4, name: 'threshold_percentage', nullable: true })
  thresholdPercentage: number | null;

  // Applicability
  @Column({ type: 'text', array: true, name: 'applies_to_entity_types', nullable: true })
  appliesToEntityTypes: string[] | null;

  @Column({ type: 'text', array: true, name: 'applies_to_industries', nullable: true })
  appliesToIndustries: string[] | null;

  // Ordering
  @Column({ type: 'int', name: 'execution_order', default: 100 })
  executionOrder: number;

  // Status
  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  // Related Policy
  @Column({ type: 'uuid', name: 'policy_id', nullable: true })
  policyId: string | null;

  @ManyToOne(() => AccountingPolicy)
  @JoinColumn({ name: 'policy_id' })
  policy: AccountingPolicy | null;

  // Audit
  @Column({ type: 'uuid', name: 'created_by_user_id', nullable: true })
  createdByUserId: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}
