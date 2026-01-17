import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

// Rule Category (HGB-specific areas)
export enum PlausibilityRuleCategory {
  BALANCE_SHEET_STRUCTURE = 'balance_sheet_structure',
  INCOME_STATEMENT_STRUCTURE = 'income_statement_structure',
  BALANCE_EQUATION = 'balance_equation',
  INTERCOMPANY_CONSISTENCY = 'intercompany_consistency',
  CAPITAL_CONSOLIDATION = 'capital_consolidation',
  DEBT_CONSOLIDATION = 'debt_consolidation',
  INTERCOMPANY_PROFIT = 'intercompany_profit',
  INCOME_EXPENSE_CONSOLIDATION = 'income_expense_consolidation',
  DEFERRED_TAX = 'deferred_tax',
  CURRENCY_TRANSLATION = 'currency_translation',
  MINORITY_INTEREST = 'minority_interest',
  EQUITY_METHOD = 'equity_method',
  PROPORTIONAL_CONSOLIDATION = 'proportional_consolidation',
  YEAR_OVER_YEAR = 'year_over_year',
  MATERIALITY = 'materiality',
  DISCLOSURE_COMPLETENESS = 'disclosure_completeness',
  CUSTOM = 'custom',
}

// Rule Severity
export enum PlausibilityRuleSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

// Rule Type
export enum PlausibilityRuleType {
  FORMULA = 'formula',
  COMPARISON = 'comparison',
  THRESHOLD = 'threshold',
  CUSTOM = 'custom',
}

@Entity('plausibility_rules')
export class PlausibilityRule {
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
    enum: PlausibilityRuleCategory,
    name: 'category',
  })
  category: PlausibilityRuleCategory;

  @Column({
    type: 'enum',
    enum: PlausibilityRuleSeverity,
    name: 'severity',
    default: PlausibilityRuleSeverity.WARNING,
  })
  severity: PlausibilityRuleSeverity;

  // HGB Reference
  @Column({
    type: 'varchar',
    length: 100,
    name: 'hgb_reference',
    nullable: true,
  })
  hgbReference: string | null;

  @Column({ type: 'text', name: 'hgb_description', nullable: true })
  hgbDescription: string | null;

  // Rule Definition
  @Column({ type: 'varchar', length: 50, name: 'rule_type' })
  ruleType: string;

  @Column({ type: 'text', name: 'rule_expression' })
  ruleExpression: string; // JSON expression defining the rule logic

  // Thresholds
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    name: 'threshold_absolute',
    nullable: true,
  })
  thresholdAbsolute: number | null;

  @Column({
    type: 'decimal',
    precision: 8,
    scale: 4,
    name: 'threshold_percentage',
    nullable: true,
  })
  thresholdPercentage: number | null;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    name: 'tolerance_amount',
    default: 0.01,
  })
  toleranceAmount: number;

  // Applicability
  @Column({
    type: 'text',
    array: true,
    name: 'applies_to_entity_types',
    nullable: true,
  })
  appliesToEntityTypes: string[] | null;

  @Column({
    type: 'text',
    array: true,
    name: 'applies_to_consolidation_types',
    nullable: true,
  })
  appliesToConsolidationTypes: string[] | null;

  @Column({
    type: 'text',
    array: true,
    name: 'applies_to_statement_types',
    nullable: true,
  })
  appliesToStatementTypes: string[] | null;

  // Status
  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', name: 'is_mandatory', default: false })
  isMandatory: boolean;

  @Column({ type: 'boolean', name: 'is_hgb_required', default: false })
  isHgbRequired: boolean;

  // Ordering
  @Column({ type: 'int', name: 'execution_order', default: 100 })
  executionOrder: number;

  // Metadata
  @Column({ type: 'uuid', name: 'created_by_user_id', nullable: true })
  createdByUserId: string | null;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    name: 'created_at',
  })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    name: 'updated_at',
  })
  updatedAt: Date;
}

// Interface for rule expression
export interface RuleExpression {
  type: 'formula' | 'comparison' | 'threshold' | 'custom';
  leftOperand?: string; // Account code, calculated field, or expression
  operator?: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'between' | 'in' | 'not_in';
  rightOperand?: string | number | string[] | number[];
  formula?: string; // For formula type: e.g., "ASSETS = LIABILITIES + EQUITY"
  customFunction?: string; // For custom type: name of the function to call
  parameters?: Record<string, unknown>;
}
