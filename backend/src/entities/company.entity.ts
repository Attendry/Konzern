import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { FinancialStatement } from './financial-statement.entity';

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

  @OneToMany(() => FinancialStatement, (fs) => fs.company)
  financialStatements: FinancialStatement[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}
