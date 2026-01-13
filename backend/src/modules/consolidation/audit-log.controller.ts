import {
  Controller,
  Get,
  Query,
  Param,
} from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditAction, AuditEntityType } from '../../entities/audit-log.entity';

@Controller('api/audit')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * Get audit logs with filtering
   */
  @Get('logs')
  async getAuditLogs(
    @Query('userId') userId?: string,
    @Query('entityType') entityType?: AuditEntityType,
    @Query('entityId') entityId?: string,
    @Query('action') action?: AuditAction,
    @Query('financialStatementId') financialStatementId?: string,
    @Query('companyId') companyId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.auditLogService.getAuditLogs({
      userId,
      entityType,
      entityId,
      action,
      financialStatementId,
      companyId,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  /**
   * Get audit trail for a specific entity
   */
  @Get('entity/:entityType/:entityId')
  async getEntityAuditTrail(
    @Param('entityType') entityType: AuditEntityType,
    @Param('entityId') entityId: string,
  ) {
    return this.auditLogService.getEntityAuditTrail(entityType, entityId);
  }

  /**
   * Get user activity
   */
  @Get('user/:userId')
  async getUserActivity(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditLogService.getUserActivity(userId, limit ? parseInt(limit) : undefined);
  }

  /**
   * Get financial statement activity
   */
  @Get('financial-statement/:financialStatementId')
  async getFinancialStatementActivity(
    @Param('financialStatementId') financialStatementId: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditLogService.getFinancialStatementActivity(
      financialStatementId,
      limit ? parseInt(limit) : undefined,
    );
  }
}
