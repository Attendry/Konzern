import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { LineageService, AuditTrailExport, LineageGraph } from './lineage.service';
import { LineageNodeType, CreateLineageNodeDto, LineageNodeQuery } from '../../entities/data-lineage-node.entity';
import { LineageTransformationType, CreateLineageTraceDto, LineageTraceQuery } from '../../entities/data-lineage-trace.entity';
import { PruefpfadStatus, CreatePruefpfadDto, UpdatePruefpfadDto, PruefpfadQuery } from '../../entities/pruefpfad-documentation.entity';

// Query DTOs
class QueryNodesDto {
  financialStatementId?: string;
  companyId?: string;
  nodeType?: LineageNodeType;
  accountId?: string;
  hgbSection?: string;
  isAudited?: string; // "true" or "false"
  isFinal?: string;
}

class QueryTracesDto {
  sourceNodeId?: string;
  targetNodeId?: string;
  transformationType?: LineageTransformationType;
  consolidationEntryId?: string;
  includeReversed?: string;
}

class QueryDocumentationDto {
  financialStatementId?: string;
  entityType?: string;
  entityId?: string;
  status?: PruefpfadStatus;
  hgbSection?: string;
  workingPaperRef?: string;
  riskLevel?: 'low' | 'medium' | 'high';
}

// Review/Verify DTOs
class ReviewDocumentationDto {
  reviewedByUserId: string;
  reviewedByName: string;
  reviewNotes?: string;
}

class VerifyDocumentationDto {
  verifiedByUserId: string;
  verifiedByName: string;
  verificationNotes?: string;
}

@Controller('api/lineage')
export class LineageController {
  constructor(private readonly lineageService: LineageService) {}

  // ==========================================
  // LINEAGE NODES
  // ==========================================

  /**
   * Create a new lineage node
   */
  @Post('nodes')
  async createNode(@Body() dto: CreateLineageNodeDto) {
    if (!dto.financialStatementId || !dto.nodeType || !dto.nodeCode || !dto.nodeName) {
      throw new BadRequestException('financialStatementId, nodeType, nodeCode, and nodeName are required');
    }
    return this.lineageService.createNode(dto);
  }

  /**
   * Create multiple lineage nodes
   */
  @Post('nodes/batch')
  async createNodesBatch(@Body() nodes: CreateLineageNodeDto[]) {
    if (!Array.isArray(nodes) || nodes.length === 0) {
      throw new BadRequestException('Request body must be a non-empty array of nodes');
    }
    return this.lineageService.createNodesBatch(nodes);
  }

  /**
   * Get lineage node by ID
   */
  @Get('nodes/:id')
  async getNodeById(@Param('id', ParseUUIDPipe) id: string) {
    const node = await this.lineageService.getNodeById(id);
    if (!node) {
      throw new BadRequestException(`Lineage node with ID ${id} not found`);
    }
    return node;
  }

  /**
   * Query lineage nodes
   */
  @Get('nodes')
  async queryNodes(@Query() query: QueryNodesDto) {
    const nodeQuery: LineageNodeQuery = {
      financialStatementId: query.financialStatementId,
      companyId: query.companyId,
      nodeType: query.nodeType,
      accountId: query.accountId,
      hgbSection: query.hgbSection,
      isAudited: query.isAudited === 'true' ? true : query.isAudited === 'false' ? false : undefined,
      isFinal: query.isFinal === 'true' ? true : query.isFinal === 'false' ? false : undefined,
    };
    return this.lineageService.queryNodes(nodeQuery);
  }

  /**
   * Mark node as audited
   */
  @Put('nodes/:id/audited')
  async markNodeAudited(@Param('id', ParseUUIDPipe) id: string) {
    return this.lineageService.markNodeAudited(id);
  }

  /**
   * Mark node as final
   */
  @Put('nodes/:id/final')
  async markNodeFinal(@Param('id', ParseUUIDPipe) id: string) {
    return this.lineageService.markNodeFinal(id);
  }

  /**
   * Trace to sources (upstream)
   */
  @Get('nodes/:id/sources')
  async traceToSources(@Param('id', ParseUUIDPipe) id: string) {
    return this.lineageService.traceToSources(id);
  }

  /**
   * Trace to targets (downstream)
   */
  @Get('nodes/:id/targets')
  async traceToTargets(@Param('id', ParseUUIDPipe) id: string) {
    return this.lineageService.traceToTargets(id);
  }

  /**
   * Get all traces for a node
   */
  @Get('nodes/:id/traces')
  async getNodeTraces(@Param('id', ParseUUIDPipe) id: string) {
    return this.lineageService.getNodeTraces(id);
  }

  // ==========================================
  // LINEAGE TRACES
  // ==========================================

  /**
   * Create a new lineage trace
   */
  @Post('traces')
  async createTrace(@Body() dto: CreateLineageTraceDto) {
    if (!dto.sourceNodeId || !dto.targetNodeId || !dto.transformationType) {
      throw new BadRequestException('sourceNodeId, targetNodeId, and transformationType are required');
    }
    return this.lineageService.createTrace(dto);
  }

  /**
   * Create multiple lineage traces
   */
  @Post('traces/batch')
  async createTracesBatch(@Body() traces: CreateLineageTraceDto[]) {
    if (!Array.isArray(traces) || traces.length === 0) {
      throw new BadRequestException('Request body must be a non-empty array of traces');
    }
    return this.lineageService.createTracesBatch(traces);
  }

  /**
   * Get trace by ID
   */
  @Get('traces/:id')
  async getTraceById(@Param('id', ParseUUIDPipe) id: string) {
    const trace = await this.lineageService.getTraceById(id);
    if (!trace) {
      throw new BadRequestException(`Lineage trace with ID ${id} not found`);
    }
    return trace;
  }

  /**
   * Query lineage traces
   */
  @Get('traces')
  async queryTraces(@Query() query: QueryTracesDto) {
    const traceQuery: LineageTraceQuery = {
      sourceNodeId: query.sourceNodeId,
      targetNodeId: query.targetNodeId,
      transformationType: query.transformationType,
      consolidationEntryId: query.consolidationEntryId,
      includeReversed: query.includeReversed === 'true',
    };
    return this.lineageService.queryTraces(traceQuery);
  }

  /**
   * Reverse a trace
   */
  @Put('traces/:id/reverse')
  async reverseTrace(@Param('id', ParseUUIDPipe) id: string) {
    return this.lineageService.reverseTrace(id);
  }

  // ==========================================
  // LINEAGE GRAPH
  // ==========================================

  /**
   * Build lineage graph for visualization
   */
  @Get('graph/:financialStatementId')
  async buildLineageGraph(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ): Promise<LineageGraph> {
    return this.lineageService.buildLineageGraph(financialStatementId);
  }

  // ==========================================
  // PRÜFPFAD DOCUMENTATION
  // ==========================================

  /**
   * Create documentation
   */
  @Post('documentation')
  async createDocumentation(@Body() dto: CreatePruefpfadDto) {
    if (!dto.financialStatementId || !dto.entityType || !dto.entityId || !dto.documentationSummary) {
      throw new BadRequestException('financialStatementId, entityType, entityId, and documentationSummary are required');
    }
    return this.lineageService.createDocumentation(dto);
  }

  /**
   * Get documentation by ID
   */
  @Get('documentation/:id')
  async getDocumentationById(@Param('id', ParseUUIDPipe) id: string) {
    const doc = await this.lineageService.getDocumentationById(id);
    if (!doc) {
      throw new BadRequestException(`Documentation with ID ${id} not found`);
    }
    return doc;
  }

  /**
   * Get documentation for a specific entity
   */
  @Get('documentation/entity/:entityType/:entityId')
  async getDocumentationForEntity(
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
  ) {
    return this.lineageService.getDocumentationForEntity(entityType, entityId);
  }

  /**
   * Query documentation
   */
  @Get('documentation')
  async queryDocumentation(@Query() query: QueryDocumentationDto) {
    const docQuery: PruefpfadQuery = {
      financialStatementId: query.financialStatementId,
      entityType: query.entityType,
      entityId: query.entityId,
      status: query.status,
      hgbSection: query.hgbSection,
      workingPaperRef: query.workingPaperRef,
      riskLevel: query.riskLevel,
    };
    return this.lineageService.queryDocumentation(docQuery);
  }

  /**
   * Update documentation
   */
  @Put('documentation/:id')
  async updateDocumentation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePruefpfadDto,
  ) {
    return this.lineageService.updateDocumentation(id, dto);
  }

  /**
   * Review documentation (4-eyes principle)
   */
  @Put('documentation/:id/review')
  async reviewDocumentation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDocumentationDto,
  ) {
    if (!dto.reviewedByUserId || !dto.reviewedByName) {
      throw new BadRequestException('reviewedByUserId and reviewedByName are required');
    }
    return this.lineageService.reviewDocumentation(
      id,
      dto.reviewedByUserId,
      dto.reviewedByName,
      dto.reviewNotes,
    );
  }

  /**
   * Verify documentation (auditor sign-off)
   */
  @Put('documentation/:id/verify')
  async verifyDocumentation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyDocumentationDto,
  ) {
    if (!dto.verifiedByUserId || !dto.verifiedByName) {
      throw new BadRequestException('verifiedByUserId and verifiedByName are required');
    }
    return this.lineageService.verifyDocumentation(
      id,
      dto.verifiedByUserId,
      dto.verifiedByName,
      dto.verificationNotes,
    );
  }

  // ==========================================
  // AUDIT TRAIL EXPORT
  // ==========================================

  /**
   * Export complete audit trail for WP
   */
  @Get('audit-trail/:financialStatementId')
  async exportAuditTrail(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ): Promise<AuditTrailExport> {
    return this.lineageService.exportAuditTrail(financialStatementId);
  }

  /**
   * Get documentation statistics
   */
  @Get('stats/:financialStatementId')
  async getDocumentationStats(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ) {
    return this.lineageService.getDocumentationStats(financialStatementId);
  }
}
