# White-Label PDF Report Generation Pattern

## Context

Multi-tenant SaaS applications often need to generate branded documents (PDFs, reports, invoices) that reflect each tenant's unique brand identity. Generic, unbranded reports diminish perceived value and professional appeal.

In WellPulse, independent oil operators need:
- **Branded well reports** with company logo, colors, and contact information
- **Professional production reports** for stakeholders and regulatory bodies
- **White-labeled dashboards** that reinforce their brand identity
- **Customizable headers/footers** with company messaging

## Problem

How do you implement white-label PDF generation in a multi-tenant application while maintaining:

- **Tenant Branding**: Each tenant has unique logos, colors, and branding elements
- **Performance**: PDF generation must be fast (<1s for typical reports)
- **Security**: Logo images stored securely in cloud storage with access controls
- **Flexibility**: Support different report types (wells, production, compliance)
- **Memory Efficiency**: Stream PDFs instead of loading entire documents in memory
- **Fail-Safe Rendering**: Continue without logo if download fails

**Challenges**:
- Branding data lives in master database, not tenant databases
- Logo images require Azure Blob Storage integration with SAS tokens
- PDF libraries (PDFKit) require careful memory management for large reports
- Color validation (hex codes, WCAG contrast requirements)
- Logo scaling while preserving aspect ratio
- Multi-page reports with consistent headers/footers on every page

## Solution

Implement a **layered white-label architecture** that separates branding management from PDF generation:

1. **Master Database Layer**: Store branding configuration (master DB, not tenant DB)
2. **File Storage Layer**: Azure Blob Storage for logo images with secure SAS URLs
3. **Domain Layer**: ReportBranding aggregate with value objects (CompanyInfo, BrandColors, LogoAsset)
4. **PDF Generation Service**: Stream-based PDF creation with PDFKit
5. **Admin Portal**: CRUD interface for WellPulse staff to manage tenant branding

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│ ADMIN PORTAL (WellPulse Staff)                          │
│ - Create/Update Branding                                │
│ - Upload Logo (multipart/form-data)                     │
│ - Preview Branding                                      │
└────────────────┬────────────────────────────────────────┘
                 │ HTTP POST/PUT /admin/branding/:tenantId
                 ↓
┌─────────────────────────────────────────────────────────┐
│ ADMIN BRANDING CONTROLLER (Presentation Layer)          │
│ - RBAC: Requires ADMIN role                             │
│ - Validates file uploads (PNG/JPEG, < 2MB)              │
│ - Extracts image dimensions with sharp                  │
└────────────────┬────────────────────────────────────────┘
                 │ CQRS Commands
                 ↓
┌─────────────────────────────────────────────────────────┐
│ BRANDING COMMANDS (Application Layer)                   │
│ - CreateReportBrandingCommand                           │
│ - UpdateReportBrandingCommand                           │
│ - UploadLogoCommand                                     │
│ - RemoveLogoCommand                                     │
└────────────────┬────────────────────────────────────────┘
                 │ Domain Events
                 ↓
┌─────────────────────────────────────────────────────────┐
│ REPORT BRANDING ENTITY (Domain Layer)                   │
│ Aggregate Root with Value Objects:                      │
│ - CompanyInfo (name, address, contact)                  │
│ - BrandColors (primary, secondary, text, background)    │
│ - LogoAsset (blobUrl, dimensions, metadata)             │
│                                                          │
│ Business Rules:                                          │
│ - Hex color validation                                  │
│ - WCAG AA contrast validation                           │
│ - Logo size limits (< 2MB, < 1000x300px)                │
│ - Header/footer text length limits (< 500 chars)        │
└────────────────┬────────────────────────────────────────┘
                 │ Persist
                 ↓
┌─────────────────────────────────────────────────────────┐
│ MASTER DATABASE                                          │
│ Tables:                                                  │
│ - report_branding (master DB, NOT tenant DB)            │
│ - Tenant-agnostic storage for all branding configs      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ AZURE BLOB STORAGE                                       │
│ Container: logos/                                        │
│ - Secure storage for company logos                      │
│ - SAS token generation for temporary access             │
│ - Metadata: tenantId, uploadedBy, uploadedAt            │
└────────────────┬────────────────────────────────────────┘
                 │ Download Logo
                 ↓
┌─────────────────────────────────────────────────────────┐
│ PDF GENERATION SERVICE (Infrastructure Layer)            │
│                                                          │
│ Workflow:                                                │
│ 1. Fetch branding from master DB                        │
│ 2. Download logo from Azure (if exists)                 │
│ 3. Create PDFKit document with branding                 │
│ 4. Add header (logo + company info)                     │
│ 5. Add report sections (text, tables, charts)           │
│ 6. Add footer to all pages (custom text + page numbers) │
│ 7. Stream PDF to HTTP response                          │
│                                                          │
│ Error Handling:                                          │
│ - Logo download failure → Continue without logo         │
│ - Missing branding → Throw NotFoundException            │
└────────────────┬────────────────────────────────────────┘
                 │ GET /wells/:id/report/pdf
                 ↓
┌─────────────────────────────────────────────────────────┐
│ TENANT APPLICATION (Operators)                           │
│ - Download well reports with their branding             │
│ - White-labeled PDF reflects their company identity     │
└─────────────────────────────────────────────────────────┘
```

### Implementation

#### 1. **Domain Layer: ReportBranding Aggregate**

```typescript
// apps/api/src/domain/reporting/report-branding.entity.ts

export class ReportBranding {
  private constructor(
    public readonly id: string,
    private _companyInfo: CompanyInfo,
    private _brandColors: BrandColors,
    private _logoAsset: LogoAsset | null,
    private _headerText: string | null,
    private _footerText: string | null,
    private _updatedAt: Date,
  ) {
    this.validate();
  }

  static create(props: CreateReportBrandingProps): ReportBranding {
    const brandColors = props.brandColors || BrandColors.DEFAULT;
    return new ReportBranding(
      crypto.randomUUID(),
      props.companyInfo,
      brandColors,
      null, // No logo initially
      props.headerText || null,
      props.footerText || null,
      new Date(),
    );
  }

  uploadLogo(logoAsset: LogoAsset): void {
    this._logoAsset = logoAsset;
    this._updatedAt = new Date();
  }

  removeLogo(): void {
    this._logoAsset = null;
    this._updatedAt = new Date();
  }

  updateBrandColors(colors: BrandColors): void {
    this._brandColors = colors;
    this._updatedAt = new Date();
  }

  private validate(): void {
    if (!this._companyInfo) throw new Error('Company info is required');
    if (!this._brandColors) throw new Error('Brand colors are required');
  }
}
```

#### 2. **Value Objects with Business Rules**

```typescript
// apps/api/src/domain/reporting/value-objects/brand-colors.vo.ts

export class BrandColors {
  static readonly DEFAULT = BrandColors.create({
    primary: '#1a73e8',
    secondary: '#5f6368',
    text: '#202124',
    background: '#ffffff',
  });

  private constructor(private readonly props: BrandColorsProps) {
    this.validate();
    this.validateContrast();
  }

  private validate(): void {
    const hexRegex = /^#[0-9A-F]{6}$/i;
    if (!hexRegex.test(this.props.primary))
      throw new Error('Invalid primary color format');
    if (!hexRegex.test(this.props.secondary))
      throw new Error('Invalid secondary color format');
    // ... validate other colors
  }

  private validateContrast(): void {
    // WCAG AA requires 4.5:1 contrast ratio for normal text
    const textLuminance = this.getLuminance(this.props.text);
    const bgLuminance = this.getLuminance(this.props.background);
    const contrast = this.calculateContrast(textLuminance, bgLuminance);

    if (contrast < 4.5) {
      throw new Error(
        `Insufficient contrast ratio: ${contrast.toFixed(2)}:1 (minimum 4.5:1 required)`
      );
    }
  }

  getPrimaryRgb(): [number, number, number] {
    return this.hexToRgb(this.props.primary);
  }
}
```

#### 3. **Azure Blob Storage Service**

```typescript
// apps/api/src/infrastructure/services/azure-blob-storage.service.ts

@Injectable()
export class AzureBlobStorageService implements IFileStorageService {
  private blobServiceClient: BlobServiceClient;

  constructor(private readonly configService: ConfigService) {
    const connectionString = this.configService.get<string>('AZURE_STORAGE_CONNECTION_STRING');
    this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  }

  async uploadFile(options: UploadFileOptions): Promise<FileMetadata> {
    const containerName = options.container || 'default';
    const containerClient = this.blobServiceClient.getContainerClient(containerName);

    // Ensure container exists
    await containerClient.createIfNotExists({ access: 'blob' });

    // Generate unique blob name
    const blobName = `${Date.now()}-${options.fileName}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Upload with metadata
    await blockBlobClient.upload(options.buffer, options.buffer.length, {
      blobHTTPHeaders: { blobContentType: options.mimeType },
      metadata: options.metadata,
    });

    return {
      url: blockBlobClient.url,
      fileName: options.fileName,
      sizeBytes: options.buffer.length,
      mimeType: options.mimeType,
      uploadedAt: new Date(),
      metadata: options.metadata,
    };
  }

  async downloadFile(url: string): Promise<DownloadFileResult> {
    const blockBlobClient = new BlockBlobClient(url);
    const downloadResponse = await blockBlobClient.download(0);

    const chunks: Buffer[] = [];
    for await (const chunk of downloadResponse.readableStreamBody!) {
      chunks.push(Buffer.from(chunk));
    }

    return {
      buffer: Buffer.concat(chunks),
      mimeType: downloadResponse.contentType || 'application/octet-stream',
      fileName: this.extractFileNameFromUrl(url),
    };
  }

  async generateDownloadUrl(url: string, expiresInMinutes = 60): Promise<string> {
    const blockBlobClient = new BlockBlobClient(url);
    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: blockBlobClient.containerName,
        blobName: blockBlobClient.name,
        permissions: BlobSASPermissions.parse('r'), // Read-only
        startsOn: new Date(),
        expiresOn: new Date(Date.now() + expiresInMinutes * 60 * 1000),
      },
      this.blobServiceClient.credential as StorageSharedKeyCredential,
    );

    return `${blockBlobClient.url}?${sasToken}`;
  }
}
```

#### 4. **PDF Generation Service with Branding**

```typescript
// apps/api/src/infrastructure/services/pdf-generation.service.ts

@Injectable()
export class PdfGenerationService {
  constructor(
    @Inject('IReportBrandingRepository')
    private readonly brandingRepository: IReportBrandingRepository,
    @Inject('IFileStorageService')
    private readonly fileStorageService: IFileStorageService,
  ) {}

  async generateReport(options: PdfGenerationOptions): Promise<{ stream: Readable; fileName: string }> {
    const branding = await this.brandingRepository.findByTenantId(options.tenantId);
    if (!branding) {
      throw new NotFoundException(`No branding configuration found for tenant ${options.tenantId}`);
    }

    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      bufferPages: true, // Enable page numbering
    });

    const stream = new Readable();
    stream._read = () => {}; // No-op
    doc.on('data', (chunk) => stream.push(chunk));
    doc.on('end', () => stream.push(null));

    // Add branded header
    await this.addHeader(doc, branding, options);

    // Add report sections
    for (const section of options.sections) {
      await this.addSection(doc, section, branding);
    }

    // Add footers to all pages
    this.addFooters(doc, branding);

    doc.end();

    return {
      stream,
      fileName: this.generateFileName(options)
    };
  }

  private async addHeader(doc: PDFKit.PDFDocument, branding: ReportBranding, options: PdfGenerationOptions): Promise<void> {
    // Add logo if available
    if (branding.hasLogo() && branding.logoAsset) {
      try {
        const logoResult = await this.fileStorageService.downloadFile(branding.logoAsset.blobUrl);
        const scaledDimensions = branding.logoAsset.getScaledDimensions(150, 50);

        doc.image(logoResult.buffer, doc.page.width - 170, 20, {
          fit: [scaledDimensions.width, scaledDimensions.height],
          align: 'right',
        });
      } catch (error) {
        // Logo download failed - continue without logo
        this.logger.warn(`Failed to render logo: ${error.message}`);
      }
    }

    // Add company name and contact info
    const primaryRgb = branding.brandColors.getPrimaryRgb();
    doc
      .fillColor(primaryRgb)
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(branding.companyInfo.companyName, { align: 'left' });
  }
}
```

#### 5. **Admin Branding Controller**

```typescript
// apps/api/src/presentation/admin/admin-branding.controller.ts

@Controller('admin/branding')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN') // Only WellPulse admins can manage branding
export class AdminBrandingController {
  @Post(':tenantId/logo/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogoFile(
    @Param('tenantId') tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadLogoResult> {
    // Validate file type
    if (!['image/png', 'image/jpeg'].includes(file.mimetype)) {
      throw new BadRequestException('Only PNG and JPEG images are allowed');
    }

    // Validate file size
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('File too large (max 2MB)');
    }

    // Extract image dimensions
    const metadata = await sharp(file.buffer).metadata();
    if (!metadata.width || !metadata.height) {
      throw new BadRequestException('Could not extract image dimensions');
    }

    // Upload to Azure Blob Storage
    const fileMetadata = await this.fileStorageService.uploadFile({
      buffer: file.buffer,
      fileName: file.originalname,
      mimeType: file.mimetype,
      container: 'logos',
      metadata: { tenantId, uploadedAt: new Date().toISOString() },
    });

    // Update branding with logo
    return this.commandBus.execute(new UploadLogoCommand(
      tenantId,
      fileMetadata.url,
      fileMetadata.fileName,
      fileMetadata.mimeType,
      fileMetadata.sizeBytes,
      metadata.width,
      metadata.height,
    ));
  }
}
```

## Benefits

1. **Brand Consistency**: Each tenant's reports reflect their unique brand identity
2. **Professional Appearance**: White-labeled PDFs increase perceived value
3. **Performance**: Stream-based PDF generation keeps memory usage low
4. **Fail-Safe**: Logo download failures don't prevent report generation
5. **Secure Storage**: Logo images stored in Azure with SAS token access
6. **Separation of Concerns**: Branding management separate from PDF generation
7. **WCAG Compliance**: Color contrast validation ensures accessibility
8. **Scalability**: Works efficiently with hundreds of tenants

## Trade-offs

1. **Complexity**: Adds another layer of configuration and storage management
2. **Storage Costs**: Logo images consume Azure Blob Storage (minimal cost)
3. **Performance Overhead**: Logo download adds ~100-200ms per PDF generation
4. **Admin Burden**: Requires WellPulse staff to configure branding for each tenant
5. **Cache Invalidation**: Logo changes require careful cache management

## Related Patterns

- **[Database-Per-Tenant Pattern](./69-Database-Per-Tenant-Multi-Tenancy-Pattern.md)** - Tenant isolation strategy
- **[Strategy Pattern](./30-Strategy-Pattern.md)** - IFileStorageService abstraction (Azure/AWS/Local)
- **[Value Object Pattern](./61-Value-Object-Layer-Boundary-Pattern.md)** - BrandColors, LogoAsset, CompanyInfo
- **[Repository Pattern](./04-Repository-Pattern.md)** - IReportBrandingRepository
- **[CQRS Pattern](./01-CQRS-Pattern.md)** - Branding commands and queries

## When to Use

✅ **Use this pattern when**:
- Building multi-tenant B2B SaaS applications
- Tenants need branded documents, reports, or exports
- Each tenant has unique branding requirements (logos, colors)
- Professional appearance is important for customer perception
- You need secure cloud storage for tenant assets

✅ **Good for**:
- PDF reports (wells, production, compliance)
- Email templates with tenant branding
- Exported CSV/Excel reports with company headers
- White-labeled customer portals

## When Not to Use

❌ **Avoid this pattern when**:
- Single-tenant application (no need for multi-tenant branding)
- Reports don't need branding (internal tools)
- Tenants don't care about white-labeling
- Storage costs are a concern (use default branding instead)
- Simple text-based reports (PDFs are overkill)

## Implementation Checklist

- [ ] Create ReportBranding aggregate in domain layer
- [ ] Implement value objects (CompanyInfo, BrandColors, LogoAsset)
- [ ] Set up Azure Blob Storage service with SAS tokens
- [ ] Create master database table for report_branding
- [ ] Implement branding repository (master DB, not tenant DB)
- [ ] Create CQRS commands (Create, Update, UploadLogo, RemoveLogo)
- [ ] Build admin branding controller with RBAC
- [ ] Implement PDF generation service with branding integration
- [ ] Add logo download with error handling (graceful degradation)
- [ ] Create admin UI for branding management
- [ ] Write unit tests for domain entities and value objects
- [ ] Write E2E tests for branding CRUD endpoints
- [ ] Document branding configuration in admin guide

## Examples in WellPulse

**Well Report PDF**:
```typescript
// GET /wells/:id/report/pdf
const well = await this.queryBus.execute(new GetWellByIdQuery(tenantId, wellId));
const { stream, fileName } = await this.pdfGenerationService.generateReport({
  tenantId,
  reportTitle: `Well Report: ${well.name}`,
  reportDate: new Date(),
  sections: [
    { title: 'Well Information', type: 'text', content: '...' },
    { title: 'Production Data', type: 'table', content: {...} },
  ],
});

res.set({
  'Content-Type': 'application/pdf',
  'Content-Disposition': `attachment; filename="${fileName}"`,
});

return new StreamableFile(buffer);
```

## References

- [PDFKit Documentation](http://pdfkit.org/)
- [Azure Blob Storage Node.js SDK](https://docs.microsoft.com/en-us/azure/storage/blobs/storage-quickstart-blobs-nodejs)
- [WCAG 2.1 Contrast Requirements](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [Sharp Image Processing](https://sharp.pixelplumbing.com/)
- [NestJS File Upload](https://docs.nestjs.com/techniques/file-upload)
