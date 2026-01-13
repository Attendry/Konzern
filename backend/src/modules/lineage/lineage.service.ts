import { Injectable, Optional, Inject, forwardRef } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseErrorHandler } from '../../common/supabase-error.util';
import { SupabaseMapper } from '../../common/supabase-mapper.util';
import {
  DataLineageNode,
  LineageNodeType,
  CreateLineageNodeDto,
  LineageNodeQuery,
} from '../../entities/data-lineage-node.entity';
import {
  DataLineageTrace,
  LineageTransformationType,
  CreateLineageTraceDto,
  LineageTraceQuery,
} from '../../entities/data-lineage-trace.entity';
import {
  PruefpfadDocumentation,
  PruefpfadStatus,
  CreatePruefpfadDto,
  UpdatePruefpfadDto,
  PruefpfadQuery,
  EvidenceReference,
} from '../../entities/pruefpfad-documentation.entity';
import { AuditLogService } from '../consolidation/audit-log.service';
import { AuditEntityType } from '../../entities/audit-log.entity';

// Lineage graph representation for visualization
export interface LineageGraph {
  nodes: LineageGraphNode[];
  edges: LineageGraphEdge[];
}

export interface LineageGraphNode {
  id: string;
  type: LineageNodeType;
  label: string;
  value: number;
  currency: string;
  companyName?: string;
  accountCode?: string;
  hgbSection?: string;
  isAudited: boolean;
  isFinal: boolean;
}

export interface LineageGraphEdge {
  id: string;
  source: string;
  target: string;
  transformationType: LineageTransformationType;
  label: string;
  contributionAmount?: number;
  contributionPercentage?: number;
}

// Export format for audit trail
export interface AuditTrailExport {
  financialStatementId: string;
  fiscalYear: number;
  exportedAt: string;
  nodes: DataLineageNode[];
  traces: DataLineageTrace[];
  documentation: PruefpfadDocumentation[];
  summary: {
    totalNodes: number;
    totalTraces: number;
    documentedPercentage: number;
    verifiedPercentage: number;
    nodesByType: Record<string, number>;
  };
}

@Injectable()
export class LineageService {
  constructor(
    private supabaseService: SupabaseService,
    @Optional() @Inject(forwardRef(() => AuditLogService))
    private auditLogService?: AuditLogService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  // ==========================================
  // LINEAGE NODES
  // ==========================================

  /**
   * Create a new lineage node
   */
  async createNode(dto: CreateLineageNodeDto, userId?: string): Promise<DataLineageNode> {
    const { data, error } = await this.supabase
      .from('data_lineage_nodes')
      .insert({
        financial_statement_id: dto.financialStatementId,
        company_id: dto.companyId,
        node_type: dto.nodeType,
        node_code: dto.nodeCode,
        node_name: dto.nodeName,
        value_amount: dto.valueAmount,
        value_currency: dto.valueCurrency || 'EUR',
        value_in_group_currency: dto.valueInGroupCurrency,
        account_id: dto.accountId,
        account_code: dto.accountCode,
        source_entity_type: dto.sourceEntityType,
        source_entity_id: dto.sourceEntityId,
        consolidation_entry_id: dto.consolidationEntryId,
        hgb_section: dto.hgbSection,
        fiscal_year: dto.fiscalYear,
        reporting_period: dto.reportingPeriod,
        created_at: SupabaseMapper.getCurrentTimestamp(),
        updated_at: SupabaseMapper.getCurrentTimestamp(),
      })
      .select()
      .single();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Lineage Node', 'create');
    }

    const node = this.mapToLineageNode(data);

    // Log creation (if audit service available)
    if (this.auditLogService) {
      await this.auditLogService.logCreate(
        AuditEntityType.SYSTEM,
        node.id,
        `Lineage: ${node.nodeName}`,
        { nodeType: node.nodeType, value: node.valueAmount },
        userId,
        dto.financialStatementId,
        dto.companyId,
      );
    }

    return node;
  }

  /**
   * Create multiple lineage nodes in batch
   */
  async createNodesBatch(nodes: CreateLineageNodeDto[]): Promise<DataLineageNode[]> {
    if (nodes.length === 0) return [];

    const insertData = nodes.map((dto) => ({
      financial_statement_id: dto.financialStatementId,
      company_id: dto.companyId,
      node_type: dto.nodeType,
      node_code: dto.nodeCode,
      node_name: dto.nodeName,
      value_amount: dto.valueAmount,
      value_currency: dto.valueCurrency || 'EUR',
      value_in_group_currency: dto.valueInGroupCurrency,
      account_id: dto.accountId,
      account_code: dto.accountCode,
      source_entity_type: dto.sourceEntityType,
      source_entity_id: dto.sourceEntityId,
      consolidation_entry_id: dto.consolidationEntryId,
      hgb_section: dto.hgbSection,
      fiscal_year: dto.fiscalYear,
      reporting_period: dto.reportingPeriod,
      created_at: SupabaseMapper.getCurrentTimestamp(),
      updated_at: SupabaseMapper.getCurrentTimestamp(),
    }));

    const { data, error } = await this.supabase
      .from('data_lineage_nodes')
      .insert(insertData)
      .select();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Lineage Nodes', 'create batch');
    }

    return (data || []).map(this.mapToLineageNode);
  }

  /**
   * Get lineage node by ID
   */
  async getNodeById(id: string): Promise<DataLineageNode | null> {
    const { data, error } = await this.supabase
      .from('data_lineage_nodes')
      .select('*, companies(name), accounts(code, name)')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      SupabaseErrorHandler.handle(error, 'Lineage Node', 'fetch');
    }

    return this.mapToLineageNode(data);
  }

  /**
   * Query lineage nodes
   */
  async queryNodes(query: LineageNodeQuery): Promise<DataLineageNode[]> {
    let queryBuilder = this.supabase
      .from('data_lineage_nodes')
      .select('*, companies(name), accounts(code, name)');

    if (query.financialStatementId) {
      queryBuilder = queryBuilder.eq('financial_statement_id', query.financialStatementId);
    }
    if (query.companyId) {
      queryBuilder = queryBuilder.eq('company_id', query.companyId);
    }
    if (query.nodeType) {
      queryBuilder = queryBuilder.eq('node_type', query.nodeType);
    }
    if (query.accountId) {
      queryBuilder = queryBuilder.eq('account_id', query.accountId);
    }
    if (query.hgbSection) {
      queryBuilder = queryBuilder.eq('hgb_section', query.hgbSection);
    }
    if (query.isAudited !== undefined) {
      queryBuilder = queryBuilder.eq('is_audited', query.isAudited);
    }
    if (query.isFinal !== undefined) {
      queryBuilder = queryBuilder.eq('is_final', query.isFinal);
    }

    queryBuilder = queryBuilder.order('created_at', { ascending: false });

    const { data, error } = await queryBuilder;

    if (error) {
      SupabaseErrorHandler.handle(error, 'Lineage Nodes', 'query');
    }

    return (data || []).map(this.mapToLineageNode);
  }

  /**
   * Update a lineage node
   */
  async updateNode(
    id: string,
    updates: Partial<CreateLineageNodeDto>,
    userId?: string,
  ): Promise<DataLineageNode> {
    // Get before state
    const beforeNode = await this.getNodeById(id);

    const updateData: Record<string, any> = {
      updated_at: SupabaseMapper.getCurrentTimestamp(),
    };

    if (updates.valueAmount !== undefined) updateData.value_amount = updates.valueAmount;
    if (updates.valueInGroupCurrency !== undefined) updateData.value_in_group_currency = updates.valueInGroupCurrency;
    if (updates.nodeName !== undefined) updateData.node_name = updates.nodeName;
    if (updates.hgbSection !== undefined) updateData.hgb_section = updates.hgbSection;

    const { data, error } = await this.supabase
      .from('data_lineage_nodes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Lineage Node', 'update');
    }

    const node = this.mapToLineageNode(data);

    // Log update (if audit service available)
    if (beforeNode && this.auditLogService) {
      await this.auditLogService.logUpdate(
        AuditEntityType.SYSTEM,
        node.id,
        `Lineage: ${node.nodeName}`,
        beforeNode,
        node,
        userId,
        node.financialStatementId,
        node.companyId || undefined,
      );
    }

    return node;
  }

  /**
   * Mark node as audited
   */
  async markNodeAudited(id: string, userId?: string): Promise<DataLineageNode> {
    const { data, error } = await this.supabase
      .from('data_lineage_nodes')
      .update({
        is_audited: true,
        updated_at: SupabaseMapper.getCurrentTimestamp(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Lineage Node', 'mark audited');
    }

    return this.mapToLineageNode(data);
  }

  /**
   * Mark node as final
   */
  async markNodeFinal(id: string, userId?: string): Promise<DataLineageNode> {
    const { data, error } = await this.supabase
      .from('data_lineage_nodes')
      .update({
        is_final: true,
        updated_at: SupabaseMapper.getCurrentTimestamp(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Lineage Node', 'mark final');
    }

    return this.mapToLineageNode(data);
  }

  // ==========================================
  // LINEAGE TRACES
  // ==========================================

  /**
   * Create a new lineage trace (transformation relationship)
   */
  async createTrace(dto: CreateLineageTraceDto): Promise<DataLineageTrace> {
    const { data, error } = await this.supabase
      .from('data_lineage_traces')
      .insert({
        source_node_id: dto.sourceNodeId,
        target_node_id: dto.targetNodeId,
        transformation_type: dto.transformationType,
        transformation_description: dto.transformationDescription,
        transformation_factor: dto.transformationFactor,
        transformation_formula: dto.transformationFormula,
        contribution_amount: dto.contributionAmount,
        contribution_percentage: dto.contributionPercentage,
        consolidation_entry_id: dto.consolidationEntryId,
        sequence_order: dto.sequenceOrder || 0,
        created_at: SupabaseMapper.getCurrentTimestamp(),
      })
      .select()
      .single();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Lineage Trace', 'create');
    }

    return this.mapToLineageTrace(data);
  }

  /**
   * Create multiple lineage traces in batch
   */
  async createTracesBatch(traces: CreateLineageTraceDto[]): Promise<DataLineageTrace[]> {
    if (traces.length === 0) return [];

    const insertData = traces.map((dto) => ({
      source_node_id: dto.sourceNodeId,
      target_node_id: dto.targetNodeId,
      transformation_type: dto.transformationType,
      transformation_description: dto.transformationDescription,
      transformation_factor: dto.transformationFactor,
      transformation_formula: dto.transformationFormula,
      contribution_amount: dto.contributionAmount,
      contribution_percentage: dto.contributionPercentage,
      consolidation_entry_id: dto.consolidationEntryId,
      sequence_order: dto.sequenceOrder || 0,
      created_at: SupabaseMapper.getCurrentTimestamp(),
    }));

    const { data, error } = await this.supabase
      .from('data_lineage_traces')
      .insert(insertData)
      .select();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Lineage Traces', 'create batch');
    }

    return (data || []).map(this.mapToLineageTrace);
  }

  /**
   * Get trace by ID
   */
  async getTraceById(id: string): Promise<DataLineageTrace | null> {
    const { data, error } = await this.supabase
      .from('data_lineage_traces')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      SupabaseErrorHandler.handle(error, 'Lineage Trace', 'fetch');
    }

    return this.mapToLineageTrace(data);
  }

  /**
   * Query lineage traces
   */
  async queryTraces(query: LineageTraceQuery): Promise<DataLineageTrace[]> {
    let queryBuilder = this.supabase
      .from('data_lineage_traces')
      .select('*');

    if (query.sourceNodeId) {
      queryBuilder = queryBuilder.eq('source_node_id', query.sourceNodeId);
    }
    if (query.targetNodeId) {
      queryBuilder = queryBuilder.eq('target_node_id', query.targetNodeId);
    }
    if (query.transformationType) {
      queryBuilder = queryBuilder.eq('transformation_type', query.transformationType);
    }
    if (query.consolidationEntryId) {
      queryBuilder = queryBuilder.eq('consolidation_entry_id', query.consolidationEntryId);
    }
    if (!query.includeReversed) {
      queryBuilder = queryBuilder.is('reversed_at', null);
    }

    queryBuilder = queryBuilder.order('sequence_order', { ascending: true });

    const { data, error } = await queryBuilder;

    if (error) {
      SupabaseErrorHandler.handle(error, 'Lineage Traces', 'query');
    }

    return (data || []).map(this.mapToLineageTrace);
  }

  /**
   * Get all traces for a node (both incoming and outgoing)
   */
  async getNodeTraces(nodeId: string): Promise<{
    incoming: DataLineageTrace[];
    outgoing: DataLineageTrace[];
  }> {
    const [incomingResult, outgoingResult] = await Promise.all([
      this.supabase
        .from('data_lineage_traces')
        .select('*')
        .eq('target_node_id', nodeId)
        .is('reversed_at', null)
        .order('sequence_order'),
      this.supabase
        .from('data_lineage_traces')
        .select('*')
        .eq('source_node_id', nodeId)
        .is('reversed_at', null)
        .order('sequence_order'),
    ]);

    if (incomingResult.error) {
      SupabaseErrorHandler.handle(incomingResult.error, 'Lineage Traces', 'fetch incoming');
    }
    if (outgoingResult.error) {
      SupabaseErrorHandler.handle(outgoingResult.error, 'Lineage Traces', 'fetch outgoing');
    }

    return {
      incoming: (incomingResult.data || []).map(this.mapToLineageTrace),
      outgoing: (outgoingResult.data || []).map(this.mapToLineageTrace),
    };
  }

  /**
   * Reverse a trace (soft delete with reference to reversal)
   */
  async reverseTrace(id: string): Promise<DataLineageTrace> {
    const { data, error } = await this.supabase
      .from('data_lineage_traces')
      .update({
        reversed_at: SupabaseMapper.getCurrentTimestamp(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Lineage Trace', 'reverse');
    }

    return this.mapToLineageTrace(data);
  }

  // ==========================================
  // LINEAGE GRAPH
  // ==========================================

  /**
   * Build lineage graph for visualization
   */
  async buildLineageGraph(financialStatementId: string): Promise<LineageGraph> {
    // Get all nodes for this financial statement
    const { data: nodesData, error: nodesError } = await this.supabase
      .from('data_lineage_nodes')
      .select('*, companies(name)')
      .eq('financial_statement_id', financialStatementId);

    if (nodesError) {
      SupabaseErrorHandler.handle(nodesError, 'Lineage Graph', 'fetch nodes');
    }

    // Get all traces for these nodes
    const nodeIds = (nodesData || []).map((n: any) => n.id);
    
    if (nodeIds.length === 0) {
      return { nodes: [], edges: [] };
    }

    const { data: tracesData, error: tracesError } = await this.supabase
      .from('data_lineage_traces')
      .select('*')
      .or(`source_node_id.in.(${nodeIds.join(',')}),target_node_id.in.(${nodeIds.join(',')})`)
      .is('reversed_at', null);

    if (tracesError) {
      SupabaseErrorHandler.handle(tracesError, 'Lineage Graph', 'fetch traces');
    }

    // Map to graph nodes
    const graphNodes: LineageGraphNode[] = (nodesData || []).map((n: any) => ({
      id: n.id,
      type: n.node_type,
      label: n.node_name,
      value: parseFloat(n.value_amount),
      currency: n.value_currency,
      companyName: n.companies?.name,
      accountCode: n.account_code,
      hgbSection: n.hgb_section,
      isAudited: n.is_audited,
      isFinal: n.is_final,
    }));

    // Map to graph edges
    const graphEdges: LineageGraphEdge[] = (tracesData || []).map((t: any) => ({
      id: t.id,
      source: t.source_node_id,
      target: t.target_node_id,
      transformationType: t.transformation_type,
      label: t.transformation_description || this.getTransformationLabel(t.transformation_type),
      contributionAmount: t.contribution_amount ? parseFloat(t.contribution_amount) : undefined,
      contributionPercentage: t.contribution_percentage ? parseFloat(t.contribution_percentage) : undefined,
    }));

    return { nodes: graphNodes, edges: graphEdges };
  }

  /**
   * Trace lineage for a specific value back to its sources
   */
  async traceToSources(nodeId: string): Promise<DataLineageNode[]> {
    const visited = new Set<string>();
    const sources: DataLineageNode[] = [];

    const traverse = async (currentId: string) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);

      const { incoming } = await this.getNodeTraces(currentId);

      if (incoming.length === 0) {
        // This is a source node
        const node = await this.getNodeById(currentId);
        if (node) sources.push(node);
      } else {
        // Continue traversing upstream
        for (const trace of incoming) {
          await traverse(trace.sourceNodeId);
        }
      }
    };

    await traverse(nodeId);
    return sources;
  }

  /**
   * Trace lineage for a specific value forward to its targets
   */
  async traceToTargets(nodeId: string): Promise<DataLineageNode[]> {
    const visited = new Set<string>();
    const targets: DataLineageNode[] = [];

    const traverse = async (currentId: string) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);

      const { outgoing } = await this.getNodeTraces(currentId);

      if (outgoing.length === 0) {
        // This is a target node (leaf)
        const node = await this.getNodeById(currentId);
        if (node) targets.push(node);
      } else {
        // Continue traversing downstream
        for (const trace of outgoing) {
          await traverse(trace.targetNodeId);
        }
      }
    };

    await traverse(nodeId);
    return targets;
  }

  // ==========================================
  // PRÜFPFAD DOCUMENTATION
  // ==========================================

  /**
   * Create documentation for an entity
   */
  async createDocumentation(dto: CreatePruefpfadDto): Promise<PruefpfadDocumentation> {
    const { data, error } = await this.supabase
      .from('pruefpfad_documentation')
      .insert({
        financial_statement_id: dto.financialStatementId,
        entity_type: dto.entityType,
        entity_id: dto.entityId,
        documentation_summary: dto.documentationSummary,
        hgb_section: dto.hgbSection,
        hgb_requirement: dto.hgbRequirement,
        working_paper_ref: dto.workingPaperRef,
        audit_program_ref: dto.auditProgramRef,
        detailed_description: dto.detailedDescription,
        calculation_basis: dto.calculationBasis,
        assumptions: dto.assumptions,
        evidence_references: dto.evidenceReferences || [],
        risk_level: dto.riskLevel,
        material_risk_factors: dto.materialRiskFactors,
        prepared_by_user_id: dto.preparedByUserId,
        prepared_by_name: dto.preparedByName,
        status: PruefpfadStatus.DOCUMENTED,
        created_at: SupabaseMapper.getCurrentTimestamp(),
        updated_at: SupabaseMapper.getCurrentTimestamp(),
      })
      .select()
      .single();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Prüfpfad Documentation', 'create');
    }

    return this.mapToPruefpfad(data);
  }

  /**
   * Get documentation by ID
   */
  async getDocumentationById(id: string): Promise<PruefpfadDocumentation | null> {
    const { data, error } = await this.supabase
      .from('pruefpfad_documentation')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      SupabaseErrorHandler.handle(error, 'Prüfpfad Documentation', 'fetch');
    }

    return this.mapToPruefpfad(data);
  }

  /**
   * Get documentation for a specific entity
   */
  async getDocumentationForEntity(
    entityType: string,
    entityId: string,
  ): Promise<PruefpfadDocumentation | null> {
    const { data, error } = await this.supabase
      .from('pruefpfad_documentation')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      SupabaseErrorHandler.handle(error, 'Prüfpfad Documentation', 'fetch');
    }

    return this.mapToPruefpfad(data);
  }

  /**
   * Query documentation
   */
  async queryDocumentation(query: PruefpfadQuery): Promise<PruefpfadDocumentation[]> {
    let queryBuilder = this.supabase
      .from('pruefpfad_documentation')
      .select('*');

    if (query.financialStatementId) {
      queryBuilder = queryBuilder.eq('financial_statement_id', query.financialStatementId);
    }
    if (query.entityType) {
      queryBuilder = queryBuilder.eq('entity_type', query.entityType);
    }
    if (query.entityId) {
      queryBuilder = queryBuilder.eq('entity_id', query.entityId);
    }
    if (query.status) {
      queryBuilder = queryBuilder.eq('status', query.status);
    }
    if (query.hgbSection) {
      queryBuilder = queryBuilder.eq('hgb_section', query.hgbSection);
    }
    if (query.workingPaperRef) {
      queryBuilder = queryBuilder.eq('working_paper_ref', query.workingPaperRef);
    }
    if (query.riskLevel) {
      queryBuilder = queryBuilder.eq('risk_level', query.riskLevel);
    }

    queryBuilder = queryBuilder.order('created_at', { ascending: false });

    const { data, error } = await queryBuilder;

    if (error) {
      SupabaseErrorHandler.handle(error, 'Prüfpfad Documentation', 'query');
    }

    return (data || []).map(this.mapToPruefpfad);
  }

  /**
   * Update documentation
   */
  async updateDocumentation(
    id: string,
    dto: UpdatePruefpfadDto,
  ): Promise<PruefpfadDocumentation> {
    const updateData: Record<string, any> = {
      updated_at: SupabaseMapper.getCurrentTimestamp(),
    };

    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.documentationSummary !== undefined) updateData.documentation_summary = dto.documentationSummary;
    if (dto.detailedDescription !== undefined) updateData.detailed_description = dto.detailedDescription;
    if (dto.calculationBasis !== undefined) updateData.calculation_basis = dto.calculationBasis;
    if (dto.assumptions !== undefined) updateData.assumptions = dto.assumptions;
    if (dto.evidenceReferences !== undefined) updateData.evidence_references = dto.evidenceReferences;
    if (dto.complianceNotes !== undefined) updateData.compliance_notes = dto.complianceNotes;
    if (dto.riskLevel !== undefined) updateData.risk_level = dto.riskLevel;
    if (dto.materialRiskFactors !== undefined) updateData.material_risk_factors = dto.materialRiskFactors;

    // Review fields
    if (dto.reviewedByUserId !== undefined) {
      updateData.reviewed_by_user_id = dto.reviewedByUserId;
      updateData.reviewed_by_name = dto.reviewedByName;
      updateData.reviewed_at = SupabaseMapper.getCurrentTimestamp();
      updateData.review_notes = dto.reviewNotes;
    }

    // Verification fields
    if (dto.verifiedByUserId !== undefined) {
      updateData.verified_by_user_id = dto.verifiedByUserId;
      updateData.verified_by_name = dto.verifiedByName;
      updateData.verified_at = SupabaseMapper.getCurrentTimestamp();
      updateData.verification_notes = dto.verificationNotes;
      updateData.status = PruefpfadStatus.VERIFIED;
    }

    const { data, error } = await this.supabase
      .from('pruefpfad_documentation')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Prüfpfad Documentation', 'update');
    }

    return this.mapToPruefpfad(data);
  }

  /**
   * Review documentation (4-eyes principle)
   */
  async reviewDocumentation(
    id: string,
    reviewedByUserId: string,
    reviewedByName: string,
    reviewNotes?: string,
  ): Promise<PruefpfadDocumentation> {
    return this.updateDocumentation(id, {
      reviewedByUserId,
      reviewedByName,
      reviewNotes,
    });
  }

  /**
   * Verify documentation (auditor sign-off)
   */
  async verifyDocumentation(
    id: string,
    verifiedByUserId: string,
    verifiedByName: string,
    verificationNotes?: string,
  ): Promise<PruefpfadDocumentation> {
    return this.updateDocumentation(id, {
      verifiedByUserId,
      verifiedByName,
      verificationNotes,
    });
  }

  // ==========================================
  // AUDIT TRAIL EXPORT
  // ==========================================

  /**
   * Export complete audit trail for a financial statement
   */
  async exportAuditTrail(financialStatementId: string): Promise<AuditTrailExport> {
    // Get financial statement info
    const { data: fsData, error: fsError } = await this.supabase
      .from('financial_statements')
      .select('fiscal_year')
      .eq('id', financialStatementId)
      .single();

    if (fsError) {
      SupabaseErrorHandler.handle(fsError, 'Financial Statement', 'fetch');
    }

    // Get all nodes
    const nodes = await this.queryNodes({ financialStatementId });

    // Get all traces for these nodes
    const nodeIds = nodes.map((n) => n.id);
    let traces: DataLineageTrace[] = [];
    
    if (nodeIds.length > 0) {
      const { data: tracesData, error: tracesError } = await this.supabase
        .from('data_lineage_traces')
        .select('*')
        .or(`source_node_id.in.(${nodeIds.join(',')}),target_node_id.in.(${nodeIds.join(',')})`)
        .is('reversed_at', null);

      if (tracesError) {
        SupabaseErrorHandler.handle(tracesError, 'Lineage Traces', 'export');
      }

      traces = (tracesData || []).map(this.mapToLineageTrace);
    }

    // Get all documentation
    const documentation = await this.queryDocumentation({ financialStatementId });

    // Calculate summary
    const nodesByType: Record<string, number> = {};
    for (const node of nodes) {
      nodesByType[node.nodeType] = (nodesByType[node.nodeType] || 0) + 1;
    }

    const documentedCount = documentation.filter(
      (d) => d.status !== PruefpfadStatus.UNDOCUMENTED
    ).length;
    const verifiedCount = documentation.filter(
      (d) => d.status === PruefpfadStatus.VERIFIED
    ).length;

    return {
      financialStatementId,
      fiscalYear: fsData?.fiscal_year,
      exportedAt: new Date().toISOString(),
      nodes,
      traces,
      documentation,
      summary: {
        totalNodes: nodes.length,
        totalTraces: traces.length,
        documentedPercentage: nodes.length > 0 
          ? Math.round((documentedCount / nodes.length) * 100) 
          : 0,
        verifiedPercentage: nodes.length > 0 
          ? Math.round((verifiedCount / nodes.length) * 100) 
          : 0,
        nodesByType,
      },
    };
  }

  /**
   * Get documentation statistics for a financial statement
   */
  async getDocumentationStats(financialStatementId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byHgbSection: Record<string, number>;
    byRiskLevel: Record<string, number>;
  }> {
    const documentation = await this.queryDocumentation({ financialStatementId });

    const byStatus: Record<string, number> = {};
    const byHgbSection: Record<string, number> = {};
    const byRiskLevel: Record<string, number> = {};

    for (const doc of documentation) {
      byStatus[doc.status] = (byStatus[doc.status] || 0) + 1;
      if (doc.hgbSection) {
        byHgbSection[doc.hgbSection] = (byHgbSection[doc.hgbSection] || 0) + 1;
      }
      if (doc.riskLevel) {
        byRiskLevel[doc.riskLevel] = (byRiskLevel[doc.riskLevel] || 0) + 1;
      }
    }

    return {
      total: documentation.length,
      byStatus,
      byHgbSection,
      byRiskLevel,
    };
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  private getTransformationLabel(type: LineageTransformationType): string {
    const labels: Record<LineageTransformationType, string> = {
      [LineageTransformationType.IMPORT]: 'Import',
      [LineageTransformationType.MANUAL_ENTRY]: 'Manuelle Eingabe',
      [LineageTransformationType.SUM]: 'Summe',
      [LineageTransformationType.SUBTRACT]: 'Subtraktion',
      [LineageTransformationType.MULTIPLY]: 'Multiplikation',
      [LineageTransformationType.PERCENTAGE]: 'Prozent',
      [LineageTransformationType.ELIMINATION]: 'Eliminierung',
      [LineageTransformationType.OFFSET]: 'Verrechnung',
      [LineageTransformationType.ALLOCATION]: 'Zuordnung',
      [LineageTransformationType.REVERSAL]: 'Storno',
      [LineageTransformationType.CARRY_FORWARD]: 'Vortrag',
      [LineageTransformationType.PRO_RATA]: 'Anteilig',
      [LineageTransformationType.MAPPING]: 'Mapping',
    };
    return labels[type] || type;
  }

  private mapToLineageNode(data: any): DataLineageNode {
    return {
      id: data.id,
      financialStatementId: data.financial_statement_id,
      companyId: data.company_id,
      nodeType: data.node_type,
      nodeCode: data.node_code,
      nodeName: data.node_name,
      valueAmount: parseFloat(data.value_amount),
      valueCurrency: data.value_currency,
      valueInGroupCurrency: data.value_in_group_currency ? parseFloat(data.value_in_group_currency) : null,
      accountId: data.account_id,
      accountCode: data.account_code,
      sourceEntityType: data.source_entity_type,
      sourceEntityId: data.source_entity_id,
      consolidationEntryId: data.consolidation_entry_id,
      hgbSection: data.hgb_section,
      fiscalYear: data.fiscal_year,
      reportingPeriod: data.reporting_period,
      isAudited: data.is_audited,
      isFinal: data.is_final,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    } as DataLineageNode;
  }

  private mapToLineageTrace(data: any): DataLineageTrace {
    return {
      id: data.id,
      sourceNodeId: data.source_node_id,
      targetNodeId: data.target_node_id,
      transformationType: data.transformation_type,
      transformationDescription: data.transformation_description,
      transformationFactor: data.transformation_factor ? parseFloat(data.transformation_factor) : null,
      transformationFormula: data.transformation_formula,
      contributionAmount: data.contribution_amount ? parseFloat(data.contribution_amount) : null,
      contributionPercentage: data.contribution_percentage ? parseFloat(data.contribution_percentage) : null,
      consolidationEntryId: data.consolidation_entry_id,
      sequenceOrder: data.sequence_order,
      isReversible: data.is_reversible,
      reversedAt: data.reversed_at ? new Date(data.reversed_at) : null,
      reversedByTraceId: data.reversed_by_trace_id,
      createdAt: new Date(data.created_at),
    } as DataLineageTrace;
  }

  private mapToPruefpfad(data: any): PruefpfadDocumentation {
    return {
      id: data.id,
      financialStatementId: data.financial_statement_id,
      entityType: data.entity_type,
      entityId: data.entity_id,
      status: data.status,
      hgbSection: data.hgb_section,
      hgbRequirement: data.hgb_requirement,
      complianceNotes: data.compliance_notes,
      workingPaperRef: data.working_paper_ref,
      auditProgramRef: data.audit_program_ref,
      documentationSummary: data.documentation_summary,
      detailedDescription: data.detailed_description,
      calculationBasis: data.calculation_basis,
      assumptions: data.assumptions,
      evidenceReferences: data.evidence_references || [],
      riskLevel: data.risk_level,
      materialRiskFactors: data.material_risk_factors,
      preparedByUserId: data.prepared_by_user_id,
      preparedByName: data.prepared_by_name,
      preparedAt: new Date(data.prepared_at),
      reviewedByUserId: data.reviewed_by_user_id,
      reviewedByName: data.reviewed_by_name,
      reviewedAt: data.reviewed_at ? new Date(data.reviewed_at) : null,
      reviewNotes: data.review_notes,
      verifiedByUserId: data.verified_by_user_id,
      verifiedByName: data.verified_by_name,
      verifiedAt: data.verified_at ? new Date(data.verified_at) : null,
      verificationNotes: data.verification_notes,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    } as PruefpfadDocumentation;
  }
}
