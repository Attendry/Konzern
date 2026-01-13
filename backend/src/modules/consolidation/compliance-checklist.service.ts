import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseErrorHandler } from '../../common/supabase-error.util';
import { SupabaseMapper } from '../../common/supabase-mapper.util';
import { 
  ComplianceChecklist, 
  ChecklistItemStatus, 
  ComplianceCategory,
  DEFAULT_CHECKLIST_ITEMS 
} from '../../entities/compliance-checklist.entity';

interface UpdateChecklistItemDto {
  status?: ChecklistItemStatus;
  notes?: string;
  evidence?: string;
  relatedEntityIds?: string[];
  completedByUserId?: string;
  dueDate?: string;
}

interface ComplianceProgress {
  category: ComplianceCategory;
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  notApplicable: number;
  requiresReview: number;
  percentComplete: number;
}

export interface ComplianceSummary {
  totalItems: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  overdue: number;
  percentComplete: number;
  byCategory: ComplianceProgress[];
  mandatoryComplete: boolean;
  nextDueItem?: ComplianceChecklist;
}

@Injectable()
export class ComplianceChecklistService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Initialize checklist for a financial statement
   */
  async initializeChecklist(financialStatementId: string): Promise<ComplianceChecklist[]> {
    console.log(`[ComplianceChecklistService] Initializing checklist for: ${financialStatementId}`);

    // Check if checklist already exists
    const { data: existing } = await this.supabase
      .from('compliance_checklists')
      .select('id')
      .eq('financial_statement_id', financialStatementId)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log('Checklist already exists, returning existing items');
      return this.getChecklist(financialStatementId);
    }

    // Create default checklist items
    const items = DEFAULT_CHECKLIST_ITEMS.map(item => ({
      ...item,
      financial_statement_id: financialStatementId,
      status: ChecklistItemStatus.NOT_STARTED,
      created_at: SupabaseMapper.getCurrentTimestamp(),
      updated_at: SupabaseMapper.getCurrentTimestamp(),
    }));

    const { data, error } = await this.supabase
      .from('compliance_checklists')
      .insert(items)
      .select();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Compliance Checklist', 'create');
    }

    return (data || []).map(this.mapToChecklist);
  }

  /**
   * Get checklist for a financial statement
   */
  async getChecklist(financialStatementId: string): Promise<ComplianceChecklist[]> {
    const { data, error } = await this.supabase
      .from('compliance_checklists')
      .select('*')
      .eq('financial_statement_id', financialStatementId)
      .order('category', { ascending: true })
      .order('priority', { ascending: true });

    if (error) {
      SupabaseErrorHandler.handle(error, 'Compliance Checklist', 'fetch');
    }

    return (data || []).map(this.mapToChecklist);
  }

  /**
   * Get checklist items by category
   */
  async getChecklistByCategory(
    financialStatementId: string,
    category: ComplianceCategory,
  ): Promise<ComplianceChecklist[]> {
    const { data, error } = await this.supabase
      .from('compliance_checklists')
      .select('*')
      .eq('financial_statement_id', financialStatementId)
      .eq('category', category)
      .order('priority', { ascending: true });

    if (error) {
      SupabaseErrorHandler.handle(error, 'Compliance Checklist', 'fetch');
    }

    return (data || []).map(this.mapToChecklist);
  }

  /**
   * Update a checklist item
   */
  async updateChecklistItem(
    id: string,
    dto: UpdateChecklistItemDto,
  ): Promise<ComplianceChecklist> {
    const updateData: any = {
      updated_at: SupabaseMapper.getCurrentTimestamp(),
    };

    if (dto.status !== undefined) {
      updateData.status = dto.status;
      
      if (dto.status === ChecklistItemStatus.COMPLETED) {
        updateData.completed_at = SupabaseMapper.getCurrentTimestamp();
        if (dto.completedByUserId) {
          updateData.completed_by_user_id = dto.completedByUserId;
        }
      }
    }

    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.evidence !== undefined) updateData.evidence = dto.evidence;
    if (dto.relatedEntityIds !== undefined) updateData.related_entity_ids = dto.relatedEntityIds;
    if (dto.dueDate !== undefined) updateData.due_date = dto.dueDate;

    const { data, error } = await this.supabase
      .from('compliance_checklists')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Compliance Checklist', 'update');
    }

    return this.mapToChecklist(data);
  }

  /**
   * Mark item as completed
   */
  async completeItem(
    id: string,
    userId: string,
    notes?: string,
    evidence?: string,
  ): Promise<ComplianceChecklist> {
    return this.updateChecklistItem(id, {
      status: ChecklistItemStatus.COMPLETED,
      completedByUserId: userId,
      notes,
      evidence,
    });
  }

  /**
   * Mark item for review
   */
  async markForReview(
    id: string,
    reviewerId: string,
  ): Promise<ComplianceChecklist> {
    const { data, error } = await this.supabase
      .from('compliance_checklists')
      .update({
        reviewed_by_user_id: reviewerId,
        reviewed_at: SupabaseMapper.getCurrentTimestamp(),
        updated_at: SupabaseMapper.getCurrentTimestamp(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Compliance Checklist', 'update');
    }

    return this.mapToChecklist(data);
  }

  /**
   * Get compliance summary for a financial statement
   */
  async getComplianceSummary(financialStatementId: string): Promise<ComplianceSummary> {
    const checklist = await this.getChecklist(financialStatementId);
    
    const today = new Date();
    const overdue = checklist.filter(item => 
      item.dueDate && 
      new Date(item.dueDate) < today && 
      item.status !== ChecklistItemStatus.COMPLETED &&
      item.status !== ChecklistItemStatus.NOT_APPLICABLE
    );

    const byCategory: ComplianceProgress[] = [];
    const categories = Object.values(ComplianceCategory);

    for (const category of categories) {
      const categoryItems = checklist.filter(item => item.category === category);
      if (categoryItems.length === 0) continue;

      const completed = categoryItems.filter(i => i.status === ChecklistItemStatus.COMPLETED).length;
      const inProgress = categoryItems.filter(i => i.status === ChecklistItemStatus.IN_PROGRESS).length;
      const notStarted = categoryItems.filter(i => i.status === ChecklistItemStatus.NOT_STARTED).length;
      const notApplicable = categoryItems.filter(i => i.status === ChecklistItemStatus.NOT_APPLICABLE).length;
      const requiresReview = categoryItems.filter(i => i.status === ChecklistItemStatus.REQUIRES_REVIEW).length;

      byCategory.push({
        category,
        total: categoryItems.length,
        completed,
        inProgress,
        notStarted,
        notApplicable,
        requiresReview,
        percentComplete: Math.round((completed / (categoryItems.length - notApplicable)) * 100) || 0,
      });
    }

    const applicableItems = checklist.filter(i => i.status !== ChecklistItemStatus.NOT_APPLICABLE);
    const completedItems = checklist.filter(i => i.status === ChecklistItemStatus.COMPLETED);
    const mandatoryItems = checklist.filter(i => i.isMandatory && i.status !== ChecklistItemStatus.NOT_APPLICABLE);
    const mandatoryCompleted = mandatoryItems.filter(i => i.status === ChecklistItemStatus.COMPLETED);

    // Find next due item
    const nextDueItem = checklist
      .filter(i => 
        i.dueDate && 
        i.status !== ChecklistItemStatus.COMPLETED &&
        i.status !== ChecklistItemStatus.NOT_APPLICABLE
      )
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0];

    return {
      totalItems: checklist.length,
      completed: completedItems.length,
      inProgress: checklist.filter(i => i.status === ChecklistItemStatus.IN_PROGRESS).length,
      notStarted: checklist.filter(i => i.status === ChecklistItemStatus.NOT_STARTED).length,
      overdue: overdue.length,
      percentComplete: Math.round((completedItems.length / applicableItems.length) * 100) || 0,
      byCategory,
      mandatoryComplete: mandatoryCompleted.length === mandatoryItems.length,
      nextDueItem,
    };
  }

  /**
   * Auto-update checklist based on consolidation entries
   */
  async autoUpdateFromConsolidation(financialStatementId: string): Promise<void> {
    const { data: entries } = await this.supabase
      .from('consolidation_entries')
      .select('*')
      .eq('financial_statement_id', financialStatementId)
      .eq('status', 'approved');

    if (!entries || entries.length === 0) return;

    // Map adjustment types to checklist categories
    const typeToCategory: Record<string, ComplianceCategory> = {
      'capital_consolidation': ComplianceCategory.CAPITAL_CONSOLIDATION,
      'debt_consolidation': ComplianceCategory.DEBT_CONSOLIDATION,
      'intercompany_profit': ComplianceCategory.INTERCOMPANY_PROFIT,
      'income_expense': ComplianceCategory.INCOME_EXPENSE,
      'deferred_tax': ComplianceCategory.DEFERRED_TAX,
      'minority_interest': ComplianceCategory.MINORITY_INTEREST,
      'currency_translation': ComplianceCategory.CURRENCY_TRANSLATION,
    };

    for (const entry of entries) {
      const category = typeToCategory[entry.adjustment_type];
      if (!category) continue;

      // Find related checklist items and mark as in progress
      const { data: checklistItems } = await this.supabase
        .from('compliance_checklists')
        .select('*')
        .eq('financial_statement_id', financialStatementId)
        .eq('category', category)
        .eq('status', ChecklistItemStatus.NOT_STARTED);

      for (const item of checklistItems || []) {
        await this.updateChecklistItem(item.id, {
          status: ChecklistItemStatus.IN_PROGRESS,
          relatedEntityIds: [...(item.related_entity_ids || []), entry.id],
        });
      }
    }
  }

  /**
   * Add custom checklist item
   */
  async addCustomItem(
    financialStatementId: string,
    itemCode: string,
    description: string,
    category: ComplianceCategory,
    hgbReference?: string,
    requirement?: string,
    isMandatory: boolean = false,
    priority: number = 5,
    dueDate?: string,
  ): Promise<ComplianceChecklist> {
    const { data, error } = await this.supabase
      .from('compliance_checklists')
      .insert({
        financial_statement_id: financialStatementId,
        category,
        item_code: itemCode,
        description,
        hgb_reference: hgbReference,
        requirement,
        is_mandatory: isMandatory,
        priority,
        due_date: dueDate,
        status: ChecklistItemStatus.NOT_STARTED,
        created_at: SupabaseMapper.getCurrentTimestamp(),
        updated_at: SupabaseMapper.getCurrentTimestamp(),
      })
      .select()
      .single();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Compliance Checklist', 'create');
    }

    return this.mapToChecklist(data);
  }

  /**
   * Delete a custom checklist item
   */
  async deleteItem(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('compliance_checklists')
      .delete()
      .eq('id', id);

    if (error) {
      SupabaseErrorHandler.handle(error, 'Compliance Checklist', 'delete');
    }
  }

  /**
   * Map database row to ComplianceChecklist entity
   */
  private mapToChecklist(data: any): ComplianceChecklist {
    return {
      id: data.id,
      financialStatementId: data.financial_statement_id,
      category: data.category,
      itemCode: data.item_code,
      description: data.description,
      hgbReference: data.hgb_reference,
      requirement: data.requirement,
      status: data.status,
      isMandatory: data.is_mandatory,
      priority: data.priority,
      notes: data.notes,
      evidence: data.evidence,
      relatedEntityIds: data.related_entity_ids,
      completedByUserId: data.completed_by_user_id,
      completedAt: data.completed_at ? new Date(data.completed_at) : null,
      reviewedByUserId: data.reviewed_by_user_id,
      reviewedAt: data.reviewed_at ? new Date(data.reviewed_at) : null,
      dueDate: data.due_date ? new Date(data.due_date) : null,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}
