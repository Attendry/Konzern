import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { FinancialStatement } from './financial-statement.entity';
import { Account } from './account.entity';

// Buchungstyp nach HGB-Konsolidierungsvorschriften
export enum AdjustmentType {
  ELIMINATION = 'elimination',                      // Allgemeine Eliminierung
  RECLASSIFICATION = 'reclassification',            // Umgliederung
  CAPITAL_CONSOLIDATION = 'capital_consolidation',  // Kapitalkonsolidierung (§ 301 HGB)
  DEBT_CONSOLIDATION = 'debt_consolidation',        // Schuldenkonsolidierung (§ 303 HGB)
  INTERCOMPANY_PROFIT = 'intercompany_profit',      // Zwischenergebniseliminierung (§ 304 HGB)
  INCOME_EXPENSE = 'income_expense',                // Aufwands-/Ertragskonsolidierung (§ 305 HGB)
  CURRENCY_TRANSLATION = 'currency_translation',    // Währungsumrechnung (§ 308a HGB)
  DEFERRED_TAX = 'deferred_tax',                    // Latente Steuern
  MINORITY_INTEREST = 'minority_interest',          // Minderheitenanteile
  OTHER = 'other',                                  // Sonstige
}

// Status für Freigabe-Workflow
export enum EntryStatus {
  DRAFT = 'draft',           // Entwurf - kann bearbeitet werden
  PENDING = 'pending',       // Zur Prüfung eingereicht
  APPROVED = 'approved',     // Freigegeben
  REJECTED = 'rejected',     // Abgelehnt
  REVERSED = 'reversed',     // Storniert
}

// Quelle der Buchung
export enum EntrySource {
  AUTOMATIC = 'automatic',   // Automatisch generiert
  MANUAL = 'manual',         // Manuell erfasst
  IMPORT = 'import',         // Importiert
}

// HGB-Referenzen für Dokumentation
export enum HgbReference {
  SECTION_301 = '§ 301 HGB',  // Kapitalkonsolidierung
  SECTION_303 = '§ 303 HGB',  // Schuldenkonsolidierung
  SECTION_304 = '§ 304 HGB',  // Zwischenergebniseliminierung
  SECTION_305 = '§ 305 HGB',  // Aufwands-/Ertragskonsolidierung
  SECTION_306 = '§ 306 HGB',  // Latente Steuern
  SECTION_307 = '§ 307 HGB',  // Anteile anderer Gesellschafter
  SECTION_308 = '§ 308 HGB',  // Einheitliche Bewertung
  SECTION_308A = '§ 308a HGB', // Währungsumrechnung
  SECTION_312 = '§ 312 HGB',  // Equity-Methode
  OTHER = 'Sonstige',
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

  // Legacy field - kept for backward compatibility
  @Column({ type: 'uuid', name: 'account_id', nullable: true })
  accountId: string;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'account_id' })
  account: Account;

  // NEW: Double-entry bookkeeping - Soll-Konto
  @Column({ type: 'uuid', name: 'debit_account_id', nullable: true })
  debitAccountId: string | null;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'debit_account_id' })
  debitAccount: Account | null;

  // NEW: Double-entry bookkeeping - Haben-Konto
  @Column({ type: 'uuid', name: 'credit_account_id', nullable: true })
  creditAccountId: string | null;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'credit_account_id' })
  creditAccount: Account | null;

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

  // NEW: Workflow status
  @Column({
    type: 'enum',
    enum: EntryStatus,
    name: 'status',
    default: EntryStatus.DRAFT,
  })
  status: EntryStatus;

  // NEW: Entry source
  @Column({
    type: 'enum',
    enum: EntrySource,
    name: 'source',
    default: EntrySource.AUTOMATIC,
  })
  source: EntrySource;

  // NEW: HGB reference for compliance documentation
  @Column({
    type: 'enum',
    enum: HgbReference,
    name: 'hgb_reference',
    nullable: true,
  })
  hgbReference: HgbReference | null;

  // NEW: Affected company IDs (for multi-company entries)
  @Column({ type: 'uuid', array: true, name: 'affected_company_ids', nullable: true })
  affectedCompanyIds: string[] | null;

  // NEW: Created by user
  @Column({ type: 'uuid', name: 'created_by_user_id', nullable: true })
  createdByUserId: string | null;

  // NEW: Approved by user (for 4-eyes principle)
  @Column({ type: 'uuid', name: 'approved_by_user_id', nullable: true })
  approvedByUserId: string | null;

  // NEW: Approval timestamp
  @Column({ type: 'timestamp', name: 'approved_at', nullable: true })
  approvedAt: Date | null;

  // NEW: Reversal reference (if this entry was reversed)
  @Column({ type: 'uuid', name: 'reversed_by_entry_id', nullable: true })
  reversedByEntryId: string | null;

  // NEW: Original entry reference (if this is a reversal)
  @Column({ type: 'uuid', name: 'reverses_entry_id', nullable: true })
  reversesEntryId: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}
