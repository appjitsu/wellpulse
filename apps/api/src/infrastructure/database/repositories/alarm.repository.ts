import { Injectable } from '@nestjs/common';
import { eq, and, ne, sql } from 'drizzle-orm';
import {
  IAlarmRepository,
  AlarmFilters,
} from '../../../domain/repositories/alarm.repository.interface';
import {
  Alarm,
  AlarmSeverity,
  AlarmState,
  AlarmType,
} from '../../../domain/scada/alarm.entity';
import { TenantDatabaseService } from '../tenant-database.service';
import * as tenantSchema from '../schema/tenant';

/**
 * Alarm Repository Implementation
 *
 * Implements alarm data access layer with:
 * - Full alarm lifecycle tracking (ACTIVE � ACKNOWLEDGED � CLEARED)
 * - Efficient filtering by state, severity, well, and connection
 * - Retriggering support (find and update existing alarms)
 * - Active alarm queries optimized for dashboard display
 * - Acknowledgment and clearance tracking
 *
 * Architecture:
 * - All alarms stored in tenant database (tenant-isolated)
 * - JSON storage for polymorphic alarm values
 * - Optimized indexes for state and severity queries
 * - Composite index for retriggering detection
 */
@Injectable()
export class AlarmRepository implements IAlarmRepository {
  constructor(private readonly tenantDb: TenantDatabaseService) {}

  // ============================================================================
  // Core CRUD Operations
  // ============================================================================

  async findById(tenantId: string, alarmId: string): Promise<Alarm | null> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = await db
      .select()
      .from(tenantSchema.alarms)
      .where(
        and(
          eq(tenantSchema.alarms.id, alarmId),
          eq(tenantSchema.alarms.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;

    return this.toDomain(rows[0]);
  }

  async findActive(tenantId: string, filters?: AlarmFilters): Promise<Alarm[]> {
    return this.findByState(tenantId, 'ACTIVE', filters);
  }

  async findByState(
    tenantId: string,
    state: AlarmState,
    filters?: AlarmFilters,
  ): Promise<Alarm[]> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    // Build WHERE conditions
    const conditions = [
      eq(tenantSchema.alarms.tenantId, tenantId),
      eq(tenantSchema.alarms.state, state),
    ];

    if (filters?.wellId) {
      conditions.push(eq(tenantSchema.alarms.wellId, filters.wellId));
    }

    if (filters?.scadaConnectionId) {
      conditions.push(
        eq(tenantSchema.alarms.scadaConnectionId, filters.scadaConnectionId),
      );
    }

    if (filters?.severity) {
      conditions.push(eq(tenantSchema.alarms.severity, filters.severity));
    }

    if (filters?.tagName) {
      conditions.push(eq(tenantSchema.alarms.tagName, filters.tagName));
    }

    const rows = await db
      .select()
      .from(tenantSchema.alarms)
      .where(and(...conditions));

    return rows.map((row) => this.toDomain(row));
  }

  async findWithFilters(
    tenantId: string,
    filters: AlarmFilters,
  ): Promise<Alarm[]> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    // Build WHERE conditions
    const conditions = [eq(tenantSchema.alarms.tenantId, tenantId)];

    if (filters.wellId) {
      conditions.push(eq(tenantSchema.alarms.wellId, filters.wellId));
    }

    if (filters.scadaConnectionId) {
      conditions.push(
        eq(tenantSchema.alarms.scadaConnectionId, filters.scadaConnectionId),
      );
    }

    if (filters.severity) {
      conditions.push(eq(tenantSchema.alarms.severity, filters.severity));
    }

    if (filters.state) {
      conditions.push(eq(tenantSchema.alarms.state, filters.state));
    }

    if (filters.tagName) {
      conditions.push(eq(tenantSchema.alarms.tagName, filters.tagName));
    }

    const rows = await db
      .select()
      .from(tenantSchema.alarms)
      .where(and(...conditions));

    return rows.map((row) => this.toDomain(row));
  }

  async findExistingAlarm(
    tenantId: string,
    wellId: string,
    scadaConnectionId: string,
    tagName: string,
    alarmType: string,
  ): Promise<Alarm | null> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    // Find an alarm that hasn't been cleared for the same condition
    const rows = await db
      .select()
      .from(tenantSchema.alarms)
      .where(
        and(
          eq(tenantSchema.alarms.tenantId, tenantId),
          eq(tenantSchema.alarms.wellId, wellId),
          eq(tenantSchema.alarms.scadaConnectionId, scadaConnectionId),
          eq(tenantSchema.alarms.tagName, tagName),
          eq(tenantSchema.alarms.alarmType, alarmType),
          ne(tenantSchema.alarms.state, 'CLEARED'), // Not cleared
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;

    return this.toDomain(rows[0]);
  }

  async save(alarm: Alarm): Promise<void> {
    const db = await this.tenantDb.getTenantDatabase(alarm.tenantId);

    const row = this.toRow(alarm);

    // Upsert: insert or update if exists
    await db
      .insert(tenantSchema.alarms)
      .values(row)
      .onConflictDoUpdate({
        target: tenantSchema.alarms.id,
        set: {
          state: row.state,
          value: row.value,
          triggerCount: row.triggerCount,
          lastTriggeredAt: row.lastTriggeredAt,
          acknowledgedAt: row.acknowledgedAt,
          acknowledgedBy: row.acknowledgedBy,
          clearedAt: row.clearedAt,
          metadata: row.metadata,
          updatedAt: row.updatedAt,
        },
      });
  }

  async countActiveBySeverity(
    tenantId: string,
    severity?: AlarmSeverity,
  ): Promise<number> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const conditions = [
      eq(tenantSchema.alarms.tenantId, tenantId),
      eq(tenantSchema.alarms.state, 'ACTIVE'),
    ];

    if (severity) {
      conditions.push(eq(tenantSchema.alarms.severity, severity));
    }

    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenantSchema.alarms)
      .where(and(...conditions));

    return result[0]?.count ?? 0;
  }

  async countActiveForWell(tenantId: string, wellId: string): Promise<number> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenantSchema.alarms)
      .where(
        and(
          eq(tenantSchema.alarms.tenantId, tenantId),
          eq(tenantSchema.alarms.wellId, wellId),
          eq(tenantSchema.alarms.state, 'ACTIVE'),
        ),
      );

    return result[0]?.count ?? 0;
  }

  async delete(tenantId: string, alarmId: string): Promise<void> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    await db
      .delete(tenantSchema.alarms)
      .where(
        and(
          eq(tenantSchema.alarms.id, alarmId),
          eq(tenantSchema.alarms.tenantId, tenantId),
        ),
      );
  }

  // ============================================================================
  // Mappers (Domain � Database)
  // ============================================================================

  /**
   * Convert database row to domain entity
   */
  private toDomain(row: tenantSchema.AlarmRow): Alarm {
    // Parse JSON value back to primitive (if present)
    const value = row.value
      ? (row.value as number | string | boolean)
      : undefined;

    return Alarm.fromPrimitives({
      id: row.id,
      tenantId: row.tenantId,
      wellId: row.wellId,
      scadaConnectionId: row.scadaConnectionId,
      tagName: row.tagName,
      alarmType: row.alarmType as AlarmType,
      severity: row.severity as AlarmSeverity,
      state: row.state as AlarmState,
      message: row.message,
      value,
      threshold: row.threshold ?? undefined,
      triggerCount: row.triggerCount,
      firstTriggeredAt: row.firstTriggeredAt,
      lastTriggeredAt: row.lastTriggeredAt,
      acknowledgedAt: row.acknowledgedAt ?? undefined,
      acknowledgedBy: row.acknowledgedBy ?? undefined,
      clearedAt: row.clearedAt ?? undefined,
      metadata: (row.metadata as Record<string, unknown>) ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  /**
   * Convert domain entity to database row
   */
  private toRow(alarm: Alarm): tenantSchema.NewAlarmRow {
    const primitives = alarm.toPrimitives();

    return {
      id: primitives.id,
      tenantId: primitives.tenantId,
      wellId: primitives.wellId,
      scadaConnectionId: primitives.scadaConnectionId,
      tagName: primitives.tagName,
      alarmType: primitives.alarmType,
      severity: primitives.severity,
      state: primitives.state,
      message: primitives.message,
      value: primitives.value ?? null, // Will be stored as JSONB
      threshold: primitives.threshold ?? null,
      triggerCount: primitives.triggerCount,
      firstTriggeredAt: primitives.firstTriggeredAt,
      lastTriggeredAt: primitives.lastTriggeredAt,
      acknowledgedAt: primitives.acknowledgedAt ?? null,
      acknowledgedBy: primitives.acknowledgedBy ?? null,
      clearedAt: primitives.clearedAt ?? null,
      metadata: primitives.metadata ?? null,
      createdAt: primitives.createdAt,
      updatedAt: primitives.updatedAt,
    };
  }
}
