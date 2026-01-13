import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ReportingService } from './reporting.service';
import { ConsolidatedBalanceSheetService } from './consolidated-balance-sheet.service';
import { ConsolidatedNotesService } from './consolidated-notes.service';
import { DeferredTaxService } from './deferred-tax.service';
import { ComplianceChecklistService } from './compliance-checklist.service';
import * as XLSX from 'xlsx';

@Injectable()
export class ExportService {
  constructor(
    private supabaseService: SupabaseService,
    private reportingService: ReportingService,
    private balanceSheetService: ConsolidatedBalanceSheetService,
    private notesService: ConsolidatedNotesService,
    private deferredTaxService: DeferredTaxService,
    private complianceService: ComplianceChecklistService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Exportiert die konsolidierte Bilanz als Excel
   */
  async exportToExcel(financialStatementId: string): Promise<Buffer> {
    const report = await this.reportingService.generateConsolidationReport(
      financialStatementId,
      false,
    );

    const workbook = XLSX.utils.book_new();

    // Blatt 1: Konsolidierte Bilanz
    const balanceSheetData = [
      ['Konsolidierte Bilanz', '', '', ''],
      ['Geschäftsjahr:', report.fiscalYear, '', ''],
      ['Periode:', report.periodStart.toISOString().split('T')[0], 'bis', report.periodEnd.toISOString().split('T')[0]],
      ['', '', '', ''],
      ['AKTIVA', '', '', ''],
      ['', '', '', ''],
    ];

    // Anlagevermögen
    balanceSheetData.push(['Anlagevermögen', '', '', '']);
    for (const asset of report.balanceSheet.assets.fixedAssets) {
      balanceSheetData.push([
        asset.accountName,
        asset.accountNumber,
        asset.balance.toFixed(2),
        '',
      ]);
    }
    balanceSheetData.push([
      'Summe Anlagevermögen',
      '',
      report.balanceSheet.assets.fixedAssets
        .reduce((sum, a) => sum + a.balance, 0)
        .toFixed(2),
      '',
    ]);
    balanceSheetData.push(['', '', '', '']);

    // Umlaufvermögen
    balanceSheetData.push(['Umlaufvermögen', '', '', '']);
    for (const asset of report.balanceSheet.assets.currentAssets) {
      balanceSheetData.push([
        asset.accountName,
        asset.accountNumber,
        asset.balance.toFixed(2),
        '',
      ]);
    }
    balanceSheetData.push([
      'Summe Umlaufvermögen',
      '',
      report.balanceSheet.assets.currentAssets
        .reduce((sum, a) => sum + a.balance, 0)
        .toFixed(2),
      '',
    ]);
    balanceSheetData.push(['', '', '', '']);

    // Goodwill
    if (report.balanceSheet.assets.goodwill > 0) {
      balanceSheetData.push([
        'Geschäfts- oder Firmenwert (Goodwill)',
        '',
        report.balanceSheet.assets.goodwill.toFixed(2),
        '',
      ]);
    }
    balanceSheetData.push([
      'GESAMT AKTIVA',
      '',
      report.balanceSheet.assets.totalAssets.toFixed(2),
      '',
    ]);
    balanceSheetData.push(['', '', '', '']);
    balanceSheetData.push(['PASSIVA', '', '', '']);
    balanceSheetData.push(['', '', '', '']);

    // Eigenkapital
    balanceSheetData.push(['Eigenkapital', '', '', '']);
    for (const equity of report.balanceSheet.liabilities.equity.parentCompany) {
      balanceSheetData.push([
        equity.accountName,
        equity.accountNumber,
        equity.balance.toFixed(2),
        '',
      ]);
    }
    balanceSheetData.push([
      'Summe Eigenkapital',
      '',
      report.balanceSheet.liabilities.equity.parentCompany
        .reduce((sum, e) => sum + e.balance, 0)
        .toFixed(2),
      '',
    ]);
    balanceSheetData.push(['', '', '', '']);

    // Minderheitsanteile
    balanceSheetData.push([
      'Minderheitsanteile',
      '',
      report.balanceSheet.liabilities.equity.minorityInterests.toFixed(2),
      '',
    ]);
    balanceSheetData.push(['', '', '', '']);

    // Rückstellungen
    balanceSheetData.push(['Rückstellungen', '', '', '']);
    for (const provision of report.balanceSheet.liabilities.provisions) {
      balanceSheetData.push([
        provision.accountName,
        provision.accountNumber,
        provision.balance.toFixed(2),
        '',
      ]);
    }
    balanceSheetData.push(['', '', '', '']);

    // Verbindlichkeiten
    balanceSheetData.push(['Verbindlichkeiten', '', '', '']);
    for (const liability of report.balanceSheet.liabilities.liabilities) {
      balanceSheetData.push([
        liability.accountName,
        liability.accountNumber,
        liability.balance.toFixed(2),
        '',
      ]);
    }
    balanceSheetData.push([
      'GESAMT PASSIVA',
      '',
      report.balanceSheet.liabilities.totalLiabilities.toFixed(2),
      '',
    ]);

    const balanceSheetSheet = XLSX.utils.aoa_to_sheet(balanceSheetData);
    XLSX.utils.book_append_sheet(workbook, balanceSheetSheet, 'Konsolidierte Bilanz');

    // Blatt 2: Konsolidierungsübersicht
    const overviewData = [
      ['Konsolidierungsübersicht', '', '', ''],
      ['', '', '', ''],
      ['Eliminierungen', '', '', ''],
      ['Zwischenergebniseliminierung', '', '', ''],
      ['Anzahl:', report.overview.eliminations.intercompanyProfits.count, '', ''],
      [
        'Gesamtbetrag:',
        report.overview.eliminations.intercompanyProfits.totalAmount.toFixed(2),
        '',
        '',
      ],
      ['', '', '', ''],
      ['Schuldenkonsolidierung', '', '', ''],
      ['Anzahl:', report.overview.eliminations.debtConsolidation.count, '', ''],
      [
        'Gesamtbetrag:',
        report.overview.eliminations.debtConsolidation.totalAmount.toFixed(2),
        '',
        '',
      ],
      [
        'Forderungen eliminiert:',
        report.overview.eliminations.debtConsolidation.receivablesEliminated.toFixed(2),
        '',
        '',
      ],
      [
        'Verbindlichkeiten eliminiert:',
        report.overview.eliminations.debtConsolidation.payablesEliminated.toFixed(2),
        '',
        '',
      ],
      ['', '', '', ''],
      ['Kapitalkonsolidierung', '', '', ''],
      ['Anzahl:', report.overview.eliminations.capitalConsolidation.count, '', ''],
      [
        'Gesamtbetrag:',
        report.overview.eliminations.capitalConsolidation.totalAmount.toFixed(2),
        '',
        '',
      ],
      [
        'Beteiligungen verarbeitet:',
        report.overview.eliminations.capitalConsolidation.participationsProcessed,
        '',
        '',
      ],
      ['', '', '', ''],
      ['Minderheitsanteile', '', '', ''],
      ['Gesamt:', report.overview.minorityInterests.total.toFixed(2), '', ''],
      ['', '', '', ''],
      ['Goodwill', '', '', ''],
      ['Gesamt:', report.overview.goodwill.total.toFixed(2), '', ''],
    ];

    const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Konsolidierungsübersicht');

    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }

  /**
   * Exportiert die konsolidierte Bilanz als XML
   */
  async exportToXml(financialStatementId: string): Promise<string> {
    const report = await this.reportingService.generateConsolidationReport(
      financialStatementId,
      false,
    );

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<consolidatedBalanceSheet>\n';
    xml += `  <fiscalYear>${report.fiscalYear}</fiscalYear>\n`;
    xml += `  <periodStart>${report.periodStart.toISOString()}</periodStart>\n`;
    xml += `  <periodEnd>${report.periodEnd.toISOString()}</periodEnd>\n`;
    xml += '  <assets>\n';
    xml += `    <totalAssets>${report.balanceSheet.assets.totalAssets.toFixed(2)}</totalAssets>\n`;
    xml += '    <fixedAssets>\n';
    for (const asset of report.balanceSheet.assets.fixedAssets) {
      xml += `      <position>\n`;
      xml += `        <accountNumber>${asset.accountNumber}</accountNumber>\n`;
      xml += `        <accountName>${this.escapeXml(asset.accountName)}</accountName>\n`;
      xml += `        <balance>${asset.balance.toFixed(2)}</balance>\n`;
      xml += `      </position>\n`;
    }
    xml += '    </fixedAssets>\n';
    xml += '    <currentAssets>\n';
    for (const asset of report.balanceSheet.assets.currentAssets) {
      xml += `      <position>\n`;
      xml += `        <accountNumber>${asset.accountNumber}</accountNumber>\n`;
      xml += `        <accountName>${this.escapeXml(asset.accountName)}</accountName>\n`;
      xml += `        <balance>${asset.balance.toFixed(2)}</balance>\n`;
      xml += `      </position>\n`;
    }
    xml += '    </currentAssets>\n';
    xml += `    <goodwill>${report.balanceSheet.assets.goodwill.toFixed(2)}</goodwill>\n`;
    xml += '  </assets>\n';
    xml += '  <liabilities>\n';
    xml += `    <totalLiabilities>${report.balanceSheet.liabilities.totalLiabilities.toFixed(2)}</totalLiabilities>\n`;
    xml += '    <equity>\n';
    xml += `      <parentCompanyEquity>${report.balanceSheet.liabilities.equity.parentCompany
      .reduce((sum, e) => sum + e.balance, 0)
      .toFixed(2)}</parentCompanyEquity>\n`;
    xml += `      <minorityInterests>${report.balanceSheet.liabilities.equity.minorityInterests.toFixed(2)}</minorityInterests>\n`;
    xml += '    </equity>\n';
    xml += '  </liabilities>\n';
    xml += '  <overview>\n';
    xml += `    <totalEliminations>${(
      report.overview.eliminations.intercompanyProfits.totalAmount +
      report.overview.eliminations.debtConsolidation.totalAmount +
      report.overview.eliminations.capitalConsolidation.totalAmount
    ).toFixed(2)}</totalEliminations>\n`;
    xml += `    <minorityInterests>${report.overview.minorityInterests.total.toFixed(2)}</minorityInterests>\n`;
    xml += `    <goodwill>${report.overview.goodwill.total.toFixed(2)}</goodwill>\n`;
    xml += '  </overview>\n';
    xml += '</consolidatedBalanceSheet>';

    return xml;
  }

  /**
   * Exportiert die konsolidierte Bilanz als PDF
   * Hinweis: Für eine vollständige PDF-Implementierung würde eine Bibliothek wie pdfkit benötigt
   * Hier wird eine einfache Text-Version erstellt
   */
  async exportToPdf(financialStatementId: string): Promise<Buffer> {
    const report = await this.reportingService.generateConsolidationReport(
      financialStatementId,
      false,
    );

    // Vereinfachte PDF-Erstellung als Text
    // In Produktion sollte hier eine PDF-Bibliothek wie pdfkit verwendet werden
    let pdfContent = `Konsolidierte Bilanz\n`;
    pdfContent += `Geschäftsjahr: ${report.fiscalYear}\n`;
    pdfContent += `Periode: ${report.periodStart.toISOString().split('T')[0]} bis ${report.periodEnd.toISOString().split('T')[0]}\n\n`;
    pdfContent += `AKTIVA\n`;
    pdfContent += `Anlagevermögen: ${report.balanceSheet.assets.fixedAssets
      .reduce((sum, a) => sum + a.balance, 0)
      .toFixed(2)}\n`;
    pdfContent += `Umlaufvermögen: ${report.balanceSheet.assets.currentAssets
      .reduce((sum, a) => sum + a.balance, 0)
      .toFixed(2)}\n`;
    pdfContent += `Goodwill: ${report.balanceSheet.assets.goodwill.toFixed(2)}\n`;
    pdfContent += `GESAMT AKTIVA: ${report.balanceSheet.assets.totalAssets.toFixed(2)}\n\n`;
    pdfContent += `PASSIVA\n`;
    pdfContent += `Eigenkapital: ${report.balanceSheet.liabilities.equity.parentCompany
      .reduce((sum, e) => sum + e.balance, 0)
      .toFixed(2)}\n`;
    pdfContent += `Minderheitsanteile: ${report.balanceSheet.liabilities.equity.minorityInterests.toFixed(2)}\n`;
    pdfContent += `Rückstellungen: ${report.balanceSheet.liabilities.provisions
      .reduce((sum, p) => sum + p.balance, 0)
      .toFixed(2)}\n`;
    pdfContent += `Verbindlichkeiten: ${report.balanceSheet.liabilities.liabilities
      .reduce((sum, l) => sum + l.balance, 0)
      .toFixed(2)}\n`;
    pdfContent += `GESAMT PASSIVA: ${report.balanceSheet.liabilities.totalLiabilities.toFixed(2)}\n`;

    // Hinweis: Für echte PDF-Erstellung sollte pdfkit oder ähnliches verwendet werden
    return Buffer.from(pdfContent, 'utf-8');
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Export complete consolidation package (multi-sheet Excel)
   */
  async exportFullConsolidationPackage(financialStatementId: string): Promise<Buffer> {
    const report = await this.reportingService.generateConsolidationReport(
      financialStatementId,
      false,
    );

    const workbook = XLSX.utils.book_new();

    // Sheet 1: Konsolidierte Bilanz (existing logic)
    const balanceSheetSheet = this.createBalanceSheetSheet(report);
    XLSX.utils.book_append_sheet(workbook, balanceSheetSheet, 'Konzernbilanz');

    // Sheet 2: Konsolidierungsübersicht
    const overviewSheet = this.createOverviewSheet(report);
    XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Konsolidierung');

    // Sheet 3: Konzernanhang
    try {
      const notes = await this.notesService.generateConsolidatedNotes(financialStatementId);
      const notesSheet = this.createNotesSheet(notes);
      XLSX.utils.book_append_sheet(workbook, notesSheet, 'Konzernanhang');
    } catch (error) {
      console.warn('Could not generate notes sheet:', error);
    }

    // Sheet 4: Latente Steuern
    try {
      const deferredTaxes = await this.deferredTaxService.getDeferredTaxes(financialStatementId);
      const summary = await this.deferredTaxService.getDeferredTaxSummary(financialStatementId);
      const deferredTaxSheet = this.createDeferredTaxSheet(deferredTaxes, summary);
      XLSX.utils.book_append_sheet(workbook, deferredTaxSheet, 'Latente Steuern');
    } catch (error) {
      console.warn('Could not generate deferred tax sheet:', error);
    }

    // Sheet 5: Compliance Checklist
    try {
      const compliance = await this.complianceService.getComplianceSummary(financialStatementId);
      const checklist = await this.complianceService.getChecklist(financialStatementId);
      const complianceSheet = this.createComplianceSheet(checklist, compliance);
      XLSX.utils.book_append_sheet(workbook, complianceSheet, 'Compliance');
    } catch (error) {
      console.warn('Could not generate compliance sheet:', error);
    }

    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }

  /**
   * Create balance sheet worksheet
   */
  private createBalanceSheetSheet(report: any): XLSX.WorkSheet {
    const data = [
      ['Konsolidierte Bilanz', '', '', ''],
      ['Geschäftsjahr:', report.fiscalYear, '', ''],
      ['Periode:', report.periodStart.toISOString().split('T')[0], 'bis', report.periodEnd.toISOString().split('T')[0]],
      ['', '', '', ''],
      ['AKTIVA', '', 'EUR', ''],
      ['', '', '', ''],
      ['Anlagevermögen', '', '', ''],
    ];

    for (const asset of report.balanceSheet.assets.fixedAssets) {
      data.push([`  ${asset.accountName}`, asset.accountNumber, asset.balance.toFixed(2), '']);
    }
    data.push([
      'Summe Anlagevermögen', '', 
      report.balanceSheet.assets.fixedAssets.reduce((sum: number, a: any) => sum + a.balance, 0).toFixed(2), ''
    ]);
    data.push(['', '', '', '']);

    data.push(['Umlaufvermögen', '', '', '']);
    for (const asset of report.balanceSheet.assets.currentAssets) {
      data.push([`  ${asset.accountName}`, asset.accountNumber, asset.balance.toFixed(2), '']);
    }
    data.push([
      'Summe Umlaufvermögen', '',
      report.balanceSheet.assets.currentAssets.reduce((sum: number, a: any) => sum + a.balance, 0).toFixed(2), ''
    ]);
    data.push(['', '', '', '']);

    if (report.balanceSheet.assets.goodwill > 0) {
      data.push(['Geschäfts-/Firmenwert', '', report.balanceSheet.assets.goodwill.toFixed(2), '']);
    }
    data.push(['GESAMT AKTIVA', '', report.balanceSheet.assets.totalAssets.toFixed(2), '']);
    data.push(['', '', '', '']);
    data.push(['PASSIVA', '', 'EUR', '']);
    data.push(['', '', '', '']);

    data.push(['Eigenkapital', '', '', '']);
    for (const equity of report.balanceSheet.liabilities.equity.parentCompany) {
      data.push([`  ${equity.accountName}`, equity.accountNumber, equity.balance.toFixed(2), '']);
    }
    data.push(['Minderheitsanteile', '', report.balanceSheet.liabilities.equity.minorityInterests.toFixed(2), '']);
    data.push(['', '', '', '']);

    data.push(['Rückstellungen', '', '', '']);
    for (const provision of report.balanceSheet.liabilities.provisions) {
      data.push([`  ${provision.accountName}`, provision.accountNumber, provision.balance.toFixed(2), '']);
    }
    data.push(['', '', '', '']);

    data.push(['Verbindlichkeiten', '', '', '']);
    for (const liability of report.balanceSheet.liabilities.liabilities) {
      data.push([`  ${liability.accountName}`, liability.accountNumber, liability.balance.toFixed(2), '']);
    }
    data.push(['GESAMT PASSIVA', '', report.balanceSheet.liabilities.totalLiabilities.toFixed(2), '']);

    return XLSX.utils.aoa_to_sheet(data);
  }

  /**
   * Create overview worksheet
   */
  private createOverviewSheet(report: any): XLSX.WorkSheet {
    const data = [
      ['Konsolidierungsübersicht', '', '', ''],
      ['', '', '', ''],
      ['Eliminierungen', 'Anzahl', 'Betrag (EUR)', ''],
      ['Zwischenergebniseliminierung', report.overview.eliminations.intercompanyProfits.count, report.overview.eliminations.intercompanyProfits.totalAmount.toFixed(2), ''],
      ['Schuldenkonsolidierung', report.overview.eliminations.debtConsolidation.count, report.overview.eliminations.debtConsolidation.totalAmount.toFixed(2), ''],
      ['Kapitalkonsolidierung', report.overview.eliminations.capitalConsolidation.count, report.overview.eliminations.capitalConsolidation.totalAmount.toFixed(2), ''],
      ['', '', '', ''],
      ['Schuldenkonsolidierung Details', '', '', ''],
      ['Forderungen eliminiert', '', report.overview.eliminations.debtConsolidation.receivablesEliminated.toFixed(2), ''],
      ['Verbindlichkeiten eliminiert', '', report.overview.eliminations.debtConsolidation.payablesEliminated.toFixed(2), ''],
      ['', '', '', ''],
      ['Kapitalkonsolidierung Details', '', '', ''],
      ['Beteiligungen verarbeitet', '', report.overview.eliminations.capitalConsolidation.participationsProcessed, ''],
      ['', '', '', ''],
      ['Minderheitsanteile', '', report.overview.minorityInterests.total.toFixed(2), ''],
      ['Goodwill', '', report.overview.goodwill.total.toFixed(2), ''],
    ];

    return XLSX.utils.aoa_to_sheet(data);
  }

  /**
   * Create notes worksheet
   */
  private createNotesSheet(notes: any): XLSX.WorkSheet {
    const data = [
      ['Konzernanhang', '', '', ''],
      ['Geschäftsjahr:', notes.fiscalYear, '', ''],
      ['', '', '', ''],
      ['KONSOLIDIERUNGSKREIS', '', '', ''],
      ['Mutterunternehmen:', notes.consolidationScope.parentCompany.name, '', ''],
      ['Anzahl Gesellschaften:', notes.consolidationScope.totalCompanies, '', ''],
      ['Davon konsolidiert:', notes.consolidationScope.consolidatedCompanies, '', ''],
      ['Davon ausgeschlossen:', notes.consolidationScope.excludedCompanies, '', ''],
      ['', '', '', ''],
      ['TOCHTERGESELLSCHAFTEN', 'Beteiligung %', 'Methode', 'Einbezug seit'],
    ];

    for (const sub of notes.consolidationScope.subsidiaries) {
      data.push([
        sub.name,
        sub.participationPercentage.toFixed(1) + '%',
        sub.consolidationMethod,
        sub.includedFrom,
      ]);
    }

    data.push(['', '', '', '']);
    data.push(['GOODWILL', '', '', '']);
    data.push(['Gesamt:', notes.goodwillBreakdown.total.toFixed(2), 'EUR', '']);

    for (const gw of notes.goodwillBreakdown.breakdown) {
      data.push([
        `  ${gw.subsidiaryCompanyName}`,
        gw.goodwill.toFixed(2),
        'EUR',
        '',
      ]);
    }

    data.push(['', '', '', '']);
    data.push(['MINDERHEITSANTEILE', '', '', '']);
    data.push(['Gesamt:', notes.minorityInterestsBreakdown.total.toFixed(2), 'EUR', '']);

    for (const mi of notes.minorityInterestsBreakdown.breakdown) {
      data.push([
        `  ${mi.subsidiaryCompanyName}`,
        mi.minorityEquity.toFixed(2),
        `${mi.minorityPercentage.toFixed(1)}%`,
        '',
      ]);
    }

    data.push(['', '', '', '']);
    data.push(['HGB-REFERENZEN', '', '', '']);
    for (const ref of notes.hgbReferences) {
      data.push([ref, '', '', '']);
    }

    return XLSX.utils.aoa_to_sheet(data);
  }

  /**
   * Create deferred tax worksheet
   */
  private createDeferredTaxSheet(deferredTaxes: any[], summary: any): XLSX.WorkSheet {
    const data = [
      ['Latente Steuern (§ 306 HGB)', '', '', '', ''],
      ['', '', '', '', ''],
      ['ZUSAMMENFASSUNG', '', '', '', ''],
      ['Aktive latente Steuern:', summary.totalDeferredTaxAssets?.toFixed(2) || '0.00', 'EUR', '', ''],
      ['Passive latente Steuern:', summary.totalDeferredTaxLiabilities?.toFixed(2) || '0.00', 'EUR', '', ''],
      ['Netto latente Steuern:', summary.netDeferredTax?.toFixed(2) || '0.00', 'EUR', '', ''],
      ['Veränderung zum Vorjahr:', summary.changeFromPriorYear?.toFixed(2) || '0.00', 'EUR', '', ''],
      ['', '', '', '', ''],
      ['DETAILAUFSTELLUNG', '', '', '', ''],
      ['Beschreibung', 'Typ', 'Temporäre Differenz', 'Steuersatz', 'Latente Steuer'],
    ];

    for (const dt of deferredTaxes) {
      data.push([
        dt.description,
        dt.differenceType === 'deductible' ? 'Aktiv' : 'Passiv',
        dt.temporaryDifferenceAmount?.toFixed(2) || '0.00',
        `${dt.taxRate?.toFixed(1) || '0.0'}%`,
        dt.deferredTaxAmount?.toFixed(2) || '0.00',
      ]);
    }

    return XLSX.utils.aoa_to_sheet(data);
  }

  /**
   * Create compliance worksheet
   */
  private createComplianceSheet(checklist: any[], summary: any): XLSX.WorkSheet {
    const data = [
      ['HGB Compliance Checkliste', '', '', '', ''],
      ['', '', '', '', ''],
      ['ZUSAMMENFASSUNG', '', '', '', ''],
      ['Gesamt Prüfpunkte:', summary.totalItems, '', '', ''],
      ['Abgeschlossen:', summary.completed, `(${summary.percentComplete}%)`, '', ''],
      ['In Bearbeitung:', summary.inProgress, '', '', ''],
      ['Offen:', summary.notStarted, '', '', ''],
      ['Überfällig:', summary.overdue, '', '', ''],
      ['Pflichtpunkte erfüllt:', summary.mandatoryComplete ? 'Ja' : 'Nein', '', '', ''],
      ['', '', '', '', ''],
      ['CHECKLISTE', '', '', '', ''],
      ['Code', 'Beschreibung', 'HGB', 'Status', 'Pflicht'],
    ];

    for (const item of checklist) {
      data.push([
        item.itemCode,
        item.description,
        item.hgbReference || '',
        this.translateStatus(item.status),
        item.isMandatory ? 'Ja' : 'Nein',
      ]);
    }

    return XLSX.utils.aoa_to_sheet(data);
  }

  /**
   * Translate status to German
   */
  private translateStatus(status: string): string {
    const translations: Record<string, string> = {
      'not_started': 'Offen',
      'in_progress': 'In Bearbeitung',
      'completed': 'Abgeschlossen',
      'not_applicable': 'N/A',
      'requires_review': 'Prüfung erforderlich',
    };
    return translations[status] || status;
  }

  /**
   * Export to XBRL format (simplified)
   */
  async exportToXbrl(financialStatementId: string): Promise<string> {
    const report = await this.reportingService.generateConsolidationReport(
      financialStatementId,
      false,
    );

    // Simplified XBRL - in production would use full XBRL taxonomy
    let xbrl = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xbrl += '<xbrl xmlns="http://www.xbrl.org/2003/instance"\n';
    xbrl += '      xmlns:hgb="http://www.hgb.de/taxonomy"\n';
    xbrl += '      xmlns:iso4217="http://www.xbrl.org/2003/iso4217">\n';
    xbrl += '  <context id="CurrentYear">\n';
    xbrl += `    <period><startDate>${report.periodStart.toISOString().split('T')[0]}</startDate>`;
    xbrl += `<endDate>${report.periodEnd.toISOString().split('T')[0]}</endDate></period>\n`;
    xbrl += '  </context>\n';
    xbrl += '  <unit id="EUR"><measure>iso4217:EUR</measure></unit>\n';
    
    // Assets
    xbrl += `  <hgb:Bilanzsumme contextRef="CurrentYear" unitRef="EUR" decimals="2">${report.balanceSheet.assets.totalAssets}</hgb:Bilanzsumme>\n`;
    xbrl += `  <hgb:Anlagevermoegen contextRef="CurrentYear" unitRef="EUR" decimals="2">${report.balanceSheet.assets.fixedAssets.reduce((s: number, a: any) => s + a.balance, 0)}</hgb:Anlagevermoegen>\n`;
    xbrl += `  <hgb:Umlaufvermoegen contextRef="CurrentYear" unitRef="EUR" decimals="2">${report.balanceSheet.assets.currentAssets.reduce((s: number, a: any) => s + a.balance, 0)}</hgb:Umlaufvermoegen>\n`;
    xbrl += `  <hgb:Geschaeftswert contextRef="CurrentYear" unitRef="EUR" decimals="2">${report.balanceSheet.assets.goodwill}</hgb:Geschaeftswert>\n`;
    
    // Liabilities
    xbrl += `  <hgb:SummePassiva contextRef="CurrentYear" unitRef="EUR" decimals="2">${report.balanceSheet.liabilities.totalLiabilities}</hgb:SummePassiva>\n`;
    xbrl += `  <hgb:Eigenkapital contextRef="CurrentYear" unitRef="EUR" decimals="2">${report.balanceSheet.liabilities.equity.parentCompany.reduce((s: number, e: any) => s + e.balance, 0)}</hgb:Eigenkapital>\n`;
    xbrl += `  <hgb:Minderheitenanteile contextRef="CurrentYear" unitRef="EUR" decimals="2">${report.balanceSheet.liabilities.equity.minorityInterests}</hgb:Minderheitenanteile>\n`;
    
    xbrl += '</xbrl>';

    return xbrl;
  }
}
