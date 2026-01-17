import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Res,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import {
  KonzernanhangDocumentService,
  KonzernanhangDocument,
  KonzernanhangSection,
  DisclosureType,
  NoteSectionStatus,
  CreateDocumentDto,
  CreateSectionDto,
  UpdateSectionDto,
} from './konzernanhang-document.service';
import {
  KonzernanhangExportService,
  ExportFormat,
  ExportMetadata,
} from './konzernanhang-export.service';

// DTOs
class ReviewDocumentDto {
  reviewedByUserId: string;
  reviewedByName: string;
  reviewNotes?: string;
}

class ApproveDocumentDto {
  approvedByUserId: string;
  approvedByName: string;
  approvalNotes?: string;
}

class ExportDocumentDto {
  format: ExportFormat;
  exportedByUserId?: string;
  exportedByName?: string;
  exportPurpose?: string;
  recipient?: string;
}

@Controller('konzernanhang')
export class KonzernanhangController {
  constructor(
    private readonly dokumentService: KonzernanhangDocumentService,
    private readonly exportService: KonzernanhangExportService,
  ) {}

  // ==========================================
  // DOCUMENT ENDPOINTS
  // ==========================================

  /**
   * Create a new Konzernanhang document
   * POST /api/konzernanhang/documents
   */
  @Post('documents')
  async createDocument(
    @Body() dto: CreateDocumentDto,
  ): Promise<KonzernanhangDocument> {
    if (!dto.financialStatementId) {
      throw new BadRequestException('financialStatementId is required');
    }
    return this.dokumentService.createDocument(dto);
  }

  /**
   * Get document by ID
   * GET /api/konzernanhang/documents/:id
   */
  @Get('documents/:id')
  async getDocument(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<KonzernanhangDocument> {
    const doc = await this.dokumentService.getDocumentById(id);
    if (!doc) {
      throw new BadRequestException(`Document with ID ${id} not found`);
    }
    return doc;
  }

  /**
   * Get current document for a financial statement
   * GET /api/konzernanhang/documents/financial-statement/:financialStatementId
   */
  @Get('documents/financial-statement/:financialStatementId')
  async getCurrentDocument(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ): Promise<KonzernanhangDocument | null> {
    return this.dokumentService.getCurrentDocument(financialStatementId);
  }

  /**
   * Review document
   * PUT /api/konzernanhang/documents/:id/review
   */
  @Put('documents/:id/review')
  async reviewDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDocumentDto,
  ): Promise<KonzernanhangDocument> {
    if (!dto.reviewedByUserId || !dto.reviewedByName) {
      throw new BadRequestException(
        'reviewedByUserId and reviewedByName are required',
      );
    }
    return this.dokumentService.reviewDocument(
      id,
      dto.reviewedByUserId,
      dto.reviewedByName,
      dto.reviewNotes,
    );
  }

  /**
   * Approve document (finalize)
   * PUT /api/konzernanhang/documents/:id/approve
   */
  @Put('documents/:id/approve')
  async approveDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveDocumentDto,
  ): Promise<KonzernanhangDocument> {
    if (!dto.approvedByUserId || !dto.approvedByName) {
      throw new BadRequestException(
        'approvedByUserId and approvedByName are required',
      );
    }
    return this.dokumentService.approveDocument(
      id,
      dto.approvedByUserId,
      dto.approvedByName,
      dto.approvalNotes,
    );
  }

  /**
   * Generate all sections automatically
   * POST /api/konzernanhang/documents/:id/generate
   */
  @Post('documents/:id/generate')
  async generateSections(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<KonzernanhangSection[]> {
    return this.dokumentService.generateAllSections(id);
  }

  /**
   * Create document and generate sections in one step
   * POST /api/konzernanhang/generate/:financialStatementId
   */
  @Post('generate/:financialStatementId')
  async createAndGenerate(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Body() options?: { generatedByUserId?: string; generatedByName?: string },
  ): Promise<{
    document: KonzernanhangDocument;
    sections: KonzernanhangSection[];
  }> {
    const document = await this.dokumentService.createDocument({
      financialStatementId,
      generatedByUserId: options?.generatedByUserId,
      generatedByName: options?.generatedByName,
    });

    const sections = await this.dokumentService.generateAllSections(
      document.id,
    );

    return { document, sections };
  }

  // ==========================================
  // SECTION ENDPOINTS
  // ==========================================

  /**
   * Get all sections for a document
   * GET /api/konzernanhang/documents/:documentId/sections
   */
  @Get('documents/:documentId/sections')
  async getSections(
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ): Promise<KonzernanhangSection[]> {
    return this.dokumentService.getSections(documentId);
  }

  /**
   * Create a new section
   * POST /api/konzernanhang/sections
   */
  @Post('sections')
  async createSection(
    @Body() dto: CreateSectionDto,
  ): Promise<KonzernanhangSection> {
    if (!dto.documentId || !dto.disclosureType || !dto.sectionTitle) {
      throw new BadRequestException(
        'documentId, disclosureType, and sectionTitle are required',
      );
    }
    return this.dokumentService.createSection(dto);
  }

  /**
   * Update a section
   * PUT /api/konzernanhang/sections/:id
   */
  @Put('sections/:id')
  async updateSection(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSectionDto,
  ): Promise<KonzernanhangSection> {
    return this.dokumentService.updateSection(id, dto);
  }

  /**
   * Delete a section
   * DELETE /api/konzernanhang/sections/:id
   */
  @Delete('sections/:id')
  async deleteSection(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    await this.dokumentService.deleteSection(id);
    return { success: true };
  }

  /**
   * Review a section
   * PUT /api/konzernanhang/sections/:id/review
   */
  @Put('sections/:id/review')
  async reviewSection(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    dto: {
      reviewedByUserId: string;
      reviewedByName: string;
      reviewNotes?: string;
    },
  ): Promise<KonzernanhangSection> {
    return this.dokumentService.updateSection(id, {
      status: NoteSectionStatus.REVIEWED,
      reviewedByUserId: dto.reviewedByUserId,
      reviewedByName: dto.reviewedByName,
      reviewNotes: dto.reviewNotes,
    });
  }

  // ==========================================
  // EXPORT ENDPOINTS
  // ==========================================

  /**
   * Export document
   * POST /api/konzernanhang/documents/:id/export
   */
  @Post('documents/:id/export')
  async exportDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExportDocumentDto,
    @Res() res: Response,
  ) {
    if (!dto.format) {
      throw new BadRequestException('format is required');
    }

    const result = await this.exportService.exportDocument(id, dto.format, {
      exportedByUserId: dto.exportedByUserId,
      exportedByName: dto.exportedByName,
      exportPurpose: dto.exportPurpose,
      recipient: dto.recipient,
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );
    res.setHeader('X-Content-Hash', result.contentHash);
    res.send(result.content);
  }

  /**
   * Export as JSON (convenience endpoint)
   * GET /api/konzernanhang/documents/:id/export/json
   */
  @Get('documents/:id/export/json')
  async exportAsJson(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const result = await this.exportService.exportDocument(
      id,
      ExportFormat.JSON,
    );
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );
    res.json(JSON.parse(result.content as string));
  }

  /**
   * Export as text (convenience endpoint)
   * GET /api/konzernanhang/documents/:id/export/text
   */
  @Get('documents/:id/export/text')
  async exportAsText(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const result = await this.exportService.exportDocument(
      id,
      ExportFormat.TEXT,
    );
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );
    res.send(result.content);
  }

  /**
   * Export as HTML (convenience endpoint)
   * GET /api/konzernanhang/documents/:id/export/html
   */
  @Get('documents/:id/export/html')
  async exportAsHtml(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const result = await this.exportService.exportDocument(
      id,
      ExportFormat.HTML,
    );
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );
    res.send(result.content);
  }

  /**
   * Export as Markdown (convenience endpoint)
   * GET /api/konzernanhang/documents/:id/export/markdown
   */
  @Get('documents/:id/export/markdown')
  async exportAsMarkdown(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const result = await this.exportService.exportDocument(
      id,
      ExportFormat.MARKDOWN,
    );
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );
    res.send(result.content);
  }

  /**
   * Get export history
   * GET /api/konzernanhang/documents/:id/exports
   */
  @Get('documents/:id/exports')
  async getExportHistory(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ExportMetadata[]> {
    return this.exportService.getExportHistory(id);
  }

  // ==========================================
  // UTILITY ENDPOINTS
  // ==========================================

  /**
   * Get available disclosure types
   * GET /api/konzernanhang/disclosure-types
   */
  @Get('disclosure-types')
  getDisclosureTypes(): {
    type: DisclosureType;
    label: string;
    hgbSection: string;
  }[] {
    return [
      {
        type: DisclosureType.CONSOLIDATION_SCOPE,
        label: 'Konsolidierungskreis',
        hgbSection: '§ 313 Abs. 2 Nr. 1-3',
      },
      {
        type: DisclosureType.CONSOLIDATION_METHODS,
        label: 'Konsolidierungsgrundsätze',
        hgbSection: '§ 313 Abs. 1 Nr. 1',
      },
      {
        type: DisclosureType.ACCOUNTING_POLICIES,
        label: 'Bilanzierungs- und Bewertungsmethoden',
        hgbSection: '§ 313 Abs. 1 Nr. 2',
      },
      {
        type: DisclosureType.GOODWILL,
        label: 'Geschäfts- oder Firmenwert',
        hgbSection: '§ 313 Abs. 1 Nr. 3',
      },
      {
        type: DisclosureType.MINORITY_INTERESTS,
        label: 'Anteile anderer Gesellschafter',
        hgbSection: '§ 307',
      },
      {
        type: DisclosureType.INTERCOMPANY_TRANSACTIONS,
        label: 'Zwischengesellschaftsgeschäfte',
        hgbSection: '§ 313 Abs. 2 Nr. 5',
      },
      {
        type: DisclosureType.CURRENCY_TRANSLATION,
        label: 'Währungsumrechnung',
        hgbSection: '§ 308a',
      },
      {
        type: DisclosureType.DEFERRED_TAXES,
        label: 'Latente Steuern',
        hgbSection: '§ 306, § 314 Abs. 1 Nr. 21',
      },
      {
        type: DisclosureType.CONTINGENT_LIABILITIES,
        label: 'Eventualverbindlichkeiten',
        hgbSection: '§ 314 Abs. 1 Nr. 2',
      },
      {
        type: DisclosureType.EMPLOYEES,
        label: 'Arbeitnehmer',
        hgbSection: '§ 314 Abs. 1 Nr. 4',
      },
      {
        type: DisclosureType.BOARD_COMPENSATION,
        label: 'Organbezüge',
        hgbSection: '§ 314 Abs. 1 Nr. 6',
      },
      {
        type: DisclosureType.SIGNIFICANT_EVENTS,
        label: 'Wesentliche Ereignisse',
        hgbSection: '§ 314 Abs. 1 Nr. 25',
      },
      {
        type: DisclosureType.SUBSEQUENT_EVENTS,
        label: 'Ereignisse nach dem Bilanzstichtag',
        hgbSection: '§ 314 Abs. 1 Nr. 25',
      },
      {
        type: DisclosureType.RELATED_PARTIES,
        label: 'Nahestehende Unternehmen und Personen',
        hgbSection: '§ 314 Abs. 1 Nr. 13',
      },
      {
        type: DisclosureType.SEGMENT_REPORTING,
        label: 'Segmentberichterstattung',
        hgbSection: '§ 314 Abs. 1 Nr. 3',
      },
    ];
  }

  /**
   * Get available export formats
   * GET /api/konzernanhang/export-formats
   */
  @Get('export-formats')
  getExportFormats(): {
    format: ExportFormat;
    label: string;
    available: boolean;
  }[] {
    return [
      { format: ExportFormat.JSON, label: 'JSON', available: true },
      { format: ExportFormat.TEXT, label: 'Reiner Text', available: true },
      { format: ExportFormat.MARKDOWN, label: 'Markdown', available: true },
      { format: ExportFormat.HTML, label: 'HTML', available: true },
      { format: ExportFormat.PDF, label: 'PDF', available: false },
      {
        format: ExportFormat.WORD_DOCX,
        label: 'Microsoft Word',
        available: false,
      },
      { format: ExportFormat.XBRL, label: 'XBRL', available: false },
    ];
  }
}
