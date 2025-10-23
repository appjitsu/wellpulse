/**
 * Create Tenant Command Handler
 *
 * Handles tenant creation with validation and database provisioning.
 */

import {
  Injectable,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { CreateTenantCommand } from './create-tenant.command';
import { ITenantRepository } from '../../../../domain/repositories/tenant.repository.interface';
import { Tenant } from '../../../../domain/tenants/tenant.entity';
import { TenantStatus } from '../../../../domain/tenants/value-objects/tenant-status.vo';
import { SubscriptionTier } from '../../../../domain/tenants/value-objects/subscription-tier.vo';
import { DatabaseConfig } from '../../../../domain/tenants/value-objects/database-config.vo';
import { TenantProvisioningService } from '../../../../infrastructure/services/tenant-provisioning.service';

@Injectable()
export class CreateTenantHandler {
  constructor(
    @Inject('ITenantRepository')
    private readonly tenantRepository: ITenantRepository,
    private readonly provisioningService: TenantProvisioningService,
  ) {}

  async execute(command: CreateTenantCommand): Promise<Tenant> {
    // Validate uniqueness
    await this.validateUniqueness(command);

    // Parse subscription tier
    const subscriptionTier = this.parseSubscriptionTier(
      command.subscriptionTier,
    );
    const tierLimits = subscriptionTier.getDefaultLimits();

    // Determine tenant status
    const status = command.trialDays
      ? TenantStatus.trial()
      : TenantStatus.active();

    // Calculate trial end date if applicable
    const trialEndsAt = command.trialDays
      ? new Date(Date.now() + command.trialDays * 24 * 60 * 60 * 1000)
      : undefined;

    // Create database configuration
    const databaseConfig = this.createDatabaseConfig(command);

    // Create tenant entity
    const tenant = Tenant.create({
      slug: command.slug,
      subdomain: command.subdomain,
      name: command.name,
      databaseConfig,
      subscriptionTier,
      status,
      maxWells: command.maxWells ?? tierLimits.maxWells,
      maxUsers: command.maxUsers ?? tierLimits.maxUsers,
      storageQuotaGb: command.storageQuotaGb ?? tierLimits.storageQuotaGb,
      trialEndsAt,
      contactEmail: command.contactEmail,
      contactPhone: command.contactPhone,
      billingEmail: command.billingEmail,
      featureFlags: this.getDefaultFeatureFlags(subscriptionTier),
      createdBy: command.createdBy,
    });

    // Provision tenant database BEFORE persisting tenant record
    // This ensures database exists before tenant is marked as active
    const provisioningResult =
      await this.provisioningService.provisionTenantDatabase(tenant);

    if (!provisioningResult.success) {
      throw new InternalServerErrorException(
        `Failed to provision tenant database: ${provisioningResult.error}`,
      );
    }

    // Update tenant's database configuration with actual provisioned URL
    // (In case there were any adjustments during provisioning)
    const updatedDatabaseConfig = DatabaseConfig.create({
      type: command.databaseType.toUpperCase() as never,
      url: provisioningResult.databaseUrl,
      name: provisioningResult.databaseName,
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    });

    // Create new tenant instance with updated database config
    const provisionedTenant = Tenant.create({
      slug: tenant.slug,
      subdomain: tenant.subdomain,
      name: tenant.name,
      databaseConfig: updatedDatabaseConfig,
      subscriptionTier: tenant.subscriptionTier,
      status: tenant.status,
      maxWells: tenant.maxWells,
      maxUsers: tenant.maxUsers,
      storageQuotaGb: tenant.storageQuotaGb,
      trialEndsAt: tenant.trialEndsAt,
      contactEmail: tenant.contactEmail,
      contactPhone: tenant.contactPhone,
      billingEmail: tenant.billingEmail,
      featureFlags: tenant.featureFlags,
      createdBy: tenant.createdBy,
    });

    // Persist tenant (database now exists and is ready)
    const createdTenant = await this.tenantRepository.create(provisionedTenant);

    return createdTenant;
  }

  private async validateUniqueness(
    command: CreateTenantCommand,
  ): Promise<void> {
    const [slugExists, subdomainExists] = await Promise.all([
      this.tenantRepository.slugExists(command.slug),
      this.tenantRepository.subdomainExists(command.subdomain),
    ]);

    if (slugExists) {
      throw new ConflictException(
        `Tenant with slug '${command.slug}' already exists`,
      );
    }

    if (subdomainExists) {
      throw new ConflictException(
        `Tenant with subdomain '${command.subdomain}' already exists`,
      );
    }
  }

  private parseSubscriptionTier(tier: string): SubscriptionTier {
    try {
      return SubscriptionTier.fromString(tier);
    } catch {
      throw new BadRequestException(
        `Invalid subscription tier: ${tier}. Must be one of: STARTER, PROFESSIONAL, ENTERPRISE, ENTERPRISE_PLUS`,
      );
    }
  }

  private createDatabaseConfig(command: CreateTenantCommand): DatabaseConfig {
    // Generate database name from slug
    const databaseName = `${command.slug.replace(/-/g, '_')}_wellpulse`;

    // Generate connection URL based on database type
    const databaseUrl = this.generateDatabaseUrl(
      command.databaseType,
      databaseName,
    );

    // Get default PostgreSQL host/port (can be overridden later)
    const host = process.env.POSTGRES_HOST || 'localhost';
    const port = parseInt(process.env.POSTGRES_PORT || '5432', 10);

    return DatabaseConfig.create({
      type: command.databaseType.toUpperCase() as never,
      url: databaseUrl, // TODO: Encrypt before storage
      name: databaseName,
      host,
      port,
    });
  }

  private generateDatabaseUrl(type: string, databaseName: string): string {
    const normalizedType = type.toUpperCase();

    switch (normalizedType) {
      case 'POSTGRESQL': {
        const pgHost = process.env.POSTGRES_HOST || 'localhost';
        const pgPort = process.env.POSTGRES_PORT || '5432';
        const pgUser = process.env.POSTGRES_USER || 'wellpulse';
        const pgPassword = process.env.POSTGRES_PASSWORD || 'wellpulse';
        return `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${databaseName}`;
      }

      case 'SQL_SERVER':
        throw new BadRequestException('SQL Server support not yet implemented');

      case 'MYSQL':
        throw new BadRequestException('MySQL support not yet implemented');

      case 'ORACLE':
        throw new BadRequestException('Oracle support not yet implemented');

      case 'ETL_SYNCED': {
        // For ETL, we still create a PostgreSQL database for WellPulse data
        const etlHost = process.env.POSTGRES_HOST || 'localhost';
        const etlPort = process.env.POSTGRES_PORT || '5432';
        const etlUser = process.env.POSTGRES_USER || 'wellpulse';
        const etlPassword = process.env.POSTGRES_PASSWORD || 'wellpulse';
        return `postgresql://${etlUser}:${etlPassword}@${etlHost}:${etlPort}/${databaseName}`;
      }

      default:
        throw new BadRequestException(
          `Invalid database type: ${type}. Must be one of: POSTGRESQL, SQL_SERVER, MYSQL, ORACLE, ETL_SYNCED`,
        );
    }
  }

  private getDefaultFeatureFlags(
    tier: SubscriptionTier,
  ): Record<string, boolean> {
    return {
      enableMlPredictions: tier.hasAdvancedML(),
      enableOfflineSync: true, // Available to all tiers
      enableAdvancedReporting: tier.hasAdvancedML(),
      enableCustomIntegrations: tier.hasCustomIntegrations(),
      enableETLSync: tier.hasETLSync(),
      enableMultiDatabase: tier.hasMultiDatabase(),
      enablePrioritySupport: tier.hasPrioritySupport(),
    };
  }
}
