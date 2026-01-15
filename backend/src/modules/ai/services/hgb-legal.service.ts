import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { 
  HGBParagraph, 
  LegislativeChange, 
  IDWStandard, 
  LegalContext,
  LegalChangeAlert 
} from '../types/legal.types';

@Injectable()
export class HGBLegalService {
  private readonly logger = new Logger(HGBLegalService.name);
  
  // Cache with TTL
  private cache: Map<string, { data: any; expiry: Date }> = new Map();
  private readonly CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

  constructor(private supabase: SupabaseService) {}

  /**
   * Get legal context for a consolidation type or analysis
   * This is the main entry point for contextual legal information
   */
  async getLegalContext(
    consolidationType: string,
    options?: { includeRelated?: boolean; includeIdw?: boolean }
  ): Promise<LegalContext | null> {
    const primaryRef = this.mapConsolidationTypeToHGB(consolidationType);
    
    const primaryParagraph = await this.getCurrentParagraph(primaryRef);
    if (!primaryParagraph) {
      this.logger.warn(`No paragraph found for ${consolidationType}`);
      return null;
    }

    const [
      relatedParagraphs,
      idwStandards,
      upcomingChanges,
      recentChanges,
    ] = await Promise.all([
      options?.includeRelated !== false 
        ? this.getRelatedParagraphs(primaryRef) 
        : Promise.resolve([]),
      options?.includeIdw !== false 
        ? this.getRelevantIDWStandards(primaryRef) 
        : Promise.resolve([]),
      this.getUpcomingChanges(primaryRef),
      this.getRecentChanges(primaryRef, 12), // Last 12 months
    ]);

    return {
      primaryParagraph,
      relatedParagraphs,
      idwStandards,
      upcomingChanges,
      recentChanges,
      lastVerified: primaryParagraph.verifiedDate || new Date(),
      disclaimer: this.getLegalDisclaimer(),
    };
  }

  /**
   * Get current version of a paragraph
   */
  async getCurrentParagraph(reference: string): Promise<HGBParagraph | null> {
    const cacheKey = `paragraph:${reference}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const client = this.supabase.getClient();
      const { data, error } = await client
        .from('hgb_knowledge_base')
        .select('*')
        .eq('full_reference', reference)
        .eq('is_current', true)
        .single();

      if (error || !data) {
        return this.getLocalFallback(reference);
      }

      const result = this.mapParagraphFromDb(data);
      this.setCache(cacheKey, result);
      return result;

    } catch (error: any) {
      this.logger.warn(`Failed to get paragraph ${reference}: ${error.message}`);
      return this.getLocalFallback(reference);
    }
  }

  /**
   * Get related paragraphs
   */
  async getRelatedParagraphs(reference: string): Promise<HGBParagraph[]> {
    const primary = await this.getCurrentParagraph(reference);
    if (!primary || !primary.relatedParagraphs?.length) {
      return [];
    }

    const related: HGBParagraph[] = [];
    for (const rel of primary.relatedParagraphs) {
      const p = await this.getCurrentParagraph(rel);
      if (p) {
        related.push(p);
      }
    }

    return related;
  }

  /**
   * Get upcoming legislative changes (effective date in future)
   */
  async getUpcomingChanges(paragraph?: string): Promise<LegislativeChange[]> {
    try {
      const client = this.supabase.getClient();
      let query = client
        .from('hgb_legislative_changes')
        .select('*')
        .eq('status', 'upcoming')
        .gte('effective_date', new Date().toISOString().split('T')[0])
        .order('effective_date', { ascending: true });

      if (paragraph) {
        query = query.eq('paragraph', paragraph);
      }

      const { data, error } = await query;
      if (error || !data) return [];

      return data.map(row => this.mapChangeFromDb(row));

    } catch (error: any) {
      this.logger.warn(`Failed to get upcoming changes: ${error.message}`);
      return [];
    }
  }

  /**
   * Get changes that became effective in the last N months
   */
  async getRecentChanges(paragraph?: string, months: number = 12): Promise<LegislativeChange[]> {
    try {
      const client = this.supabase.getClient();
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - months);

      let query = client
        .from('hgb_legislative_changes')
        .select('*')
        .eq('status', 'effective')
        .gte('effective_date', cutoffDate.toISOString().split('T')[0])
        .lte('effective_date', new Date().toISOString().split('T')[0])
        .order('effective_date', { ascending: false });

      if (paragraph) {
        query = query.eq('paragraph', paragraph);
      }

      const { data, error } = await query;
      if (error || !data) return [];

      return data.map(row => this.mapChangeFromDb(row));

    } catch (error: any) {
      this.logger.warn(`Failed to get recent changes: ${error.message}`);
      return [];
    }
  }

  /**
   * Get relevant IDW standards for a paragraph
   */
  async getRelevantIDWStandards(paragraph: string): Promise<IDWStandard[]> {
    try {
      const client = this.supabase.getClient();
      const { data, error } = await client
        .from('idw_standards')
        .select('*')
        .contains('related_hgb_paragraphs', [paragraph])
        .eq('is_current', true);

      if (error || !data) return [];

      return data.map(row => this.mapIdwFromDb(row));

    } catch (error: any) {
      this.logger.warn(`Failed to get IDW standards: ${error.message}`);
      return [];
    }
  }

  /**
   * Get alerts for changes the user hasn't seen
   */
  async getChangeAlerts(userId: string): Promise<LegalChangeAlert[]> {
    const upcomingChanges = await this.getUpcomingChanges();
    const alerts: LegalChangeAlert[] = [];

    for (const change of upcomingChanges) {
      const userHasSeen = await this.hasUserSeenChange(userId, change.id);
      const paragraph = await this.getCurrentParagraph(change.paragraph);
      
      if (!paragraph) continue;

      const daysUntil = Math.ceil(
        (new Date(change.effectiveDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      alerts.push({
        change,
        paragraph,
        daysUntilEffective: daysUntil,
        userHasSeen,
        impactSeverity: this.assessImpactSeverity(change, daysUntil),
      });
    }

    // Sort by severity and date
    return alerts.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      const sevDiff = severityOrder[a.impactSeverity] - severityOrder[b.impactSeverity];
      if (sevDiff !== 0) return sevDiff;
      return a.daysUntilEffective - b.daysUntilEffective;
    });
  }

  /**
   * Mark a change as seen by user
   */
  async markChangeSeen(userId: string, changeId: string): Promise<void> {
    try {
      const client = this.supabase.getClient();
      await client.from('user_legal_content_views').insert({
        user_id: userId,
        content_type: 'change',
        content_id: changeId,
        dismissed_alert: true,
      });
    } catch (error: any) {
      this.logger.warn(`Failed to mark change seen: ${error.message}`);
    }
  }

  /**
   * Format legal context for display in tool results
   */
  formatLegalContextForDisplay(context: LegalContext): string {
    const lines: string[] = [];
    
    lines.push(`**${context.primaryParagraph.fullReference}** - ${context.primaryParagraph.title}`);
    lines.push(`Stand: ${this.formatDate(context.primaryParagraph.verifiedDate)}`);
    lines.push('');
    
    if (context.primaryParagraph.consolidationRelevance) {
      lines.push(context.primaryParagraph.consolidationRelevance);
    } else if (context.primaryParagraph.contentSummary) {
      lines.push(context.primaryParagraph.contentSummary);
    }
    
    if (context.idwStandards.length > 0) {
      lines.push('');
      lines.push('**IDW Hinweise:**');
      for (const idw of context.idwStandards) {
        lines.push(`- ${idw.standardId}: ${idw.summary}`);
      }
    }
    
    if (context.upcomingChanges.length > 0) {
      lines.push('');
      lines.push('**Bevorstehende Änderungen:**');
      for (const change of context.upcomingChanges) {
        lines.push(`- Ab ${this.formatDate(change.effectiveDate)}: ${change.changeSummary}`);
      }
    }
    
    if (context.primaryParagraph.sourceUrl) {
      lines.push('');
      lines.push(`[Volltext bei dejure.org](${context.primaryParagraph.sourceUrl})`);
    }
    
    return lines.join('\n');
  }

  /**
   * Map consolidation type to relevant HGB paragraph
   */
  private mapConsolidationTypeToHGB(consolidationType: string): string {
    const mapping: Record<string, string> = {
      'capital_consolidation': '§ 301 HGB',
      'debt_consolidation': '§ 303 HGB',
      'ic_elimination': '§ 303 HGB',
      'expense_income_elimination': '§ 305 HGB',
      'intermediate_result': '§ 304 HGB',
      'goodwill': '§ 309 HGB',
      'consolidation_obligation': '§ 290 HGB',
      'consolidation_scope': '§ 300 HGB',
      'minority_interests': '§ 307 HGB',
      'associated_companies': '§ 312 HGB',
      'currency_translation': '§ 308a HGB',
      'deferred_taxes': '§ 306 HGB',
    };

    return mapping[consolidationType] || '§ 290 HGB';
  }

  private getLegalDisclaimer(): string {
    return `Die HGB-Referenzen basieren auf dem aktuellen Rechtsstand und dienen als Orientierung. ` +
      `Bei Zweifelsfällen konsultieren Sie bitte die Fachliteratur, aktuelle Kommentare ` +
      `oder einen Rechtsberater. Diese Informationen stellen keine Rechtsberatung dar.`;
  }

  /**
   * Check if user has seen a change
   */
  private async hasUserSeenChange(userId: string, changeId: string): Promise<boolean> {
    try {
      const client = this.supabase.getClient();
      const { data } = await client
        .from('user_legal_content_views')
        .select('id')
        .eq('user_id', userId)
        .eq('content_type', 'change')
        .eq('content_id', changeId)
        .eq('dismissed_alert', true)
        .limit(1)
        .maybeSingle();

      return !!data;
    } catch {
      return false;
    }
  }

  /**
   * Assess impact severity
   */
  private assessImpactSeverity(change: LegislativeChange, daysUntil: number): 'low' | 'medium' | 'high' {
    if (daysUntil < 30) return 'high';
    if (daysUntil < 90) return 'medium';
    if (change.changeType === 'repeal' || change.changeType === 'amendment') return 'medium';
    return 'low';
  }

  /**
   * Map database row to HGBParagraph
   */
  private mapParagraphFromDb(row: any): HGBParagraph {
    return {
      id: row.id,
      paragraph: row.paragraph || row.full_reference?.replace(' HGB', '') || '',
      fullReference: row.full_reference || row.paragraph || '',
      title: row.title,
      contentSummary: row.content_summary || row.content?.substring(0, 200) || '',
      contentFull: row.content_full || row.content,
      consolidationRelevance: row.consolidation_relevance,
      effectiveDate: row.effective_date ? new Date(row.effective_date) : new Date(),
      supersededDate: row.superseded_date ? new Date(row.superseded_date) : undefined,
      isCurrent: row.is_current ?? true,
      sourceReference: row.source_reference,
      sourceUrl: row.source_url,
      verifiedDate: row.verified_date ? new Date(row.verified_date) : new Date(),
      verifiedBy: row.verified_by,
      category: row.category,
      subcategory: row.subcategory,
      tags: row.tags || [],
      relatedParagraphs: row.related_paragraphs || [],
      relatedIdwStandards: row.related_idw_standards || [],
    };
  }

  /**
   * Map database row to LegislativeChange
   */
  private mapChangeFromDb(row: any): LegislativeChange {
    return {
      id: row.id,
      paragraph: row.paragraph,
      changeType: row.change_type,
      announcedDate: row.announced_date ? new Date(row.announced_date) : undefined,
      effectiveDate: new Date(row.effective_date),
      changeSummary: row.change_summary,
      changeDetails: row.change_details,
      impactOnConsolidation: row.impact_on_consolidation,
      lawName: row.law_name,
      sourceReference: row.source_reference,
      sourceUrl: row.source_url,
      status: row.status,
      notifyUsers: row.notify_users,
      notificationSentAt: row.notification_sent_at ? new Date(row.notification_sent_at) : undefined,
    };
  }

  /**
   * Map database row to IDWStandard
   */
  private mapIdwFromDb(row: any): IDWStandard {
    return {
      id: row.id,
      standardId: row.standard_id,
      title: row.title,
      summary: row.summary,
      keyPoints: row.key_points || [],
      version: row.version,
      effectiveDate: new Date(row.effective_date),
      supersededDate: row.superseded_date ? new Date(row.superseded_date) : undefined,
      isCurrent: row.is_current ?? true,
      sourceUrl: row.source_url,
      verifiedDate: new Date(row.verified_date),
      relatedHgbParagraphs: row.related_hgb_paragraphs || [],
    };
  }

  /**
   * Local fallback for paragraphs
   */
  private getLocalFallback(reference: string): HGBParagraph | null {
    const localKnowledge: Record<string, Partial<HGBParagraph>> = {
      '§ 303 HGB': {
        paragraph: '§ 303',
        fullReference: '§ 303 HGB',
        title: 'Schuldenkonsolidierung',
        contentSummary: 'Ausleihungen und andere Forderungen, Rückstellungen und Verbindlichkeiten zwischen den in den Konzernabschluss einbezogenen Unternehmen sowie entsprechende Rechnungsabgrenzungsposten sind wegzulassen.',
        consolidationRelevance: 'Relevant für die Eliminierung konzerninterner Verbindlichkeiten und Forderungen.',
        category: 'Konsolidierung',
        tags: ['Schuldenkonsolidierung', 'IC'],
      },
    };

    const fallback = localKnowledge[reference];
    if (!fallback) return null;

    return {
      id: `local-${reference.replace(/\s/g, '-')}`,
      paragraph: fallback.paragraph || reference,
      fullReference: fallback.fullReference || reference,
      title: fallback.title || reference,
      contentSummary: fallback.contentSummary || '',
      consolidationRelevance: fallback.consolidationRelevance,
      effectiveDate: new Date(),
      isCurrent: true,
      verifiedDate: new Date(),
      category: fallback.category,
      tags: fallback.tags || [],
      relatedParagraphs: [],
      relatedIdwStandards: [],
    };
  }

  /**
   * Cache helpers
   */
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (cached.expiry < new Date()) {
      this.cache.delete(key);
      return null;
    }
    return cached.data;
  }

  private setCache(key: string, data: any): void {
    const expiry = new Date(Date.now() + this.CACHE_TTL_MS);
    this.cache.set(key, { data, expiry });
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }
}
