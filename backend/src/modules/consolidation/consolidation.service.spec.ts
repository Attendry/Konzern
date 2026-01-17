import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConsolidationService } from './consolidation.service';
import { FinancialStatement } from '../../entities/financial-statement.entity';
import { AccountBalance } from '../../entities/account-balance.entity';
import { ConsolidationEntry } from '../../entities/consolidation-entry.entity';
import { Company } from '../../entities/company.entity';
import { IntercompanyTransaction } from '../../entities/intercompany-transaction.entity';

describe('ConsolidationService', () => {
  let service: ConsolidationService;
  let financialStatementRepo: Repository<FinancialStatement>;
  let accountBalanceRepo: Repository<AccountBalance>;
  let consolidationEntryRepo: Repository<ConsolidationEntry>;
  let companyRepo: Repository<Company>;
  let intercompanyTransactionRepo: Repository<IntercompanyTransaction>;

  const mockFinancialStatementRepo = {
    findOne: jest.fn(),
  };

  const mockAccountBalanceRepo = {
    find: jest.fn(),
  };

  const mockConsolidationEntryRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockCompanyRepo = {
    find: jest.fn(),
  };

  const mockIntercompanyTransactionRepo = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsolidationService,
        {
          provide: getRepositoryToken(FinancialStatement),
          useValue: mockFinancialStatementRepo,
        },
        {
          provide: getRepositoryToken(AccountBalance),
          useValue: mockAccountBalanceRepo,
        },
        {
          provide: getRepositoryToken(ConsolidationEntry),
          useValue: mockConsolidationEntryRepo,
        },
        {
          provide: getRepositoryToken(Company),
          useValue: mockCompanyRepo,
        },
        {
          provide: getRepositoryToken(IntercompanyTransaction),
          useValue: mockIntercompanyTransactionRepo,
        },
      ],
    }).compile();

    service = module.get<ConsolidationService>(ConsolidationService);
    financialStatementRepo = module.get<Repository<FinancialStatement>>(
      getRepositoryToken(FinancialStatement),
    );
    accountBalanceRepo = module.get<Repository<AccountBalance>>(
      getRepositoryToken(AccountBalance),
    );
    consolidationEntryRepo = module.get<Repository<ConsolidationEntry>>(
      getRepositoryToken(ConsolidationEntry),
    );
    companyRepo = module.get<Repository<Company>>(getRepositoryToken(Company));
    intercompanyTransactionRepo = module.get<
      Repository<IntercompanyTransaction>
    >(getRepositoryToken(IntercompanyTransaction));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateConsolidation', () => {
    it('should throw NotFoundException if financial statement not found', async () => {
      const financialStatementId = 'test-id';
      mockFinancialStatementRepo.findOne.mockResolvedValue(null);

      await expect(
        service.calculateConsolidation(financialStatementId),
      ).rejects.toThrow('Financial statement with ID test-id not found');
    });

    it('should calculate consolidation successfully', async () => {
      const financialStatementId = 'test-id';
      const mockCompany = {
        id: 'company-id',
        name: 'Test Company',
        isConsolidated: true,
      };

      const mockFinancialStatement = {
        id: financialStatementId,
        companyId: 'company-id',
        company: mockCompany,
      };

      mockFinancialStatementRepo.findOne.mockResolvedValue(
        mockFinancialStatement,
      );
      mockCompanyRepo.find.mockResolvedValue([mockCompany]);
      mockAccountBalanceRepo.find.mockResolvedValue([]);
      mockIntercompanyTransactionRepo.find.mockResolvedValue([]);
      mockConsolidationEntryRepo.save.mockImplementation((entry) =>
        Promise.resolve(entry),
      );
      mockConsolidationEntryRepo.create.mockImplementation((data) => data);

      const result = await service.calculateConsolidation(financialStatementId);

      expect(result).toHaveProperty('entries');
      expect(result).toHaveProperty('summary');
      expect(result.summary).toHaveProperty('totalEntries');
      expect(result.summary).toHaveProperty('intercompanyEliminations');
      expect(result.summary).toHaveProperty('debtConsolidations');
      expect(result.summary).toHaveProperty('capitalConsolidations');
    });
  });

  describe('getConsolidationEntries', () => {
    it('should return consolidation entries for a financial statement', async () => {
      const financialStatementId = 'test-id';
      const mockEntries = [
        {
          id: 'entry-1',
          financialStatementId,
          amount: 1000,
        },
      ];

      mockConsolidationEntryRepo.find.mockResolvedValue(mockEntries);

      const result =
        await service.getConsolidationEntries(financialStatementId);

      expect(result).toEqual(mockEntries);
      expect(mockConsolidationEntryRepo.find).toHaveBeenCalledWith({
        where: { financialStatementId },
        relations: ['account'],
        order: { createdAt: 'ASC' },
      });
    });
  });

  describe('createConsolidationEntry', () => {
    it('should create a new consolidation entry', async () => {
      const createDto = {
        financialStatementId: 'test-id',
        accountId: 'account-id',
        adjustmentType: 'elimination' as any,
        amount: 1000,
        description: 'Test entry',
      };

      const mockEntry = { id: 'entry-id', ...createDto };
      mockConsolidationEntryRepo.create.mockReturnValue(mockEntry);
      mockConsolidationEntryRepo.save.mockResolvedValue(mockEntry);

      const result = await service.createConsolidationEntry(createDto);

      expect(result).toEqual(mockEntry);
      expect(mockConsolidationEntryRepo.create).toHaveBeenCalledWith(createDto);
      expect(mockConsolidationEntryRepo.save).toHaveBeenCalledWith(mockEntry);
    });
  });
});
