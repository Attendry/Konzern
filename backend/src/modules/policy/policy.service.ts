import { Injectable, Optional, Inject, forwardRef } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditLogService } from '../consolidation/audit-log.service';
import {
  AccountingPolicy,
  PolicyCategory,
  PolicyStatus,
  PolicyVersion,
} from '../../entities/accounting-policy.entity';
import {
  HgbWahlrecht,
  WahlrechtSelection,
} from '../../entities/hgb-wahlrecht.entity';

// Policy Summary
export interface PolicySummary {
  totalPolicies: number;
  activePolicies: number;
  draftPolicies: number;
  hgbMandatory: number;
  byCategory: {
    category: PolicyCategory;
    count: number;
  }[];
}

// Wahlrecht Summary
export interface WahlrechtSummary {
  totalWahlrechte: number;
  selectionsCount: number;
  bindingSelectionsCount: number;
  byOptionType: {
    type: string;
    count: number;
  }[];
}

@Injectable()
export class PolicyService {
  constructor(
    private supabaseService: SupabaseService,
    @Optional() @Inject(forwardRef(() => AuditLogService))
    private auditLogService: AuditLogService,
  ) {}

  // ==================== ACCOUNTING POLICIES ====================

  /**
   * Get all accounting policies
   */
  async getPolicies(
    category?: PolicyCategory,
    status?: PolicyStatus,
    hgbMandatoryOnly?: boolean,
  ): Promise<AccountingPolicy[]> {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('accounting_policies')
      .select('*')
      .order('category', { ascending: true })
      .order('code', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (hgbMandatoryOnly) {
      query = query.eq('is_hgb_mandatory', true);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch policies: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get active policies for a given date
   */
  async getActivePolicies(asOfDate: Date = new Date()): Promise<AccountingPolicy[]> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('accounting_policies')
      .select('*')
      .eq('status', PolicyStatus.ACTIVE)
      .lte('effective_date', asOfDate.toISOString())
      .or(`expiration_date.is.null,expiration_date.gte.${asOfDate.toISOString()}`)
      .order('category', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch active policies: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single policy by ID
   */
  async getPolicy(policyId: string): Promise<AccountingPolicy | null> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('accounting_policies')
      .select('*')
      .eq('id', policyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch policy: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new accounting policy
   */
  async createPolicy(
    policy: Partial<AccountingPolicy>,
    userId?: string,
  ): Promise<AccountingPolicy> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('accounting_policies')
      .insert({
        ...policy,
        created_by_user_id: userId,
        status: policy.status || PolicyStatus.DRAFT,
        version: 1,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create policy: ${error.message}`);
    }

    // Log action
    if (this.auditLogService) {
      await this.auditLogService.log({
        userId,
        action: 'create' as any,
        entityType: 'system' as any,
        entityId: data.id,
        entityName: data.name,
        afterState: data,
        description: `Created accounting policy: ${data.code}`,
      });
    }

    return data;
  }

  /**
   * Update an accounting policy
   */
  async updatePolicy(
    policyId: string,
    updates: Partial<AccountingPolicy>,
    userId?: string,
    createVersion: boolean = true,
  ): Promise<AccountingPolicy> {
    const supabase = this.supabaseService.getClient();

    const existing = await this.getPolicy(policyId);
    if (!existing) {
      throw new Error('Policy not found');
    }

    // Check if HGB mandatory policy is being modified inappropriately
    if (existing.isHgbMandatory && updates.policyText && !updates.hgbReference) {
      throw new Error('Cannot modify HGB mandatory policy text without proper justification');
    }

    // Create version history if policy text changed
    if (createVersion && updates.policyText && updates.policyText !== existing.policyText) {
      await supabase.from('policy_versions').insert({
        policy_id: policyId,
        version: existing.version,
        policy_text: existing.policyText,
        effective_date: existing.effectiveDate,
        changed_by_user_id: userId,
      });

      updates.version = existing.version + 1;
    }

    const { data, error } = await supabase
      .from('accounting_policies')
      .update(updates)
      .eq('id', policyId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update policy: ${error.message}`);
    }

    // Log action
    if (this.auditLogService) {
      await this.auditLogService.log({
        userId,
        action: 'update' as any,
        entityType: 'system' as any,
        entityId: data.id,
        entityName: data.name,
        beforeState: existing,
        afterState: data,
        description: `Updated accounting policy: ${data.code}`,
      });
    }

    return data;
  }

  /**
   * Activate a policy
   */
  async activatePolicy(policyId: string, userId: string): Promise<AccountingPolicy> {
    const policy = await this.getPolicy(policyId);
    if (!policy) {
      throw new Error('Policy not found');
    }

    if (policy.status !== PolicyStatus.DRAFT) {
      throw new Error('Only draft policies can be activated');
    }

    return this.updatePolicy(
      policyId,
      {
        status: PolicyStatus.ACTIVE,
        approvedByUserId: userId,
        approvedAt: new Date(),
      } as any,
      userId,
      false,
    );
  }

  /**
   * Supersede a policy with a new version
   */
  async supersedePolicy(
    oldPolicyId: string,
    newPolicy: Partial<AccountingPolicy>,
    userId: string,
  ): Promise<AccountingPolicy> {
    const supabase = this.supabaseService.getClient();

    const oldPolicy = await this.getPolicy(oldPolicyId);
    if (!oldPolicy) {
      throw new Error('Policy not found');
    }

    // Mark old policy as superseded
    await supabase
      .from('accounting_policies')
      .update({ status: PolicyStatus.SUPERSEDED })
      .eq('id', oldPolicyId);

    // Create new policy
    const created = await this.createPolicy(
      {
        ...newPolicy,
        code: oldPolicy.code,
        supersedesPolicyId: oldPolicyId,
        version: oldPolicy.version + 1,
      },
      userId,
    );

    return created;
  }

  /**
   * Get policy versions
   */
  async getPolicyVersions(policyId: string): Promise<PolicyVersion[]> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('policy_versions')
      .select('*')
      .eq('policy_id', policyId)
      .order('version', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch policy versions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get policy summary
   */
  async getPolicySummary(): Promise<PolicySummary> {
    const policies = await this.getPolicies();

    const summary: PolicySummary = {
      totalPolicies: policies.length,
      activePolicies: 0,
      draftPolicies: 0,
      hgbMandatory: 0,
      byCategory: [],
    };

    const categoryMap = new Map<PolicyCategory, number>();

    for (const policy of policies) {
      if (policy.status === PolicyStatus.ACTIVE) summary.activePolicies++;
      if (policy.status === PolicyStatus.DRAFT) summary.draftPolicies++;
      if (policy.isHgbMandatory) summary.hgbMandatory++;

      const count = categoryMap.get(policy.category) || 0;
      categoryMap.set(policy.category, count + 1);
    }

    summary.byCategory = Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      count,
    }));

    return summary;
  }

  // ==================== HGB WAHLRECHTE ====================

  /**
   * Get all HGB Wahlrechte
   */
  async getWahlrechte(optionType?: string): Promise<HgbWahlrecht[]> {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('hgb_wahlrechte')
      .select('*')
      .eq('is_active', true)
      .order('hgb_reference', { ascending: true });

    if (optionType) {
      query = query.eq('option_type', optionType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch Wahlrechte: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single Wahlrecht by ID
   */
  async getWahlrecht(wahlrechtId: string): Promise<HgbWahlrecht | null> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('hgb_wahlrechte')
      .select('*')
      .eq('id', wahlrechtId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch Wahlrecht: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new Wahlrecht
   */
  async createWahlrecht(wahlrecht: Partial<HgbWahlrecht>): Promise<HgbWahlrecht> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('hgb_wahlrechte')
      .insert(wahlrecht)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create Wahlrecht: ${error.message}`);
    }

    return data;
  }

  /**
   * Get Wahlrecht selections for a company or financial statement
   */
  async getWahlrechtSelections(
    companyId?: string,
    financialStatementId?: string,
  ): Promise<WahlrechtSelection[]> {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('wahlrechte_selections')
      .select(`
        *,
        wahlrecht:hgb_wahlrechte(*)
      `)
      .order('effective_from', { ascending: false });

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    if (financialStatementId) {
      query = query.eq('financial_statement_id', financialStatementId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch Wahlrecht selections: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Create or update a Wahlrecht selection
   */
  async setWahlrechtSelection(
    wahlrechtId: string,
    selection: Partial<WahlrechtSelection>,
    userId?: string,
  ): Promise<WahlrechtSelection> {
    const supabase = this.supabaseService.getClient();

    // Get the Wahlrecht to check constraints
    const wahlrecht = await this.getWahlrecht(wahlrechtId);
    if (!wahlrecht) {
      throw new Error('Wahlrecht not found');
    }

    // Check if once_chosen_binding and there's an existing selection
    if (wahlrecht.onceChosenBinding && selection.companyId) {
      const existing = await this.getWahlrechtSelections(selection.companyId);
      const existingForWahlrecht = existing.find(s => s.wahlrechtId === wahlrechtId);

      if (existingForWahlrecht && existingForWahlrecht.selectedOption !== selection.selectedOption) {
        throw new Error(
          `Wahlrecht "${wahlrecht.name}" ist stetigkeitsgebunden. ` +
          `Gewählte Option "${existingForWahlrecht.selectedOption}" kann nicht geändert werden.`,
        );
      }
    }

    const { data, error } = await supabase
      .from('wahlrechte_selections')
      .upsert({
        wahlrecht_id: wahlrechtId,
        company_id: selection.companyId,
        financial_statement_id: selection.financialStatementId,
        selected_option: selection.selectedOption,
        selection_reason: selection.selectionReason,
        effective_from: selection.effectiveFrom || new Date().toISOString(),
        effective_until: selection.effectiveUntil,
        created_by_user_id: userId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to set Wahlrecht selection: ${error.message}`);
    }

    return data;
  }

  /**
   * Approve a Wahlrecht selection
   */
  async approveWahlrechtSelection(
    selectionId: string,
    userId: string,
  ): Promise<WahlrechtSelection> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('wahlrechte_selections')
      .update({
        approved_by_user_id: userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', selectionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to approve Wahlrecht selection: ${error.message}`);
    }

    return data;
  }

  /**
   * Get Wahlrecht summary
   */
  async getWahlrechtSummary(): Promise<WahlrechtSummary> {
    const [wahlrechte, selections] = await Promise.all([
      this.getWahlrechte(),
      this.getWahlrechtSelections(),
    ]);

    const bindingCount = selections.filter(s => {
      const wahlrecht = wahlrechte.find(w => w.id === s.wahlrechtId);
      return wahlrecht?.onceChosenBinding;
    }).length;

    const typeMap = new Map<string, number>();
    for (const wahlrecht of wahlrechte) {
      const count = typeMap.get(wahlrecht.optionType) || 0;
      typeMap.set(wahlrecht.optionType, count + 1);
    }

    return {
      totalWahlrechte: wahlrechte.length,
      selectionsCount: selections.length,
      bindingSelectionsCount: bindingCount,
      byOptionType: Array.from(typeMap.entries()).map(([type, count]) => ({
        type,
        count,
      })),
    };
  }
}
