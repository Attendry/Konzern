import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { ProvenanceInfo, ProvenanceType } from '../types/agent.types';

/**
 * Service for tracking and creating provenance (data lineage) information
 */
@Injectable()
export class ProvenanceService {
  private readonly logger = new Logger(ProvenanceService.name);

  constructor(private supabase: SupabaseService) {}

  /**
   * Create provenance for a database record
   */
  createDatabaseProvenance(
    table: string,
    recordId: string,
    description?: string,
  ): ProvenanceInfo {
    return {
      type: 'database_record',
      source: `${table}#${recordId.substring(0, 8)}`,
      recordId,
      table,
      timestamp: new Date(),
      description: description || `Datensatz aus ${this.getTableLabel(table)}`,
    };
  }

  /**
   * Create provenance for an HGB paragraph reference
   */
  createHGBProvenance(paragraph: string, description?: string): ProvenanceInfo {
    return {
      type: 'hgb_paragraph',
      source: paragraph,
      hgbParagraph: paragraph,
      timestamp: new Date(),
      description: description || `Referenz: ${paragraph}`,
    };
  }

  /**
   * Create provenance for a calculation
   */
  createCalculationProvenance(
    calculationType: string,
    description: string,
    sourceRecordIds?: string[],
  ): ProvenanceInfo {
    return {
      type: 'calculation',
      source: calculationType,
      timestamp: new Date(),
      description,
      recordId: sourceRecordIds?.join(','),
    };
  }

  /**
   * Create provenance for AI inference
   */
  createAIProvenance(model: string, description: string): ProvenanceInfo {
    return {
      type: 'ai_inference',
      source: model,
      timestamp: new Date(),
      description,
    };
  }

  /**
   * Create provenance for user input
   */
  createUserInputProvenance(
    userId: string,
    description: string,
  ): ProvenanceInfo {
    return {
      type: 'user_input',
      source: `User: ${userId.substring(0, 8)}...`,
      timestamp: new Date(),
      description,
    };
  }

  /**
   * Build provenance chain for IC reconciliation analysis
   */
  async buildICReconciliationProvenance(
    reconciliationId: string,
  ): Promise<ProvenanceInfo[]> {
    const provenance: ProvenanceInfo[] = [];
    const client = this.supabase.getClient();

    try {
      // Get the reconciliation record
      const { data: recon } = await client
        .from('ic_reconciliations')
        .select(
          `
          *,
          company_a:companies!ic_reconciliations_company_a_id_fkey(id, name),
          company_b:companies!ic_reconciliations_company_b_id_fkey(id, name)
        `,
        )
        .eq('id', reconciliationId)
        .single();

      if (recon) {
        provenance.push(
          this.createDatabaseProvenance(
            'ic_reconciliations',
            reconciliationId,
            `IC-Abstimmung: ${recon.company_a?.name} ↔ ${recon.company_b?.name}`,
          ),
        );

        // Add company references
        if (recon.company_a?.id) {
          provenance.push(
            this.createDatabaseProvenance(
              'companies',
              recon.company_a.id,
              `Gesellschaft A: ${recon.company_a.name}`,
            ),
          );
        }
        if (recon.company_b?.id) {
          provenance.push(
            this.createDatabaseProvenance(
              'companies',
              recon.company_b.id,
              `Gesellschaft B: ${recon.company_b.name}`,
            ),
          );
        }
      }

      // Add HGB reference for IC reconciliation
      provenance.push(
        this.createHGBProvenance(
          '§ 303 HGB',
          'Schuldenkonsolidierung - Eliminierung konzerninterner Forderungen und Verbindlichkeiten',
        ),
      );
    } catch (error: any) {
      this.logger.warn(`Failed to build IC provenance: ${error.message}`);
    }

    return provenance;
  }

  /**
   * Build provenance chain for consolidation entries
   */
  async buildConsolidationEntryProvenance(
    entryId: string,
  ): Promise<ProvenanceInfo[]> {
    const provenance: ProvenanceInfo[] = [];
    const client = this.supabase.getClient();

    try {
      const { data: entry } = await client
        .from('consolidation_entries')
        .select('*')
        .eq('id', entryId)
        .single();

      if (entry) {
        provenance.push(
          this.createDatabaseProvenance(
            'consolidation_entries',
            entryId,
            `Konsolidierungsbuchung: ${entry.description || entry.adjustment_type}`,
          ),
        );

        // Add appropriate HGB reference based on entry type
        const hgbRef = this.getHGBReferenceForEntryType(entry.adjustment_type);
        if (hgbRef) {
          provenance.push(
            this.createHGBProvenance(hgbRef.paragraph, hgbRef.description),
          );
        }
      }
    } catch (error: any) {
      this.logger.warn(`Failed to build entry provenance: ${error.message}`);
    }

    return provenance;
  }

  /**
   * Build provenance for plausibility check
   */
  async buildPlausibilityCheckProvenance(
    checkId: string,
  ): Promise<ProvenanceInfo[]> {
    const provenance: ProvenanceInfo[] = [];
    const client = this.supabase.getClient();

    try {
      const { data: check } = await client
        .from('plausibility_checks')
        .select('*')
        .eq('id', checkId)
        .single();

      if (check) {
        provenance.push(
          this.createDatabaseProvenance(
            'plausibility_checks',
            checkId,
            `Plausibilitätsprüfung: ${check.check_type}`,
          ),
        );
      }
    } catch (error: any) {
      this.logger.warn(`Failed to build check provenance: ${error.message}`);
    }

    return provenance;
  }

  /**
   * Get German label for table name
   */
  private getTableLabel(table: string): string {
    const labels: Record<string, string> = {
      ic_reconciliations: 'IC-Abstimmungen',
      consolidation_entries: 'Konsolidierungsbuchungen',
      companies: 'Gesellschaften',
      financial_statements: 'Jahresabschlüsse',
      plausibility_checks: 'Plausibilitätsprüfungen',
      balance_sheet_items: 'Bilanzpositionen',
      income_statement_items: 'GuV-Positionen',
    };
    return labels[table] || table;
  }

  /**
   * Get HGB reference for consolidation entry type
   */
  private getHGBReferenceForEntryType(
    entryType: string,
  ): { paragraph: string; description: string } | null {
    const references: Record<
      string,
      { paragraph: string; description: string }
    > = {
      capital_consolidation: {
        paragraph: '§ 301 HGB',
        description:
          'Kapitalkonsolidierung - Verrechnung des Beteiligungsbuchwerts',
      },
      debt_consolidation: {
        paragraph: '§ 303 HGB',
        description:
          'Schuldenkonsolidierung - Eliminierung konzerninterner Salden',
      },
      expense_income_elimination: {
        paragraph: '§ 305 HGB',
        description: 'Aufwands- und Ertragskonsolidierung',
      },
      intermediate_result: {
        paragraph: '§ 304 HGB',
        description: 'Behandlung der Zwischenergebnisse',
      },
      goodwill_amortization: {
        paragraph: '§ 309 HGB',
        description:
          'Behandlung des Unterschiedsbetrags (Goodwill-Abschreibung)',
      },
    };
    return references[entryType] || null;
  }

  /**
   * Combine multiple provenance arrays, removing duplicates
   */
  combineProvenance(...arrays: ProvenanceInfo[][]): ProvenanceInfo[] {
    const combined: ProvenanceInfo[] = [];
    const seen = new Set<string>();

    for (const arr of arrays) {
      for (const p of arr) {
        const key = `${p.type}:${p.source}:${p.recordId || ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(p);
        }
      }
    }

    return combined;
  }
}
