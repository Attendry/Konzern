import api from './api';

// Types
export enum LineageNodeType {
  SOURCE_DATA = 'source_data',
  ACCOUNT_BALANCE = 'account_balance',
  AGGREGATION = 'aggregation',
  INTERCOMPANY_ELIMINATION = 'intercompany_elimination',
  CAPITAL_CONSOLIDATION = 'capital_consolidation',
  DEBT_CONSOLIDATION = 'debt_consolidation',
  CURRENCY_TRANSLATION = 'currency_translation',
  MINORITY_INTEREST = 'minority_interest',
  DEFERRED_TAX = 'deferred_tax',
  CONSOLIDATED_VALUE = 'consolidated_value',
  RECLASSIFICATION = 'reclassification',
  VALUATION_ADJUSTMENT = 'valuation_adjustment',
  PROPORTIONAL_SHARE = 'proportional_share',
  EQUITY_METHOD = 'equity_method',
}

export enum LineageTransformationType {
  IMPORT = 'import',
  MANUAL_ENTRY = 'manual_entry',
  SUM = 'sum',
  SUBTRACT = 'subtract',
  MULTIPLY = 'multiply',
  PERCENTAGE = 'percentage',
  ELIMINATION = 'elimination',
  OFFSET = 'offset',
  ALLOCATION = 'allocation',
  REVERSAL = 'reversal',
  CARRY_FORWARD = 'carry_forward',
  PRO_RATA = 'pro_rata',
  MAPPING = 'mapping',
}

export enum PruefpfadStatus {
  DOCUMENTED = 'documented',
  PARTIALLY_DOCUMENTED = 'partially_documented',
  UNDOCUMENTED = 'undocumented',
  VERIFIED = 'verified',
  REQUIRES_REVIEW = 'requires_review',
}

export interface DataLineageNode {
  id: string;
  financialStatementId: string;
  companyId: string | null;
  nodeType: LineageNodeType;
  nodeCode: string;
  nodeName: string;
  valueAmount: number;
  valueCurrency: string;
  valueInGroupCurrency: number | null;
  accountId: string | null;
  accountCode: string | null;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  consolidationEntryId: string | null;
  hgbSection: string | null;
  fiscalYear: number | null;
  reportingPeriod: string | null;
  isAudited: boolean;
  isFinal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DataLineageTrace {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  transformationType: LineageTransformationType;
  transformationDescription: string | null;
  transformationFactor: number | null;
  transformationFormula: string | null;
  contributionAmount: number | null;
  contributionPercentage: number | null;
  consolidationEntryId: string | null;
  sequenceOrder: number;
  isReversible: boolean;
  reversedAt: string | null;
  reversedByTraceId: string | null;
  createdAt: string;
}

export interface EvidenceReference {
  type: string;
  ref: string;
  description: string;
  isVerified?: boolean;
}

export interface PruefpfadDocumentation {
  id: string;
  financialStatementId: string;
  entityType: string;
  entityId: string;
  status: PruefpfadStatus;
  hgbSection: string | null;
  hgbRequirement: string | null;
  complianceNotes: string | null;
  workingPaperRef: string | null;
  auditProgramRef: string | null;
  documentationSummary: string;
  detailedDescription: string | null;
  calculationBasis: string | null;
  assumptions: string | null;
  evidenceReferences: EvidenceReference[];
  riskLevel: 'low' | 'medium' | 'high' | null;
  materialRiskFactors: string | null;
  preparedByUserId: string | null;
  preparedByName: string | null;
  preparedAt: string;
  reviewedByUserId: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  verifiedByUserId: string | null;
  verifiedByName: string | null;
  verifiedAt: string | null;
  verificationNotes: string | null;
  createdAt: string;
  updatedAt: string;
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

export interface LineageGraph {
  nodes: LineageGraphNode[];
  edges: LineageGraphEdge[];
}

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

export interface DocumentationStats {
  total: number;
  byStatus: Record<string, number>;
  byHgbSection: Record<string, number>;
  byRiskLevel: Record<string, number>;
}

export interface LineageNodeQuery {
  financialStatementId?: string;
  companyId?: string;
  nodeType?: LineageNodeType;
  accountId?: string;
  hgbSection?: string;
  isAudited?: boolean;
  isFinal?: boolean;
}

export interface PruefpfadQuery {
  financialStatementId?: string;
  entityType?: string;
  entityId?: string;
  status?: PruefpfadStatus;
  hgbSection?: string;
  workingPaperRef?: string;
  riskLevel?: 'low' | 'medium' | 'high';
}

export const lineageService = {
  // Nodes
  async getNodes(query: LineageNodeQuery = {}): Promise<DataLineageNode[]> {
    const params = new URLSearchParams();
    if (query.financialStatementId) params.append('financialStatementId', query.financialStatementId);
    if (query.companyId) params.append('companyId', query.companyId);
    if (query.nodeType) params.append('nodeType', query.nodeType);
    if (query.accountId) params.append('accountId', query.accountId);
    if (query.hgbSection) params.append('hgbSection', query.hgbSection);
    if (query.isAudited !== undefined) params.append('isAudited', query.isAudited.toString());
    if (query.isFinal !== undefined) params.append('isFinal', query.isFinal.toString());

    const response = await api.get(`/lineage/nodes?${params.toString()}`);
    return response.data;
  },

  async getNodeById(id: string): Promise<DataLineageNode> {
    const response = await api.get(`/lineage/nodes/${id}`);
    return response.data;
  },

  async getNodeSources(id: string): Promise<DataLineageNode[]> {
    const response = await api.get(`/lineage/nodes/${id}/sources`);
    return response.data;
  },

  async getNodeTargets(id: string): Promise<DataLineageNode[]> {
    const response = await api.get(`/lineage/nodes/${id}/targets`);
    return response.data;
  },

  async getNodeTraces(id: string): Promise<{ incoming: DataLineageTrace[]; outgoing: DataLineageTrace[] }> {
    const response = await api.get(`/lineage/nodes/${id}/traces`);
    return response.data;
  },

  async markNodeAudited(id: string): Promise<DataLineageNode> {
    const response = await api.put(`/lineage/nodes/${id}/audited`);
    return response.data;
  },

  async markNodeFinal(id: string): Promise<DataLineageNode> {
    const response = await api.put(`/lineage/nodes/${id}/final`);
    return response.data;
  },

  // Graph
  async getLineageGraph(financialStatementId: string): Promise<LineageGraph> {
    const response = await api.get(`/lineage/graph/${financialStatementId}`);
    return response.data;
  },

  // Documentation
  async getDocumentation(query: PruefpfadQuery = {}): Promise<PruefpfadDocumentation[]> {
    const params = new URLSearchParams();
    if (query.financialStatementId) params.append('financialStatementId', query.financialStatementId);
    if (query.entityType) params.append('entityType', query.entityType);
    if (query.entityId) params.append('entityId', query.entityId);
    if (query.status) params.append('status', query.status);
    if (query.hgbSection) params.append('hgbSection', query.hgbSection);
    if (query.workingPaperRef) params.append('workingPaperRef', query.workingPaperRef);
    if (query.riskLevel) params.append('riskLevel', query.riskLevel);

    const response = await api.get(`/lineage/documentation?${params.toString()}`);
    return response.data;
  },

  async getDocumentationById(id: string): Promise<PruefpfadDocumentation> {
    const response = await api.get(`/lineage/documentation/${id}`);
    return response.data;
  },

  async getDocumentationForEntity(entityType: string, entityId: string): Promise<PruefpfadDocumentation | null> {
    try {
      const response = await api.get(`/lineage/documentation/entity/${entityType}/${entityId}`);
      return response.data;
    } catch (error) {
      return null;
    }
  },

  async createDocumentation(dto: Partial<PruefpfadDocumentation>): Promise<PruefpfadDocumentation> {
    const response = await api.post('/lineage/documentation', dto);
    return response.data;
  },

  async updateDocumentation(id: string, dto: Partial<PruefpfadDocumentation>): Promise<PruefpfadDocumentation> {
    const response = await api.put(`/lineage/documentation/${id}`, dto);
    return response.data;
  },

  async reviewDocumentation(
    id: string,
    reviewedByUserId: string,
    reviewedByName: string,
    reviewNotes?: string
  ): Promise<PruefpfadDocumentation> {
    const response = await api.put(`/lineage/documentation/${id}/review`, {
      reviewedByUserId,
      reviewedByName,
      reviewNotes,
    });
    return response.data;
  },

  async verifyDocumentation(
    id: string,
    verifiedByUserId: string,
    verifiedByName: string,
    verificationNotes?: string
  ): Promise<PruefpfadDocumentation> {
    const response = await api.put(`/lineage/documentation/${id}/verify`, {
      verifiedByUserId,
      verifiedByName,
      verificationNotes,
    });
    return response.data;
  },

  // Audit Trail Export
  async exportAuditTrail(financialStatementId: string): Promise<AuditTrailExport> {
    const response = await api.get(`/lineage/audit-trail/${financialStatementId}`);
    return response.data;
  },

  async getDocumentationStats(financialStatementId: string): Promise<DocumentationStats> {
    const response = await api.get(`/lineage/stats/${financialStatementId}`);
    return response.data;
  },
};

export default lineageService;
