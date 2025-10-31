/**
 * CreateReportBranding Command Handler Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import {
  CreateReportBrandingCommand,
  CreateReportBrandingHandler,
} from './create-report-branding.command';
import { IReportBrandingRepository } from '../../../domain/repositories/report-branding.repository.interface';
import { ReportBranding } from '../../../domain/reporting/report-branding.entity';
import { CompanyInfo } from '../../../domain/reporting/value-objects/company-info.vo';
import { BrandColors } from '../../../domain/reporting/value-objects/brand-colors.vo';

describe('CreateReportBrandingHandler', () => {
  let handler: CreateReportBrandingHandler;
  let mockRepository: jest.Mocked<IReportBrandingRepository>;

  const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';

  const validCompanyInfo = {
    companyName: 'ACME Oil & Gas',
    address: '123 Main Street',
    city: 'Houston',
    state: 'TX',
    zipCode: '77001',
    phone: '713-555-0100',
    email: 'info@acmeoil.com',
    website: 'https://acmeoil.com',
  };

  const validBrandColors = {
    primary: '#1E40AF',
    secondary: '#64748B',
    text: '#1F2937',
    background: '#FFFFFF',
  };

  beforeEach(async () => {
    // Create mock repository
    mockRepository = {
      findByTenantId: jest.fn(),
      save: jest.fn(),
      deleteByTenantId: jest.fn(),
      exists: jest.fn(),
    };

    // Create testing module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateReportBrandingHandler,
        {
          provide: 'IReportBrandingRepository',
          useValue: mockRepository,
        },
      ],
    }).compile();

    handler = module.get<CreateReportBrandingHandler>(
      CreateReportBrandingHandler,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should create new branding with company info only', async () => {
      // Arrange: No existing branding
      mockRepository.findByTenantId.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(undefined);

      const command = new CreateReportBrandingCommand(
        TENANT_ID,
        validCompanyInfo,
        undefined,
        undefined,
        undefined,
      );

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.success).toBe(true);
      expect(result.brandingId).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.findByTenantId).toHaveBeenCalledWith(TENANT_ID);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.any(ReportBranding),
      );

      // Verify saved entity
      const savedBranding = mockRepository.save.mock.calls[0][0];
      expect(savedBranding.tenantId).toBe(TENANT_ID);
      expect(savedBranding.companyInfo).toBeInstanceOf(CompanyInfo);
      expect(savedBranding.companyInfo.companyName).toBe('ACME Oil & Gas');
      expect(savedBranding.brandColors).toEqual(BrandColors.DEFAULT);
      expect(savedBranding.logoAsset).toBeNull();
    });

    it('should create branding with custom brand colors', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(undefined);

      const command = new CreateReportBrandingCommand(
        TENANT_ID,
        validCompanyInfo,
        validBrandColors,
        undefined,
        undefined,
      );

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.success).toBe(true);
      const savedBranding = mockRepository.save.mock.calls[0][0];
      expect(savedBranding.brandColors).toBeInstanceOf(BrandColors);
      expect(savedBranding.brandColors.primary).toBe('#1E40AF');
    });

    it('should create branding with custom header and footer text', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(undefined);

      const command = new CreateReportBrandingCommand(
        TENANT_ID,
        validCompanyInfo,
        undefined,
        'Custom Header Text',
        'Custom Footer Text',
      );

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.success).toBe(true);
      const savedBranding = mockRepository.save.mock.calls[0][0];
      expect(savedBranding.headerText).toBe('Custom Header Text');
      expect(savedBranding.footerText).toBe('Custom Footer Text');
    });

    it('should throw ConflictException when branding already exists', async () => {
      // Arrange: Existing branding
      const existingBranding = ReportBranding.create({
        tenantId: TENANT_ID,
        companyInfo: CompanyInfo.create(validCompanyInfo),
      });
      mockRepository.findByTenantId.mockResolvedValue(existingBranding);

      const command = new CreateReportBrandingCommand(
        TENANT_ID,
        validCompanyInfo,
        undefined,
        undefined,
        undefined,
      );

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(ConflictException);
      await expect(handler.execute(command)).rejects.toThrow(
        'Report branding already exists for tenant',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should handle null optional fields in company info', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(undefined);

      const companyInfoWithNulls = {
        companyName: 'ACME Oil & Gas',
        address: '123 Main Street',
        city: 'Houston',
        state: 'TX',
        zipCode: '77001',
        phone: undefined,
        email: undefined,
        website: undefined,
      };

      const command = new CreateReportBrandingCommand(
        TENANT_ID,
        companyInfoWithNulls,
        undefined,
        undefined,
        undefined,
      );

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.success).toBe(true);
      const savedBranding = mockRepository.save.mock.calls[0][0];
      expect(savedBranding.companyInfo.phone).toBeNull();
      expect(savedBranding.companyInfo.email).toBeNull();
      expect(savedBranding.companyInfo.website).toBeNull();
    });

    it('should propagate repository errors', async () => {
      // Arrange: Repository save error
      mockRepository.findByTenantId.mockResolvedValue(null);
      mockRepository.save.mockRejectedValue(
        new Error('Database connection failed'),
      );

      const command = new CreateReportBrandingCommand(
        TENANT_ID,
        validCompanyInfo,
        undefined,
        undefined,
        undefined,
      );

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should validate company info through value object creation', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(null);

      const invalidCompanyInfo = {
        companyName: 'A', // Too short (< 2 characters)
        address: '123 Main Street',
        city: 'Houston',
        state: 'TX',
        zipCode: '77001',
      };

      const command = new CreateReportBrandingCommand(
        TENANT_ID,
        invalidCompanyInfo,
        undefined,
        undefined,
        undefined,
      );

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        'Company name must be at least 2 characters',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should validate brand colors through value object creation', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(null);

      const invalidBrandColors = {
        primary: 'blue', // Invalid hex format
        secondary: '#64748B',
        text: '#1F2937',
        background: '#FFFFFF',
      };

      const command = new CreateReportBrandingCommand(
        TENANT_ID,
        validCompanyInfo,
        invalidBrandColors,
        undefined,
        undefined,
      );

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        'Invalid primary color format',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should validate header text length through entity creation', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(null);

      const command = new CreateReportBrandingCommand(
        TENANT_ID,
        validCompanyInfo,
        undefined,
        'A'.repeat(501), // Exceeds 500 character limit
        undefined,
      );

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        'Header text must not exceed 500 characters',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });
});
