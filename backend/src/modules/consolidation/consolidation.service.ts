import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseErrorHandler } from '../../common/supabase-error.util';
import { SupabaseMapper } from '../../common/supabase-mapper.util';
import { FinancialStatement } from '../../entities/financial-statement.entity';
import { AccountBalance } from '../../entities/account-balance.entity';
import {
  ConsolidationEntry,
  AdjustmentType,
  EntryStatus,
  EntrySource,
} from '../../entities/consolidation-entry.entity';
import { Company } from '../../entities/company.entity';
import { IntercompanyTransaction } from '../../entities/intercompany-transaction.entity';
import {
  CreateConsolidationEntryDto,
  UpdateConsolidationEntryDto,
} from './dto/create-consolidation-entry.dto';
import {
  IntercompanyTransactionService,
  TransactionType,
} from './intercompany-transaction.service';
import { DebtConsolidationService } from './debt-consolidation.service';
import { CapitalConsolidationService } from './capital-consolidation.service';

@Injectable()
export class ConsolidationService {
  private readonly logger = new Logger(ConsolidationService.name);

  constructor(
    private supabaseService: SupabaseService,
    private intercompanyService: IntercompanyTransactionService,
    private debtConsolidationService: DebtConsolidationService,
    private capitalConsolidationService: CapitalConsolidationService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  async calculateConsolidation(
    financialStatementId: string,
  ): Promise<{ entries: ConsolidationEntry[]; summary: any }> {
    this.logger.log(
      `Starting consolidation for financial statement: ${financialStatementId}`,
    );

    const { data: financialStatement, error: fsError } = await this.supabase
      .from('financial_statements')
      .select('*, company:companies(*)')
      .eq('id', financialStatementId)
      .single();

    if (fsError) {
      this.logger.error(
        `Error fetching financial statement: ${fsError.message}`,
      );
      SupabaseErrorHandler.handle(fsError, 'Financial Statement', 'fetch');
    }
    SupabaseErrorHandler.handleNotFound(
      financialStatement,
      'Financial Statement',
    );

    this.logger.debug(
      `Financial statement found - company_id: ${financialStatement.company_id}`,
    );

    // Find all consolidated companies in the group
    const consolidatedCompanies = await this.getConsolidatedCompanies(
      financialStatement.company_id,
    );

    this.logger.log(
      `Found ${consolidatedCompanies.length} consolidated companies`,
    );

    if (consolidatedCompanies.length === 0) {
      this.logger.warn('No consolidated companies found');
      // Check if the parent company exists and is marked for consolidation
      const { data: parentCompany } = await this.supabase
        .from('companies')
        .select('id, name, is_consolidated, parent_company_id')
        .eq('id', financialStatement.company_id)
        .single();

      if (!parentCompany) {
        throw new BadRequestException(
          `Das Unternehmen mit ID ${financialStatement.company_id} wurde nicht gefunden. Bitte prüfen Sie, ob das Unternehmen existiert.`,
        );
      }

      if (!parentCompany.is_consolidated) {
        throw new BadRequestException(
          `Das Unternehmen "${parentCompany.name}" ist nicht für die Konsolidierung markiert. Bitte setzen Sie "Wird konsolidiert" auf "Ja" im Unternehmen.`,
        );
      }

      throw new BadRequestException(
        'Keine konsolidierten Unternehmen gefunden. Bitte stellen Sie sicher, dass:\n' +
          '1. Das Unternehmen für die Konsolidierung markiert ist (is_consolidated = true)\n' +
          '2. Es Tochterunternehmen gibt, die ebenfalls für die Konsolidierung markiert sind\n' +
          '3. Die Unternehmen korrekt verknüpft sind (parent_company_id)',
      );
    }

    const entries: ConsolidationEntry[] = [];

    // 1. Zwischenergebniseliminierung
    const intercompanyEliminations = await this.eliminateIntercompanyProfits(
      financialStatementId,
      consolidatedCompanies,
    );
    entries.push(...intercompanyEliminations);

    // 2. Schuldenkonsolidierung
    const companyIds = consolidatedCompanies.map((c) => c.id);
    const debtConsolidationResult =
      await this.debtConsolidationService.consolidateDebts(
        financialStatementId,
        companyIds,
      );
    entries.push(...debtConsolidationResult.entries);

    // Warnung bei fehlenden Informationen
    if (debtConsolidationResult.summary.missingInfo.length > 0) {
      this.logger.warn(
        `Missing info in debt consolidation: ${JSON.stringify(debtConsolidationResult.summary.missingInfo)}`,
      );
    }

    // 3. Kapitalkonsolidierung
    const capitalConsolidationResult =
      await this.capitalConsolidationService.consolidateCapital(
        financialStatementId,
        financialStatement.company_id,
      );
    entries.push(...capitalConsolidationResult.entries);

    // Warnung bei fehlenden Informationen
    if (capitalConsolidationResult.summary.missingInfo.length > 0) {
      this.logger.warn(
        `Missing info in capital consolidation: ${JSON.stringify(capitalConsolidationResult.summary.missingInfo)}`,
      );
    }

    // Zusammenfassung
    const summary = {
      totalEntries: entries.length,
      intercompanyEliminations: intercompanyEliminations.length,
      debtConsolidations: debtConsolidationResult.entries.length,
      capitalConsolidations: capitalConsolidationResult.entries.length,
      totalAmount: entries.reduce(
        (sum, entry) => sum + Math.abs(Number(entry.amount)),
        0,
      ),
    };

    return { entries, summary };
  }

  private async getConsolidatedCompanies(
    parentCompanyId: string,
  ): Promise<Company[]> {
    this.logger.debug(
      `getConsolidatedCompanies - Looking for companies with parent: ${parentCompanyId}`,
    );

    // Finde alle Tochterunternehmen, die konsolidiert werden sollen
    const { data: parentCompany, error: parentError } = await this.supabase
      .from('companies')
      .select('*')
      .eq('id', parentCompanyId)
      .single();

    if (parentError) {
      this.logger.error(
        `Error fetching parent company: ${parentError.message}`,
      );
    }

    // Check if parent company is marked for consolidation (don't filter here, check later)
    const { data: directChildren, error: childrenError } = await this.supabase
      .from('companies')
      .select('*')
      .eq('parent_company_id', parentCompanyId);

    if (childrenError) {
      this.logger.error(
        `Error fetching children companies: ${childrenError.message}`,
      );
    }

    this.logger.debug(
      `Parent company found: ${parentCompany ? 'yes' : 'no'}, is_consolidated: ${parentCompany?.is_consolidated}`,
    );
    this.logger.debug(`Direct children found: ${directChildren?.length || 0}`);

    // Rekursiv alle Unter-Tochterunternehmen finden
    const allCompanies: any[] = [];

    // Add parent company if it's marked for consolidation
    if (parentCompany && parentCompany.is_consolidated) {
      allCompanies.push(parentCompany);
      this.logger.debug(`Added parent company: ${parentCompany.name}`);
    }

    // Add direct children that are marked for consolidation
    const consolidatedChildren = (directChildren || []).filter(
      (c: any) => c.is_consolidated,
    );
    if (consolidatedChildren.length > 0) {
      allCompanies.push(...consolidatedChildren);
      this.logger.debug(
        `Added ${consolidatedChildren.length} consolidated children`,
      );
    }

    // Recursively find grandchildren
    for (const company of consolidatedChildren) {
      const { data: children, error: grandChildrenError } = await this.supabase
        .from('companies')
        .select('*')
        .eq('parent_company_id', company.id);

      if (grandChildrenError) {
        this.logger.error(
          `Error fetching grandchildren for ${company.id}: ${grandChildrenError.message}`,
        );
      }

      const consolidatedGrandChildren = (children || []).filter(
        (c: any) => c.is_consolidated,
      );
      if (consolidatedGrandChildren.length > 0) {
        allCompanies.push(...consolidatedGrandChildren);
        this.logger.debug(
          `Added ${consolidatedGrandChildren.length} consolidated grandchildren for ${company.name}`,
        );
      }
    }

    this.logger.log(
      `Total consolidated companies found: ${allCompanies.length}`,
    );

    return allCompanies.map((c: any) => ({
      id: c.id,
      name: c.name,
      taxId: c.tax_id,
      address: c.address,
      legalForm: c.legal_form,
      parentCompanyId: c.parent_company_id,
      parentCompany: null,
      children: [],
      financialStatements: [],
      isConsolidated: c.is_consolidated,
      consolidationType: c.consolidation_type || 'full',
      exclusionReason: c.exclusion_reason || null,
      firstConsolidationDate: c.first_consolidation_date
        ? new Date(c.first_consolidation_date)
        : null,
      deconsolidationDate: c.deconsolidation_date
        ? new Date(c.deconsolidation_date)
        : null,
      functionalCurrency: c.functional_currency || 'EUR',
      countryCode: c.country_code || null,
      industry: c.industry || null,
      fiscalYearEndMonth: c.fiscal_year_end_month ?? 12,
      notes: c.notes || null,
      isUltimateParent: c.is_ultimate_parent ?? false,
      createdAt: new Date(c.created_at),
      updatedAt: new Date(c.updated_at),
    }));
  }

  private async eliminateIntercompanyProfits(
    financialStatementId: string,
    companies: Company[],
  ): Promise<ConsolidationEntry[]> {
    const entries: ConsolidationEntry[] = [];

    // 1. Erkenne alle Zwischengesellschaftsgeschäfte
    const detectionResult =
      await this.intercompanyService.detectIntercompanyTransactions(
        financialStatementId,
      );

    // 2. Prüfe auf fehlende Informationen (Pizzatracker-Hinweis)
    if (detectionResult.missingInfo.length > 0) {
      this.logger.warn(
        `Missing info in intercompany transactions: ${JSON.stringify(detectionResult.missingInfo)}`,
      );
      // Hinweis: In Produktion sollte hier der Nutzer "Pizzatracker" gefragt werden
    }

    // 3. Eliminiere Zwischengewinne aus Lieferungen/Leistungen
    const deliveryTransactions = detectionResult.transactions.filter(
      (t) => t.transactionType === TransactionType.DELIVERY,
    );

    for (const transaction of deliveryTransactions) {
      // Berechne Zwischengewinn
      // Hinweis: Verkaufspreis - Anschaffungskosten = Zwischengewinn
      // Aktuell verwenden wir den Transaktionsbetrag als Verkaufspreis
      // Die Anschaffungskosten müssten aus separaten Daten kommen
      const sellingPrice = transaction.amount;

      // TODO: Anschaffungskosten aus separaten Daten holen
      // Falls nicht verfügbar, sollte Pizzatracker gefragt werden
      const acquisitionCost = 0; // Placeholder - sollte aus Datenbank kommen
      const profitMargin = sellingPrice - acquisitionCost;

      if (profitMargin > 0) {
        // Eliminiere Zwischengewinn aus Beständen
        // Hinweis: Der verbleibende Bestand mit Zwischengewinn sollte separat erfasst werden
        const remainingInventory = 0; // Placeholder - sollte aus Datenbank kommen

        if (remainingInventory > 0) {
          // Anteiliger Gewinn bei noch vorhandenen Beständen
          const inventoryProfit =
            (profitMargin / sellingPrice) * remainingInventory;

          const { data: entry, error } = await this.supabase
            .from('consolidation_entries')
            .insert({
              financial_statement_id: financialStatementId,
              account_id: transaction.accountId,
              adjustment_type: AdjustmentType.ELIMINATION,
              amount: -inventoryProfit, // Negativ, um zu eliminieren
              description: `Zwischenergebniseliminierung: Gewinn aus Beständen für ${transaction.accountName} (${transaction.accountNumber}). Gewinnmarge: ${profitMargin.toFixed(2)}, Bestand: ${remainingInventory.toFixed(2)}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (!error && entry) {
            entries.push(SupabaseMapper.toConsolidationEntry(entry));
          }
        }

        // Eliminiere Zwischengewinn aus Anlagevermögen (falls zutreffend)
        // Hinweis: Dies erfordert zusätzliche Logik zur Identifikation von Anlagevermögen
      }
    }

    // 4. Eliminiere Zwischenumsätze (Lieferungen/Leistungen zwischen Unternehmen)
    for (const transaction of deliveryTransactions) {
      const { data: entry, error } = await this.supabase
        .from('consolidation_entries')
        .insert({
          financial_statement_id: financialStatementId,
          account_id: transaction.accountId,
          adjustment_type: AdjustmentType.ELIMINATION,
          amount: -transaction.amount, // Negativ, um zu eliminieren
          description: `Zwischenumsatz-Eliminierung: ${transaction.accountName} (${transaction.accountNumber}) von ${transaction.fromCompanyId} an ${transaction.toCompanyId}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!error && entry) {
        entries.push(SupabaseMapper.toConsolidationEntry(entry));
      }
    }

    return entries;
  }

  async getConsolidationEntries(
    financialStatementId: string,
    filters?: {
      adjustmentType?: AdjustmentType;
      status?: EntryStatus;
      source?: EntrySource;
    },
  ): Promise<ConsolidationEntry[]> {
    let query = this.supabase
      .from('consolidation_entries')
      .select(
        `
        *,
        account:accounts(*),
        debit_account:accounts!consolidation_entries_debit_account_id_fkey(*),
        credit_account:accounts!consolidation_entries_credit_account_id_fkey(*)
      `,
      )
      .eq('financial_statement_id', financialStatementId);

    // Apply filters
    if (filters?.adjustmentType) {
      query = query.eq('adjustment_type', filters.adjustmentType);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.source) {
      query = query.eq('source', filters.source);
    }

    const { data, error } = await query.order('created_at', {
      ascending: false,
    });

    if (error) {
      throw new Error(
        `Failed to fetch consolidation entries: ${error.message}`,
      );
    }

    return (data || []).map((item) =>
      SupabaseMapper.toConsolidationEntry(item),
    );
  }

  async createConsolidationEntry(
    createDto: CreateConsolidationEntryDto,
  ): Promise<ConsolidationEntry> {
    const { data, error } = await this.supabase
      .from('consolidation_entries')
      .insert({
        financial_statement_id: createDto.financialStatementId,
        account_id: createDto.accountId || createDto.debitAccountId, // Backward compatibility
        debit_account_id: createDto.debitAccountId,
        credit_account_id: createDto.creditAccountId,
        adjustment_type: createDto.adjustmentType,
        amount: createDto.amount,
        description: createDto.description,
        source: createDto.source || EntrySource.AUTOMATIC,
        hgb_reference: createDto.hgbReference,
        affected_company_ids: createDto.affectedCompanyIds,
        created_by_user_id: createDto.createdByUserId,
        status:
          createDto.source === EntrySource.MANUAL
            ? EntryStatus.DRAFT
            : EntryStatus.APPROVED,
        created_at: SupabaseMapper.getCurrentTimestamp(),
        updated_at: SupabaseMapper.getCurrentTimestamp(),
      })
      .select()
      .single();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Consolidation Entry', 'create');
    }

    SupabaseErrorHandler.handleNotFound(data, 'Consolidation Entry');
    return SupabaseMapper.toConsolidationEntry(data);
  }

  async updateConsolidationEntry(
    entryId: string,
    updateDto: UpdateConsolidationEntryDto,
  ): Promise<ConsolidationEntry> {
    // First check if entry exists and is in DRAFT status
    const { data: existing, error: fetchError } = await this.supabase
      .from('consolidation_entries')
      .select('*')
      .eq('id', entryId)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundException(
        `Konsolidierungsbuchung mit ID ${entryId} nicht gefunden`,
      );
    }

    if (existing.status !== EntryStatus.DRAFT) {
      throw new BadRequestException(
        `Nur Buchungen im Status "Entwurf" können bearbeitet werden. Aktueller Status: ${existing.status}`,
      );
    }

    const updateData: any = {
      updated_at: SupabaseMapper.getCurrentTimestamp(),
    };

    if (updateDto.debitAccountId !== undefined)
      updateData.debit_account_id = updateDto.debitAccountId;
    if (updateDto.creditAccountId !== undefined)
      updateData.credit_account_id = updateDto.creditAccountId;
    if (updateDto.adjustmentType !== undefined)
      updateData.adjustment_type = updateDto.adjustmentType;
    if (updateDto.amount !== undefined) updateData.amount = updateDto.amount;
    if (updateDto.description !== undefined)
      updateData.description = updateDto.description;
    if (updateDto.hgbReference !== undefined)
      updateData.hgb_reference = updateDto.hgbReference;
    if (updateDto.affectedCompanyIds !== undefined)
      updateData.affected_company_ids = updateDto.affectedCompanyIds;

    const { data, error } = await this.supabase
      .from('consolidation_entries')
      .update(updateData)
      .eq('id', entryId)
      .select()
      .single();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Consolidation Entry', 'update');
    }

    return SupabaseMapper.toConsolidationEntry(data);
  }

  async deleteConsolidationEntry(entryId: string): Promise<void> {
    // First check if entry exists and is in DRAFT status
    const { data: existing, error: fetchError } = await this.supabase
      .from('consolidation_entries')
      .select('*')
      .eq('id', entryId)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundException(
        `Konsolidierungsbuchung mit ID ${entryId} nicht gefunden`,
      );
    }

    if (existing.status !== EntryStatus.DRAFT) {
      throw new BadRequestException(
        `Nur Buchungen im Status "Entwurf" können gelöscht werden. Aktueller Status: ${existing.status}`,
      );
    }

    const { error } = await this.supabase
      .from('consolidation_entries')
      .delete()
      .eq('id', entryId);

    if (error) {
      SupabaseErrorHandler.handle(error, 'Consolidation Entry', 'delete');
    }
  }

  async submitForApproval(entryId: string): Promise<ConsolidationEntry> {
    const { data: existing, error: fetchError } = await this.supabase
      .from('consolidation_entries')
      .select('*')
      .eq('id', entryId)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundException(
        `Konsolidierungsbuchung mit ID ${entryId} nicht gefunden`,
      );
    }

    if (existing.status !== EntryStatus.DRAFT) {
      throw new BadRequestException(
        `Nur Buchungen im Status "Entwurf" können zur Freigabe eingereicht werden.`,
      );
    }

    const { data, error } = await this.supabase
      .from('consolidation_entries')
      .update({
        status: EntryStatus.PENDING,
        updated_at: SupabaseMapper.getCurrentTimestamp(),
      })
      .eq('id', entryId)
      .select()
      .single();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Consolidation Entry', 'submit');
    }

    return SupabaseMapper.toConsolidationEntry(data);
  }

  async approveEntry(
    entryId: string,
    approvedByUserId: string,
  ): Promise<ConsolidationEntry> {
    const { data: existing, error: fetchError } = await this.supabase
      .from('consolidation_entries')
      .select('*')
      .eq('id', entryId)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundException(
        `Konsolidierungsbuchung mit ID ${entryId} nicht gefunden`,
      );
    }

    if (existing.status !== EntryStatus.PENDING) {
      throw new BadRequestException(
        `Nur Buchungen im Status "Zur Prüfung" können freigegeben werden.`,
      );
    }

    // 4-eyes principle: approver must be different from creator
    if (existing.created_by_user_id === approvedByUserId) {
      throw new BadRequestException(
        `Vier-Augen-Prinzip: Der Freigebende muss eine andere Person als der Ersteller sein.`,
      );
    }

    const { data, error } = await this.supabase
      .from('consolidation_entries')
      .update({
        status: EntryStatus.APPROVED,
        approved_by_user_id: approvedByUserId,
        approved_at: SupabaseMapper.getCurrentTimestamp(),
        updated_at: SupabaseMapper.getCurrentTimestamp(),
      })
      .eq('id', entryId)
      .select()
      .single();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Consolidation Entry', 'approve');
    }

    return SupabaseMapper.toConsolidationEntry(data);
  }

  async rejectEntry(
    entryId: string,
    rejectedByUserId: string,
    reason: string,
  ): Promise<ConsolidationEntry> {
    const { data: existing, error: fetchError } = await this.supabase
      .from('consolidation_entries')
      .select('*')
      .eq('id', entryId)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundException(
        `Konsolidierungsbuchung mit ID ${entryId} nicht gefunden`,
      );
    }

    if (existing.status !== EntryStatus.PENDING) {
      throw new BadRequestException(
        `Nur Buchungen im Status "Zur Prüfung" können abgelehnt werden.`,
      );
    }

    const { data, error } = await this.supabase
      .from('consolidation_entries')
      .update({
        status: EntryStatus.REJECTED,
        description: `${existing.description || ''}\n\n[ABGELEHNT von ${rejectedByUserId}]: ${reason}`,
        updated_at: SupabaseMapper.getCurrentTimestamp(),
      })
      .eq('id', entryId)
      .select()
      .single();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Consolidation Entry', 'reject');
    }

    return SupabaseMapper.toConsolidationEntry(data);
  }

  async reverseEntry(
    entryId: string,
    reversedByUserId: string,
    reason: string,
  ): Promise<ConsolidationEntry> {
    const { data: existing, error: fetchError } = await this.supabase
      .from('consolidation_entries')
      .select('*')
      .eq('id', entryId)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundException(
        `Konsolidierungsbuchung mit ID ${entryId} nicht gefunden`,
      );
    }

    if (existing.status !== EntryStatus.APPROVED) {
      throw new BadRequestException(
        `Nur freigegebene Buchungen können storniert werden.`,
      );
    }

    // Create reversal entry
    const { data: reversalEntry, error: reversalError } = await this.supabase
      .from('consolidation_entries')
      .insert({
        financial_statement_id: existing.financial_statement_id,
        account_id: existing.account_id,
        debit_account_id: existing.credit_account_id, // Swap debit/credit
        credit_account_id: existing.debit_account_id,
        adjustment_type: existing.adjustment_type,
        amount: -existing.amount, // Negative amount
        description: `[STORNO] ${reason}\n\nOriginal: ${existing.description || ''}`,
        source: EntrySource.MANUAL,
        hgb_reference: existing.hgb_reference,
        affected_company_ids: existing.affected_company_ids,
        created_by_user_id: reversedByUserId,
        status: EntryStatus.APPROVED,
        reverses_entry_id: entryId,
        created_at: SupabaseMapper.getCurrentTimestamp(),
        updated_at: SupabaseMapper.getCurrentTimestamp(),
      })
      .select()
      .single();

    if (reversalError) {
      SupabaseErrorHandler.handle(reversalError, 'Reversal Entry', 'create');
    }

    // Update original entry status
    await this.supabase
      .from('consolidation_entries')
      .update({
        status: EntryStatus.REVERSED,
        reversed_by_entry_id: reversalEntry.id,
        updated_at: SupabaseMapper.getCurrentTimestamp(),
      })
      .eq('id', entryId);

    return SupabaseMapper.toConsolidationEntry(reversalEntry);
  }

  async getManualEntries(
    financialStatementId: string,
  ): Promise<ConsolidationEntry[]> {
    return this.getConsolidationEntries(financialStatementId, {
      source: EntrySource.MANUAL,
    });
  }

  async getPendingEntries(
    financialStatementId: string,
  ): Promise<ConsolidationEntry[]> {
    return this.getConsolidationEntries(financialStatementId, {
      status: EntryStatus.PENDING,
    });
  }
}
