import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { IncomeStatementBalance } from './income-statement-balance.entity';

export enum IncomeStatementAccountType {
  REVENUE = 'revenue',
  COST_OF_SALES = 'cost_of_sales',
  OPERATING_EXPENSE = 'operating_expense',
  FINANCIAL_INCOME = 'financial_income',
  FINANCIAL_EXPENSE = 'financial_expense',
  EXTRAORDINARY_INCOME = 'extraordinary_income',
  EXTRAORDINARY_EXPENSE = 'extraordinary_expense',
  INCOME_TAX = 'income_tax',
  NET_INCOME = 'net_income',
}

@Entity('income_statement_accounts')
export class IncomeStatementAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true, name: 'account_number' })
  accountNumber: string;

  @Column({ type: 'varchar', length: 255, name: 'name' })
  name: string;

  @Column({
    type: 'enum',
    enum: IncomeStatementAccountType,
    name: 'account_type',
  })
  accountType: IncomeStatementAccountType;

  @Column({ type: 'uuid', nullable: true, name: 'parent_account_id' })
  parentAccountId: string | null;

  @ManyToOne(() => IncomeStatementAccount, (account) => account.children, { nullable: true })
  @JoinColumn({ name: 'parent_account_id' })
  parentAccount: IncomeStatementAccount | null;

  @OneToMany(() => IncomeStatementAccount, (account) => account.parentAccount)
  children: IncomeStatementAccount[];

  @OneToMany(() => IncomeStatementBalance, (balance) => balance.account)
  balances: IncomeStatementBalance[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}
