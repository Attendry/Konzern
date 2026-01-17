import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

export interface HGBParagraph {
  id: string;
  paragraph: string;
  title: string;
  content: string;
  category?: string;
  subcategory?: string;
  relatedParagraphs?: string[];
}

/**
 * Service for accessing HGB knowledge base
 */
@Injectable()
export class HGBKnowledgeService {
  private readonly logger = new Logger(HGBKnowledgeService.name);

  // In-memory cache for frequently accessed paragraphs
  private cache: Map<string, HGBParagraph> = new Map();

  constructor(private supabase: SupabaseService) {}

  /**
   * Get a specific HGB paragraph
   */
  async getParagraph(paragraph: string): Promise<HGBParagraph | null> {
    // Check cache first
    if (this.cache.has(paragraph)) {
      return this.cache.get(paragraph)!;
    }

    try {
      const client = this.supabase.getClient();
      const { data, error } = await client
        .from('hgb_knowledge_base')
        .select('*')
        .eq('paragraph', paragraph)
        .single();

      if (error || !data) {
        // Fallback to local knowledge
        return this.getLocalParagraph(paragraph);
      }

      const result: HGBParagraph = {
        id: data.id,
        paragraph: data.paragraph,
        title: data.title,
        content: data.content,
        category: data.category,
        subcategory: data.subcategory,
        relatedParagraphs: data.related_paragraphs,
      };

      // Cache the result
      this.cache.set(paragraph, result);
      return result;
    } catch (error: any) {
      this.logger.warn(`Failed to get HGB paragraph: ${error.message}`);
      return this.getLocalParagraph(paragraph);
    }
  }

  /**
   * Search for relevant HGB paragraphs
   */
  async searchParagraphs(query: string): Promise<HGBParagraph[]> {
    try {
      const client = this.supabase.getClient();
      const { data, error } = await client
        .from('hgb_knowledge_base')
        .select('*')
        .textSearch('search_vector', query, { type: 'websearch' })
        .limit(5);

      if (error || !data) {
        return [];
      }

      return data.map((row) => ({
        id: row.id,
        paragraph: row.paragraph,
        title: row.title,
        content: row.content,
        category: row.category,
        subcategory: row.subcategory,
        relatedParagraphs: row.related_paragraphs,
      }));
    } catch (error: any) {
      this.logger.warn(`Failed to search HGB: ${error.message}`);
      return [];
    }
  }

  /**
   * Get all paragraphs for a category
   */
  async getParagraphsByCategory(category: string): Promise<HGBParagraph[]> {
    try {
      const client = this.supabase.getClient();
      const { data, error } = await client
        .from('hgb_knowledge_base')
        .select('*')
        .eq('category', category)
        .order('paragraph');

      if (error || !data) {
        return [];
      }

      return data.map((row) => ({
        id: row.id,
        paragraph: row.paragraph,
        title: row.title,
        content: row.content,
        category: row.category,
        subcategory: row.subcategory,
        relatedParagraphs: row.related_paragraphs,
      }));
    } catch (error: any) {
      this.logger.warn(`Failed to get category: ${error.message}`);
      return [];
    }
  }

  /**
   * Get related paragraphs for a given paragraph
   */
  async getRelatedParagraphs(paragraph: string): Promise<HGBParagraph[]> {
    const main = await this.getParagraph(paragraph);
    if (!main || !main.relatedParagraphs?.length) {
      return [];
    }

    const related: HGBParagraph[] = [];
    for (const rel of main.relatedParagraphs) {
      const p = await this.getParagraph(rel);
      if (p) {
        related.push(p);
      }
    }

    return related;
  }

  /**
   * Get paragraph relevant for a specific consolidation type
   */
  getRelevantParagraph(consolidationType: string): string {
    const mapping: Record<string, string> = {
      capital_consolidation: '§ 301 HGB',
      debt_consolidation: '§ 303 HGB',
      expense_income_elimination: '§ 305 HGB',
      intermediate_result: '§ 304 HGB',
      goodwill: '§ 309 HGB',
      consolidation_obligation: '§ 290 HGB',
      consolidation_scope: '§ 300 HGB',
    };

    return mapping[consolidationType] || '§ 290 HGB';
  }

  /**
   * Get a brief summary of a paragraph for display
   */
  async getParagraphSummary(paragraph: string): Promise<string> {
    const p = await this.getParagraph(paragraph);
    if (!p) {
      return `${paragraph} - Kein Inhalt verfügbar`;
    }

    // Return first 200 characters of content
    const summary =
      p.content.length > 200 ? p.content.substring(0, 200) + '...' : p.content;

    return `${p.paragraph} - ${p.title}: ${summary}`;
  }

  /**
   * Local fallback knowledge base
   */
  private getLocalParagraph(paragraph: string): HGBParagraph | null {
    const localKnowledge: Record<string, HGBParagraph> = {
      '§ 290 HGB': {
        id: 'local-290',
        paragraph: '§ 290 HGB',
        title: 'Pflicht zur Aufstellung',
        content:
          'Die gesetzlichen Vertreter einer Kapitalgesellschaft (Mutterunternehmen) mit Sitz im Inland haben in den ersten fünf Monaten des Konzerngeschäftsjahrs für das vergangene Konzerngeschäftsjahr einen Konzernabschluss und einen Konzernlagebericht aufzustellen, wenn diese auf ein anderes Unternehmen (Tochterunternehmen) unmittelbar oder mittelbar einen beherrschenden Einfluss ausüben kann.',
        category: 'Konsolidierung',
        relatedParagraphs: ['§ 291 HGB', '§ 292 HGB', '§ 293 HGB'],
      },
      '§ 300 HGB': {
        id: 'local-300',
        paragraph: '§ 300 HGB',
        title: 'Konsolidierungsgrundsätze, Vollständigkeitsgebot',
        content:
          'In den Konzernabschluss sind das Mutterunternehmen und alle Tochterunternehmen ohne Rücksicht auf den Sitz der Tochterunternehmen einzubeziehen, sofern die Einbeziehung nicht nach § 296 unterbleibt.',
        category: 'Konsolidierung',
        relatedParagraphs: ['§ 296 HGB', '§ 301 HGB'],
      },
      '§ 301 HGB': {
        id: 'local-301',
        paragraph: '§ 301 HGB',
        title: 'Kapitalkonsolidierung',
        content:
          'Der Wertansatz der dem Mutterunternehmen gehörenden Anteile an einem in den Konzernabschluss einbezogenen Tochterunternehmen wird mit dem auf diese Anteile entfallenden Betrag des Eigenkapitals des Tochterunternehmens verrechnet.',
        category: 'Konsolidierung',
        relatedParagraphs: ['§ 300 HGB', '§ 302 HGB', '§ 309 HGB'],
      },
      '§ 303 HGB': {
        id: 'local-303',
        paragraph: '§ 303 HGB',
        title: 'Schuldenkonsolidierung',
        content:
          'Ausleihungen und andere Forderungen, Rückstellungen und Verbindlichkeiten zwischen den in den Konzernabschluss einbezogenen Unternehmen sowie entsprechende Rechnungsabgrenzungsposten sind wegzulassen.',
        category: 'Konsolidierung',
        relatedParagraphs: ['§ 304 HGB', '§ 305 HGB'],
      },
      '§ 304 HGB': {
        id: 'local-304',
        paragraph: '§ 304 HGB',
        title: 'Behandlung der Zwischenergebnisse',
        content:
          'In den Konzernabschluss zu übernehmende Vermögensgegenstände, die ganz oder teilweise auf Lieferungen oder Leistungen zwischen in den Konzernabschluss einbezogenen Unternehmen beruhen, sind mit einem Betrag anzusetzen, zu dem sie in der auf den Stichtag des Konzernabschlusses aufgestellten Jahresbilanz dieses Unternehmens angesetzt werden könnten.',
        category: 'Konsolidierung',
        relatedParagraphs: ['§ 303 HGB', '§ 305 HGB'],
      },
      '§ 305 HGB': {
        id: 'local-305',
        paragraph: '§ 305 HGB',
        title: 'Aufwands- und Ertragskonsolidierung',
        content:
          'In der Konzern-Gewinn- und Verlustrechnung sind bei den Umsatzerlösen die Erlöse aus Lieferungen und Leistungen zwischen den in den Konzernabschluss einbezogenen Unternehmen mit den auf sie entfallenden Aufwendungen zu verrechnen.',
        category: 'Konsolidierung',
        relatedParagraphs: ['§ 303 HGB', '§ 304 HGB'],
      },
      '§ 309 HGB': {
        id: 'local-309',
        paragraph: '§ 309 HGB',
        title: 'Behandlung des Unterschiedsbetrags',
        content:
          'Ein nach § 301 Abs. 3 auf der Aktivseite auszuweisender Unterschiedsbetrag ist in jedem folgenden Geschäftsjahr zu mindestens einem Viertel durch Abschreibungen zu tilgen. Die Abschreibungsdauer darf 5 Jahre nur überschreiten, wenn ein längerer Zeitraum, der 10 Jahre nicht überschreiten darf, dem voraussichtlichen Nutzungszeitraum entspricht.',
        category: 'Konsolidierung',
        relatedParagraphs: ['§ 301 HGB'],
      },
    };

    return localKnowledge[paragraph] || null;
  }
}
