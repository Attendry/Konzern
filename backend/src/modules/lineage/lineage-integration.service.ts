import { Injectable } from '@nestjs/common';
import { LineageService } from './lineage.service';
import { LineageNodeType, CreateLineageNodeDto } from '../../entities/data-lineage-node.entity';
import { LineageTransformationType, CreateLineageTraceDto } from '../../entities/data-lineage-trace.entity';
import { AdjustmentType, HgbReference } from '../../entities/consolidation-entry.entity';

// Mapping from consolidation adjustment types to lineage node types
const adjustmentToNodeType: Record<string, LineageNodeType> = {
  [AdjustmentType.CAPITAL_CONSOLIDATION]: LineageNodeType.CAPITAL_CONSOLIDATION,
  [AdjustmentType.DEBT_CONSOLIDATION]: LineageNodeType.DEBT_CONSOLIDATION,
  [AdjustmentType.INTERCOMPANY_PROFIT]: LineageNodeType.INTERCOMPANY_ELIMINATION,
  [AdjustmentType.INCOME_EXPENSE]: LineageNodeType.INTERCOMPANY_ELIMINATION,
  [AdjustmentType.CURRENCY_TRANSLATION]: LineageNodeType.CURRENCY_TRANSLATION,
  [AdjustmentType.DEFERRED_TAX]: LineageNodeType.DEFERRED_TAX,
  [AdjustmentType.MINORITY_INTEREST]: LineageNodeType.MINORITY_INTEREST,
  [AdjustmentType.RECLASSIFICATION]: LineageNodeType.RECLASSIFICATION,
  [AdjustmentType.ELIMINATION]: LineageNodeType.INTERCOMPANY_ELIMINATION,
  [AdjustmentType.OTHER]: LineageNodeType.AGGREGATION,
};

// Mapping from HGB references to sections
const hgbReferenceToSection: Record<string, string> = {
  [HgbReference.SECTION_301]: '§ 301 HGB',
  [HgbReference.SECTION_303]: '§ 303 HGB',
  [HgbReference.SECTION_304]: '§ 304 HGB',
  [HgbReference.SECTION_305]: '§ 305 HGB',
  [HgbReference.SECTION_306]: '§ 306 HGB',
  [HgbReference.SECTION_307]: '§ 307 HGB',
  [HgbReference.SECTION_308]: '§ 308 HGB',
  [HgbReference.SECTION_308A]: '§ 308a HGB',
  [HgbReference.SECTION_312]: '§ 312 HGB',
  [HgbReference.OTHER]: 'Sonstige',
};

export interface ConsolidationEntryForLineage {
  id: string;
  financialStatementId: string;
  adjustmentType: AdjustmentType;
  amount: number;
  description: string;
  hgbReference?: HgbReference | null;
  affectedCompanyIds?: string[] | null;
  accountId?: string | null;
  debitAccountId?: string | null;
  creditAccountId?: string | null;
}

export interface SourceData {
  nodeId?: string;
  entityType: string;
  entityId: string;
  name: string;
  value: number;
  companyId?: string;
  accountCode?: string;
}

@Injectable()
export class LineageIntegrationService {
  constructor(private lineageService: LineageService) {}

  /**
   * Create lineage tracking for a consolidation entry
   * This creates the target node and traces from source nodes
   */
  async trackConsolidationEntry(
    entry: ConsolidationEntryForLineage,
    sources?: SourceData[],
    fiscalYear?: number,
  ): Promise<string> {
    // Determine node type from adjustment type
    const nodeType = adjustmentToNodeType[entry.adjustmentType] || LineageNodeType.AGGREGATION;
    
    // Determine HGB section
    const hgbSection = entry.hgbReference 
      ? hgbReferenceToSection[entry.hgbReference] 
      : undefined;

    // Create the target node for this consolidation entry
    const nodeCode = `CE-${entry.id.substring(0, 8)}`;
    const companyId = entry.affectedCompanyIds?.[0] || null;

    const targetNode = await this.lineageService.createNode({
      financialStatementId: entry.financialStatementId,
      companyId,
      nodeType,
      nodeCode,
      nodeName: entry.description.substring(0, 500),
      valueAmount: entry.amount,
      valueCurrency: 'EUR',
      accountId: entry.accountId || entry.debitAccountId || undefined,
      sourceEntityType: 'consolidation_entry',
      sourceEntityId: entry.id,
      consolidationEntryId: entry.id,
      hgbSection,
      fiscalYear,
    });

    // Create traces from source nodes if provided
    if (sources && sources.length > 0) {
      const traces: CreateLineageTraceDto[] = [];

      for (let i = 0; i < sources.length; i++) {
        const source = sources[i];
        let sourceNodeId = source.nodeId;

        // If no source node ID, create a source node
        if (!sourceNodeId) {
          const sourceNode = await this.lineageService.createNode({
            financialStatementId: entry.financialStatementId,
            companyId: source.companyId,
            nodeType: LineageNodeType.SOURCE_DATA,
            nodeCode: `SRC-${source.entityType}-${source.entityId.substring(0, 8)}`,
            nodeName: source.name,
            valueAmount: source.value,
            valueCurrency: 'EUR',
            accountCode: source.accountCode,
            sourceEntityType: source.entityType,
            sourceEntityId: source.entityId,
            fiscalYear,
          });
          sourceNodeId = sourceNode.id;
        }

        traces.push({
          sourceNodeId,
          targetNodeId: targetNode.id,
          transformationType: this.getTransformationType(entry.adjustmentType),
          transformationDescription: entry.description.substring(0, 200),
          contributionAmount: source.value,
          contributionPercentage: entry.amount !== 0 
            ? Math.abs((source.value / entry.amount) * 100)
            : undefined,
          consolidationEntryId: entry.id,
          sequenceOrder: i,
        });
      }

      if (traces.length > 0) {
        await this.lineageService.createTracesBatch(traces);
      }
    }

    return targetNode.id;
  }

  /**
   * Track account balance as a source node
   */
  async trackAccountBalance(
    financialStatementId: string,
    accountBalanceId: string,
    companyId: string,
    accountCode: string,
    accountName: string,
    balance: number,
    fiscalYear?: number,
  ): Promise<string> {
    const node = await this.lineageService.createNode({
      financialStatementId,
      companyId,
      nodeType: LineageNodeType.ACCOUNT_BALANCE,
      nodeCode: `AB-${accountBalanceId.substring(0, 8)}`,
      nodeName: `${accountCode}: ${accountName}`,
      valueAmount: balance,
      valueCurrency: 'EUR',
      accountCode,
      sourceEntityType: 'account_balance',
      sourceEntityId: accountBalanceId,
      fiscalYear,
    });

    return node.id;
  }

  /**
   * Track consolidated value (final result)
   */
  async trackConsolidatedValue(
    financialStatementId: string,
    name: string,
    value: number,
    accountCode?: string,
    hgbSection?: string,
    fiscalYear?: number,
    sourceNodeIds?: string[],
  ): Promise<string> {
    const node = await this.lineageService.createNode({
      financialStatementId,
      nodeType: LineageNodeType.CONSOLIDATED_VALUE,
      nodeCode: `CONS-${Date.now().toString(36)}`,
      nodeName: name,
      valueAmount: value,
      valueCurrency: 'EUR',
      accountCode,
      hgbSection,
      fiscalYear,
      isFinal: true,
    } as any);

    // Create traces from source nodes
    if (sourceNodeIds && sourceNodeIds.length > 0) {
      const traces: CreateLineageTraceDto[] = sourceNodeIds.map((sourceNodeId, i) => ({
        sourceNodeId,
        targetNodeId: node.id,
        transformationType: LineageTransformationType.SUM,
        transformationDescription: 'Konsolidierte Summe',
        sequenceOrder: i,
      }));

      await this.lineageService.createTracesBatch(traces);
    }

    return node.id;
  }

  /**
   * Get transformation type from adjustment type
   */
  private getTransformationType(adjustmentType: AdjustmentType): LineageTransformationType {
    switch (adjustmentType) {
      case AdjustmentType.ELIMINATION:
      case AdjustmentType.INTERCOMPANY_PROFIT:
      case AdjustmentType.INCOME_EXPENSE:
        return LineageTransformationType.ELIMINATION;
      
      case AdjustmentType.RECLASSIFICATION:
        return LineageTransformationType.MAPPING;
      
      case AdjustmentType.CURRENCY_TRANSLATION:
        return LineageTransformationType.MULTIPLY;
      
      case AdjustmentType.CAPITAL_CONSOLIDATION:
      case AdjustmentType.DEBT_CONSOLIDATION:
        return LineageTransformationType.OFFSET;
      
      case AdjustmentType.MINORITY_INTEREST:
        return LineageTransformationType.PERCENTAGE;
      
      default:
        return LineageTransformationType.SUM;
    }
  }

  /**
   * Batch track multiple consolidation entries
   */
  async trackConsolidationEntriesBatch(
    entries: ConsolidationEntryForLineage[],
    fiscalYear?: number,
  ): Promise<string[]> {
    const nodeIds: string[] = [];

    for (const entry of entries) {
      const nodeId = await this.trackConsolidationEntry(entry, undefined, fiscalYear);
      nodeIds.push(nodeId);
    }

    return nodeIds;
  }
}
