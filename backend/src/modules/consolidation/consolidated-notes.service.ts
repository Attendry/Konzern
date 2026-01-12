import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { DependencyIdentificationService } from '../company/dependency-identification.service';
import { CapitalConsolidationService } from './capital-consolidation.service';
import { IntercompanyTransactionService } from './intercompany-transaction.service';

export interface ConsolidationMethod {
  method: 'full_consolidation' | 'equity_method' | 'proportional_consolidation';
  description: string;
  hgbReference: string;
}

export interface ConsolidationScope {
  parentCompany: {
    id: string;
    name: string;
  };
  subsidiaries: Array<{
    id: string;
    name: string;
    participationPercentage: number;
    consolidationMethod: string;
    includedFrom: string;
    excludedFrom?: string;
    exclusionReason?: string;
  }>;
  totalCompanies: number;
  consolidatedCompanies: number;
  excludedCompanies: number;
}

export interface GoodwillBreakdown {
  total: number;
  breakdown: Array<{
    subsidiaryCompanyId: string;
    subsidiaryCompanyName: string;
    goodwill: number;
    negativeGoodwill: number;
    acquisitionDate: string | null;
    acquisitionCost: number | null;
    bookValue: number;
    equityAtAcquisition: number;
  }>;
}

export interface MinorityInterestsBreakdown {
  total: number;
  breakdown: Array<{
    subsidiaryCompanyId: string;
    subsidiaryCompanyName: string;
    minorityPercentage: number;
    minorityEquity: number;
    minorityResult: number;
    participationPercentage: number;
  }>;
}

export interface IntercompanyTransactionNote {
  transactionType: string;
  description: string;
  totalAmount: number;
  eliminatedAmount: number;
  companies: Array<{
    fromCompany: string;
    toCompany: string;
    amount: number;
  }>;
}

export interface RelatedPartyTransaction {
  relatedParty: string;
  relationship: string;
  transactionType: string;
  amount: number;
  description: string;
}

export interface ConsolidatedNotes {
  financialStatementId: string;
  fiscalYear: number;
  periodStart: Date;
  periodEnd: Date;
  consolidationMethods: ConsolidationMethod[];
  consolidationScope: ConsolidationScope;
  goodwillBreakdown: GoodwillBreakdown;
  minorityInterestsBreakdown: MinorityInterestsBreakdown;
  intercompanyTransactions: IntercompanyTransactionNote[];
  relatedPartyTransactions: RelatedPartyTransaction[];
  accountingPolicies: {
    consolidationMethod: string;
    currency: string;
    fiscalYearEnd: string;
    valuationMethods: string[];
  };
  significantEvents: string[];
  hgbReferences: string[];
}

@Injectable()
export class ConsolidatedNotesService {
  constructor(
    private supabaseService: SupabaseService,
    private dependencyService: DependencyIdentificationService,
    private capitalConsolidationService: CapitalConsolidationService,
    private intercompanyService: IntercompanyTransactionService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Generiert alle Pflichtangaben für den Konzernanhang nach HGB § 313-314
   */
  async generateConsolidatedNotes(
    financialStatementId: string,
  ): Promise<ConsolidatedNotes> {
    // 1. Lade Financial Statement
    const { data: financialStatement, error: fsError } = await this.supabase
      .from('financial_statements')
      .select('*, companies(*)')
      .eq('id', financialStatementId)
      .single();

    if (fsError || !financialStatement) {
      throw new BadRequestException(
        `Financial Statement mit ID ${financialStatementId} nicht gefunden`,
      );
    }

    const parentCompanyId = financialStatement.company_id;

    // 2. Generiere alle Pflichtangaben
    const consolidationMethods = await this.getConsolidationMethods(financialStatementId);
    const consolidationScope = await this.getConsolidationScope(financialStatementId, parentCompanyId);
    const goodwillBreakdown = await this.getGoodwillBreakdown(financialStatementId, parentCompanyId);
    const minorityInterestsBreakdown = await this.getMinorityInterestsBreakdown(financialStatementId, parentCompanyId);
    const intercompanyTransactions = await this.getIntercompanyTransactions(financialStatementId);
    const relatedPartyTransactions = await this.getRelatedPartyTransactions(financialStatementId);
    const accountingPolicies = await this.getAccountingPolicies(financialStatementId);
    const significantEvents = await this.getSignificantEvents(financialStatementId);

    return {
      financialStatementId,
      fiscalYear: financialStatement.fiscal_year,
      periodStart: new Date(financialStatement.period_start),
      periodEnd: new Date(financialStatement.period_end),
      consolidationMethods,
      consolidationScope,
      goodwillBreakdown,
      minorityInterestsBreakdown,
      intercompanyTransactions,
      relatedPartyTransactions,
      accountingPolicies,
      significantEvents,
      hgbReferences: [
        'HGB § 290 - Konsolidierungspflicht',
        'HGB § 291 - Beherrschungsvertrag',
        'HGB § 296 - Ausnahmen',
        'HGB § 301 - Kapitalkonsolidierung',
        'HGB § 303 - Schuldenkonsolidierung',
        'HGB § 304 - Zwischenergebniseliminierung',
        'HGB § 305 - GuV-Konsolidierung',
        'HGB § 313 - Konzernanhang',
        'HGB § 314 - Pflichtangaben',
      ],
    };
  }

  /**
   * Konsolidierungsmethoden nach HGB § 301
   */
  async getConsolidationMethods(
    financialStatementId: string,
  ): Promise<ConsolidationMethod[]> {
    return [
      {
        method: 'full_consolidation',
        description:
          'Vollkonsolidierung: Alle Vermögensgegenstände, Schulden, Erträge und Aufwendungen der Tochtergesellschaften werden vollständig in die Konzernbilanz übernommen. Zwischengesellschaftsgeschäfte werden eliminiert.',
        hgbReference: 'HGB § 301',
      },
    ];
  }

  /**
   * Konsolidierungskreis nach HGB § 290-292
   */
  async getConsolidationScope(
    financialStatementId: string,
    parentCompanyId: string,
  ): Promise<ConsolidationScope> {
    // Bestimme Konsolidierungskreis
    const consolidationCircle = await this.dependencyService.determineConsolidationCircle(
      parentCompanyId,
    );

    // Lade Beteiligungen
    const { data: participations } = await this.supabase
      .from('participations')
      .select('*, subsidiary_company:companies!participations_subsidiary_company_id_fkey(*)')
      .eq('parent_company_id', parentCompanyId);

    const subsidiaries = (participations || []).map((p) => ({
      id: p.subsidiary_company_id,
      name: p.subsidiary_company?.name || 'Unbekannt',
      participationPercentage: parseFloat(p.participation_percentage || '0'),
      consolidationMethod: 'full_consolidation',
      includedFrom: p.acquisition_date || financialStatementId, // Vereinfacht
      excludedFrom: undefined,
      exclusionReason: undefined,
    }));

    // Prüfe ausgeschlossene Unternehmen (Bedeutungslosigkeit, etc.)
    const { data: obligationChecks } = await this.supabase
      .from('consolidation_obligation_checks')
      .select('company_id, exceptions')
      .in('company_id', subsidiaries.map((s) => s.id));

    const excludedCompanies = (obligationChecks || [])
      .filter((check) => check.exceptions && check.exceptions.length > 0)
      .map((check) => {
        const subsidiary = subsidiaries.find((s) => s.id === check.company_id);
        if (subsidiary) {
          subsidiary.excludedFrom = financialStatementId;
          subsidiary.exclusionReason = `Ausnahme nach HGB § 296: ${check.exceptions.join(', ')}`;
        }
        return subsidiary;
      })
      .filter((s) => s !== undefined);

    return {
      parentCompany: {
        id: consolidationCircle.parentCompany.id,
        name: consolidationCircle.parentCompany.name,
      },
      subsidiaries,
      totalCompanies: subsidiaries.length + 1,
      consolidatedCompanies: subsidiaries.length - excludedCompanies.length + 1,
      excludedCompanies: excludedCompanies.length,
    };
  }

  /**
   * Goodwill-Aufschlüsselung nach HGB § 301
   */
  async getGoodwillBreakdown(
    financialStatementId: string,
    parentCompanyId: string,
  ): Promise<GoodwillBreakdown> {
    // Führe Kapitalkonsolidierung durch, um Goodwill zu erhalten
    let capitalResult;
    try {
      capitalResult = await this.capitalConsolidationService.consolidateCapital(
        financialStatementId,
        parentCompanyId,
      );
    } catch (error) {
      console.warn('Could not get capital consolidation result:', error);
      return {
        total: 0,
        breakdown: [],
      };
    }

    // Lade Beteiligungen mit Details
    const { data: participations } = await this.supabase
      .from('participations')
      .select('*, subsidiary_company:companies!participations_subsidiary_company_id_fkey(*)')
      .eq('parent_company_id', parentCompanyId);

    // Vereinfacht: Goodwill wird aus Summary berechnet
    // In Produktion sollte dies pro Beteiligung aufgeschlüsselt werden
    const totalGoodwill = capitalResult.summary.goodwillAmount;
    const totalNegativeGoodwill = capitalResult.summary.negativeGoodwillAmount;
    const goodwillPerParticipation = participations && participations.length > 0
      ? totalGoodwill / participations.length
      : 0;
    const negativeGoodwillPerParticipation = participations && participations.length > 0
      ? totalNegativeGoodwill / participations.length
      : 0;

    const breakdown = (participations || []).map((p) => ({
      subsidiaryCompanyId: p.subsidiary_company_id,
      subsidiaryCompanyName: p.subsidiary_company?.name || 'Unbekannt',
      goodwill: goodwillPerParticipation,
      negativeGoodwill: negativeGoodwillPerParticipation,
      acquisitionDate: p.acquisition_date,
      acquisitionCost: parseFloat(p.acquisition_cost || '0'),
      bookValue: 0, // Wird aus Beteiligungsbuchwert berechnet
      equityAtAcquisition: 0, // Wird aus Eigenkapital zum Erwerbszeitpunkt berechnet
    }));

    const total = breakdown.reduce(
      (sum, b) => sum + b.goodwill - b.negativeGoodwill,
      0,
    );

    return {
      total,
      breakdown,
    };
  }

  /**
   * Minderheitsanteile-Aufschlüsselung nach HGB § 301
   */
  async getMinorityInterestsBreakdown(
    financialStatementId: string,
    parentCompanyId: string,
  ): Promise<MinorityInterestsBreakdown> {
    // Führe Kapitalkonsolidierung durch
    let capitalResult;
    try {
      capitalResult = await this.capitalConsolidationService.consolidateCapital(
        financialStatementId,
        parentCompanyId,
      );
    } catch (error) {
      console.warn('Could not get capital consolidation result:', error);
      return {
        total: 0,
        breakdown: [],
      };
    }

    // Lade Beteiligungen
    const { data: participations } = await this.supabase
      .from('participations')
      .select('*, subsidiary_company:companies!participations_subsidiary_company_id_fkey(*)')
      .eq('parent_company_id', parentCompanyId);

    // Vereinfacht: Minderheitsanteile werden aus Summary berechnet
    const totalMinorityInterests = capitalResult.summary.minorityInterestsAmount;
    const minorityPerParticipation = participations && participations.length > 0
      ? totalMinorityInterests / participations.length
      : 0;

    const breakdown = (participations || []).map((p) => {
      const participationPercentage = parseFloat(p.participation_percentage || '0');
      const minorityPercentage = 100 - participationPercentage;

      return {
        subsidiaryCompanyId: p.subsidiary_company_id,
        subsidiaryCompanyName: p.subsidiary_company?.name || 'Unbekannt',
        minorityPercentage,
        minorityEquity: minorityPerParticipation,
        minorityResult: 0, // Wird aus Jahresüberschuss der Tochtergesellschaft berechnet
        participationPercentage,
      };
    });

    const total = breakdown.reduce((sum, b) => sum + b.minorityEquity, 0);

    return {
      total,
      breakdown,
    };
  }

  /**
   * Zwischengesellschaftsgeschäfte nach HGB § 313
   */
  async getIntercompanyTransactions(
    financialStatementId: string,
  ): Promise<IntercompanyTransactionNote[]> {
    // Erkenne Zwischengesellschaftsgeschäfte
    const detectionResult = await this.intercompanyService.detectIntercompanyTransactions(
      financialStatementId,
    );

    // Gruppiere nach Typ
    const transactionsByType = new Map<string, IntercompanyTransactionNote>();

    for (const transaction of detectionResult.transactions) {
      const type = transaction.transactionType;
      if (!transactionsByType.has(type)) {
        transactionsByType.set(type, {
          transactionType: type,
          description: this.getTransactionTypeDescription(type),
          totalAmount: 0,
          eliminatedAmount: 0,
          companies: [],
        });
      }

      const note = transactionsByType.get(type)!;
      note.totalAmount += transaction.amount;
      note.eliminatedAmount += transaction.amount; // Wird eliminiert
      note.companies.push({
        fromCompany: transaction.fromCompanyId,
        toCompany: transaction.toCompanyId,
        amount: transaction.amount,
      });
    }

    return Array.from(transactionsByType.values());
  }

  /**
   * Verbundene Unternehmen nach HGB § 313
   */
  async getRelatedPartyTransactions(
    financialStatementId: string,
  ): Promise<RelatedPartyTransaction[]> {
    // Vereinfacht: Nutze Zwischengesellschaftsgeschäfte
    // In Produktion sollten hier auch andere verbundene Unternehmen berücksichtigt werden
    const intercompanyTransactions = await this.getIntercompanyTransactions(financialStatementId);

    return intercompanyTransactions.flatMap((t) =>
      t.companies.map((c) => ({
        relatedParty: c.toCompany,
        relationship: 'Tochtergesellschaft',
        transactionType: t.transactionType,
        amount: c.amount,
        description: t.description,
      })),
    );
  }

  /**
   * Bilanzierungs- und Bewertungsmethoden nach HGB § 313
   */
  async getAccountingPolicies(financialStatementId: string): Promise<{
    consolidationMethod: string;
    currency: string;
    fiscalYearEnd: string;
    valuationMethods: string[];
  }> {
    // Lade Financial Statement
    const { data: financialStatement } = await this.supabase
      .from('financial_statements')
      .select('*')
      .eq('id', financialStatementId)
      .single();

    return {
      consolidationMethod: 'Vollkonsolidierung nach HGB § 301',
      currency: 'EUR',
      fiscalYearEnd: financialStatement
        ? new Date(financialStatement.period_end).toLocaleDateString('de-DE')
        : '31.12.',
      valuationMethods: [
        'Bewertung zu Anschaffungs- oder Herstellungskosten',
        'Niedrigere Bewertung bei voraussichtlich dauernder Wertminderung',
        'Bewertung von Forderungen und Verbindlichkeiten zu Nennwert',
        'Bewertung von Beteiligungen zu Anschaffungskosten',
      ],
    };
  }

  /**
   * Wesentliche Ereignisse nach HGB § 313
   */
  async getSignificantEvents(financialStatementId: string): Promise<string[]> {
    const events: string[] = [];

    // Prüfe auf neue Beteiligungen
    const { data: participations } = await this.supabase
      .from('participations')
      .select('acquisition_date, subsidiary_company:companies!participations_subsidiary_company_id_fkey(*)')
      .gte('acquisition_date', new Date().getFullYear() - 1 + '-01-01');

    if (participations && participations.length > 0) {
      events.push(
        `Erwerb von ${participations.length} Beteiligung(en) im Geschäftsjahr`,
      );
    }

    // Prüfe auf Konsolidierungsänderungen
    const { data: obligationChecks } = await this.supabase
      .from('consolidation_obligation_checks')
      .select('company_id, checked_at')
      .gte('checked_at', new Date().getFullYear() - 1 + '-01-01');

    if (obligationChecks && obligationChecks.length > 0) {
      events.push('Änderungen im Konsolidierungskreis');
    }

    return events;
  }

  /**
   * Hilfsmethode: Beschreibung für Transaktionstyp
   */
  private getTransactionTypeDescription(type: string): string {
    const descriptions: { [key: string]: string } = {
      receivable: 'Forderungen zwischen Konzernunternehmen',
      payable: 'Verbindlichkeiten zwischen Konzernunternehmen',
      delivery: 'Lieferungen und Leistungen zwischen Konzernunternehmen',
      loan: 'Kredite und Darlehen zwischen Konzernunternehmen',
      other: 'Sonstige Geschäfte zwischen Konzernunternehmen',
    };
    return descriptions[type] || type;
  }
}
