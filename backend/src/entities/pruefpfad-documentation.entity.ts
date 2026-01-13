import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { FinancialStatement } from './financial-statement.entity';

// Prüfpfad status
export enum PruefpfadStatus {
  DOCUMENTED = 'documented',
  PARTIALLY_DOCUMENTED = 'partially_documented',
  UNDOCUMENTED = 'undocumented',
  VERIFIED = 'verified',
  REQUIRES_REVIEW = 'requires_review',
}

// Audit evidence type
export enum AuditEvidenceType {
  SOURCE_DOCUMENT = 'source_document',
  CALCULATION = 'calculation',
  SYSTEM_LOG = 'system_log',
  RECONCILIATION = 'reconciliation',
  CONFIRMATION = 'confirmation',
  MANAGEMENT_ASSERTION = 'management_assertion',
  ANALYTICAL_REVIEW = 'analytical_review',
  SAMPLING = 'sampling',
  WALKTHROUGH = 'walkthrough',
}

// Evidence reference interface
export interface EvidenceReference {
  type: AuditEvidenceType;
  ref: string;
  description: string;
  isVerified?: boolean;
}

@Entity('pruefpfad_documentation')
export class PruefpfadDocumentation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Reference to what is being documented
  @Column({ type: 'uuid', name: 'financial_statement_id' })
  financialStatementId: string;

  @ManyToOne(() => FinancialStatement)
  @JoinColumn({ name: 'financial_statement_id' })
  financialStatement: FinancialStatement;

  @Column({ type: 'varchar', length: 100, name: 'entity_type' })
  entityType: string;

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId: string;

  // Documentation status
  @Column({
    type: 'enum',
    enum: PruefpfadStatus,
    name: 'status',
    default: PruefpfadStatus.UNDOCUMENTED,
  })
  status: PruefpfadStatus;

  // HGB reference and compliance
  @Column({ type: 'varchar', length: 50, name: 'hgb_section', nullable: true })
  hgbSection: string | null;

  @Column({ type: 'text', name: 'hgb_requirement', nullable: true })
  hgbRequirement: string | null;

  @Column({ type: 'text', name: 'compliance_notes', nullable: true })
  complianceNotes: string | null;

  // Audit working paper reference
  @Column({ type: 'varchar', length: 100, name: 'working_paper_ref', nullable: true })
  workingPaperRef: string | null;

  @Column({ type: 'varchar', length: 100, name: 'audit_program_ref', nullable: true })
  auditProgramRef: string | null;

  // Documentation content
  @Column({ type: 'text', name: 'documentation_summary' })
  documentationSummary: string;

  @Column({ type: 'text', name: 'detailed_description', nullable: true })
  detailedDescription: string | null;

  @Column({ type: 'text', name: 'calculation_basis', nullable: true })
  calculationBasis: string | null;

  @Column({ type: 'text', name: 'assumptions', nullable: true })
  assumptions: string | null;

  // Evidence references (stored as JSON array)
  @Column({ type: 'jsonb', name: 'evidence_references', default: '[]' })
  evidenceReferences: EvidenceReference[];

  // Risk assessment
  @Column({ type: 'varchar', length: 20, name: 'risk_level', nullable: true })
  riskLevel: 'low' | 'medium' | 'high' | null;

  @Column({ type: 'text', name: 'material_risk_factors', nullable: true })
  materialRiskFactors: string | null;

  // Prepared by
  @Column({ type: 'uuid', name: 'prepared_by_user_id', nullable: true })
  preparedByUserId: string | null;

  @Column({ type: 'varchar', length: 255, name: 'prepared_by_name', nullable: true })
  preparedByName: string | null;

  @Column({ type: 'timestamp', name: 'prepared_at', default: () => 'CURRENT_TIMESTAMP' })
  preparedAt: Date;

  // Reviewed by (4-eyes principle)
  @Column({ type: 'uuid', name: 'reviewed_by_user_id', nullable: true })
  reviewedByUserId: string | null;

  @Column({ type: 'varchar', length: 255, name: 'reviewed_by_name', nullable: true })
  reviewedByName: string | null;

  @Column({ type: 'timestamp', name: 'reviewed_at', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'text', name: 'review_notes', nullable: true })
  reviewNotes: string | null;

  // Verified by (auditor)
  @Column({ type: 'uuid', name: 'verified_by_user_id', nullable: true })
  verifiedByUserId: string | null;

  @Column({ type: 'varchar', length: 255, name: 'verified_by_name', nullable: true })
  verifiedByName: string | null;

  @Column({ type: 'timestamp', name: 'verified_at', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'text', name: 'verification_notes', nullable: true })
  verificationNotes: string | null;

  // Timestamps
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}

// Interface for creating pruefpfad documentation
export interface CreatePruefpfadDto {
  financialStatementId: string;
  entityType: string;
  entityId: string;
  documentationSummary: string;
  hgbSection?: string;
  hgbRequirement?: string;
  workingPaperRef?: string;
  auditProgramRef?: string;
  detailedDescription?: string;
  calculationBasis?: string;
  assumptions?: string;
  evidenceReferences?: EvidenceReference[];
  riskLevel?: 'low' | 'medium' | 'high';
  materialRiskFactors?: string;
  preparedByUserId?: string;
  preparedByName?: string;
}

// Interface for updating pruefpfad documentation
export interface UpdatePruefpfadDto {
  status?: PruefpfadStatus;
  documentationSummary?: string;
  detailedDescription?: string;
  calculationBasis?: string;
  assumptions?: string;
  evidenceReferences?: EvidenceReference[];
  complianceNotes?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  materialRiskFactors?: string;
  reviewedByUserId?: string;
  reviewedByName?: string;
  reviewNotes?: string;
  verifiedByUserId?: string;
  verifiedByName?: string;
  verificationNotes?: string;
}

// Interface for querying pruefpfad documentation
export interface PruefpfadQuery {
  financialStatementId?: string;
  entityType?: string;
  entityId?: string;
  status?: PruefpfadStatus;
  hgbSection?: string;
  workingPaperRef?: string;
  riskLevel?: 'low' | 'medium' | 'high';
}
