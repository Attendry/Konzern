import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { FinancialStatement } from './financial-statement.entity';
import { IncomeStatementAccount } from './income-statement-account.entity';

@Entity('income_statement_balances')
export class IncomeStatementBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'financial_statement_id' })
  financialStatementId: string;

  @ManyToOne(() => FinancialStatement)
  @JoinColumn({ name: 'financial_statement_id' })
  financialStatement: FinancialStatement;

  @Column({ type: 'uuid', name: 'account_id' })
  accountId: string;

  @ManyToOne(() => IncomeStatementAccount, (account) => account.balances)
  @JoinColumn({ name: 'account_id' })
  account: IncomeStatementAccount;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'amount' })
  amount: number;

  @Column({ type: 'boolean', default: false, name: 'is_intercompany' })
  isIntercompany: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}
