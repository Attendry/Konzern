import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  ConsolidationObligationCheck,
  ConsolidationObligationReason,
  ConsolidationException,
} from '../../entities/consolidation-obligation-check.entity';

export interface ConsolidationObligationResult {
  companyId: string;
  companyName: string;
  isObligatory: boolean;
  reason: ConsolidationObligationReason | null;
  participationPercentage: number | null;
  hasUnifiedManagement: boolean | null;
  hasControlAgreement: boolean | null;
  exceptions: ConsolidationException[];
  warnings: string[];
  recommendations: string[];
  hgbReferences: string[];
}

@Injectable()
export class ConsolidationObligationService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Prüft die Konsolidierungspflicht für ein Unternehmen nach HGB § 290-292
   * HGB § 290: Grundsatz der Konsolidierungspflicht
   * HGB § 291: Beherrschungsvertrag
   * HGB § 292: Gemeinschaftsunternehmen
   */
  async checkObligation(companyId: string): Promise<ConsolidationObligationResult> {
    // 1. Lade Unternehmensdaten
    const { data: company, error: companyError } = await this.supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      throw new BadRequestException(`Unternehmen mit ID ${companyId} nicht gefunden`);
    }

    // 2. Prüfe Mehrheitsbeteiligung (>50%)
    const majorityInterestCheck = await this.checkMajorityInterest(companyId);

    // 3. Prüfe einheitliche Leitung (tatsächliche Beherrschung)
    const unifiedManagementCheck = await this.checkUnifiedManagement(companyId);

    // 4. Prüfe Beherrschungsvertrag
    const controlAgreementCheck = await this.checkControlAgreement(companyId);

    // 5. Prüfe Ausnahmen nach HGB § 296
    const exceptions = await this.checkExceptions(companyId);

    // 6. Bestimme Konsolidierungspflicht
    const isObligatory =
      majorityInterestCheck.hasMajorityInterest ||
      unifiedManagementCheck.hasUnifiedManagement ||
      controlAgreementCheck.hasControlAgreement;

    // 7. Bestimme Grund
    let reason: ConsolidationObligationReason | null = null;
    if (majorityInterestCheck.hasMajorityInterest) {
      reason = ConsolidationObligationReason.MAJORITY_INTEREST;
    } else if (unifiedManagementCheck.hasUnifiedManagement) {
      reason = ConsolidationObligationReason.UNIFIED_MANAGEMENT;
    } else if (controlAgreementCheck.hasControlAgreement) {
      reason = ConsolidationObligationReason.CONTROL_AGREEMENT;
    } else {
      reason = ConsolidationObligationReason.NONE;
    }

    // 8. Sammle Warnungen und Empfehlungen
    const warnings: string[] = [];
    const recommendations: string[] = [];
    const hgbReferences: string[] = [];

    if (isObligatory && !company.is_consolidated) {
      warnings.push(
        `Unternehmen "${company.name}" sollte konsolidiert werden, ist aber nicht als konsolidiert markiert (HGB § 290)`
      );
      recommendations.push('Bitte markieren Sie das Unternehmen als konsolidiert');
      hgbReferences.push('HGB § 290 Abs. 1');
    }

    if (majorityInterestCheck.hasMajorityInterest && majorityInterestCheck.participationPercentage) {
      hgbReferences.push('HGB § 290 Abs. 1 (Mehrheitsbeteiligung)');
      if (majorityInterestCheck.participationPercentage < 100) {
        recommendations.push(
          `Minderheitsanteile von ${(100 - majorityInterestCheck.participationPercentage).toFixed(2)}% müssen berücksichtigt werden (HGB § 301)`
        );
      }
    }

    if (unifiedManagementCheck.hasUnifiedManagement) {
      hgbReferences.push('HGB § 290 Abs. 1 (Einheitliche Leitung)');
      warnings.push(
        'Einheitliche Leitung erkannt - Konsolidierungspflicht besteht auch ohne Mehrheitsbeteiligung'
      );
    }

    if (controlAgreementCheck.hasControlAgreement) {
      hgbReferences.push('HGB § 291 (Beherrschungsvertrag)');
    }

    if (exceptions.length > 0) {
      hgbReferences.push('HGB § 296 (Ausnahmen)');
      warnings.push(
        `Ausnahmen erkannt: ${exceptions.join(', ')} - Konsolidierungspflicht kann entfallen`
      );
    }

    // 9. Speichere Prüfung
    await this.saveCheck({
      companyId,
      isObligatory: exceptions.length === 0 ? isObligatory : false,
      reason,
      participationPercentage: majorityInterestCheck.participationPercentage,
      hasUnifiedManagement: unifiedManagementCheck.hasUnifiedManagement,
      hasControlAgreement: controlAgreementCheck.hasControlAgreement,
      exceptions: exceptions.length > 0 ? exceptions : null,
    });

    return {
      companyId,
      companyName: company.name,
      isObligatory: exceptions.length === 0 ? isObligatory : false,
      reason,
      participationPercentage: majorityInterestCheck.participationPercentage,
      hasUnifiedManagement: unifiedManagementCheck.hasUnifiedManagement,
      hasControlAgreement: controlAgreementCheck.hasControlAgreement,
      exceptions,
      warnings,
      recommendations,
      hgbReferences,
    };
  }

  /**
   * Prüft Mehrheitsbeteiligung (>50%) nach HGB § 290 Abs. 1
   */
  async checkMajorityInterest(companyId: string): Promise<{
    hasMajorityInterest: boolean;
    participationPercentage: number | null;
  }> {
    // Suche nach Beteiligungen, bei denen dieses Unternehmen Tochtergesellschaft ist
    const { data: participations, error } = await this.supabase
      .from('participations')
      .select('participation_percentage, parent_company:companies!participations_parent_company_id_fkey(*)')
      .eq('subsidiary_company_id', companyId);

    if (error) {
      console.error('Error checking majority interest:', error);
      return { hasMajorityInterest: false, participationPercentage: null };
    }

    if (!participations || participations.length === 0) {
      return { hasMajorityInterest: false, participationPercentage: null };
    }

    // Summiere alle Beteiligungen (für den Fall mehrerer Gesellschafter)
    const totalParticipation = participations.reduce(
      (sum, p) => sum + parseFloat(p.participation_percentage || '0'),
      0
    );

    // Prüfe, ob eine einzelne Beteiligung >50% ist oder Gesamtbeteiligung >50%
    const maxParticipation = Math.max(
      ...participations.map((p) => parseFloat(p.participation_percentage || '0'))
    );

    const hasMajorityInterest = maxParticipation > 50 || totalParticipation > 50;

    return {
      hasMajorityInterest,
      participationPercentage: hasMajorityInterest ? maxParticipation : null,
    };
  }

  /**
   * Prüft einheitliche Leitung (tatsächliche Beherrschung) nach HGB § 290 Abs. 1
   * Hinweis: Dies erfordert manuelle Eingabe, da es nicht automatisch aus Daten ableitbar ist
   */
  async checkUnifiedManagement(companyId: string): Promise<{
    hasUnifiedManagement: boolean;
  }> {
    // Prüfe, ob bereits eine manuelle Entscheidung gespeichert wurde
    const { data: existingCheck } = await this.supabase
      .from('consolidation_obligation_checks')
      .select('has_unified_management')
      .eq('company_id', companyId)
      .order('checked_at', { ascending: false })
      .limit(1)
      .single();

    // Check if existingCheck exists AND has_unified_management is not null
    if (existingCheck && existingCheck.has_unified_management !== null) {
      return { hasUnifiedManagement: existingCheck.has_unified_management };
    }

    // Standard: Keine einheitliche Leitung (muss manuell bestätigt werden)
    // In der Praxis würde dies durch Prüfung von:
    // - Geschäftsführung/Management-Struktur
    // - Entscheidungsbefugnissen
    // - Abhängigkeitsverhältnissen
    // bestimmt werden
    return { hasUnifiedManagement: false };
  }

  /**
   * Prüft Beherrschungsvertrag nach HGB § 291
   * Hinweis: Dies erfordert manuelle Eingabe
   */
  async checkControlAgreement(companyId: string): Promise<{
    hasControlAgreement: boolean;
  }> {
    // Prüfe, ob bereits eine manuelle Entscheidung gespeichert wurde
    const { data: existingCheck } = await this.supabase
      .from('consolidation_obligation_checks')
      .select('has_control_agreement')
      .eq('company_id', companyId)
      .order('checked_at', { ascending: false })
      .limit(1)
      .single();

    // Check if existingCheck exists AND has_control_agreement is not null
    if (existingCheck && existingCheck.has_control_agreement !== null) {
      return { hasControlAgreement: existingCheck.has_control_agreement };
    }

    // Standard: Kein Beherrschungsvertrag
    return { hasControlAgreement: false };
  }

  /**
   * Prüft Ausnahmen nach HGB § 296 (Bedeutungslosigkeit, etc.)
   */
  async checkExceptions(companyId: string): Promise<ConsolidationException[]> {
    const exceptions: ConsolidationException[] = [];

    // Prüfe Bedeutungslosigkeit (§ 296 Abs. 1)
    const materialityCheck = await this.checkMateriality(companyId);
    if (materialityCheck.isMaterial) {
      exceptions.push(ConsolidationException.MATERIALITY);
    }

    // Weitere Ausnahmen können hier geprüft werden:
    // - Vorübergehende Beherrschung
    // - Schwerwiegende Beschränkungen
    // - Wesentlich abweichende Tätigkeiten

    return exceptions;
  }

  /**
   * Prüft Bedeutungslosigkeit nach HGB § 296 Abs. 1
   * Ein Unternehmen kann ausgelassen werden, wenn es für die Vermittlung eines den tatsächlichen Verhältnissen entsprechenden Bildes der Vermögens-, Finanz- und Ertragslage des Konzerns von untergeordneter Bedeutung ist.
   */
  async checkMateriality(companyId: string): Promise<{ isMaterial: boolean }> {
    // Lade Bilanzsumme des Unternehmens
    const { data: financialStatements } = await this.supabase
      .from('financial_statements')
      .select('id')
      .eq('company_id', companyId)
      .order('fiscal_year', { ascending: false })
      .limit(1);

    if (!financialStatements || financialStatements.length === 0) {
      return { isMaterial: false };
    }

    const latestStatementId = financialStatements[0].id;

    // Lade Bilanzsumme
    const { data: balances } = await this.supabase
      .from('account_balances')
      .select('balance, accounts!inner(account_type)')
      .eq('financial_statement_id', latestStatementId);

    if (!balances || balances.length === 0) {
      return { isMaterial: false };
    }

    // Berechne Bilanzsumme (Summe aller Aktiva)
    const totalAssets = balances
      .filter((b: any) => (b.accounts as any)?.account_type === 'asset')
      .reduce((sum, b) => sum + Math.abs(parseFloat(b.balance || '0')), 0);

    // Lade Konzern-Bilanzsumme (vereinfacht: Summe aller konsolidierten Unternehmen)
    const { data: consolidatedCompanies } = await this.supabase
      .from('companies')
      .select('id')
      .eq('is_consolidated', true);

    if (!consolidatedCompanies || consolidatedCompanies.length === 0) {
      return { isMaterial: false };
    }

    let totalConsolidatedAssets = 0;
    for (const company of consolidatedCompanies) {
      const { data: companyStatements } = await this.supabase
        .from('financial_statements')
        .select('id')
        .eq('company_id', company.id)
        .order('fiscal_year', { ascending: false })
        .limit(1);

      if (companyStatements && companyStatements.length > 0) {
        const { data: companyBalances } = await this.supabase
          .from('account_balances')
          .select('balance, accounts!inner(account_type)')
          .eq('financial_statement_id', companyStatements[0].id);

        if (companyBalances) {
          const companyAssets = companyBalances
            .filter((b: any) => (b.accounts as any)?.account_type === 'asset')
            .reduce((sum, b) => sum + Math.abs(parseFloat(b.balance || '0')), 0);
          totalConsolidatedAssets += companyAssets;
        }
      }
    }

    // Bedeutungslosigkeit: Bilanzsumme < 5% der Konzern-Bilanzsumme
    // (Dies ist eine vereinfachte Regel - in der Praxis werden mehrere Kriterien geprüft)
    const materialityThreshold = 0.05;
    const isMaterial = totalConsolidatedAssets > 0 && totalAssets / totalConsolidatedAssets < materialityThreshold;

    return { isMaterial };
  }

  /**
   * Prüft alle Unternehmen im Konzern
   */
  async checkAll(): Promise<ConsolidationObligationResult[]> {
    const { data: companies, error } = await this.supabase
      .from('companies')
      .select('id');

    if (error || !companies) {
      throw new BadRequestException('Fehler beim Laden der Unternehmen');
    }

    const results: ConsolidationObligationResult[] = [];
    for (const company of companies) {
      try {
        const result = await this.checkObligation(company.id);
        results.push(result);
      } catch (err) {
        console.error(`Error checking obligation for company ${company.id}:`, err);
      }
    }

    return results;
  }

  /**
   * Ruft Warnungen ab (Unternehmen, die konsolidiert werden sollten, aber nicht sind)
   */
  async getWarnings(): Promise<ConsolidationObligationResult[]> {
    const allResults = await this.checkAll();
    return allResults.filter(
      (r) => r.isObligatory && r.exceptions.length === 0 && r.warnings.length > 0
    );
  }

  /**
   * Speichert Prüfungsergebnis
   */
  private async saveCheck(check: {
    companyId: string;
    isObligatory: boolean;
    reason: ConsolidationObligationReason | null;
    participationPercentage: number | null;
    hasUnifiedManagement: boolean | null;
    hasControlAgreement: boolean | null;
    exceptions: ConsolidationException[] | null;
  }): Promise<void> {
    const { error } = await this.supabase.from('consolidation_obligation_checks').insert({
      company_id: check.companyId,
      is_obligatory: check.isObligatory,
      reason: check.reason,
      participation_percentage: check.participationPercentage,
      has_unified_management: check.hasUnifiedManagement,
      has_control_agreement: check.hasControlAgreement,
      exceptions: check.exceptions,
      checked_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error saving consolidation obligation check:', error);
    }
  }

  /**
   * Ruft letzte Prüfung für ein Unternehmen ab
   */
  async getLastCheck(companyId: string): Promise<ConsolidationObligationCheck | null> {
    const { data, error } = await this.supabase
      .from('consolidation_obligation_checks')
      .select('*')
      .eq('company_id', companyId)
      .order('checked_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return data as any;
  }

  /**
   * Aktualisiert manuelle Entscheidung
   */
  async updateManualDecision(
    companyId: string,
    decision: {
      hasUnifiedManagement?: boolean;
      hasControlAgreement?: boolean;
      exceptions?: ConsolidationException[];
      comment?: string;
    }
  ): Promise<void> {
    // Hole letzte Prüfung
    const lastCheck = await this.getLastCheck(companyId);
    if (!lastCheck) {
      throw new BadRequestException('Keine Prüfung für dieses Unternehmen gefunden');
    }

    // Aktualisiere mit manuellen Entscheidungen
    const { error } = await this.supabase
      .from('consolidation_obligation_checks')
      .update({
        has_unified_management: decision.hasUnifiedManagement ?? lastCheck.hasUnifiedManagement,
        has_control_agreement: decision.hasControlAgreement ?? lastCheck.hasControlAgreement,
        exceptions: decision.exceptions ?? lastCheck.exceptions,
        manual_decision_comment: decision.comment,
        checked_at: new Date().toISOString(),
      })
      .eq('id', lastCheck.id);

    if (error) {
      throw new BadRequestException(`Fehler beim Aktualisieren der manuellen Entscheidung: ${error.message}`);
    }
  }
}
