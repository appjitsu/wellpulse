/**
 * UpdateReportBranding Command Handler Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import {
  UpdateReportBrandingCommand,
  UpdateReportBrandingHandler,
} from './update-report-branding.command';
import { IReportBrandingRepository } from '../../../domain/repositories/report-branding.repository.interface';
import { ReportBranding } from '../../../domain/reporting/report-branding.entity';
import { CompanyInfo } from '../../../domain/reporting/value-objects/company-info.vo';

describe('UpdateReportBrandingHandler', () => {
  let handler: UpdateReportBrandingHandler;
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
      phone: '713-555-0100',
      email: 'info@acmeoil.com',
      website: 'https://acmeoil.com',
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
        UpdateReportBrandingHandler,
        {
          provide: 'IReportBrandingRepository',
          useValue: mockRepository,
        },
      ],
    }).compile();

    handler = module.get<UpdateReportBrandingHandler>(
      UpdateReportBrandingHandler,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should update company info', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(existingBranding);
      mockRepository.save.mockResolvedValue(undefined);

      const newCompanyInfo = {
        companyName: 'Updated Company Name',
        address: '456 Oak Avenue',
        city: 'Dallas',
        state: 'TX',
        zipCode: '75001',
        phone: undefined,
        email: undefined,
        website: undefined,
      };

      const command = new UpdateReportBrandingCommand(
        TENANT_ID,
        newCompanyInfo,
        undefined,
        undefined,
        undefined,
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
      expect(savedBranding.companyInfo.companyName).toBe(
        'Updated Company Name',
      );
      expect(savedBranding.companyInfo.address).toBe('456 Oak Avenue');
    });

    it('should update brand colors', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(existingBranding);
      mockRepository.save.mockResolvedValue(undefined);

      const newBrandColors = {
        primary: '#FF0000',
        secondary: '#00FF00',
        text: '#000000',
        background: '#FFFFFF',
      };

      const command = new UpdateReportBrandingCommand(
        TENANT_ID,
        undefined,
        newBrandColors,
        undefined,
        undefined,
      );

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.success).toBe(true);
      const savedBranding = mockRepository.save.mock.calls[0][0];
      expect(savedBranding.brandColors.primary).toBe('#FF0000');
      expect(savedBranding.brandColors.secondary).toBe('#00FF00');
    });

    it('should update header text', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(existingBranding);
      mockRepository.save.mockResolvedValue(undefined);

      const command = new UpdateReportBrandingCommand(
        TENANT_ID,
        undefined,
        undefined,
        'New Header Text',
        undefined,
      );

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.success).toBe(true);
      const savedBranding = mockRepository.save.mock.calls[0][0];
      expect(savedBranding.headerText).toBe('New Header Text');
    });

    it('should update footer text', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(existingBranding);
      mockRepository.save.mockResolvedValue(undefined);

      const command = new UpdateReportBrandingCommand(
        TENANT_ID,
        undefined,
        undefined,
        undefined,
        'New Footer Text',
      );

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.success).toBe(true);
      const savedBranding = mockRepository.save.mock.calls[0][0];
      expect(savedBranding.footerText).toBe('New Footer Text');
    });

    it('should clear header text with null', async () => {
      // Arrange: Start with branding that has header text
      const brandingWithHeader = ReportBranding.create({
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
        headerText: 'Existing Header',
      });

      mockRepository.findByTenantId.mockResolvedValue(brandingWithHeader);
      mockRepository.save.mockResolvedValue(undefined);

      const command = new UpdateReportBrandingCommand(
        TENANT_ID,
        undefined,
        undefined,
        null, // Explicitly clear
        undefined,
      );

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.success).toBe(true);
      const savedBranding = mockRepository.save.mock.calls[0][0];
      expect(savedBranding.headerText).toBeNull();
    });

    it('should update multiple fields at once', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(existingBranding);
      mockRepository.save.mockResolvedValue(undefined);

      const newCompanyInfo = {
        companyName: 'Multi-Update Company',
        address: '789 Pine Street',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        phone: undefined,
        email: undefined,
        website: undefined,
      };

      const newBrandColors = {
        primary: '#0000FF',
        secondary: '#FFFF00',
        text: '#333333',
        background: '#EEEEEE',
      };

      const command = new UpdateReportBrandingCommand(
        TENANT_ID,
        newCompanyInfo,
        newBrandColors,
        'Multi Header',
        'Multi Footer',
      );

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.success).toBe(true);
      const savedBranding = mockRepository.save.mock.calls[0][0];
      expect(savedBranding.companyInfo.companyName).toBe(
        'Multi-Update Company',
      );
      expect(savedBranding.brandColors.primary).toBe('#0000FF');
      expect(savedBranding.headerText).toBe('Multi Header');
      expect(savedBranding.footerText).toBe('Multi Footer');
    });

    it('should throw NotFoundException when branding does not exist', async () => {
      // Arrange: No existing branding
      mockRepository.findByTenantId.mockResolvedValue(null);

      const command = new UpdateReportBrandingCommand(
        TENANT_ID,
        undefined,
        undefined,
        'New Header',
        undefined,
      );

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
      await expect(handler.execute(command)).rejects.toThrow(
        'No branding configuration found for tenant',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should skip update when no fields provided', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(existingBranding);
      mockRepository.save.mockResolvedValue(undefined);

      const command = new UpdateReportBrandingCommand(
        TENANT_ID,
        undefined,
        undefined,
        undefined,
        undefined,
      );

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.success).toBe(true);
      // Save is still called but entity is unchanged
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should validate company info through value object', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(existingBranding);

      const invalidCompanyInfo = {
        companyName: 'Valid Name',
        address: '123', // Too short (< 5 characters)
        city: 'Houston',
        state: 'TX',
        zipCode: '77001',
      };

      const command = new UpdateReportBrandingCommand(
        TENANT_ID,
        invalidCompanyInfo,
        undefined,
        undefined,
        undefined,
      );

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        'Address must be at least 5 characters',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should validate brand colors through value object', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(existingBranding);

      const invalidBrandColors = {
        primary: '#FF0000',
        secondary: '#00FF00',
        text: 'black', // Invalid hex format
        background: '#FFFFFF',
      };

      const command = new UpdateReportBrandingCommand(
        TENANT_ID,
        undefined,
        invalidBrandColors,
        undefined,
        undefined,
      );

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        'Invalid text color format',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should validate header text length', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(existingBranding);

      const command = new UpdateReportBrandingCommand(
        TENANT_ID,
        undefined,
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

    it('should propagate repository errors', async () => {
      // Arrange
      mockRepository.findByTenantId.mockResolvedValue(existingBranding);
      mockRepository.save.mockRejectedValue(new Error('Database write failed'));

      const command = new UpdateReportBrandingCommand(
        TENANT_ID,
        undefined,
        undefined,
        'New Header',
        undefined,
      );

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        'Database write failed',
      );
    });
  });
});
