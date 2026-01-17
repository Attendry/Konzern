import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type ReportStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'published'
  | 'archived';

export interface ReportSection {
  title: string;
  content: string;
  order: number;
  generatedContent?: string;
  lastUpdatedAt?: string;
  lastUpdatedBy?: string;
}

export interface ManagementReport {
  id: string;
  financialStatementId: string;
  reportTitle: string;
  fiscalYear: number;
  reportDate: Date;
  status: ReportStatus;
  sections: Record<string, ReportSection>;
  keyFigures: Record<string, any>;
  generatedContent: Record<string, any>;
  hgbReference: string;
  createdByUserId?: string;
  approvedByUserId?: string;
  approvedAt?: Date;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReportDto {
  financialStatementId: string;
  reportTitle?: string;
  fiscalYear: number;
  createdByUserId?: string;
}

export interface UpdateSectionDto {
  sectionKey: string;
  content: string;
  updatedByUserId?: string;
}

@Injectable()
export class ManagementReportService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Create a new management report
   */
  async create(dto: CreateReportDto): Promise<ManagementReport> {
    // Check if report already exists for this financial statement
    const { data: existing } = await this.supabase
      .from('management_reports')
      .select('id')
      .eq('financial_statement_id', dto.financialStatementId)
      .single();

    if (existing) {
      throw new BadRequestException(
        'Konzernlagebericht für diesen Jahresabschluss existiert bereits',
      );
    }

    const { data, error } = await this.supabase
      .from('management_reports')
      .insert({
        financial_statement_id: dto.financialStatementId,
        report_title: dto.reportTitle || 'Konzernlagebericht',
        fiscal_year: dto.fiscalYear,
        created_by_user_id: dto.createdByUserId,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        `Konzernlagebericht konnte nicht erstellt werden: ${error.message}`,
      );
    }

    // Generate initial key figures
    await this.generateKeyFigures(data.id, dto.financialStatementId);

    return this.getById(data.id);
  }

  /**
   * Get report by ID
   */
  async getById(id: string): Promise<ManagementReport> {
    const { data, error } = await this.supabase
      .from('management_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException(
        `Konzernlagebericht mit ID ${id} nicht gefunden`,
      );
    }

    return this.mapToReport(data);
  }

  /**
   * Get report by financial statement
   */
  async getByFinancialStatement(
    financialStatementId: string,
  ): Promise<ManagementReport | null> {
    const { data, error } = await this.supabase
      .from('management_reports')
      .select('*')
      .eq('financial_statement_id', financialStatementId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToReport(data);
  }

  /**
   * Get all reports
   */
  async getAll(): Promise<ManagementReport[]> {
    const { data, error } = await this.supabase
      .from('management_reports')
      .select('*')
      .order('fiscal_year', { ascending: false });

    if (error) {
      throw new BadRequestException(
        `Fehler beim Laden der Konzernlageberichte: ${error.message}`,
      );
    }

    return (data || []).map(this.mapToReport);
  }

  /**
   * Update a section
   */
  async updateSection(
    reportId: string,
    dto: UpdateSectionDto,
  ): Promise<ManagementReport> {
    const report = await this.getById(reportId);

    if (report.status === 'published') {
      throw new BadRequestException(
        'Veröffentlichte Berichte können nicht bearbeitet werden',
      );
    }

    const sections = { ...report.sections };
    if (sections[dto.sectionKey]) {
      sections[dto.sectionKey] = {
        ...sections[dto.sectionKey],
        content: dto.content,
        lastUpdatedAt: new Date().toISOString(),
        lastUpdatedBy: dto.updatedByUserId,
      };
    }

    const { data, error } = await this.supabase
      .from('management_reports')
      .update({
        sections,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        `Abschnitt konnte nicht aktualisiert werden: ${error.message}`,
      );
    }

    return this.mapToReport(data);
  }

  /**
   * Generate key figures from financial data
   */
  async generateKeyFigures(
    reportId: string,
    financialStatementId: string,
  ): Promise<Record<string, any>> {
    // Get financial data
    const { data: balances } = await this.supabase
      .from('account_balances')
      .select('*, accounts(*)')
      .eq('financial_statement_id', financialStatementId);

    // Get consolidation entries
    const { data: entries } = await this.supabase
      .from('consolidation_entries')
      .select('*')
      .eq('financial_statement_id', financialStatementId);

    // Calculate key figures
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const balance of balances || []) {
      const amount = parseFloat(balance.balance || '0');
      const account = balance.accounts;

      switch (account?.account_type) {
        case 'asset':
          totalAssets += amount;
          break;
        case 'liability':
          totalLiabilities += amount;
          break;
        case 'equity':
          totalEquity += amount;
          break;
        case 'revenue':
          totalRevenue += amount;
          break;
        case 'expense':
          totalExpenses += amount;
          break;
      }
    }

    // Calculate ratios
    const netIncome = totalRevenue - totalExpenses;
    const equityRatio = totalAssets > 0 ? (totalEquity / totalAssets) * 100 : 0;
    const profitMargin =
      totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;
    const returnOnEquity =
      totalEquity > 0 ? (netIncome / totalEquity) * 100 : 0;

    // Consolidation summary
    const consolidationEntriesCount = entries?.length || 0;
    const totalConsolidationAdjustments = (entries || []).reduce(
      (sum, e) => sum + Math.abs(parseFloat(e.amount || '0')),
      0,
    );

    const keyFigures = {
      balanceSheet: {
        totalAssets,
        totalLiabilities,
        totalEquity,
        bilanzsumme: totalAssets,
      },
      incomeStatement: {
        totalRevenue,
        totalExpenses,
        netIncome,
        operatingResult: netIncome, // Simplified
      },
      ratios: {
        equityRatio: Math.round(equityRatio * 100) / 100,
        profitMargin: Math.round(profitMargin * 100) / 100,
        returnOnEquity: Math.round(returnOnEquity * 100) / 100,
      },
      consolidation: {
        entriesCount: consolidationEntriesCount,
        totalAdjustments: totalConsolidationAdjustments,
      },
      calculatedAt: new Date().toISOString(),
    };

    // Update report with key figures
    await this.supabase
      .from('management_reports')
      .update({
        key_figures: keyFigures,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId);

    return keyFigures;
  }

  /**
   * Generate content suggestions for sections
   */
  async generateContentSuggestions(
    reportId: string,
  ): Promise<Record<string, string>> {
    const report = await this.getById(reportId);
    const keyFigures = report.keyFigures;

    const suggestions: Record<string, string> = {};

    // Business overview suggestion
    suggestions.business_overview = `Im Geschäftsjahr ${report.fiscalYear} erzielte der Konzern einen Umsatz von ${this.formatCurrency(keyFigures.incomeStatement?.totalRevenue || 0)}. Die Bilanzsumme beträgt zum Stichtag ${this.formatCurrency(keyFigures.balanceSheet?.totalAssets || 0)}.`;

    // Financial performance suggestion
    const netIncome = keyFigures.incomeStatement?.netIncome || 0;
    const incomeText =
      netIncome >= 0 ? 'einen Jahresüberschuss' : 'einen Jahresfehlbetrag';
    suggestions.financial_performance = `Der Konzern erwirtschaftete ${incomeText} von ${this.formatCurrency(Math.abs(netIncome))}. Die Umsatzrendite beträgt ${keyFigures.ratios?.profitMargin || 0}%.`;

    // Financial position suggestion
    suggestions.financial_position = `Die Eigenkapitalquote des Konzerns beträgt ${keyFigures.ratios?.equityRatio || 0}%. Das Eigenkapital beläuft sich auf ${this.formatCurrency(keyFigures.balanceSheet?.totalEquity || 0)}.`;

    // Liquidity suggestion
    suggestions.liquidity = `Die Finanzlage des Konzerns ist stabil. Wesentliche Veränderungen in der Liquidität sind im Geschäftsjahr nicht eingetreten.`;

    // Risk report suggestion
    suggestions.risk_report = `Der Konzern ist verschiedenen Risiken ausgesetzt, die kontinuierlich überwacht werden. Das Risikomanagementsystem identifiziert, bewertet und steuert wesentliche Risiken.`;

    // Forecast suggestion
    suggestions.forecast = `Für das kommende Geschäftsjahr erwartet der Vorstand eine stabile Geschäftsentwicklung.`;

    // Update report with generated content
    await this.supabase
      .from('management_reports')
      .update({
        generated_content: suggestions,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId);

    return suggestions;
  }

  /**
   * Submit for review
   */
  async submitForReview(reportId: string): Promise<ManagementReport> {
    const report = await this.getById(reportId);

    if (report.status !== 'draft') {
      throw new BadRequestException(
        'Nur Entwürfe können zur Prüfung eingereicht werden',
      );
    }

    return this.updateStatus(reportId, 'in_review');
  }

  /**
   * Approve report
   */
  async approve(
    reportId: string,
    approvedByUserId: string,
  ): Promise<ManagementReport> {
    const report = await this.getById(reportId);

    if (report.status !== 'in_review') {
      throw new BadRequestException(
        'Nur Berichte in Prüfung können freigegeben werden',
      );
    }

    const { data, error } = await this.supabase
      .from('management_reports')
      .update({
        status: 'approved',
        approved_by_user_id: approvedByUserId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        `Bericht konnte nicht freigegeben werden: ${error.message}`,
      );
    }

    return this.mapToReport(data);
  }

  /**
   * Publish report
   */
  async publish(reportId: string): Promise<ManagementReport> {
    const report = await this.getById(reportId);

    if (report.status !== 'approved') {
      throw new BadRequestException(
        'Nur freigegebene Berichte können veröffentlicht werden',
      );
    }

    const { data, error } = await this.supabase
      .from('management_reports')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        `Bericht konnte nicht veröffentlicht werden: ${error.message}`,
      );
    }

    return this.mapToReport(data);
  }

  /**
   * Get report versions
   */
  async getVersions(reportId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('management_report_versions')
      .select('*')
      .eq('report_id', reportId)
      .order('version_number', { ascending: false });

    if (error) {
      throw new BadRequestException(
        `Fehler beim Laden der Versionen: ${error.message}`,
      );
    }

    return data || [];
  }

  /**
   * Export report as structured data
   */
  async exportReport(reportId: string): Promise<any> {
    const report = await this.getById(reportId);

    // Sort sections by order
    const sortedSections = Object.entries(report.sections)
      .map(([key, section]) => ({ key, ...section }))
      .sort((a, b) => a.order - b.order);

    return {
      title: report.reportTitle,
      fiscalYear: report.fiscalYear,
      reportDate: report.reportDate,
      status: report.status,
      sections: sortedSections,
      keyFigures: report.keyFigures,
      hgbReference: report.hgbReference,
      exportedAt: new Date().toISOString(),
    };
  }

  // ==================== HELPERS ====================

  private async updateStatus(
    reportId: string,
    status: ReportStatus,
  ): Promise<ManagementReport> {
    const { data, error } = await this.supabase
      .from('management_reports')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        `Status konnte nicht aktualisiert werden: ${error.message}`,
      );
    }

    return this.mapToReport(data);
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }

  private mapToReport(data: any): ManagementReport {
    return {
      id: data.id,
      financialStatementId: data.financial_statement_id,
      reportTitle: data.report_title,
      fiscalYear: data.fiscal_year,
      reportDate: new Date(data.report_date),
      status: data.status,
      sections: data.sections || {},
      keyFigures: data.key_figures || {},
      generatedContent: data.generated_content || {},
      hgbReference: data.hgb_reference || '§ 315 HGB',
      createdByUserId: data.created_by_user_id,
      approvedByUserId: data.approved_by_user_id,
      approvedAt: data.approved_at ? new Date(data.approved_at) : undefined,
      publishedAt: data.published_at ? new Date(data.published_at) : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}
