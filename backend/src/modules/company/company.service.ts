import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseErrorHandler } from '../../common/supabase-error.util';
import { SupabaseMapper } from '../../common/supabase-mapper.util';
import { Company } from '../../entities/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ParticipationService } from './participation.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(
    private supabaseService: SupabaseService,
    private participationService: ParticipationService,
  ) {}

  private get supabase() {
    try {
      return this.supabaseService.getClient();
    } catch (error: any) {
      this.logger.error(`Failed to get Supabase client: ${error.message}`);
      throw new Error('Database connection not available. Check Supabase configuration.');
    }
  }

  async create(createCompanyDto: CreateCompanyDto): Promise<Company> {
    this.logger.debug(`Creating company: ${createCompanyDto.name}`);
    
    try {
      // Timeout for Supabase request (30 seconds)
      const timeoutPromise = new Promise<{ data: null; error: any }>((resolve) => {
        setTimeout(() => {
          resolve({
            data: null,
            error: { message: 'Supabase request timeout after 30 seconds', code: 'TIMEOUT' },
          });
        }, 30000);
      });

      // Convert camelCase DTO to snake_case for Supabase
      const insertData: any = {
        name: createCompanyDto.name,
        tax_id: createCompanyDto.taxId,
        address: createCompanyDto.address,
        legal_form: createCompanyDto.legalForm,
        parent_company_id: createCompanyDto.parentCompanyId || null,
        is_consolidated: createCompanyDto.isConsolidated ?? true,
        created_at: SupabaseMapper.getCurrentTimestamp(),
        updated_at: SupabaseMapper.getCurrentTimestamp(),
      };

      const insertPromise = this.supabase
        .from('companies')
        .insert(insertData)
        .select()
        .single();

      const result = await Promise.race([insertPromise, timeoutPromise]);
      const { data, error } = result as any;

      if (error) {
        this.logger.error(`Supabase error (${error.code}): ${error.message}`);
        
        if (error.code === 'TIMEOUT') {
          throw new Error('Connection to Supabase timed out. Check your internet connection and Supabase configuration.');
        }
        
        SupabaseErrorHandler.handle(error, 'Company', 'create');
      }

      SupabaseErrorHandler.handleNotFound(data, 'Company');
      const company = SupabaseMapper.toCompany(data);
      this.logger.log(`Company created: ${company.id}`);
      
      // Automatically create participation if parent company is set
      if (createCompanyDto.parentCompanyId && company.id) {
        try {
          const participationPercentage = createCompanyDto.participationPercentage ?? 100;
          this.logger.debug(`Creating participation: ${createCompanyDto.parentCompanyId} -> ${company.id} (${participationPercentage}%)`);
          await this.participationService.createOrUpdate({
            parentCompanyId: createCompanyDto.parentCompanyId,
            subsidiaryCompanyId: company.id,
            participationPercentage: participationPercentage,
            acquisitionCost: null,
            acquisitionDate: null,
          });
          this.logger.debug('Participation created successfully');
        } catch (participationError: any) {
          // Log error but don't fail company creation
          this.logger.warn(`Failed to create participation (non-critical): ${participationError.message}`);
        }
      }
      
      return company;
    } catch (error: any) {
      this.logger.error(`Error creating company: ${error.message}`);
      if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
        throw new Error('Connection to Supabase timed out. Check your internet connection and Supabase configuration.');
      }
      throw error;
    }
  }

  async findAll(): Promise<Company[]> {
    const startTime = Date.now();
    try {
      this.logger.debug('findAll() - Starting database query');
      
      // Timeout for Supabase request (30 seconds)
      const timeoutPromise = new Promise<{ data: null; error: any }>((resolve) => {
        setTimeout(() => {
          resolve({
            data: null,
            error: { message: 'Supabase request timeout after 30 seconds', code: 'TIMEOUT' },
          });
        }, 30000);
      });

      const dbStartTime = Date.now();
      const selectPromise = this.supabase
        .from('companies')
        .select('*')
        .order('name', { ascending: true });

      const result = await Promise.race([selectPromise, timeoutPromise]);
      const { data, error } = result as any;
      const dbDuration = Date.now() - dbStartTime;

      this.logger.debug(`findAll() - Query completed in ${dbDuration}ms, found ${data?.length || 0} companies`);

      if (error) {
        this.logger.error(`findAll() - Supabase error (${error.code}): ${error.message}`);
        
        if (error.code === 'TIMEOUT') {
          throw new Error('Connection to Supabase timed out. Check your internet connection and Supabase configuration.');
        }
        
        SupabaseErrorHandler.handle(error, 'Companies', 'fetch');
      }

      // Map companies - handle potential mapping errors
      try {
        const companies = (data || []).map((item: any) => {
          try {
            return SupabaseMapper.toCompany(item);
          } catch (mapError: any) {
            this.logger.warn(`findAll() - Error mapping company ${item.id}: ${mapError.message}`);
            // Return a basic company object if mapping fails
            return {
              id: item.id,
              name: item.name || 'Unknown',
              taxId: item.tax_id || null,
              address: item.address || null,
              legalForm: item.legal_form || null,
              parentCompanyId: item.parent_company_id || null,
              parentCompany: null,
              children: [],
              isConsolidated: item.is_consolidated ?? true,
              financialStatements: [],
              createdAt: item.created_at ? new Date(item.created_at) : new Date(),
              updatedAt: item.updated_at ? new Date(item.updated_at) : new Date(),
            };
          }
        });
        return companies;
      } catch (mapError: any) {
        this.logger.error(`findAll() - Mapping error: ${mapError.message}`);
        throw new Error(`Error mapping company data: ${mapError.message}`);
      }
    } catch (error: any) {
      const totalDuration = Date.now() - startTime;
      this.logger.error(`findAll() - Error after ${totalDuration}ms: ${error.message}`);
      if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
        throw new Error('Connection to Supabase timed out. Check your internet connection and Supabase configuration.');
      }
      throw error;
    }
  }

  async findOne(id: string): Promise<Company> {
    const { data, error } = await this.supabase
      .from('companies')
      .select(`
        *,
        parent_company:companies!companies_parent_company_id_fkey(*),
        children:companies!companies_parent_company_id_fkey(*),
        financial_statements:financial_statements(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Company', 'fetch');
    }

    SupabaseErrorHandler.handleNotFound(data, 'Company');
    return SupabaseMapper.toCompany(data);
  }

  async findChildren(id: string): Promise<Company[]> {
    const { data, error } = await this.supabase
      .from('companies')
      .select(`
        *,
        children:companies!companies_parent_company_id_fkey(*)
      `)
      .eq('parent_company_id', id)
      .order('name', { ascending: true });

    if (error) {
      SupabaseErrorHandler.handle(error, 'Company children', 'fetch');
    }

    return (data || []).map((item) => SupabaseMapper.toCompany(item));
  }

  async update(id: string, updateCompanyDto: UpdateCompanyDto): Promise<Company> {
    // Convert camelCase DTO to snake_case for Supabase
    const updateData: any = {
      updated_at: SupabaseMapper.getCurrentTimestamp(),
    };

    if (updateCompanyDto.name !== undefined) updateData.name = updateCompanyDto.name;
    if (updateCompanyDto.taxId !== undefined) updateData.tax_id = updateCompanyDto.taxId;
    if (updateCompanyDto.address !== undefined) updateData.address = updateCompanyDto.address;
    if (updateCompanyDto.legalForm !== undefined) updateData.legal_form = updateCompanyDto.legalForm;
    if (updateCompanyDto.parentCompanyId !== undefined) updateData.parent_company_id = updateCompanyDto.parentCompanyId;
    if (updateCompanyDto.isConsolidated !== undefined) updateData.is_consolidated = updateCompanyDto.isConsolidated;

    // Get current company data to check old parent_company_id
    const { data: currentCompany } = await this.supabase
      .from('companies')
      .select('parent_company_id')
      .eq('id', id)
      .single();

    const { data, error } = await this.supabase
      .from('companies')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Company', 'update');
    }

    SupabaseErrorHandler.handleNotFound(data, 'Company');
    const company = SupabaseMapper.toCompany(data);
    
    // Update participation if parent company relationship changed
    if (updateCompanyDto.parentCompanyId !== undefined) {
      try {
        const newParentId = updateCompanyDto.parentCompanyId;
        
        // If parent was added or changed, create/update participation
        if (newParentId) {
          const participationPercentage = updateCompanyDto.participationPercentage ?? 100;
          this.logger.debug(`Updating participation: ${newParentId} -> ${company.id} (${participationPercentage}%)`);
          await this.participationService.createOrUpdate({
            parentCompanyId: newParentId,
            subsidiaryCompanyId: company.id,
            participationPercentage: participationPercentage,
            acquisitionCost: null,
            acquisitionDate: null,
          });
          this.logger.debug('Participation updated successfully');
        }
      } catch (participationError: any) {
        this.logger.warn(`Failed to update participation (non-critical): ${participationError.message}`);
      }
    }
    
    return company;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('companies')
      .delete()
      .eq('id', id);

    if (error) {
      SupabaseErrorHandler.handle(error, 'Company', 'delete');
    }
  }
}
