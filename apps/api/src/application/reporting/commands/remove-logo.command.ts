/**
 * Remove Logo Command
 *
 * Removes company logo from tenant branding.
 * Logo blob in Azure Storage is NOT deleted (for audit/recovery).
 * Only the database reference is removed.
 */

import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { IReportBrandingRepository } from '../../../domain/repositories/report-branding.repository.interface';

/**
 * Remove Logo Command DTO
 */
export class RemoveLogoCommand {
  constructor(public readonly tenantId: string) {}
}

/**
 * Command Result
 */
export interface RemoveLogoResult {
  success: boolean;
  message: string;
}

/**
 * Remove Logo Command Handler
 */
@CommandHandler(RemoveLogoCommand)
export class RemoveLogoHandler implements ICommandHandler<RemoveLogoCommand> {
  private readonly logger = new Logger(RemoveLogoHandler.name);

  constructor(
    @Inject('IReportBrandingRepository')
    private readonly brandingRepo: IReportBrandingRepository,
  ) {}

  async execute(command: RemoveLogoCommand): Promise<RemoveLogoResult> {
    this.logger.log(`Removing logo for tenant: ${command.tenantId}`);

    // Fetch existing branding
    const branding = await this.brandingRepo.findByTenantId(command.tenantId);

    if (!branding) {
      throw new NotFoundException(
        `No branding configuration found for tenant ${command.tenantId}`,
      );
    }

    // Check if logo exists
    if (!branding.hasLogo()) {
      this.logger.log(`No logo to remove for tenant: ${command.tenantId}`);
      return {
        success: true,
        message: 'No logo to remove',
      };
    }

    // Remove logo
    branding.removeLogo();

    // Persist changes
    await this.brandingRepo.save(branding);

    this.logger.log(
      `Logo removed successfully for tenant: ${command.tenantId}`,
    );

    // TODO: In production, optionally delete blob from Azure Storage
    // For now, keep the blob for audit/recovery purposes

    return {
      success: true,
      message: 'Logo removed successfully',
    };
  }
}
