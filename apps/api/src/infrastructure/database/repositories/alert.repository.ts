import { Injectable } from '@nestjs/common';
import { eq, and, gte, lte, isNull, desc, sql } from 'drizzle-orm';
import {
  IAlertRepository,
  AlertFilters,
  PaginationOptions,
  PaginatedAlerts,
} from '../../../domain/repositories/alert.repository.interface';
import {
  Alert,
  AlertSeverity,
  AlertType,
} from '../../../domain/alert/alert.entity';
import { TenantDatabaseService } from '../tenant-database.service';
import * as tenantSchema from '../schema/tenant';

/**
 * Alert Repository Implementation
 *
 * Implements alert data access layer with:
 * - Immutable alert creation (alerts never change once created)
 * - Acknowledgement tracking (adds metadata without modifying original)
 * - Filtering and pagination for dashboard queries
 * - Statistics aggregation for KPIs
 * - Time-series trend data for charting
 *
 * Architecture:
 * - All alerts stored in tenant database (tenant-isolated)
 * - Optimized indexes for common queries (unacknowledged, severity, time range)
 * - JSONB metadata for flexible context storage
 */
@Injectable()
export class AlertRepository implements IAlertRepository {
  constructor(private readonly tenantDb: TenantDatabaseService) {}

  // ============================================================================
  // Core CRUD Operations
  // ============================================================================

  async create(alert: Alert): Promise<Alert> {
    const db = await this.tenantDb.getTenantDatabase(alert.tenantId);

    const row = this.toRow(alert);

    await db.insert(tenantSchema.alerts).values(row);

    return alert;
  }

  async findById(tenantId: string, alertId: string): Promise<Alert | null> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = await db
      .select()
      .from(tenantSchema.alerts)
      .where(
        and(
          eq(tenantSchema.alerts.id, alertId),
          eq(tenantSchema.alerts.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;

    return this.toDomain(rows[0]);
  }

  // ============================================================================
  // Filtering and Pagination
  // ============================================================================

  async findWithFilters(
    tenantId: string,
    filters: AlertFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedAlerts> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const conditions = this.buildWhereConditions(tenantId, filters);

    // Count total matching alerts
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenantSchema.alerts)
      .where(and(...conditions));

    const total = countResult[0]?.count ?? 0;

    // Fetch paginated results
    const offset = (pagination.page - 1) * pagination.limit;
    const rows = await db
      .select()
      .from(tenantSchema.alerts)
      .where(and(...conditions))
      .orderBy(desc(tenantSchema.alerts.createdAt))
      .limit(pagination.limit)
      .offset(offset);

    const alerts = rows.map((row) => this.toDomain(row));

    return {
      alerts,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  // ============================================================================
  // Statistics and Aggregations
  // ============================================================================

  async countUnacknowledged(
    tenantId: string,
    severity?: AlertSeverity,
  ): Promise<number> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const conditions = [
      eq(tenantSchema.alerts.tenantId, tenantId),
      isNull(tenantSchema.alerts.acknowledgedAt),
    ];

    if (severity) {
      conditions.push(eq(tenantSchema.alerts.severity, severity));
    }

    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenantSchema.alerts)
      .where(and(...conditions));

    return result[0]?.count ?? 0;
  }

  async countUnacknowledgedForWell(
    tenantId: string,
    wellId: string,
  ): Promise<number> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenantSchema.alerts)
      .where(
        and(
          eq(tenantSchema.alerts.tenantId, tenantId),
          eq(tenantSchema.alerts.wellId, wellId),
          isNull(tenantSchema.alerts.acknowledgedAt),
        ),
      );

    return result[0]?.count ?? 0;
  }

  async getRecentUnacknowledged(
    tenantId: string,
    limit: number,
  ): Promise<Alert[]> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const rows = await db
      .select()
      .from(tenantSchema.alerts)
      .where(
        and(
          eq(tenantSchema.alerts.tenantId, tenantId),
          isNull(tenantSchema.alerts.acknowledgedAt),
          gte(tenantSchema.alerts.createdAt, twentyFourHoursAgo),
        ),
      )
      .orderBy(desc(tenantSchema.alerts.createdAt))
      .limit(limit);

    return rows.map((row) => this.toDomain(row));
  }

  async getAlertStats(tenantId: string): Promise<{
    total: number;
    unacknowledged: number;
    critical: number;
    warning: number;
    info: number;
  }> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    // Get counts by severity and acknowledgement status in a single query
    const result = await db
      .select({
        severity: tenantSchema.alerts.severity,
        acknowledged: sql<boolean>`${tenantSchema.alerts.acknowledgedAt} IS NOT NULL`,
        count: sql<number>`count(*)::int`,
      })
      .from(tenantSchema.alerts)
      .where(eq(tenantSchema.alerts.tenantId, tenantId))
      .groupBy(
        tenantSchema.alerts.severity,
        sql`${tenantSchema.alerts.acknowledgedAt} IS NOT NULL`,
      );

    // Aggregate results
    let total = 0;
    let unacknowledged = 0;
    let critical = 0;
    let warning = 0;
    let info = 0;

    for (const row of result) {
      const count = row.count;
      total += count;

      if (!row.acknowledged) {
        unacknowledged += count;
      }

      if (row.severity === 'critical') {
        critical += count;
      } else if (row.severity === 'warning') {
        warning += count;
      } else if (row.severity === 'info') {
        info += count;
      }
    }

    return {
      total,
      unacknowledged,
      critical,
      warning,
      info,
    };
  }

  async getAlertTrend(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ date: string; count: number; severity: AlertSeverity }>> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    // Group alerts by date and severity
    const result = await db
      .select({
        date: sql<string>`DATE(${tenantSchema.alerts.createdAt})`,
        severity: tenantSchema.alerts.severity,
        count: sql<number>`count(*)::int`,
      })
      .from(tenantSchema.alerts)
      .where(
        and(
          eq(tenantSchema.alerts.tenantId, tenantId),
          gte(tenantSchema.alerts.createdAt, startDate),
          lte(tenantSchema.alerts.createdAt, endDate),
        ),
      )
      .groupBy(
        sql`DATE(${tenantSchema.alerts.createdAt})`,
        tenantSchema.alerts.severity,
      )
      .orderBy(sql`DATE(${tenantSchema.alerts.createdAt})`);

    return result.map((row) => ({
      date: row.date,
      count: row.count,
      severity: row.severity as AlertSeverity,
    }));
  }

  // ============================================================================
  // Acknowledgement
  // ============================================================================

  async acknowledge(alert: Alert): Promise<Alert> {
    if (!alert.isAcknowledged()) {
      throw new Error('Alert must be acknowledged before saving');
    }

    const db = await this.tenantDb.getTenantDatabase(alert.tenantId);

    await db
      .update(tenantSchema.alerts)
      .set({
        acknowledgedAt: alert.acknowledgedAt ?? null,
        acknowledgedBy: alert.acknowledgedBy ?? null,
        metadata: alert.metadata ?? null,
      })
      .where(
        and(
          eq(tenantSchema.alerts.id, alert.id),
          eq(tenantSchema.alerts.tenantId, alert.tenantId),
        ),
      );

    return alert;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private buildWhereConditions(tenantId: string, filters: AlertFilters) {
    const conditions = [eq(tenantSchema.alerts.tenantId, tenantId)];

    if (filters.wellId) {
      conditions.push(eq(tenantSchema.alerts.wellId, filters.wellId));
    }

    if (filters.severity) {
      conditions.push(eq(tenantSchema.alerts.severity, filters.severity));
    }

    if (filters.alertType) {
      conditions.push(eq(tenantSchema.alerts.alertType, filters.alertType));
    }

    if (filters.acknowledged === true) {
      conditions.push(sql`${tenantSchema.alerts.acknowledgedAt} IS NOT NULL`);
    } else if (filters.acknowledged === false) {
      conditions.push(isNull(tenantSchema.alerts.acknowledgedAt));
    }

    if (filters.startDate) {
      conditions.push(gte(tenantSchema.alerts.createdAt, filters.startDate));
    }

    if (filters.endDate) {
      conditions.push(lte(tenantSchema.alerts.createdAt, filters.endDate));
    }

    return conditions;
  }

  // ============================================================================
  // Mappers (Database Rows <-> Domain Entities)
  // ============================================================================

  private toDomain(row: typeof tenantSchema.alerts.$inferSelect): Alert {
    const alertType = row.alertType as AlertType;

    // Use appropriate factory method based on alert type
    switch (alertType) {
      case 'nominal_range_violation':
        return Alert.createNominalRangeViolation({
          id: row.id,
          tenantId: row.tenantId,
          wellId: row.wellId ?? '',
          fieldEntryId: row.fieldEntryId ?? '',
          fieldName: row.fieldName ?? '',
          actualValue: row.actualValue ? parseFloat(row.actualValue) : 0,
          expectedMin: row.expectedMin ? parseFloat(row.expectedMin) : null,
          expectedMax: row.expectedMax ? parseFloat(row.expectedMax) : null,
          severity: row.severity as AlertSeverity,
          message: row.message,
          metadata: (row.metadata as Record<string, any>) ?? undefined,
          createdAt: row.createdAt,
        });

      case 'well_down':
        return Alert.createWellDown({
          id: row.id,
          tenantId: row.tenantId,
          wellId: row.wellId ?? '',
          message: row.message,
          metadata: (row.metadata as Record<string, any>) ?? undefined,
          createdAt: row.createdAt,
        });

      case 'equipment_failure':
        return Alert.createEquipmentFailure({
          id: row.id,
          tenantId: row.tenantId,
          wellId: row.wellId ?? '',
          fieldEntryId: row.fieldEntryId ?? undefined,
          message: row.message,
          severity: row.severity as AlertSeverity,
          metadata: (row.metadata as Record<string, any>) ?? undefined,
          createdAt: row.createdAt,
        });

      case 'high_downtime':
        return Alert.createHighDowntime({
          id: row.id,
          tenantId: row.tenantId,
          wellId: row.wellId ?? '',
          fieldEntryId: row.fieldEntryId ?? '',
          message: row.message,
          metadata: (row.metadata as Record<string, any>) ?? undefined,
          createdAt: row.createdAt,
        });

      case 'system':
        return Alert.createSystemAlert({
          id: row.id,
          tenantId: row.tenantId,
          message: row.message,
          severity: row.severity as AlertSeverity,
          metadata: (row.metadata as Record<string, any>) ?? undefined,
          createdAt: row.createdAt,
        });

      default:
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`Unknown alert type: ${alertType}`);
    }
  }

  private toRow(alert: Alert): typeof tenantSchema.alerts.$inferInsert {
    return {
      id: alert.id,
      tenantId: alert.tenantId,
      wellId: alert.wellId ?? null,
      fieldEntryId: alert.fieldEntryId ?? null,
      alertType: alert.alertType,
      severity: alert.severity,
      fieldName: alert.fieldName ?? null,
      actualValue: alert.actualValue?.toString() ?? null,
      expectedMin: alert.expectedMin?.toString() ?? null,
      expectedMax: alert.expectedMax?.toString() ?? null,
      message: alert.message,
      acknowledgedAt: alert.acknowledgedAt ?? null,
      acknowledgedBy: alert.acknowledgedBy ?? null,
      metadata: alert.metadata ?? null,
      createdAt: alert.createdAt,
    };
  }
}
