import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Company } from './company.entity';
import { Account } from './account.entity';

@Entity('intercompany_transactions')
export class IntercompanyTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'from_company_id' })
  fromCompanyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'from_company_id' })
  fromCompany: Company;

  @Column({ type: 'uuid', name: 'to_company_id' })
  toCompanyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'to_company_id' })
  toCompany: Company;

  @Column({ type: 'uuid', name: 'account_id' })
  accountId: string;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'amount' })
  amount: number;

  @Column({ type: 'date', name: 'transaction_date' })
  transactionDate: Date;

  @Column({ type: 'text', nullable: true, name: 'description' })
  description: string;

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
