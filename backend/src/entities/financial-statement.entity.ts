import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Company } from './company.entity';
import { AccountBalance } from './account-balance.entity';
import { ConsolidationEntry } from './consolidation-entry.entity';

export enum FinancialStatementStatus {
  DRAFT = 'draft',
  FINALIZED = 'finalized',
  CONSOLIDATED = 'consolidated',
}

@Entity('financial_statements')
export class FinancialStatement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, (company) => company.financialStatements)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ type: 'integer', name: 'fiscal_year' })
  fiscalYear: number;

  @Column({ type: 'date', name: 'period_start' })
  periodStart: Date;

  @Column({ type: 'date', name: 'period_end' })
  periodEnd: Date;

  @Column({
    type: 'enum',
    enum: FinancialStatementStatus,
    default: FinancialStatementStatus.DRAFT,
    name: 'status',
  })
  status: FinancialStatementStatus;

  @OneToMany(() => AccountBalance, (balance) => balance.financialStatement)
  accountBalances: AccountBalance[];

  @OneToMany(() => ConsolidationEntry, (entry) => entry.financialStatement)
  consolidationEntries: ConsolidationEntry[];

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
