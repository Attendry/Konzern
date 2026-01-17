import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import { Response } from 'express';
import { ConsolidatedNotesService } from './consolidated-notes.service';
import { ConsolidatedNotes } from './consolidated-notes.service';

@Controller('consolidation/notes')
export class ConsolidatedNotesController {
  constructor(
    private readonly consolidatedNotesService: ConsolidatedNotesService,
  ) {}

  /**
   * Generiert alle Pflichtangaben für den Konzernanhang
   * GET /api/consolidation/notes/:financialStatementId
   */
  @Get(':financialStatementId')
  async getConsolidatedNotes(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ): Promise<ConsolidatedNotes> {
    return this.consolidatedNotesService.generateConsolidatedNotes(
      financialStatementId,
    );
  }

  /**
   * Export als JSON (für spätere Word/PDF/XBRL Export-Funktionen)
   * GET /api/consolidation/notes/:financialStatementId/export/json
   */
  @Get(':financialStatementId/export/json')
  async exportAsJson(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Res() res: Response,
  ) {
    const notes =
      await this.consolidatedNotesService.generateConsolidatedNotes(
        financialStatementId,
      );
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="konzernanhang_${notes.fiscalYear}.json"`,
    );
    res.json(notes);
  }

  /**
   * Export als Text (vereinfachter Export)
   * GET /api/consolidation/notes/:financialStatementId/export/text
   */
  @Get(':financialStatementId/export/text')
  async exportAsText(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Res() res: Response,
  ) {
    const notes =
      await this.consolidatedNotesService.generateConsolidatedNotes(
        financialStatementId,
      );

    // Generiere Text-Format
    let text = `KONZERNANHANG\n`;
    text += `Geschäftsjahr: ${notes.fiscalYear}\n`;
    text += `Zeitraum: ${notes.periodStart.toLocaleDateString('de-DE')} - ${notes.periodEnd.toLocaleDateString('de-DE')}\n\n`;

    text += `1. KONSOLIDIERUNGSMETHODEN\n`;
    text += `================================\n`;
    for (const method of notes.consolidationMethods) {
      text += `${method.description}\n`;
      text += `HGB-Referenz: ${method.hgbReference}\n\n`;
    }

    text += `2. KONSOLIDIERUNGSKREIS\n`;
    text += `================================\n`;
    text += `Mutterunternehmen: ${notes.consolidationScope.parentCompany.name}\n`;
    text += `Anzahl konsolidierter Unternehmen: ${notes.consolidationScope.consolidatedCompanies}\n`;
    text += `Anzahl ausgeschlossener Unternehmen: ${notes.consolidationScope.excludedCompanies}\n\n`;
    text += `Tochtergesellschaften:\n`;
    for (const subsidiary of notes.consolidationScope.subsidiaries) {
      text += `- ${subsidiary.name} (${subsidiary.participationPercentage}%)\n`;
      if (subsidiary.exclusionReason) {
        text += `  Ausgeschlossen: ${subsidiary.exclusionReason}\n`;
      }
    }
    text += `\n`;

    text += `3. GOODWILL-AUFSCHLÜSSELUNG\n`;
    text += `================================\n`;
    text += `Gesamt: ${notes.goodwillBreakdown.total.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}\n\n`;
    for (const item of notes.goodwillBreakdown.breakdown) {
      text += `${item.subsidiaryCompanyName}:\n`;
      text += `  Goodwill: ${item.goodwill.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}\n`;
      if (item.negativeGoodwill > 0) {
        text += `  Passivischer Unterschiedsbetrag: ${item.negativeGoodwill.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}\n`;
      }
      text += `\n`;
    }

    text += `4. MINDERHEITSANTEILE\n`;
    text += `================================\n`;
    text += `Gesamt: ${notes.minorityInterestsBreakdown.total.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}\n\n`;
    for (const item of notes.minorityInterestsBreakdown.breakdown) {
      text += `${item.subsidiaryCompanyName}:\n`;
      text += `  Minderheitsanteil: ${item.minorityPercentage}%\n`;
      text += `  Minderheitsanteile Eigenkapital: ${item.minorityEquity.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}\n`;
      text += `  Minderheitsanteile Ergebnis: ${item.minorityResult.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}\n`;
      text += `\n`;
    }

    text += `5. ZWISCHENGESELLSCHAFTSGESCHÄFTE\n`;
    text += `================================\n`;
    for (const transaction of notes.intercompanyTransactions) {
      text += `${transaction.description}:\n`;
      text += `  Gesamtbetrag: ${transaction.totalAmount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}\n`;
      text += `  Eliminiert: ${transaction.eliminatedAmount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}\n`;
      text += `\n`;
    }

    text += `6. BILANZIERUNGS- UND BEWERTUNGSMETHODEN\n`;
    text += `================================\n`;
    text += `Konsolidierungsmethode: ${notes.accountingPolicies.consolidationMethod}\n`;
    text += `Währung: ${notes.accountingPolicies.currency}\n`;
    text += `Geschäftsjahresende: ${notes.accountingPolicies.fiscalYearEnd}\n`;
    text += `Bewertungsmethoden:\n`;
    for (const method of notes.accountingPolicies.valuationMethods) {
      text += `- ${method}\n`;
    }
    text += `\n`;

    if (notes.significantEvents.length > 0) {
      text += `7. WESENTLICHE EREIGNISSE\n`;
      text += `================================\n`;
      for (const event of notes.significantEvents) {
        text += `- ${event}\n`;
      }
      text += `\n`;
    }

    text += `HGB-REFERENZEN\n`;
    text += `================================\n`;
    for (const ref of notes.hgbReferences) {
      text += `- ${ref}\n`;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="konzernanhang_${notes.fiscalYear}.txt"`,
    );
    res.send(text);
  }
}
