import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Company } from './company.entity';

// Type of ownership change
export enum OwnershipChangeType {
  INITIAL = 'initial',       // Initial acquisition
  INCREASE = 'increase',     // Additional acquisition
  DECREASE = 'decrease',     // Partial sale
  FULL_SALE = 'full_sale',   // Complete divestiture
  MERGER = 'merger',         // Merger/amalgamation
  DEMERGER = 'demerger',     // Spin-off/demerger
}

@Entity('participations')
export class Participation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'parent_company_id' })
  parentCompanyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'parent_company_id' })
  parentCompany: Company;

  @Column({ type: 'uuid', name: 'subsidiary_company_id' })
  subsidiaryCompanyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'subsidiary_company_id' })
  subsidiaryCompany: Company;

  // Current participation percentage
  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'participation_percentage' })
  participationPercentage: number;

  // Voting rights percentage (may differ from capital share)
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'voting_rights_percentage' })
  votingRightsPercentage: number | null;

  // Total acquisition cost (historical)
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true, name: 'acquisition_cost' })
  acquisitionCost: number | null;

  // Date of initial acquisition
  @Column({ type: 'date', nullable: true, name: 'acquisition_date' })
  acquisitionDate: Date | null;

  // NEW: Goodwill from acquisition (Geschäfts- oder Firmenwert)
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true, name: 'goodwill' })
  goodwill: number | null;

  // NEW: Negative goodwill (Unterschiedsbetrag passivisch)
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true, name: 'negative_goodwill' })
  negativeGoodwill: number | null;

  // NEW: Hidden reserves at acquisition (Stille Reserven)
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true, name: 'hidden_reserves' })
  hiddenReserves: number | null;

  // NEW: Hidden liabilities at acquisition (Stille Lasten)
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true, name: 'hidden_liabilities' })
  hiddenLiabilities: number | null;

  // NEW: Equity at acquisition date
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true, name: 'equity_at_acquisition' })
  equityAtAcquisition: number | null;

  // NEW: Is this a direct or indirect holding?
  @Column({ type: 'boolean', default: true, name: 'is_direct' })
  isDirect: boolean;

  // NEW: Intermediate holding company (for indirect participations)
  @Column({ type: 'uuid', nullable: true, name: 'through_company_id' })
  throughCompanyId: string | null;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'through_company_id' })
  throughCompany: Company | null;

  // NEW: Is this participation currently active?
  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  // NEW: Sale/disposal date (if no longer held)
  @Column({ type: 'date', nullable: true, name: 'disposal_date' })
  disposalDate: Date | null;

  // NEW: Sale proceeds (if disposed)
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true, name: 'disposal_proceeds' })
  disposalProceeds: number | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}

// NEW: Ownership history entity for tracking changes over time
@Entity('ownership_history')
export class OwnershipHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'participation_id' })
  participationId: string;

  @ManyToOne(() => Participation)
  @JoinColumn({ name: 'participation_id' })
  participation: Participation;

  // Type of change
  @Column({
    type: 'varchar',
    length: 20,
    name: 'change_type',
  })
  changeType: OwnershipChangeType;

  // Date of change
  @Column({ type: 'date', name: 'effective_date' })
  effectiveDate: Date;

  // Percentage before change
  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'percentage_before' })
  percentageBefore: number;

  // Percentage after change
  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'percentage_after' })
  percentageAfter: number;

  // Change in percentage
  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'percentage_change' })
  percentageChange: number;

  // Transaction amount
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true, name: 'transaction_amount' })
  transactionAmount: number | null;

  // Goodwill/badwill from this transaction
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true, name: 'goodwill_change' })
  goodwillChange: number | null;

  // Description/reason for change
  @Column({ type: 'text', nullable: true, name: 'description' })
  description: string | null;

  // Reference to consolidation entry created
  @Column({ type: 'uuid', nullable: true, name: 'consolidation_entry_id' })
  consolidationEntryId: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;
}
