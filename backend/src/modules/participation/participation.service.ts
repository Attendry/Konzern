import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { 
  CreateParticipationDto, 
  UpdateParticipationDto, 
  RecordOwnershipChangeDto,
} from './dto/participation.dto';

@Injectable()
export class ParticipationService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  async findAll() {
    const { data, error } = await this.supabase
      .from('participations')
      .select(`
        *,
        parent_company:companies!participations_parent_company_id_fkey(id, name),
        subsidiary_company:companies!participations_subsidiary_company_id_fkey(id, name)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Error fetching participations: ${error.message}`);
    }

    return (data || []).map(this.mapParticipation);
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from('participations')
      .select(`
        *,
        parent_company:companies!participations_parent_company_id_fkey(*),
        subsidiary_company:companies!participations_subsidiary_company_id_fkey(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      throw new NotFoundException(`Participation not found: ${error.message}`);
    }

    return this.mapParticipation(data);
  }

  async findByParentCompany(parentCompanyId: string) {
    const { data, error } = await this.supabase
      .from('participations')
      .select(`
        *,
        subsidiary_company:companies!participations_subsidiary_company_id_fkey(id, name)
      `)
      .eq('parent_company_id', parentCompanyId)
      .eq('is_active', true)
      .order('participation_percentage', { ascending: false });

    if (error) {
      throw new BadRequestException(`Error fetching participations: ${error.message}`);
    }

    return (data || []).map(this.mapParticipation);
  }

  async findBySubsidiaryCompany(subsidiaryCompanyId: string) {
    const { data, error } = await this.supabase
      .from('participations')
      .select(`
        *,
        parent_company:companies!participations_parent_company_id_fkey(id, name)
      `)
      .eq('subsidiary_company_id', subsidiaryCompanyId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Error fetching participations: ${error.message}`);
    }

    return (data || []).map(this.mapParticipation);
  }

  async create(dto: CreateParticipationDto) {
    // Check if participation already exists
    const { data: existing } = await this.supabase
      .from('participations')
      .select('id')
      .eq('parent_company_id', dto.parentCompanyId)
      .eq('subsidiary_company_id', dto.subsidiaryCompanyId)
      .eq('is_active', true)
      .single();

    if (existing) {
      throw new BadRequestException('Active participation already exists for these companies');
    }

    const { data, error } = await this.supabase
      .from('participations')
      .insert({
        parent_company_id: dto.parentCompanyId,
        subsidiary_company_id: dto.subsidiaryCompanyId,
        participation_percentage: dto.participationPercentage,
        voting_rights_percentage: dto.votingRightsPercentage || dto.participationPercentage,
        acquisition_cost: dto.acquisitionCost,
        acquisition_date: dto.acquisitionDate,
        goodwill: dto.goodwill || 0,
        negative_goodwill: dto.negativeGoodwill || 0,
        hidden_reserves: dto.hiddenReserves || 0,
        hidden_liabilities: dto.hiddenLiabilities || 0,
        equity_at_acquisition: dto.equityAtAcquisition,
        is_direct: dto.isDirect !== false,
        through_company_id: dto.throughCompanyId,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Error creating participation: ${error.message}`);
    }

    return this.mapParticipation(data);
  }

  async update(id: string, dto: UpdateParticipationDto) {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (dto.participationPercentage !== undefined) updateData.participation_percentage = dto.participationPercentage;
    if (dto.votingRightsPercentage !== undefined) updateData.voting_rights_percentage = dto.votingRightsPercentage;
    if (dto.acquisitionCost !== undefined) updateData.acquisition_cost = dto.acquisitionCost;
    if (dto.goodwill !== undefined) updateData.goodwill = dto.goodwill;
    if (dto.negativeGoodwill !== undefined) updateData.negative_goodwill = dto.negativeGoodwill;
    if (dto.hiddenReserves !== undefined) updateData.hidden_reserves = dto.hiddenReserves;
    if (dto.hiddenLiabilities !== undefined) updateData.hidden_liabilities = dto.hiddenLiabilities;
    if (dto.equityAtAcquisition !== undefined) updateData.equity_at_acquisition = dto.equityAtAcquisition;
    if (dto.isActive !== undefined) updateData.is_active = dto.isActive;
    if (dto.disposalDate !== undefined) updateData.disposal_date = dto.disposalDate;
    if (dto.disposalProceeds !== undefined) updateData.disposal_proceeds = dto.disposalProceeds;

    const { data, error } = await this.supabase
      .from('participations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Error updating participation: ${error.message}`);
    }

    return this.mapParticipation(data);
  }

  async delete(id: string) {
    // Soft delete by setting is_active to false
    const { error } = await this.supabase
      .from('participations')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw new BadRequestException(`Error deleting participation: ${error.message}`);
    }

    return { success: true };
  }

  async getOwnershipHistory(participationId: string) {
    const { data, error } = await this.supabase
      .from('ownership_history')
      .select('*')
      .eq('participation_id', participationId)
      .order('effective_date', { ascending: false });

    if (error) {
      throw new BadRequestException(`Error fetching ownership history: ${error.message}`);
    }

    return (data || []).map(this.mapOwnershipHistory);
  }

  async recordOwnershipChange(participationId: string, dto: RecordOwnershipChangeDto) {
    const percentageChange = dto.percentageAfter - dto.percentageBefore;

    const { data, error } = await this.supabase
      .from('ownership_history')
      .insert({
        participation_id: participationId,
        change_type: dto.changeType,
        effective_date: dto.effectiveDate,
        percentage_before: dto.percentageBefore,
        percentage_after: dto.percentageAfter,
        percentage_change: percentageChange,
        transaction_amount: dto.transactionAmount,
        goodwill_change: dto.goodwillChange,
        description: dto.description,
        consolidation_entry_id: dto.consolidationEntryId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Error recording ownership change: ${error.message}`);
    }

    // Update participation with new percentage
    await this.update(participationId, {
      participationPercentage: dto.percentageAfter,
    });

    return this.mapOwnershipHistory(data);
  }

  private mapParticipation(data: any) {
    return {
      id: data.id,
      parentCompanyId: data.parent_company_id,
      parentCompany: data.parent_company,
      subsidiaryCompanyId: data.subsidiary_company_id,
      subsidiaryCompany: data.subsidiary_company,
      participationPercentage: parseFloat(data.participation_percentage) || 0,
      votingRightsPercentage: parseFloat(data.voting_rights_percentage) || 0,
      acquisitionCost: parseFloat(data.acquisition_cost) || 0,
      acquisitionDate: data.acquisition_date,
      goodwill: parseFloat(data.goodwill) || 0,
      negativeGoodwill: parseFloat(data.negative_goodwill) || 0,
      hiddenReserves: parseFloat(data.hidden_reserves) || 0,
      hiddenLiabilities: parseFloat(data.hidden_liabilities) || 0,
      equityAtAcquisition: parseFloat(data.equity_at_acquisition) || 0,
      isDirect: data.is_direct,
      throughCompanyId: data.through_company_id,
      throughCompany: data.through_company,
      isActive: data.is_active,
      disposalDate: data.disposal_date,
      disposalProceeds: parseFloat(data.disposal_proceeds) || 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  private mapOwnershipHistory(data: any) {
    return {
      id: data.id,
      participationId: data.participation_id,
      changeType: data.change_type,
      effectiveDate: data.effective_date,
      percentageBefore: parseFloat(data.percentage_before) || 0,
      percentageAfter: parseFloat(data.percentage_after) || 0,
      percentageChange: parseFloat(data.percentage_change) || 0,
      transactionAmount: parseFloat(data.transaction_amount) || 0,
      goodwillChange: parseFloat(data.goodwill_change) || 0,
      description: data.description,
      consolidationEntryId: data.consolidation_entry_id,
      createdAt: data.created_at,
    };
  }
}
