import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { DependencyIdentificationService } from '../company/dependency-identification.service';

export enum TransactionType {
  RECEIVABLE = 'receivable', // Forderung
  PAYABLE = 'payable', // Verbindlichkeit
  DELIVERY = 'delivery', // Lieferung/Leistung
  LOAN = 'loan', // Kredit/Darlehen
  OTHER = 'other', // Sonstiges
}

export interface DetectedIntercompanyTransaction {
  fromCompanyId: string;
  toCompanyId: string;
  accountId: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  transactionType: TransactionType;
  isIntercompany: boolean;
  financialStatementId: string;
  companyName?: string;
}

export interface MatchedTransaction {
  receivable: DetectedIntercompanyTransaction;
  payable: DetectedIntercompanyTransaction;
  matchedAmount: number;
  difference: number;
}

@Injectable()
export class IntercompanyTransactionService {
  constructor(
    private supabaseService: SupabaseService,
    private dependencyService: DependencyIdentificationService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Automatische Erkennung von Zwischengesellschaftsgeschäften
   * Erkennt:
   * - Konten mit is_intercompany = true
   * - Forderungen zwischen Konzernunternehmen
   * - Verbindlichkeiten zwischen Konzernunternehmen
   * - Lieferungen und Leistungen
   * - Kredite und Darlehen
   */
  async detectIntercompanyTransactions(
    financialStatementId: string,
  ): Promise<{
    transactions: DetectedIntercompanyTransaction[];
    missingInfo: string[];
  }> {
    const missingInfo: string[] = [];

    // 1. Hole Financial Statement mit Unternehmen
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

    const companyId = financialStatement.company_id;

    // 2. Bestimme Konsolidierungskreis
    let consolidationCircle;
    try {
      consolidationCircle = await this.dependencyService.determineConsolidationCircle(
        companyId,
      );
    } catch (error) {
      missingInfo.push(
        'Konsolidierungskreis konnte nicht bestimmt werden. Bitte prüfen Sie die Unternehmenshierarchie.',
      );
      // Fallback: Nur das aktuelle Unternehmen
      consolidationCircle = {
        parentCompany: { id: companyId, name: financialStatement.companies?.name || 'Unbekannt', type: 'standalone' as const, parentCompanyId: null, children: [] },
        subsidiaries: [],
        consolidationRequired: false,
      };
    }

    const allCompanyIds = [
      consolidationCircle.parentCompany.id,
      ...consolidationCircle.subsidiaries.map((s) => s.id),
    ];

    // 3. Finde alle Account Balances mit is_intercompany Flag
    const { data: intercompanyBalances, error: balanceError } = await this.supabase
      .from('account_balances')
      .select(
        '*, accounts(*), financial_statements!inner(company_id, companies(*))',
      )
      .eq('is_intercompany', true)
      .in('financial_statements.company_id', allCompanyIds);

    if (balanceError) {
      throw new BadRequestException(
        `Fehler beim Abrufen der Intercompany-Bilanzen: ${balanceError.message}`,
      );
    }

    const transactions: DetectedIntercompanyTransaction[] = [];

    // 4. Analysiere jeden Balance und bestimme Transaktionstyp
    for (const balance of intercompanyBalances || []) {
      const account = balance.accounts;
      const fs = balance.financial_statements;
      const balanceValue = parseFloat(balance.balance) || 0;

      if (!account || !fs) continue;

      // Bestimme Transaktionstyp basierend auf Kontonummer und Kontoname
      const transactionType = this.determineTransactionType(
        account.account_number,
        account.name,
      );

      // Versuche Geschäftspartner zu identifizieren
      // Hinweis: Dies erfordert zusätzliche Informationen aus dem Kontonamen oder separaten Feldern
      const partnerInfo = await this.identifyBusinessPartner(
        account.name,
        account.account_number,
        fs.company_id,
        allCompanyIds,
      );

      if (partnerInfo.missingInfo) {
        missingInfo.push(
          `Konto ${account.account_number} (${account.name}): ${partnerInfo.missingInfo}`,
        );
      }

      // Erstelle Transaktion für Forderung (wenn Saldo positiv)
      if (balanceValue > 0 && transactionType === TransactionType.RECEIVABLE) {
        if (partnerInfo.toCompanyId) {
          transactions.push({
            fromCompanyId: fs.company_id,
            toCompanyId: partnerInfo.toCompanyId,
            accountId: account.id,
            accountNumber: account.account_number,
            accountName: account.name,
            amount: balanceValue,
            transactionType: TransactionType.RECEIVABLE,
            isIntercompany: true,
            financialStatementId: financialStatementId,
            companyName: fs.companies?.name,
          });
        }
      }

      // Erstelle Transaktion für Verbindlichkeit (wenn Saldo negativ)
      if (balanceValue < 0 && transactionType === TransactionType.PAYABLE) {
        if (partnerInfo.fromCompanyId) {
          transactions.push({
            fromCompanyId: partnerInfo.fromCompanyId,
            toCompanyId: fs.company_id,
            accountId: account.id,
            accountNumber: account.account_number,
            accountName: account.name,
            amount: Math.abs(balanceValue),
            transactionType: TransactionType.PAYABLE,
            isIntercompany: true,
            financialStatementId: financialStatementId,
            companyName: fs.companies?.name,
          });
        }
      }

      // Erstelle Transaktion für Lieferungen/Leistungen
      if (transactionType === TransactionType.DELIVERY) {
        if (partnerInfo.toCompanyId) {
          transactions.push({
            fromCompanyId: fs.company_id,
            toCompanyId: partnerInfo.toCompanyId,
            accountId: account.id,
            accountNumber: account.account_number,
            accountName: account.name,
            amount: Math.abs(balanceValue),
            transactionType: TransactionType.DELIVERY,
            isIntercompany: true,
            financialStatementId: financialStatementId,
            companyName: fs.companies?.name,
          });
        }
      }

      // Erstelle Transaktion für Kredite/Darlehen
      if (transactionType === TransactionType.LOAN) {
        if (partnerInfo.toCompanyId) {
          transactions.push({
            fromCompanyId: fs.company_id,
            toCompanyId: partnerInfo.toCompanyId,
            accountId: account.id,
            accountNumber: account.account_number,
            accountName: account.name,
            amount: Math.abs(balanceValue),
            transactionType: TransactionType.LOAN,
            isIntercompany: true,
            financialStatementId: financialStatementId,
            companyName: fs.companies?.name,
          });
        }
      }
    }

    // 5. Prüfe auf fehlende Informationen
    if (missingInfo.length > 0) {
      missingInfo.push(
        'Hinweis: Bei unvollständigen Informationen wird der Nutzer "Pizzatracker" nach der Auswertung gefragt.',
      );
    }

    return { transactions, missingInfo };
  }

  /**
   * Bestimmt den Transaktionstyp basierend auf Kontonummer und Kontoname
   */
  private determineTransactionType(
    accountNumber: string,
    accountName: string,
  ): TransactionType {
    const number = accountNumber.toLowerCase();
    const name = accountName.toLowerCase();

    // Forderungen (typischerweise Konten 1000-1999 oder spezifische Konten)
    if (
      number.match(/^1[0-9]{3}/) ||
      name.match(/forderung|receivable|ausstehend/i)
    ) {
      return TransactionType.RECEIVABLE;
    }

    // Verbindlichkeiten (typischerweise Konten 2000-2999)
    if (
      number.match(/^2[0-9]{3}/) ||
      name.match(/verbindlichkeit|payable|schulden/i)
    ) {
      return TransactionType.PAYABLE;
    }

    // Lieferungen/Leistungen (Umsatzerlöse, typischerweise Konten 8000-8999)
    if (
      number.match(/^8[0-9]{3}/) ||
      name.match(/umsatz|erlös|revenue|lieferung|leistung/i)
    ) {
      return TransactionType.DELIVERY;
    }

    // Kredite/Darlehen
    if (
      name.match(/kredit|darlehen|loan|finanzierung/i)
    ) {
      return TransactionType.LOAN;
    }

    return TransactionType.OTHER;
  }

  /**
   * Identifiziert den Geschäftspartner aus Kontonamen oder anderen Informationen
   */
  private async identifyBusinessPartner(
    accountName: string,
    accountNumber: string,
    currentCompanyId: string,
    allCompanyIds: string[],
  ): Promise<{
    fromCompanyId?: string;
    toCompanyId?: string;
    missingInfo?: string;
  }> {
    // Hole alle Unternehmen für Matching
    const { data: companies } = await this.supabase
      .from('companies')
      .select('id, name')
      .in('id', allCompanyIds);

    if (!companies || companies.length === 0) {
      return {
        missingInfo: 'Keine Unternehmen für Partner-Identifikation gefunden',
      };
    }

    // Versuche Unternehmensname im Kontonamen zu finden
    const accountNameLower = accountName.toLowerCase();
    for (const company of companies) {
      if (company.id === currentCompanyId) continue;

      const companyNameLower = company.name.toLowerCase();
      // Prüfe, ob Unternehmensname im Kontonamen vorkommt
      if (accountNameLower.includes(companyNameLower)) {
        // Bestimme Richtung basierend auf Transaktionstyp
        // Vereinfacht: Bei Forderungen ist currentCompany der Gläubiger
        return {
          fromCompanyId: currentCompanyId,
          toCompanyId: company.id,
        };
      }
    }

    // Wenn kein Match gefunden, versuche über Konsolidierungskreis
    // Bei fehlenden Informationen sollte Pizzatracker gefragt werden
    return {
      missingInfo: `Geschäftspartner für Konto ${accountNumber} (${accountName}) konnte nicht eindeutig identifiziert werden. Bitte manuell zuordnen.`,
    };
  }

  /**
   * Matching-Algorithmus: Verrechnet Forderungen und Verbindlichkeiten
   */
  async matchReceivablesAndPayables(
    transactions: DetectedIntercompanyTransaction[],
  ): Promise<{
    matched: MatchedTransaction[];
    unmatched: DetectedIntercompanyTransaction[];
    missingInfo: string[];
  }> {
    const matched: MatchedTransaction[] = [];
    const unmatched: DetectedIntercompanyTransaction[] = [];
    const missingInfo: string[] = [];

    // Trenne Forderungen und Verbindlichkeiten
    const receivables = transactions.filter(
      (t) => t.transactionType === TransactionType.RECEIVABLE,
    );
    const payables = transactions.filter(
      (t) => t.transactionType === TransactionType.PAYABLE,
    );

    // Matching-Algorithmus
    for (const receivable of receivables) {
      // Finde passende Verbindlichkeit
      const matchingPayable = payables.find(
        (p) =>
          p.fromCompanyId === receivable.toCompanyId &&
          p.toCompanyId === receivable.fromCompanyId &&
          Math.abs(p.amount - receivable.amount) < 0.01, // Toleranz für Rundungsfehler
      );

      if (matchingPayable) {
        // Exaktes Matching gefunden
        matched.push({
          receivable,
          payable: matchingPayable,
          matchedAmount: receivable.amount,
          difference: 0,
        });
        // Entferne aus payables, damit nicht doppelt gematcht wird
        const index = payables.indexOf(matchingPayable);
        if (index > -1) payables.splice(index, 1);
      } else {
        // Versuche partielles Matching (gleiche Unternehmen, unterschiedliche Beträge)
        const partialMatch = payables.find(
          (p) =>
            p.fromCompanyId === receivable.toCompanyId &&
            p.toCompanyId === receivable.fromCompanyId,
        );

        if (partialMatch) {
          const matchedAmount = Math.min(receivable.amount, partialMatch.amount);
          const difference = Math.abs(receivable.amount - partialMatch.amount);

          matched.push({
            receivable,
            payable: partialMatch,
            matchedAmount,
            difference,
          });

          if (difference > 0.01) {
            missingInfo.push(
              `Betragsabweichung bei Matching: Forderung ${receivable.accountNumber} (${receivable.amount.toFixed(2)}) vs. Verbindlichkeit ${partialMatch.accountNumber} (${partialMatch.amount.toFixed(2)}). Differenz: ${difference.toFixed(2)}`,
            );
          }

          // Entferne aus payables
          const index = payables.indexOf(partialMatch);
          if (index > -1) payables.splice(index, 1);
        } else {
          // Kein Matching gefunden
          unmatched.push(receivable);
          missingInfo.push(
            `Keine passende Verbindlichkeit für Forderung ${receivable.accountNumber} (${receivable.accountName}) von ${receivable.fromCompanyId} an ${receivable.toCompanyId} gefunden.`,
          );
        }
      }
    }

    // Übrige Verbindlichkeiten ohne Matching
    unmatched.push(...payables);

    if (missingInfo.length > 0) {
      missingInfo.push(
        'Hinweis: Bei nicht eindeutig zuordenbaren Positionen wird der Nutzer "Pizzatracker" nach der Auswertung gefragt.',
      );
    }

    return { matched, unmatched, missingInfo };
  }

  /**
   * Get all IC reconciliation records for a financial statement
   */
  async getICReconciliations(financialStatementId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('ic_reconciliations')
      .select(`
        *,
        company_a:companies!ic_reconciliations_company_a_id_fkey(id, name),
        company_b:companies!ic_reconciliations_company_b_id_fkey(id, name),
        account_a:accounts!ic_reconciliations_account_a_id_fkey(id, account_number, name),
        account_b:accounts!ic_reconciliations_account_b_id_fkey(id, account_number, name)
      `)
      .eq('financial_statement_id', financialStatementId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Fehler beim Laden der IC-Abstimmungen: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Create IC reconciliation records from matched transactions
   */
  async createICReconciliationsFromMatching(
    financialStatementId: string,
  ): Promise<{ created: number; differences: number }> {
    // Get detected transactions and match them
    const { transactions } = await this.detectIntercompanyTransactions(financialStatementId);
    const { matched, unmatched } = await this.matchReceivablesAndPayables(transactions);

    let created = 0;
    let differences = 0;

    // Create reconciliation records for matched transactions
    for (const match of matched) {
      const differenceAmount = match.receivable.amount - match.payable.amount;
      const status = Math.abs(differenceAmount) < 0.01 ? 'cleared' : 'open';

      if (Math.abs(differenceAmount) >= 0.01) {
        differences++;
      }

      const { error } = await this.supabase
        .from('ic_reconciliations')
        .insert({
          financial_statement_id: financialStatementId,
          company_a_id: match.receivable.fromCompanyId,
          company_b_id: match.payable.fromCompanyId,
          account_a_id: match.receivable.accountId,
          account_b_id: match.payable.accountId,
          amount_company_a: match.receivable.amount,
          amount_company_b: match.payable.amount,
          difference_amount: differenceAmount,
          status: status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (!error) created++;
    }

    // Create reconciliation records for unmatched transactions (as open differences)
    for (const tx of unmatched) {
      const isReceivable = tx.transactionType === TransactionType.RECEIVABLE;
      
      const { error } = await this.supabase
        .from('ic_reconciliations')
        .insert({
          financial_statement_id: financialStatementId,
          company_a_id: isReceivable ? tx.fromCompanyId : tx.toCompanyId,
          company_b_id: isReceivable ? tx.toCompanyId : tx.fromCompanyId,
          account_a_id: tx.accountId,
          account_b_id: tx.accountId, // Same account as placeholder
          amount_company_a: isReceivable ? tx.amount : 0,
          amount_company_b: isReceivable ? 0 : tx.amount,
          difference_amount: tx.amount,
          status: 'open',
          difference_reason: 'missing_entry',
          explanation: `Keine Gegenbuchung gefunden für ${tx.accountName}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (!error) {
        created++;
        differences++;
      }
    }

    return { created, differences };
  }

  /**
   * Update IC reconciliation status and explanation
   */
  async updateICReconciliation(
    reconciliationId: string,
    updateData: {
      status?: string;
      differenceReason?: string;
      explanation?: string;
      resolvedByUserId?: string;
    },
  ): Promise<any> {
    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (updateData.status) updatePayload.status = updateData.status;
    if (updateData.differenceReason) updatePayload.difference_reason = updateData.differenceReason;
    if (updateData.explanation) updatePayload.explanation = updateData.explanation;
    if (updateData.resolvedByUserId) {
      updatePayload.resolved_by_user_id = updateData.resolvedByUserId;
      updatePayload.resolved_at = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('ic_reconciliations')
      .update(updatePayload)
      .eq('id', reconciliationId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Fehler beim Aktualisieren: ${error.message}`);
    }

    return data;
  }

  /**
   * Generate clearing entry for IC difference
   */
  async generateClearingEntry(
    reconciliationId: string,
    userId: string,
  ): Promise<{ entryId: string; reconciliation: any }> {
    // Get the reconciliation
    const { data: recon, error: fetchError } = await this.supabase
      .from('ic_reconciliations')
      .select('*')
      .eq('id', reconciliationId)
      .single();

    if (fetchError || !recon) {
      throw new BadRequestException('IC-Abstimmung nicht gefunden');
    }

    if (recon.status === 'cleared') {
      throw new BadRequestException('Diese Differenz wurde bereits ausgeglichen');
    }

    const differenceAmount = parseFloat(recon.difference_amount);
    if (Math.abs(differenceAmount) < 0.01) {
      throw new BadRequestException('Keine Differenz zum Ausgleichen vorhanden');
    }

    // Create clearing consolidation entry
    const { data: entry, error: entryError } = await this.supabase
      .from('consolidation_entries')
      .insert({
        financial_statement_id: recon.financial_statement_id,
        debit_account_id: differenceAmount > 0 ? recon.account_b_id : recon.account_a_id,
        credit_account_id: differenceAmount > 0 ? recon.account_a_id : recon.account_b_id,
        adjustment_type: 'debt_consolidation',
        amount: Math.abs(differenceAmount),
        description: `IC-Differenzausgleich: ${recon.explanation || 'Automatisch generiert'}`,
        source: 'manual',
        hgb_reference: '§ 303 HGB',
        affected_company_ids: [recon.company_a_id, recon.company_b_id],
        created_by_user_id: userId,
        status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (entryError) {
      throw new BadRequestException(`Fehler beim Erstellen der Buchung: ${entryError.message}`);
    }

    // Update reconciliation
    const { data: updatedRecon, error: updateError } = await this.supabase
      .from('ic_reconciliations')
      .update({
        status: 'cleared',
        clearing_entry_id: entry.id,
        resolved_by_user_id: userId,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reconciliationId)
      .select()
      .single();

    if (updateError) {
      throw new BadRequestException(`Fehler beim Aktualisieren der Abstimmung: ${updateError.message}`);
    }

    return { entryId: entry.id, reconciliation: updatedRecon };
  }

  /**
   * Get IC reconciliation summary
   */
  async getICReconciliationSummary(financialStatementId: string): Promise<{
    total: number;
    open: number;
    explained: number;
    cleared: number;
    accepted: number;
    totalDifferenceAmount: number;
    openDifferenceAmount: number;
  }> {
    const { data, error } = await this.supabase
      .from('ic_reconciliations')
      .select('status, difference_amount')
      .eq('financial_statement_id', financialStatementId);

    if (error) {
      throw new BadRequestException(`Fehler: ${error.message}`);
    }

    const records = data || [];
    const total = records.length;
    const open = records.filter(r => r.status === 'open').length;
    const explained = records.filter(r => r.status === 'explained').length;
    const cleared = records.filter(r => r.status === 'cleared').length;
    const accepted = records.filter(r => r.status === 'accepted').length;
    
    const totalDifferenceAmount = records.reduce(
      (sum, r) => sum + Math.abs(parseFloat(r.difference_amount) || 0), 
      0
    );
    const openDifferenceAmount = records
      .filter(r => r.status === 'open')
      .reduce((sum, r) => sum + Math.abs(parseFloat(r.difference_amount) || 0), 0);

    return {
      total,
      open,
      explained,
      cleared,
      accepted,
      totalDifferenceAmount,
      openDifferenceAmount,
    };
  }
}
