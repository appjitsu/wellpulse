/**
 * GetReportBranding Query Handler Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  GetReportBrandingQuery,
  GetReportBrandingHandler,
} from './get-report-branding.query';
import { IReportBrandingRepository } from '../../../domain/repositories/report-branding.repository.interface';
import { ReportBranding } from '../../../domain/reporting/report-branding.entity';
import { CompanyInfo } from '../../../domain/reporting/value-objects/company-info.vo';
import { BrandColors } from '../../../domain/reporting/value-objects/brand-colors.vo';
import { LogoAsset } from '../../../domain/reporting/value-objects/logo-asset.vo';

describe('GetReportBrandingHandler', () => {
  let handler: GetReportBrandingHandler;
  let mockRepository: jest.Mocked<IReportBrandingRepository>;

  const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';

  const fullBranding = ReportBranding.reconstitute({
    id: 'branding-123',
    tenantId: TENANT_ID,
    companyInfo: CompanyInfo.create({
      companyName: 'ACME Oil & Gas',
      address: '123 Main Street',
      city: 'Houston',
      state: 'TX',
      zipCode: '77001',
      phone: '713-555-0100',
      email: 'info@acmeoil.com',
      website: 'https://acmeoil.com',
    }),
    brandColors: BrandColors.create({
      primary: '#1E40AF',
      secondary: '#64748B',
      text: '#1F2937',
      background: '#FFFFFF',
    }),
    logoAsset: LogoAsset.create({
      blobUrl: 'https://storage.azure.com/logos/acme-logo.png',
      fileName: 'acme-logo.png',
      mimeType: 'image/png',
      sizeBytes: 500000,
      width: 800,
      height: 200,
      uploadedAt: new Date('2025-01-15T10:00:00Z'),
    }),
    headerText: 'Custom Header',
    footerText: 'Custom Footer',
    createdAt: new Date('2025-01-15T08:00:00Z'),
    updatedAt: new Date('2025-01-15T12:00:00Z'),
  });

  const minimalBranding = ReportBranding.create({
    tenantId: TENANT_ID,
    companyInfo: CompanyInfo.create({
      companyName: 'Minimal Company',
      address: '456 Oak Avenue',
      city: 'Dallas',
      state: 'TX',
      zipCode: '75001',
      phone: null,
      email: null,
      website: null,
    }),
  });

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
        GetReportBrandingHandler,
        {
          provide: 'IReportBrandingRepository',
          useValue: mockRepository,
        },
      ],
    }).compile();

    handler = module.get<GetReportBrandingHandler>(GetReportBrandingHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return branding DTO when branding exists', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(fullBranding);

      const query = new GetReportBrandingQuery(TENANT_ID);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe('branding-123');
      expect(result?.tenantId).toBe(TENANT_ID);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.findByTenantId).toHaveBeenCalledWith(TENANT_ID);
    });

    it('should return null when branding does not exist', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(null);

      const query = new GetReportBrandingQuery(TENANT_ID);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result).toBeNull();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.findByTenantId).toHaveBeenCalledWith(TENANT_ID);
    });

    it('should convert company info to DTO format', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(fullBranding);

      const query = new GetReportBrandingQuery(TENANT_ID);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result?.companyInfo).toEqual({
        companyName: 'ACME Oil & Gas',
        address: '123 Main Street',
        city: 'Houston',
        state: 'TX',
        zipCode: '77001',
        phone: '713-555-0100',
        email: 'info@acmeoil.com',
        website: 'https://acmeoil.com',
      });
    });

    it('should convert brand colors to DTO format', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(fullBranding);

      const query = new GetReportBrandingQuery(TENANT_ID);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result?.brandColors).toEqual({
        primary: '#1E40AF',
        secondary: '#64748B',
        text: '#1F2937',
        background: '#FFFFFF',
      });
    });

    it('should convert logo asset to DTO format when present', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(fullBranding);

      const query = new GetReportBrandingQuery(TENANT_ID);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result?.logoAsset).toEqual({
        blobUrl: 'https://storage.azure.com/logos/acme-logo.png',
        fileName: 'acme-logo.png',
        mimeType: 'image/png',
        sizeBytes: 500000,
        width: 800,
        height: 200,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        uploadedAt: expect.any(Date),
      });
    });

    it('should return null for logo asset when not present', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(minimalBranding);

      const query = new GetReportBrandingQuery(TENANT_ID);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result?.logoAsset).toBeNull();
    });

    it('should include effective header and footer text', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(fullBranding);

      const query = new GetReportBrandingQuery(TENANT_ID);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result?.effectiveHeaderText).toBe('Custom Header');
      expect(result?.effectiveFooterText).toBe('Custom Footer');
    });

    it('should include default header and footer text when not customized', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(minimalBranding);

      const query = new GetReportBrandingQuery(TENANT_ID);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result?.effectiveHeaderText).toBe('Minimal Company Report');
      expect(result?.effectiveFooterText).toBe('Generated by WellPulse');
    });

    it('should include hasLogo flag', async () => {
      // Arrange: With logo
      mockRepository.findByTenantId.mockResolvedValue(fullBranding);

      const query = new GetReportBrandingQuery(TENANT_ID);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result?.hasLogo).toBe(true);
    });

    it('should set hasLogo to false when no logo', async () => {
      // Arrange: Without logo
      mockRepository.findByTenantId.mockResolvedValue(minimalBranding);

      const query = new GetReportBrandingQuery(TENANT_ID);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result?.hasLogo).toBe(false);
    });

    it('should include isComplete flag', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(fullBranding);

      const query = new GetReportBrandingQuery(TENANT_ID);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result?.isComplete).toBe(true);
    });

    it('should include timestamp metadata', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(fullBranding);

      const query = new GetReportBrandingQuery(TENANT_ID);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result?.createdAt).toEqual(new Date('2025-01-15T08:00:00Z'));
      expect(result?.updatedAt).toEqual(new Date('2025-01-15T12:00:00Z'));
    });

    it('should handle null optional fields in company info', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(minimalBranding);

      const query = new GetReportBrandingQuery(TENANT_ID);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result?.companyInfo.phone).toBeNull();
      expect(result?.companyInfo.email).toBeNull();
      expect(result?.companyInfo.website).toBeNull();
    });

    it('should propagate repository errors', async () => {
      // Arrange
      mockRepository.findByTenantId.mockRejectedValue(
        new Error('Database connection failed'),
      );

      const query = new GetReportBrandingQuery(TENANT_ID);

      // Act & Assert
      await expect(handler.execute(query)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });
});
