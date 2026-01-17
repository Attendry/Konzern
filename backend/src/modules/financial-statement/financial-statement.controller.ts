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
import { FinancialStatementService } from './financial-statement.service';
import { CreateFinancialStatementDto } from './dto/create-financial-statement.dto';
import { UpdateFinancialStatementDto } from './dto/update-financial-statement.dto';

@Controller('financial-statements')
export class FinancialStatementController {
  constructor(
    private readonly financialStatementService: FinancialStatementService,
  ) {}

  @Post()
  create(@Body() createFinancialStatementDto: CreateFinancialStatementDto) {
    return this.financialStatementService.create(createFinancialStatementDto);
  }

  @Get()
  findAll() {
    return this.financialStatementService.findAll();
  }

  @Get('company/:companyId')
  findByCompanyId(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.financialStatementService.findByCompanyId(companyId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.financialStatementService.findOne(id);
  }

  @Get(':id/balances')
  findBalances(@Param('id', ParseUUIDPipe) id: string) {
    return this.financialStatementService.findBalances(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateFinancialStatementDto: UpdateFinancialStatementDto,
  ) {
    return this.financialStatementService.update(
      id,
      updateFinancialStatementDto,
    );
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.financialStatementService.remove(id);
  }
}
