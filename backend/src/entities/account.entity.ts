import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { AccountBalance } from './account-balance.entity';

export enum AccountType {
  ASSET = 'asset',
  LIABILITY = 'liability',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  EXPENSE = 'expense',
}

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true, name: 'account_number' })
  accountNumber: string;

  @Column({ type: 'varchar', length: 255, name: 'name' })
  name: string;

  @Column({
    type: 'enum',
    enum: AccountType,
    name: 'account_type',
  })
  accountType: AccountType;

  @Column({ type: 'uuid', nullable: true, name: 'parent_account_id' })
  parentAccountId: string | null;

  @ManyToOne(() => Account, (account) => account.children, { nullable: true })
  @JoinColumn({ name: 'parent_account_id' })
  parentAccount: Account | null;

  @OneToMany(() => Account, (account) => account.parentAccount)
  children: Account[];

  @OneToMany(() => AccountBalance, (balance) => balance.account)
  accountBalances: AccountBalance[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}
