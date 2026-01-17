import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Company } from './company.entity';
import { Account } from './account.entity';
import { FinancialStatement } from './financial-statement.entity';

// Status of IC reconciliation
export enum ICReconciliationStatus {
  OPEN = 'open', // Difference not resolved
  EXPLAINED = 'explained', // Difference explained/documented
  CLEARED = 'cleared', // Cleared with adjustment entry
  ACCEPTED = 'accepted', // Accepted as immaterial
}

// Reason for IC difference
export enum ICDifferenceReason {
  TIMING = 'timing', // Transaction in transit
  CURRENCY = 'currency', // Exchange rate differences
  BOOKING_ERROR = 'booking_error', // Booking error by one party
  MISSING_ENTRY = 'missing_entry', // Entry missing on one side
  DIFFERENT_VALUATION = 'different_valuation', // Different valuation methods
  INTERCOMPANY_PROFIT = 'intercompany_profit', // Unrealized IC profit
  OTHER = 'other',
}

@Entity('ic_reconciliations')
export class ICReconciliation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'financial_statement_id' })
  financialStatementId: string;

  @ManyToOne(() => FinancialStatement)
  @JoinColumn({ name: 'financial_statement_id' })
  financialStatement: FinancialStatement;

  // Company with the receivable/asset
  @Column({ type: 'uuid', name: 'company_a_id' })
  companyAId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_a_id' })
  companyA: Company;

  // Company with the payable/liability
  @Column({ type: 'uuid', name: 'company_b_id' })
  companyBId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_b_id' })
  companyB: Company;

  // Account at Company A
  @Column({ type: 'uuid', name: 'account_a_id' })
  accountAId: string;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'account_a_id' })
  accountA: Account;

  // Account at Company B
  @Column({ type: 'uuid', name: 'account_b_id' })
  accountBId: string;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'account_b_id' })
  accountB: Account;

  // Balance at Company A (e.g., receivable)
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    name: 'amount_company_a',
  })
  amountCompanyA: number;

  // Balance at Company B (e.g., payable)
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    name: 'amount_company_b',
  })
  amountCompanyB: number;

  // Calculated difference
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    name: 'difference_amount',
  })
  differenceAmount: number;

  @Column({
    type: 'enum',
    enum: ICReconciliationStatus,
    name: 'status',
    default: ICReconciliationStatus.OPEN,
  })
  status: ICReconciliationStatus;

  @Column({
    type: 'enum',
    enum: ICDifferenceReason,
    name: 'difference_reason',
    nullable: true,
  })
  differenceReason: ICDifferenceReason | null;

  // Explanation for the difference
  @Column({ type: 'text', nullable: true, name: 'explanation' })
  explanation: string | null;

  // Reference to clearing entry if created
  @Column({ type: 'uuid', nullable: true, name: 'clearing_entry_id' })
  clearingEntryId: string | null;

  // User who resolved the difference
  @Column({ type: 'uuid', nullable: true, name: 'resolved_by_user_id' })
  resolvedByUserId: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'resolved_at' })
  resolvedAt: Date | null;

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
