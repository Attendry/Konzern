import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { FinancialStatement } from './financial-statement.entity';
import { Company } from './company.entity';
import { PlausibilityRuleCategory } from './plausibility-rule.entity';

// Exception Status
export enum ExceptionStatus {
  OPEN = 'open',
  IN_REVIEW = 'in_review',
  RESOLVED = 'resolved',
  ESCALATED = 'escalated',
  WAIVED = 'waived',
  CLOSED = 'closed',
}

// Exception Priority
export enum ExceptionPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

// Exception Source Type
export enum ExceptionSourceType {
  PLAUSIBILITY_CHECK = 'plausibility_check',
  VARIANCE_ANALYSIS = 'variance_analysis',
  VALIDATION_ERROR = 'validation_error',
  MANUAL = 'manual',
}

// Resolution Type
export enum ExceptionResolutionType {
  CORRECTION = 'correction',
  ADJUSTMENT = 'adjustment',
  WAIVER = 'waiver',
  EXPLANATION = 'explanation',
}

// Action Log Entry
export interface ExceptionActionLog {
  timestamp: string;
  userId?: string;
  userName?: string;
  action: string;
  details?: string;
  oldStatus?: ExceptionStatus;
  newStatus?: ExceptionStatus;
}

@Entity('exception_reports')
export class ExceptionReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'financial_statement_id' })
  financialStatementId: string;

  @ManyToOne(() => FinancialStatement)
  @JoinColumn({ name: 'financial_statement_id' })
  financialStatement: FinancialStatement;

  @Column({ type: 'uuid', name: 'company_id', nullable: true })
  companyId: string | null;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company: Company | null;

  // Source
  @Column({ type: 'varchar', length: 50, name: 'source_type' })
  sourceType: string;

  @Column({ type: 'uuid', name: 'source_id', nullable: true })
  sourceId: string | null;

  // Exception Details
  @Column({ type: 'varchar', length: 50, name: 'exception_code' })
  exceptionCode: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Classification
  @Column({
    type: 'enum',
    enum: PlausibilityRuleCategory,
    nullable: true,
  })
  category: PlausibilityRuleCategory | null;

  @Column({
    type: 'enum',
    enum: ExceptionPriority,
    name: 'priority',
    default: ExceptionPriority.MEDIUM,
  })
  priority: ExceptionPriority;

  @Column({
    type: 'enum',
    enum: ExceptionStatus,
    name: 'status',
    default: ExceptionStatus.OPEN,
  })
  status: ExceptionStatus;

  // Impact
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    name: 'impact_amount',
    nullable: true,
  })
  impactAmount: number | null;

  @Column({ type: 'text', name: 'impact_description', nullable: true })
  impactDescription: string | null;

  @Column({ type: 'boolean', name: 'affects_disclosure', default: false })
  affectsDisclosure: boolean;

  @Column({ type: 'boolean', name: 'affects_audit_opinion', default: false })
  affectsAuditOpinion: boolean;

  // Assignment
  @Column({ type: 'uuid', name: 'assigned_to_user_id', nullable: true })
  assignedToUserId: string | null;

  @Column({ type: 'timestamp', name: 'assigned_at', nullable: true })
  assignedAt: Date | null;

  @Column({ type: 'uuid', name: 'assigned_by_user_id', nullable: true })
  assignedByUserId: string | null;

  // Resolution
  @Column({ type: 'text', nullable: true })
  resolution: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'resolution_type',
    nullable: true,
  })
  resolutionType: string | null;

  @Column({ type: 'timestamp', name: 'resolved_at', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'uuid', name: 'resolved_by_user_id', nullable: true })
  resolvedByUserId: string | null;

  // Escalation
  @Column({ type: 'timestamp', name: 'escalated_at', nullable: true })
  escalatedAt: Date | null;

  @Column({ type: 'uuid', name: 'escalated_to_user_id', nullable: true })
  escalatedToUserId: string | null;

  @Column({ type: 'text', name: 'escalation_reason', nullable: true })
  escalationReason: string | null;

  // Audit Trail
  @Column({ type: 'jsonb', name: 'action_log', default: [] })
  actionLog: ExceptionActionLog[];

  // Due Date
  @Column({ type: 'date', name: 'due_date', nullable: true })
  dueDate: Date | null;

  // HGB Reference
  @Column({
    type: 'varchar',
    length: 100,
    name: 'hgb_reference',
    nullable: true,
  })
  hgbReference: string | null;

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
