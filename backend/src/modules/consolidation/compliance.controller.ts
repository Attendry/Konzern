import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ComplianceChecklistService, ComplianceSummary } from './compliance-checklist.service';
import { ChecklistItemStatus, ComplianceCategory } from '../../entities/compliance-checklist.entity';

class UpdateChecklistItemDto {
  status?: ChecklistItemStatus;
  notes?: string;
  evidence?: string;
  relatedEntityIds?: string[];
  completedByUserId?: string;
  dueDate?: string;
}

class CompleteItemDto {
  userId: string;
  notes?: string;
  evidence?: string;
}

class AddCustomItemDto {
  itemCode: string;
  description: string;
  category: ComplianceCategory;
  hgbReference?: string;
  requirement?: string;
  isMandatory?: boolean;
  priority?: number;
  dueDate?: string;
}

@Controller('compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceChecklistService) {}

  /**
   * Initialize checklist for a financial statement
   */
  @Post('initialize/:financialStatementId')
  async initializeChecklist(
    @Param('financialStatementId') financialStatementId: string,
  ) {
    return this.complianceService.initializeChecklist(financialStatementId);
  }

  /**
   * Get checklist for a financial statement
   */
  @Get(':financialStatementId')
  async getChecklist(
    @Param('financialStatementId') financialStatementId: string,
  ) {
    return this.complianceService.getChecklist(financialStatementId);
  }

  /**
   * Get checklist items by category
   */
  @Get(':financialStatementId/category/:category')
  async getChecklistByCategory(
    @Param('financialStatementId') financialStatementId: string,
    @Param('category') category: ComplianceCategory,
  ) {
    return this.complianceService.getChecklistByCategory(financialStatementId, category);
  }

  /**
   * Get compliance summary
   */
  @Get('summary/:financialStatementId')
  async getComplianceSummary(
    @Param('financialStatementId') financialStatementId: string,
  ): Promise<ComplianceSummary> {
    return this.complianceService.getComplianceSummary(financialStatementId);
  }

  /**
   * Update a checklist item
   */
  @Put('item/:id')
  async updateChecklistItem(
    @Param('id') id: string,
    @Body() dto: UpdateChecklistItemDto,
  ) {
    return this.complianceService.updateChecklistItem(id, dto);
  }

  /**
   * Complete a checklist item
   */
  @Post('item/:id/complete')
  async completeItem(
    @Param('id') id: string,
    @Body() dto: CompleteItemDto,
  ) {
    return this.complianceService.completeItem(id, dto.userId, dto.notes, dto.evidence);
  }

  /**
   * Mark item for review
   */
  @Post('item/:id/review')
  async markForReview(
    @Param('id') id: string,
    @Body('reviewerId') reviewerId: string,
  ) {
    return this.complianceService.markForReview(id, reviewerId);
  }

  /**
   * Auto-update checklist from consolidation entries
   */
  @Post('auto-update/:financialStatementId')
  async autoUpdateFromConsolidation(
    @Param('financialStatementId') financialStatementId: string,
  ) {
    await this.complianceService.autoUpdateFromConsolidation(financialStatementId);
    return { message: 'Checkliste automatisch aktualisiert' };
  }

  /**
   * Add custom checklist item
   */
  @Post(':financialStatementId/custom')
  async addCustomItem(
    @Param('financialStatementId') financialStatementId: string,
    @Body() dto: AddCustomItemDto,
  ) {
    return this.complianceService.addCustomItem(
      financialStatementId,
      dto.itemCode,
      dto.description,
      dto.category,
      dto.hgbReference,
      dto.requirement,
      dto.isMandatory,
      dto.priority,
      dto.dueDate,
    );
  }

  /**
   * Delete a custom checklist item
   */
  @Delete('item/:id')
  async deleteItem(@Param('id') id: string) {
    await this.complianceService.deleteItem(id);
    return { message: 'Checklisten-Eintrag erfolgreich gelöscht' };
  }
}
