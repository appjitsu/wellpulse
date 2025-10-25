/**
 * Well Repository Implementation
 *
 * Drizzle ORM implementation of IWellRepository.
 * Handles conversion between domain entities and database records using WellMapper.
 *
 * Multi-Tenancy Architecture:
 * - Requires tenantId for all operations to ensure tenant isolation
 * - Uses TenantDatabaseService to get tenant-specific database connection
 * - Each tenant has their own isolated wells table in their dedicated database
 */

import { Injectable } from '@nestjs/common';
import { eq, and, isNull, sql, or, ilike } from 'drizzle-orm';
import { IWellRepository } from '../../../domain/repositories/well.repository.interface';
import { Well, WellStatus } from '../../../domain/wells/well.entity';
import { WellMapper } from './mappers/well.mapper';
import { wells } from '../schema/tenant/wells.schema';
import { TenantDatabaseService } from '../tenant-database.service';

@Injectable()
export class WellRepository implements IWellRepository {
  constructor(private readonly tenantDbService: TenantDatabaseService) {}

  /**
   * Save a new well to tenant database
   */
  async save(
    tenantId: string,
    well: Well,
    databaseName?: string,
  ): Promise<void> {
    const db = await this.tenantDbService.getTenantDatabase(
      tenantId,
      databaseName,
    );
    const data = WellMapper.toPersistence(well);

    await db.insert(wells).values(data);
  }

  /**
   * Find well by ID within tenant
   * Respects soft deletes (deletedAt must be null)
   */
  async findById(
    tenantId: string,
    wellId: string,
    databaseName?: string,
  ): Promise<Well | null> {
    const db = await this.tenantDbService.getTenantDatabase(
      tenantId,
      databaseName,
    );

    const results = await db
      .select()
      .from(wells)
      .where(and(eq(wells.id, wellId), isNull(wells.deletedAt)))
      .limit(1);

    return results[0] ? WellMapper.toDomain(results[0]) : null;
  }

  /**
   * Find well by API number within tenant
   * Respects soft deletes (deletedAt must be null)
   */
  async findByApiNumber(
    tenantId: string,
    apiNumber: string,
    databaseName?: string,
  ): Promise<Well | null> {
    const db = await this.tenantDbService.getTenantDatabase(
      tenantId,
      databaseName,
    );

    const results = await db
      .select()
      .from(wells)
      .where(and(eq(wells.apiNumber, apiNumber), isNull(wells.deletedAt)))
      .limit(1);

    return results[0] ? WellMapper.toDomain(results[0]) : null;
  }

  /**
   * Find all wells within tenant with optional filters
   * Supports pagination, status filtering, and search
   */
  async findAll(
    tenantId: string,
    filters?: {
      status?: WellStatus;
      lease?: string;
      field?: string;
      operator?: string;
      search?: string;
      limit?: number;
      offset?: number;
      databaseName?: string;
    },
  ): Promise<Well[]> {
    const db = await this.tenantDbService.getTenantDatabase(
      tenantId,
      filters?.databaseName,
    );

    const conditions = [isNull(wells.deletedAt)];

    if (filters?.status) {
      conditions.push(eq(wells.status, filters.status));
    }

    if (filters?.lease) {
      conditions.push(eq(wells.lease, filters.lease));
    }

    if (filters?.field) {
      conditions.push(eq(wells.field, filters.field));
    }

    if (filters?.operator) {
      conditions.push(eq(wells.operator, filters.operator));
    }

    // Search by name or API number
    if (filters?.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(wells.name, searchPattern),
          ilike(wells.apiNumber, searchPattern),
        )!,
      );
    }

    const whereClause = and(...conditions);

    const results = await db
      .select()
      .from(wells)
      .where(whereClause)
      .orderBy(wells.createdAt) // Most recent first (DESC)
      .limit(filters?.limit ?? 100)
      .offset(filters?.offset ?? 0);

    return results.map((r) => WellMapper.toDomain(r));
  }

  /**
   * Count wells within tenant with optional filters
   */
  async count(
    tenantId: string,
    filters?: {
      status?: WellStatus;
      lease?: string;
      field?: string;
      operator?: string;
      search?: string;
      databaseName?: string;
    },
  ): Promise<number> {
    const db = await this.tenantDbService.getTenantDatabase(
      tenantId,
      filters?.databaseName,
    );

    const conditions = [isNull(wells.deletedAt)];

    if (filters?.status) {
      conditions.push(eq(wells.status, filters.status));
    }

    if (filters?.lease) {
      conditions.push(eq(wells.lease, filters.lease));
    }

    if (filters?.field) {
      conditions.push(eq(wells.field, filters.field));
    }

    if (filters?.operator) {
      conditions.push(eq(wells.operator, filters.operator));
    }

    // Search by name or API number
    if (filters?.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(wells.name, searchPattern),
          ilike(wells.apiNumber, searchPattern),
        )!,
      );
    }

    const whereClause = and(...conditions);

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(wells)
      .where(whereClause);

    return Number(result[0]?.count ?? 0);
  }

  /**
   * Update existing well in tenant database
   * Updates all well properties except ID and createdAt
   */
  async update(
    tenantId: string,
    well: Well,
    databaseName?: string,
  ): Promise<void> {
    const db = await this.tenantDbService.getTenantDatabase(
      tenantId,
      databaseName,
    );
    const data = WellMapper.toPersistence(well);

    await db
      .update(wells)
      .set({
        name: data.name,
        // API number is immutable - do not update
        latitude: data.latitude,
        longitude: data.longitude,
        status: data.status,
        lease: data.lease,
        field: data.field,
        operator: data.operator,
        spudDate: data.spudDate,
        completionDate: data.completionDate,
        metadata: data.metadata,
        updatedBy: data.updatedBy,
        updatedAt: new Date(),
      })
      .where(eq(wells.id, well.id));
  }

  /**
   * Delete well (soft delete) in tenant database
   * Sets deletedAt timestamp and deletedBy user
   */
  async delete(
    tenantId: string,
    wellId: string,
    deletedBy: string,
    databaseName?: string,
  ): Promise<void> {
    const db = await this.tenantDbService.getTenantDatabase(
      tenantId,
      databaseName,
    );

    await db
      .update(wells)
      .set({
        deletedAt: new Date(),
        deletedBy: deletedBy,
        updatedAt: new Date(),
      })
      .where(eq(wells.id, wellId));
  }

  /**
   * Check if API number exists within tenant
   * Respects soft deletes (deletedAt must be null)
   * Optionally exclude a specific well ID (for update validation)
   */
  async existsByApiNumber(
    tenantId: string,
    apiNumber: string,
    excludeWellId?: string,
    databaseName?: string,
  ): Promise<boolean> {
    const db = await this.tenantDbService.getTenantDatabase(
      tenantId,
      databaseName,
    );

    const conditions = [
      eq(wells.apiNumber, apiNumber),
      isNull(wells.deletedAt),
    ];

    // Exclude specific well ID (used during updates to avoid false positives)
    if (excludeWellId) {
      conditions.push(sql`${wells.id} != ${excludeWellId}`);
    }

    const whereClause = and(...conditions);

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(wells)
      .where(whereClause);

    return Number(result[0]?.count ?? 0) > 0;
  }
}
