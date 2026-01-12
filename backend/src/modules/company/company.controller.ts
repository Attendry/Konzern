import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CompanyService } from './company.service';
import { DependencyIdentificationService } from './dependency-identification.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Controller('companies')
export class CompanyController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly dependencyService: DependencyIdentificationService,
  ) {}

  @Post()
  async create(@Body() createCompanyDto: CreateCompanyDto) {
    console.log('POST /companies - Creating company:', JSON.stringify(createCompanyDto, null, 2));
    try {
      const result = await this.companyService.create(createCompanyDto);
      console.log('POST /companies - Company created successfully:', result.id, result.name);
      return result;
    } catch (error: any) {
      console.error('POST /companies - Error creating company:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        response: error.response,
        stack: error.stack,
      });
      throw error;
    }
  }

  @Get()
  async findAll() {
    try {
      console.log('GET /companies - Request received');
      const result = await this.companyService.findAll();
      console.log('GET /companies - Returning', result.length, 'companies');
      return result;
    } catch (error: any) {
      console.error('GET /companies - Error:', error.message);
      throw error;
    }
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.companyService.findOne(id);
  }

  @Get(':id/children')
  findChildren(@Param('id', ParseUUIDPipe) id: string) {
    return this.companyService.findChildren(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
  ) {
    return this.companyService.update(id, updateCompanyDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.companyService.remove(id);
  }

  // Abhängigkeits-Identifikation Endpoints
  @Get('hierarchy/all')
  async getCompanyHierarchy() {
    return this.dependencyService.buildCompanyHierarchy();
  }

  @Get('hierarchy/parents')
  async getParentCompanies() {
    return this.dependencyService.identifyParentCompanies();
  }

  @Get('hierarchy/subsidiaries')
  async getSubsidiaries() {
    return this.dependencyService.identifySubsidiaries();
  }

  @Get(':id/consolidation-circle')
  async getConsolidationCircle(@Param('id', ParseUUIDPipe) id: string) {
    return this.dependencyService.determineConsolidationCircle(id);
  }

  @Get(':id/missing-info')
  async checkMissingInfo(@Param('id', ParseUUIDPipe) id: string) {
    return this.dependencyService.checkMissingHierarchyInformation(id);
  }
}
