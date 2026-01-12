import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ReportingService } from './reporting.service';
import { ConsolidatedBalanceSheetService } from './consolidated-balance-sheet.service';
import * as XLSX from 'xlsx';

@Injectable()
export class ExportService {
  constructor(
    private supabaseService: SupabaseService,
    private reportingService: ReportingService,
    private balanceSheetService: ConsolidatedBalanceSheetService,
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
}
