/**
 * UploadLogo Command Handler Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UploadLogoCommand, UploadLogoHandler } from './upload-logo.command';
import { IReportBrandingRepository } from '../../../domain/repositories/report-branding.repository.interface';
import { ReportBranding } from '../../../domain/reporting/report-branding.entity';
import { CompanyInfo } from '../../../domain/reporting/value-objects/company-info.vo';
import { LogoAsset } from '../../../domain/reporting/value-objects/logo-asset.vo';

describe('UploadLogoHandler', () => {
  let handler: UploadLogoHandler;
  let mockRepository: jest.Mocked<IReportBrandingRepository>;

  const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';

  const existingBranding = ReportBranding.create({
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

  const validLogoProps = {
    blobUrl: 'https://storage.azure.com/logos/acme-logo.png',
    fileName: 'acme-logo.png',
    mimeType: 'image/png',
    sizeBytes: 500000, // 500KB
    width: 800,
    height: 200,
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
        UploadLogoHandler,
        {
          provide: 'IReportBrandingRepository',
          useValue: mockRepository,
        },
      ],
    }).compile();

    handler = module.get<UploadLogoHandler>(UploadLogoHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should upload PNG logo successfully', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(existingBranding);
      mockRepository.save.mockResolvedValue(undefined);

      const command = new UploadLogoCommand(
        TENANT_ID,
        validLogoProps.blobUrl,
        validLogoProps.fileName,
        validLogoProps.mimeType,
        validLogoProps.sizeBytes,
        validLogoProps.width,
        validLogoProps.height,
      );

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.success).toBe(true);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.findByTenantId).toHaveBeenCalledWith(TENANT_ID);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.save).toHaveBeenCalled();

      const savedBranding = mockRepository.save.mock.calls[0][0];
      expect(savedBranding.hasLogo()).toBe(true);
      expect(savedBranding.logoAsset).toBeInstanceOf(LogoAsset);
      expect(savedBranding.logoAsset?.blobUrl).toBe(validLogoProps.blobUrl);
      expect(savedBranding.logoAsset?.fileName).toBe(validLogoProps.fileName);
    });

    it('should upload JPEG logo successfully', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(existingBranding);
      mockRepository.save.mockResolvedValue(undefined);

      const command = new UploadLogoCommand(
        TENANT_ID,
        'https://storage.azure.com/logos/acme-logo.jpg',
        'acme-logo.jpg',
        'image/jpeg',
        validLogoProps.sizeBytes,
        validLogoProps.width,
        validLogoProps.height,
      );

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.success).toBe(true);
      const savedBranding = mockRepository.save.mock.calls[0][0];
      expect(savedBranding.logoAsset?.mimeType).toBe('image/jpeg');
    });

    it('should replace existing logo', async () => {
      // Arrange: Branding with existing logo
      const existingLogo = LogoAsset.create({
        blobUrl: 'https://storage.azure.com/logos/old-logo.png',
        fileName: 'old-logo.png',
        mimeType: 'image/png',
        sizeBytes: 300000,
        width: 600,
        height: 150,
        uploadedAt: new Date('2025-01-01T00:00:00Z'),
      });

      const brandingWithLogo = ReportBranding.reconstitute({
        id: 'branding-123',
        tenantId: TENANT_ID,
        companyInfo: existingBranding.companyInfo,
        brandColors: existingBranding.brandColors,
        logoAsset: existingLogo,
        headerText: undefined,
        footerText: undefined,
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
      });

      mockRepository.findByTenantId.mockResolvedValue(brandingWithLogo);
      mockRepository.save.mockResolvedValue(undefined);

      const command = new UploadLogoCommand(
        TENANT_ID,
        validLogoProps.blobUrl,
        validLogoProps.fileName,
        validLogoProps.mimeType,
        validLogoProps.sizeBytes,
        validLogoProps.width,
        validLogoProps.height,
      );

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.success).toBe(true);
      const savedBranding = mockRepository.save.mock.calls[0][0];
      expect(savedBranding.logoAsset?.blobUrl).toBe(validLogoProps.blobUrl);
      expect(savedBranding.logoAsset?.fileName).toBe(validLogoProps.fileName);
    });

    it('should throw NotFoundException when branding does not exist', async () => {
      // Arrange: No existing branding
      mockRepository.findByTenantId.mockResolvedValue(null);

      const command = new UploadLogoCommand(
        TENANT_ID,
        validLogoProps.blobUrl,
        validLogoProps.fileName,
        validLogoProps.mimeType,
        validLogoProps.sizeBytes,
        validLogoProps.width,
        validLogoProps.height,
      );

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
      await expect(handler.execute(command)).rejects.toThrow(
        'No branding configuration found for tenant',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should reject invalid blob URL', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(existingBranding);

      const command = new UploadLogoCommand(
        TENANT_ID,
        'not-a-valid-url',
        validLogoProps.fileName,
        validLogoProps.mimeType,
        validLogoProps.sizeBytes,
        validLogoProps.width,
        validLogoProps.height,
      );

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        'Invalid blob URL format',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should reject unsupported file format (SVG)', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(existingBranding);

      const command = new UploadLogoCommand(
        TENANT_ID,
        validLogoProps.blobUrl,
        'logo.svg',
        'image/svg+xml',
        validLogoProps.sizeBytes,
        validLogoProps.width,
        validLogoProps.height,
      );

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        'Logo must be PNG or JPEG format',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should reject file exceeding 2MB size limit', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(existingBranding);

      const oversizedFile = 3 * 1024 * 1024; // 3MB
      const command = new UploadLogoCommand(
        TENANT_ID,
        validLogoProps.blobUrl,
        validLogoProps.fileName,
        validLogoProps.mimeType,
        oversizedFile,
        validLogoProps.width,
        validLogoProps.height,
      );

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        'Logo file size must not exceed 2.0MB',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should reject logo exceeding width limit', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(existingBranding);

      const command = new UploadLogoCommand(
        TENANT_ID,
        validLogoProps.blobUrl,
        validLogoProps.fileName,
        validLogoProps.mimeType,
        validLogoProps.sizeBytes,
        1001, // Exceeds 1000px width limit
        validLogoProps.height,
      );

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        'Logo width must not exceed 1000px',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should reject logo exceeding height limit', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(existingBranding);

      const command = new UploadLogoCommand(
        TENANT_ID,
        validLogoProps.blobUrl,
        validLogoProps.fileName,
        validLogoProps.mimeType,
        validLogoProps.sizeBytes,
        validLogoProps.width,
        301, // Exceeds 300px height limit
      );

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        'Logo height must not exceed 300px',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should accept logo at exact size limits', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(existingBranding);
      mockRepository.save.mockResolvedValue(undefined);

      const exactLimits = new UploadLogoCommand(
        TENANT_ID,
        validLogoProps.blobUrl,
        validLogoProps.fileName,
        validLogoProps.mimeType,
        2 * 1024 * 1024, // Exactly 2MB
        1000, // Exactly 1000px width
        300, // Exactly 300px height
      );

      // Act
      const result = await handler.execute(exactLimits);

      // Assert
      expect(result.success).toBe(true);
      const savedBranding = mockRepository.save.mock.calls[0][0];
      expect(savedBranding.logoAsset?.width).toBe(1000);
      expect(savedBranding.logoAsset?.height).toBe(300);
    });

    it('should propagate repository errors', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(existingBranding);
      mockRepository.save.mockRejectedValue(
        new Error('Blob storage write failed'),
      );

      const command = new UploadLogoCommand(
        TENANT_ID,
        validLogoProps.blobUrl,
        validLogoProps.fileName,
        validLogoProps.mimeType,
        validLogoProps.sizeBytes,
        validLogoProps.width,
        validLogoProps.height,
      );

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        'Blob storage write failed',
      );
    });
  });
});
