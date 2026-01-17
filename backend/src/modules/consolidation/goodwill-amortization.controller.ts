import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  GoodwillAmortizationService,
  CreateScheduleDto,
  CreateAmortizationDto,
} from './goodwill-amortization.service';

@Controller('goodwill')
export class GoodwillAmortizationController {
  constructor(private goodwillService: GoodwillAmortizationService) {}

  // ==================== SCHEDULES ====================

  /**
   * Create a new schedule
   */
  @Post('schedules')
  async createSchedule(@Body() dto: CreateScheduleDto) {
    const schedule = await this.goodwillService.createSchedule(dto);
    return { success: true, schedule };
  }

  /**
   * Get schedules by parent company
   */
  @Get('schedules/parent/:parentCompanyId')
  async getSchedulesByParent(
    @Param('parentCompanyId') parentCompanyId: string,
  ) {
    const schedules =
      await this.goodwillService.getSchedulesByParent(parentCompanyId);
    return { success: true, schedules };
  }

  /**
   * Get schedule by ID
   */
  @Get('schedules/:id')
  async getScheduleById(@Param('id') id: string) {
    const schedule = await this.goodwillService.getScheduleById(id);
    return { success: true, schedule };
  }

  /**
   * Update schedule
   */
  @Put('schedules/:id')
  async updateSchedule(
    @Param('id') id: string,
    @Body() updates: Partial<CreateScheduleDto>,
  ) {
    const schedule = await this.goodwillService.updateSchedule(id, updates);
    return { success: true, schedule };
  }

  /**
   * Record impairment
   */
  @Post('schedules/:id/impairment')
  async recordImpairment(
    @Param('id') id: string,
    @Body('amount') amount: number,
    @Body('reason') reason: string,
    @Body('date') date?: string,
  ) {
    const schedule = await this.goodwillService.recordImpairment(
      id,
      amount,
      reason,
      date,
    );
    return { success: true, schedule };
  }

  /**
   * Get amortization projection
   */
  @Get('schedules/:id/projection')
  async getProjection(@Param('id') id: string, @Query('years') years?: string) {
    const projection = await this.goodwillService.calculateProjection(
      id,
      years ? parseInt(years) : 10,
    );
    return { success: true, projection };
  }

  // ==================== ENTRIES ====================

  /**
   * Create amortization entry
   */
  @Post('entries')
  async createEntry(@Body() dto: CreateAmortizationDto) {
    const entry = await this.goodwillService.createAmortizationEntry(dto);
    return { success: true, entry };
  }

  /**
   * Get entries by schedule
   */
  @Get('entries/schedule/:scheduleId')
  async getEntriesBySchedule(@Param('scheduleId') scheduleId: string) {
    const entries = await this.goodwillService.getEntriesBySchedule(scheduleId);
    return { success: true, entries };
  }

  /**
   * Book amortization entry
   */
  @Post('entries/:id/book')
  async bookEntry(
    @Param('id') id: string,
    @Body('financialStatementId') financialStatementId: string,
    @Req() req: Request,
  ) {
    const result = await this.goodwillService.bookAmortization(
      id,
      financialStatementId,
      req.user?.id,
    );
    return { success: true, ...result };
  }

  // ==================== SUMMARY ====================

  /**
   * Get goodwill summary for parent company
   */
  @Get('summary/:parentCompanyId')
  async getSummary(@Param('parentCompanyId') parentCompanyId: string) {
    const summary =
      await this.goodwillService.getGoodwillSummary(parentCompanyId);
    return { success: true, summary };
  }
}
