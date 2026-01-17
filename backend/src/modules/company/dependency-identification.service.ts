import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface CompanyHierarchy {
  id: string;
  name: string;
  type: 'parent' | 'subsidiary' | 'standalone';
  parentCompanyId: string | null;
  children: CompanyHierarchy[];
  participationPercentage?: number;
}

export interface ConsolidationCircle {
  parentCompany: CompanyHierarchy;
  subsidiaries: CompanyHierarchy[];
  consolidationRequired: boolean;
  reason?: string;
}

@Injectable()
export class DependencyIdentificationService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Identifiziert Mutterunternehmen (H)
   * Ein Unternehmen ist ein Mutterunternehmen, wenn:
   * - Es keine parent_company_id hat
   * - Es Tochterunternehmen hat (children)
   */
  async identifyParentCompanies(): Promise<CompanyHierarchy[]> {
    const { data: companies, error } = await this.supabase
      .from('companies')
      .select('*')
      .is('parent_company_id', null);

    if (error) {
      throw new Error(
        `Fehler beim Abrufen der Mutterunternehmen: ${error.message}`,
      );
    }

    const parents: CompanyHierarchy[] = [];

    for (const company of companies || []) {
      const { data: children } = await this.supabase
        .from('companies')
        .select('*')
        .eq('parent_company_id', company.id);

      if (children && children.length > 0) {
        parents.push({
          id: company.id,
          name: company.name,
          type: 'parent',
          parentCompanyId: null,
          children: [],
        });
      }
    }

    return parents;
  }

  /**
   * Identifiziert Tochterunternehmen (TU)
   * Ein Unternehmen ist ein Tochterunternehmen, wenn:
   * - Es eine parent_company_id hat
   * - Es konsolidiert werden soll (is_consolidated = true)
   */
  async identifySubsidiaries(
    parentCompanyId?: string,
  ): Promise<CompanyHierarchy[]> {
    let query = this.supabase
      .from('companies')
      .select('*')
      .not('parent_company_id', 'is', null)
      .eq('is_consolidated', true);

    if (parentCompanyId) {
      query = query.eq('parent_company_id', parentCompanyId);
    }

    const { data: companies, error } = await query;

    if (error) {
      throw new Error(
        `Fehler beim Abrufen der Tochterunternehmen: ${error.message}`,
      );
    }

    return (companies || []).map((company) => ({
      id: company.id,
      name: company.name,
      type: 'subsidiary',
      parentCompanyId: company.parent_company_id,
      children: [],
    }));
  }

  /**
   * Erstellt die vollständige Unternehmenshierarchie
   */
  async buildCompanyHierarchy(): Promise<CompanyHierarchy[]> {
    const { data: allCompanies, error } = await this.supabase
      .from('companies')
      .select('*');

    if (error) {
      throw new Error(`Fehler beim Abrufen der Unternehmen: ${error.message}`);
    }

    if (!allCompanies || allCompanies.length === 0) {
      return [];
    }

    // Erstelle Map für schnellen Zugriff
    const companyMap = new Map<string, CompanyHierarchy>();

    // Erstelle alle Unternehmen
    allCompanies.forEach((company) => {
      companyMap.set(company.id, {
        id: company.id,
        name: company.name,
        type: company.parent_company_id ? 'subsidiary' : 'standalone',
        parentCompanyId: company.parent_company_id,
        children: [],
      });
    });

    // Baue Hierarchie auf
    const roots: CompanyHierarchy[] = [];

    companyMap.forEach((company) => {
      if (company.parentCompanyId) {
        const parent = companyMap.get(company.parentCompanyId);
        if (parent) {
          parent.children.push(company);
          company.type = 'subsidiary';
        }
      } else {
        roots.push(company);
      }
    });

    // Markiere Unternehmen mit Kindern als Parent
    roots.forEach((root) => {
      if (root.children.length > 0) {
        root.type = 'parent';
      }
    });

    return roots;
  }

  /**
   * Bestimmt den Konsolidierungskreis
   * Nach HGB müssen konsolidiert werden:
   * - Mehrheitsbeteiligungen (>50%)
   * - Unternehmen unter einheitlicher Leitung
   * - Konsolidierungspflichtige Unternehmen
   */
  async determineConsolidationCircle(
    parentCompanyId: string,
  ): Promise<ConsolidationCircle> {
    const { data: parentCompany, error: parentError } = await this.supabase
      .from('companies')
      .select('*')
      .eq('id', parentCompanyId)
      .single();

    if (parentError || !parentCompany) {
      throw new Error(
        `Mutterunternehmen mit ID ${parentCompanyId} nicht gefunden`,
      );
    }

    const subsidiaries = await this.identifySubsidiaries(parentCompanyId);

    // Prüfe Konsolidierungspflicht
    // Hinweis: Aktuell basiert dies auf is_consolidated Flag
    // In Zukunft könnte hier eine Beteiligungsquote aus der participations-Tabelle verwendet werden
    const consolidationRequired = subsidiaries.length > 0;

    let reason = '';
    if (consolidationRequired) {
      reason = `Konsolidierungspflicht nach HGB: ${subsidiaries.length} Tochterunternehmen gefunden`;
    } else {
      reason = 'Keine konsolidierungspflichtigen Tochterunternehmen';
    }

    return {
      parentCompany: {
        id: parentCompany.id,
        name: parentCompany.name,
        type: 'parent',
        parentCompanyId: null,
        children: subsidiaries,
      },
      subsidiaries,
      consolidationRequired,
      reason,
    };
  }

  /**
   * Prüft, ob Informationen zur Unternehmenshierarchie fehlen
   * Falls ja, sollte der Nutzer "Pizzatracker" nach der Auswertung gefragt werden
   */
  async checkMissingHierarchyInformation(
    companyId: string,
  ): Promise<{ missing: boolean; missingFields: string[] }> {
    const { data: company, error } = await this.supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (error || !company) {
      return {
        missing: true,
        missingFields: ['Unternehmen nicht gefunden'],
      };
    }

    const missingFields: string[] = [];

    if (!company.name) {
      missingFields.push('Unternehmensname');
    }

    // Prüfe, ob Beteiligungsverhältnisse fehlen
    // Hinweis: Dies würde eine participations-Tabelle erfordern
    // Aktuell prüfen wir nur parent_company_id
    if (company.parent_company_id) {
      const { data: parent } = await this.supabase
        .from('companies')
        .select('*')
        .eq('id', company.parent_company_id)
        .single();

      if (!parent) {
        missingFields.push('Mutterunternehmen-Referenz ungültig');
      }
    }

    return {
      missing: missingFields.length > 0,
      missingFields,
    };
  }
}
