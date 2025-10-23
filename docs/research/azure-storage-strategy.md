# Azure Storage Strategy for WellPulse

**Date**: October 23, 2025
**Context**: File storage strategy for production deployment on Azure
**Decision**: Use Azure Blob Storage for all file storage (photos, PDFs, attachments)

---

## Executive Summary

**Production**: Azure Blob Storage
**Local Development**: Azurite (Azure Blob Storage emulator)
**Staging**: Azure Blob Storage (separate storage account)

**Key Benefits**:
- Native Azure integration (same cloud provider as Container Apps)
- 99.9% availability SLA
- Geo-redundant storage (GRS) for disaster recovery
- CDN integration for fast photo delivery
- Lifecycle management (auto-archive old photos)
- Cost-effective ($0.018/GB/month for hot tier)

---

## Storage Requirements

### File Types

| File Type | Use Case | Size | Frequency | Retention |
|-----------|----------|------|-----------|-----------|
| **Well Photos** | Field operator photos (equipment, leaks, general) | 1-5 MB | 100/day | 7 years |
| **Maintenance Photos** | Equipment maintenance documentation | 1-5 MB | 50/day | 7 years |
| **Invoice PDFs** | Generated invoices (for future invoicing feature) | 100-500 KB | 10/day | 10 years |
| **User Avatars** | Profile pictures | 100-500 KB | 1/user | Until deleted |
| **Equipment Manuals** | PDF manuals for equipment | 5-50 MB | Rare | Permanent |

### Storage Estimates

**Year 1 (100 tenants, 5,000 wells):**
```
Photos: 150 photos/day × 2 MB × 365 days = 110 GB/year
PDFs: 10 PDFs/day × 200 KB × 365 days = 0.7 GB/year
Total: ~111 GB/year

Cost: 111 GB × $0.018/GB = $2/month
```

**Year 3 (1,000 tenants, 50,000 wells):**
```
Photos: 1,500 photos/day × 2 MB × 365 days × 3 years = 3.3 TB
PDFs: 100 PDFs/day × 200 KB × 365 days × 3 years = 22 GB
Total: ~3.4 TB

Cost: 3,400 GB × $0.018/GB = $61/month
```

---

## Architecture

### Storage Account Structure

```
wellpulse-prod (Storage Account)
├── tenants (Container - private)
│   ├── acme/
│   │   ├── wells/
│   │   │   ├── {wellId}/
│   │   │   │   └── photos/
│   │   │   │       ├── 2025-10-23-143052.jpg
│   │   │   │       └── 2025-10-24-091234.jpg
│   │   ├── equipment/
│   │   │   └── {equipmentId}/
│   │   │       └── maintenance/
│   │   │           └── 2025-10-23-150000.jpg
│   │   └── users/
│   │       └── avatars/
│   │           └── {userId}.jpg
│   └── permian/
│       └── ... (same structure)
└── public (Container - public CDN)
    ├── assets/
    │   ├── logos/
    │   └── branding/
    └── manuals/
        └── {equipmentType}.pdf
```

**Why container per tenant?**
- Not needed - single "tenants" container with tenant prefix in blob path
- Simplifies management (one container)
- Access control via SAS tokens with tenant-specific permissions

### Access Patterns

**Upload (Server-Side):**
```typescript
// NestJS API generates SAS token for upload
POST /api/wells/{wellId}/photos/upload-url
Response: {
  uploadUrl: "https://wellpulseprod.blob.core.windows.net/tenants/acme/wells/123/photos/uuid.jpg?sv=...&sig=...",
  blobName: "acme/wells/123/photos/uuid.jpg",
  expiresAt: "2025-10-23T15:00:00Z"
}

// Client uploads directly to Azure Blob Storage
PUT {uploadUrl}
Body: <binary photo data>
```

**Download (CDN-Accelerated):**
```typescript
// NestJS API generates CDN URL with SAS token
GET /api/wells/{wellId}/photos/{photoId}
Response: {
  url: "https://wellpulse.azureedge.net/tenants/acme/wells/123/photos/uuid.jpg?sv=...&sig=...",
  expiresAt: "2025-10-23T16:00:00Z"
}

// Client downloads from CDN (fast global delivery)
GET {url}
```

---

## Implementation

### Environment Variables

**apps/api/.env:**
```bash
# Azure Blob Storage (Production)
AZURE_STORAGE_ACCOUNT_NAME=wellpulseprod
AZURE_STORAGE_ACCOUNT_KEY=<secret-key>
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=wellpulseprod;AccountKey=<key>;EndpointSuffix=core.windows.net

# Azure CDN (Optional, for faster photo delivery)
AZURE_CDN_ENDPOINT=https://wellpulse.azureedge.net

# Local Development (Azurite)
AZURE_STORAGE_ACCOUNT_NAME=devstoreaccount1
AZURE_STORAGE_ACCOUNT_KEY=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;
```

### NestJS Azure Storage Service

```typescript
// apps/api/src/infrastructure/storage/azure-blob.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlobServiceClient, ContainerClient, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';

@Injectable()
export class AzureBlobService {
  private blobServiceClient: BlobServiceClient;
  private containerClient: ContainerClient;

  constructor(private readonly configService: ConfigService) {
    const connectionString = this.configService.get<string>('AZURE_STORAGE_CONNECTION_STRING')!;
    this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    this.containerClient = this.blobServiceClient.getContainerClient('tenants');
  }

  /**
   * Generate a SAS URL for uploading a file
   *
   * @param tenantSlug - Tenant identifier (e.g., "acme")
   * @param path - File path within tenant (e.g., "wells/123/photos/uuid.jpg")
   * @param expiresInMinutes - How long the SAS token is valid (default: 60 min)
   * @returns Upload URL with SAS token
   */
  async generateUploadUrl(
    tenantSlug: string,
    path: string,
    expiresInMinutes: number = 60,
  ): Promise<{ uploadUrl: string; blobName: string; expiresAt: Date }> {
    const blobName = `${tenantSlug}/${path}`;
    const blobClient = this.containerClient.getBlobClient(blobName);
    const blockBlobClient = blobClient.getBlockBlobClient();

    // Generate SAS token with write permission
    const startsOn = new Date();
    const expiresOn = new Date(startsOn.getTime() + expiresInMinutes * 60 * 1000);

    const sasToken = generateBlobSASQueryParameters({
      containerName: 'tenants',
      blobName,
      permissions: BlobSASPermissions.parse('w'), // Write only
      startsOn,
      expiresOn,
    }, this.blobServiceClient.credential).toString();

    return {
      uploadUrl: `${blockBlobClient.url}?${sasToken}`,
      blobName,
      expiresAt: expiresOn,
    };
  }

  /**
   * Generate a SAS URL for downloading a file
   *
   * @param tenantSlug - Tenant identifier
   * @param path - File path within tenant
   * @param expiresInMinutes - How long the SAS token is valid (default: 60 min)
   * @returns Download URL with SAS token
   */
  async generateDownloadUrl(
    tenantSlug: string,
    path: string,
    expiresInMinutes: number = 60,
  ): Promise<{ downloadUrl: string; expiresAt: Date }> {
    const blobName = `${tenantSlug}/${path}`;
    const blobClient = this.containerClient.getBlobClient(blobName);

    // Check if blob exists
    const exists = await blobClient.exists();
    if (!exists) {
      throw new Error(`Blob not found: ${blobName}`);
    }

    // Generate SAS token with read permission
    const startsOn = new Date();
    const expiresOn = new Date(startsOn.getTime() + expiresInMinutes * 60 * 1000);

    const sasToken = generateBlobSASQueryParameters({
      containerName: 'tenants',
      blobName,
      permissions: BlobSASPermissions.parse('r'), // Read only
      startsOn,
      expiresOn,
    }, this.blobServiceClient.credential).toString();

    // Use CDN endpoint if configured
    const cdnEndpoint = this.configService.get<string>('AZURE_CDN_ENDPOINT');
    const baseUrl = cdnEndpoint || blobClient.url;

    return {
      downloadUrl: `${baseUrl}?${sasToken}`,
      expiresAt: expiresOn,
    };
  }

  /**
   * Upload a file directly from server (for server-side operations)
   */
  async uploadFile(
    tenantSlug: string,
    path: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<{ url: string; blobName: string }> {
    const blobName = `${tenantSlug}/${path}`;
    const blobClient = this.containerClient.getBlobClient(blobName);
    const blockBlobClient = blobClient.getBlockBlobClient();

    await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: { blobContentType: contentType },
    });

    return {
      url: blobClient.url,
      blobName,
    };
  }

  /**
   * Delete a file
   */
  async deleteFile(tenantSlug: string, path: string): Promise<void> {
    const blobName = `${tenantSlug}/${path}`;
    const blobClient = this.containerClient.getBlobClient(blobName);
    await blobClient.deleteIfExists();
  }

  /**
   * List files in a directory
   */
  async listFiles(tenantSlug: string, prefix: string): Promise<string[]> {
    const fullPrefix = `${tenantSlug}/${prefix}`;
    const files: string[] = [];

    for await (const blob of this.containerClient.listBlobsFlat({ prefix: fullPrefix })) {
      files.push(blob.name);
    }

    return files;
  }
}
```

### Controller Example (Photo Upload)

```typescript
// apps/api/src/presentation/wells/photos.controller.ts
@Controller('wells/:wellId/photos')
@UseGuards(JwtAuthGuard, TenantGuard)
export class WellPhotosController {
  constructor(
    private readonly azureBlobService: AzureBlobService,
    private readonly photoRepository: IPhotoRepository,
  ) {}

  /**
   * Generate upload URL for client-side upload
   */
  @Post('upload-url')
  async generateUploadUrl(
    @Req() req: Request,
    @Param('wellId') wellId: string,
    @Body() dto: { fileName: string; contentType: string },
  ): Promise<GenerateUploadUrlResponseDto> {
    // Generate unique photo ID
    const photoId = uuid();
    const path = `wells/${wellId}/photos/${photoId}-${dto.fileName}`;

    // Generate SAS URL for upload
    const { uploadUrl, blobName, expiresAt } = await this.azureBlobService.generateUploadUrl(
      req.tenantSlug,
      path,
      60, // 60-minute expiry
    );

    // Create photo record (mark as pending until upload confirmed)
    await this.photoRepository.create(req.tenantId, {
      id: photoId,
      wellId,
      fileName: dto.fileName,
      blobName,
      status: 'PENDING',
      uploadedBy: req.user.id,
    });

    return {
      photoId,
      uploadUrl,
      expiresAt,
    };
  }

  /**
   * Confirm photo upload (client calls after successful upload)
   */
  @Post(':photoId/confirm')
  async confirmUpload(
    @Req() req: Request,
    @Param('photoId') photoId: string,
  ): Promise<void> {
    await this.photoRepository.updateStatus(req.tenantId, photoId, 'UPLOADED');
  }

  /**
   * Get photo download URL
   */
  @Get(':photoId')
  async getPhotoUrl(
    @Req() req: Request,
    @Param('photoId') photoId: string,
  ): Promise<GetPhotoUrlResponseDto> {
    const photo = await this.photoRepository.findById(req.tenantId, photoId);
    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    // Generate SAS URL for download (CDN-accelerated if configured)
    const { downloadUrl, expiresAt } = await this.azureBlobService.generateDownloadUrl(
      req.tenantSlug,
      photo.blobName.replace(`${req.tenantSlug}/`, ''), // Remove tenant prefix
      60, // 60-minute expiry
    );

    return {
      photoId: photo.id,
      url: downloadUrl,
      expiresAt,
      fileName: photo.fileName,
      uploadedAt: photo.createdAt,
      uploadedBy: photo.uploadedBy,
    };
  }

  /**
   * List all photos for a well
   */
  @Get()
  async listPhotos(
    @Req() req: Request,
    @Param('wellId') wellId: string,
  ): Promise<ListPhotosResponseDto> {
    const photos = await this.photoRepository.findByWellId(req.tenantId, wellId);

    // Generate download URLs for all photos
    const photosWithUrls = await Promise.all(
      photos.map(async (photo) => {
        const { downloadUrl } = await this.azureBlobService.generateDownloadUrl(
          req.tenantSlug,
          photo.blobName.replace(`${req.tenantSlug}/`, ''),
          60,
        );
        return { ...photo, url: downloadUrl };
      }),
    );

    return { photos: photosWithUrls };
  }
}
```

---

## Docker Compose (Local Development)

**docker-compose.yml:**
```yaml
version: '3.9'

services:
  # PostgreSQL (Master + Tenant databases)
  postgres:
    image: postgres:16-alpine
    container_name: wellpulse-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: wellpulse_master
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis (Caching)
  redis:
    image: redis:7-alpine
    container_name: wellpulse-redis
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

  # Mailpit (Email testing)
  mailpit:
    image: axllent/mailpit:latest
    container_name: wellpulse-mailpit
    ports:
      - '1025:1025'  # SMTP
      - '8025:8025'  # Web UI
    environment:
      MP_MAX_MESSAGES: 5000
      MP_SMTP_AUTH_ACCEPT_ANY: 1
      MP_SMTP_AUTH_ALLOW_INSECURE: 1

  # Azurite (Azure Blob Storage Emulator)
  azurite:
    image: mcr.microsoft.com/azure-storage/azurite:latest
    container_name: wellpulse-azurite
    command: azurite-blob --blobHost 0.0.0.0 --blobPort 10000
    ports:
      - '10000:10000'  # Blob service
    volumes:
      - azurite_data:/data
    environment:
      AZURITE_ACCOUNTS: devstoreaccount1:Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==
    healthcheck:
      test: ["CMD", "nc", "-z", "localhost", "10000"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
  azurite_data:
```

**Testing Azurite:**
```bash
# Start services
docker compose up -d

# Create container (one-time setup)
curl -X PUT "http://127.0.0.1:10000/devstoreaccount1/tenants?restype=container" \
  -H "x-ms-version: 2021-04-10" \
  -H "x-ms-date: $(date -u '+%a, %d %b %Y %H:%M:%S GMT')"

# Upload test file
curl -X PUT "http://127.0.0.1:10000/devstoreaccount1/tenants/acme/wells/test.jpg" \
  -H "x-ms-blob-type: BlockBlob" \
  -H "x-ms-version: 2021-04-10" \
  --data-binary "@test.jpg"

# List blobs
curl "http://127.0.0.1:10000/devstoreaccount1/tenants?restype=container&comp=list" \
  -H "x-ms-version: 2021-04-10"
```

---

## Production Deployment (Azure)

### 1. Create Storage Account

```bash
# Azure CLI
az storage account create \
  --name wellpulseprod \
  --resource-group wellpulse-rg \
  --location eastus \
  --sku Standard_GRS \  # Geo-redundant storage
  --kind StorageV2 \
  --access-tier Hot \
  --https-only true \
  --min-tls-version TLS1_2

# Create container
az storage container create \
  --name tenants \
  --account-name wellpulseprod \
  --public-access off  # Private container (SAS tokens for access)

# Get connection string
az storage account show-connection-string \
  --name wellpulseprod \
  --resource-group wellpulse-rg \
  --output tsv
```

### 2. Configure Lifecycle Management

Auto-archive old photos to save costs:

```json
{
  "rules": [
    {
      "name": "ArchiveOldPhotos",
      "type": "Lifecycle",
      "definition": {
        "filters": {
          "blobTypes": ["blockBlob"],
          "prefixMatch": ["tenants/*/wells/*/photos/"]
        },
        "actions": {
          "baseBlob": {
            "tierToCool": {
              "daysAfterModificationGreaterThan": 90
            },
            "tierToArchive": {
              "daysAfterModificationGreaterThan": 365
            },
            "delete": {
              "daysAfterModificationGreaterThan": 2555
            }
          }
        }
      }
    }
  ]
}
```

**Cost Impact:**
- Hot tier (0-90 days): $0.018/GB/month
- Cool tier (90-365 days): $0.01/GB/month (44% cheaper)
- Archive tier (1-7 years): $0.002/GB/month (89% cheaper)
- Delete after 7 years (regulatory retention met)

### 3. Enable Azure CDN (Optional)

For faster global photo delivery:

```bash
# Create CDN profile
az cdn profile create \
  --name wellpulse-cdn \
  --resource-group wellpulse-rg \
  --sku Standard_Microsoft

# Create CDN endpoint
az cdn endpoint create \
  --name wellpulse \
  --profile-name wellpulse-cdn \
  --resource-group wellpulse-rg \
  --origin wellpulseprod.blob.core.windows.net \
  --origin-host-header wellpulseprod.blob.core.windows.net
```

**CDN URLs:**
```
Before CDN: https://wellpulseprod.blob.core.windows.net/tenants/acme/wells/123/photo.jpg
After CDN:  https://wellpulse.azureedge.net/tenants/acme/wells/123/photo.jpg

Benefit: 10-100x faster photo loads globally (cached at edge locations)
```

### 4. Configure CORS (for client-side uploads)

```bash
az storage cors add \
  --services b \
  --methods PUT POST GET OPTIONS \
  --origins "https://wellpulse.app" "https://*.wellpulse.app" \
  --allowed-headers "*" \
  --exposed-headers "*" \
  --max-age 3600 \
  --account-name wellpulseprod
```

---

## Security

### Access Control

1. **SAS Tokens**: Short-lived (15-60 min), least-privilege permissions
2. **No Public Access**: Container is private, all access via SAS
3. **Tenant Isolation**: Each tenant's files prefixed with tenant slug
4. **HTTPS Only**: Enforce TLS 1.2+ on storage account
5. **Firewall**: Restrict access to Azure services + WellPulse API IPs

### Monitoring

```typescript
// Track storage operations in Application Insights
this.logger.log(`[Storage] Upload: ${tenantSlug}/${path}`);
this.logger.log(`[Storage] Download: ${tenantSlug}/${path}`);
this.logger.error(`[Storage] Error: ${error.message}`);
```

---

## Cost Optimization

### Storage Tiers

| Tier | Use Case | Cost/GB/Month | Retrieval Cost |
|------|----------|---------------|----------------|
| **Hot** | Recent photos (0-90 days) | $0.018 | Free |
| **Cool** | Older photos (90-365 days) | $0.010 | $0.01/GB |
| **Archive** | Compliance archive (1-7 years) | $0.002 | $0.15/GB + 15hr delay |

### Lifecycle Policy Impact

**Example (1,000 tenants, 3 years):**

Without lifecycle management:
```
3.4 TB × $0.018/GB = $61/month
```

With lifecycle management:
```
Recent (0-90 days): 620 GB × $0.018 = $11/month
Cool (90-365 days): 1,100 GB × $0.010 = $11/month
Archive (1-7 years): 1,680 GB × $0.002 = $3/month
Total: $25/month (59% savings!)
```

---

## Alternatives Considered

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| **Azure Blob Storage** | Native Azure, CDN, lifecycle mgmt, 99.9% SLA | None | ✅ **Selected** |
| **AWS S3** | Industry standard, mature | Cross-cloud complexity, egress costs | ❌ Rejected |
| **Azure Files** | SMB/NFS support | Expensive ($0.15/GB), overkill for blobs | ❌ Rejected |
| **Self-hosted (MinIO)** | Full control | Maintenance burden, no CDN, no geo-redundancy | ❌ Rejected |

---

## Migration Path (If Needed)

If we ever need to migrate from Azure to AWS S3:

1. **Dual-write period**: Write to both Azure + S3 for 30 days
2. **Background migration**: Copy old files from Azure → S3
3. **Update code**: Switch from Azure SDK → AWS SDK (similar APIs)
4. **Verify**: Run tests, check storage integrity
5. **Cutover**: Point traffic to S3
6. **Cleanup**: Delete Azure storage after 90-day retention

**Effort**: 1-2 weeks for 10 TB of data

---

## Related Documentation

- [Azure Blob Storage Documentation](https://docs.microsoft.com/en-us/azure/storage/blobs/)
- [Azurite Emulator](https://github.com/Azure/Azurite)
- [@azure/storage-blob SDK](https://www.npmjs.com/package/@azure/storage-blob)
- [SAS Token Best Practices](https://docs.microsoft.com/en-us/azure/storage/common/storage-sas-overview)

---

**Summary**: Azure Blob Storage is the right choice for WellPulse. Native Azure integration, CDN support, lifecycle management, and 99.9% SLA make it ideal for photo-heavy workloads. Azurite provides seamless local development experience.
