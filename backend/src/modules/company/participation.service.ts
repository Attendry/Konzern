import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseMapper } from '../../common/supabase-mapper.util';

export interface ParticipationData {
  id?: string;
  parentCompanyId: string;
  subsidiaryCompanyId: string;
  participationPercentage: number;
  acquisitionCost?: number | null;
  acquisitionDate?: Date | null;
}

export interface ParticipationBookValue {
  participationId: string;
  parentCompanyId: string;
  subsidiaryCompanyId: string;
  acquisitionCost: number;
  acquisitionDate: Date;
  participationPercentage: number;
  bookValue: number;
  calculationDetails: {
    acquisitionCost: number;
    cumulativeProfits: number;
    cumulativeLosses: number;
    cumulativeDividends: number;
  };
  missingInfo: string[];
}

@Injectable()
export class ParticipationService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Erstellt oder aktualisiert ein Beteiligungsverhältnis
   */
  async createOrUpdate(participation: ParticipationData): Promise<any> {
    // Validierung
    if (
      participation.participationPercentage < 0 ||
      participation.participationPercentage > 100
    ) {
      throw new BadRequestException(
        'Beteiligungsquote muss zwischen 0 und 100 liegen',
      );
    }

    if (participation.parentCompanyId === participation.subsidiaryCompanyId) {
      throw new BadRequestException(
        'Mutter- und Tochterunternehmen dürfen nicht identisch sein',
      );
    }

    // Prüfe, ob bereits ein Beteiligungsverhältnis existiert
    const { data: existing } = await this.supabase
      .from('participations')
      .select('*')
      .eq('parent_company_id', participation.parentCompanyId)
      .eq('subsidiary_company_id', participation.subsidiaryCompanyId)
      .single();

    const participationData = {
      parent_company_id: participation.parentCompanyId,
      subsidiary_company_id: participation.subsidiaryCompanyId,
      participation_percentage: participation.participationPercentage,
      acquisition_cost: participation.acquisitionCost || null,
      acquisition_date: participation.acquisitionDate
        ? new Date(participation.acquisitionDate).toISOString().split('T')[0]
        : null,
      updated_at: SupabaseMapper.getCurrentTimestamp(),
    };

    if (existing) {
      // Update
      const { data, error } = await this.supabase
        .from('participations')
        .update(participationData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        throw new BadRequestException(
          `Fehler beim Aktualisieren der Beteiligung: ${error.message}`,
        );
      }

      return data;
    } else {
      // Create
      const { data, error } = await this.supabase
        .from('participations')
        .insert({
          ...participationData,
          created_at: SupabaseMapper.getCurrentTimestamp(),
        })
        .select()
        .single();

      if (error) {
        throw new BadRequestException(
          `Fehler beim Erstellen der Beteiligung: ${error.message}`,
        );
      }

      return data;
    }
  }

  /**
   * Holt alle Beteiligungsverhältnisse für ein Mutterunternehmen
   */
  async getByParentCompany(parentCompanyId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('participations')
      .select(
        '*, parent_company:companies!parent_company_id(*), subsidiary_company:companies!subsidiary_company_id(*)',
      )
      .eq('parent_company_id', parentCompanyId);

    if (error) {
      throw new BadRequestException(
        `Fehler beim Abrufen der Beteiligungen: ${error.message}`,
      );
    }

    return data || [];
  }

  /**
   * Holt alle Beteiligungsverhältnisse für ein Tochterunternehmen
   */
  async getBySubsidiaryCompany(subsidiaryCompanyId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('participations')
      .select(
        '*, parent_company:companies!parent_company_id(*), subsidiary_company:companies!subsidiary_company_id(*)',
      )
      .eq('subsidiary_company_id', subsidiaryCompanyId);

    if (error) {
      throw new BadRequestException(
        `Fehler beim Abrufen der Beteiligungen: ${error.message}`,
      );
    }

    return data || [];
  }

  /**
   * Berechnet den Beteiligungsbuchwert nach Vollkonsolidierung (HGB § 301)
   * Formel: Anschaffungskosten + anteilige Gewinne - anteilige Verluste - ausgeschüttete Dividenden
   */
  async calculateBookValue(
    participationId: string,
    financialStatementId: string,
  ): Promise<ParticipationBookValue> {
    const missingInfo: string[] = [];

    // 1. Hole Beteiligungsverhältnis
    const { data: participation, error: partError } = await this.supabase
      .from('participations')
      .select('*')
      .eq('id', participationId)
      .single();

    if (partError || !participation) {
      throw new NotFoundException(
        `Beteiligungsverhältnis mit ID ${participationId} nicht gefunden`,
      );
    }

    if (!participation.acquisition_cost) {
      missingInfo.push(
        'Anschaffungskosten fehlen. Bitte ergänzen Sie diese Information.',
      );
    }

    if (!participation.acquisition_date) {
      missingInfo.push(
        'Erwerbsdatum fehlt. Bitte ergänzen Sie diese Information.',
      );
    }

    // 2. Hole Financial Statement für Berechnung
    const { data: financialStatement, error: fsError } = await this.supabase
      .from('financial_statements')
      .select('fiscal_year, period_start, period_end')
      .eq('id', financialStatementId)
      .single();

    if (fsError || !financialStatement) {
      throw new NotFoundException(
        `Financial Statement mit ID ${financialStatementId} nicht gefunden`,
      );
    }

    const acquisitionCost = parseFloat(participation.acquisition_cost) || 0;
    const acquisitionDate = participation.acquisition_date
      ? new Date(participation.acquisition_date)
      : null;
    const participationPercentage =
      parseFloat(participation.participation_percentage) || 0;

    // 3. Berechne anteilige Gewinne seit Erwerb
    let cumulativeProfits = 0;
    let cumulativeLosses = 0;
    let cumulativeDividends = 0;

    if (acquisitionDate) {
      // Hole alle Financial Statements seit Erwerb
      const { data: statements } = await this.supabase
        .from('financial_statements')
        .select('id, fiscal_year, period_start, period_end')
        .eq('company_id', participation.subsidiary_company_id)
        .gte('period_end', acquisitionDate.toISOString().split('T')[0])
        .order('fiscal_year', { ascending: true });

      if (statements && statements.length > 0) {
        for (const statement of statements) {
          // Hole Eigenkapital-Positionen (Jahresüberschuss/Fehlbetrag)
          const { data: equityBalances } = await this.supabase
            .from('account_balances')
            .select('balance, accounts(account_type, account_number, name)')
            .eq('financial_statement_id', statement.id)
            .eq('accounts.account_type', 'equity');

          if (equityBalances) {
            for (const balance of equityBalances) {
              const balanceValue = parseFloat(balance.balance) || 0;
              const account = Array.isArray(balance.accounts)
                ? balance.accounts[0]
                : balance.accounts;
              const accountNumber = account?.account_number || '';
              const accountName = account?.name || '';

              // Jahresüberschuss/Fehlbetrag (typischerweise Konten 8000-8999 oder spezifische Konten)
              if (
                accountNumber.match(/^8[0-9]{3}/) ||
                accountName
                  .toLowerCase()
                  .match(
                    /jahresüberschuss|jahresfehlbetrag|gewinn|verlust|profit|loss/i,
                  )
              ) {
                if (balanceValue > 0) {
                  cumulativeProfits +=
                    (balanceValue * participationPercentage) / 100;
                } else {
                  cumulativeLosses +=
                    (Math.abs(balanceValue) * participationPercentage) / 100;
                }
              }

              // Dividenden (typischerweise Konten 6000-6999 oder spezifische Konten)
              if (
                accountNumber.match(/^6[0-9]{3}/) ||
                accountName
                  .toLowerCase()
                  .match(/dividende|ausschüttung|dividend|distribution/i)
              ) {
                if (balanceValue < 0) {
                  // Dividenden sind typischerweise negativ (Ausschüttung)
                  cumulativeDividends +=
                    (Math.abs(balanceValue) * participationPercentage) / 100;
                }
              }
            }
          }
        }
      } else {
        missingInfo.push(
          'Keine historischen Financial Statements seit Erwerb gefunden. Anteilige Gewinne/Verluste können nicht berechnet werden.',
        );
      }
    } else {
      missingInfo.push(
        'Erwerbsdatum fehlt. Historische Entwicklungen können nicht berechnet werden.',
      );
    }

    // 4. Berechne Beteiligungsbuchwert nach HGB § 301
    const bookValue =
      acquisitionCost +
      cumulativeProfits -
      cumulativeLosses -
      cumulativeDividends;

    return {
      participationId: participation.id,
      parentCompanyId: participation.parent_company_id,
      subsidiaryCompanyId: participation.subsidiary_company_id,
      acquisitionCost,
      acquisitionDate: acquisitionDate || new Date(),
      participationPercentage,
      bookValue,
      calculationDetails: {
        acquisitionCost,
        cumulativeProfits,
        cumulativeLosses,
        cumulativeDividends,
      },
      missingInfo,
    };
  }

  /**
   * Prüft, ob Beteiligungsinformationen fehlen
   */
  async checkMissingInformation(participationId: string): Promise<{
    missing: boolean;
    missingFields: string[];
  }> {
    const { data: participation, error } = await this.supabase
      .from('participations')
      .select('*')
      .eq('id', participationId)
      .single();

    if (error || !participation) {
      return {
        missing: true,
        missingFields: ['Beteiligungsverhältnis nicht gefunden'],
      };
    }

    const missingFields: string[] = [];

    if (!participation.acquisition_cost) {
      missingFields.push('Anschaffungskosten');
    }

    if (!participation.acquisition_date) {
      missingFields.push('Erwerbsdatum');
    }

    if (!participation.participation_percentage) {
      missingFields.push('Beteiligungsquote');
    }

    return {
      missing: missingFields.length > 0,
      missingFields,
    };
  }
}
