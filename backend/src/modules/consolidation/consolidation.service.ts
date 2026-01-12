import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseErrorHandler } from '../../common/supabase-error.util';
import { SupabaseMapper } from '../../common/supabase-mapper.util';
import { FinancialStatement } from '../../entities/financial-statement.entity';
import { AccountBalance } from '../../entities/account-balance.entity';
import { ConsolidationEntry, AdjustmentType } from '../../entities/consolidation-entry.entity';
import { Company } from '../../entities/company.entity';
import { IntercompanyTransaction } from '../../entities/intercompany-transaction.entity';
import { CreateConsolidationEntryDto } from './dto/create-consolidation-entry.dto';
import { IntercompanyTransactionService, TransactionType } from './intercompany-transaction.service';
import { DebtConsolidationService } from './debt-consolidation.service';
import { CapitalConsolidationService } from './capital-consolidation.service';

@Injectable()
export class ConsolidationService {
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
    console.log(`[ConsolidationService] calculateConsolidation - Starting for financialStatementId: ${financialStatementId}`);
    
    const { data: financialStatement, error: fsError } = await this.supabase
      .from('financial_statements')
      .select('*, company:companies(*)')
      .eq('id', financialStatementId)
      .single();

    if (fsError) {
      console.error('[ConsolidationService] Error fetching financial statement:', fsError);
      SupabaseErrorHandler.handle(fsError, 'Financial Statement', 'fetch');
    }
    SupabaseErrorHandler.handleNotFound(financialStatement, 'Financial Statement');

    console.log(`[ConsolidationService] Financial statement found - company_id: ${financialStatement.company_id}`);

    // Finde alle konsolidierten Unternehmen im Konzern
    const consolidatedCompanies = await this.getConsolidatedCompanies(
      financialStatement.company_id,
    );

    console.log(`[ConsolidationService] Found ${consolidatedCompanies.length} consolidated companies`);

    if (consolidatedCompanies.length === 0) {
      console.error('[ConsolidationService] No consolidated companies found');
      // Check if the parent company exists and is marked for consolidation
      const { data: parentCompany } = await this.supabase
        .from('companies')
        .select('id, name, is_consolidated, parent_company_id')
        .eq('id', financialStatement.company_id)
        .single();
      
      if (!parentCompany) {
        throw new BadRequestException(
          `Das Unternehmen mit ID ${financialStatement.company_id} wurde nicht gefunden. Bitte prüfen Sie, ob das Unternehmen existiert.`
        );
      }
      
      if (!parentCompany.is_consolidated) {
        throw new BadRequestException(
          `Das Unternehmen "${parentCompany.name}" ist nicht für die Konsolidierung markiert. Bitte setzen Sie "Wird konsolidiert" auf "Ja" im Unternehmen.`
        );
      }
      
      throw new BadRequestException(
        'Keine konsolidierten Unternehmen gefunden. Bitte stellen Sie sicher, dass:\n' +
        '1. Das Unternehmen für die Konsolidierung markiert ist (is_consolidated = true)\n' +
        '2. Es Tochterunternehmen gibt, die ebenfalls für die Konsolidierung markiert sind\n' +
        '3. Die Unternehmen korrekt verknüpft sind (parent_company_id)'
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
    const debtConsolidationResult = await this.debtConsolidationService.consolidateDebts(
      financialStatementId,
      companyIds,
    );
    entries.push(...debtConsolidationResult.entries);
    
    // Warnung bei fehlenden Informationen
    if (debtConsolidationResult.summary.missingInfo.length > 0) {
      console.warn('Fehlende Informationen bei Schuldenkonsolidierung:', debtConsolidationResult.summary.missingInfo);
    }

    // 3. Kapitalkonsolidierung
    const capitalConsolidationResult = await this.capitalConsolidationService.consolidateCapital(
      financialStatementId,
      financialStatement.company_id,
    );
    entries.push(...capitalConsolidationResult.entries);
    
    // Warnung bei fehlenden Informationen
    if (capitalConsolidationResult.summary.missingInfo.length > 0) {
      console.warn('Fehlende Informationen bei Kapitalkonsolidierung:', capitalConsolidationResult.summary.missingInfo);
    }

    // Zusammenfassung
    const summary = {
      totalEntries: entries.length,
      intercompanyEliminations: intercompanyEliminations.length,
      debtConsolidations: debtConsolidationResult.entries.length,
      capitalConsolidations: capitalConsolidationResult.entries.length,
      totalAmount: entries.reduce((sum, entry) => sum + Math.abs(Number(entry.amount)), 0),
    };

    return { entries, summary };
  }

  private async getConsolidatedCompanies(
    parentCompanyId: string,
  ): Promise<Company[]> {
    console.log(`[ConsolidationService] getConsolidatedCompanies - Looking for companies with parent: ${parentCompanyId}`);
    
    // Finde alle Tochterunternehmen, die konsolidiert werden sollen
    const { data: parentCompany, error: parentError } = await this.supabase
      .from('companies')
      .select('*')
      .eq('id', parentCompanyId)
      .single();

    if (parentError) {
      console.error('[ConsolidationService] Error fetching parent company:', parentError);
    }

    // Check if parent company is marked for consolidation (don't filter here, check later)
    const { data: directChildren, error: childrenError } = await this.supabase
      .from('companies')
      .select('*')
      .eq('parent_company_id', parentCompanyId);

    if (childrenError) {
      console.error('[ConsolidationService] Error fetching children companies:', childrenError);
    }

    console.log(`[ConsolidationService] Parent company found: ${parentCompany ? 'yes' : 'no'}, is_consolidated: ${parentCompany?.is_consolidated}`);
    console.log(`[ConsolidationService] Direct children found: ${directChildren?.length || 0}`);

    // Rekursiv alle Unter-Tochterunternehmen finden
    const allCompanies: any[] = [];
    
    // Add parent company if it's marked for consolidation
    if (parentCompany && parentCompany.is_consolidated) {
      allCompanies.push(parentCompany);
      console.log(`[ConsolidationService] Added parent company: ${parentCompany.name}`);
    }
    
    // Add direct children that are marked for consolidation
    const consolidatedChildren = (directChildren || []).filter((c: any) => c.is_consolidated);
    if (consolidatedChildren.length > 0) {
      allCompanies.push(...consolidatedChildren);
      console.log(`[ConsolidationService] Added ${consolidatedChildren.length} consolidated children`);
    }

    // Recursively find grandchildren
    for (const company of consolidatedChildren) {
      const { data: children, error: grandChildrenError } = await this.supabase
        .from('companies')
        .select('*')
        .eq('parent_company_id', company.id);
      
      if (grandChildrenError) {
        console.error(`[ConsolidationService] Error fetching grandchildren for ${company.id}:`, grandChildrenError);
      }
      
      const consolidatedGrandChildren = (children || []).filter((c: any) => c.is_consolidated);
      if (consolidatedGrandChildren.length > 0) {
        allCompanies.push(...consolidatedGrandChildren);
        console.log(`[ConsolidationService] Added ${consolidatedGrandChildren.length} consolidated grandchildren for ${company.name}`);
      }
    }

    console.log(`[ConsolidationService] Total consolidated companies found: ${allCompanies.length}`);

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
    const detectionResult = await this.intercompanyService.detectIntercompanyTransactions(
      financialStatementId,
    );

    // 2. Prüfe auf fehlende Informationen (Pizzatracker-Hinweis)
    if (detectionResult.missingInfo.length > 0) {
      console.warn('Fehlende Informationen bei Zwischengesellschaftsgeschäften:', detectionResult.missingInfo);
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
          const inventoryProfit = (profitMargin / sellingPrice) * remainingInventory;

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
  ): Promise<ConsolidationEntry[]> {
    const { data, error } = await this.supabase
      .from('consolidation_entries')
      .select('*, account:accounts(*)')
      .eq('financial_statement_id', financialStatementId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch consolidation entries: ${error.message}`);
    }

    return (data || []).map((item) => SupabaseMapper.toConsolidationEntry(item));
  }

  async createConsolidationEntry(
    createDto: CreateConsolidationEntryDto,
  ): Promise<ConsolidationEntry> {
    const { data, error } = await this.supabase
      .from('consolidation_entries')
      .insert({
        financial_statement_id: createDto.financialStatementId,
        account_id: createDto.accountId,
        adjustment_type: createDto.adjustmentType,
        amount: createDto.amount,
        description: createDto.description,
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
}
