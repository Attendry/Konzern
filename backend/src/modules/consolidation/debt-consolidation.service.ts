import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { IntercompanyTransactionService, TransactionType } from './intercompany-transaction.service';
import { ConsolidationEntry, AdjustmentType } from '../../entities/consolidation-entry.entity';
import { SupabaseMapper } from '../../common/supabase-mapper.util';

export interface DebtConsolidationResult {
  entries: ConsolidationEntry[];
  summary: {
    totalEliminated: number;
    receivablesEliminated: number;
    payablesEliminated: number;
    loansEliminated: number;
    interestEliminated: number;
    otherLiabilitiesEliminated: number;
    unmatchedTransactions: number;
    missingInfo: string[];
  };
}

@Injectable()
export class DebtConsolidationService {
  constructor(
    private supabaseService: SupabaseService,
    private intercompanyService: IntercompanyTransactionService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Führt die vollständige Schuldenkonsolidierung durch
   */
  async consolidateDebts(
    financialStatementId: string,
    companyIds: string[],
  ): Promise<DebtConsolidationResult> {
    const entries: ConsolidationEntry[] = [];
    const missingInfo: string[] = [];

    // 1. Erkenne alle Zwischengesellschaftsgeschäfte
    const detectionResult = await this.intercompanyService.detectIntercompanyTransactions(
      financialStatementId,
    );

    if (detectionResult.missingInfo.length > 0) {
      missingInfo.push(...detectionResult.missingInfo);
    }

    // 2. Forderungen und Verbindlichkeiten verrechnen
    const receivablesPayablesResult = await this.consolidateReceivablesAndPayables(
      financialStatementId,
      detectionResult.transactions,
    );
    entries.push(...receivablesPayablesResult.entries);
    if (receivablesPayablesResult.missingInfo.length > 0) {
      missingInfo.push(...receivablesPayablesResult.missingInfo);
    }

    // 3. Kredite und Darlehen eliminieren
    const loansResult = await this.consolidateLoans(
      financialStatementId,
      detectionResult.transactions,
    );
    entries.push(...loansResult.entries);

    // 4. Zinsforderungen und -verbindlichkeiten eliminieren
    const interestResult = await this.consolidateInterest(
      financialStatementId,
      companyIds,
    );
    entries.push(...interestResult.entries);
    if (interestResult.missingInfo.length > 0) {
      missingInfo.push(...interestResult.missingInfo);
    }

    // 5. Sonstige Verbindlichkeiten eliminieren
    const otherLiabilitiesResult = await this.consolidateOtherLiabilities(
      financialStatementId,
      detectionResult.transactions,
    );
    entries.push(...otherLiabilitiesResult.entries);

    // Zusammenfassung
    const summary = {
      totalEliminated: entries.reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0),
      receivablesEliminated: receivablesPayablesResult.summary.receivablesEliminated,
      payablesEliminated: receivablesPayablesResult.summary.payablesEliminated,
      loansEliminated: loansResult.summary.loansEliminated,
      interestEliminated: interestResult.summary.interestEliminated,
      otherLiabilitiesEliminated: otherLiabilitiesResult.summary.otherLiabilitiesEliminated,
      unmatchedTransactions: receivablesPayablesResult.summary.unmatchedTransactions,
      missingInfo,
    };

    return { entries, summary };
  }

  /**
   * Verrechnet Forderungen und Verbindlichkeiten zwischen Konzernunternehmen
   * H↔TU, TU↔TU
   */
  private async consolidateReceivablesAndPayables(
    financialStatementId: string,
    transactions: any[],
  ): Promise<{
    entries: ConsolidationEntry[];
    summary: {
      receivablesEliminated: number;
      payablesEliminated: number;
      unmatchedTransactions: number;
    };
    missingInfo: string[];
  }> {
    const entries: ConsolidationEntry[] = [];
    const missingInfo: string[] = [];

    // Führe Matching durch
    const matchingResult = await this.intercompanyService.matchReceivablesAndPayables(
      transactions,
    );

    let receivablesEliminated = 0;
    let payablesEliminated = 0;

    // Eliminiere gematchte Forderungen und Verbindlichkeiten
    for (const match of matchingResult.matched) {
      // Saldenbildung pro Unternehmen-Paar
      const netAmount = match.matchedAmount;
      const difference = match.difference;

      // Eliminiere Forderung
      const { data: receivableEntry, error: recError } = await this.supabase
        .from('consolidation_entries')
        .insert({
          financial_statement_id: financialStatementId,
          account_id: match.receivable.accountId,
          adjustment_type: AdjustmentType.DEBT_CONSOLIDATION,
          amount: -netAmount, // Negativ, um zu eliminieren
          description: `Schuldenkonsolidierung: Forderung ${match.receivable.accountNumber} (${match.receivable.accountName}) von ${match.receivable.fromCompanyId} an ${match.receivable.toCompanyId}. Betrag: ${netAmount.toFixed(2)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!recError && receivableEntry) {
        entries.push(SupabaseMapper.toConsolidationEntry(receivableEntry));
        receivablesEliminated += netAmount;
      }

      // Eliminiere Verbindlichkeit
      const { data: payableEntry, error: payError } = await this.supabase
        .from('consolidation_entries')
        .insert({
          financial_statement_id: financialStatementId,
          account_id: match.payable.accountId,
          adjustment_type: AdjustmentType.DEBT_CONSOLIDATION,
          amount: netAmount, // Positiv, um Verbindlichkeit zu eliminieren
          description: `Schuldenkonsolidierung: Verbindlichkeit ${match.payable.accountNumber} (${match.payable.accountName}) von ${match.payable.fromCompanyId} an ${match.payable.toCompanyId}. Betrag: ${netAmount.toFixed(2)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!payError && payableEntry) {
        entries.push(SupabaseMapper.toConsolidationEntry(payableEntry));
        payablesEliminated += netAmount;
      }

      // Bei Betragsabweichung Warnung
      if (difference > 0.01) {
        missingInfo.push(
          `Betragsabweichung bei Schuldenkonsolidierung: Forderung ${match.receivable.accountNumber} (${match.receivable.amount.toFixed(2)}) vs. Verbindlichkeit ${match.payable.accountNumber} (${match.payable.amount.toFixed(2)}). Differenz: ${difference.toFixed(2)}`,
        );
      }
    }

    // Behandle nicht gematchte Transaktionen
    if (matchingResult.unmatched.length > 0) {
      missingInfo.push(
        `${matchingResult.unmatched.length} Transaktionen konnten nicht gematcht werden. Bei nicht eindeutig zuordenbaren Positionen wird der Nutzer "Pizzatracker" nach der Auswertung gefragt.`,
      );
    }

    if (matchingResult.missingInfo.length > 0) {
      missingInfo.push(...matchingResult.missingInfo);
    }

    return {
      entries,
      summary: {
        receivablesEliminated,
        payablesEliminated,
        unmatchedTransactions: matchingResult.unmatched.length,
      },
      missingInfo,
    };
  }

  /**
   * Eliminiert Kredite und Darlehen zwischen Konzernunternehmen
   */
  private async consolidateLoans(
    financialStatementId: string,
    transactions: any[],
  ): Promise<{
    entries: ConsolidationEntry[];
    summary: { loansEliminated: number };
  }> {
    const entries: ConsolidationEntry[] = [];
    let loansEliminated = 0;

    const loanTransactions = transactions.filter(
      (t) => t.transactionType === TransactionType.LOAN,
    );

    for (const loan of loanTransactions) {
      const { data: loanEntry, error: loanError } = await this.supabase
        .from('consolidation_entries')
        .insert({
          financial_statement_id: financialStatementId,
          account_id: loan.accountId,
          adjustment_type: AdjustmentType.DEBT_CONSOLIDATION,
          amount: -loan.amount, // Negativ, um zu eliminieren
          description: `Kredit/Darlehen-Eliminierung: ${loan.accountName} (${loan.accountNumber}) von ${loan.fromCompanyId} an ${loan.toCompanyId}. Betrag: ${loan.amount.toFixed(2)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!loanError && loanEntry) {
        entries.push(SupabaseMapper.toConsolidationEntry(loanEntry));
        loansEliminated += loan.amount;
      }
    }

    return {
      entries,
      summary: { loansEliminated },
    };
  }

  /**
   * Eliminiert Zinsforderungen und -verbindlichkeiten zwischen Konzernunternehmen
   */
  private async consolidateInterest(
    financialStatementId: string,
    companyIds: string[],
  ): Promise<{
    entries: ConsolidationEntry[];
    summary: { interestEliminated: number };
    missingInfo: string[];
  }> {
    const entries: ConsolidationEntry[] = [];
    const missingInfo: string[] = [];
    let interestEliminated = 0;

    // Finde alle Account Balances, die Zinsen betreffen
    const { data: interestBalances, error } = await this.supabase
      .from('account_balances')
      .select(
        '*, accounts(*), financial_statements!inner(company_id, companies(*))',
      )
      .eq('is_intercompany', true)
      .in('financial_statements.company_id', companyIds)
      .or('accounts.name.ilike.%zins%,accounts.name.ilike.%interest%,accounts.account_number.like.7%');

    if (error) {
      missingInfo.push(`Fehler beim Abrufen der Zins-Positionen: ${error.message}`);
      return { entries, summary: { interestEliminated }, missingInfo };
    }

    // Gruppiere Zinsforderungen und -verbindlichkeiten nach Unternehmen-Paaren
    const interestMap = new Map<string, { receivable: any; payable: any }>();

    for (const balance of interestBalances || []) {
      const account = balance.accounts;
      const fs = balance.financial_statements;
      const balanceValue = parseFloat(balance.balance) || 0;

      if (!account || !fs) continue;

      // Bestimme, ob es sich um eine Forderung oder Verbindlichkeit handelt
      const isReceivable = balanceValue > 0;
      const accountName = account.name.toLowerCase();

      // Versuche Geschäftspartner zu identifizieren
      // Vereinfacht: Suche nach anderen Unternehmen im Konzern
      for (const otherCompanyId of companyIds) {
        if (otherCompanyId === fs.company_id) continue;

        const key = `${fs.company_id}-${otherCompanyId}`;
        const reverseKey = `${otherCompanyId}-${fs.company_id}`;

        if (isReceivable) {
          // Zinsforderung
          if (!interestMap.has(key)) {
            interestMap.set(key, { receivable: null, payable: null });
          }
          const pair = interestMap.get(key)!;
          pair.receivable = { balance, account, fs, amount: balanceValue };
        } else {
          // Zinsverbindlichkeit
          if (!interestMap.has(reverseKey)) {
            interestMap.set(reverseKey, { receivable: null, payable: null });
          }
          const pair = interestMap.get(reverseKey)!;
          pair.payable = { balance, account, fs, amount: Math.abs(balanceValue) };
        }
      }
    }

    // Eliminiere gematchte Zinsforderungen und -verbindlichkeiten
    for (const [key, pair] of interestMap.entries()) {
      if (pair.receivable && pair.payable) {
        const matchedAmount = Math.min(pair.receivable.amount, pair.payable.amount);

        // Eliminiere Zinsforderung
        const { data: recEntry, error: recError } = await this.supabase
          .from('consolidation_entries')
          .insert({
            financial_statement_id: financialStatementId,
            account_id: pair.receivable.account.id,
            adjustment_type: AdjustmentType.DEBT_CONSOLIDATION,
            amount: -matchedAmount,
            description: `Zinsforderung-Eliminierung: ${pair.receivable.account.name} (${pair.receivable.account.account_number}) von ${pair.receivable.fs.company_id} an ${pair.payable.fs.company_id}. Betrag: ${matchedAmount.toFixed(2)}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (!recError && recEntry) {
          entries.push(SupabaseMapper.toConsolidationEntry(recEntry));
          interestEliminated += matchedAmount;
        }

        // Eliminiere Zinsverbindlichkeit
        const { data: payEntry, error: payError } = await this.supabase
          .from('consolidation_entries')
          .insert({
            financial_statement_id: financialStatementId,
            account_id: pair.payable.account.id,
            adjustment_type: AdjustmentType.DEBT_CONSOLIDATION,
            amount: matchedAmount,
            description: `Zinsverbindlichkeit-Eliminierung: ${pair.payable.account.name} (${pair.payable.account.account_number}) von ${pair.payable.fs.company_id} an ${pair.receivable.fs.company_id}. Betrag: ${matchedAmount.toFixed(2)}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (!payError && payEntry) {
          entries.push(SupabaseMapper.toConsolidationEntry(payEntry));
        }
      } else if (pair.receivable || pair.payable) {
        // Nicht gematchte Zins-Position
        missingInfo.push(
          `Zins-Position konnte nicht gematcht werden: ${pair.receivable ? pair.receivable.account.name : pair.payable.account.name}`,
        );
      }
    }

    return { entries, summary: { interestEliminated }, missingInfo };
  }

  /**
   * Eliminiert sonstige Verbindlichkeiten zwischen Konzernunternehmen
   * z.B. Verbindlichkeiten aus Lieferungen und Leistungen, sonstige Verbindlichkeiten, Rückstellungen
   */
  private async consolidateOtherLiabilities(
    financialStatementId: string,
    transactions: any[],
  ): Promise<{
    entries: ConsolidationEntry[];
    summary: { otherLiabilitiesEliminated: number };
  }> {
    const entries: ConsolidationEntry[] = [];
    let otherLiabilitiesEliminated = 0;

    // Finde sonstige Verbindlichkeiten (nicht Forderungen, nicht Kredite)
    const otherTransactions = transactions.filter(
      (t) =>
        t.transactionType === TransactionType.PAYABLE &&
        !t.accountName.toLowerCase().match(/kredit|darlehen|loan/i),
    );

    // Gruppiere nach Unternehmen-Paaren und verrechne
    const liabilityMap = new Map<string, any[]>();

    for (const transaction of otherTransactions) {
      const key = `${transaction.fromCompanyId}-${transaction.toCompanyId}`;
      if (!liabilityMap.has(key)) {
        liabilityMap.set(key, []);
      }
      liabilityMap.get(key)!.push(transaction);
    }

    // Eliminiere sonstige Verbindlichkeiten
    for (const [key, transactions] of liabilityMap.entries()) {
      const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

      for (const transaction of transactions) {
        const { data: entry, error } = await this.supabase
          .from('consolidation_entries')
          .insert({
            financial_statement_id: financialStatementId,
            account_id: transaction.accountId,
            adjustment_type: AdjustmentType.DEBT_CONSOLIDATION,
            amount: transaction.amount, // Positiv, um Verbindlichkeit zu eliminieren
            description: `Sonstige Verbindlichkeit-Eliminierung: ${transaction.accountName} (${transaction.accountNumber}) von ${transaction.fromCompanyId} an ${transaction.toCompanyId}. Betrag: ${transaction.amount.toFixed(2)}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (!error && entry) {
          entries.push(SupabaseMapper.toConsolidationEntry(entry));
          otherLiabilitiesEliminated += transaction.amount;
        }
      }
    }

    return {
      entries,
      summary: { otherLiabilitiesEliminated },
    };
  }
}
