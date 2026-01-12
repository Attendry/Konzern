import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

// Rate type for different purposes
export enum RateType {
  SPOT = 'spot',           // Stichtagskurs (balance sheet)
  AVERAGE = 'average',     // Durchschnittskurs (income statement)
  HISTORICAL = 'historical', // Historischer Kurs (equity items)
}

// Source of the exchange rate
export enum RateSource {
  ECB = 'ecb',             // European Central Bank
  BUNDESBANK = 'bundesbank', // Deutsche Bundesbank
  MANUAL = 'manual',       // Manual entry
  IMPORT = 'import',       // Imported from file
}

@Entity('exchange_rates')
@Index(['fromCurrency', 'toCurrency', 'rateDate', 'rateType'], { unique: true })
export class ExchangeRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Source currency (e.g., USD)
  @Column({ type: 'varchar', length: 3, name: 'from_currency' })
  fromCurrency: string;

  // Target currency (e.g., EUR)
  @Column({ type: 'varchar', length: 3, name: 'to_currency' })
  toCurrency: string;

  // Date of the rate
  @Column({ type: 'date', name: 'rate_date' })
  rateDate: Date;

  // Exchange rate value
  @Column({ type: 'decimal', precision: 18, scale: 8, name: 'rate' })
  rate: number;

  // Type of rate
  @Column({
    type: 'varchar',
    length: 15,
    name: 'rate_type',
    default: 'spot',
  })
  rateType: RateType;

  // Source of the rate
  @Column({
    type: 'varchar',
    length: 15,
    name: 'rate_source',
    default: 'manual',
  })
  rateSource: RateSource;

  // Fiscal year this rate belongs to (for average rates)
  @Column({ type: 'integer', nullable: true, name: 'fiscal_year' })
  fiscalYear: number | null;

  // Month (for monthly average rates)
  @Column({ type: 'integer', nullable: true, name: 'fiscal_month' })
  fiscalMonth: number | null;

  // Notes
  @Column({ type: 'text', nullable: true, name: 'notes' })
  notes: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}

// Currency translation difference tracking
@Entity('currency_translation_differences')
export class CurrencyTranslationDifference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Company being translated
  @Column({ type: 'uuid', name: 'company_id' })
  companyId: string;

  // Financial statement
  @Column({ type: 'uuid', name: 'financial_statement_id' })
  financialStatementId: string;

  // Fiscal year
  @Column({ type: 'integer', name: 'fiscal_year' })
  fiscalYear: number;

  // Source currency
  @Column({ type: 'varchar', length: 3, name: 'source_currency' })
  sourceCurrency: string;

  // Target currency
  @Column({ type: 'varchar', length: 3, name: 'target_currency' })
  targetCurrency: string;

  // Rates used
  @Column({ type: 'decimal', precision: 18, scale: 8, name: 'spot_rate' })
  spotRate: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, name: 'average_rate' })
  averageRate: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true, name: 'historical_rate' })
  historicalRate: number | null;

  // Translation difference amounts
  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'balance_sheet_difference' })
  balanceSheetDifference: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'income_statement_difference' })
  incomeStatementDifference: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'equity_difference' })
  equityDifference: number;

  // Total translation difference
  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'total_difference' })
  totalDifference: number;

  // Cumulative translation difference (since first consolidation)
  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'cumulative_difference' })
  cumulativeDifference: number;

  // Reference to consolidation entry
  @Column({ type: 'uuid', nullable: true, name: 'consolidation_entry_id' })
  consolidationEntryId: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}
