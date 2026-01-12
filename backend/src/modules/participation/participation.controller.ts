import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ParticipationService } from '../company/participation.service';
import { CreateParticipationDto } from './dto/participation.dto';

@Controller('participations')
export class ParticipationController {
  constructor(private readonly participationService: ParticipationService) {}

  @Get('parent/:parentCompanyId')
  async getByParentCompany(@Param('parentCompanyId', ParseUUIDPipe) parentCompanyId: string) {
    return this.participationService.getByParentCompany(parentCompanyId);
  }

  @Get('subsidiary/:subsidiaryCompanyId')
  async getBySubsidiaryCompany(@Param('subsidiaryCompanyId', ParseUUIDPipe) subsidiaryCompanyId: string) {
    return this.participationService.getBySubsidiaryCompany(subsidiaryCompanyId);
  }

  @Post()
  async createOrUpdate(@Body() dto: CreateParticipationDto) {
    return this.participationService.createOrUpdate({
      parentCompanyId: dto.parentCompanyId,
      subsidiaryCompanyId: dto.subsidiaryCompanyId,
      participationPercentage: dto.participationPercentage,
      acquisitionCost: dto.acquisitionCost,
      acquisitionDate: dto.acquisitionDate ? new Date(dto.acquisitionDate) : undefined,
    });
  }

  @Get(':id/book-value')
  async calculateBookValue(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ) {
    return this.participationService.calculateBookValue(id, financialStatementId);
  }

  @Get(':id/missing-info')
  async checkMissingInformation(@Param('id', ParseUUIDPipe) id: string) {
    return this.participationService.checkMissingInformation(id);
  }
}
