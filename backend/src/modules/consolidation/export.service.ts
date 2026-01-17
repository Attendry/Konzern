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
      [
        'Periode:',
        report.periodStart.toISOString().split('T')[0],
        'bis',
        report.periodEnd.toISOString().split('T')[0],
      ],
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
    XLSX.utils.book_append_sheet(
      workbook,
      balanceSheetSheet,
      'Konsolidierte Bilanz',
    );

    // Blatt 2: Konsolidierungsübersicht
    const overviewData = [
      ['Konsolidierungsübersicht', '', '', ''],
      ['', '', '', ''],
      ['Eliminierungen', '', '', ''],
      ['Zwischenergebniseliminierung', '', '', ''],
      [
        'Anzahl:',
        report.overview.eliminations.intercompanyProfits.count,
        '',
        '',
      ],
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
        report.overview.eliminations.debtConsolidation.receivablesEliminated.toFixed(
          2,
        ),
        '',
        '',
      ],
      [
        'Verbindlichkeiten eliminiert:',
        report.overview.eliminations.debtConsolidation.payablesEliminated.toFixed(
          2,
        ),
        '',
        '',
      ],
      ['', '', '', ''],
      ['Kapitalkonsolidierung', '', '', ''],
      [
        'Anzahl:',
        report.overview.eliminations.capitalConsolidation.count,
        '',
        '',
      ],
      [
        'Gesamtbetrag:',
        report.overview.eliminations.capitalConsolidation.totalAmount.toFixed(
          2,
        ),
        '',
        '',
      ],
      [
        'Beteiligungen verarbeitet:',
        report.overview.eliminations.capitalConsolidation
          .participationsProcessed,
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
    XLSX.utils.book_append_sheet(
      workbook,
      overviewSheet,
      'Konsolidierungsübersicht',
    );

    return Buffer.from(
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
    );
  }

  /**
   * Exportiert die konsolidierte Bilanz als XML (einfaches Format)
   */
  async exportToXml(financialStatementId: string): Promise<string> {
    return this.exportToXbrl(financialStatementId);
  }

  /**
   * Exportiert die konsolidierte Bilanz im eBilanz/XBRL Format
   * Orientiert an der HGB-Taxonomie für Konzernabschlüsse
   */
  async exportToXbrl(financialStatementId: string): Promise<string> {
    const report = await this.reportingService.generateConsolidationReport(
      financialStatementId,
      true, // Include comparison for prior year
    );

    // Get company information
    const { data: statement } = await this.supabase
      .from('financial_statements')
      .select('*, companies(*)')
      .eq('id', financialStatementId)
      .single();

    const companyName = statement?.companies?.name || 'Konzern';
    const companyId = statement?.companies?.id || '';

    // Generate XBRL-compliant XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<!-- eBilanz Konzernabschluss nach HGB -->\n';
    xml += '<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance"\n';
    xml += '            xmlns:xlink="http://www.w3.org/1999/xlink"\n';
    xml +=
      '            xmlns:hgb-konzern="http://www.xbrl.de/taxonomies/hgb-konzern"\n';
    xml += '            xmlns:iso4217="http://www.xbrl.org/2003/iso4217">\n\n';

    // Context - Current Period
    xml += `  <!-- Kontexte -->\n`;
    xml += `  <xbrli:context id="CurrentPeriod">\n`;
    xml += `    <xbrli:entity>\n`;
    xml += `      <xbrli:identifier scheme="http://www.handelsregister.de">${this.escapeXml(companyName)}</xbrli:identifier>\n`;
    xml += `    </xbrli:entity>\n`;
    xml += `    <xbrli:period>\n`;
    xml += `      <xbrli:startDate>${report.periodStart.toISOString().split('T')[0]}</xbrli:startDate>\n`;
    xml += `      <xbrli:endDate>${report.periodEnd.toISOString().split('T')[0]}</xbrli:endDate>\n`;
    xml += `    </xbrli:period>\n`;
    xml += `  </xbrli:context>\n\n`;

    // Context - Prior Period (if comparison available)
    if (report.comparison) {
      xml += `  <xbrli:context id="PriorPeriod">\n`;
      xml += `    <xbrli:entity>\n`;
      xml += `      <xbrli:identifier scheme="http://www.handelsregister.de">${this.escapeXml(companyName)}</xbrli:identifier>\n`;
      xml += `    </xbrli:entity>\n`;
      xml += `    <xbrli:period>\n`;
      xml += `      <xbrli:instant>${report.fiscalYear - 1}-12-31</xbrli:instant>\n`;
      xml += `    </xbrli:period>\n`;
      xml += `  </xbrli:context>\n\n`;
    }

    // Unit for EUR
    xml += `  <xbrli:unit id="EUR">\n`;
    xml += `    <xbrli:measure>iso4217:EUR</xbrli:measure>\n`;
    xml += `  </xbrli:unit>\n\n`;

    // Company Information
    xml += `  <!-- Unternehmensinformationen -->\n`;
    xml += `  <hgb-konzern:nameKonzernmutter contextRef="CurrentPeriod">${this.escapeXml(companyName)}</hgb-konzern:nameKonzernmutter>\n`;
    xml += `  <hgb-konzern:geschaeftsjahr contextRef="CurrentPeriod">${report.fiscalYear}</hgb-konzern:geschaeftsjahr>\n`;
    xml += `  <hgb-konzern:bilanzstichtag contextRef="CurrentPeriod">${report.periodEnd.toISOString().split('T')[0]}</hgb-konzern:bilanzstichtag>\n\n`;

    // AKTIVA
    xml += `  <!-- AKTIVA (§ 266 HGB) -->\n`;
    xml += `  <hgb-konzern:summeAktiva contextRef="CurrentPeriod" unitRef="EUR" decimals="2">${report.balanceSheet.assets.totalAssets.toFixed(2)}</hgb-konzern:summeAktiva>\n`;

    // Anlagevermögen
    const fixedAssetsTotal = report.balanceSheet.assets.fixedAssets.reduce(
      (sum, a) => sum + a.balance,
      0,
    );
    xml += `  <hgb-konzern:anlagevermoegen contextRef="CurrentPeriod" unitRef="EUR" decimals="2">${fixedAssetsTotal.toFixed(2)}</hgb-konzern:anlagevermoegen>\n`;

    // Einzelpositionen Anlagevermögen
    for (const asset of report.balanceSheet.assets.fixedAssets) {
      xml += `  <hgb-konzern:anlageposition contextRef="CurrentPeriod" unitRef="EUR" decimals="2">\n`;
      xml += `    <!-- ${this.escapeXml(asset.accountName)} (${asset.accountNumber}) -->\n`;
      xml += `    ${asset.balance.toFixed(2)}\n`;
      xml += `  </hgb-konzern:anlageposition>\n`;
    }

    // Umlaufvermögen
    const currentAssetsTotal = report.balanceSheet.assets.currentAssets.reduce(
      (sum, a) => sum + a.balance,
      0,
    );
    xml += `  <hgb-konzern:umlaufvermoegen contextRef="CurrentPeriod" unitRef="EUR" decimals="2">${currentAssetsTotal.toFixed(2)}</hgb-konzern:umlaufvermoegen>\n`;

    // Goodwill
    if (report.balanceSheet.assets.goodwill > 0) {
      xml += `  <hgb-konzern:geschaeftsOderFirmenwert contextRef="CurrentPeriod" unitRef="EUR" decimals="2">${report.balanceSheet.assets.goodwill.toFixed(2)}</hgb-konzern:geschaeftsOderFirmenwert>\n`;
    }
    xml += `\n`;

    // PASSIVA
    xml += `  <!-- PASSIVA (§ 266 HGB) -->\n`;
    xml += `  <hgb-konzern:summePassiva contextRef="CurrentPeriod" unitRef="EUR" decimals="2">${report.balanceSheet.liabilities.totalLiabilities.toFixed(2)}</hgb-konzern:summePassiva>\n`;

    // Eigenkapital
    const parentEquity =
      report.balanceSheet.liabilities.equity.parentCompany.reduce(
        (sum, e) => sum + e.balance,
        0,
      );
    const totalEquity =
      parentEquity + report.balanceSheet.liabilities.equity.minorityInterests;
    xml += `  <hgb-konzern:eigenkapital contextRef="CurrentPeriod" unitRef="EUR" decimals="2">${totalEquity.toFixed(2)}</hgb-konzern:eigenkapital>\n`;
    xml += `  <hgb-konzern:eigenkapitalMutterunternehmen contextRef="CurrentPeriod" unitRef="EUR" decimals="2">${parentEquity.toFixed(2)}</hgb-konzern:eigenkapitalMutterunternehmen>\n`;

    // Minderheitenanteile (§ 307 HGB)
    if (report.balanceSheet.liabilities.equity.minorityInterests !== 0) {
      xml += `  <hgb-konzern:anteileAndererGesellschafter contextRef="CurrentPeriod" unitRef="EUR" decimals="2">${report.balanceSheet.liabilities.equity.minorityInterests.toFixed(2)}</hgb-konzern:anteileAndererGesellschafter>\n`;
    }

    // Rückstellungen
    const provisionsTotal = report.balanceSheet.liabilities.provisions.reduce(
      (sum, p) => sum + p.balance,
      0,
    );
    xml += `  <hgb-konzern:rueckstellungen contextRef="CurrentPeriod" unitRef="EUR" decimals="2">${provisionsTotal.toFixed(2)}</hgb-konzern:rueckstellungen>\n`;

    // Verbindlichkeiten
    const liabilitiesTotal = report.balanceSheet.liabilities.liabilities.reduce(
      (sum, l) => sum + l.balance,
      0,
    );
    xml += `  <hgb-konzern:verbindlichkeiten contextRef="CurrentPeriod" unitRef="EUR" decimals="2">${liabilitiesTotal.toFixed(2)}</hgb-konzern:verbindlichkeiten>\n\n`;

    // Konsolidierungsangaben
    xml += `  <!-- Konsolidierungsangaben (§§ 301-307 HGB) -->\n`;
    xml += `  <hgb-konzern:konsolidierung>\n`;

    // Kapitalkonsolidierung
    xml += `    <hgb-konzern:kapitalkonsolidierung>\n`;
    xml += `      <hgb-konzern:anzahlBuchungen>${report.overview.eliminations.capitalConsolidation.count}</hgb-konzern:anzahlBuchungen>\n`;
    xml += `      <hgb-konzern:betrag unitRef="EUR" decimals="2">${report.overview.eliminations.capitalConsolidation.totalAmount.toFixed(2)}</hgb-konzern:betrag>\n`;
    xml += `      <hgb-konzern:hgbParagraph>§ 301 HGB</hgb-konzern:hgbParagraph>\n`;
    xml += `    </hgb-konzern:kapitalkonsolidierung>\n`;

    // Schuldenkonsolidierung
    xml += `    <hgb-konzern:schuldenkonsolidierung>\n`;
    xml += `      <hgb-konzern:anzahlBuchungen>${report.overview.eliminations.debtConsolidation.count}</hgb-konzern:anzahlBuchungen>\n`;
    xml += `      <hgb-konzern:betrag unitRef="EUR" decimals="2">${report.overview.eliminations.debtConsolidation.totalAmount.toFixed(2)}</hgb-konzern:betrag>\n`;
    xml += `      <hgb-konzern:forderungenEliminiert unitRef="EUR" decimals="2">${report.overview.eliminations.debtConsolidation.receivablesEliminated.toFixed(2)}</hgb-konzern:forderungenEliminiert>\n`;
    xml += `      <hgb-konzern:verbindlichkeitenEliminiert unitRef="EUR" decimals="2">${report.overview.eliminations.debtConsolidation.payablesEliminated.toFixed(2)}</hgb-konzern:verbindlichkeitenEliminiert>\n`;
    xml += `      <hgb-konzern:hgbParagraph>§ 303 HGB</hgb-konzern:hgbParagraph>\n`;
    xml += `    </hgb-konzern:schuldenkonsolidierung>\n`;

    // Zwischenergebniseliminierung
    xml += `    <hgb-konzern:zwischenergebniseliminierung>\n`;
    xml += `      <hgb-konzern:anzahlBuchungen>${report.overview.eliminations.intercompanyProfits.count}</hgb-konzern:anzahlBuchungen>\n`;
    xml += `      <hgb-konzern:betrag unitRef="EUR" decimals="2">${report.overview.eliminations.intercompanyProfits.totalAmount.toFixed(2)}</hgb-konzern:betrag>\n`;
    xml += `      <hgb-konzern:hgbParagraph>§ 304 HGB</hgb-konzern:hgbParagraph>\n`;
    xml += `    </hgb-konzern:zwischenergebniseliminierung>\n`;

    xml += `  </hgb-konzern:konsolidierung>\n\n`;

    // Goodwill und Minderheiten
    xml += `  <!-- Geschäfts- oder Firmenwert (§ 309 HGB) -->\n`;
    xml += `  <hgb-konzern:goodwillGesamt contextRef="CurrentPeriod" unitRef="EUR" decimals="2">${report.overview.goodwill.total.toFixed(2)}</hgb-konzern:goodwillGesamt>\n\n`;

    xml += `  <!-- Minderheitenanteile (§ 307 HGB) -->\n`;
    xml += `  <hgb-konzern:minderheitenanteileGesamt contextRef="CurrentPeriod" unitRef="EUR" decimals="2">${report.overview.minorityInterests.total.toFixed(2)}</hgb-konzern:minderheitenanteileGesamt>\n`;

    // Prior year comparison if available
    if (report.comparison) {
      xml += `\n  <!-- Vorjahresvergleich -->\n`;
      for (const change of report.comparison.changes) {
        xml += `  <hgb-konzern:vorjahresvergleich position="${this.escapeXml(change.position)}">\n`;
        xml += `    <hgb-konzern:laufendesJahr unitRef="EUR" decimals="2">${change.currentYear.toFixed(2)}</hgb-konzern:laufendesJahr>\n`;
        xml += `    <hgb-konzern:vorjahr unitRef="EUR" decimals="2">${change.previousYear.toFixed(2)}</hgb-konzern:vorjahr>\n`;
        xml += `    <hgb-konzern:veraenderung unitRef="EUR" decimals="2">${change.change.toFixed(2)}</hgb-konzern:veraenderung>\n`;
        xml += `    <hgb-konzern:veraenderungProzent>${change.changePercent.toFixed(2)}</hgb-konzern:veraenderungProzent>\n`;
        xml += `  </hgb-konzern:vorjahresvergleich>\n`;
      }
    }

    xml += `\n</xbrli:xbrl>`;

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
  async exportFullConsolidationPackage(
    financialStatementId: string,
  ): Promise<Buffer> {
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
      const notes =
        await this.notesService.generateConsolidatedNotes(financialStatementId);
      const notesSheet = this.createNotesSheet(notes);
      XLSX.utils.book_append_sheet(workbook, notesSheet, 'Konzernanhang');
    } catch (error) {
      console.warn('Could not generate notes sheet:', error);
    }

    // Sheet 4: Latente Steuern
    try {
      const deferredTaxes =
        await this.deferredTaxService.getDeferredTaxes(financialStatementId);
      const summary =
        await this.deferredTaxService.getDeferredTaxSummary(
          financialStatementId,
        );
      const deferredTaxSheet = this.createDeferredTaxSheet(
        deferredTaxes,
        summary,
      );
      XLSX.utils.book_append_sheet(
        workbook,
        deferredTaxSheet,
        'Latente Steuern',
      );
    } catch (error) {
      console.warn('Could not generate deferred tax sheet:', error);
    }

    // Sheet 5: Compliance Checklist
    try {
      const compliance =
        await this.complianceService.getComplianceSummary(financialStatementId);
      const checklist =
        await this.complianceService.getChecklist(financialStatementId);
      const complianceSheet = this.createComplianceSheet(checklist, compliance);
      XLSX.utils.book_append_sheet(workbook, complianceSheet, 'Compliance');
    } catch (error) {
      console.warn('Could not generate compliance sheet:', error);
    }

    return Buffer.from(
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
    );
  }

  /**
   * Create balance sheet worksheet
   */
  private createBalanceSheetSheet(report: any): XLSX.WorkSheet {
    const data = [
      ['Konsolidierte Bilanz', '', '', ''],
      ['Geschäftsjahr:', report.fiscalYear, '', ''],
      [
        'Periode:',
        report.periodStart.toISOString().split('T')[0],
        'bis',
        report.periodEnd.toISOString().split('T')[0],
      ],
      ['', '', '', ''],
      ['AKTIVA', '', 'EUR', ''],
      ['', '', '', ''],
      ['Anlagevermögen', '', '', ''],
    ];

    for (const asset of report.balanceSheet.assets.fixedAssets) {
      data.push([
        `  ${asset.accountName}`,
        asset.accountNumber,
        asset.balance.toFixed(2),
        '',
      ]);
    }
    data.push([
      'Summe Anlagevermögen',
      '',
      report.balanceSheet.assets.fixedAssets
        .reduce((sum: number, a: any) => sum + a.balance, 0)
        .toFixed(2),
      '',
    ]);
    data.push(['', '', '', '']);

    data.push(['Umlaufvermögen', '', '', '']);
    for (const asset of report.balanceSheet.assets.currentAssets) {
      data.push([
        `  ${asset.accountName}`,
        asset.accountNumber,
        asset.balance.toFixed(2),
        '',
      ]);
    }
    data.push([
      'Summe Umlaufvermögen',
      '',
      report.balanceSheet.assets.currentAssets
        .reduce((sum: number, a: any) => sum + a.balance, 0)
        .toFixed(2),
      '',
    ]);
    data.push(['', '', '', '']);

    if (report.balanceSheet.assets.goodwill > 0) {
      data.push([
        'Geschäfts-/Firmenwert',
        '',
        report.balanceSheet.assets.goodwill.toFixed(2),
        '',
      ]);
    }
    data.push([
      'GESAMT AKTIVA',
      '',
      report.balanceSheet.assets.totalAssets.toFixed(2),
      '',
    ]);
    data.push(['', '', '', '']);
    data.push(['PASSIVA', '', 'EUR', '']);
    data.push(['', '', '', '']);

    data.push(['Eigenkapital', '', '', '']);
    for (const equity of report.balanceSheet.liabilities.equity.parentCompany) {
      data.push([
        `  ${equity.accountName}`,
        equity.accountNumber,
        equity.balance.toFixed(2),
        '',
      ]);
    }
    data.push([
      'Minderheitsanteile',
      '',
      report.balanceSheet.liabilities.equity.minorityInterests.toFixed(2),
      '',
    ]);
    data.push(['', '', '', '']);

    data.push(['Rückstellungen', '', '', '']);
    for (const provision of report.balanceSheet.liabilities.provisions) {
      data.push([
        `  ${provision.accountName}`,
        provision.accountNumber,
        provision.balance.toFixed(2),
        '',
      ]);
    }
    data.push(['', '', '', '']);

    data.push(['Verbindlichkeiten', '', '', '']);
    for (const liability of report.balanceSheet.liabilities.liabilities) {
      data.push([
        `  ${liability.accountName}`,
        liability.accountNumber,
        liability.balance.toFixed(2),
        '',
      ]);
    }
    data.push([
      'GESAMT PASSIVA',
      '',
      report.balanceSheet.liabilities.totalLiabilities.toFixed(2),
      '',
    ]);

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
      [
        'Zwischenergebniseliminierung',
        report.overview.eliminations.intercompanyProfits.count,
        report.overview.eliminations.intercompanyProfits.totalAmount.toFixed(2),
        '',
      ],
      [
        'Schuldenkonsolidierung',
        report.overview.eliminations.debtConsolidation.count,
        report.overview.eliminations.debtConsolidation.totalAmount.toFixed(2),
        '',
      ],
      [
        'Kapitalkonsolidierung',
        report.overview.eliminations.capitalConsolidation.count,
        report.overview.eliminations.capitalConsolidation.totalAmount.toFixed(
          2,
        ),
        '',
      ],
      ['', '', '', ''],
      ['Schuldenkonsolidierung Details', '', '', ''],
      [
        'Forderungen eliminiert',
        '',
        report.overview.eliminations.debtConsolidation.receivablesEliminated.toFixed(
          2,
        ),
        '',
      ],
      [
        'Verbindlichkeiten eliminiert',
        '',
        report.overview.eliminations.debtConsolidation.payablesEliminated.toFixed(
          2,
        ),
        '',
      ],
      ['', '', '', ''],
      ['Kapitalkonsolidierung Details', '', '', ''],
      [
        'Beteiligungen verarbeitet',
        '',
        report.overview.eliminations.capitalConsolidation
          .participationsProcessed,
        '',
      ],
      ['', '', '', ''],
      [
        'Minderheitsanteile',
        '',
        report.overview.minorityInterests.total.toFixed(2),
        '',
      ],
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
      [
        'Mutterunternehmen:',
        notes.consolidationScope.parentCompany.name,
        '',
        '',
      ],
      [
        'Anzahl Gesellschaften:',
        notes.consolidationScope.totalCompanies,
        '',
        '',
      ],
      [
        'Davon konsolidiert:',
        notes.consolidationScope.consolidatedCompanies,
        '',
        '',
      ],
      [
        'Davon ausgeschlossen:',
        notes.consolidationScope.excludedCompanies,
        '',
        '',
      ],
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
    data.push([
      'Gesamt:',
      notes.minorityInterestsBreakdown.total.toFixed(2),
      'EUR',
      '',
    ]);

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
  private createDeferredTaxSheet(
    deferredTaxes: any[],
    summary: any,
  ): XLSX.WorkSheet {
    const data = [
      ['Latente Steuern (§ 306 HGB)', '', '', '', ''],
      ['', '', '', '', ''],
      ['ZUSAMMENFASSUNG', '', '', '', ''],
      [
        'Aktive latente Steuern:',
        summary.totalDeferredTaxAssets?.toFixed(2) || '0.00',
        'EUR',
        '',
        '',
      ],
      [
        'Passive latente Steuern:',
        summary.totalDeferredTaxLiabilities?.toFixed(2) || '0.00',
        'EUR',
        '',
        '',
      ],
      [
        'Netto latente Steuern:',
        summary.netDeferredTax?.toFixed(2) || '0.00',
        'EUR',
        '',
        '',
      ],
      [
        'Veränderung zum Vorjahr:',
        summary.changeFromPriorYear?.toFixed(2) || '0.00',
        'EUR',
        '',
        '',
      ],
      ['', '', '', '', ''],
      ['DETAILAUFSTELLUNG', '', '', '', ''],
      [
        'Beschreibung',
        'Typ',
        'Temporäre Differenz',
        'Steuersatz',
        'Latente Steuer',
      ],
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
  private createComplianceSheet(
    checklist: any[],
    summary: any,
  ): XLSX.WorkSheet {
    const data = [
      ['HGB Compliance Checkliste', '', '', '', ''],
      ['', '', '', '', ''],
      ['ZUSAMMENFASSUNG', '', '', '', ''],
      ['Gesamt Prüfpunkte:', summary.totalItems, '', '', ''],
      [
        'Abgeschlossen:',
        summary.completed,
        `(${summary.percentComplete}%)`,
        '',
        '',
      ],
      ['In Bearbeitung:', summary.inProgress, '', '', ''],
      ['Offen:', summary.notStarted, '', '', ''],
      ['Überfällig:', summary.overdue, '', '', ''],
      [
        'Pflichtpunkte erfüllt:',
        summary.mandatoryComplete ? 'Ja' : 'Nein',
        '',
        '',
        '',
      ],
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
      not_started: 'Offen',
      in_progress: 'In Bearbeitung',
      completed: 'Abgeschlossen',
      not_applicable: 'N/A',
      requires_review: 'Prüfung erforderlich',
    };
    return translations[status] || status;
  }
}
