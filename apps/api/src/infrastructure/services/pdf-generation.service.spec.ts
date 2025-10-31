/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
/**
 * PDF Generation Service Tests
 *
 * Tests for white-labeled PDF report generation with tenant branding.
 * Mocks PDFKit, file storage, and branding repository.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import {
  PdfGenerationService,
  PdfGenerationOptions,
} from './pdf-generation.service';
import { IReportBrandingRepository } from '../../domain/repositories/report-branding.repository.interface';
import { IFileStorageService } from '../../domain/services/file-storage.service.interface';
import { ReportBranding } from '../../domain/reporting/report-branding.entity';
import { CompanyInfo } from '../../domain/reporting/value-objects/company-info.vo';
import { BrandColors } from '../../domain/reporting/value-objects/brand-colors.vo';
import { LogoAsset } from '../../domain/reporting/value-objects/logo-asset.vo';

// Mock PDFKit
const mockPDFDocument = {
  on: jest.fn(),
  end: jest.fn(),
  page: {
    width: 612,
    height: 792,
  },
  y: 100,
  fillColor: jest.fn().mockReturnThis(),
  fontSize: jest.fn().mockReturnThis(),
  font: jest.fn().mockReturnThis(),
  text: jest.fn().mockReturnThis(),
  moveDown: jest.fn().mockReturnThis(),
  strokeColor: jest.fn().mockReturnThis(),
  lineWidth: jest.fn().mockReturnThis(),
  moveTo: jest.fn().mockReturnThis(),
  lineTo: jest.fn().mockReturnThis(),
  stroke: jest.fn().mockReturnThis(),
  rect: jest.fn().mockReturnThis(),
  fillAndStroke: jest.fn().mockReturnThis(),
  image: jest.fn().mockReturnThis(),
  bufferedPageRange: jest.fn(() => ({ start: 0, count: 1 })),
  switchToPage: jest.fn().mockReturnThis(),
};

jest.mock('pdfkit', () => {
  return jest.fn(() => mockPDFDocument);
});

describe('PdfGenerationService', () => {
  let service: PdfGenerationService;
  let mockBrandingRepo: jest.Mocked<IReportBrandingRepository>;
  let mockFileStorage: jest.Mocked<IFileStorageService>;

  // Test fixtures
  const tenantId = 'tenant-123';
  const companyInfo = CompanyInfo.create({
    companyName: 'ACME Oil & Gas',
    address: '123 Main St',
    city: 'Midland',
    state: 'TX',
    zipCode: '79701',
    phone: '432-555-1234',
    email: 'info@acmeoil.com',
    website: 'https://acmeoil.com',
  });
  const brandColors = BrandColors.create({
    primary: '#1a73e8',
    secondary: '#5f6368',
    text: '#202124',
    background: '#ffffff',
  });
  const logoAsset = LogoAsset.create({
    blobUrl: 'https://storage.azure.com/logos/acme-logo.png',
    fileName: 'acme-logo.png',
    mimeType: 'image/png',
    sizeBytes: 15000,
    width: 300,
    height: 100,
    uploadedAt: new Date('2025-10-01T12:00:00Z'),
  });

  // Create branding with logo using reconstitute since create() doesn't accept logo
  const mockBranding = ReportBranding.reconstitute({
    id: 'branding-123',
    tenantId,
    companyInfo,
    brandColors,
    logoAsset,
    headerText: 'Trusted Partner Since 1985',
    footerText: 'Confidential & Proprietary',
    createdAt: new Date('2025-10-01T12:00:00Z'),
    updatedAt: new Date('2025-10-01T12:00:00Z'),
  });

  const mockBrandingWithoutLogo = ReportBranding.create({
    tenantId,
    companyInfo,
    brandColors,
    headerText: 'Trusted Partner Since 1985',
    footerText: 'Confidential & Proprietary',
  });

  const testOptions: PdfGenerationOptions = {
    tenantId,
    reportTitle: 'Test Well Report',
    reportDate: new Date('2025-10-30T12:00:00Z'),
    sections: [
      {
        title: 'Well Information',
        type: 'text',
        content: 'API Number: 42-165-12345\nName: Test Well #1\nStatus: ACTIVE',
      },
      {
        title: 'Production Data',
        type: 'table',
        content: {
          headers: ['Date', 'Oil (BBL)', 'Gas (MCF)'],
          rows: [
            ['2025-10-01', '150', '500'],
            ['2025-10-02', '148', '485'],
          ],
        },
      },
    ],
  };

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock stream behavior
    mockPDFDocument.on.mockImplementation(
      (event: string, callback: (...args: unknown[]) => void) => {
        if (event === 'data') {
          // Simulate PDF data chunks
          setTimeout(() => callback(Buffer.from('PDF-CHUNK-1')), 0);
          setTimeout(() => callback(Buffer.from('PDF-CHUNK-2')), 0);
        } else if (event === 'end') {
          // Stream end
          setTimeout(() => callback(), 0);
        }
        return mockPDFDocument;
      },
    );

    mockPDFDocument.end.mockImplementation(() => {
      // Trigger 'end' event
      const endCallback = mockPDFDocument.on.mock.calls.find(
        (call) => call[0] === 'end',
      )?.[1] as ((...args: unknown[]) => void) | undefined;
      if (endCallback) {
        setTimeout(() => endCallback(), 0);
      }
    });

    // Create mock repositories
    mockBrandingRepo = {
      findByTenantId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockFileStorage = {
      uploadFile: jest.fn(),
      downloadFile: jest.fn(),
      deleteFile: jest.fn(),
      generateSasUrl: jest.fn(),
    } as any;

    // Create testing module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfGenerationService,
        {
          provide: 'IReportBrandingRepository',
          useValue: mockBrandingRepo,
        },
        {
          provide: 'IFileStorageService',
          useValue: mockFileStorage,
        },
      ],
    }).compile();

    service = module.get<PdfGenerationService>(PdfGenerationService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateReport', () => {
    it('should generate PDF with tenant branding and logo', async () => {
      // Arrange
      mockBrandingRepo.findByTenantId.mockResolvedValue(mockBranding);
      mockFileStorage.downloadFile.mockResolvedValue({
        buffer: Buffer.from('FAKE-LOGO-DATA'),
        fileName: 'acme-logo.png',
        mimeType: 'image/png',
      });

      // Act
      const result = await service.generateReport(testOptions);

      // Assert
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockBrandingRepo.findByTenantId).toHaveBeenCalledWith(tenantId);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockFileStorage.downloadFile).toHaveBeenCalledWith(
        logoAsset.blobUrl,
      );
      expect(result.stream).toBeInstanceOf(Readable);
      expect(result.fileName).toBe('test-well-report-2025-10-30.pdf');

      // Verify PDF was created with company name

      expect(mockPDFDocument.text).toHaveBeenCalledWith(
        'ACME Oil & Gas',
        expect.any(Object),
      );

      // Verify logo was added

      expect(mockPDFDocument.image).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.any(Number),
        expect.any(Number),
        expect.objectContaining({
          fit: expect.any(Array),
          align: 'right',
        }),
      );

      // Verify report title was added

      expect(mockPDFDocument.text).toHaveBeenCalledWith(
        'Test Well Report',
        expect.any(Object),
      );

      // Verify sections were added (check text was called with section titles)
      const textCalls = mockPDFDocument.text.mock.calls as any[][];
      const textValues: unknown[] = textCalls.map((call): unknown => call[0]);
      expect(textValues).toContain('Well Information');
      expect(textValues).toContain('Production Data');

      // Verify table was drawn

      expect(mockPDFDocument.rect).toHaveBeenCalled();

      expect(mockPDFDocument.fillAndStroke).toHaveBeenCalled();
    });

    it('should generate PDF without logo when branding has no logo', async () => {
      // Arrange
      mockBrandingRepo.findByTenantId.mockResolvedValue(
        mockBrandingWithoutLogo,
      );

      // Act
      const result = await service.generateReport(testOptions);

      // Assert
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockBrandingRepo.findByTenantId).toHaveBeenCalledWith(tenantId);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockFileStorage.downloadFile).not.toHaveBeenCalled();

      expect(mockPDFDocument.image).not.toHaveBeenCalled();
      expect(result.stream).toBeInstanceOf(Readable);
      expect(result.fileName).toBe('test-well-report-2025-10-30.pdf');
    });

    it('should continue without logo if download fails', async () => {
      // Arrange
      mockBrandingRepo.findByTenantId.mockResolvedValue(mockBranding);
      mockFileStorage.downloadFile.mockRejectedValue(
        new Error('Network timeout'),
      );

      // Act
      const result = await service.generateReport(testOptions);

      // Assert
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockFileStorage.downloadFile).toHaveBeenCalledWith(
        logoAsset.blobUrl,
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockFileStorage.downloadFile).toHaveBeenCalledTimes(3); // 3 retry attempts

      expect(mockPDFDocument.image).not.toHaveBeenCalled();

      // Verify retry attempt warnings
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Logo download failed (attempt 1/3): Network timeout',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Logo download failed (attempt 2/3): Network timeout',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Logo download failed (attempt 3/3): Network timeout',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Failed to render logo after retries: Failed to download logo after 3 attempts: Network timeout',
      );

      expect(result.stream).toBeInstanceOf(Readable);
    });

    it('should throw NotFoundException when branding does not exist', async () => {
      // Arrange
      mockBrandingRepo.findByTenantId.mockResolvedValue(null);

      // Act & Assert
      await expect(service.generateReport(testOptions)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.generateReport(testOptions)).rejects.toThrow(
        `No branding configuration found for tenant ${tenantId}`,
      );
    });

    it('should generate correct file name from report title and date', async () => {
      // Arrange
      mockBrandingRepo.findByTenantId.mockResolvedValue(
        mockBrandingWithoutLogo,
      );

      const optionsWithComplexTitle: PdfGenerationOptions = {
        ...testOptions,
        reportTitle: 'Well #42: Production Report (2025-Q3)',
        reportDate: new Date('2025-09-15T08:30:00Z'),
      };

      // Act
      const result = await service.generateReport(optionsWithComplexTitle);

      // Assert
      expect(result.fileName).toBe(
        'well-42-production-report-2025-q3-2025-09-15.pdf',
      );
    });

    it('should handle text sections correctly', async () => {
      // Arrange
      mockBrandingRepo.findByTenantId.mockResolvedValue(
        mockBrandingWithoutLogo,
      );

      const textOnlyOptions: PdfGenerationOptions = {
        tenantId,
        reportTitle: 'Summary Report',
        reportDate: new Date('2025-10-30T12:00:00Z'),
        sections: [
          {
            title: 'Executive Summary',
            type: 'text',
            content:
              'This well has performed exceptionally well in Q3 2025, exceeding production targets by 15%.',
          },
        ],
      };

      // Act
      await service.generateReport(textOnlyOptions);

      // Assert
      const textCalls = mockPDFDocument.text.mock.calls as any[][];
      const textValues: unknown[] = textCalls.map((call): unknown => call[0]);
      expect(textValues).toContain('Executive Summary');
      expect(
        textValues.some((val: string) => val?.includes?.('exceptionally well')),
      ).toBe(true);
    });

    it('should handle table sections correctly', async () => {
      // Arrange
      mockBrandingRepo.findByTenantId.mockResolvedValue(
        mockBrandingWithoutLogo,
      );

      const tableOnlyOptions: PdfGenerationOptions = {
        tenantId,
        reportTitle: 'Data Table Report',
        reportDate: new Date('2025-10-30T12:00:00Z'),
        sections: [
          {
            title: 'Monthly Production',
            type: 'table',
            content: {
              headers: ['Month', 'Oil (BBL)', 'Gas (MCF)', 'Water (BBL)'],
              rows: [
                ['January', '3500', '12000', '500'],
                ['February', '3200', '11500', '480'],
                ['March', '3800', '13200', '520'],
              ],
            },
          },
        ],
      };

      // Act
      await service.generateReport(tableOnlyOptions);

      // Assert
      const textCalls = mockPDFDocument.text.mock.calls as any[][];
      const textValues: unknown[] = textCalls.map((call): unknown => call[0]);
      expect(textValues).toContain('Monthly Production');

      expect(mockPDFDocument.rect).toHaveBeenCalled();

      expect(mockPDFDocument.fillAndStroke).toHaveBeenCalled();

      // Verify header cells
      expect(textValues).toContain('Month');

      // Verify data cells
      expect(textValues).toContain('3500');
    });

    it('should handle chart sections with placeholder text', async () => {
      // Arrange
      mockBrandingRepo.findByTenantId.mockResolvedValue(
        mockBrandingWithoutLogo,
      );

      const chartOptions: PdfGenerationOptions = {
        tenantId,
        reportTitle: 'Chart Report',
        reportDate: new Date('2025-10-30T12:00:00Z'),
        sections: [
          {
            title: 'Production Trend',
            type: 'chart',
            content: {
              type: 'line',
              data: [100, 150, 120, 180],
              labels: ['Q1', 'Q2', 'Q3', 'Q4'],
            },
          },
        ],
      };

      // Act
      await service.generateReport(chartOptions);

      // Assert
      const textCalls = mockPDFDocument.text.mock.calls as any[][];
      const textValues: unknown[] = textCalls.map((call): unknown => call[0]);
      expect(textValues).toContain('Production Trend');
      expect(textValues).toContain('[Chart rendering not yet implemented]');
    });

    it('should add footers to all pages', async () => {
      // Arrange
      mockBrandingRepo.findByTenantId.mockResolvedValue(mockBranding);

      mockPDFDocument.bufferedPageRange.mockReturnValue({ start: 0, count: 3 });

      // Act
      await service.generateReport(testOptions);

      // Assert

      expect(mockPDFDocument.switchToPage).toHaveBeenCalledTimes(3);

      expect(mockPDFDocument.switchToPage).toHaveBeenCalledWith(0);

      expect(mockPDFDocument.switchToPage).toHaveBeenCalledWith(1);

      expect(mockPDFDocument.switchToPage).toHaveBeenCalledWith(2);

      // Verify footer text (custom footer from branding)

      expect(mockPDFDocument.text).toHaveBeenCalledWith(
        'Confidential & Proprietary',
        expect.any(Number),
        expect.any(Number),
        expect.any(Object),
      );

      // Verify page numbers

      expect(mockPDFDocument.text).toHaveBeenCalledWith(
        'Page 1 of 3',
        expect.any(Number),
        expect.any(Number),
        expect.any(Object),
      );
    });

    it('should use custom header and footer text from branding', async () => {
      // Arrange
      const brandingWithCustomText = ReportBranding.create({
        tenantId,
        companyInfo,
        brandColors,
        headerText: 'Custom Header Text',
        footerText: 'Custom Footer Text',
      });
      mockBrandingRepo.findByTenantId.mockResolvedValue(brandingWithCustomText);

      // Act
      await service.generateReport(testOptions);

      // Assert

      expect(mockPDFDocument.text).toHaveBeenCalledWith(
        'Custom Header Text',
        expect.any(Object),
      );

      expect(mockPDFDocument.text).toHaveBeenCalledWith(
        'Custom Footer Text',
        expect.any(Number),
        expect.any(Number),
        expect.any(Object),
      );
    });

    it('should apply brand colors throughout the document', async () => {
      // Arrange
      mockBrandingRepo.findByTenantId.mockResolvedValue(
        mockBrandingWithoutLogo,
      );

      // Act
      await service.generateReport(testOptions);

      // Assert
      // Primary color used for headings

      expect(mockPDFDocument.fillColor).toHaveBeenCalledWith([26, 115, 232]); // #1a73e8
      // Secondary color used for accents

      expect(mockPDFDocument.fillColor).toHaveBeenCalledWith([95, 99, 104]); // #5f6368
      // Text color used for body

      expect(mockPDFDocument.fillColor).toHaveBeenCalledWith([32, 33, 36]); // #202124
    });
  });
});
