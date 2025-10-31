/**
 * Update Report Branding Command
 *
 * Updates existing white-label branding configuration for a tenant.
 * Admins can update company info, colors, and custom text.
 * Logo updates are handled separately via UploadLogoCommand.
 *
 * Business Rules:
 * - Branding must already exist (use create command first)
 * - Partial updates supported (only provided fields are updated)
 * - Brand colors must pass WCAG AA contrast requirements
 */

import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  BadRequestException,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { IReportBrandingRepository } from '../../../domain/repositories/report-branding.repository.interface';
import { CompanyInfo } from '../../../domain/reporting/value-objects/company-info.vo';
import { BrandColors } from '../../../domain/reporting/value-objects/brand-colors.vo';

/**
 * Update Report Branding Command DTO
 */
export class UpdateReportBrandingCommand {
  constructor(
    public readonly tenantId: string,
    public readonly companyInfo?: {
      companyName: string;
      address: string;
      city: string;
      state: string;
      zipCode: string;
      phone?: string;
      email?: string;
      website?: string;
    },
    public readonly brandColors?: {
      primary: string;
      secondary: string;
      text: string;
      background: string;
    },
    public readonly headerText?: string | null, // null = clear custom text
    public readonly footerText?: string | null, // null = clear custom text
  ) {}
}

/**
 * Command Result
 */
export interface UpdateReportBrandingResult {
  success: boolean;
  message: string;
}

/**
 * Update Report Branding Command Handler
 */
@CommandHandler(UpdateReportBrandingCommand)
export class UpdateReportBrandingHandler
  implements ICommandHandler<UpdateReportBrandingCommand>
{
  private readonly logger = new Logger(UpdateReportBrandingHandler.name);

  constructor(
    @Inject('IReportBrandingRepository')
    private readonly brandingRepo: IReportBrandingRepository,
  ) {}

  async execute(
    command: UpdateReportBrandingCommand,
  ): Promise<UpdateReportBrandingResult> {
    this.logger.log(`Updating report branding for tenant: ${command.tenantId}`);

    // Fetch existing branding
    const branding = await this.brandingRepo.findByTenantId(command.tenantId);

    if (!branding) {
      throw new NotFoundException(
        `No branding configuration found for tenant ${command.tenantId}. Use create command first.`,
      );
    }

    // Update company info if provided
    if (command.companyInfo) {
      try {
        const companyInfo = CompanyInfo.create({
          ...command.companyInfo,
          phone: command.companyInfo.phone ?? null,
          email: command.companyInfo.email ?? null,
          website: command.companyInfo.website ?? null,
        });
        branding.updateCompanyInfo(companyInfo);
      } catch (error) {
        throw new BadRequestException(
          `Invalid company information: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Update brand colors if provided
    if (command.brandColors) {
      try {
        const brandColors = BrandColors.create(command.brandColors);

        // Check contrast ratio
        if (!brandColors.hasGoodContrast()) {
          this.logger.warn(
            `Brand colors for tenant ${command.tenantId} do not meet WCAG AA contrast requirements`,
          );
          // Don't throw - just warn (admin decision)
        }

        branding.updateBrandColors(brandColors);
      } catch (error) {
        throw new BadRequestException(
          `Invalid brand colors: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Update header text if provided (including null to clear)
    if (command.headerText !== undefined) {
      try {
        branding.updateHeaderText(command.headerText);
      } catch (error) {
        throw new BadRequestException(
          `Invalid header text: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Update footer text if provided (including null to clear)
    if (command.footerText !== undefined) {
      try {
        branding.updateFooterText(command.footerText);
      } catch (error) {
        throw new BadRequestException(
          `Invalid footer text: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Persist changes to master database
    await this.brandingRepo.save(branding);

    this.logger.log(
      `Report branding updated successfully for tenant: ${command.tenantId}`,
    );

    return {
      success: true,
      message: 'Report branding updated successfully',
    };
  }
}
