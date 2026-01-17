import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Company } from './company.entity';

export enum ConsolidationObligationReason {
  MAJORITY_INTEREST = 'majority_interest',
  UNIFIED_MANAGEMENT = 'unified_management',
  CONTROL_AGREEMENT = 'control_agreement',
  NONE = 'none',
}

export enum ConsolidationException {
  MATERIALITY = 'materiality', // Bedeutungslosigkeit nach § 296
  TEMPORARY_CONTROL = 'temporary_control', // Vorübergehende Beherrschung
  SEVERE_RESTRICTIONS = 'severe_restrictions', // Schwerwiegende Beschränkungen
  DIFFERENT_ACTIVITIES = 'different_activities', // Wesentlich abweichende Tätigkeiten
}

@Entity('consolidation_obligation_checks')
export class ConsolidationObligationCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ type: 'boolean', name: 'is_obligatory' })
  isObligatory: boolean;

  @Column({
    type: 'enum',
    enum: ConsolidationObligationReason,
    name: 'reason',
    nullable: true,
  })
  reason: ConsolidationObligationReason | null;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    name: 'participation_percentage',
  })
  participationPercentage: number | null;

  @Column({ type: 'boolean', nullable: true, name: 'has_unified_management' })
  hasUnifiedManagement: boolean | null;

  @Column({ type: 'boolean', nullable: true, name: 'has_control_agreement' })
  hasControlAgreement: boolean | null;

  @Column({ type: 'text', array: true, nullable: true, name: 'exceptions' })
  exceptions: ConsolidationException[] | null;

  @Column({ type: 'text', nullable: true, name: 'manual_decision_comment' })
  manualDecisionComment: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'checked_by_user_id' })
  checkedByUserId: string | null;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    name: 'checked_at',
  })
  checkedAt: Date;

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
