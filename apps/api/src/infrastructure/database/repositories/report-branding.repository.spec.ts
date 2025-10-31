/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/**
 * ReportBrandingRepository Tests
 *
 * Comprehensive unit tests for report branding repository with coverage of:
 * - findByTenantId (retrieve branding configuration)
 * - save (upsert branding configuration)
 * - deleteByTenantId (hard delete branding configuration)
 * - exists (check if branding exists for tenant)
 * - Domain entity mapping via ReportBrandingMapper
 * - Error handling for database failures
 *
 * Test Pattern: AAA (Arrange, Act, Assert)
 * Coverage Target: ≥80%
 */

import { ReportBrandingRepository } from './report-branding.repository';
import { ReportBranding } from '../../../domain/reporting/report-branding.entity';
import { CompanyInfo } from '../../../domain/reporting/value-objects/company-info.vo';
import { BrandColors } from '../../../domain/reporting/value-objects/brand-colors.vo';
import { LogoAsset } from '../../../domain/reporting/value-objects/logo-asset.vo';

// Mock the masterDb module
jest.mock('../master/client', () => ({
  masterDb: {
    select: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
  },
}));

// Import mocked masterDb AFTER jest.mock
import { masterDb } from '../master/client';

describe('ReportBrandingRepository', () => {
  let repository: ReportBrandingRepository;
  let mockSelect: jest.Mock;
  let mockInsert: jest.Mock;
  let mockDelete: jest.Mock;

  const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';

  // Mock database row (what comes from database)
  const mockDbRow = {
    id: 'branding-123',
    tenantId: TENANT_ID,
    companyName: 'ACME Oil & Gas',
    address: '123 Main Street',
    city: 'Houston',
    state: 'TX',
    zipCode: '77001',
    phone: '713-555-0100',
    email: 'info@acmeoil.com',
    website: 'https://acmeoil.com',
    primaryColor: '#1E40AF',
    secondaryColor: '#64748B',
    textColor: '#1F2937',
    backgroundColor: '#FFFFFF',
    logoBlobUrl: 'https://storage.azure.com/logos/acme-logo.png',
    logoFileName: 'acme-logo.png',
    logoMimeType: 'image/png',
    logoSizeBytes: 500000,
    logoWidth: 800,
    logoHeight: 200,
    logoUploadedAt: new Date('2025-01-15T10:00:00Z'),
    headerText: 'Custom Header',
    footerText: 'Custom Footer',
    createdAt: new Date('2025-01-15T08:00:00Z'),
    updatedAt: new Date('2025-01-15T12:00:00Z'),
    createdBy: 'admin-123',
    updatedBy: 'admin-456',
  };

  // Mock domain entity (what repository returns)
  const mockDomainEntity = ReportBranding.reconstitute({
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

  beforeEach(() => {
    // Create fresh mocks for each test
    mockSelect = jest.fn();
    mockInsert = jest.fn();
    mockDelete = jest.fn();

    // Reset masterDb mocks
    (masterDb.select as jest.Mock) = mockSelect;
    (masterDb.insert as jest.Mock) = mockInsert;
    (masterDb.delete as jest.Mock) = mockDelete;

    // Create repository instance
    repository = new ReportBrandingRepository();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Mock Drizzle Database
   */

  describe('findByTenantId', () => {
    it('should return domain entity when branding exists', async () => {
      // Arrange: Mock query chain
      const mockLimit = jest.fn().mockResolvedValue([mockDbRow]);
      const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
      mockSelect.mockReturnValue({ from: mockFrom });

      // Act
      const result = await repository.findByTenantId(TENANT_ID);

      // Assert
      expect(result).toBeInstanceOf(ReportBranding);
      expect(result?.id).toBe('branding-123');
      expect(result?.tenantId).toBe(TENANT_ID);
      expect(result?.companyInfo.companyName).toBe('ACME Oil & Gas');

      expect(mockSelect).toHaveBeenCalled();

      expect(mockFrom).toHaveBeenCalledWith(expect.anything()); // orgBranding table

      expect(mockWhere).toHaveBeenCalledWith(expect.anything()); // eq(tenantId)

      expect(mockLimit).toHaveBeenCalledWith(1);
    });

    it('should return null when branding does not exist', async () => {
      // Arrange: Mock empty result
      const mockLimit = jest.fn().mockResolvedValue([]);
      const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
      mockSelect.mockReturnValue({ from: mockFrom });

      // Act
      const result = await repository.findByTenantId(TENANT_ID);

      // Assert
      expect(result).toBeNull();

      expect(mockLimit).toHaveBeenCalledWith(1);
    });

    it('should handle database errors', async () => {
      // Arrange: Mock database error
      const mockLimit = jest
        .fn()
        .mockRejectedValue(new Error('Database connection failed'));
      const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
      mockSelect.mockReturnValue({ from: mockFrom });

      // Act & Assert
      await expect(repository.findByTenantId(TENANT_ID)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  /**
   * Mock Drizzle Database
   */

  describe('save', () => {
    it('should save new branding (upsert insert)', async () => {
      // Arrange: Mock insert query chain
      const mockOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
      const mockValues = jest
        .fn()
        .mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
      mockInsert.mockReturnValue({ values: mockValues });

      // Act
      await repository.save(mockDomainEntity);

      // Assert

      expect(mockInsert).toHaveBeenCalledWith(expect.anything()); // orgBranding table

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'branding-123',
          tenantId: TENANT_ID,
          companyName: 'ACME Oil & Gas',
        }),
      );

      expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.anything() as unknown[],
          set: expect.objectContaining({
            companyName: 'ACME Oil & Gas',
            primaryColor: '#1E40AF',
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should update existing branding (upsert update)', async () => {
      // Arrange: Create updated entity
      const updatedCompanyInfo = CompanyInfo.create({
        companyName: 'Updated Company Name',
        address: '456 Oak Avenue',
        city: 'Dallas',
        state: 'TX',
        zipCode: '75001',
        phone: null,
        email: null,
        website: null,
      });

      const updatedEntity = ReportBranding.reconstitute({
        id: mockDomainEntity.id,
        tenantId: mockDomainEntity.tenantId,
        companyInfo: updatedCompanyInfo,
        brandColors: mockDomainEntity.brandColors,
        logoAsset: mockDomainEntity.logoAsset,
        headerText: mockDomainEntity.headerText ?? undefined,
        footerText: mockDomainEntity.footerText ?? undefined,
        createdAt: mockDomainEntity.createdAt,
        updatedAt: mockDomainEntity.updatedAt,
      });

      const mockOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
      const mockValues = jest
        .fn()
        .mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
      mockInsert.mockReturnValue({ values: mockValues });

      // Act
      await repository.save(updatedEntity);

      // Assert

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          companyName: 'Updated Company Name',
          address: '456 Oak Avenue',
        }),
      );

      expect(mockOnConflictDoUpdate).toHaveBeenCalled();
    });

    it('should handle database errors during save', async () => {
      // Arrange: Mock database error
      const mockOnConflictDoUpdate = jest
        .fn()
        .mockRejectedValue(new Error('Constraint violation'));
      const mockValues = jest
        .fn()
        .mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
      mockInsert.mockReturnValue({ values: mockValues });

      // Act & Assert
      await expect(repository.save(mockDomainEntity)).rejects.toThrow(
        'Constraint violation',
      );
    });

    it('should save branding without logo', async () => {
      // Arrange: Create entity without logo
      const entityWithoutLogo = ReportBranding.create({
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

      const mockOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
      const mockValues = jest
        .fn()
        .mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
      mockInsert.mockReturnValue({ values: mockValues });

      // Act
      await repository.save(entityWithoutLogo);

      // Assert

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          logoBlobUrl: null,
          logoFileName: null,
          logoMimeType: null,
        }),
      );
    });
  });

  /**
   * Mock Drizzle Database
   */

  describe('deleteByTenantId', () => {
    it('should delete branding configuration', async () => {
      // Arrange: Mock delete query chain
      const mockWhere = jest.fn().mockResolvedValue(undefined);
      mockDelete.mockReturnValue({ where: mockWhere });

      // Act
      await repository.deleteByTenantId(TENANT_ID);

      // Assert

      expect(mockDelete).toHaveBeenCalledWith(expect.anything()); // orgBranding table

      expect(mockWhere).toHaveBeenCalledWith(expect.anything()); // eq(tenantId)
    });

    it('should handle database errors during delete', async () => {
      // Arrange: Mock database error
      const mockWhere = jest
        .fn()
        .mockRejectedValue(new Error('Foreign key constraint'));
      mockDelete.mockReturnValue({ where: mockWhere });

      // Act & Assert
      await expect(repository.deleteByTenantId(TENANT_ID)).rejects.toThrow(
        'Foreign key constraint',
      );
    });

    it('should not error when deleting non-existent branding', async () => {
      // Arrange: Mock successful delete (drizzle doesn't error on missing records)
      const mockWhere = jest.fn().mockResolvedValue(undefined);
      mockDelete.mockReturnValue({ where: mockWhere });

      // Act & Assert
      await expect(
        repository.deleteByTenantId('non-existent-tenant'),
      ).resolves.not.toThrow();
    });
  });

  /**
   * Mock Drizzle Database
   */

  describe('exists', () => {
    it('should return true when branding exists', async () => {
      // Arrange: Mock query chain with result
      const mockLimit = jest.fn().mockResolvedValue([{ id: 'branding-123' }]);
      const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
      mockSelect.mockReturnValue({ from: mockFrom });

      // Act
      const result = await repository.exists(TENANT_ID);

      // Assert
      expect(result).toBe(true);

      expect(mockSelect).toHaveBeenCalledWith({
        id: expect.anything() as unknown,
      }); // Select only id column

      expect(mockLimit).toHaveBeenCalledWith(1);
    });

    it('should return false when branding does not exist', async () => {
      // Arrange: Mock empty result
      const mockLimit = jest.fn().mockResolvedValue([]);
      const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
      mockSelect.mockReturnValue({ from: mockFrom });

      // Act
      const result = await repository.exists(TENANT_ID);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle database errors during existence check', async () => {
      // Arrange: Mock database error
      const mockLimit = jest
        .fn()
        .mockRejectedValue(new Error('Connection timeout'));
      const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
      mockSelect.mockReturnValue({ from: mockFrom });

      // Act & Assert
      await expect(repository.exists(TENANT_ID)).rejects.toThrow(
        'Connection timeout',
      );
    });
  });

  /**
   * Mock Drizzle Database
   */

  describe('integration with ReportBrandingMapper', () => {
    it('should correctly map database row to domain entity', async () => {
      // Arrange
      const mockLimit = jest.fn().mockResolvedValue([mockDbRow]);
      const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
      mockSelect.mockReturnValue({ from: mockFrom });

      // Act
      const result = await repository.findByTenantId(TENANT_ID);

      // Assert
      expect(result).toBeInstanceOf(ReportBranding);
      expect(result?.companyInfo).toBeInstanceOf(CompanyInfo);
      expect(result?.brandColors).toBeInstanceOf(BrandColors);
      expect(result?.logoAsset).toBeInstanceOf(LogoAsset);
      expect(result?.logoAsset?.blobUrl).toBe(
        'https://storage.azure.com/logos/acme-logo.png',
      );
    });

    it('should correctly map domain entity to database row', async () => {
      // Arrange
      const mockOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
      const mockValues = jest
        .fn()
        .mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
      mockInsert.mockReturnValue({ values: mockValues });

      // Act
      await repository.save(mockDomainEntity);

      // Assert
      const savedData = mockValues.mock.calls[0][0] as Record<string, unknown>;
      expect(savedData).toEqual(
        expect.objectContaining({
          id: 'branding-123',
          tenantId: TENANT_ID,
          companyName: 'ACME Oil & Gas',
          address: '123 Main Street',
          primaryColor: '#1E40AF',
          logoBlobUrl: 'https://storage.azure.com/logos/acme-logo.png',
        }),
      );
    });
  });
});
