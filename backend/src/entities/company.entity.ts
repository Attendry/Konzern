import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { FinancialStatement } from './financial-statement.entity';

// Consolidation method according to HGB
export enum ConsolidationType {
  FULL = 'full', // Vollkonsolidierung (§ 301 HGB)
  PROPORTIONAL = 'proportional', // Quotenkonsolidierung (§ 310 HGB)
  EQUITY = 'equity', // Equity-Methode (§ 311-312 HGB)
  NONE = 'none', // Nicht konsolidiert
}

// Reason for exclusion from consolidation (§ 296 HGB)
export enum ExclusionReason {
  MATERIALITY = 'materiality', // Unwesentlichkeit
  TEMPORARY_CONTROL = 'temporary_control', // Vorübergehende Beherrschung
  SEVERE_RESTRICTIONS = 'severe_restrictions', // Schwerwiegende Beschränkungen
  DISPROPORTIONATE_COST = 'disproportionate_cost', // Unverhältnismäßig hohe Kosten
  DIFFERENT_ACTIVITY = 'different_activity', // Wesentlich abweichende Tätigkeit
  NONE = 'none',
}

// Functional currency for the company
export enum Currency {
  EUR = 'EUR',
  USD = 'USD',
  GBP = 'GBP',
  CHF = 'CHF',
  PLN = 'PLN',
  CZK = 'CZK',
  SEK = 'SEK',
  DKK = 'DKK',
  NOK = 'NOK',
  HUF = 'HUF',
  RON = 'RON',
  BGN = 'BGN',
  HRK = 'HRK',
  JPY = 'JPY',
  CNY = 'CNY',
  OTHER = 'OTHER',
}

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, name: 'name' })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'tax_id' })
  taxId: string;

  @Column({ type: 'text', nullable: true, name: 'address' })
  address: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'legal_form' })
  legalForm: string;

  @Column({ type: 'uuid', nullable: true, name: 'parent_company_id' })
  parentCompanyId: string | null;

  @ManyToOne(() => Company, (company) => company.children, { nullable: true })
  @JoinColumn({ name: 'parent_company_id' })
  parentCompany: Company | null;

  @OneToMany(() => Company, (company) => company.parentCompany)
  children: Company[];

  @Column({ type: 'boolean', default: true, name: 'is_consolidated' })
  isConsolidated: boolean;

  // NEW: Consolidation type
  @Column({
    type: 'varchar',
    length: 20,
    name: 'consolidation_type',
    default: 'full',
  })
  consolidationType: ConsolidationType;

  // NEW: Reason for exclusion (if not consolidated)
  @Column({
    type: 'varchar',
    length: 30,
    name: 'exclusion_reason',
    nullable: true,
  })
  exclusionReason: ExclusionReason | null;

  // NEW: First consolidation date (Erstkonsolidierung)
  @Column({ type: 'date', nullable: true, name: 'first_consolidation_date' })
  firstConsolidationDate: Date | null;

  // NEW: Deconsolidation date (Entkonsolidierung)
  @Column({ type: 'date', nullable: true, name: 'deconsolidation_date' })
  deconsolidationDate: Date | null;

  // NEW: Functional currency
  @Column({
    type: 'varchar',
    length: 5,
    name: 'functional_currency',
    default: 'EUR',
  })
  functionalCurrency: Currency;

  // NEW: Country code (ISO 3166-1 alpha-2)
  @Column({ type: 'varchar', length: 2, nullable: true, name: 'country_code' })
  countryCode: string | null;

  // NEW: Industry/sector classification
  @Column({ type: 'varchar', length: 100, nullable: true, name: 'industry' })
  industry: string | null;

  // NEW: Fiscal year end (month, 1-12)
  @Column({ type: 'integer', name: 'fiscal_year_end_month', default: 12 })
  fiscalYearEndMonth: number;

  // NEW: Notes about the company
  @Column({ type: 'text', nullable: true, name: 'notes' })
  notes: string | null;

  // NEW: Is this the ultimate parent (Konzernmutter)?
  @Column({ type: 'boolean', default: false, name: 'is_ultimate_parent' })
  isUltimateParent: boolean;

  @OneToMany(() => FinancialStatement, (fs) => fs.company)
  financialStatements: FinancialStatement[];

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
