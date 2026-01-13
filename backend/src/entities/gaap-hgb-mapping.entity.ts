import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AccountingPolicy } from './accounting-policy.entity';

// GAAP Standard
export enum GaapStandard {
  HGB = 'hgb',
  IFRS = 'ifrs',
  US_GAAP = 'us_gaap',
  LOCAL_GAAP = 'local_gaap',
  OTHER = 'other',
}

// Mapping Direction
export enum MappingDirection {
  SOURCE_TO_HGB = 'source_to_hgb',
  HGB_TO_SOURCE = 'hgb_to_source',
}

// Adjustment Type
export enum GaapAdjustmentType {
  RECOGNITION = 'recognition',
  MEASUREMENT = 'measurement',
  PRESENTATION = 'presentation',
  DISCLOSURE = 'disclosure',
  TIMING = 'timing',
  PERMANENT = 'permanent',
  RECLASSIFICATION = 'reclassification',
}

// Adjustment Configuration
export interface AdjustmentConfig {
  type: string;
  method?: string;
  formula?: string;
  debitAccount?: string;
  creditAccount?: string;
  reversing?: boolean;
  deferredTaxRate?: number;
  parameters?: Record<string, unknown>;
}

@Entity('gaap_hgb_mappings')
export class GaapHgbMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Source GAAP
  @Column({
    type: 'enum',
    enum: GaapStandard,
    name: 'source_gaap',
  })
  sourceGaap: GaapStandard;

  @Column({ type: 'varchar', length: 100, name: 'source_gaap_reference', nullable: true })
  sourceGaapReference: string | null;

  @Column({ type: 'text', name: 'source_gaap_description', nullable: true })
  sourceGaapDescription: string | null;

  // Target (HGB)
  @Column({ type: 'varchar', length: 100, name: 'hgb_reference', nullable: true })
  hgbReference: string | null;

  @Column({ type: 'text', name: 'hgb_description', nullable: true })
  hgbDescription: string | null;

  // Mapping Details
  @Column({
    type: 'enum',
    enum: MappingDirection,
    default: MappingDirection.SOURCE_TO_HGB,
  })
  direction: MappingDirection;

  @Column({
    type: 'enum',
    enum: GaapAdjustmentType,
    name: 'adjustment_type',
  })
  adjustmentType: GaapAdjustmentType;

  // Adjustment Configuration
  @Column({ type: 'jsonb', name: 'adjustment_config' })
  adjustmentConfig: AdjustmentConfig;

  // Affects
  @Column({ type: 'boolean', name: 'affects_balance_sheet', default: false })
  affectsBalanceSheet: boolean;

  @Column({ type: 'boolean', name: 'affects_income_statement', default: false })
  affectsIncomeStatement: boolean;

  @Column({ type: 'boolean', name: 'affects_equity', default: false })
  affectsEquity: boolean;

  @Column({ type: 'boolean', name: 'affects_deferred_tax', default: false })
  affectsDeferredTax: boolean;

  // Account Mapping
  @Column({ type: 'text', array: true, name: 'source_accounts', nullable: true })
  sourceAccounts: string[] | null;

  @Column({ type: 'text', array: true, name: 'target_accounts', nullable: true })
  targetAccounts: string[] | null;

  // Status
  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', name: 'is_material', default: false })
  isMaterial: boolean;

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
