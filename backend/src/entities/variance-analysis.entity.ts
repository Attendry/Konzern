import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { FinancialStatement } from './financial-statement.entity';
import { Company } from './company.entity';

// Variance Type
export enum VarianceType {
  ABSOLUTE = 'absolute',
  PERCENTAGE = 'percentage',
  BOTH = 'both',
}

// Variance Significance
export enum VarianceSignificance {
  MATERIAL = 'material',
  SIGNIFICANT = 'significant',
  MINOR = 'minor',
  IMMATERIAL = 'immaterial',
}

// Explanation Category
export enum VarianceExplanationCategory {
  BUSINESS_ACTIVITY = 'business_activity',
  ACCOUNTING_CHANGE = 'accounting_change',
  CONSOLIDATION_CIRCLE = 'consolidation_circle',
  ONE_TIME = 'one_time',
  CURRENCY = 'currency',
  OTHER = 'other',
}

@Entity('variance_analyses')
export class VarianceAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'financial_statement_id' })
  financialStatementId: string;

  @ManyToOne(() => FinancialStatement)
  @JoinColumn({ name: 'financial_statement_id' })
  financialStatement: FinancialStatement;

  @Column({
    type: 'uuid',
    name: 'prior_financial_statement_id',
    nullable: true,
  })
  priorFinancialStatementId: string | null;

  @ManyToOne(() => FinancialStatement)
  @JoinColumn({ name: 'prior_financial_statement_id' })
  priorFinancialStatement: FinancialStatement | null;

  @Column({ type: 'uuid', name: 'company_id', nullable: true })
  companyId: string | null;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company: Company | null;

  // Variance Type
  @Column({
    type: 'enum',
    enum: VarianceType,
    name: 'variance_type',
    default: VarianceType.BOTH,
  })
  varianceType: VarianceType;

  @Column({ type: 'varchar', length: 50, name: 'analysis_level' })
  analysisLevel: string; // 'total', 'company', 'account', 'line_item'

  // Identification
  @Column({
    type: 'varchar',
    length: 50,
    name: 'account_number',
    nullable: true,
  })
  accountNumber: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'account_name',
    nullable: true,
  })
  accountName: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'line_item_code',
    nullable: true,
  })
  lineItemCode: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'line_item_name',
    nullable: true,
  })
  lineItemName: string | null;

  // Current Period Values
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    name: 'current_period_value',
    default: 0,
  })
  currentPeriodValue: number;

  @Column({ type: 'int', name: 'current_period_year' })
  currentPeriodYear: number;

  // Prior Period Values
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    name: 'prior_period_value',
    default: 0,
  })
  priorPeriodValue: number;

  @Column({ type: 'int', name: 'prior_period_year', nullable: true })
  priorPeriodYear: number | null;

  // Variance Calculations
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    name: 'absolute_variance',
    default: 0,
  })
  absoluteVariance: number;

  @Column({
    type: 'decimal',
    precision: 8,
    scale: 4,
    name: 'percentage_variance',
    default: 0,
  })
  percentageVariance: number;

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

  // Significance
  @Column({
    type: 'enum',
    enum: VarianceSignificance,
    name: 'significance',
    default: VarianceSignificance.IMMATERIAL,
  })
  significance: VarianceSignificance;

  @Column({ type: 'boolean', name: 'is_material', default: false })
  isMaterial: boolean;

  // Explanation
  @Column({ type: 'text', nullable: true })
  explanation: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'explanation_category',
    nullable: true,
  })
  explanationCategory: string | null;

  @Column({ type: 'uuid', name: 'explained_by_user_id', nullable: true })
  explainedByUserId: string | null;

  @Column({ type: 'timestamp', name: 'explained_at', nullable: true })
  explainedAt: Date | null;

  // Review
  @Column({ type: 'uuid', name: 'reviewed_by_user_id', nullable: true })
  reviewedByUserId: string | null;

  @Column({ type: 'timestamp', name: 'reviewed_at', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'text', name: 'review_comment', nullable: true })
  reviewComment: string | null;

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
