import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

// Type of attached document
export enum DocumentType {
  SUPPORTING_DOCUMENT = 'supporting_document',  // Beleg
  CALCULATION = 'calculation',                   // Berechnung
  APPROVAL = 'approval',                         // Freigabe
  CONTRACT = 'contract',                         // Vertrag
  VALUATION_REPORT = 'valuation_report',        // Bewertungsgutachten
  AUDIT_CONFIRMATION = 'audit_confirmation',     // Prüfungsbestätigung
  BANK_STATEMENT = 'bank_statement',             // Kontoauszug
  INVOICE = 'invoice',                           // Rechnung
  OTHER = 'other',
}

// Entity types that can have attachments
export enum AttachableEntityType {
  CONSOLIDATION_ENTRY = 'consolidation_entry',
  PARTICIPATION = 'participation',
  INTERCOMPANY_TRANSACTION = 'intercompany_transaction',
  DEFERRED_TAX = 'deferred_tax',
  IC_RECONCILIATION = 'ic_reconciliation',
  FINANCIAL_STATEMENT = 'financial_statement',
  COMPANY = 'company',
}

@Entity('document_attachments')
export class DocumentAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Which entity this document is attached to
  @Column({
    type: 'enum',
    enum: AttachableEntityType,
    name: 'entity_type',
  })
  entityType: AttachableEntityType;

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId: string;

  // Document type
  @Column({
    type: 'enum',
    enum: DocumentType,
    name: 'document_type',
  })
  documentType: DocumentType;

  // File information
  @Column({ type: 'varchar', length: 500, name: 'file_name' })
  fileName: string;

  @Column({ type: 'varchar', length: 100, name: 'file_type' })
  fileType: string;

  @Column({ type: 'bigint', name: 'file_size' })
  fileSize: number;

  // Storage path (Supabase Storage bucket/path)
  @Column({ type: 'varchar', length: 1000, name: 'storage_path' })
  storagePath: string;

  // Public URL (if applicable)
  @Column({ type: 'varchar', length: 1000, name: 'public_url', nullable: true })
  publicUrl: string | null;

  // Description
  @Column({ type: 'text', name: 'description', nullable: true })
  description: string | null;

  // Uploaded by
  @Column({ type: 'uuid', name: 'uploaded_by_user_id', nullable: true })
  uploadedByUserId: string | null;

  @Column({ type: 'varchar', length: 255, name: 'uploaded_by_user_name', nullable: true })
  uploadedByUserName: string | null;

  // Document date (e.g., invoice date)
  @Column({ type: 'date', name: 'document_date', nullable: true })
  documentDate: Date | null;

  // Reference number (e.g., invoice number)
  @Column({ type: 'varchar', length: 255, name: 'reference_number', nullable: true })
  referenceNumber: string | null;

  // Checksum for integrity verification
  @Column({ type: 'varchar', length: 64, name: 'checksum', nullable: true })
  checksum: string | null;

  // Is this a required document?
  @Column({ type: 'boolean', name: 'is_required', default: false })
  isRequired: boolean;

  // Is this document verified/approved?
  @Column({ type: 'boolean', name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ type: 'uuid', name: 'verified_by_user_id', nullable: true })
  verifiedByUserId: string | null;

  @Column({ type: 'timestamp', name: 'verified_at', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}
