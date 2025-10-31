/**
 * Report Branding Repository Interface
 *
 * Defines persistence operations for report branding configuration.
 * Each tenant (organization) has one branding configuration.
 *
 * IMPORTANT: This repository works with the MASTER database (not tenant databases)
 * because branding is organizational metadata managed by WellPulse admins in the
 * admin portal (apps/admin).
 */

import { ReportBranding } from '../reporting/report-branding.entity';

export interface IReportBrandingRepository {
  /**
   * Find report branding by tenant ID
   * Queries the master database org_branding table
   */
  findByTenantId(tenantId: string): Promise<ReportBranding | null>;

  /**
   * Save report branding (create or update)
   * Saves to master database org_branding table
   */
  save(branding: ReportBranding): Promise<void>;

  /**
   * Delete report branding by tenant ID
   * Hard delete from master database
   */
  deleteByTenantId(tenantId: string): Promise<void>;

  /**
   * Check if tenant has branding configured
   * Queries master database for existence
   */
  exists(tenantId: string): Promise<boolean>;
}
