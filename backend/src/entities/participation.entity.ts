import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Company } from './company.entity';

@Entity('participations')
export class Participation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'parent_company_id' })
  parentCompanyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'parent_company_id' })
  parentCompany: Company;

  @Column({ type: 'uuid', name: 'subsidiary_company_id' })
  subsidiaryCompanyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'subsidiary_company_id' })
  subsidiaryCompany: Company;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'participation_percentage' })
  participationPercentage: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true, name: 'acquisition_cost' })
  acquisitionCost: number | null;

  @Column({ type: 'date', nullable: true, name: 'acquisition_date' })
  acquisitionDate: Date | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}
