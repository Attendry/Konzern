import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PruefpfadDocumentation } from './pruefpfad-documentation.entity';
import { DocumentAttachment } from './document-attachment.entity';

// Audit evidence type (matches the enum in pruefpfad-documentation.entity.ts)
export enum AuditEvidenceTypeEnum {
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

@Entity('audit_evidence')
export class AuditEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Link to documentation
  @Column({ type: 'uuid', name: 'pruefpfad_id' })
  pruefpfadId: string;

  @ManyToOne(() => PruefpfadDocumentation)
  @JoinColumn({ name: 'pruefpfad_id' })
  pruefpfad: PruefpfadDocumentation;

  // Evidence details
  @Column({
    type: 'enum',
    enum: AuditEvidenceTypeEnum,
    name: 'evidence_type',
  })
  evidenceType: AuditEvidenceTypeEnum;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'evidence_ref',
    nullable: true,
  })
  evidenceRef: string | null;

  @Column({ type: 'text', name: 'evidence_description' })
  evidenceDescription: string;

  // Document reference
  @Column({ type: 'uuid', name: 'document_attachment_id', nullable: true })
  documentAttachmentId: string | null;

  @ManyToOne(() => DocumentAttachment)
  @JoinColumn({ name: 'document_attachment_id' })
  documentAttachment: DocumentAttachment | null;

  // External reference
  @Column({
    type: 'varchar',
    length: 100,
    name: 'external_system',
    nullable: true,
  })
  externalSystem: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'external_ref',
    nullable: true,
  })
  externalRef: string | null;

  // Verification
  @Column({ type: 'boolean', name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ type: 'uuid', name: 'verified_by_user_id', nullable: true })
  verifiedByUserId: string | null;

  @Column({ type: 'timestamp', name: 'verified_at', nullable: true })
  verifiedAt: Date | null;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'verification_method',
    nullable: true,
  })
  verificationMethod: string | null;

  @Column({ type: 'text', name: 'verification_notes', nullable: true })
  verificationNotes: string | null;

  // Timestamp
  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    name: 'created_at',
  })
  createdAt: Date;
}

// Interface for creating audit evidence
export interface CreateAuditEvidenceDto {
  pruefpfadId: string;
  evidenceType: AuditEvidenceTypeEnum;
  evidenceRef?: string;
  evidenceDescription: string;
  documentAttachmentId?: string;
  externalSystem?: string;
  externalRef?: string;
}

// Interface for querying audit evidence
export interface AuditEvidenceQuery {
  pruefpfadId?: string;
  evidenceType?: AuditEvidenceTypeEnum;
  isVerified?: boolean;
}
