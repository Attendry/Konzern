import { Injectable, Logger } from '@nestjs/common';
import { GeminiService, ChatMessage } from './gemini.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { CHAT_SYSTEM_PROMPT, buildPrompt } from '../prompts/prompts';
import { ChatResponseDto } from '../dto/chat.dto';

interface ContextData {
  contextString: string;
  data: Record<string, any>;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private gemini: GeminiService,
    private supabase: SupabaseService,
  ) {}

  /**
   * Process a chat message and return AI response
   */
  async processMessage(
    message: string,
    history: ChatMessage[],
    financialStatementId?: string,
  ): Promise<ChatResponseDto> {
    // 1. Build context from database if we have a financial statement
    let contextData: ContextData = {
      contextString: 'Keine Daten geladen.',
      data: {},
    };

    if (financialStatementId) {
      try {
        contextData = await this.buildContext(financialStatementId, message);
      } catch (error: any) {
        this.logger.warn(`Failed to build context: ${error.message}`);
      }
    }

    // 2. Build system prompt with context
    const systemPrompt = buildPrompt(CHAT_SYSTEM_PROMPT, {
      CONTEXT: contextData.contextString,
    });

    // 3. Add user message to history
    const messages: ChatMessage[] = [
      ...history,
      { role: 'user', content: message },
    ];

    // 4. Get response from Gemini
    const response = await this.gemini.chat(messages, systemPrompt);

    return {
      message: response,
      data:
        Object.keys(contextData.data).length > 0 ? contextData.data : undefined,
    };
  }

  /**
   * Build context from database based on the user's question
   */
  private async buildContext(
    financialStatementId: string,
    message: string,
  ): Promise<ContextData> {
    const client = this.supabase.getClient();
    const data: Record<string, any> = {};
    const contextParts: string[] = [];
    const lowerMessage = message.toLowerCase();

    // Get basic financial statement info
    const { data: fs, error: fsError } = await client
      .from('financial_statements')
      .select('*, companies(*)')
      .eq('id', financialStatementId)
      .single();

    if (fsError || !fs) {
      return { contextString: 'Jahresabschluss nicht gefunden.', data: {} };
    }

    contextParts.push(`Geschäftsjahr: ${fs.fiscal_year}`);
    contextParts.push(`Unternehmen: ${fs.companies?.name || 'Unbekannt'}`);
    contextParts.push(`Status: ${fs.status}`);
    data.financialStatement = fs;

    // If asking about IC/intercompany
    if (
      this.matchesAny(lowerMessage, [
        'ic',
        'intercompany',
        'differenz',
        'abstimmung',
        'konzernintern',
      ])
    ) {
      const { data: icData } = await client
        .from('ic_reconciliations')
        .select(
          `
          *,
          company_a:companies!ic_reconciliations_company_a_id_fkey(name),
          company_b:companies!ic_reconciliations_company_b_id_fkey(name)
        `,
        )
        .eq('financial_statement_id', financialStatementId);

      if (icData && icData.length > 0) {
        const openDiffs = icData.filter((ic) => ic.status === 'open');
        const totalDiff = openDiffs.reduce(
          (sum, ic) => sum + Math.abs(ic.difference_amount || 0),
          0,
        );

        contextParts.push('');
        contextParts.push('IC-Abstimmungen:');
        contextParts.push(`  - Gesamt: ${icData.length} Positionen`);
        contextParts.push(`  - Offen: ${openDiffs.length} Positionen`);
        contextParts.push(
          `  - Offene Differenzsumme: €${totalDiff.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`,
        );

        // Show top 5 open differences
        if (openDiffs.length > 0) {
          contextParts.push('  - Größte offene Differenzen:');
          const sorted = openDiffs
            .sort(
              (a, b) =>
                Math.abs(b.difference_amount) - Math.abs(a.difference_amount),
            )
            .slice(0, 5);
          for (const diff of sorted) {
            contextParts.push(
              `    • ${diff.company_a?.name} ↔ ${diff.company_b?.name}: €${Math.abs(diff.difference_amount).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`,
            );
          }
        }

        data.icReconciliations = icData;
      } else {
        contextParts.push('');
        contextParts.push('IC-Abstimmungen: Keine Daten vorhanden');
      }
    }

    // If asking about goodwill
    if (
      this.matchesAny(lowerMessage, [
        'goodwill',
        'firmenwert',
        'geschäftswert',
        'kapitalkonsolidierung',
      ])
    ) {
      const { data: entries } = await client
        .from('consolidation_entries')
        .select('*, companies:affected_company_ids')
        .eq('financial_statement_id', financialStatementId)
        .eq('adjustment_type', 'capital_consolidation');

      if (entries && entries.length > 0) {
        const goodwillTotal = entries.reduce(
          (sum, e) => sum + (e.amount || 0),
          0,
        );

        contextParts.push('');
        contextParts.push('Kapitalkonsolidierung:');
        contextParts.push(
          `  - Goodwill gesamt: €${goodwillTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`,
        );
        contextParts.push(`  - Anzahl Buchungen: ${entries.length}`);

        data.goodwillEntries = entries;
      }
    }

    // If asking about consolidation status/summary
    if (
      this.matchesAny(lowerMessage, [
        'status',
        'übersicht',
        'zusammenfassung',
        'konsolidierung',
      ])
    ) {
      const { data: entries } = await client
        .from('consolidation_entries')
        .select('adjustment_type, amount')
        .eq('financial_statement_id', financialStatementId);

      if (entries && entries.length > 0) {
        const byType: Record<string, number> = {};
        for (const e of entries) {
          byType[e.adjustment_type] =
            (byType[e.adjustment_type] || 0) + (e.amount || 0);
        }

        contextParts.push('');
        contextParts.push('Konsolidierungsbuchungen:');
        for (const [type, amount] of Object.entries(byType)) {
          const label = this.getAdjustmentTypeLabel(type);
          contextParts.push(
            `  - ${label}: €${amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`,
          );
        }

        data.consolidationSummary = byType;
      }
    }

    // If asking about companies/consolidation circle
    if (
      this.matchesAny(lowerMessage, [
        'gesellschaft',
        'unternehmen',
        'tochter',
        'kreis',
        'konzern',
      ])
    ) {
      const { data: companies } = await client
        .from('companies')
        .select('id, name, legal_form, is_consolidated, parent_company_id')
        .order('name');

      if (companies && companies.length > 0) {
        const consolidated = companies.filter((c) => c.is_consolidated);

        contextParts.push('');
        contextParts.push('Konsolidierungskreis:');
        contextParts.push(`  - Unternehmen gesamt: ${companies.length}`);
        contextParts.push(`  - Konsolidiert: ${consolidated.length}`);

        for (const c of consolidated.slice(0, 10)) {
          const isParent = !c.parent_company_id;
          contextParts.push(
            `  - ${c.name} (${c.legal_form || 'k.A.'})${isParent ? ' [Mutter]' : ''}`,
          );
        }

        if (consolidated.length > 10) {
          contextParts.push(`  ... und ${consolidated.length - 10} weitere`);
        }

        data.companies = companies;
      }
    }

    return {
      contextString: contextParts.join('\n'),
      data,
    };
  }

  /**
   * Check if message contains any of the keywords
   */
  private matchesAny(message: string, keywords: string[]): boolean {
    return keywords.some((kw) => message.includes(kw));
  }

  /**
   * Get German label for adjustment type
   */
  private getAdjustmentTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      capital_consolidation: 'Kapitalkonsolidierung',
      debt_consolidation: 'Schuldenkonsolidierung',
      elimination: 'Eliminierung',
      reclassification: 'Umbuchung',
      other: 'Sonstige',
    };
    return labels[type] || type;
  }
}
