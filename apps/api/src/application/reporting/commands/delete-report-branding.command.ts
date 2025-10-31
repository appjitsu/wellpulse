/**
 * Delete Report Branding Command
 *
 * Permanently deletes branding configuration for a tenant.
 * This is a hard delete (no soft delete for configuration data).
 *
 * Use Cases:
 * - Tenant wants to reset to default branding
 * - Tenant is being deleted from the system
 * - Admin needs to remove incorrect configuration
 *
 * WARNING: This action is irreversible. Logo files in Azure Storage are NOT deleted.
 */

import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { IReportBrandingRepository } from '../../../domain/repositories/report-branding.repository.interface';

/**
 * Delete Report Branding Command DTO
 */
export class DeleteReportBrandingCommand {
  constructor(public readonly tenantId: string) {}
}

/**
 * Command Result
 */
export interface DeleteReportBrandingResult {
  success: boolean;
  message: string;
}

/**
 * Delete Report Branding Command Handler
 */
@CommandHandler(DeleteReportBrandingCommand)
export class DeleteReportBrandingHandler
  implements ICommandHandler<DeleteReportBrandingCommand>
{
  private readonly logger = new Logger(DeleteReportBrandingHandler.name);

  constructor(
    @Inject('IReportBrandingRepository')
    private readonly brandingRepo: IReportBrandingRepository,
  ) {}

  async execute(
    command: DeleteReportBrandingCommand,
  ): Promise<DeleteReportBrandingResult> {
    this.logger.log(`Deleting report branding for tenant: ${command.tenantId}`);

    // Check if branding exists
    const exists = await this.brandingRepo.exists(command.tenantId);

    if (!exists) {
      throw new NotFoundException(
        `No branding configuration found for tenant ${command.tenantId}`,
      );
    }

    // Delete branding
    await this.brandingRepo.deleteByTenantId(command.tenantId);

    this.logger.log(
      `Report branding deleted successfully for tenant: ${command.tenantId}`,
    );

    // TODO: In production, optionally delete logo from Azure Storage
    // For now, keep the blob for audit/recovery purposes

    return {
      success: true,
      message: 'Report branding deleted successfully',
    };
  }
}
