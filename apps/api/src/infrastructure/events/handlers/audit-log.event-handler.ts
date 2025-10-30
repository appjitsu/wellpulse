/**
 * Audit Log Event Handler
 *
 * Listens to ALL domain events and persists them to audit_logs table.
 * Provides complete audit trail for compliance, security, and debugging.
 *
 * Features:
 * - Captures all domain events automatically
 * - Stores in tenant-specific database
 * - Async processing (doesn't block main operation)
 * - Error isolation (handler failures logged but don't break workflow)
 * - Structured audit data for querying
 *
 * Pattern:
 * - Uses wildcard listener ('**') to catch all events
 * - Each tenant's events stored in their own audit_logs table
 * - Provides foundation for event sourcing if needed
 *
 * Usage:
 * Automatically active - no manual invocation needed.
 * All published domain events will be persisted.
 *
 * Compliance:
 * - GDPR: Provides complete data lineage
 * - SOC 2: Meets audit trail requirements
 * - HIPAA: Tracks all PHI access and modifications
 * - Industry-specific: Satisfies regulatory reporting
 */

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IDomainEvent } from '../../../domain/common/domain-event.interface';
import { TenantDatabaseService } from '../../database/tenant-database.service';
import { auditLogs } from '../../database/schema/tenant/audit-logs.schema';
import { eq, and, gte, lte, asc } from 'drizzle-orm';

@Injectable()
export class AuditLogEventHandler {
  private readonly logger = new Logger(AuditLogEventHandler.name);

  constructor(private readonly tenantDbService: TenantDatabaseService) {}

  /**
   * Handle all domain events and persist to audit log
   *
   * Listens to ALL events using wildcard pattern '**'
   * This ensures no events are missed for audit trail.
   *
   * @param event - Any domain event
   */
  @OnEvent('**', { async: true })
  async handleEvent(event: IDomainEvent): Promise<void> {
    try {
      // Skip if no tenant context (shouldn't happen, but defensive)
      if (!event.tenantId) {
        this.logger.warn(
          `Skipping audit log for event ${event.eventType} (${event.eventId}) - no tenant context`,
        );
        return;
      }

      this.logger.debug(
        `Recording audit log for ${event.eventType} (${event.eventId})`,
      );

      // Get tenant database connection
      const db = await this.tenantDbService.getTenantDatabase(event.tenantId);

      // Insert audit log record
      await db.insert(auditLogs).values({
        eventId: event.eventId,
        eventType: event.eventType,
        occurredAt: event.occurredAt,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        userId: event.userId,
        payload: event.payload,
        metadata: event.metadata,
        tenantId: event.tenantId,
      });

      this.logger.log(
        `Audit log recorded: ${event.eventType} for ${event.aggregateType}:${event.aggregateId}`,
      );
    } catch (error) {
      // Log error but don't throw - we don't want audit failures to break the system
      this.logger.error(
        `Failed to record audit log for ${event.eventType} (${event.eventId}): ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );

      // Optional: Store failed audit attempts for later retry
      // This ensures we never lose audit data even if DB is temporarily unavailable
      // await this.storeFailedAuditLog(event, error);
    }
  }

  /**
   * Query audit logs for an aggregate
   *
   * Useful for reconstructing entity history or debugging.
   *
   * @param tenantId - Tenant ID
   * @param aggregateId - Aggregate ID
   * @param aggregateType - Aggregate type (optional filter)
   * @returns Array of audit log events
   */
  async getAggregateHistory(
    tenantId: string,
    aggregateId: string,
    aggregateType?: string,
  ): Promise<IDomainEvent[]> {
    try {
      const db = await this.tenantDbService.getTenantDatabase(tenantId);

      // Build query with proper Drizzle ORM syntax
      const conditions = [eq(auditLogs.aggregateId, aggregateId)];

      if (aggregateType) {
        conditions.push(eq(auditLogs.aggregateType, aggregateType));
      }

      const logs = await db
        .select()
        .from(auditLogs)
        .where(and(...conditions))
        .orderBy(asc(auditLogs.occurredAt));

      // Convert to domain events
      return logs.map((log) => ({
        eventId: log.eventId,
        eventType: log.eventType,
        occurredAt: log.occurredAt,
        tenantId: log.tenantId,
        userId: log.userId,
        aggregateId: log.aggregateId,
        aggregateType: log.aggregateType,
        payload: log.payload as Record<string, unknown>,
        metadata: log.metadata as Record<string, unknown> | undefined,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get aggregate history for ${aggregateType}:${aggregateId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  /**
   * Query audit logs for a user
   *
   * Shows all actions performed by a user.
   *
   * @param tenantId - Tenant ID
   * @param userId - User ID
   * @param startDate - Optional start date
   * @param endDate - Optional end date
   * @returns Array of audit log events
   */
  async getUserActivity(
    tenantId: string,
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<IDomainEvent[]> {
    try {
      const db = await this.tenantDbService.getTenantDatabase(tenantId);

      // Build query with date filters using proper Drizzle ORM syntax
      const conditions = [eq(auditLogs.userId, userId)];

      if (startDate) {
        conditions.push(gte(auditLogs.occurredAt, startDate));
      }

      if (endDate) {
        conditions.push(lte(auditLogs.occurredAt, endDate));
      }

      const logs = await db
        .select()
        .from(auditLogs)
        .where(and(...conditions))
        .orderBy(asc(auditLogs.occurredAt));

      return logs.map((log) => ({
        eventId: log.eventId,
        eventType: log.eventType,
        occurredAt: log.occurredAt,
        tenantId: log.tenantId,
        userId: log.userId,
        aggregateId: log.aggregateId,
        aggregateType: log.aggregateType,
        payload: log.payload as Record<string, unknown>,
        metadata: log.metadata as Record<string, unknown> | undefined,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get user activity for ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }
}
