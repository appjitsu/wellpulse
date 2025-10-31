/**
 * Upload Logo Command
 *
 * Uploads or updates company logo for tenant branding.
 * Logo is stored in Azure Blob Storage with URL saved in database.
 *
 * Business Rules:
 * - Logo must be PNG or JPEG format
 * - Maximum file size: 2MB
 * - Maximum dimensions: 1000x300 pixels
 * - Logo is optional (branding can exist without logo)
 * - Old logo is replaced (not kept in storage)
 */

import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  BadRequestException,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { IReportBrandingRepository } from '../../../domain/repositories/report-branding.repository.interface';
import { LogoAsset } from '../../../domain/reporting/value-objects/logo-asset.vo';

/**
 * Upload Logo Command DTO
 */
export class UploadLogoCommand {
  constructor(
    public readonly tenantId: string,
    public readonly blobUrl: string, // Azure Blob Storage URL (uploaded separately)
    public readonly fileName: string,
    public readonly mimeType: string, // 'image/png' or 'image/jpeg'
    public readonly sizeBytes: number,
    public readonly width: number,
    public readonly height: number,
  ) {}
}

/**
 * Command Result
 */
export interface UploadLogoResult {
  success: boolean;
  message: string;
  logoUrl: string;
}

/**
 * Upload Logo Command Handler
 */
@CommandHandler(UploadLogoCommand)
export class UploadLogoHandler implements ICommandHandler<UploadLogoCommand> {
  private readonly logger = new Logger(UploadLogoHandler.name);

  constructor(
    @Inject('IReportBrandingRepository')
    private readonly brandingRepo: IReportBrandingRepository,
  ) {}

  async execute(command: UploadLogoCommand): Promise<UploadLogoResult> {
    this.logger.log(`Uploading logo for tenant: ${command.tenantId}`);

    // Fetch existing branding
    const branding = await this.brandingRepo.findByTenantId(command.tenantId);

    if (!branding) {
      throw new NotFoundException(
        `No branding configuration found for tenant ${command.tenantId}. Create branding first.`,
      );
    }

    // Create LogoAsset value object (validates file type, size, dimensions)
    let logoAsset: LogoAsset;
    try {
      logoAsset = LogoAsset.create({
        blobUrl: command.blobUrl,
        fileName: command.fileName,
        mimeType: command.mimeType,
        sizeBytes: command.sizeBytes,
        width: command.width,
        height: command.height,
        uploadedAt: new Date(),
      });
    } catch (error) {
      throw new BadRequestException(
        `Invalid logo asset: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Check if logo already exists
    if (branding.hasLogo()) {
      this.logger.log(
        `Replacing existing logo for tenant: ${command.tenantId}`,
      );
      // TODO: In production, delete old logo from Azure Blob Storage
      // For now, just replace the URL (old blob will remain in storage)
    }

    // Upload logo to branding
    branding.uploadLogo(logoAsset);

    // Persist changes
    await this.brandingRepo.save(branding);

    this.logger.log(
      `Logo uploaded successfully for tenant: ${command.tenantId}`,
    );

    return {
      success: true,
      message: 'Logo uploaded successfully',
      logoUrl: command.blobUrl,
    };
  }
}
