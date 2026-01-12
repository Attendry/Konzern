import { Module } from '@nestjs/common';
import { FinancialStatementService } from './financial-statement.service';
import { FinancialStatementController } from './financial-statement.controller';

@Module({
  controllers: [FinancialStatementController],
  providers: [FinancialStatementService],
  exports: [FinancialStatementService],
})
export class FinancialStatementModule {}
