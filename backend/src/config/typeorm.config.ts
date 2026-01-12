import { Injectable } from '@nestjs/common';
import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Company } from '../entities/company.entity';
import { FinancialStatement } from '../entities/financial-statement.entity';
import { Account } from '../entities/account.entity';
import { AccountBalance } from '../entities/account-balance.entity';
import { ConsolidationEntry } from '../entities/consolidation-entry.entity';
import { IntercompanyTransaction } from '../entities/intercompany-transaction.entity';

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: this.configService.get<string>('DB_HOST'),
      port: this.configService.get<number>('DB_PORT') || 5432,
      username: this.configService.get<string>('DB_USERNAME'),
      password: this.configService.get<string>('DB_PASSWORD'),
      database: this.configService.get<string>('DB_DATABASE'),
      entities: [
        Company,
        FinancialStatement,
        Account,
        AccountBalance,
        ConsolidationEntry,
        IntercompanyTransaction,
      ],
      synchronize: this.configService.get<string>('NODE_ENV') === 'development',
      logging: this.configService.get<string>('NODE_ENV') === 'development',
      ssl: {
        rejectUnauthorized: false, // Für Supabase SSL-Verbindung
      },
    };
  }
}
