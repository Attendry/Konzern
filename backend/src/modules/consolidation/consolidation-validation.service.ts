import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ConsolidatedBalanceSheetService } from './consolidated-balance-sheet.service';
import { DependencyIdentificationService } from '../company/dependency-identification.service';

export interface ConsolidationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  details: {
    balanceEquality: {
      isValid: boolean;
      totalAssets: number;
      totalLiabilities: number;
      difference: number;
    };
    completeness: {
      allCompaniesIncluded: boolean;
      allPositionsIncluded: boolean;
      allEliminationsApplied: boolean;
      missingCompanies: string[];
      missingPositions: string[];
    };
    plausibility: {
      amountPlausibility: boolean;
      structurePlausibility: boolean;
      temporalConsistency: boolean;
      unusualAmounts: string[];
      structuralIssues: string[];
    };
  };
}

@Injectable()
export class ConsolidationValidationService {
  constructor(
    private supabaseService: SupabaseService,
    private balanceSheetService: ConsolidatedBalanceSheetService,
    private dependencyService: DependencyIdentificationService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Führt alle Validierungsregeln für die Konsolidierung durch
   */
  async validateConsolidation(
    financialStatementId: string,
  ): Promise<ConsolidationValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Bilanzgleichheit prüfen
    const balanceEquality = await this.validateBalanceEquality(financialStatementId);
    if (!balanceEquality.isValid) {
      errors.push(...balanceEquality.errors);
    }
    if (balanceEquality.warnings.length > 0) {
      warnings.push(...balanceEquality.warnings);
    }

    // 2. Vollständigkeitsprüfung
    const completeness = await this.validateCompleteness(financialStatementId);
    if (!completeness.allCompaniesIncluded) {
      errors.push(
        `Nicht alle konsolidierungspflichtigen Unternehmen sind erfasst. Fehlende Unternehmen: ${completeness.missingCompanies.join(', ')}`,
      );
      warnings.push(
        'Bei fehlenden Unternehmen wird der Nutzer "Pizzatracker" nach der Auswertung gefragt.',
      );
    }
    if (!completeness.allPositionsIncluded) {
      warnings.push(
        `Möglicherweise fehlende Bilanzpositionen: ${completeness.missingPositions.join(', ')}`,
      );
      warnings.push(
        'Bei fehlenden Positionen wird der Nutzer "Pizzatracker" nach der Auswertung gefragt.',
      );
    }
    if (!completeness.allEliminationsApplied) {
      warnings.push('Nicht alle Eliminierungen wurden durchgeführt');
    }

    // 3. Plausibilitätsprüfungen
    const plausibility = await this.validatePlausibility(financialStatementId);
    if (!plausibility.amountPlausibility) {
      warnings.push(
        `Ungewöhnliche Beträge gefunden: ${plausibility.unusualAmounts.join(', ')}`,
      );
    }
    if (!plausibility.structurePlausibility) {
      warnings.push(
        `Strukturelle Probleme: ${plausibility.structuralIssues.join(', ')}`,
      );
    }
    if (!plausibility.temporalConsistency) {
      errors.push('Zeitliche Inkonsistenz: Nicht alle Daten stammen aus demselben Geschäftsjahr');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      details: {
        balanceEquality: {
          isValid: balanceEquality.isValid,
          totalAssets: balanceEquality.totalAssets,
          totalLiabilities: balanceEquality.totalLiabilities,
          difference: balanceEquality.difference,
        },
        completeness,
        plausibility,
      },
    };
  }

  /**
   * Validiert die Bilanzgleichheit
   */
  private async validateBalanceEquality(
    financialStatementId: string,
  ): Promise<{
    isValid: boolean;
    totalAssets: number;
    totalLiabilities: number;
    difference: number;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const validation = await this.balanceSheetService.validateBalanceEquality(
      financialStatementId,
    );

    if (!validation.isValid) {
      errors.push(...validation.errors);
    }
    if (validation.warnings.length > 0) {
      warnings.push(...validation.warnings);
    }

    return {
      isValid: validation.isValid,
      totalAssets: validation.totalAssets,
      totalLiabilities: validation.totalLiabilities,
      difference: validation.difference,
      errors,
      warnings,
    };
  }

  /**
   * Vollständigkeitsprüfung
   */
  private async validateCompleteness(
    financialStatementId: string,
  ): Promise<{
    allCompaniesIncluded: boolean;
    allPositionsIncluded: boolean;
    allEliminationsApplied: boolean;
    missingCompanies: string[];
    missingPositions: string[];
  }> {
    const missingCompanies: string[] = [];
    const missingPositions: string[] = [];

    // 1. Prüfe, ob alle konsolidierungspflichtigen Unternehmen erfasst sind
    const { data: financialStatement } = await this.supabase
      .from('financial_statements')
      .select('company_id')
      .eq('id', financialStatementId)
      .single();

    if (!financialStatement) {
      return {
        allCompaniesIncluded: false,
        allPositionsIncluded: false,
        allEliminationsApplied: false,
        missingCompanies: ['Financial Statement nicht gefunden'],
        missingPositions: [],
      };
    }

    const consolidationCircle = await this.dependencyService.determineConsolidationCircle(
      financialStatement.company_id,
    );

    const expectedCompanyIds = [
      consolidationCircle.parentCompany.id,
      ...consolidationCircle.subsidiaries.map((s) => s.id),
    ];

    // Prüfe, ob für alle Unternehmen Financial Statements existieren
    const { data: existingStatements } = await this.supabase
      .from('financial_statements')
      .select('company_id')
      .in('company_id', expectedCompanyIds)
      .eq('fiscal_year', (await this.supabase
        .from('financial_statements')
        .select('fiscal_year')
        .eq('id', financialStatementId)
        .single()).data?.fiscal_year);

    const existingCompanyIds = new Set(
      (existingStatements || []).map((fs: any) => fs.company_id),
    );

    for (const companyId of expectedCompanyIds) {
      if (!existingCompanyIds.has(companyId)) {
        missingCompanies.push(companyId);
      }
    }

    // 2. Prüfe auf fehlende Bilanzpositionen
    // Vereinfacht: Prüfe, ob alle erwarteten Kontotypen vorhanden sind
    const { data: balances } = await this.supabase
      .from('account_balances')
      .select('accounts(account_type)')
      .eq('financial_statement_id', financialStatementId);

    const accountTypes = new Set(
      (balances || []).map((b: any) => {
        const account = Array.isArray(b.accounts) ? b.accounts[0] : b.accounts;
        return account?.account_type;
      }).filter(Boolean),
    );

    const expectedAccountTypes = ['asset', 'liability', 'equity'];
    for (const accountType of expectedAccountTypes) {
      if (!accountTypes.has(accountType)) {
        missingPositions.push(`Keine ${accountType}-Positionen gefunden`);
      }
    }

    // 3. Prüfe, ob alle Eliminierungen durchgeführt wurden
    // Vereinfacht: Prüfe, ob Konsolidierungsbuchungen existieren
    const { data: consolidationEntries } = await this.supabase
      .from('consolidation_entries')
      .select('id')
      .eq('financial_statement_id', financialStatementId);

    const allEliminationsApplied = (consolidationEntries?.length || 0) > 0;

    return {
      allCompaniesIncluded: missingCompanies.length === 0,
      allPositionsIncluded: missingPositions.length === 0,
      allEliminationsApplied,
      missingCompanies,
      missingPositions,
    };
  }

  /**
   * Plausibilitätsprüfungen
   */
  private async validatePlausibility(
    financialStatementId: string,
  ): Promise<{
    amountPlausibility: boolean;
    structurePlausibility: boolean;
    temporalConsistency: boolean;
    unusualAmounts: string[];
    structuralIssues: string[];
  }> {
    const unusualAmounts: string[] = [];
    const structuralIssues: string[] = [];

    // 1. Betragsplausibilität
    const { data: balances } = await this.supabase
      .from('account_balances')
      .select('balance, accounts(*)')
      .eq('financial_statement_id', financialStatementId);

    if (balances) {
      for (const balance of balances) {
        const balanceValue = Math.abs(parseFloat(balance.balance) || 0);

        const account = Array.isArray(balance.accounts) ? balance.accounts[0] : balance.accounts;
        
        // Ungewöhnlich hohe Beträge (> 1 Milliarde)
        if (balanceValue > 1000000000) {
          unusualAmounts.push(
            `Ungewöhnlich hoher Betrag: ${account?.name || 'Unbekannt'} (${account?.account_number || 'N/A'}): ${balanceValue.toFixed(2)}`,
          );
        }

        // Ungewöhnlich niedrige Beträge bei wichtigen Positionen
        if (
          balanceValue < 0.01 &&
          account?.account_type === 'equity' &&
          account?.name?.toLowerCase().match(/kapital|equity/i)
        ) {
          unusualAmounts.push(
            `Ungewöhnlich niedriger Betrag bei wichtiger Position: ${account?.name || 'Unbekannt'} (${account?.account_number || 'N/A'})`,
          );
        }
      }
    }

    // 2. Strukturplausibilität
    const balanceSheet = await this.balanceSheetService.createConsolidatedBalanceSheet(
      financialStatementId,
    );

    // Prüfe Bilanzstruktur
    const assetsRatio = balanceSheet.assets.totalAssets > 0
      ? balanceSheet.assets.fixedAssets.reduce((sum, a) => sum + a.balance, 0) /
        balanceSheet.assets.totalAssets
      : 0;

    // Warnung bei ungewöhnlicher Struktur (z.B. zu wenig Anlagevermögen)
    if (assetsRatio < 0.1 && balanceSheet.assets.totalAssets > 10000) {
      structuralIssues.push(
        'Ungewöhnlich niedriger Anteil des Anlagevermögens an der Gesamtbilanz',
      );
    }

    // 3. Zeitliche Konsistenz
    const { data: financialStatements } = await this.supabase
      .from('financial_statements')
      .select('fiscal_year')
      .eq('id', financialStatementId)
      .single();

    const fiscalYear = financialStatements?.fiscal_year;

    if (fiscalYear) {
      // Prüfe, ob alle konsolidierten Unternehmen das gleiche Geschäftsjahr haben
      const { data: allStatements } = await this.supabase
        .from('financial_statements')
        .select('fiscal_year, company_id')
        .eq('fiscal_year', fiscalYear);

      // Vereinfacht: Prüfe, ob alle Statements das gleiche Jahr haben
      const differentYears = (allStatements || []).filter(
        (fs: any) => fs.fiscal_year !== fiscalYear,
      );

      if (differentYears.length > 0) {
        structuralIssues.push(
          `Nicht alle Financial Statements stammen aus demselben Geschäftsjahr`,
        );
      }
    }

    return {
      amountPlausibility: unusualAmounts.length === 0,
      structurePlausibility: structuralIssues.length === 0,
      temporalConsistency: structuralIssues.filter((s) =>
        s.includes('Geschäftsjahr'),
      ).length === 0,
      unusualAmounts,
      structuralIssues,
    };
  }
}
