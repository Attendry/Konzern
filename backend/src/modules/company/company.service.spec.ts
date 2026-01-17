import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { CompanyService } from './company.service';
import { Company } from '../../entities/company.entity';

describe('CompanyService', () => {
  let service: CompanyService;
  let repository: Repository<Company>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyService,
        {
          provide: getRepositoryToken(Company),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<CompanyService>(CompanyService);
    repository = module.get<Repository<Company>>(getRepositoryToken(Company));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new company', async () => {
      const createDto = {
        name: 'Test Company',
        taxId: '12345',
        isConsolidated: true,
      };

      const mockCompany = { id: 'company-id', ...createDto };
      mockRepository.create.mockReturnValue(mockCompany);
      mockRepository.save.mockResolvedValue(mockCompany);

      const result = await service.create(createDto);

      expect(result).toEqual(mockCompany);
      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockRepository.save).toHaveBeenCalledWith(mockCompany);
    });
  });

  describe('findAll', () => {
    it('should return all companies', async () => {
      const mockCompanies = [
        { id: '1', name: 'Company 1' },
        { id: '2', name: 'Company 2' },
      ];

      mockRepository.find.mockResolvedValue(mockCompanies);

      const result = await service.findAll();

      expect(result).toEqual(mockCompanies);
      expect(mockRepository.find).toHaveBeenCalledWith({
        relations: ['parentCompany', 'children'],
        order: { name: 'ASC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a company by id', async () => {
      const companyId = 'company-id';
      const mockCompany = { id: companyId, name: 'Test Company' };

      mockRepository.findOne.mockResolvedValue(mockCompany);

      const result = await service.findOne(companyId);

      expect(result).toEqual(mockCompany);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: companyId },
        relations: ['parentCompany', 'children', 'financialStatements'],
      });
    });

    it('should throw NotFoundException if company not found', async () => {
      const companyId = 'non-existent-id';
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(companyId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a company', async () => {
      const companyId = 'company-id';
      const updateDto = { name: 'Updated Company' };
      const existingCompany = {
        id: companyId,
        name: 'Original Company',
        updatedAt: new Date(),
      };
      const updatedCompany = { ...existingCompany, ...updateDto };

      mockRepository.findOne.mockResolvedValue(existingCompany);
      mockRepository.save.mockResolvedValue(updatedCompany);

      const result = await service.update(companyId, updateDto);

      expect(result).toEqual(updatedCompany);
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove a company', async () => {
      const companyId = 'company-id';
      const mockCompany = { id: companyId, name: 'Test Company' };

      mockRepository.findOne.mockResolvedValue(mockCompany);
      mockRepository.remove.mockResolvedValue(mockCompany);

      await service.remove(companyId);

      expect(mockRepository.remove).toHaveBeenCalledWith(mockCompany);
    });
  });
});
