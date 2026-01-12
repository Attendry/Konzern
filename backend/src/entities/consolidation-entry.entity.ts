import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { FinancialStatement } from './financial-statement.entity';
import { Account } from './account.entity';

export enum AdjustmentType {
  ELIMINATION = 'elimination',
  RECLASSIFICATION = 'reclassification',
  CAPITAL_CONSOLIDATION = 'capital_consolidation',
  DEBT_CONSOLIDATION = 'debt_consolidation',
  OTHER = 'other',
}

@Entity('consolidation_entries')
export class ConsolidationEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'financial_statement_id' })
  financialStatementId: string;

  @ManyToOne(() => FinancialStatement, (fs) => fs.consolidationEntries)
  @JoinColumn({ name: 'financial_statement_id' })
  financialStatement: FinancialStatement;

  @Column({ type: 'uuid', name: 'account_id' })
  accountId: string;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @Column({
    type: 'enum',
    enum: AdjustmentType,
    name: 'adjustment_type',
  })
  adjustmentType: AdjustmentType;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'amount' })
  amount: number;

  @Column({ type: 'text', nullable: true, name: 'description' })
  description: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}
