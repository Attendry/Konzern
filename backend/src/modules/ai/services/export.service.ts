import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { AuditLogEntry, OverrideRecord } from '../types/agent.types';
import { AuditStatistics } from './audit.service';

/**
 * Service for exporting audit data to Excel/CSV formats
 */
@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  /**
   * Generate Excel report for audit log
   */
  async generateAuditLogExcel(
    entries: AuditLogEntry[],
    statistics: AuditStatistics,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Konzern Konsolidierung';
    workbook.created = new Date();

    // Sheet 1: Overview
    this.addOverviewSheet(workbook, statistics);

    // Sheet 2: All Interactions
    this.addInteractionsSheet(workbook, entries);

    // Sheet 3: By User
    this.addByUserSheet(workbook, statistics);

    // Sheet 4: By Tool
    this.addByToolSheet(workbook, statistics);

    // Sheet 5: Low Confidence
    this.addLowConfidenceSheet(workbook, entries);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Generate Excel report for overrides
   */
  async generateOverrideLogExcel(
    overrides: OverrideRecord[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Konzern Konsolidierung';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Overrides');

    // Header styling
    sheet.columns = [
      { header: 'Datum', key: 'date', width: 20 },
      { header: 'Benutzer', key: 'user', width: 20 },
      { header: 'AI Empfehlung', key: 'recommendation', width: 40 },
      { header: 'AI Konfidenz', key: 'confidence', width: 15 },
      { header: 'WP Entscheidung', key: 'decision', width: 20 },
      { header: 'WP Alternative', key: 'alternative', width: 30 },
      { header: 'WP Begründung', key: 'reasoning', width: 50 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add data
    for (const override of overrides) {
      sheet.addRow({
        date: new Date(override.timestamp).toLocaleString('de-DE'),
        user: override.wpUserId,
        recommendation: override.originalRecommendation,
        confidence: `${Math.round(override.aiConfidence * 100)}%`,
        decision: this.getDecisionLabel(override.wpDecision),
        alternative: override.wpAlternative || '-',
        reasoning: override.wpReasoning,
      });
    }

    // Auto-filter
    sheet.autoFilter = {
      from: 'A1',
      to: 'G1',
    };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Generate CSV for audit log
   */
  async generateAuditLogCSV(entries: AuditLogEntry[]): Promise<string> {
    const headers = [
      'Datum',
      'Benutzer',
      'Anfrage',
      'Modus',
      'Tool',
      'AI Konfidenz',
      'Entscheidung',
      'Begründung',
      'Verarbeitungszeit (ms)',
    ];

    const rows = entries.map(e => [
      e.requestTimestamp.toISOString(),
      e.userId,
      `"${(e.requestText || '').replace(/"/g, '""')}"`,
      e.requestMode,
      e.toolName || '-',
      e.aiConfidence ? `${Math.round(e.aiConfidence * 100)}%` : '-',
      e.userDecision || '-',
      `"${(e.userReasoning || '').replace(/"/g, '""')}"`,
      e.processingTimeMs?.toString() || '-',
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Add overview sheet to workbook
   */
  private addOverviewSheet(
    workbook: ExcelJS.Workbook,
    statistics: AuditStatistics,
  ): void {
    const sheet = workbook.addWorksheet('Übersicht');

    // Title
    sheet.mergeCells('A1:D1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'AI-Nutzungsbericht';
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center' };

    // Period
    sheet.getCell('A3').value = 'Zeitraum:';
    sheet.getCell('B3').value = `${new Date(statistics.period.startDate).toLocaleDateString('de-DE')} - ${new Date(statistics.period.endDate).toLocaleDateString('de-DE')}`;
    sheet.getCell('A3').font = { bold: true };

    // Summary statistics
    const summaryData = [
      ['Gesamt-Interaktionen', statistics.totalInteractions],
      ['Akzeptiert', statistics.byDecision.accept],
      ['Abgelehnt', statistics.byDecision.reject],
      ['Modifiziert', statistics.byDecision.modify],
      ['Ignoriert', statistics.byDecision.ignore],
      ['Ø Konfidenz', `${Math.round(statistics.averageConfidence * 100)}%`],
      ['Override-Rate', `${Math.round(statistics.overrideRate * 100)}%`],
      ['Niedrige Konfidenz', statistics.lowConfidenceInteractions],
    ];

    let row = 5;
    for (const [label, value] of summaryData) {
      sheet.getCell(`A${row}`).value = label;
      sheet.getCell(`A${row}`).font = { bold: true };
      sheet.getCell(`B${row}`).value = value;
      row++;
    }

    // Styling
    sheet.getColumn('A').width = 25;
    sheet.getColumn('B').width = 20;
  }

  /**
   * Add interactions sheet to workbook
   */
  private addInteractionsSheet(
    workbook: ExcelJS.Workbook,
    entries: AuditLogEntry[],
  ): void {
    const sheet = workbook.addWorksheet('Interaktionen');

    sheet.columns = [
      { header: 'Datum', key: 'date', width: 20 },
      { header: 'Benutzer', key: 'user', width: 15 },
      { header: 'Anfrage', key: 'request', width: 50 },
      { header: 'Modus', key: 'mode', width: 12 },
      { header: 'Tool', key: 'tool', width: 25 },
      { header: 'Konfidenz', key: 'confidence', width: 12 },
      { header: 'Entscheidung', key: 'decision', width: 15 },
      { header: 'Begründung', key: 'reasoning', width: 40 },
      { header: 'Zeit (ms)', key: 'time', width: 12 },
    ];

    // Style header
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add data
    for (const entry of entries) {
      sheet.addRow({
        date: new Date(entry.requestTimestamp).toLocaleString('de-DE'),
        user: entry.userId?.substring(0, 8) || '-',
        request: entry.requestText?.substring(0, 100) || '-',
        mode: entry.requestMode === 'action' ? 'Aktion' : 'Erklär',
        tool: entry.toolName || '-',
        confidence: entry.aiConfidence ? `${Math.round(entry.aiConfidence * 100)}%` : '-',
        decision: this.getDecisionLabel(entry.userDecision || 'ignore'),
        reasoning: entry.userReasoning || '-',
        time: entry.processingTimeMs || '-',
      });
    }

    // Conditional formatting for confidence
    for (let i = 2; i <= entries.length + 1; i++) {
      const cell = sheet.getCell(`F${i}`);
      const confidence = entries[i - 2]?.aiConfidence || 0;
      if (confidence < 0.65) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFECACA' }, // Red
        };
      } else if (confidence < 0.85) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFEF3C7' }, // Yellow
        };
      } else {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD1FAE5' }, // Green
        };
      }
    }

    sheet.autoFilter = { from: 'A1', to: 'I1' };
  }

  /**
   * Add by-user sheet
   */
  private addByUserSheet(
    workbook: ExcelJS.Workbook,
    statistics: AuditStatistics,
  ): void {
    const sheet = workbook.addWorksheet('Nach Benutzer');

    sheet.columns = [
      { header: 'Benutzer', key: 'user', width: 30 },
      { header: 'Interaktionen', key: 'interactions', width: 15 },
      { header: 'Akzeptanzrate', key: 'acceptRate', width: 15 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    for (const user of statistics.byUser) {
      sheet.addRow({
        user: user.userName || user.userId,
        interactions: user.interactions,
        acceptRate: `${Math.round(user.acceptRate * 100)}%`,
      });
    }
  }

  /**
   * Add by-tool sheet
   */
  private addByToolSheet(
    workbook: ExcelJS.Workbook,
    statistics: AuditStatistics,
  ): void {
    const sheet = workbook.addWorksheet('Nach Tool');

    sheet.columns = [
      { header: 'Tool', key: 'tool', width: 35 },
      { header: 'Nutzungen', key: 'count', width: 15 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    for (const [tool, count] of Object.entries(statistics.byTool)) {
      sheet.addRow({
        tool: this.getToolLabel(tool),
        count,
      });
    }
  }

  /**
   * Add low-confidence sheet
   */
  private addLowConfidenceSheet(
    workbook: ExcelJS.Workbook,
    entries: AuditLogEntry[],
  ): void {
    const sheet = workbook.addWorksheet('Niedrige Konfidenz');

    const lowConfidence = entries.filter(
      e => e.aiConfidence && e.aiConfidence < 0.65
    );

    sheet.columns = [
      { header: 'Datum', key: 'date', width: 20 },
      { header: 'Tool', key: 'tool', width: 25 },
      { header: 'Konfidenz', key: 'confidence', width: 12 },
      { header: 'Anfrage', key: 'request', width: 50 },
      { header: 'Entscheidung', key: 'decision', width: 15 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFECACA' },
    };

    for (const entry of lowConfidence) {
      sheet.addRow({
        date: new Date(entry.requestTimestamp).toLocaleString('de-DE'),
        tool: entry.toolName || '-',
        confidence: `${Math.round((entry.aiConfidence || 0) * 100)}%`,
        request: entry.requestText?.substring(0, 80) || '-',
        decision: this.getDecisionLabel(entry.userDecision || 'ignore'),
      });
    }
  }

  /**
   * Get German label for decision
   */
  private getDecisionLabel(decision: string): string {
    const labels: Record<string, string> = {
      'accept': 'Akzeptiert',
      'reject': 'Abgelehnt',
      'modify': 'Modifiziert',
      'ignore': 'Ignoriert',
    };
    return labels[decision] || decision;
  }

  /**
   * Get German label for tool
   */
  private getToolLabel(tool: string): string {
    const labels: Record<string, string> = {
      'analyze_ic_difference': 'IC-Differenz-Analyse',
      'generate_audit_documentation': 'Prüfpfad-Dokumentation',
      'explain_plausibility_check': 'Plausibilitätsprüfung',
    };
    return labels[tool] || tool;
  }
}
