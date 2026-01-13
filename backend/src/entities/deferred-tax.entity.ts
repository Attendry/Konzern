import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Company } from './company.entity';
import { FinancialStatement } from './financial-statement.entity';
import { ConsolidationEntry } from './consolidation-entry.entity';

// Type of temporary difference (§ 306 HGB)
export enum TemporaryDifferenceType {
  // Deductible differences → Deferred Tax Assets
  DEDUCTIBLE = 'deductible',
  // Taxable differences → Deferred Tax Liabilities
  TAXABLE = 'taxable',
}

// Source of the deferred tax (which consolidation step created it)
export enum DeferredTaxSource {
  CAPITAL_CONSOLIDATION = 'capital_consolidation',     // § 301 HGB - Kapitalkonsolidierung
  DEBT_CONSOLIDATION = 'debt_consolidation',           // § 303 HGB - Schuldenkonsolidierung
  INTERCOMPANY_PROFIT = 'intercompany_profit',         // § 304 HGB - Zwischenergebniseliminierung
  INCOME_EXPENSE = 'income_expense',                   // § 305 HGB - Aufwands-/Ertragskonsolidierung
  HIDDEN_RESERVES = 'hidden_reserves',                 // Aufdeckung stiller Reserven
  GOODWILL = 'goodwill',                               // Geschäfts- oder Firmenwert
  PENSION_PROVISIONS = 'pension_provisions',           // Pensionsrückstellungen
  VALUATION_ADJUSTMENT = 'valuation_adjustment',       // Bewertungsanpassung § 308 HGB
  OTHER = 'other',
}

// Status of the deferred tax position
export enum DeferredTaxStatus {
  ACTIVE = 'active',
  REVERSED = 'reversed',
  WRITTEN_OFF = 'written_off',
}

@Entity('deferred_taxes')
export class DeferredTax {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'financial_statement_id' })
  financialStatementId: string;

  @ManyToOne(() => FinancialStatement)
  @JoinColumn({ name: 'financial_statement_id' })
  financialStatement: FinancialStatement;

  @Column({ type: 'uuid', name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  // Type: deductible (aktiv) or taxable (passiv)
  @Column({
    type: 'enum',
    enum: TemporaryDifferenceType,
    name: 'difference_type',
  })
  differenceType: TemporaryDifferenceType;

  // Source of the deferred tax
  @Column({
    type: 'enum',
    enum: DeferredTaxSource,
    name: 'source',
  })
  source: DeferredTaxSource;

  // Description of the temporary difference
  @Column({ type: 'text', name: 'description' })
  description: string;

  // Amount of the temporary difference (base amount)
  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'temporary_difference_amount' })
  temporaryDifferenceAmount: number;

  // Applicable tax rate (%)
  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'tax_rate' })
  taxRate: number;

  // Calculated deferred tax amount (difference * rate)
  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'deferred_tax_amount' })
  deferredTaxAmount: number;

  // Previous year's deferred tax amount (for movement analysis)
  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'prior_year_amount', nullable: true })
  priorYearAmount: number | null;

  // Change in deferred tax (current - prior year)
  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'change_amount', nullable: true })
  changeAmount: number | null;

  // Whether this affects equity (eigenkapitalneutral) or P&L (ergebniswirksam)
  @Column({ type: 'boolean', name: 'affects_equity', default: false })
  affectsEquity: boolean;

  // Expected reversal year
  @Column({ type: 'int', name: 'expected_reversal_year', nullable: true })
  expectedReversalYear: number | null;

  // Reference to the originating consolidation entry
  @Column({ type: 'uuid', name: 'originating_entry_id', nullable: true })
  originatingEntryId: string | null;

  @ManyToOne(() => ConsolidationEntry)
  @JoinColumn({ name: 'originating_entry_id' })
  originatingEntry: ConsolidationEntry | null;

  // Reference to the deferred tax consolidation entry created
  @Column({ type: 'uuid', name: 'deferred_tax_entry_id', nullable: true })
  deferredTaxEntryId: string | null;

  @ManyToOne(() => ConsolidationEntry)
  @JoinColumn({ name: 'deferred_tax_entry_id' })
  deferredTaxEntry: ConsolidationEntry | null;

  // Status
  @Column({
    type: 'enum',
    enum: DeferredTaxStatus,
    name: 'status',
    default: DeferredTaxStatus.ACTIVE,
  })
  status: DeferredTaxStatus;

  // HGB reference note
  @Column({ type: 'text', name: 'hgb_note', nullable: true })
  hgbNote: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}

// Summary interface for deferred tax positions
export interface DeferredTaxSummary {
  totalDeferredTaxAssets: number;
  totalDeferredTaxLiabilities: number;
  netDeferredTax: number;
  changeFromPriorYear: number;
  bySource: {
    source: DeferredTaxSource;
    assets: number;
    liabilities: number;
  }[];
}
