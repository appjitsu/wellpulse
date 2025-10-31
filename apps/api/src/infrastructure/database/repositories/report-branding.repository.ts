/**
 * Report Branding Repository Implementation
 *
 * Drizzle ORM implementation of IReportBrandingRepository.
 * Handles conversion between domain entities and database records using ReportBrandingMapper.
 *
 * Master Database Architecture:
 * - Stores branding configuration in the master database (not tenant databases)
 * - One branding configuration per organization (unique constraint on tenantId)
 * - Managed by WellPulse admins through the admin portal
 */

import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { masterDb } from '../master/client';
import { orgBranding } from '../master/schema';
import { IReportBrandingRepository } from '../../../domain/repositories/report-branding.repository.interface';
import { ReportBranding } from '../../../domain/reporting/report-branding.entity';
import { ReportBrandingMapper } from './mappers/report-branding.mapper';

@Injectable()
export class ReportBrandingRepository implements IReportBrandingRepository {
  /**
   * Find branding configuration by tenant ID
   * Returns null if no branding configured for this organization
   */
  async findByTenantId(tenantId: string): Promise<ReportBranding | null> {
    const results = await masterDb
      .select()
      .from(orgBranding)
      .where(eq(orgBranding.tenantId, tenantId))
      .limit(1);

    return results[0] ? ReportBrandingMapper.toDomain(results[0]) : null;
  }

  /**
   * Save branding configuration (create or update)
   * Uses upsert pattern with unique constraint on tenantId
   */
  async save(branding: ReportBranding): Promise<void> {
    const data = ReportBrandingMapper.toPersistence(branding);

    // Upsert: insert or update if tenant_id already exists
    await masterDb
      .insert(orgBranding)
      .values(data)
      .onConflictDoUpdate({
        target: orgBranding.tenantId,
        set: {
          companyName: data.companyName,
          address: data.address,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          phone: data.phone,
          email: data.email,
          website: data.website,
          primaryColor: data.primaryColor,
          secondaryColor: data.secondaryColor,
          textColor: data.textColor,
          backgroundColor: data.backgroundColor,
          logoBlobUrl: data.logoBlobUrl,
          logoFileName: data.logoFileName,
          logoMimeType: data.logoMimeType,
          logoSizeBytes: data.logoSizeBytes,
          logoWidth: data.logoWidth,
          logoHeight: data.logoHeight,
          logoUploadedAt: data.logoUploadedAt,
          headerText: data.headerText,
          footerText: data.footerText,
          updatedAt: data.updatedAt,
        },
      });
  }

  /**
   * Delete branding configuration by tenant ID
   * Hard delete (no soft delete for master DB configuration)
   */
  async deleteByTenantId(tenantId: string): Promise<void> {
    await masterDb
      .delete(orgBranding)
      .where(eq(orgBranding.tenantId, tenantId));
  }

  /**
   * Check if branding configuration exists for a tenant
   */
  async exists(tenantId: string): Promise<boolean> {
    const results = await masterDb
      .select({ id: orgBranding.id })
      .from(orgBranding)
      .where(eq(orgBranding.tenantId, tenantId))
      .limit(1);

    return results.length > 0;
  }
}
