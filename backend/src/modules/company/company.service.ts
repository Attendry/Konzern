import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseErrorHandler } from '../../common/supabase-error.util';
import { SupabaseMapper } from '../../common/supabase-mapper.util';
import { Company } from '../../entities/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ParticipationService } from './participation.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompanyService {
  constructor(
    private supabaseService: SupabaseService,
    private participationService: ParticipationService,
  ) {}

  private get supabase() {
    try {
      return this.supabaseService.getClient();
    } catch (error: any) {
      console.error('❌ Fehler beim Abrufen des Supabase Clients:', error.message);
      throw new Error('Datenbank-Verbindung nicht verfügbar. Bitte prüfen Sie die Supabase-Konfiguration.');
    }
  }

  async create(createCompanyDto: CreateCompanyDto): Promise<Company> {
    console.log('CompanyService.create called with:', createCompanyDto);
    
    try {
      // Timeout für Supabase-Request (30 Sekunden)
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

      console.log('Supabase insert result - data:', data ? 'OK' : 'null', 'error:', error ? error.message : 'none');

      if (error) {
        console.error('Supabase error:', error);
        console.error('Error code:', error.code);
        console.error('Error details:', JSON.stringify(error, null, 2));
        
        if (error.code === 'TIMEOUT') {
          throw new Error('Verbindung zu Supabase hat zu lange gedauert. Bitte prüfen Sie Ihre Internetverbindung und Supabase-Konfiguration.');
        }
        
        SupabaseErrorHandler.handle(error, 'Company', 'create');
      }

      SupabaseErrorHandler.handleNotFound(data, 'Company');
      const company = SupabaseMapper.toCompany(data);
      console.log('Company created successfully:', company.id);
      
      // Automatically create participation if parent company is set
      if (createCompanyDto.parentCompanyId && company.id) {
        try {
          const participationPercentage = createCompanyDto.participationPercentage ?? 100; // Default: 100% if not specified
          console.log(`[CompanyService] Creating participation: ${createCompanyDto.parentCompanyId} -> ${company.id} (${participationPercentage}%)`);
          await this.participationService.createOrUpdate({
            parentCompanyId: createCompanyDto.parentCompanyId,
            subsidiaryCompanyId: company.id,
            participationPercentage: participationPercentage,
            acquisitionCost: null,
            acquisitionDate: null,
          });
          console.log(`[CompanyService] Participation created successfully`);
        } catch (participationError: any) {
          // Log error but don't fail company creation
          console.warn(`[CompanyService] Failed to create participation (non-critical):`, participationError.message);
          // Participation can be created manually later if needed
        }
      }
      
      return company;
    } catch (error: any) {
      console.error('Error in CompanyService.create:', error);
      if (error.message?.includes('timeout') || error.message?.includes('zu lange gedauert')) {
        throw new Error('Verbindung zu Supabase hat zu lange gedauert. Bitte prüfen Sie Ihre Internetverbindung und Supabase-Konfiguration.');
      }
      throw error;
    }
  }

  async findAll(): Promise<Company[]> {
    const startTime = Date.now();
    try {
      console.log('[CompanyService] findAll() - Starting database query');
      
      // Timeout für Supabase-Request (30 Sekunden)
      const timeoutPromise = new Promise<{ data: null; error: any }>((resolve) => {
        setTimeout(() => {
          resolve({
            data: null,
            error: { message: 'Supabase request timeout after 30 seconds', code: 'TIMEOUT' },
          });
        }, 30000);
      });

      const dbStartTime = Date.now();
      // Simplified query - fetch companies first, then relationships if needed
      const selectPromise = this.supabase
        .from('companies')
        .select('*')
        .order('name', { ascending: true });

      const result = await Promise.race([selectPromise, timeoutPromise]);
      const { data, error } = result as any;
      const dbDuration = Date.now() - dbStartTime;

      console.log(`[CompanyService] findAll() - Database query completed in ${dbDuration}ms`);
      console.log('[CompanyService] findAll() - Result:', data ? `${data.length} companies` : 'null', 'error:', error ? error.message : 'none');

      if (error) {
        console.error('[CompanyService] findAll() - Supabase error:', error);
        console.error('[CompanyService] findAll() - Error code:', error.code);
        
        if (error.code === 'TIMEOUT') {
          throw new Error('Verbindung zu Supabase hat zu lange gedauert. Bitte prüfen Sie Ihre Internetverbindung und Supabase-Konfiguration.');
        }
        
        SupabaseErrorHandler.handle(error, 'Companies', 'fetch');
      }

      const totalDuration = Date.now() - startTime;
      console.log(`[CompanyService] findAll() - Total duration: ${totalDuration}ms`);
      
      // Map companies - handle potential mapping errors
      try {
        const companies = (data || []).map((item: any) => {
          try {
            return SupabaseMapper.toCompany(item);
          } catch (mapError: any) {
            console.error('[CompanyService] findAll() - Error mapping company:', mapError);
            console.error('[CompanyService] findAll() - Company data:', JSON.stringify(item, null, 2));
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
        console.error('[CompanyService] findAll() - Error in mapping process:', mapError);
        throw new Error(`Fehler beim Mappen der Unternehmensdaten: ${mapError.message}`);
      }
    } catch (error: any) {
      const totalDuration = Date.now() - startTime;
      console.error(`[CompanyService] findAll() - Error after ${totalDuration}ms:`, error);
      if (error.message?.includes('timeout') || error.message?.includes('zu lange gedauert')) {
        throw new Error('Verbindung zu Supabase hat zu lange gedauert. Bitte prüfen Sie Ihre Internetverbindung und Supabase-Konfiguration.');
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
        const oldParentId = currentCompany?.parent_company_id;
        const newParentId = updateCompanyDto.parentCompanyId;
        
        // If parent was added or changed, create/update participation
        if (newParentId) {
          const participationPercentage = updateCompanyDto.participationPercentage ?? 100; // Default: 100% if not specified
          console.log(`[CompanyService] Creating/updating participation: ${newParentId} -> ${company.id} (${participationPercentage}%)`);
          await this.participationService.createOrUpdate({
            parentCompanyId: newParentId,
            subsidiaryCompanyId: company.id,
            participationPercentage: participationPercentage,
            acquisitionCost: null,
            acquisitionDate: null,
          });
          console.log(`[CompanyService] Participation updated successfully`);
        }
        // Note: We don't delete participations when parent is removed
        // They should be managed separately or can remain for historical purposes
      } catch (participationError: any) {
        // Log error but don't fail company update
        console.warn(`[CompanyService] Failed to update participation (non-critical):`, participationError.message);
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
