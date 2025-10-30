/**
 * Tenant Repository Interface
 *
 * Domain layer contract for tenant persistence.
 * Implementation will be in infrastructure layer using Drizzle ORM.
 */

import { Tenant } from '../tenants/tenant.entity';

export interface ITenantRepository {
  /**
   * Create a new tenant
   */
  create(tenant: Tenant): Promise<Tenant>;

  /**
   * Find tenant by ID
   */
  findById(id: string): Promise<Tenant | null>;

  /**
   * Find tenant by slug
   */
  findBySlug(slug: string): Promise<Tenant | null>;

  /**
   * Find tenant by subdomain
   */
  findBySubdomain(subdomain: string): Promise<Tenant | null>;

  /**
   * Find tenant by tenant ID (for mobile/desktop app authentication)
   * Format: COMPANY-XXXXXX (e.g., DEMO-A5L32W)
   */
  findByTenantId(tenantId: string): Promise<Tenant | null>;

  /**
   * Find all tenants with pagination
   */
  findAll(options: {
    page: number;
    limit: number;
    status?: string;
    subscriptionTier?: string;
  }): Promise<{ tenants: Tenant[]; total: number }>;

  /**
   * Update tenant
   */
  update(tenant: Tenant): Promise<Tenant>;

  /**
   * Delete tenant (soft delete)
   */
  delete(id: string): Promise<void>;

  /**
   * Check if slug exists
   */
  slugExists(slug: string): Promise<boolean>;

  /**
   * Check if subdomain exists
   */
  subdomainExists(subdomain: string): Promise<boolean>;

  /**
   * Get tenant count by status
   */
  countByStatus(status: string): Promise<number>;

  /**
   * Find tenants with expired trials
   */
  findExpiredTrials(): Promise<Tenant[]>;
}
