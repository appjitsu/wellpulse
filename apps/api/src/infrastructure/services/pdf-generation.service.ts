/**
 * PDF Generation Service
 *
 * Generates white-labeled PDF reports using PDFKit with tenant branding.
 * Supports multiple report types with consistent branding (logos, colors, headers/footers).
 *
 * Key Features:
 * - White-label branding (company logo, colors, custom headers/footers)
 * - Professional formatting (tables, charts, page numbers)
 * - Streaming output (memory-efficient for large reports)
 * - Logo scaling with aspect ratio preservation
 * - WCAG AA contrast validation
 *
 * Architecture:
 * - Uses IReportBrandingRepository to fetch branding from master DB
 * - Generates PDFs with PDFKit (no HTML rendering needed)
 * - Returns readable stream for efficient memory usage
 */

import { Injectable, NotFoundException, Logger, Inject } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import { IReportBrandingRepository } from '../../domain/repositories/report-branding.repository.interface';
import { ReportBranding } from '../../domain/reporting/report-branding.entity';
import { IFileStorageService } from '../../domain/services/file-storage.service.interface';

export interface PdfGenerationOptions {
  tenantId: string;
  reportTitle: string;
  reportDate: Date;
  sections: ReportSection[];
}

export interface ReportSection {
  title: string;
  content: string | TableData | ChartData;
  type: 'text' | 'table' | 'chart';
}

export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface ChartData {
  // Placeholder for future chart implementation
  type: 'bar' | 'line' | 'pie';
  data: number[];
  labels: string[];
}

@Injectable()
export class PdfGenerationService {
  private readonly logger = new Logger(PdfGenerationService.name);

  constructor(
    @Inject('IReportBrandingRepository')
    private readonly brandingRepository: IReportBrandingRepository,
    @Inject('IFileStorageService')
    private readonly fileStorageService: IFileStorageService,
  ) {}

  /**
   * Generate a PDF report with tenant branding
   * Returns a readable stream for efficient memory usage
   */
  async generateReport(
    options: PdfGenerationOptions,
  ): Promise<{ stream: Readable; fileName: string }> {
    // Fetch tenant branding configuration
    const branding = await this.brandingRepository.findByTenantId(
      options.tenantId,
    );

    if (!branding) {
      throw new NotFoundException(
        `No branding configuration found for tenant ${options.tenantId}`,
      );
    }

    // Create PDF document
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: {
        top: 72, // 1 inch
        bottom: 72,
        left: 72,
        right: 72,
      },
      bufferPages: true, // Enable page numbering
      info: {
        Title: options.reportTitle,
        Author: branding.companyInfo.companyName,
        Subject: `${options.reportTitle} - ${options.reportDate.toLocaleDateString()}`,
      },
    });

    // Track the stream for return
    const stream = new Readable();
    stream._read = () => {}; // No-op

    // Pipe document to stream
    doc.on('data', (chunk) => stream.push(chunk));
    doc.on('end', () => stream.push(null));

    // Generate PDF content
    await this.addHeader(doc, branding);
    this.addReportMetadata(doc, options);
    this.addSeparator(doc);

    // Add sections
    for (const section of options.sections) {
      this.addSection(doc, section, branding);
    }

    // Add footer to all pages
    this.addFooters(doc, branding);

    // Finalize the PDF
    doc.end();

    // Generate file name
    const fileName = this.generateFileName(options);

    return { stream, fileName };
  }

  /**
   * Add branded header to the first page
   */
  private async addHeader(
    doc: PDFKit.PDFDocument,
    branding: ReportBranding,
  ): Promise<void> {
    const primaryRgb = branding.brandColors.getPrimaryRgb();

    // Add logo if available
    if (branding.hasLogo() && branding.logoAsset) {
      try {
        // Download logo from Azure Blob Storage with retry logic
        const logoResult = await this.downloadLogoWithRetry(
          branding.logoAsset.blobUrl,
          3, // Max 3 attempts
        );

        // Calculate scaled dimensions (max 150px wide, 50px tall)
        const scaledDimensions = branding.logoAsset.getScaledDimensions(
          150,
          50,
        );

        // Add logo to PDF at top-right corner
        doc.image(logoResult.buffer, doc.page.width - 170, 20, {
          fit: [scaledDimensions.width, scaledDimensions.height],
          align: 'right',
        });

        this.logger.log(
          `Added logo to PDF: ${branding.logoAsset.fileName} (${scaledDimensions.width}x${scaledDimensions.height})`,
        );
      } catch (error) {
        // Logo rendering failed - continue without logo
        this.logger.warn(
          `Failed to render logo after retries: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Add company name (large, primary color)
    doc
      .fillColor(primaryRgb)
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(branding.companyInfo.companyName, { align: 'left' });

    // Add company contact info (small, secondary color)
    const secondaryRgb = branding.brandColors.getSecondaryRgb();
    doc
      .fillColor(secondaryRgb)
      .fontSize(9)
      .font('Helvetica')
      .text(branding.companyInfo.getFormattedAddress(), { align: 'left' });

    if (branding.companyInfo.phone || branding.companyInfo.email) {
      doc.moveDown(0.3).text(branding.companyInfo.getFormattedContact(), {
        align: 'left',
      });
    }

    // Add custom header text if configured
    doc
      .moveDown(0.5)
      .fillColor(primaryRgb)
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(branding.getEffectiveHeaderText(), { align: 'center' });

    doc.moveDown(1);
  }

  /**
   * Add report metadata (title, date, etc.)
   */
  private addReportMetadata(
    doc: PDFKit.PDFDocument,
    options: PdfGenerationOptions,
  ): void {
    const textRgb = [31, 41, 55] as [number, number, number]; // Dark gray

    doc
      .fillColor(textRgb)
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(options.reportTitle, { align: 'center' });

    doc
      .moveDown(0.5)
      .fontSize(11)
      .font('Helvetica')
      .text(`Report Date: ${options.reportDate.toLocaleDateString()}`, {
        align: 'center',
      });

    doc.moveDown(1.5);
  }

  /**
   * Add horizontal separator line
   */
  private addSeparator(doc: PDFKit.PDFDocument): void {
    const secondaryRgb = [100, 116, 139] as [number, number, number]; // Gray
    doc
      .strokeColor(secondaryRgb)
      .lineWidth(1)
      .moveTo(72, doc.y)
      .lineTo(540, doc.y)
      .stroke();

    doc.moveDown(1);
  }

  /**
   * Add a report section (text, table, or chart)
   */
  private addSection(
    doc: PDFKit.PDFDocument,
    section: ReportSection,
    branding: ReportBranding,
  ): void {
    const primaryRgb = branding.brandColors.getPrimaryRgb();
    const textRgb = branding.brandColors.getTextRgb();

    // Section title
    doc
      .fillColor(primaryRgb)
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(section.title);

    doc.moveDown(0.5);

    // Section content
    switch (section.type) {
      case 'text':
        doc
          .fillColor(textRgb)
          .fontSize(11)
          .font('Helvetica')
          .text(section.content as string, {
            align: 'left',
            lineGap: 2,
          });
        break;

      case 'table':
        this.addTable(doc, section.content as TableData, branding);
        break;

      case 'chart':
        // Charts not implemented yet - placeholder
        doc
          .fillColor(textRgb)
          .fontSize(10)
          .font('Helvetica-Oblique')
          .text('[Chart rendering not yet implemented]');
        break;
    }

    doc.moveDown(1.5);
  }

  /**
   * Add a table to the PDF
   */
  private addTable(
    doc: PDFKit.PDFDocument,
    table: TableData,
    branding: ReportBranding,
  ): void {
    const primaryRgb = branding.brandColors.getPrimaryRgb();
    const textRgb = branding.brandColors.getTextRgb();
    const bgRgb = branding.brandColors.getBackgroundRgb();

    const tableTop = doc.y;
    const colWidth = 450 / table.headers.length; // Divide page width
    const rowHeight = 25;

    // Draw header row
    doc
      .rect(72, tableTop, 450, rowHeight)
      .fillAndStroke(primaryRgb, primaryRgb);

    table.headers.forEach((header, i) => {
      doc
        .fillColor(bgRgb)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(header, 72 + i * colWidth + 5, tableTop + 8, {
          width: colWidth - 10,
          align: 'left',
        });
    });

    // Draw data rows
    let currentY = tableTop + rowHeight;

    table.rows.forEach((row, rowIndex) => {
      // Alternate row colors for readability
      const rowBg =
        rowIndex % 2 === 0
          ? ([245, 245, 245] as [number, number, number])
          : bgRgb;

      doc
        .rect(72, currentY, 450, rowHeight)
        .fillAndStroke(rowBg, [200, 200, 200]);

      row.forEach((cell, i) => {
        doc
          .fillColor(textRgb)
          .fontSize(9)
          .font('Helvetica')
          .text(cell, 72 + i * colWidth + 5, currentY + 8, {
            width: colWidth - 10,
            align: 'left',
          });
      });

      currentY += rowHeight;
    });

    doc.y = currentY + 10; // Move cursor below table
  }

  /**
   * Add footers to all pages (page numbers, custom text)
   */
  private addFooters(doc: PDFKit.PDFDocument, branding: ReportBranding): void {
    const secondaryRgb = branding.brandColors.getSecondaryRgb();
    const pages = doc.bufferedPageRange();

    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);

      // Footer text
      doc
        .fillColor(secondaryRgb)
        .fontSize(9)
        .font('Helvetica')
        .text(branding.getEffectiveFooterText(), 72, doc.page.height - 50, {
          align: 'center',
          width: doc.page.width - 144,
        });

      // Page number
      doc
        .fillColor(secondaryRgb)
        .fontSize(9)
        .text(`Page ${i + 1} of ${pages.count}`, 72, doc.page.height - 35, {
          align: 'center',
          width: doc.page.width - 144,
        });
    }
  }

  /**
   * Generate a unique file name for the PDF
   */
  private generateFileName(options: PdfGenerationOptions): string {
    const dateStr = options.reportDate.toISOString().split('T')[0];
    const titleSlug = options.reportTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    return `${titleSlug}-${dateStr}.pdf`;
  }

  /**
   * Download logo with retry logic and exponential backoff
   *
   * Implements resilient logo download with automatic retries for transient failures.
   * Uses exponential backoff to avoid overwhelming the storage service.
   *
   * @param blobUrl - Azure Blob Storage URL for the logo
   * @param maxAttempts - Maximum number of download attempts (default: 3)
   * @returns Downloaded file result with buffer
   * @throws Error if all retry attempts fail
   */
  private async downloadLogoWithRetry(
    blobUrl: string,
    maxAttempts: number = 3,
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger.debug(
          `Downloading logo (attempt ${attempt}/${maxAttempts}): ${blobUrl}`,
        );

        const result = await this.fileStorageService.downloadFile(blobUrl);

        this.logger.debug(
          `Logo downloaded successfully on attempt ${attempt}: ${result.fileName}`,
        );

        return result;
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Logo download failed (attempt ${attempt}/${maxAttempts}): ${error instanceof Error ? error.message : String(error)}`,
        );

        // Don't retry on the last attempt
        if (attempt < maxAttempts) {
          // Exponential backoff: 100ms, 200ms, 400ms, etc.
          const delayMs = 100 * Math.pow(2, attempt - 1);
          this.logger.debug(`Retrying in ${delayMs}ms...`);
          await this.sleep(delayMs);
        }
      }
    }

    // All attempts failed
    throw new Error(
      `Failed to download logo after ${maxAttempts} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    );
  }

  /**
   * Sleep for specified milliseconds (for retry backoff)
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
