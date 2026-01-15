import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { IC_ANALYSIS_PROMPT, buildPrompt } from '../prompts/prompts';
import { ICExplanationDto, ICCauseType, CorrectionEntry } from '../dto/ic-analysis.dto';

interface EnrichedReconciliation {
  id: string;
  financial_statement_id: string;
  company_a: { id: string; name: string } | null;
  company_b: { id: string; name: string } | null;
  account_a: { account_number: string; name: string } | null;
  account_b: { account_number: string; name: string } | null;
  amount_company_a: number;
  amount_company_b: number;
  difference_amount: number;
  status: string;
  explanation?: string;
}

@Injectable()
export class ICAnalysisService {
  private readonly logger = new Logger(ICAnalysisService.name);

  constructor(
    private gemini: GeminiService,
    private supabase: SupabaseService,
  ) {}

  /**
   * Explain an IC difference using AI
   */
  async explainDifference(reconciliationId: string): Promise<ICExplanationDto> {
    const client = this.supabase.getClient();

    // 1. Fetch reconciliation with related data
    const { data: recon, error } = await client
      .from('ic_reconciliations')
      .select(`
        *,
        company_a:companies!ic_reconciliations_company_a_id_fkey(id, name),
        company_b:companies!ic_reconciliations_company_b_id_fkey(id, name),
        account_a:accounts!ic_reconciliations_account_a_id_fkey(account_number, name),
        account_b:accounts!ic_reconciliations_account_b_id_fkey(account_number, name)
      `)
      .eq('id', reconciliationId)
      .single();

    if (error || !recon) {
      throw new NotFoundException(`IC-Abstimmung ${reconciliationId} nicht gefunden`);
    }

    // 2. Build context for Gemini
    const context = this.buildICContext(recon as EnrichedReconciliation);

    // 3. Ask Gemini to analyze
    const prompt = buildPrompt(IC_ANALYSIS_PROMPT, { IC_DATA: context });
    
    let response: string;
    try {
      response = await this.gemini.complete(prompt);
    } catch (error: any) {
      this.logger.error(`Gemini analysis failed: ${error.message}`);
      // Return a fallback analysis
      return this.createFallbackAnalysis(reconciliationId, recon as EnrichedReconciliation);
    }

    // 4. Parse Gemini's response
    const analysis = this.parseAnalysisResponse(response, recon as EnrichedReconciliation);

    // 5. Cache the analysis in database
    try {
      await client
        .from('ic_reconciliations')
        .update({
          ai_analysis: analysis,
          ai_analysis_at: new Date().toISOString(),
        })
        .eq('id', reconciliationId);
    } catch (cacheError: any) {
      this.logger.warn(`Failed to cache AI analysis: ${cacheError.message}`);
    }

    return {
      reconciliationId,
      ...analysis,
    };
  }

  /**
   * Analyze all open IC differences for a financial statement
   */
  async batchAnalyze(financialStatementId: string): Promise<ICExplanationDto[]> {
    const client = this.supabase.getClient();

    // Get all open IC reconciliations
    const { data: openRecons, error } = await client
      .from('ic_reconciliations')
      .select('id')
      .eq('financial_statement_id', financialStatementId)
      .eq('status', 'open')
      .order('difference_amount', { ascending: false });

    if (error) {
      throw new Error(`Fehler beim Laden der IC-Abstimmungen: ${error.message}`);
    }

    if (!openRecons || openRecons.length === 0) {
      return [];
    }

    // Analyze each one (limit to 10 to avoid API rate limits)
    const results: ICExplanationDto[] = [];
    const toAnalyze = openRecons.slice(0, 10);

    for (const recon of toAnalyze) {
      try {
        const analysis = await this.explainDifference(recon.id);
        results.push(analysis);
        
        // Small delay to avoid rate limiting
        await this.delay(500);
      } catch (error: any) {
        this.logger.error(`Failed to analyze ${recon.id}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Build context string for IC analysis
   */
  private buildICContext(recon: EnrichedReconciliation): string {
    const diff = Math.abs(recon.difference_amount || 0);
    const isSmall = diff < 100;
    const isMedium = diff >= 100 && diff < 10000;

    return `
IC-Abstimmung Details:
- Unternehmen A: ${recon.company_a?.name || 'Unbekannt'} (Konto: ${recon.account_a?.account_number || 'k.A.'} - ${recon.account_a?.name || 'k.A.'})
- Unternehmen B: ${recon.company_b?.name || 'Unbekannt'} (Konto: ${recon.account_b?.account_number || 'k.A.'} - ${recon.account_b?.name || 'k.A.'})
- Betrag Unternehmen A: €${(recon.amount_company_a || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
- Betrag Unternehmen B: €${(recon.amount_company_b || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
- Differenz: €${diff.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
- Status: ${recon.status}
- Differenzgröße: ${isSmall ? 'Klein (<€100)' : isMedium ? 'Mittel (€100-€10.000)' : 'Groß (>€10.000)'}
${recon.explanation ? `- Vorhandene Erklärung: ${recon.explanation}` : ''}
    `.trim();
  }

  /**
   * Parse Gemini's response to extract structured data
   */
  private parseAnalysisResponse(
    response: string,
    recon: EnrichedReconciliation,
  ): Omit<ICExplanationDto, 'reconciliationId'> {
    const lowerResponse = response.toLowerCase();
    const diff = Math.abs(recon.difference_amount || 0);

    // Determine likely cause
    let likelyCause: ICCauseType = 'unknown';
    let confidence = 0.5;

    if (lowerResponse.includes('timing') || lowerResponse.includes('zeitlich') || 
        lowerResponse.includes('stichtag') || lowerResponse.includes('buchungsdatum') ||
        lowerResponse.includes('periode')) {
      likelyCause = 'timing';
      confidence = 0.8;
    } else if (lowerResponse.includes('währung') || lowerResponse.includes('wechselkurs') ||
               lowerResponse.includes('fx') || lowerResponse.includes('currency') ||
               lowerResponse.includes('kurs')) {
      likelyCause = 'fx';
      confidence = 0.8;
    } else if (lowerResponse.includes('rundung') || lowerResponse.includes('rounding') ||
               diff < 10) {
      likelyCause = 'rounding';
      confidence = 0.9;
    } else if (lowerResponse.includes('fehlend') || lowerResponse.includes('missing') ||
               lowerResponse.includes('nicht gebucht') || lowerResponse.includes('vergessen')) {
      likelyCause = 'missing_entry';
      confidence = 0.7;
    } else if (lowerResponse.includes('fehler') || lowerResponse.includes('error') ||
               lowerResponse.includes('falsch') || lowerResponse.includes('inkorrekt')) {
      likelyCause = 'error';
      confidence = 0.6;
    }

    // Generate suggested action based on cause
    const { suggestedAction, correctionEntry } = this.generateSuggestion(likelyCause, recon);

    return {
      explanation: response,
      likelyCause,
      confidence,
      suggestedAction,
      correctionEntry,
    };
  }

  /**
   * Generate suggestion based on cause type
   */
  private generateSuggestion(
    cause: ICCauseType,
    recon: EnrichedReconciliation,
  ): { suggestedAction: string; correctionEntry?: CorrectionEntry } {
    const diff = Math.abs(recon.difference_amount || 0);

    switch (cause) {
      case 'timing':
        return {
          suggestedAction: 'Als Stichtagsdifferenz akzeptieren oder Buchungsdatum angleichen',
        };

      case 'fx':
        return {
          suggestedAction: 'Einheitlichen Wechselkurs verwenden und Differenz als Währungsanpassung buchen',
          correctionEntry: {
            debitAccount: recon.account_a?.account_number || 'TBD',
            creditAccount: 'Währungsdifferenzen',
            amount: diff,
            description: `Währungsanpassung IC ${recon.company_a?.name} / ${recon.company_b?.name}`,
          },
        };

      case 'rounding':
        return {
          suggestedAction: 'Als unwesentliche Rundungsdifferenz akzeptieren',
        };

      case 'missing_entry':
        return {
          suggestedAction: 'Fehlende Gegenbuchung erstellen',
          correctionEntry: {
            debitAccount: recon.account_b?.account_number || 'TBD',
            creditAccount: recon.account_a?.account_number || 'TBD',
            amount: diff,
            description: `Nachbuchung IC-Abstimmung ${recon.company_a?.name} / ${recon.company_b?.name}`,
          },
        };

      case 'error':
        return {
          suggestedAction: 'Manuelle Prüfung der Buchungen erforderlich - bitte Belege prüfen',
        };

      default:
        return {
          suggestedAction: 'Weitere Analyse erforderlich',
        };
    }
  }

  /**
   * Create fallback analysis when AI fails
   */
  private createFallbackAnalysis(
    reconciliationId: string,
    recon: EnrichedReconciliation,
  ): ICExplanationDto {
    const diff = Math.abs(recon.difference_amount || 0);
    
    let likelyCause: ICCauseType = 'unknown';
    let suggestedAction = 'Manuelle Analyse erforderlich';

    // Simple rule-based fallback
    if (diff < 10) {
      likelyCause = 'rounding';
      suggestedAction = 'Wahrscheinlich Rundungsdifferenz - als unwesentlich akzeptieren';
    } else if (diff < 100) {
      likelyCause = 'rounding';
      suggestedAction = 'Möglicherweise Rundungsdifferenz - prüfen und ggf. akzeptieren';
    }

    return {
      reconciliationId,
      explanation: `Automatische Analyse: Differenz von €${diff.toLocaleString('de-DE', { minimumFractionDigits: 2 })} zwischen ${recon.company_a?.name || 'Unternehmen A'} und ${recon.company_b?.name || 'Unternehmen B'}.`,
      likelyCause,
      confidence: 0.3,
      suggestedAction,
    };
  }

  /**
   * Helper delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
