import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

// Compliance checklist item status
export enum ChecklistItemStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  NOT_APPLICABLE = 'not_applicable',
  REQUIRES_REVIEW = 'requires_review',
}

// Category of compliance check
export enum ComplianceCategory {
  CAPITAL_CONSOLIDATION = 'capital_consolidation',     // § 301 HGB
  DEBT_CONSOLIDATION = 'debt_consolidation',           // § 303 HGB
  INTERCOMPANY_PROFIT = 'intercompany_profit',         // § 304 HGB
  INCOME_EXPENSE = 'income_expense',                   // § 305 HGB
  DEFERRED_TAX = 'deferred_tax',                       // § 306 HGB
  MINORITY_INTEREST = 'minority_interest',             // § 307 HGB
  UNIFORM_VALUATION = 'uniform_valuation',             // § 308 HGB
  CURRENCY_TRANSLATION = 'currency_translation',       // § 308a HGB
  CONSOLIDATION_CIRCLE = 'consolidation_circle',       // § 294-296 HGB
  EQUITY_METHOD = 'equity_method',                     // § 312 HGB
  NOTES_DISCLOSURE = 'notes_disclosure',               // § 313-314 HGB
  GENERAL_COMPLIANCE = 'general_compliance',
}

@Entity('compliance_checklists')
export class ComplianceChecklist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'financial_statement_id' })
  financialStatementId: string;

  // Category
  @Column({
    type: 'enum',
    enum: ComplianceCategory,
    name: 'category',
  })
  category: ComplianceCategory;

  // Item identifier (e.g., "301-1", "303-2")
  @Column({ type: 'varchar', length: 50, name: 'item_code' })
  itemCode: string;

  // Check description
  @Column({ type: 'text', name: 'description' })
  description: string;

  // HGB reference
  @Column({ type: 'varchar', length: 50, name: 'hgb_reference', nullable: true })
  hgbReference: string | null;

  // Detailed requirement
  @Column({ type: 'text', name: 'requirement', nullable: true })
  requirement: string | null;

  // Status
  @Column({
    type: 'enum',
    enum: ChecklistItemStatus,
    name: 'status',
    default: ChecklistItemStatus.NOT_STARTED,
  })
  status: ChecklistItemStatus;

  // Is this a mandatory item?
  @Column({ type: 'boolean', name: 'is_mandatory', default: true })
  isMandatory: boolean;

  // Priority (1 = highest)
  @Column({ type: 'int', name: 'priority', default: 5 })
  priority: number;

  // Completion notes
  @Column({ type: 'text', name: 'notes', nullable: true })
  notes: string | null;

  // Evidence/documentation reference
  @Column({ type: 'text', name: 'evidence', nullable: true })
  evidence: string | null;

  // Related entity IDs (consolidation entries, etc.)
  @Column({ type: 'uuid', array: true, name: 'related_entity_ids', nullable: true })
  relatedEntityIds: string[] | null;

  // Completed by
  @Column({ type: 'uuid', name: 'completed_by_user_id', nullable: true })
  completedByUserId: string | null;

  @Column({ type: 'timestamp', name: 'completed_at', nullable: true })
  completedAt: Date | null;

  // Reviewed by
  @Column({ type: 'uuid', name: 'reviewed_by_user_id', nullable: true })
  reviewedByUserId: string | null;

  @Column({ type: 'timestamp', name: 'reviewed_at', nullable: true })
  reviewedAt: Date | null;

  // Due date
  @Column({ type: 'date', name: 'due_date', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}

// Default checklist items by HGB section
export const DEFAULT_CHECKLIST_ITEMS: Partial<ComplianceChecklist>[] = [
  // § 301 HGB - Kapitalkonsolidierung
  {
    category: ComplianceCategory.CAPITAL_CONSOLIDATION,
    itemCode: '301-1',
    hgbReference: '§ 301 Abs. 1 HGB',
    description: 'Erwerbsmethode für Kapitalkonsolidierung angewendet',
    requirement: 'Der Beteiligungsbuchwert ist mit dem anteiligen Eigenkapital zu verrechnen.',
    isMandatory: true,
    priority: 1,
  },
  {
    category: ComplianceCategory.CAPITAL_CONSOLIDATION,
    itemCode: '301-2',
    hgbReference: '§ 301 Abs. 1 HGB',
    description: 'Stille Reserven/Lasten aufgedeckt',
    requirement: 'Unterschiedsbetrag ist vorrangig auf stille Reserven/Lasten zu verteilen.',
    isMandatory: true,
    priority: 1,
  },
  {
    category: ComplianceCategory.CAPITAL_CONSOLIDATION,
    itemCode: '301-3',
    hgbReference: '§ 301 Abs. 3 HGB',
    description: 'Geschäfts-/Firmenwert korrekt ermittelt',
    requirement: 'Verbleibender Unterschiedsbetrag ist als Geschäfts-/Firmenwert zu aktivieren.',
    isMandatory: true,
    priority: 1,
  },
  {
    category: ComplianceCategory.CAPITAL_CONSOLIDATION,
    itemCode: '301-4',
    hgbReference: '§ 301 Abs. 3 HGB',
    description: 'Planmäßige Abschreibung des Firmenwerts',
    requirement: 'Geschäfts-/Firmenwert über Nutzungsdauer abschreiben (max. 10 Jahre bei Schätzung).',
    isMandatory: true,
    priority: 2,
  },
  
  // § 303 HGB - Schuldenkonsolidierung
  {
    category: ComplianceCategory.DEBT_CONSOLIDATION,
    itemCode: '303-1',
    hgbReference: '§ 303 Abs. 1 HGB',
    description: 'Konzerninterne Forderungen und Verbindlichkeiten eliminiert',
    requirement: 'Ausleihungen, Forderungen, Verbindlichkeiten sind wegzulassen.',
    isMandatory: true,
    priority: 1,
  },
  {
    category: ComplianceCategory.DEBT_CONSOLIDATION,
    itemCode: '303-2',
    hgbReference: '§ 303 Abs. 1 HGB',
    description: 'Aufrechnungsdifferenzen erfasst',
    requirement: 'Differenzen aus IC-Salden sind als Aufwand/Ertrag zu erfassen.',
    isMandatory: true,
    priority: 2,
  },
  
  // § 304 HGB - Zwischenergebniseliminierung
  {
    category: ComplianceCategory.INTERCOMPANY_PROFIT,
    itemCode: '304-1',
    hgbReference: '§ 304 Abs. 1 HGB',
    description: 'Zwischengewinne aus IC-Lieferungen eliminiert',
    requirement: 'Zwischenergebnisse in Vorräten und Anlagevermögen sind zu eliminieren.',
    isMandatory: true,
    priority: 1,
  },
  {
    category: ComplianceCategory.INTERCOMPANY_PROFIT,
    itemCode: '304-2',
    hgbReference: '§ 304 Abs. 2 HGB',
    description: 'Wesentlichkeitsprüfung dokumentiert',
    requirement: 'Bei Unwesentlichkeit kann auf Eliminierung verzichtet werden (Dokumentation erforderlich).',
    isMandatory: false,
    priority: 3,
  },
  
  // § 305 HGB - Aufwands-/Ertragskonsolidierung
  {
    category: ComplianceCategory.INCOME_EXPENSE,
    itemCode: '305-1',
    hgbReference: '§ 305 Abs. 1 HGB',
    description: 'IC-Umsatzerlöse eliminiert',
    requirement: 'Umsatzerlöse aus IC-Lieferungen sind mit Materialaufwand zu verrechnen.',
    isMandatory: true,
    priority: 1,
  },
  {
    category: ComplianceCategory.INCOME_EXPENSE,
    itemCode: '305-2',
    hgbReference: '§ 305 Abs. 1 HGB',
    description: 'Sonstige IC-Erträge und -Aufwendungen eliminiert',
    requirement: 'Alle weiteren IC-Erträge/-Aufwendungen sind aufzurechnen.',
    isMandatory: true,
    priority: 2,
  },
  
  // § 306 HGB - Latente Steuern
  {
    category: ComplianceCategory.DEFERRED_TAX,
    itemCode: '306-1',
    hgbReference: '§ 306 HGB',
    description: 'Latente Steuern aus Konsolidierung ermittelt',
    requirement: 'Temporäre Differenzen aus Konsolidierungsmaßnahmen sind mit latenten Steuern zu berücksichtigen.',
    isMandatory: true,
    priority: 1,
  },
  {
    category: ComplianceCategory.DEFERRED_TAX,
    itemCode: '306-2',
    hgbReference: '§ 306 HGB',
    description: 'Steuersatz für latente Steuern dokumentiert',
    requirement: 'Der angewandte Steuersatz ist zu dokumentieren und zu begründen.',
    isMandatory: true,
    priority: 2,
  },
  
  // § 307 HGB - Minderheitenanteile
  {
    category: ComplianceCategory.MINORITY_INTEREST,
    itemCode: '307-1',
    hgbReference: '§ 307 Abs. 1 HGB',
    description: 'Minderheitenanteile am Eigenkapital ausgewiesen',
    requirement: 'Anteile anderer Gesellschafter sind gesondert auszuweisen.',
    isMandatory: true,
    priority: 1,
  },
  {
    category: ComplianceCategory.MINORITY_INTEREST,
    itemCode: '307-2',
    hgbReference: '§ 307 Abs. 2 HGB',
    description: 'Ergebnisanteile der Minderheit korrekt zugeordnet',
    requirement: 'Der auf Minderheiten entfallende Jahresüberschuss/-fehlbetrag ist gesondert auszuweisen.',
    isMandatory: true,
    priority: 1,
  },
  
  // § 308 HGB - Einheitliche Bewertung
  {
    category: ComplianceCategory.UNIFORM_VALUATION,
    itemCode: '308-1',
    hgbReference: '§ 308 Abs. 1 HGB',
    description: 'Einheitliche Bewertungsmethoden angewendet',
    requirement: 'Vermögensgegenstände und Schulden sind nach einheitlichen Methoden zu bewerten.',
    isMandatory: true,
    priority: 1,
  },
  {
    category: ComplianceCategory.UNIFORM_VALUATION,
    itemCode: '308-2',
    hgbReference: '§ 308 Abs. 2 HGB',
    description: 'Abweichende Bewertungen angepasst (HB II)',
    requirement: 'Abweichende Wertansätze sind auf konzerneinheitliche Methoden anzupassen.',
    isMandatory: true,
    priority: 2,
  },
  
  // § 308a HGB - Währungsumrechnung
  {
    category: ComplianceCategory.CURRENCY_TRANSLATION,
    itemCode: '308a-1',
    hgbReference: '§ 308a HGB',
    description: 'Stichtagskursmethode angewendet',
    requirement: 'Bilanzposten sind zum Stichtagskurs umzurechnen.',
    isMandatory: true,
    priority: 1,
  },
  {
    category: ComplianceCategory.CURRENCY_TRANSLATION,
    itemCode: '308a-2',
    hgbReference: '§ 308a HGB',
    description: 'GuV-Posten mit Durchschnittskurs umgerechnet',
    requirement: 'Aufwendungen und Erträge sind mit Durchschnittskurs umzurechnen.',
    isMandatory: true,
    priority: 1,
  },
  {
    category: ComplianceCategory.CURRENCY_TRANSLATION,
    itemCode: '308a-3',
    hgbReference: '§ 308a HGB',
    description: 'Umrechnungsdifferenz im Eigenkapital erfasst',
    requirement: 'Differenzen sind im Eigenkapital als separater Posten auszuweisen.',
    isMandatory: true,
    priority: 2,
  },
  
  // § 312 HGB - Equity-Methode
  {
    category: ComplianceCategory.EQUITY_METHOD,
    itemCode: '312-1',
    hgbReference: '§ 312 Abs. 1 HGB',
    description: 'At-Equity-Bewertung für assoziierte Unternehmen',
    requirement: 'Beteiligungen an assoziierten Unternehmen sind mit Equity-Methode zu bewerten.',
    isMandatory: true,
    priority: 1,
  },
  {
    category: ComplianceCategory.EQUITY_METHOD,
    itemCode: '312-2',
    hgbReference: '§ 312 Abs. 4 HGB',
    description: 'Anteiliges Ergebnis als Ertrag/Aufwand erfasst',
    requirement: 'Unterschiedsbetrag zum Vorjahreswert ist als Ertrag oder Aufwand auszuweisen.',
    isMandatory: true,
    priority: 2,
  },
  
  // § 313-314 HGB - Anhangangaben
  {
    category: ComplianceCategory.NOTES_DISCLOSURE,
    itemCode: '313-1',
    hgbReference: '§ 313 HGB',
    description: 'Konsolidierungskreis im Anhang angegeben',
    requirement: 'Alle einbezogenen und nicht einbezogenen Unternehmen sind aufzulisten.',
    isMandatory: true,
    priority: 1,
  },
  {
    category: ComplianceCategory.NOTES_DISCLOSURE,
    itemCode: '313-2',
    hgbReference: '§ 313 HGB',
    description: 'Konsolidierungsmethoden erläutert',
    requirement: 'Angewandte Konsolidierungsmethoden sind zu beschreiben.',
    isMandatory: true,
    priority: 2,
  },
  {
    category: ComplianceCategory.NOTES_DISCLOSURE,
    itemCode: '314-1',
    hgbReference: '§ 314 HGB',
    description: 'Sonstige Pflichtangaben vollständig',
    requirement: 'Alle nach § 314 HGB geforderten Angaben sind enthalten.',
    isMandatory: true,
    priority: 2,
  },
];
