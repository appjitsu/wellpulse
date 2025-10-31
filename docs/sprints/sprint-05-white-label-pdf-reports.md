# Sprint 5: White-Label PDF Report Generation

**Status**: Planning
**Last Updated**: October 30, 2025

## Overview

Implement multi-tenant white-label PDF report generation system for WellPulse operators, enabling customized, professional PDF reports with tenant-specific branding (logos, colors, company information).

## Business Value

- **Professional Reporting**: Generate branded production reports, well summaries, inspection reports
- **Multi-Tenant Branding**: Each operator gets reports with their company logo and colors
- **Regulatory Compliance**: Standardized report formats for state regulatory submissions
- **Client Communication**: Professional reports for clients and investors
- **Field Operations**: Inspection and maintenance reports for field staff

## Technical Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **PDF Engine** | PDFKit | Lightweight, programmatic, precise control over layout |
| **Logo Storage** | Azure Blob Storage | Already integrated, CDN-backed |
| **Charting** | Chart.js + canvas | Production trend charts, well performance graphs |
| **Templates** | Template Pattern | Reusable report templates with dependency injection |

**Why PDFKit over Puppeteer:**
- ✅ Lightweight (no Chrome overhead)
- ✅ Better for structured reports (tables, charts, headers)
- ✅ Lower memory usage for batch generation
- ✅ Easier to template and customize per tenant
- ❌ No HTML/CSS rendering (not needed for production reports)

## Architecture

### Domain Layer (`apps/api/src/domain/reporting/`)

#### Entities

```typescript
// apps/api/src/domain/reporting/report-branding.entity.ts
export class ReportBranding extends AggregateRoot {
  private constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly companyInfo: CompanyInfo, // VO
    public readonly brandColors: BrandColors, // VO
    public readonly logoAsset: LogoAsset | null, // VO
    public readonly headerText: string | null,
    public readonly footerText: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static create(props: CreateReportBrandingProps): ReportBranding;
  static reconstitute(props: ReportBrandingProps): ReportBranding;

  updateCompanyInfo(companyInfo: CompanyInfo): void;
  updateBrandColors(colors: BrandColors): void;
  uploadLogo(logoAsset: LogoAsset): void;
  removeLogo(): void;
}
```

```typescript
// apps/api/src/domain/reporting/report-template.entity.ts
export class ReportTemplate {
  private constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly type: ReportType, // 'PRODUCTION' | 'WELL_SUMMARY' | 'INSPECTION' | 'MAINTENANCE'
    public readonly description: string,
    public readonly isActive: boolean,
  ) {}

  static create(props: CreateReportTemplateProps): ReportTemplate;
}
```

#### Value Objects

```typescript
// apps/api/src/domain/reporting/value-objects/company-info.vo.ts
export class CompanyInfo extends ValueObject<CompanyInfoProps> {
  private constructor(
    public readonly companyName: string,
    public readonly address: string,
    public readonly city: string,
    public readonly state: string,
    public readonly zipCode: string,
    public readonly phone: string | null,
    public readonly email: string | null,
    public readonly website: string | null,
  ) {}

  static create(props: CompanyInfoProps): CompanyInfo;

  validate(): void {
    if (!this.companyName || this.companyName.length < 2) {
      throw new Error('Company name must be at least 2 characters');
    }
    // Validate US address, state, zip
  }
}
```

```typescript
// apps/api/src/domain/reporting/value-objects/brand-colors.vo.ts
export class BrandColors extends ValueObject<BrandColorsProps> {
  private constructor(
    public readonly primary: string,   // Hex color for headers, accents
    public readonly secondary: string, // Hex color for subheadings
    public readonly text: string,      // Hex color for body text
    public readonly background: string, // Hex color for backgrounds
  ) {}

  static create(props: BrandColorsProps): BrandColors;

  static DEFAULT: BrandColors = BrandColors.create({
    primary: '#1E40AF',    // Blue
    secondary: '#64748B',  // Gray
    text: '#1F2937',       // Dark gray
    background: '#FFFFFF', // White
  });

  validate(): void {
    // Validate hex color format (#RRGGBB)
    const hexPattern = /^#[0-9A-F]{6}$/i;
    if (!hexPattern.test(this.primary)) {
      throw new Error('Invalid primary color hex format');
    }
    // Validate all colors
  }
}
```

```typescript
// apps/api/src/domain/reporting/value-objects/logo-asset.vo.ts
export class LogoAsset extends ValueObject<LogoAssetProps> {
  private constructor(
    public readonly blobUrl: string,      // Azure Blob Storage URL
    public readonly fileName: string,     // Original filename
    public readonly mimeType: string,     // image/png, image/jpeg
    public readonly sizeBytes: number,    // File size
    public readonly width: number,        // Image dimensions
    public readonly height: number,
    public readonly uploadedAt: Date,
  ) {}

  static create(props: LogoAssetProps): LogoAsset;

  validate(): void {
    // Validate image format (PNG, JPEG only)
    if (!['image/png', 'image/jpeg'].includes(this.mimeType)) {
      throw new Error('Logo must be PNG or JPEG format');
    }

    // Validate file size (max 2MB)
    if (this.sizeBytes > 2 * 1024 * 1024) {
      throw new Error('Logo file size must be less than 2MB');
    }

    // Validate dimensions (max 1000x300px for header logo)
    if (this.width > 1000 || this.height > 300) {
      throw new Error('Logo dimensions must not exceed 1000x300 pixels');
    }
  }

  get aspectRatio(): number {
    return this.width / this.height;
  }
}
```

### Infrastructure Layer (`apps/api/src/infrastructure/`)

#### PDF Generation Service

```typescript
// apps/api/src/infrastructure/services/pdf-generation.service.ts
import PDFDocument from 'pdfkit';
import { Injectable, Logger } from '@nestjs/common';
import { ReportBranding } from '../../domain/reporting/report-branding.entity';
import { BlobStorageService } from './blob-storage.service';

@Injectable()
export class PdfGenerationService {
  private readonly logger = new Logger(PdfGenerationService.name);

  constructor(private readonly blobStorage: BlobStorageService) {}

  /**
   * Create a new PDF document with tenant branding
   */
  async createDocument(branding: ReportBranding): Promise<PDFDocument> {
    const doc = new PDFDocument({
      size: 'LETTER', // 8.5" x 11" (US standard)
      margins: {
        top: 72,    // 1 inch
        bottom: 72,
        left: 72,
        right: 72,
      },
      info: {
        Title: `${branding.companyInfo.companyName} Report`,
        Author: 'WellPulse',
        Subject: 'Production Report',
        Creator: 'WellPulse Report Generator',
      },
    });

    // Apply branding (colors, fonts)
    this.applyBranding(doc, branding);

    return doc;
  }

  /**
   * Add header with logo and company info
   */
  async addHeader(
    doc: PDFDocument,
    branding: ReportBranding,
    title: string,
  ): Promise<void> {
    const logoWidth = 150;
    const logoHeight = 50;

    // Add logo if available
    if (branding.logoAsset) {
      try {
        const logoBuffer = await this.blobStorage.downloadBlob(
          branding.logoAsset.blobUrl,
        );

        doc.image(logoBuffer, 72, 36, {
          width: logoWidth,
          height: logoHeight,
          fit: [logoWidth, logoHeight],
        });
      } catch (error) {
        this.logger.warn(`Failed to load logo: ${error.message}`);
      }
    }

    // Add company name and title
    doc
      .fontSize(18)
      .fillColor(branding.brandColors.primary)
      .text(title, 72 + logoWidth + 20, 40, {
        width: 300,
        align: 'right',
      });

    // Add company info below logo
    doc
      .fontSize(9)
      .fillColor(branding.brandColors.text)
      .text(
        `${branding.companyInfo.companyName}\n` +
        `${branding.companyInfo.address}\n` +
        `${branding.companyInfo.city}, ${branding.companyInfo.state} ${branding.companyInfo.zipCode}`,
        72,
        40 + logoHeight + 10,
        { width: logoWidth, align: 'left' }
      );

    // Draw separator line
    doc
      .moveTo(72, 140)
      .lineTo(540, 140)
      .strokeColor(branding.brandColors.secondary)
      .stroke();

    // Move cursor below header
    doc.y = 160;
  }

  /**
   * Add footer with page numbers and generation date
   */
  addFooter(
    doc: PDFDocument,
    branding: ReportBranding,
    pageNumber: number,
    totalPages: number,
  ): void {
    const pageHeight = doc.page.height;
    const footerY = pageHeight - 50;

    // Add footer text
    doc
      .fontSize(8)
      .fillColor(branding.brandColors.secondary)
      .text(
        branding.footerText || `Generated by WellPulse`,
        72,
        footerY,
        { width: 200, align: 'left' }
      );

    // Add page numbers
    doc
      .fontSize(8)
      .fillColor(branding.brandColors.secondary)
      .text(
        `Page ${pageNumber} of ${totalPages}`,
        0,
        footerY,
        { width: 540, align: 'right' }
      );

    // Add generation date
    doc
      .fontSize(8)
      .fillColor(branding.brandColors.secondary)
      .text(
        `Generated: ${new Date().toLocaleDateString()}`,
        72,
        footerY + 12,
        { width: 200, align: 'left' }
      );
  }

  /**
   * Add production data table
   */
  addProductionTable(
    doc: PDFDocument,
    branding: ReportBranding,
    data: ProductionData[],
  ): void {
    const tableTop = doc.y + 20;
    const tableLeft = 72;
    const colWidths = [100, 100, 100, 100];
    const rowHeight = 20;

    // Table header
    doc
      .fontSize(10)
      .fillColor(branding.brandColors.primary)
      .text('Date', tableLeft, tableTop, { width: colWidths[0] })
      .text('Oil (BBL)', tableLeft + colWidths[0], tableTop, { width: colWidths[1] })
      .text('Gas (MCF)', tableLeft + colWidths[0] + colWidths[1], tableTop, { width: colWidths[2] })
      .text('Water (BBL)', tableLeft + colWidths[0] + colWidths[1] + colWidths[2], tableTop, { width: colWidths[3] });

    // Draw header separator
    doc
      .moveTo(tableLeft, tableTop + 15)
      .lineTo(tableLeft + colWidths.reduce((a, b) => a + b), tableTop + 15)
      .strokeColor(branding.brandColors.secondary)
      .stroke();

    // Table rows
    let y = tableTop + 25;
    doc.fontSize(9).fillColor(branding.brandColors.text);

    for (const row of data) {
      doc
        .text(row.date.toLocaleDateString(), tableLeft, y, { width: colWidths[0] })
        .text(row.oil.toFixed(2), tableLeft + colWidths[0], y, { width: colWidths[1] })
        .text(row.gas.toFixed(2), tableLeft + colWidths[0] + colWidths[1], y, { width: colWidths[2] })
        .text(row.water.toFixed(2), tableLeft + colWidths[0] + colWidths[1] + colWidths[2], y, { width: colWidths[3] });

      y += rowHeight;

      // Check if we need a new page
      if (y > doc.page.height - 120) {
        doc.addPage();
        y = 100;
      }
    }

    doc.y = y + 10;
  }

  /**
   * Apply branding styles to document
   */
  private applyBranding(doc: PDFDocument, branding: ReportBranding): void {
    // Register custom fonts if needed
    // doc.registerFont('CustomFont', './path/to/font.ttf');

    // Set default text color
    doc.fillColor(branding.brandColors.text);
  }
}
```

#### Report Repository

```typescript
// apps/api/src/infrastructure/database/repositories/report-branding.repository.ts
@Injectable()
export class ReportBrandingRepository implements IReportBrandingRepository {
  constructor(private readonly db: TenantDatabaseService) {}

  async findByTenantId(tenantId: string): Promise<ReportBranding | null> {
    // Implementation
  }

  async save(branding: ReportBranding): Promise<void> {
    // Implementation
  }
}
```

### Application Layer (CQRS)

#### Commands

```typescript
// apps/api/src/application/reporting/commands/update-report-branding.command.ts
export class UpdateReportBrandingCommand {
  constructor(
    public readonly tenantId: string,
    public readonly companyInfo: CompanyInfoDto,
    public readonly brandColors: BrandColorsDto,
    public readonly headerText?: string,
    public readonly footerText?: string,
  ) {}
}

@CommandHandler(UpdateReportBrandingCommand)
export class UpdateReportBrandingHandler
  implements ICommandHandler<UpdateReportBrandingCommand> {

  async execute(command: UpdateReportBrandingCommand): Promise<void> {
    // 1. Find existing branding or create new
    // 2. Update company info and colors
    // 3. Save to repository
    // 4. Publish domain event
  }
}
```

```typescript
// apps/api/src/application/reporting/commands/generate-production-report.command.ts
export class GenerateProductionReportCommand {
  constructor(
    public readonly tenantId: string,
    public readonly reportType: 'monthly' | 'weekly' | 'daily',
    public readonly wellIds: string[] | null, // null = all wells
    public readonly startDate: Date,
    public readonly endDate: Date,
  ) {}
}

@CommandHandler(GenerateProductionReportCommand)
export class GenerateProductionReportHandler
  implements ICommandHandler<GenerateProductionReportCommand, Buffer> {

  constructor(
    private readonly brandingRepo: IReportBrandingRepository,
    private readonly wellRepo: IWellRepository,
    private readonly pdfService: PdfGenerationService,
  ) {}

  async execute(command: GenerateProductionReportCommand): Promise<Buffer> {
    // 1. Fetch report branding for tenant
    // 2. Fetch production data for wells in date range
    // 3. Generate PDF using PDFKit
    // 4. Return PDF buffer
  }
}
```

#### Queries

```typescript
// apps/api/src/application/reporting/queries/get-report-branding.query.ts
export class GetReportBrandingQuery {
  constructor(public readonly tenantId: string) {}
}

@QueryHandler(GetReportBrandingQuery)
export class GetReportBrandingHandler
  implements IQueryHandler<GetReportBrandingQuery, ReportBrandingDto> {

  async execute(query: GetReportBrandingQuery): Promise<ReportBrandingDto> {
    // 1. Fetch branding from repository
    // 2. Convert to DTO
    // 3. Return
  }
}
```

### Presentation Layer (REST API)

```typescript
// apps/api/src/presentation/reporting/reporting.controller.ts
@Controller('reporting')
@ApiTags('Reporting')
@UseGuards(JwtAuthGuard, TenantRequiredGuard)
export class ReportingController {

  /**
   * Get current report branding settings
   */
  @Get('branding')
  @Roles('ADMIN', 'MANAGER')
  async getBranding(@TenantId() tenantId: string): Promise<ReportBrandingDto> {
    return this.queryBus.execute(new GetReportBrandingQuery(tenantId));
  }

  /**
   * Update report branding settings
   */
  @Put('branding')
  @Roles('ADMIN')
  async updateBranding(
    @TenantId() tenantId: string,
    @Body() dto: UpdateReportBrandingDto,
  ): Promise<void> {
    return this.commandBus.execute(
      new UpdateReportBrandingCommand(tenantId, dto.companyInfo, dto.brandColors)
    );
  }

  /**
   * Upload company logo
   */
  @Post('branding/logo')
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('logo'))
  async uploadLogo(
    @TenantId() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ logoUrl: string }> {
    // 1. Validate image (PNG/JPEG, max 2MB, max 1000x300px)
    // 2. Upload to Azure Blob Storage
    // 3. Update report branding with logo asset
  }

  /**
   * Generate production report PDF
   */
  @Post('generate/production')
  @Roles('ADMIN', 'MANAGER', 'FIELD_ENGINEER')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="production-report.pdf"')
  async generateProductionReport(
    @TenantId() tenantId: string,
    @Body() dto: GenerateProductionReportDto,
  ): Promise<StreamableFile> {
    const pdfBuffer = await this.commandBus.execute(
      new GenerateProductionReportCommand(
        tenantId,
        dto.reportType,
        dto.wellIds,
        dto.startDate,
        dto.endDate,
      )
    );

    return new StreamableFile(pdfBuffer);
  }

  /**
   * Generate well summary report PDF
   */
  @Post('generate/well-summary/:wellId')
  @Roles('ADMIN', 'MANAGER', 'FIELD_ENGINEER')
  async generateWellSummaryReport(
    @TenantId() tenantId: string,
    @Param('wellId') wellId: string,
  ): Promise<StreamableFile> {
    // Implementation
  }
}
```

## Database Schema

```sql
-- apps/api/src/infrastructure/database/schema/tenant/report-branding.schema.ts
CREATE TABLE report_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Company Info
  company_name VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  zip_code VARCHAR(10) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  website VARCHAR(255),

  -- Brand Colors (hex format)
  primary_color VARCHAR(7) NOT NULL DEFAULT '#1E40AF',
  secondary_color VARCHAR(7) NOT NULL DEFAULT '#64748B',
  text_color VARCHAR(7) NOT NULL DEFAULT '#1F2937',
  background_color VARCHAR(7) NOT NULL DEFAULT '#FFFFFF',

  -- Logo Asset
  logo_blob_url VARCHAR(500),
  logo_file_name VARCHAR(255),
  logo_mime_type VARCHAR(50),
  logo_size_bytes INTEGER,
  logo_width INTEGER,
  logo_height INTEGER,
  logo_uploaded_at TIMESTAMP,

  -- Header/Footer Text
  header_text VARCHAR(500),
  footer_text VARCHAR(500),

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_tenant_branding UNIQUE (tenant_id)
);

CREATE INDEX idx_report_branding_tenant ON report_branding(tenant_id);
```

## Report Templates

### 1. Production Report Template

**Data Sources:**
- Wells table (well info, status)
- Production data (oil, gas, water volumes)
- Field entries (daily production logs)

**Sections:**
- Header: Company logo, report title, date range
- Summary: Total production, average daily rate, well count
- Well-by-Well Table: Production by well
- Trend Chart: Production over time (Chart.js → PDF)
- Footer: Generated date, page numbers

### 2. Well Summary Report Template

**Data Sources:**
- Well entity (API number, location, status)
- Production history (cumulative production)
- Equipment records
- Inspection history

**Sections:**
- Header: Company logo, well name/API
- Well Details: Location, operator, spud date, depth
- Production Summary: Cumulative and current production
- Equipment List: Pump, tank battery, flowline
- Recent Inspections: Last 5 inspections

### 3. Field Inspection Report Template

**Data Sources:**
- Field entries (inspection type)
- Inspection data value object
- Photos (from blob storage)

**Sections:**
- Header: Company logo, inspection date
- Well Information: API, location
- Inspection Checklist: Items inspected, status
- Photos: Embedded images with captions
- Notes: Inspector comments
- Signature: Inspector name, date

## Testing Strategy

### Unit Tests (Target: 80%+ coverage)

1. **Domain Entity Tests**
   - ReportBranding.spec.ts (create, update, validation)
   - Value object tests (CompanyInfo, BrandColors, LogoAsset)

2. **Service Tests**
   - PdfGenerationService.spec.ts (mocked PDFKit)
   - Mock blob storage for logo loading

3. **CQRS Handler Tests**
   - UpdateReportBrandingHandler.spec.ts
   - GenerateProductionReportHandler.spec.ts

### Integration Tests

1. **E2E Report Generation**
   - Generate production report with real data
   - Verify PDF structure and branding
   - Test logo embedding

2. **Branding API Tests**
   - Upload logo (validate format, size)
   - Update company info
   - Fetch branding settings

## Performance Considerations

1. **PDF Generation**
   - Stream PDFs directly to response (don't buffer in memory)
   - Use background jobs for large reports (>100 pages)
   - Cache logos in memory (LRU cache, max 100 logos)

2. **Blob Storage**
   - Use Azure CDN for logo delivery
   - Optimize logo sizes (compress PNGs, convert to WebP)

3. **Concurrency**
   - Queue report generation requests (Bull/BullMQ)
   - Limit concurrent PDF generations (max 5 per tenant)

## Security

1. **Access Control**
   - Only ADMIN can update branding
   - ADMIN, MANAGER, FIELD_ENGINEER can generate reports
   - Logo uploads restricted to PNG/JPEG (no SVG/executable files)

2. **Data Privacy**
   - PDFs contain sensitive production data
   - Implement download tracking and audit logging
   - Add watermarks for draft reports

3. **File Validation**
   - Validate logo dimensions (max 1000x300px)
   - Validate file size (max 2MB)
   - Scan uploaded images for malware

## Dependencies

```json
{
  "pdfkit": "^0.15.0",
  "@types/pdfkit": "^0.13.4",
  "chart.js": "^4.4.0",
  "chartjs-node-canvas": "^4.1.6"
}
```

## Implementation Phases

### Phase 1: Foundation (Current Sprint)
- [ ] Domain entities and value objects
- [ ] Database schema and migration
- [ ] Report branding repository
- [ ] PDF generation service (basic)

### Phase 2: Report Templates
- [ ] Production report template
- [ ] Well summary report template
- [ ] Chart generation integration

### Phase 3: Polish & Testing
- [ ] Field inspection report template
- [ ] Comprehensive tests (unit + e2e)
- [ ] Performance optimization
- [ ] Documentation

## Success Metrics

- **PDF Generation Performance**: < 2 seconds for 10-page production report
- **Logo Upload Success Rate**: > 99%
- **Test Coverage**: ≥ 80% for reporting domain
- **API Response Time**: < 500ms for branding endpoints

## Future Enhancements

- **Email Reports**: Schedule and email reports to operators
- **Custom Templates**: Allow tenants to customize report layouts
- **Excel Export**: Generate Excel reports in addition to PDF
- **Report History**: Store generated reports with versioning
- **Advanced Charts**: Interactive charts with drill-down
