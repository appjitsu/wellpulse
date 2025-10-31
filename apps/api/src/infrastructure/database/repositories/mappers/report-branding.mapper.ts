/**
 * Report Branding Mapper
 *
 * Converts between domain entities (ReportBranding) and database records.
 * Follows hexagonal architecture pattern where domain entities are reconstituted
 * from persistence layer.
 *
 * Handles conversion of value objects (CompanyInfo, BrandColors, LogoAsset)
 * to primitives for storage in master database.
 */

import {
  ReportBranding,
  ReportBrandingProps,
} from '../../../../domain/reporting/report-branding.entity';
import { CompanyInfo } from '../../../../domain/reporting/value-objects/company-info.vo';
import { BrandColors } from '../../../../domain/reporting/value-objects/brand-colors.vo';
import { LogoAsset } from '../../../../domain/reporting/value-objects/logo-asset.vo';
import { OrgBranding } from '../../master/schema';

export class ReportBrandingMapper {
  /**
   * Convert database record to ReportBranding domain entity
   * Uses ReportBranding.reconstitute() to restore entity from persistence
   */
  static toDomain(record: OrgBranding): ReportBranding {
    // Reconstitute CompanyInfo value object
    const companyInfo = CompanyInfo.create({
      companyName: record.companyName,
      address: record.address,
      city: record.city,
      state: record.state,
      zipCode: record.zipCode,
      phone: record.phone ?? null,
      email: record.email ?? null,
      website: record.website ?? null,
    });

    // Reconstitute BrandColors value object
    const brandColors = BrandColors.create({
      primary: record.primaryColor,
      secondary: record.secondaryColor,
      text: record.textColor,
      background: record.backgroundColor,
    });

    // Reconstitute LogoAsset value object if logo exists
    let logoAsset: LogoAsset | null = null;
    if (
      record.logoBlobUrl &&
      record.logoFileName &&
      record.logoMimeType &&
      record.logoSizeBytes &&
      record.logoWidth &&
      record.logoHeight &&
      record.logoUploadedAt
    ) {
      logoAsset = LogoAsset.create({
        blobUrl: record.logoBlobUrl,
        fileName: record.logoFileName,
        mimeType: record.logoMimeType,
        sizeBytes: record.logoSizeBytes,
        width: record.logoWidth,
        height: record.logoHeight,
        uploadedAt: record.logoUploadedAt,
      });
    }

    // Reconstitute the aggregate root
    const props: ReportBrandingProps = {
      id: record.id,
      tenantId: record.tenantId,
      companyInfo,
      brandColors,
      logoAsset,
      headerText: record.headerText ?? undefined,
      footerText: record.footerText ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };

    return ReportBranding.reconstitute(props);
  }

  /**
   * Convert ReportBranding domain entity to database record format
   * Extracts primitive values for database persistence
   */
  static toPersistence(
    branding: ReportBranding,
  ): Omit<OrgBranding, 'createdBy' | 'updatedBy'> {
    return {
      id: branding.id,
      tenantId: branding.tenantId,

      // Company info (extract from value object)
      companyName: branding.companyInfo.companyName,
      address: branding.companyInfo.address,
      city: branding.companyInfo.city,
      state: branding.companyInfo.state,
      zipCode: branding.companyInfo.zipCode,
      phone: branding.companyInfo.phone,
      email: branding.companyInfo.email,
      website: branding.companyInfo.website,

      // Brand colors (extract from value object)
      primaryColor: branding.brandColors.primary,
      secondaryColor: branding.brandColors.secondary,
      textColor: branding.brandColors.text,
      backgroundColor: branding.brandColors.background,

      // Logo asset (extract from value object if exists)
      logoBlobUrl: branding.logoAsset?.blobUrl ?? null,
      logoFileName: branding.logoAsset?.fileName ?? null,
      logoMimeType: branding.logoAsset?.mimeType ?? null,
      logoSizeBytes: branding.logoAsset?.sizeBytes ?? null,
      logoWidth: branding.logoAsset?.width ?? null,
      logoHeight: branding.logoAsset?.height ?? null,
      logoUploadedAt: branding.logoAsset?.uploadedAt ?? null,

      // Custom text
      headerText: branding.headerText,
      footerText: branding.footerText,

      // Timestamps
      createdAt: branding.createdAt,
      updatedAt: branding.updatedAt,
    };
  }
}
