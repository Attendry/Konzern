import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ParticipationService } from './participation.service';
import {
  CreateParticipationDto,
  UpdateParticipationDto,
  RecordOwnershipChangeDto,
} from './dto/participation.dto';

@Controller('participations')
export class ParticipationController {
  constructor(private readonly participationService: ParticipationService) {}

  @Get()
  async findAll() {
    return this.participationService.findAll();
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.participationService.findById(id);
  }

  @Get('parent/:parentCompanyId')
  async findByParentCompany(
    @Param('parentCompanyId', ParseUUIDPipe) parentCompanyId: string,
  ) {
    return this.participationService.findByParentCompany(parentCompanyId);
  }

  @Get('subsidiary/:subsidiaryCompanyId')
  async findBySubsidiaryCompany(
    @Param('subsidiaryCompanyId', ParseUUIDPipe) subsidiaryCompanyId: string,
  ) {
    return this.participationService.findBySubsidiaryCompany(
      subsidiaryCompanyId,
    );
  }

  @Post()
  async create(@Body() dto: CreateParticipationDto) {
    return this.participationService.create(dto);
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateParticipationDto,
  ) {
    return this.participationService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.participationService.delete(id);
  }

  @Get(':id/history')
  async getOwnershipHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.participationService.getOwnershipHistory(id);
  }

  @Post(':id/ownership-change')
  async recordOwnershipChange(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordOwnershipChangeDto,
  ) {
    return this.participationService.recordOwnershipChange(id, dto);
  }
}
