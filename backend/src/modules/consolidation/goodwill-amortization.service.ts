import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseMapper } from '../../common/supabase-mapper.util';
import { AdjustmentType } from '../../entities/consolidation-entry.entity';

export type AmortizationMethod = 'linear' | 'declining' | 'custom';

export interface GoodwillSchedule {
  id: string;
  subsidiaryCompanyId: string;
  subsidiaryCompanyName?: string;
  parentCompanyId: string;
  parentCompanyName?: string;
  participationId?: string;
  initialGoodwill: number;
  acquisitionDate?: Date;
  usefulLifeYears: number;
  amortizationMethod: AmortizationMethod;
  accumulatedAmortization: number;
  remainingGoodwill: number;
  annualAmortization: number;
  impairmentAmount: number;
  impairmentDate?: Date;
  impairmentReason?: string;
  hgbReference: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AmortizationEntry {
  id: string;
  scheduleId: string;
  financialStatementId?: string;
  fiscalYear: number;
  periodStart: Date;
  periodEnd: Date;
  openingBalance: number;
  amortizationAmount: number;
  impairmentAmount: number;
  closingBalance: number;
  consolidationEntryId?: string;
  isBooked: boolean;
  bookedAt?: Date;
  bookedByUserId?: string;
  createdAt: Date;
}

export interface CreateScheduleDto {
  subsidiaryCompanyId: string;
  parentCompanyId: string;
  participationId?: string;
  initialGoodwill: number;
  acquisitionDate?: string;
  usefulLifeYears?: number;
  amortizationMethod?: AmortizationMethod;
  notes?: string;
}

export interface CreateAmortizationDto {
  scheduleId: string;
  financialStatementId?: string;
  fiscalYear: number;
  periodStart: string;
  periodEnd: string;
}

@Injectable()
export class GoodwillAmortizationService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  // ==================== SCHEDULES ====================

  /**
   * Create a new goodwill amortization schedule
   */
  async createSchedule(dto: CreateScheduleDto): Promise<GoodwillSchedule> {
    const usefulLife = dto.usefulLifeYears || 10; // HGB default: 10 years max
    const annualAmortization = dto.initialGoodwill / usefulLife;

    const { data, error } = await this.supabase
      .from('goodwill_amortization_schedules')
      .insert({
        subsidiary_company_id: dto.subsidiaryCompanyId,
        parent_company_id: dto.parentCompanyId,
        participation_id: dto.participationId,
        initial_goodwill: dto.initialGoodwill,
        acquisition_date: dto.acquisitionDate,
        useful_life_years: usefulLife,
        amortization_method: dto.amortizationMethod || 'linear',
        accumulated_amortization: 0,
        remaining_goodwill: dto.initialGoodwill,
        annual_amortization: annualAmortization,
        notes: dto.notes,
      })
      .select(`
        *,
        subsidiary_company:companies!goodwill_amortization_schedules_subsidiary_company_id_fkey(name),
        parent_company:companies!goodwill_amortization_schedules_parent_company_id_fkey(name)
      `)
      .single();

    if (error) {
      throw new BadRequestException(`Abschreibungsplan konnte nicht erstellt werden: ${error.message}`);
    }

    return this.mapToSchedule(data);
  }

  /**
   * Get all schedules for a parent company
   */
  async getSchedulesByParent(parentCompanyId: string): Promise<GoodwillSchedule[]> {
    const { data, error } = await this.supabase
      .from('goodwill_amortization_schedules')
      .select(`
        *,
        subsidiary_company:companies!goodwill_amortization_schedules_subsidiary_company_id_fkey(name),
        parent_company:companies!goodwill_amortization_schedules_parent_company_id_fkey(name)
      `)
      .eq('parent_company_id', parentCompanyId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Fehler beim Laden der Abschreibungspläne: ${error.message}`);
    }

    return (data || []).map(this.mapToSchedule);
  }

  /**
   * Get schedule by ID
   */
  async getScheduleById(id: string): Promise<GoodwillSchedule> {
    const { data, error } = await this.supabase
      .from('goodwill_amortization_schedules')
      .select(`
        *,
        subsidiary_company:companies!goodwill_amortization_schedules_subsidiary_company_id_fkey(name),
        parent_company:companies!goodwill_amortization_schedules_parent_company_id_fkey(name)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Abschreibungsplan mit ID ${id} nicht gefunden`);
    }

    return this.mapToSchedule(data);
  }

  /**
   * Update schedule
   */
  async updateSchedule(id: string, updates: Partial<CreateScheduleDto>): Promise<GoodwillSchedule> {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.usefulLifeYears !== undefined) updateData.useful_life_years = updates.usefulLifeYears;
    if (updates.amortizationMethod !== undefined) updateData.amortization_method = updates.amortizationMethod;
    if (updates.notes !== undefined) updateData.notes = updates.notes;

    const { data, error } = await this.supabase
      .from('goodwill_amortization_schedules')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        subsidiary_company:companies!goodwill_amortization_schedules_subsidiary_company_id_fkey(name),
        parent_company:companies!goodwill_amortization_schedules_parent_company_id_fkey(name)
      `)
      .single();

    if (error) {
      throw new BadRequestException(`Abschreibungsplan konnte nicht aktualisiert werden: ${error.message}`);
    }

    return this.mapToSchedule(data);
  }

  /**
   * Record impairment
   */
  async recordImpairment(
    scheduleId: string,
    impairmentAmount: number,
    reason: string,
    impairmentDate?: string,
  ): Promise<GoodwillSchedule> {
    const schedule = await this.getScheduleById(scheduleId);

    const newImpairment = schedule.impairmentAmount + impairmentAmount;
    const newRemaining = schedule.initialGoodwill - schedule.accumulatedAmortization - newImpairment;

    const { data, error } = await this.supabase
      .from('goodwill_amortization_schedules')
      .update({
        impairment_amount: newImpairment,
        impairment_date: impairmentDate || new Date().toISOString().split('T')[0],
        impairment_reason: reason,
        remaining_goodwill: newRemaining,
        updated_at: new Date().toISOString(),
      })
      .eq('id', scheduleId)
      .select(`
        *,
        subsidiary_company:companies!goodwill_amortization_schedules_subsidiary_company_id_fkey(name),
        parent_company:companies!goodwill_amortization_schedules_parent_company_id_fkey(name)
      `)
      .single();

    if (error) {
      throw new BadRequestException(`Wertminderung konnte nicht erfasst werden: ${error.message}`);
    }

    return this.mapToSchedule(data);
  }

  // ==================== ENTRIES ====================

  /**
   * Create amortization entry for a fiscal year
   */
  async createAmortizationEntry(dto: CreateAmortizationDto): Promise<AmortizationEntry> {
    const schedule = await this.getScheduleById(dto.scheduleId);

    // Check if entry for this year already exists
    const { data: existing } = await this.supabase
      .from('goodwill_amortization_entries')
      .select('id')
      .eq('schedule_id', dto.scheduleId)
      .eq('fiscal_year', dto.fiscalYear)
      .single();

    if (existing) {
      throw new BadRequestException(`Abschreibung für Geschäftsjahr ${dto.fiscalYear} existiert bereits`);
    }

    // Get last entry to determine opening balance
    const { data: lastEntry } = await this.supabase
      .from('goodwill_amortization_entries')
      .select('closing_balance')
      .eq('schedule_id', dto.scheduleId)
      .order('fiscal_year', { ascending: false })
      .limit(1)
      .single();

    const openingBalance = lastEntry?.closing_balance || schedule.initialGoodwill;
    const amortizationAmount = schedule.annualAmortization;
    const closingBalance = Math.max(0, openingBalance - amortizationAmount);

    const { data, error } = await this.supabase
      .from('goodwill_amortization_entries')
      .insert({
        schedule_id: dto.scheduleId,
        financial_statement_id: dto.financialStatementId,
        fiscal_year: dto.fiscalYear,
        period_start: dto.periodStart,
        period_end: dto.periodEnd,
        opening_balance: openingBalance,
        amortization_amount: amortizationAmount,
        impairment_amount: 0,
        closing_balance: closingBalance,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Abschreibungsbuchung konnte nicht erstellt werden: ${error.message}`);
    }

    // Update schedule accumulated amortization
    await this.supabase
      .from('goodwill_amortization_schedules')
      .update({
        accumulated_amortization: schedule.accumulatedAmortization + amortizationAmount,
        remaining_goodwill: closingBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dto.scheduleId);

    return this.mapToEntry(data);
  }

  /**
   * Get all entries for a schedule
   */
  async getEntriesBySchedule(scheduleId: string): Promise<AmortizationEntry[]> {
    const { data, error } = await this.supabase
      .from('goodwill_amortization_entries')
      .select('*')
      .eq('schedule_id', scheduleId)
      .order('fiscal_year', { ascending: true });

    if (error) {
      throw new BadRequestException(`Fehler beim Laden der Abschreibungsbuchungen: ${error.message}`);
    }

    return (data || []).map(this.mapToEntry);
  }

  /**
   * Book amortization to consolidation entries
   */
  async bookAmortization(
    entryId: string,
    financialStatementId: string,
    userId?: string,
  ): Promise<{ entry: AmortizationEntry; consolidationEntryId: string }> {
    const { data: entry, error: fetchError } = await this.supabase
      .from('goodwill_amortization_entries')
      .select('*, goodwill_amortization_schedules(*)')
      .eq('id', entryId)
      .single();

    if (fetchError || !entry) {
      throw new NotFoundException(`Abschreibungsbuchung mit ID ${entryId} nicht gefunden`);
    }

    if (entry.is_booked) {
      throw new BadRequestException('Abschreibung wurde bereits gebucht');
    }

    // Create consolidation entry
    const { data: consolidationEntry, error: consError } = await this.supabase
      .from('consolidation_entries')
      .insert({
        financial_statement_id: financialStatementId,
        adjustment_type: AdjustmentType.CAPITAL_CONSOLIDATION,
        amount: -entry.amortization_amount,
        description: `Goodwill-Abschreibung für ${entry.goodwill_amortization_schedules?.subsidiary_company_id} - Geschäftsjahr ${entry.fiscal_year}`,
        source: 'automatic',
        status: 'approved',
        created_at: SupabaseMapper.getCurrentTimestamp(),
        updated_at: SupabaseMapper.getCurrentTimestamp(),
      })
      .select()
      .single();

    if (consError) {
      throw new BadRequestException(`Konsolidierungsbuchung konnte nicht erstellt werden: ${consError.message}`);
    }

    // Update entry as booked
    const { data: updatedEntry, error: updateError } = await this.supabase
      .from('goodwill_amortization_entries')
      .update({
        is_booked: true,
        booked_at: new Date().toISOString(),
        booked_by_user_id: userId,
        consolidation_entry_id: consolidationEntry.id,
        financial_statement_id: financialStatementId,
      })
      .eq('id', entryId)
      .select()
      .single();

    if (updateError) {
      throw new BadRequestException(`Buchung konnte nicht aktualisiert werden: ${updateError.message}`);
    }

    return {
      entry: this.mapToEntry(updatedEntry),
      consolidationEntryId: consolidationEntry.id,
    };
  }

  /**
   * Calculate amortization projection
   */
  async calculateProjection(scheduleId: string, years: number = 10): Promise<any[]> {
    const schedule = await this.getScheduleById(scheduleId);
    const projection: any[] = [];

    let remainingGoodwill = schedule.remainingGoodwill;
    const annualAmortization = schedule.annualAmortization;

    for (let year = 1; year <= years && remainingGoodwill > 0; year++) {
      const amortization = Math.min(annualAmortization, remainingGoodwill);
      remainingGoodwill = Math.max(0, remainingGoodwill - amortization);

      projection.push({
        year,
        openingBalance: remainingGoodwill + amortization,
        amortization,
        closingBalance: remainingGoodwill,
      });
    }

    return projection;
  }

  /**
   * Get summary of all goodwill for a parent company
   */
  async getGoodwillSummary(parentCompanyId: string): Promise<{
    totalInitialGoodwill: number;
    totalAccumulatedAmortization: number;
    totalImpairment: number;
    totalRemainingGoodwill: number;
    scheduleCount: number;
    schedules: GoodwillSchedule[];
  }> {
    const schedules = await this.getSchedulesByParent(parentCompanyId);

    const summary = {
      totalInitialGoodwill: 0,
      totalAccumulatedAmortization: 0,
      totalImpairment: 0,
      totalRemainingGoodwill: 0,
      scheduleCount: schedules.length,
      schedules,
    };

    for (const schedule of schedules) {
      summary.totalInitialGoodwill += schedule.initialGoodwill;
      summary.totalAccumulatedAmortization += schedule.accumulatedAmortization;
      summary.totalImpairment += schedule.impairmentAmount;
      summary.totalRemainingGoodwill += schedule.remainingGoodwill;
    }

    return summary;
  }

  // ==================== HELPERS ====================

  private mapToSchedule(data: any): GoodwillSchedule {
    return {
      id: data.id,
      subsidiaryCompanyId: data.subsidiary_company_id,
      subsidiaryCompanyName: data.subsidiary_company?.name,
      parentCompanyId: data.parent_company_id,
      parentCompanyName: data.parent_company?.name,
      participationId: data.participation_id,
      initialGoodwill: parseFloat(data.initial_goodwill),
      acquisitionDate: data.acquisition_date ? new Date(data.acquisition_date) : undefined,
      usefulLifeYears: data.useful_life_years,
      amortizationMethod: data.amortization_method,
      accumulatedAmortization: parseFloat(data.accumulated_amortization || '0'),
      remainingGoodwill: parseFloat(data.remaining_goodwill || '0'),
      annualAmortization: parseFloat(data.annual_amortization || '0'),
      impairmentAmount: parseFloat(data.impairment_amount || '0'),
      impairmentDate: data.impairment_date ? new Date(data.impairment_date) : undefined,
      impairmentReason: data.impairment_reason,
      hgbReference: data.hgb_reference || '§ 309 HGB',
      notes: data.notes,
      isActive: data.is_active,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  private mapToEntry(data: any): AmortizationEntry {
    return {
      id: data.id,
      scheduleId: data.schedule_id,
      financialStatementId: data.financial_statement_id,
      fiscalYear: data.fiscal_year,
      periodStart: new Date(data.period_start),
      periodEnd: new Date(data.period_end),
      openingBalance: parseFloat(data.opening_balance),
      amortizationAmount: parseFloat(data.amortization_amount),
      impairmentAmount: parseFloat(data.impairment_amount || '0'),
      closingBalance: parseFloat(data.closing_balance),
      consolidationEntryId: data.consolidation_entry_id,
      isBooked: data.is_booked,
      bookedAt: data.booked_at ? new Date(data.booked_at) : undefined,
      bookedByUserId: data.booked_by_user_id,
      createdAt: new Date(data.created_at),
    };
  }
}
