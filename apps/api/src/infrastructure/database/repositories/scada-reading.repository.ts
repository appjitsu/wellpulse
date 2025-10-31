import { Injectable } from '@nestjs/common';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import {
  IScadaReadingRepository,
  ScadaReadingFilters,
} from '../../../domain/repositories/scada-reading.repository.interface';
import {
  ScadaReading,
  ReadingDataType,
  ReadingQuality,
} from '../../../domain/scada/scada-reading.entity';
import { TenantDatabaseService } from '../tenant-database.service';
import * as tenantSchema from '../schema/tenant';

/**
 * SCADA Reading Repository Implementation
 *
 * Implements SCADA reading data access layer with:
 * - High-performance time-series queries optimized for TimescaleDB
 * - Batch insert support for high-frequency data ingestion (500K+ tags/second)
 * - Efficient filtering by well, connection, tag, and time range
 * - Tenant-isolated reading storage
 * - Data retention policy support
 *
 * Architecture:
 * - All readings stored in tenant database (tenant-isolated)
 * - JSON storage for polymorphic values (number, string, boolean)
 * - Optimized indexes for time-series queries
 * - No updates (append-only time-series data)
 */
@Injectable()
export class ScadaReadingRepository implements IScadaReadingRepository {
  constructor(private readonly tenantDb: TenantDatabaseService) {}

  // ============================================================================
  // Core CRUD Operations
  // ============================================================================

  async create(reading: ScadaReading): Promise<void> {
    const db = await this.tenantDb.getTenantDatabase(reading.tenantId);

    const row = this.toRow(reading);

    await db.insert(tenantSchema.scadaReadings).values(row);
  }

  async createBatch(readings: ScadaReading[]): Promise<void> {
    if (readings.length === 0) return;

    const tenantId = readings[0].tenantId;
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = readings.map((reading) => this.toRow(reading));

    // Batch insert for optimal performance
    await db.insert(tenantSchema.scadaReadings).values(rows);
  }

  async findById(
    tenantId: string,
    readingId: string,
  ): Promise<ScadaReading | null> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = await db
      .select()
      .from(tenantSchema.scadaReadings)
      .where(
        and(
          eq(tenantSchema.scadaReadings.id, readingId),
          eq(tenantSchema.scadaReadings.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;

    return this.toDomain(rows[0]);
  }

  async findWithFilters(
    tenantId: string,
    filters: ScadaReadingFilters,
  ): Promise<ScadaReading[]> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    // Build WHERE conditions dynamically
    const conditions = [eq(tenantSchema.scadaReadings.tenantId, tenantId)];

    if (filters.wellId) {
      conditions.push(eq(tenantSchema.scadaReadings.wellId, filters.wellId));
    }

    if (filters.scadaConnectionId) {
      conditions.push(
        eq(
          tenantSchema.scadaReadings.scadaConnectionId,
          filters.scadaConnectionId,
        ),
      );
    }

    if (filters.tagName) {
      conditions.push(eq(tenantSchema.scadaReadings.tagName, filters.tagName));
    }

    if (filters.startTime) {
      conditions.push(
        gte(tenantSchema.scadaReadings.timestamp, filters.startTime),
      );
    }

    if (filters.endTime) {
      conditions.push(
        lte(tenantSchema.scadaReadings.timestamp, filters.endTime),
      );
    }

    // Build query with limit/offset applied separately
    const baseQuery = db
      .select()
      .from(tenantSchema.scadaReadings)
      .where(and(...conditions))
      .orderBy(desc(tenantSchema.scadaReadings.timestamp));

    // Execute with limit and offset
    const rows = await baseQuery
      .limit(filters.limit ?? 100)
      .offset(filters.offset ?? 0);

    return rows.map((row) => this.toDomain(row));
  }

  async findLatestByTag(
    tenantId: string,
    scadaConnectionId: string,
    tagName: string,
  ): Promise<ScadaReading | null> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = await db
      .select()
      .from(tenantSchema.scadaReadings)
      .where(
        and(
          eq(tenantSchema.scadaReadings.tenantId, tenantId),
          eq(tenantSchema.scadaReadings.scadaConnectionId, scadaConnectionId),
          eq(tenantSchema.scadaReadings.tagName, tagName),
        ),
      )
      .orderBy(desc(tenantSchema.scadaReadings.timestamp))
      .limit(1);

    if (rows.length === 0) return null;

    return this.toDomain(rows[0]);
  }

  async findByWellIdAndTimeRange(
    tenantId: string,
    wellId: string,
    startTime: Date,
    endTime: Date,
    limit?: number,
  ): Promise<ScadaReading[]> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const baseQuery = db
      .select()
      .from(tenantSchema.scadaReadings)
      .where(
        and(
          eq(tenantSchema.scadaReadings.tenantId, tenantId),
          eq(tenantSchema.scadaReadings.wellId, wellId),
          gte(tenantSchema.scadaReadings.timestamp, startTime),
          lte(tenantSchema.scadaReadings.timestamp, endTime),
        ),
      )
      .orderBy(desc(tenantSchema.scadaReadings.timestamp));

    const rows = await (limit ? baseQuery.limit(limit) : baseQuery);

    return rows.map((row) => this.toDomain(row));
  }

  async countByConnectionId(
    tenantId: string,
    scadaConnectionId: string,
  ): Promise<number> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenantSchema.scadaReadings)
      .where(
        and(
          eq(tenantSchema.scadaReadings.tenantId, tenantId),
          eq(tenantSchema.scadaReadings.scadaConnectionId, scadaConnectionId),
        ),
      );

    return result[0]?.count ?? 0;
  }

  async deleteOlderThan(cutoffDate: Date): Promise<number> {
    // This method deletes across all tenants (for retention policy job)
    // In a multi-tenant system, this would typically be run per tenant
    // For now, we'll throw an error as this needs careful implementation

    throw new Error(
      'deleteOlderThan not yet implemented - requires multi-tenant iteration',
    );

    // Future implementation would:
    // 1. Get all tenant IDs from master database
    // 2. For each tenant:
    //    - Get tenant DB connection
    //    - Delete readings older than cutoffDate
    //    - Track total deleted count
    // 3. Return total deleted count
  }

  // ============================================================================
  // Mappers (Domain � Database)
  // ============================================================================

  /**
   * Convert database row to domain entity
   */
  private toDomain(row: tenantSchema.ScadaReadingRow): ScadaReading {
    // Parse JSON value back to primitive
    const value = row.value as number | string | boolean;

    return ScadaReading.fromPrimitives({
      id: row.id,
      tenantId: row.tenantId,
      wellId: row.wellId,
      scadaConnectionId: row.scadaConnectionId,
      tagName: row.tagName,
      value,
      dataType: row.dataType as ReadingDataType,
      quality: row.quality as ReadingQuality,
      timestamp: row.timestamp,
      unit: row.unit ?? undefined,
      minValue: row.minValue ?? undefined,
      maxValue: row.maxValue ?? undefined,
      metadata: (row.metadata as Record<string, unknown>) ?? undefined,
    });
  }

  /**
   * Convert domain entity to database row
   */
  private toRow(reading: ScadaReading): tenantSchema.NewScadaReadingRow {
    const primitives = reading.toPrimitives();

    return {
      id: primitives.id,
      tenantId: primitives.tenantId,
      wellId: primitives.wellId,
      scadaConnectionId: primitives.scadaConnectionId,
      tagName: primitives.tagName,
      value: primitives.value, // Will be stored as JSONB
      dataType: primitives.dataType,
      quality: primitives.quality,
      timestamp: primitives.timestamp,
      unit: primitives.unit ?? null,
      minValue: primitives.minValue ?? null,
      maxValue: primitives.maxValue ?? null,
      metadata: primitives.metadata ?? null,
    };
  }
}
