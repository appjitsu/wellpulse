/**
 * RemoveLogo Command Handler Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RemoveLogoCommand, RemoveLogoHandler } from './remove-logo.command';
import { IReportBrandingRepository } from '../../../domain/repositories/report-branding.repository.interface';
import { ReportBranding } from '../../../domain/reporting/report-branding.entity';
import { CompanyInfo } from '../../../domain/reporting/value-objects/company-info.vo';
import { BrandColors } from '../../../domain/reporting/value-objects/brand-colors.vo';
import { LogoAsset } from '../../../domain/reporting/value-objects/logo-asset.vo';

describe('RemoveLogoHandler', () => {
  let handler: RemoveLogoHandler;
  let mockRepository: jest.Mocked<IReportBrandingRepository>;

  const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';

  const brandingWithLogo = ReportBranding.reconstitute({
    id: 'branding-123',
    tenantId: TENANT_ID,
    companyInfo: CompanyInfo.create({
      companyName: 'ACME Oil & Gas',
      address: '123 Main Street',
      city: 'Houston',
      state: 'TX',
      zipCode: '77001',
      phone: null,
      email: null,
      website: null,
    }),
    brandColors: ReportBranding.create({
      tenantId: TENANT_ID,
      companyInfo: CompanyInfo.create({
        companyName: 'ACME Oil & Gas',
        address: '123 Main Street',
        city: 'Houston',
        state: 'TX',
        zipCode: '77001',
        phone: null,
        email: null,
        website: null,
      }),
    }).brandColors,
    logoAsset: LogoAsset.create({
      blobUrl: 'https://storage.azure.com/logos/acme-logo.png',
      fileName: 'acme-logo.png',
      mimeType: 'image/png',
      sizeBytes: 500000,
      width: 800,
      height: 200,
      uploadedAt: new Date('2025-01-15T10:00:00Z'),
    }),
    headerText: undefined,
    footerText: undefined,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-15T10:00:00Z'),
  });

  const brandingWithoutLogo = ReportBranding.create({
    tenantId: TENANT_ID,
    companyInfo: CompanyInfo.create({
      companyName: 'ACME Oil & Gas',
      address: '123 Main Street',
      city: 'Houston',
      state: 'TX',
      zipCode: '77001',
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
        RemoveLogoHandler,
        {
          provide: 'IReportBrandingRepository',
          useValue: mockRepository,
        },
      ],
    }).compile();

    handler = module.get<RemoveLogoHandler>(RemoveLogoHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should remove logo from branding', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(brandingWithLogo);
      mockRepository.save.mockResolvedValue(undefined);

      const command = new RemoveLogoCommand(TENANT_ID);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.success).toBe(true);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.findByTenantId).toHaveBeenCalledWith(TENANT_ID);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.save).toHaveBeenCalled();

      const savedBranding = mockRepository.save.mock.calls[0][0];
      expect(savedBranding.hasLogo()).toBe(false);
      expect(savedBranding.logoAsset).toBeNull();
    });

    it('should not error when removing non-existent logo', async () => {
      // Arrange: Branding without logo
      mockRepository.findByTenantId.mockResolvedValue(brandingWithoutLogo);
      mockRepository.save.mockResolvedValue(undefined);

      const command = new RemoveLogoCommand(TENANT_ID);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('No logo to remove');
      // Handler returns early without calling save when no logo exists
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when branding does not exist', async () => {
      // Arrange: No existing branding
      mockRepository.findByTenantId.mockResolvedValue(null);

      const command = new RemoveLogoCommand(TENANT_ID);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
      await expect(handler.execute(command)).rejects.toThrow(
        'No branding configuration found for tenant',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should preserve other branding properties when removing logo', async () => {
      // Arrange: Create fresh branding instance with custom header/footer and logo
      const customBranding = ReportBranding.reconstitute({
        id: 'branding-456',
        tenantId: TENANT_ID,
        companyInfo: CompanyInfo.create({
          companyName: 'Custom Company',
          address: '789 Pine Street',
          city: 'Austin',
          state: 'TX',
          zipCode: '78701',
          phone: null,
          email: null,
          website: null,
        }),
        brandColors: BrandColors.create({
          primary: '#FF0000',
          secondary: '#00FF00',
          text: '#000000',
          background: '#FFFFFF',
        }),
        logoAsset: LogoAsset.create({
          blobUrl: 'https://storage.azure.com/logos/custom-logo.png',
          fileName: 'custom-logo.png',
          mimeType: 'image/png',
          sizeBytes: 400000,
          width: 700,
          height: 175,
          uploadedAt: new Date('2025-01-10T00:00:00Z'),
        }),
        headerText: 'Custom Header',
        footerText: 'Custom Footer',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-10T10:00:00Z'),
      });

      mockRepository.findByTenantId.mockResolvedValue(customBranding);
      mockRepository.save.mockResolvedValue(undefined);

      const command = new RemoveLogoCommand(TENANT_ID);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.success).toBe(true);
      const savedBranding = mockRepository.save.mock.calls[0][0];
      expect(savedBranding.logoAsset).toBeNull();
      expect(savedBranding.headerText).toBe('Custom Header');
      expect(savedBranding.footerText).toBe('Custom Footer');
      expect(savedBranding.companyInfo.companyName).toBe('Custom Company');
    });

    it('should propagate repository errors', async () => {
      // Arrange: Create fresh branding with logo to ensure save() is called
      const freshBranding = ReportBranding.reconstitute({
        id: 'branding-789',
        tenantId: TENANT_ID,
        companyInfo: CompanyInfo.create({
          companyName: 'Test Company',
          address: '999 Test Street',
          city: 'Houston',
          state: 'TX',
          zipCode: '77001',
          phone: null,
          email: null,
          website: null,
        }),
        brandColors: BrandColors.DEFAULT,
        logoAsset: LogoAsset.create({
          blobUrl: 'https://storage.azure.com/logos/test-logo.png',
          fileName: 'test-logo.png',
          mimeType: 'image/png',
          sizeBytes: 300000,
          width: 600,
          height: 150,
          uploadedAt: new Date('2025-01-01T00:00:00Z'),
        }),
        headerText: undefined,
        footerText: undefined,
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
      });

      mockRepository.findByTenantId.mockResolvedValue(freshBranding);
      mockRepository.save.mockRejectedValue(new Error('Database write failed'));

      const command = new RemoveLogoCommand(TENANT_ID);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        'Database write failed',
      );
    });
  });
});
