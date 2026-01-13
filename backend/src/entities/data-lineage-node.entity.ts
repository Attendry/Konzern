import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { FinancialStatement } from './financial-statement.entity';
import { Company } from './company.entity';
import { Account } from './account.entity';
import { ConsolidationEntry } from './consolidation-entry.entity';

// Type of lineage node - what kind of data element
export enum LineageNodeType {
  SOURCE_DATA = 'source_data',
  ACCOUNT_BALANCE = 'account_balance',
  AGGREGATION = 'aggregation',
  INTERCOMPANY_ELIMINATION = 'intercompany_elimination',
  CAPITAL_CONSOLIDATION = 'capital_consolidation',
  DEBT_CONSOLIDATION = 'debt_consolidation',
  CURRENCY_TRANSLATION = 'currency_translation',
  MINORITY_INTEREST = 'minority_interest',
  DEFERRED_TAX = 'deferred_tax',
  CONSOLIDATED_VALUE = 'consolidated_value',
  RECLASSIFICATION = 'reclassification',
  VALUATION_ADJUSTMENT = 'valuation_adjustment',
  PROPORTIONAL_SHARE = 'proportional_share',
  EQUITY_METHOD = 'equity_method',
}

@Entity('data_lineage_nodes')
export class DataLineageNode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Context
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

  // Node identification
  @Column({
    type: 'enum',
    enum: LineageNodeType,
    name: 'node_type',
  })
  nodeType: LineageNodeType;

  @Column({ type: 'varchar', length: 100, name: 'node_code' })
  nodeCode: string;

  @Column({ type: 'varchar', length: 500, name: 'node_name' })
  nodeName: string;

  // Value tracking
  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'value_amount' })
  valueAmount: number;

  @Column({ type: 'varchar', length: 3, name: 'value_currency', default: 'EUR' })
  valueCurrency: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'value_in_group_currency', nullable: true })
  valueInGroupCurrency: number | null;

  // Account reference
  @Column({ type: 'uuid', name: 'account_id', nullable: true })
  accountId: string | null;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'account_id' })
  account: Account | null;

  @Column({ type: 'varchar', length: 50, name: 'account_code', nullable: true })
  accountCode: string | null;

  // Source reference
  @Column({ type: 'varchar', length: 100, name: 'source_entity_type', nullable: true })
  sourceEntityType: string | null;

  @Column({ type: 'uuid', name: 'source_entity_id', nullable: true })
  sourceEntityId: string | null;

  // Consolidation entry reference
  @Column({ type: 'uuid', name: 'consolidation_entry_id', nullable: true })
  consolidationEntryId: string | null;

  @ManyToOne(() => ConsolidationEntry)
  @JoinColumn({ name: 'consolidation_entry_id' })
  consolidationEntry: ConsolidationEntry | null;

  // HGB reference
  @Column({ type: 'varchar', length: 50, name: 'hgb_section', nullable: true })
  hgbSection: string | null;

  // Metadata
  @Column({ type: 'integer', name: 'fiscal_year', nullable: true })
  fiscalYear: number | null;

  @Column({ type: 'varchar', length: 20, name: 'reporting_period', nullable: true })
  reportingPeriod: string | null;

  @Column({ type: 'boolean', name: 'is_audited', default: false })
  isAudited: boolean;

  @Column({ type: 'boolean', name: 'is_final', default: false })
  isFinal: boolean;

  // Timestamps
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}

// Interface for creating a lineage node
export interface CreateLineageNodeDto {
  financialStatementId: string;
  companyId?: string;
  nodeType: LineageNodeType;
  nodeCode: string;
  nodeName: string;
  valueAmount: number;
  valueCurrency?: string;
  valueInGroupCurrency?: number;
  accountId?: string;
  accountCode?: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  consolidationEntryId?: string;
  hgbSection?: string;
  fiscalYear?: number;
  reportingPeriod?: string;
}

// Interface for querying lineage nodes
export interface LineageNodeQuery {
  financialStatementId?: string;
  companyId?: string;
  nodeType?: LineageNodeType;
  accountId?: string;
  hgbSection?: string;
  isAudited?: boolean;
  isFinal?: boolean;
}
