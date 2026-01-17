import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Company } from './company.entity';
import { FinancialStatement } from './financial-statement.entity';

// Option Type
export enum WahlrechtOptionType {
  RECOGNITION = 'recognition',
  MEASUREMENT = 'measurement',
  PRESENTATION = 'presentation',
}

// Available Option Interface
export interface WahlrechtOption {
  value: string;
  label: string;
  description?: string;
  hgbReference?: string;
}

@Entity('hgb_wahlrechte')
export class HgbWahlrecht {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // HGB Reference
  @Column({ type: 'varchar', length: 100, name: 'hgb_reference' })
  hgbReference: string;

  @Column({ type: 'text', name: 'hgb_section', nullable: true })
  hgbSection: string | null;

  // Options
  @Column({ type: 'varchar', length: 50, name: 'option_type' })
  optionType: string;

  @Column({ type: 'jsonb', name: 'available_options' })
  availableOptions: WahlrechtOption[];

  @Column({
    type: 'varchar',
    length: 100,
    name: 'default_option',
    nullable: true,
  })
  defaultOption: string | null;

  // Restrictions
  @Column({ type: 'boolean', name: 'once_chosen_binding', default: false })
  onceChosenBinding: boolean;

  @Column({
    type: 'boolean',
    name: 'change_requires_disclosure',
    default: true,
  })
  changeRequiresDisclosure: boolean;

  // Documentation
  @Column({
    type: 'varchar',
    length: 100,
    name: 'ifrs_equivalent',
    nullable: true,
  })
  ifrsEquivalent: string | null;

  @Column({ type: 'text', name: 'differences_to_ifrs', nullable: true })
  differencesToIfrs: string | null;

  // Status
  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

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

@Entity('wahlrechte_selections')
export class WahlrechtSelection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'wahlrecht_id' })
  wahlrechtId: string;

  @ManyToOne(() => HgbWahlrecht)
  @JoinColumn({ name: 'wahlrecht_id' })
  wahlrecht: HgbWahlrecht;

  @Column({ type: 'uuid', name: 'company_id', nullable: true })
  companyId: string | null;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company: Company | null;

  @Column({ type: 'uuid', name: 'financial_statement_id', nullable: true })
  financialStatementId: string | null;

  @ManyToOne(() => FinancialStatement)
  @JoinColumn({ name: 'financial_statement_id' })
  financialStatement: FinancialStatement | null;

  // Selection
  @Column({ type: 'varchar', length: 100, name: 'selected_option' })
  selectedOption: string;

  @Column({ type: 'text', name: 'selection_reason', nullable: true })
  selectionReason: string | null;

  // Effective Period
  @Column({ type: 'date', name: 'effective_from' })
  effectiveFrom: Date;

  @Column({ type: 'date', name: 'effective_until', nullable: true })
  effectiveUntil: Date | null;

  // Approval
  @Column({ type: 'uuid', name: 'approved_by_user_id', nullable: true })
  approvedByUserId: string | null;

  @Column({ type: 'timestamp', name: 'approved_at', nullable: true })
  approvedAt: Date | null;

  // Audit
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
