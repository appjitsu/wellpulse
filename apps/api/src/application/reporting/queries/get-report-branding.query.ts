/**
 * Get Report Branding Query
 *
 * Retrieves white-label branding configuration for a tenant.
 * Used when generating PDF reports or displaying branding in admin portal.
 *
 * Returns null if no branding configured (tenant uses default branding).
 */

import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { IReportBrandingRepository } from '../../../domain/repositories/report-branding.repository.interface';
import { ReportBranding } from '../../../domain/reporting/report-branding.entity';

/**
 * Get Report Branding Query
 */
export class GetReportBrandingQuery {
  constructor(public readonly tenantId: string) {}
}

/**
 * Report Branding DTO (for API responses)
 */
export interface ReportBrandingDto {
  id: string;
  tenantId: string;
  companyInfo: {
    companyName: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    phone: string | null;
    email: string | null;
    website: string | null;
  };
  brandColors: {
    primary: string;
    secondary: string;
    text: string;
    background: string;
  };
  logoAsset: {
    blobUrl: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    width: number;
    height: number;
    uploadedAt: Date;
  } | null;
  headerText: string | null;
  footerText: string | null;
  effectiveHeaderText: string; // With defaults applied
  effectiveFooterText: string; // With defaults applied
  hasLogo: boolean;
  isComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get Report Branding Query Handler
 */
@QueryHandler(GetReportBrandingQuery)
export class GetReportBrandingHandler
  implements IQueryHandler<GetReportBrandingQuery>
{
  private readonly logger = new Logger(GetReportBrandingHandler.name);

  constructor(
    @Inject('IReportBrandingRepository')
    private readonly brandingRepo: IReportBrandingRepository,
  ) {}

  async execute(
    query: GetReportBrandingQuery,
  ): Promise<ReportBrandingDto | null> {
    this.logger.log(`Fetching report branding for tenant: ${query.tenantId}`);

    const branding = await this.brandingRepo.findByTenantId(query.tenantId);

    if (!branding) {
      this.logger.log(`No branding found for tenant: ${query.tenantId}`);
      return null;
    }

    // Convert domain entity to DTO
    return this.toDto(branding);
  }

  /**
   * Convert ReportBranding entity to DTO
   */
  private toDto(branding: ReportBranding): ReportBrandingDto {
    return {
      id: branding.id,
      tenantId: branding.tenantId,
      companyInfo: {
        companyName: branding.companyInfo.companyName,
        address: branding.companyInfo.address,
        city: branding.companyInfo.city,
        state: branding.companyInfo.state,
        zipCode: branding.companyInfo.zipCode,
        phone: branding.companyInfo.phone,
        email: branding.companyInfo.email,
        website: branding.companyInfo.website,
      },
      brandColors: {
        primary: branding.brandColors.primary,
        secondary: branding.brandColors.secondary,
        text: branding.brandColors.text,
        background: branding.brandColors.background,
      },
      logoAsset: branding.logoAsset
        ? {
            blobUrl: branding.logoAsset.blobUrl,
            fileName: branding.logoAsset.fileName,
            mimeType: branding.logoAsset.mimeType,
            sizeBytes: branding.logoAsset.sizeBytes,
            width: branding.logoAsset.width,
            height: branding.logoAsset.height,
            uploadedAt: branding.logoAsset.uploadedAt,
          }
        : null,
      headerText: branding.headerText,
      footerText: branding.footerText,
      effectiveHeaderText: branding.getEffectiveHeaderText(),
      effectiveFooterText: branding.getEffectiveFooterText(),
      hasLogo: branding.hasLogo(),
      isComplete: branding.isComplete(),
      createdAt: branding.createdAt,
      updatedAt: branding.updatedAt,
    };
  }
}
