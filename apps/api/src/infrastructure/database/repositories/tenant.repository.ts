/**
 * Tenant Repository Implementation
 *
 * Drizzle ORM implementation of ITenantRepository.
 * Handles conversion between domain entities and database records.
 */

import { Injectable } from '@nestjs/common';
import { eq, and, isNull, lt, sql } from 'drizzle-orm';
import { masterDb } from '../master/client';
import { tenants } from '../master/schema';
import { ITenantRepository } from '../../../domain/repositories/tenant.repository.interface';
import { Tenant } from '../../../domain/tenants/tenant.entity';
import { TenantStatus } from '../../../domain/tenants/value-objects/tenant-status.vo';
import { SubscriptionTier } from '../../../domain/tenants/value-objects/subscription-tier.vo';
import { DatabaseConfig } from '../../../domain/tenants/value-objects/database-config.vo';

@Injectable()
export class TenantRepository implements ITenantRepository {
  async create(tenant: Tenant): Promise<Tenant> {
    const props = tenant.toPersistence();
    const dbConfig = props.databaseConfig.toPersistence();

    const [created] = await masterDb
      .insert(tenants)
      .values({
        id: props.id,
        slug: props.slug,
        subdomain: props.subdomain,
        name: props.name,
        databaseType: dbConfig.type,
        databaseUrl: dbConfig.url, // Should be encrypted before storage
        databaseName: dbConfig.name,
        databaseHost: dbConfig.host,
        databasePort: dbConfig.port,
        subscriptionTier: props.subscriptionTier.toString(),
        maxWells: props.maxWells,
        maxUsers: props.maxUsers,
        storageQuotaGb: props.storageQuotaGb,
        status: props.status.toString(),
        trialEndsAt: props.trialEndsAt,
        contactEmail: props.contactEmail,
        contactPhone: props.contactPhone,
        billingEmail: props.billingEmail,
        etlConfig: dbConfig.etlConfig,
        featureFlags: props.featureFlags,
        metadata: props.metadata,
        createdBy: props.createdBy,
      })
      .returning();

    return this.toDomain(created);
  }

  async findById(id: string): Promise<Tenant | null> {
    const result = await masterDb.query.tenants.findFirst({
      where: and(eq(tenants.id, id), isNull(tenants.deletedAt)),
    });

    return result ? this.toDomain(result) : null;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const result = await masterDb.query.tenants.findFirst({
      where: and(eq(tenants.slug, slug), isNull(tenants.deletedAt)),
    });

    return result ? this.toDomain(result) : null;
  }

  async findBySubdomain(subdomain: string): Promise<Tenant | null> {
    const result = await masterDb.query.tenants.findFirst({
      where: and(eq(tenants.subdomain, subdomain), isNull(tenants.deletedAt)),
    });

    return result ? this.toDomain(result) : null;
  }

  async findAll(options: {
    page: number;
    limit: number;
    status?: string;
    subscriptionTier?: string;
  }): Promise<{ tenants: Tenant[]; total: number }> {
    const offset = (options.page - 1) * options.limit;

    const conditions = [isNull(tenants.deletedAt)];

    if (options.status) {
      conditions.push(eq(tenants.status, options.status));
    }

    if (options.subscriptionTier) {
      conditions.push(eq(tenants.subscriptionTier, options.subscriptionTier));
    }

    const whereClause = and(...conditions);

    const [results, countResult] = await Promise.all([
      masterDb.query.tenants.findMany({
        where: whereClause,
        limit: options.limit,
        offset,
        orderBy: (tenants, { desc }) => [desc(tenants.createdAt)],
      }),
      masterDb
        .select({ count: sql<number>`count(*)` })
        .from(tenants)
        .where(whereClause),
    ]);

    return {
      tenants: results.map((r) => this.toDomain(r)),
      total: Number(countResult[0]?.count ?? 0),
    };
  }

  async update(tenant: Tenant): Promise<Tenant> {
    const props = tenant.toPersistence();
    const dbConfig = props.databaseConfig.toPersistence();

    const [updated] = await masterDb
      .update(tenants)
      .set({
        name: props.name,
        databaseType: dbConfig.type,
        databaseUrl: dbConfig.url,
        databaseName: dbConfig.name,
        databaseHost: dbConfig.host,
        databasePort: dbConfig.port,
        subscriptionTier: props.subscriptionTier.toString(),
        maxWells: props.maxWells,
        maxUsers: props.maxUsers,
        storageQuotaGb: props.storageQuotaGb,
        status: props.status.toString(),
        trialEndsAt: props.trialEndsAt,
        contactEmail: props.contactEmail,
        contactPhone: props.contactPhone,
        billingEmail: props.billingEmail,
        etlConfig: dbConfig.etlConfig,
        featureFlags: props.featureFlags,
        metadata: props.metadata,
        updatedAt: new Date(),
        deletedAt: props.deletedAt,
      })
      .where(eq(tenants.id, props.id))
      .returning();

    return this.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await masterDb
      .update(tenants)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id));
  }

  async slugExists(slug: string): Promise<boolean> {
    const result = await masterDb.query.tenants.findFirst({
      where: and(eq(tenants.slug, slug), isNull(tenants.deletedAt)),
    });

    return !!result;
  }

  async subdomainExists(subdomain: string): Promise<boolean> {
    const result = await masterDb.query.tenants.findFirst({
      where: and(eq(tenants.subdomain, subdomain), isNull(tenants.deletedAt)),
    });

    return !!result;
  }

  async countByStatus(status: string): Promise<number> {
    const result = await masterDb
      .select({ count: sql<number>`count(*)` })
      .from(tenants)
      .where(and(eq(tenants.status, status), isNull(tenants.deletedAt)));

    return Number(result[0]?.count ?? 0);
  }

  async findExpiredTrials(): Promise<Tenant[]> {
    const now = new Date();

    const results = await masterDb.query.tenants.findMany({
      where: and(
        eq(tenants.status, 'TRIAL'),
        lt(tenants.trialEndsAt, now),
        isNull(tenants.deletedAt),
      ),
    });

    return results.map((r) => this.toDomain(r));
  }

  /**
   * Convert database record to domain entity
   */
  private toDomain(record: typeof tenants.$inferSelect): Tenant {
    const databaseConfig = DatabaseConfig.create({
      type: record.databaseType as never,
      url: record.databaseUrl,
      name: record.databaseName,
      host: record.databaseHost ?? undefined,
      port: record.databasePort ?? undefined,
      etlConfig: record.etlConfig as Record<string, unknown> | undefined,
    });

    return Tenant.fromPersistence({
      id: record.id,
      slug: record.slug,
      subdomain: record.subdomain,
      name: record.name,
      databaseConfig,
      subscriptionTier: SubscriptionTier.fromString(record.subscriptionTier),
      status: TenantStatus.fromString(record.status),
      maxWells: record.maxWells,
      maxUsers: record.maxUsers,
      storageQuotaGb: record.storageQuotaGb,
      trialEndsAt: record.trialEndsAt ?? undefined,
      contactEmail: record.contactEmail,
      contactPhone: record.contactPhone ?? undefined,
      billingEmail: record.billingEmail ?? undefined,
      featureFlags:
        (record.featureFlags as Record<string, boolean>) ?? undefined,
      metadata: (record.metadata as Record<string, unknown>) ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt ?? undefined,
      createdBy: record.createdBy ?? undefined,
    });
  }
}
