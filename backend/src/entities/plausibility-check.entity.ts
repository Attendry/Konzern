import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { FinancialStatement } from './financial-statement.entity';
import { Company } from './company.entity';
import { PlausibilityRule } from './plausibility-rule.entity';

// Check Result Status
export enum PlausibilityCheckStatus {
  PASSED = 'passed',
  FAILED = 'failed',
  WARNING = 'warning',
  SKIPPED = 'skipped',
  ACKNOWLEDGED = 'acknowledged',
  WAIVED = 'waived',
}

@Entity('plausibility_checks')
export class PlausibilityCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'financial_statement_id' })
  financialStatementId: string;

  @ManyToOne(() => FinancialStatement)
  @JoinColumn({ name: 'financial_statement_id' })
  financialStatement: FinancialStatement;

  @Column({ type: 'uuid', name: 'rule_id' })
  ruleId: string;

  @ManyToOne(() => PlausibilityRule)
  @JoinColumn({ name: 'rule_id' })
  rule: PlausibilityRule;

  @Column({ type: 'uuid', name: 'company_id', nullable: true })
  companyId: string | null;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company: Company | null;

  // Execution Details
  @Column({ type: 'timestamp', name: 'executed_at', default: () => 'CURRENT_TIMESTAMP' })
  executedAt: Date;

  @Column({ type: 'uuid', name: 'executed_by_user_id', nullable: true })
  executedByUserId: string | null;

  // Result
  @Column({
    type: 'enum',
    enum: PlausibilityCheckStatus,
    name: 'status',
    default: PlausibilityCheckStatus.PASSED,
  })
  status: PlausibilityCheckStatus;

  // Values
  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'expected_value', nullable: true })
  expectedValue: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'actual_value', nullable: true })
  actualValue: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'difference_value', nullable: true })
  differenceValue: number | null;

  @Column({ type: 'decimal', precision: 8, scale: 4, name: 'difference_percentage', nullable: true })
  differencePercentage: number | null;

  // Context
  @Column({ type: 'jsonb', nullable: true })
  context: Record<string, unknown> | null;

  @Column({ type: 'text', array: true, name: 'affected_accounts', nullable: true })
  affectedAccounts: string[] | null;

  @Column({ type: 'uuid', array: true, name: 'affected_entries', nullable: true })
  affectedEntries: string[] | null;

  // Messages
  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'text', nullable: true })
  details: string | null;

  // Resolution
  @Column({ type: 'timestamp', name: 'acknowledged_at', nullable: true })
  acknowledgedAt: Date | null;

  @Column({ type: 'uuid', name: 'acknowledged_by_user_id', nullable: true })
  acknowledgedByUserId: string | null;

  @Column({ type: 'text', name: 'acknowledgment_comment', nullable: true })
  acknowledgmentComment: string | null;

  @Column({ type: 'timestamp', name: 'waived_at', nullable: true })
  waivedAt: Date | null;

  @Column({ type: 'uuid', name: 'waived_by_user_id', nullable: true })
  waivedByUserId: string | null;

  @Column({ type: 'text', name: 'waiver_reason', nullable: true })
  waiverReason: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}
