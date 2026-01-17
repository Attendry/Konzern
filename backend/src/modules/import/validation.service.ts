import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class ValidationService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Validiert die Kontenplan-Struktur
   */
  async validateChartOfAccounts(
    accountNumbers: string[],
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Prüfe auf doppelte Kontonummern
    const duplicates = accountNumbers.filter(
      (num, index) => accountNumbers.indexOf(num) !== index,
    );
    if (duplicates.length > 0) {
      errors.push(
        `Doppelte Kontonummern gefunden: ${[...new Set(duplicates)].join(', ')}`,
      );
    }

    // Prüfe auf gültige Kontonummern-Format
    const invalidFormat = accountNumbers.filter(
      (num) => !/^\d+$/.test(num) && num.length > 0,
    );
    if (invalidFormat.length > 0) {
      warnings.push(
        `Ungültiges Format bei Kontonummern: ${invalidFormat.slice(0, 5).join(', ')}${invalidFormat.length > 5 ? '...' : ''}`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validiert die Bilanzstruktur (Aktiva = Passiva)
   */
  async validateBalanceSheet(
    financialStatementId: string,
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const { data: balances, error } = await this.supabase
      .from('account_balances')
      .select('balance, accounts(account_type)')
      .eq('financial_statement_id', financialStatementId);

    if (error) {
      return {
        isValid: false,
        errors: [`Fehler beim Abrufen der Bilanzdaten: ${error.message}`],
        warnings: [],
      };
    }

    if (!balances || balances.length === 0) {
      warnings.push('Keine Bilanzdaten gefunden');
      return { isValid: true, errors, warnings };
    }

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    balances.forEach((balance: any) => {
      const account = Array.isArray(balance.accounts)
        ? balance.accounts[0]
        : balance.accounts;
      const accountType = account?.account_type;
      const balanceValue = parseFloat(balance.balance) || 0;

      if (accountType === 'asset') {
        totalAssets += balanceValue;
      } else if (accountType === 'liability') {
        totalLiabilities += balanceValue;
      } else if (accountType === 'equity') {
        totalEquity += balanceValue;
      }
    });

    const totalAktiva = totalAssets;
    const totalPassiva = totalLiabilities + totalEquity;
    const difference = Math.abs(totalAktiva - totalPassiva);

    if (difference > 0.01) {
      // Toleranz für Rundungsfehler
      errors.push(
        `Bilanzgleichheit verletzt: Aktiva (${totalAktiva.toFixed(2)}) ≠ Passiva (${totalPassiva.toFixed(2)}). Differenz: ${difference.toFixed(2)}`,
      );
    } else if (difference > 0) {
      warnings.push(
        `Geringe Bilanzabweichung: ${difference.toFixed(2)} (möglicher Rundungsfehler)`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validiert den Zeitraum (alle Daten aus demselben Geschäftsjahr)
   */
  async validatePeriodConsistency(
    financialStatementId: string,
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const { data: financialStatement, error } = await this.supabase
      .from('financial_statements')
      .select('fiscal_year, period_start, period_end')
      .eq('id', financialStatementId)
      .single();

    if (error || !financialStatement) {
      return {
        isValid: false,
        errors: [`Financial Statement nicht gefunden: ${error?.message}`],
        warnings: [],
      };
    }

    // Prüfe, ob period_start und period_end zum fiscal_year passen
    const periodStart = new Date(financialStatement.period_start);
    const periodEnd = new Date(financialStatement.period_end);
    const fiscalYear = financialStatement.fiscal_year;

    if (periodStart.getFullYear() !== fiscalYear) {
      warnings.push(
        `Periodenstart (${periodStart.getFullYear()}) passt nicht zum Geschäftsjahr (${fiscalYear})`,
      );
    }

    if (periodEnd.getFullYear() !== fiscalYear) {
      warnings.push(
        `Periodenende (${periodEnd.getFullYear()}) passt nicht zum Geschäftsjahr (${fiscalYear})`,
      );
    }

    if (periodStart >= periodEnd) {
      errors.push('Periodenstart muss vor Periodenende liegen');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validiert die Währungskonsistenz
   * (Hinweis: Aktuell wird nur eine Währung unterstützt, könnte erweitert werden)
   */
  async validateCurrencyConsistency(
    financialStatementId: string,
  ): Promise<ValidationResult> {
    const warnings: string[] = [];

    // Aktuell wird nur eine Währung unterstützt
    // In Zukunft könnte hier eine Währungsspalte in account_balances hinzugefügt werden
    warnings.push(
      'Währungskonsistenz: Aktuell wird nur eine Währung (EUR) unterstützt',
    );

    return {
      isValid: true,
      errors: [],
      warnings,
    };
  }

  /**
   * Führt alle Validierungen durch
   */
  async validateAll(
    financialStatementId: string,
    accountNumbers?: string[],
  ): Promise<ValidationResult> {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    // Kontenplan-Validierung
    if (accountNumbers && accountNumbers.length > 0) {
      const chartResult = await this.validateChartOfAccounts(accountNumbers);
      allErrors.push(...chartResult.errors);
      allWarnings.push(...chartResult.warnings);
    }

    // Bilanzstruktur-Validierung
    const balanceResult = await this.validateBalanceSheet(financialStatementId);
    allErrors.push(...balanceResult.errors);
    allWarnings.push(...balanceResult.warnings);

    // Zeitraum-Validierung
    const periodResult =
      await this.validatePeriodConsistency(financialStatementId);
    allErrors.push(...periodResult.errors);
    allWarnings.push(...periodResult.warnings);

    // Währungskonsistenz
    const currencyResult =
      await this.validateCurrencyConsistency(financialStatementId);
    allWarnings.push(...currencyResult.warnings);

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
    };
  }
}
