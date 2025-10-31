/**
 * Admin Branding Controller
 *
 * Admin portal endpoints for managing organization branding.
 * NOT tenant-scoped - operates on the master database.
 *
 * Security:
 * - Requires ADMIN role (from master database auth)
 * - No @TenantId() decorator - admins manage branding for any tenant
 *
 * Use Cases:
 * - Create/update branding during tenant onboarding
 * - Upload company logos via Azure Blob Storage
 * - Preview branding before PDF generation
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import sharp from 'sharp';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import {
  CreateReportBrandingCommand,
  CreateReportBrandingResult,
} from '../../application/reporting/commands/create-report-branding.command';
import {
  UpdateReportBrandingCommand,
  UpdateReportBrandingResult,
} from '../../application/reporting/commands/update-report-branding.command';
import {
  UploadLogoCommand,
  UploadLogoResult,
} from '../../application/reporting/commands/upload-logo.command';
import {
  RemoveLogoCommand,
  RemoveLogoResult,
} from '../../application/reporting/commands/remove-logo.command';
import {
  DeleteReportBrandingCommand,
  DeleteReportBrandingResult,
} from '../../application/reporting/commands/delete-report-branding.command';
import {
  GetReportBrandingQuery,
  ReportBrandingDto,
} from '../../application/reporting/queries/get-report-branding.query';
import { IFileStorageService } from '../../domain/services/file-storage.service.interface';

/**
 * Create Branding Request DTO
 */
class CreateBrandingDto {
  companyName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string;
  email?: string;
  website?: string;
  primaryColor?: string;
  secondaryColor?: string;
  textColor?: string;
  backgroundColor?: string;
  headerText?: string;
  footerText?: string;
}

/**
 * Update Branding Request DTO
 */
class UpdateBrandingDto {
  companyName?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  textColor?: string;
  backgroundColor?: string;
  headerText?: string | null;
  footerText?: string | null;
}

/**
 * Upload Logo Request DTO
 */
class UploadLogoDto {
  blobUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

@ApiTags('admin-branding')
@ApiBearerAuth('access-token')
@Controller('admin/branding')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminBrandingController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    @Inject('IFileStorageService')
    private readonly fileStorageService: IFileStorageService,
  ) {}

  /**
   * Upload logo file directly (multipart/form-data)
   * POST /admin/branding/:tenantId/logo/upload
   *
   * Alternative to POST /admin/branding/:tenantId/logo which expects blob URL.
   * This endpoint handles the complete upload workflow:
   * 1. Receives file via multipart/form-data
   * 2. Validates file type (PNG/JPEG only) and size (max 2MB)
   * 3. Extracts image dimensions using sharp
   * 4. Uploads to Azure Blob Storage
   * 5. Updates branding with logo metadata
   *
   * Rate Limiting: 10 uploads per 15 minutes to prevent abuse
   *
   * @example
   * curl -X POST http://localhost:4000/api/v1/admin/branding/{tenantId}/logo/upload \
   *   -H "Authorization: Bearer {token}" \
   *   -F "file=@company-logo.png"
   */
  @Post(':tenantId/logo/upload')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900000 } }) // 10 uploads per 15 minutes
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload tenant logo file (multipart upload)' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Logo uploaded successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file (wrong type, size, or dimensions)',
  })
  @ApiResponse({
    status: 404,
    description: 'Branding not found for this tenant',
  })
  async uploadLogoFile(
    @Param('tenantId') tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadLogoResult> {
    // Validate file is provided
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate MIME type (PNG or JPEG only)
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Only PNG and JPEG images are allowed.`,
      );
    }

    // Validate file size (max 2MB)
    const maxSizeBytes = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSizeBytes) {
      throw new BadRequestException(
        `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is 2MB.`,
      );
    }

    try {
      // Extract image dimensions using sharp
      const metadata = await sharp(file.buffer).metadata();
      const width = metadata.width;
      const height = metadata.height;

      if (!width || !height) {
        throw new BadRequestException('Could not extract image dimensions');
      }

      // Validate reasonable dimensions (min 100x100, max 2000x2000)
      if (width < 100 || height < 100) {
        throw new BadRequestException(
          `Image too small: ${width}x${height}. Minimum size is 100x100 pixels.`,
        );
      }
      if (width > 2000 || height > 2000) {
        throw new BadRequestException(
          `Image too large: ${width}x${height}. Maximum size is 2000x2000 pixels.`,
        );
      }

      // Upload to Azure Blob Storage
      const fileMetadata = await this.fileStorageService.uploadFile({
        buffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
        container: 'logos', // Use dedicated logos container
        metadata: {
          tenantId,
          uploadedBy: 'admin', // Could extract from JWT token
          uploadedAt: new Date().toISOString(),
        },
      });

      // Execute UploadLogoCommand with blob URL and metadata
      const command = new UploadLogoCommand(
        tenantId,
        fileMetadata.url,
        fileMetadata.fileName,
        fileMetadata.mimeType,
        fileMetadata.sizeBytes,
        width,
        height,
      );

      return this.commandBus.execute(command);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to upload logo: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get branding for a tenant
   * GET /admin/branding/:tenantId
   *
   * Returns branding configuration or null if not configured.
   */
  @Get(':tenantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get tenant branding configuration' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Branding retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async getBranding(
    @Param('tenantId') tenantId: string,
  ): Promise<ReportBrandingDto | null> {
    const query = new GetReportBrandingQuery(tenantId);
    return this.queryBus.execute(query);
  }

  /**
   * Create branding for a tenant
   * POST /admin/branding/:tenantId
   *
   * Creates new branding configuration. Fails if branding already exists.
   */
  @Post(':tenantId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create tenant branding configuration' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID (UUID)' })
  @ApiBody({ type: CreateBrandingDto })
  @ApiResponse({
    status: 201,
    description: 'Branding created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid branding data (validation failed)',
  })
  @ApiResponse({
    status: 409,
    description: 'Branding already exists for this tenant',
  })
  async createBranding(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateBrandingDto,
  ): Promise<CreateReportBrandingResult> {
    const command = new CreateReportBrandingCommand(
      tenantId,
      {
        companyName: dto.companyName,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        zipCode: dto.zipCode,
        phone: dto.phone,
        email: dto.email,
        website: dto.website,
      },
      dto.primaryColor &&
      dto.secondaryColor &&
      dto.textColor &&
      dto.backgroundColor
        ? {
            primary: dto.primaryColor,
            secondary: dto.secondaryColor,
            text: dto.textColor,
            background: dto.backgroundColor,
          }
        : undefined,
      dto.headerText,
      dto.footerText,
    );

    return this.commandBus.execute(command);
  }

  /**
   * Update branding for a tenant
   * PUT /admin/branding/:tenantId
   *
   * Updates existing branding configuration. Supports partial updates.
   */
  @Put(':tenantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update tenant branding configuration' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID (UUID)' })
  @ApiBody({ type: UpdateBrandingDto })
  @ApiResponse({
    status: 200,
    description: 'Branding updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid branding data (validation failed)',
  })
  @ApiResponse({
    status: 404,
    description: 'Branding not found for this tenant',
  })
  async updateBranding(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateBrandingDto,
  ): Promise<UpdateReportBrandingResult> {
    // Build company info if any field provided
    const companyInfo =
      dto.companyName ||
      dto.address ||
      dto.city ||
      dto.state ||
      dto.zipCode ||
      dto.phone !== undefined ||
      dto.email !== undefined ||
      dto.website !== undefined
        ? {
            companyName: dto.companyName || '', // Required field
            address: dto.address || '', // Required field
            city: dto.city || '', // Required field
            state: dto.state || '', // Required field
            zipCode: dto.zipCode || '', // Required field
            phone: dto.phone === null ? undefined : dto.phone,
            email: dto.email === null ? undefined : dto.email,
            website: dto.website === null ? undefined : dto.website,
          }
        : undefined;

    // Build brand colors if all fields provided
    const brandColors =
      dto.primaryColor &&
      dto.secondaryColor &&
      dto.textColor &&
      dto.backgroundColor
        ? {
            primary: dto.primaryColor,
            secondary: dto.secondaryColor,
            text: dto.textColor,
            background: dto.backgroundColor,
          }
        : undefined;

    const command = new UpdateReportBrandingCommand(
      tenantId,
      companyInfo,
      brandColors,
      dto.headerText,
      dto.footerText,
    );

    return this.commandBus.execute(command);
  }

  /**
   * Upload logo for a tenant
   * POST /admin/branding/:tenantId/logo
   *
   * Uploads or replaces company logo. Logo must be uploaded to Azure Blob
   * Storage first, then this endpoint updates the database reference.
   */
  @Post(':tenantId/logo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload tenant logo' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID (UUID)' })
  @ApiBody({ type: UploadLogoDto })
  @ApiResponse({
    status: 200,
    description: 'Logo uploaded successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid logo data (format, size, or dimensions)',
  })
  @ApiResponse({
    status: 404,
    description: 'Branding not found for this tenant',
  })
  async uploadLogo(
    @Param('tenantId') tenantId: string,
    @Body() dto: UploadLogoDto,
  ): Promise<UploadLogoResult> {
    const command = new UploadLogoCommand(
      tenantId,
      dto.blobUrl,
      dto.fileName,
      dto.mimeType,
      dto.sizeBytes,
      dto.width,
      dto.height,
    );

    return this.commandBus.execute(command);
  }

  /**
   * Remove logo for a tenant
   * DELETE /admin/branding/:tenantId/logo
   *
   * Removes logo reference from database. Logo blob in Azure Storage is not deleted.
   */
  @Delete(':tenantId/logo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove tenant logo' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Logo removed successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Branding not found for this tenant',
  })
  async removeLogo(
    @Param('tenantId') tenantId: string,
  ): Promise<RemoveLogoResult> {
    const command = new RemoveLogoCommand(tenantId);
    return this.commandBus.execute(command);
  }

  /**
   * Delete branding for a tenant
   * DELETE /admin/branding/:tenantId
   *
   * Permanently deletes branding configuration. This action is irreversible.
   */
  @Delete(':tenantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete tenant branding configuration' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Branding deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Branding not found for this tenant',
  })
  async deleteBranding(
    @Param('tenantId') tenantId: string,
  ): Promise<DeleteReportBrandingResult> {
    const command = new DeleteReportBrandingCommand(tenantId);
    return this.commandBus.execute(command);
  }
}
