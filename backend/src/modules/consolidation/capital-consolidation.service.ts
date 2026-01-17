import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ParticipationService } from '../company/participation.service';
import {
  ConsolidationEntry,
  AdjustmentType,
} from '../../entities/consolidation-entry.entity';
import { SupabaseMapper } from '../../common/supabase-mapper.util';

export interface EquityBreakdown {
  companyId: string;
  companyName: string;
  totalEquity: number;
  shareCapital: number; // Gezeichnetes Kapital
  capitalReserves: number; // Kapitalrücklagen
  retainedEarnings: number; // Gewinnrücklagen
  currentYearResult: number; // Jahresüberschuss/Fehlbetrag
  missingInfo: string[];
}

export interface CapitalConsolidationResult {
  entries: ConsolidationEntry[];
  goodwill: number; // Positiv = Goodwill (Aktiva), Negativ = Passivischer Unterschiedsbetrag
  minorityInterests: number;
  summary: {
    participationsProcessed: number;
    totalBookValueEliminated: number;
    totalEquityEliminated: number;
    goodwillAmount: number;
    negativeGoodwillAmount: number;
    minorityInterestsAmount: number;
    missingInfo: string[];
  };
}

@Injectable()
export class CapitalConsolidationService {
  constructor(
    private supabaseService: SupabaseService,
    private participationService: ParticipationService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Führt die vollständige Kapitalkonsolidierung durch
   */
  async consolidateCapital(
    financialStatementId: string,
    parentCompanyId: string,
  ): Promise<CapitalConsolidationResult> {
    const entries: ConsolidationEntry[] = [];
    const missingInfo: string[] = [];
    let totalGoodwill = 0;
    let totalNegativeGoodwill = 0;
    let totalMinorityInterests = 0;

    // 1. Hole alle Beteiligungsverhältnisse
    let participations =
      await this.participationService.getByParentCompany(parentCompanyId);

    // 2. Wenn keine Beteiligungsverhältnisse gefunden, erstelle sie automatisch aus parent-child Beziehungen
    if (participations.length === 0) {
      console.log(
        `[CapitalConsolidation] No participations found, creating from parent-child relationships for ${parentCompanyId}`,
      );

      // Finde alle Tochterunternehmen mit parent_company_id
      const { data: childCompanies, error: childrenError } = await this.supabase
        .from('companies')
        .select('id, name')
        .eq('parent_company_id', parentCompanyId)
        .eq('is_consolidated', true);

      if (childrenError) {
        console.error(
          '[CapitalConsolidation] Error fetching child companies:',
          childrenError,
        );
        throw new BadRequestException(
          `Fehler beim Abrufen der Tochterunternehmen: ${childrenError.message}`,
        );
      }

      if (!childCompanies || childCompanies.length === 0) {
        throw new BadRequestException(
          `Keine Beteiligungsverhältnisse für Unternehmen ${parentCompanyId} gefunden und keine Tochterunternehmen vorhanden. ` +
            `Bitte erstellen Sie Beteiligungsverhältnisse oder verknüpfen Sie Tochterunternehmen über parent_company_id.`,
        );
      }

      // Erstelle automatisch Beteiligungsverhältnisse für alle Tochterunternehmen
      // Standard: 100% Beteiligung (kann später angepasst werden)
      const createdParticipations = [];
      for (const child of childCompanies) {
        try {
          console.log(
            `[CapitalConsolidation] Creating participation: ${parentCompanyId} -> ${child.id} (100%)`,
          );
          const participation = await this.participationService.createOrUpdate({
            parentCompanyId,
            subsidiaryCompanyId: child.id,
            participationPercentage: 100, // Default: 100% ownership
            acquisitionCost: null, // Can be set later
            acquisitionDate: null, // Can be set later
          });
          createdParticipations.push(participation);
        } catch (error: any) {
          console.error(
            `[CapitalConsolidation] Error creating participation for ${child.id}:`,
            error,
          );
          // Continue with other children even if one fails
        }
      }

      if (createdParticipations.length === 0) {
        throw new BadRequestException(
          `Konnte keine Beteiligungsverhältnisse erstellen. Bitte prüfen Sie die Verknüpfungen zwischen den Unternehmen.`,
        );
      }

      // Lade die neu erstellten Beteiligungsverhältnisse
      participations =
        await this.participationService.getByParentCompany(parentCompanyId);
      console.log(
        `[CapitalConsolidation] Created ${createdParticipations.length} participations, now have ${participations.length} total`,
      );
    }

    let participationsProcessed = 0;
    let totalBookValueEliminated = 0;
    let totalEquityEliminated = 0;

    // 2. Für jede Beteiligung: Kapitalkonsolidierung durchführen
    for (const participation of participations) {
      try {
        // Berechne Beteiligungsbuchwert nach HGB § 301
        const bookValueResult =
          await this.participationService.calculateBookValue(
            participation.id,
            financialStatementId,
          );

        if (bookValueResult.missingInfo.length > 0) {
          missingInfo.push(
            `Beteiligung ${participation.subsidiary_company?.name || participation.subsidiary_company_id}: ${bookValueResult.missingInfo.join(', ')}`,
          );
        }

        // Hole Eigenkapital-Aufteilung der Tochtergesellschaft
        const equityBreakdown = await this.getEquityBreakdown(
          participation.subsidiary_company_id,
          financialStatementId,
        );

        if (equityBreakdown.missingInfo.length > 0) {
          missingInfo.push(
            `Eigenkapital-Aufteilung ${equityBreakdown.companyName}: ${equityBreakdown.missingInfo.join(', ')}`,
          );
        }

        // Berechne anteiliges Eigenkapital
        const participationPercentage =
          parseFloat(participation.participation_percentage) || 0;
        const proportionalEquity =
          (equityBreakdown.totalEquity * participationPercentage) / 100;
        const minorityPercentage = 100 - participationPercentage;
        const minorityEquity =
          (equityBreakdown.totalEquity * minorityPercentage) / 100;

        // Berechne Goodwill oder passivischen Unterschiedsbetrag
        const goodwill = bookValueResult.bookValue - proportionalEquity;

        // Eliminiere Beteiligungsbuchwert
        const participationAccount = await this.findParticipationAccount(
          parentCompanyId,
          participation.subsidiary_company_id,
        );

        if (participationAccount) {
          const { data: bookValueEntry, error: bvError } = await this.supabase
            .from('consolidation_entries')
            .insert({
              financial_statement_id: financialStatementId,
              account_id: participationAccount.id,
              adjustment_type: AdjustmentType.CAPITAL_CONSOLIDATION,
              amount: -bookValueResult.bookValue, // Negativ, um zu eliminieren
              description: `Kapitalkonsolidierung: Eliminierung Beteiligungsbuchwert ${bookValueResult.bookValue.toFixed(2)} für ${equityBreakdown.companyName}. Beteiligungsquote: ${participationPercentage}%`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (!bvError && bookValueEntry) {
            entries.push(SupabaseMapper.toConsolidationEntry(bookValueEntry));
            totalBookValueEliminated += bookValueResult.bookValue;
          }
        }

        // Eliminiere anteiliges Eigenkapital
        const equityAccounts = await this.findEquityAccounts(
          participation.subsidiary_company_id,
          financialStatementId,
        );

        for (const equityAccount of equityAccounts) {
          const proportionalAmount =
            (equityAccount.balance * participationPercentage) / 100;

          if (proportionalAmount !== 0) {
            const { data: equityEntry, error: eqError } = await this.supabase
              .from('consolidation_entries')
              .insert({
                financial_statement_id: financialStatementId,
                account_id: equityAccount.accountId,
                adjustment_type: AdjustmentType.CAPITAL_CONSOLIDATION,
                amount: -proportionalAmount, // Negativ, um zu eliminieren
                description: `Kapitalkonsolidierung: Eliminierung anteiliges Eigenkapital ${equityAccount.accountName} (${equityAccount.accountNumber}) für ${equityBreakdown.companyName}. Anteil: ${participationPercentage}%`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .select()
              .single();

            if (!eqError && equityEntry) {
              entries.push(SupabaseMapper.toConsolidationEntry(equityEntry));
              totalEquityEliminated += proportionalAmount;
            }
          }
        }

        // Erstelle Goodwill oder passivischen Unterschiedsbetrag
        if (Math.abs(goodwill) > 0.01) {
          if (goodwill > 0) {
            // Goodwill (Aktiva)
            totalGoodwill += goodwill;
            // Hinweis: Goodwill sollte in einem separaten Konto ausgewiesen werden
            // Hier wird er als Konsolidierungseintrag erfasst
            const { data: goodwillEntry, error: gwError } = await this.supabase
              .from('consolidation_entries')
              .insert({
                financial_statement_id: financialStatementId,
                account_id: participationAccount?.id || null, // Placeholder - sollte Goodwill-Konto sein
                adjustment_type: AdjustmentType.CAPITAL_CONSOLIDATION,
                amount: goodwill,
                description: `Kapitalkonsolidierung: Goodwill ${goodwill.toFixed(2)} für ${equityBreakdown.companyName}. Beteiligungsbuchwert: ${bookValueResult.bookValue.toFixed(2)}, Anteiliges EK: ${proportionalEquity.toFixed(2)}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .select()
              .single();

            if (!gwError && goodwillEntry) {
              entries.push(SupabaseMapper.toConsolidationEntry(goodwillEntry));
            }
          } else {
            // Passivischer Unterschiedsbetrag (Passiva)
            totalNegativeGoodwill += Math.abs(goodwill);
            const { data: negGwEntry, error: negGwError } = await this.supabase
              .from('consolidation_entries')
              .insert({
                financial_statement_id: financialStatementId,
                account_id: participationAccount?.id || null, // Placeholder
                adjustment_type: AdjustmentType.CAPITAL_CONSOLIDATION,
                amount: goodwill, // Negativ
                description: `Kapitalkonsolidierung: Passivischer Unterschiedsbetrag ${Math.abs(goodwill).toFixed(2)} für ${equityBreakdown.companyName}. Beteiligungsbuchwert: ${bookValueResult.bookValue.toFixed(2)}, Anteiliges EK: ${proportionalEquity.toFixed(2)}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .select()
              .single();

            if (!negGwError && negGwEntry) {
              entries.push(SupabaseMapper.toConsolidationEntry(negGwEntry));
            }
          }
        }

        // Minderheitsanteile
        totalMinorityInterests += minorityEquity;

        participationsProcessed++;
      } catch (error) {
        missingInfo.push(
          `Fehler bei Kapitalkonsolidierung für Beteiligung ${participation.id}: ${error.message}`,
        );
      }
    }

    // Hinweis bei fehlenden Informationen
    if (missingInfo.length > 0) {
      missingInfo.push(
        'Hinweis: Bei fehlenden Informationen wird der Nutzer "Pizzatracker" nach der Auswertung gefragt.',
      );
    }

    return {
      entries,
      goodwill: totalGoodwill - totalNegativeGoodwill,
      minorityInterests: totalMinorityInterests,
      summary: {
        participationsProcessed,
        totalBookValueEliminated,
        totalEquityEliminated,
        goodwillAmount: totalGoodwill,
        negativeGoodwillAmount: totalNegativeGoodwill,
        minorityInterestsAmount: totalMinorityInterests,
        missingInfo,
      },
    };
  }

  /**
   * Ermittelt die Eigenkapital-Aufteilung einer Tochtergesellschaft
   */
  private async getEquityBreakdown(
    companyId: string,
    financialStatementId: string,
  ): Promise<EquityBreakdown> {
    const missingInfo: string[] = [];

    // Hole Financial Statement
    const { data: financialStatement, error: fsError } = await this.supabase
      .from('financial_statements')
      .select('*, companies(*)')
      .eq('id', financialStatementId)
      .eq('company_id', companyId)
      .single();

    if (fsError || !financialStatement) {
      throw new BadRequestException(
        `Financial Statement für Unternehmen ${companyId} nicht gefunden`,
      );
    }

    // Hole alle Eigenkapital-Konten
    const { data: equityBalances, error: balanceError } = await this.supabase
      .from('account_balances')
      .select('balance, accounts(*)')
      .eq('financial_statement_id', financialStatementId)
      .eq('accounts.account_type', 'equity');

    if (balanceError) {
      throw new BadRequestException(
        `Fehler beim Abrufen der Eigenkapital-Konten: ${balanceError.message}`,
      );
    }

    let shareCapital = 0; // Gezeichnetes Kapital
    let capitalReserves = 0; // Kapitalrücklagen
    let retainedEarnings = 0; // Gewinnrücklagen
    let currentYearResult = 0; // Jahresüberschuss/Fehlbetrag

    for (const balance of equityBalances || []) {
      const balanceValue = parseFloat(balance.balance) || 0;
      const account = Array.isArray(balance.accounts)
        ? balance.accounts[0]
        : balance.accounts;
      const accountNumber = account?.account_number || '';
      const accountName = account?.name?.toLowerCase() || '';

      // Gezeichnetes Kapital (typischerweise Konten 2000-2999 oder spezifische Konten)
      if (
        accountNumber.match(/^2[0-9]{3}/) ||
        accountName.match(/gezeichnetes|kapital|stammkapital|grundkapital/i)
      ) {
        shareCapital += balanceValue;
      }
      // Kapitalrücklagen (typischerweise Konten 3000-3999)
      else if (
        accountNumber.match(/^3[0-9]{3}/) ||
        accountName.match(/kapitalrücklage|capital reserve/i)
      ) {
        capitalReserves += balanceValue;
      }
      // Gewinnrücklagen (typischerweise Konten 4000-4999)
      else if (
        accountNumber.match(/^4[0-9]{3}/) ||
        accountName.match(/gewinnrücklage|retained earnings/i)
      ) {
        retainedEarnings += balanceValue;
      }
      // Jahresüberschuss/Fehlbetrag (typischerweise Konten 8000-8999)
      else if (
        accountNumber.match(/^8[0-9]{3}/) ||
        accountName.match(/jahresüberschuss|jahresfehlbetrag|annual result/i)
      ) {
        currentYearResult += balanceValue;
      } else {
        // Unbekannte Eigenkapital-Position
        missingInfo.push(
          `Unbekannte Eigenkapital-Position: ${account?.name || 'Unbekannt'} (${accountNumber})`,
        );
      }
    }

    const totalEquity =
      shareCapital + capitalReserves + retainedEarnings + currentYearResult;

    if (totalEquity === 0) {
      missingInfo.push('Keine Eigenkapital-Positionen gefunden');
    }

    return {
      companyId,
      companyName: financialStatement.companies?.name || 'Unbekannt',
      totalEquity,
      shareCapital,
      capitalReserves,
      retainedEarnings,
      currentYearResult,
      missingInfo,
    };
  }

  /**
   * Findet das Beteiligungs-Konto
   */
  private async findParticipationAccount(
    parentCompanyId: string,
    subsidiaryCompanyId: string,
  ): Promise<any | null> {
    const { data: accounts } = await this.supabase
      .from('accounts')
      .select('*')
      .eq('account_type', 'asset')
      .or('name.ilike.%beteiligung%,name.ilike.%participation%');

    // Vereinfacht: Nimm das erste gefundene Beteiligungs-Konto
    // In der Praxis sollte hier eine bessere Zuordnung erfolgen
    return accounts && accounts.length > 0 ? accounts[0] : null;
  }

  /**
   * Findet alle Eigenkapital-Konten einer Tochtergesellschaft
   */
  private async findEquityAccounts(
    companyId: string,
    financialStatementId: string,
  ): Promise<any[]> {
    const { data: balances } = await this.supabase
      .from('account_balances')
      .select('account_id, balance, accounts(*)')
      .eq('financial_statement_id', financialStatementId)
      .eq('accounts.account_type', 'equity');

    return (balances || []).map((b: any) => {
      const account = Array.isArray(b.accounts) ? b.accounts[0] : b.accounts;
      return {
        accountId: b.account_id,
        accountNumber: account?.account_number || '',
        accountName: account?.name || '',
        balance: parseFloat(b.balance) || 0,
      };
    });
  }
}
