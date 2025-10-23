/**
 * Tenant Response DTO
 *
 * Data Transfer Object for tenant API responses.
 * Converts domain entity to JSON-serializable format.
 */

import { Tenant } from '../../../domain/tenants/tenant.entity';

export class TenantResponseDto {
  id: string;
  slug: string;
  subdomain: string;
  name: string;

  database: {
    type: string;
    name: string;
    host?: string;
    port?: number;
  };

  subscription: {
    tier: string;
    maxWells: number;
    maxUsers: number;
    storageQuotaGb: number;
  };

  status: string;
  trialEndsAt?: Date;

  contact: {
    email: string;
    phone?: string;
    billingEmail?: string;
  };

  featureFlags?: Record<string, boolean>;
  metadata?: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;

  static fromDomain(tenant: Tenant): TenantResponseDto {
    const dto = new TenantResponseDto();

    dto.id = tenant.id;
    dto.slug = tenant.slug;
    dto.subdomain = tenant.subdomain;
    dto.name = tenant.name;

    dto.database = {
      type: tenant.databaseConfig.type,
      name: tenant.databaseConfig.name,
      host: tenant.databaseConfig.host,
      port: tenant.databaseConfig.port,
    };

    dto.subscription = {
      tier: tenant.subscriptionTier.toString(),
      maxWells: tenant.maxWells,
      maxUsers: tenant.maxUsers,
      storageQuotaGb: tenant.storageQuotaGb,
    };

    dto.status = tenant.status.toString();
    dto.trialEndsAt = tenant.trialEndsAt;

    dto.contact = {
      email: tenant.contactEmail,
      phone: tenant.contactPhone,
      billingEmail: tenant.billingEmail,
    };

    dto.featureFlags = tenant.featureFlags;
    dto.metadata = tenant.metadata;

    dto.createdAt = tenant.createdAt;
    dto.updatedAt = tenant.updatedAt;
    dto.createdBy = tenant.createdBy;

    return dto;
  }
}
