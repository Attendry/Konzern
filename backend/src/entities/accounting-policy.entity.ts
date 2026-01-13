import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

// Policy Category
export enum PolicyCategory {
  VALUATION = 'valuation',
  RECOGNITION = 'recognition',
  CONSOLIDATION = 'consolidation',
  PRESENTATION = 'presentation',
  DISCLOSURE = 'disclosure',
  CURRENCY = 'currency',
  DEFERRED_TAX = 'deferred_tax',
  GOODWILL = 'goodwill',
  DEPRECIATION = 'depreciation',
  PROVISIONS = 'provisions',
  LEASING = 'leasing',
  FINANCIAL_INSTRUMENTS = 'financial_instruments',
  INVENTORY = 'inventory',
  REVENUE = 'revenue',
  OTHER = 'other',
}

// Policy Status
export enum PolicyStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  SUPERSEDED = 'superseded',
  DEPRECATED = 'deprecated',
}

@Entity('accounting_policies')
export class AccountingPolicy {
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
    enum: PolicyCategory,
  })
  category: PolicyCategory;

  // HGB Reference
  @Column({ type: 'varchar', length: 100, name: 'hgb_reference', nullable: true })
  hgbReference: string | null;

  @Column({ type: 'text', name: 'hgb_section', nullable: true })
  hgbSection: string | null;

  @Column({ type: 'boolean', name: 'is_hgb_mandatory', default: false })
  isHgbMandatory: boolean;

  // Policy Details
  @Column({ type: 'text', name: 'policy_text' })
  policyText: string;

  @Column({ type: 'date', name: 'effective_date' })
  effectiveDate: Date;

  @Column({ type: 'date', name: 'expiration_date', nullable: true })
  expirationDate: Date | null;

  // Version Control
  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'uuid', name: 'supersedes_policy_id', nullable: true })
  supersedesPolicyId: string | null;

  @ManyToOne(() => AccountingPolicy)
  @JoinColumn({ name: 'supersedes_policy_id' })
  supersedesPolicy: AccountingPolicy | null;

  // Status
  @Column({
    type: 'enum',
    enum: PolicyStatus,
    default: PolicyStatus.DRAFT,
  })
  status: PolicyStatus;

  // Approval
  @Column({ type: 'uuid', name: 'approved_by_user_id', nullable: true })
  approvedByUserId: string | null;

  @Column({ type: 'timestamp', name: 'approved_at', nullable: true })
  approvedAt: Date | null;

  // Audit
  @Column({ type: 'uuid', name: 'created_by_user_id', nullable: true })
  createdByUserId: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}

// Policy Version Entity
@Entity('policy_versions')
export class PolicyVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'policy_id' })
  policyId: string;

  @ManyToOne(() => AccountingPolicy)
  @JoinColumn({ name: 'policy_id' })
  policy: AccountingPolicy;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'text', name: 'policy_text' })
  policyText: string;

  @Column({ type: 'date', name: 'effective_date' })
  effectiveDate: Date;

  @Column({ type: 'text', name: 'change_reason', nullable: true })
  changeReason: string | null;

  @Column({ type: 'uuid', name: 'changed_by_user_id', nullable: true })
  changedByUserId: string | null;

  @Column({ type: 'timestamp', name: 'changed_at', default: () => 'CURRENT_TIMESTAMP' })
  changedAt: Date;

  @Column({ type: 'uuid', name: 'approved_by_user_id', nullable: true })
  approvedByUserId: string | null;

  @Column({ type: 'timestamp', name: 'approved_at', nullable: true })
  approvedAt: Date | null;
}
