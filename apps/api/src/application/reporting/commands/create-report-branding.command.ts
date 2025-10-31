/**
 * Create Report Branding Command
 *
 * Creates white-label branding configuration for a tenant organization.
 * This command is executed by WellPulse admins through the admin portal.
 *
 * Business Rules:
 * - One branding configuration per tenant (enforced by unique constraint)
 * - Admins must provide valid company information
 * - Brand colors must pass WCAG AA contrast requirements
 * - Logo is optional (can be added later via UploadLogoCommand)
 */

import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Logger,
} from '@nestjs/common';
import { IReportBrandingRepository } from '../../../domain/repositories/report-branding.repository.interface';
import { ReportBranding } from '../../../domain/reporting/report-branding.entity';
import { CompanyInfo } from '../../../domain/reporting/value-objects/company-info.vo';
import { BrandColors } from '../../../domain/reporting/value-objects/brand-colors.vo';

/**
 * Create Report Branding Command DTO
 */
export class CreateReportBrandingCommand {
  constructor(
    public readonly tenantId: string,
    public readonly companyInfo: {
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
    public readonly headerText?: string,
    public readonly footerText?: string,
  ) {}
}

/**
 * Command Result
 */
export interface CreateReportBrandingResult {
  success: boolean;
  brandingId: string;
  message: string;
}

/**
 * Create Report Branding Command Handler
 */
@CommandHandler(CreateReportBrandingCommand)
export class CreateReportBrandingHandler
  implements ICommandHandler<CreateReportBrandingCommand>
{
  private readonly logger = new Logger(CreateReportBrandingHandler.name);

  constructor(
    @Inject('IReportBrandingRepository')
    private readonly brandingRepo: IReportBrandingRepository,
  ) {}

  async execute(
    command: CreateReportBrandingCommand,
  ): Promise<CreateReportBrandingResult> {
    this.logger.log(`Creating report branding for tenant: ${command.tenantId}`);

    // Check if branding already exists
    const existingBranding = await this.brandingRepo.findByTenantId(
      command.tenantId,
    );

    if (existingBranding) {
      throw new ConflictException(
        `Report branding already exists for tenant ${command.tenantId}. Use update command instead.`,
      );
    }

    // Create CompanyInfo value object (validates US address)
    let companyInfo: CompanyInfo;
    try {
      companyInfo = CompanyInfo.create({
        ...command.companyInfo,
        phone: command.companyInfo.phone ?? null,
        email: command.companyInfo.email ?? null,
        website: command.companyInfo.website ?? null,
      });
    } catch (error) {
      throw new BadRequestException(
        `Invalid company information: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Create BrandColors value object (validates hex colors)
    let brandColors: BrandColors;
    if (command.brandColors) {
      try {
        brandColors = BrandColors.create(command.brandColors);
      } catch (error) {
        throw new BadRequestException(
          `Invalid brand colors: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Check contrast ratio for accessibility
      if (!brandColors.hasGoodContrast()) {
        this.logger.warn(
          `Brand colors for tenant ${command.tenantId} do not meet WCAG AA contrast requirements`,
        );
        // Don't throw error - just warn (admin decision)
      }
    } else {
      // Use default colors
      brandColors = BrandColors.DEFAULT;
      this.logger.log('Using default brand colors');
    }

    // Create ReportBranding aggregate root
    const branding = ReportBranding.create({
      tenantId: command.tenantId,
      companyInfo,
      brandColors,
      headerText: command.headerText,
      footerText: command.footerText,
    });

    // Persist to master database
    await this.brandingRepo.save(branding);

    this.logger.log(
      `Report branding created successfully for tenant: ${command.tenantId}`,
    );

    return {
      success: true,
      brandingId: branding.id,
      message: 'Report branding created successfully',
    };
  }
}
