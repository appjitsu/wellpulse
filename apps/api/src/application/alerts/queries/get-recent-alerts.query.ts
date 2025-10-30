/**
 * Get Recent Alerts Query and Handler
 *
 * Retrieves the most recent unacknowledged alerts for dashboard display.
 */

import { Injectable, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IAlertRepository } from '../../../domain/repositories/alert.repository.interface';
import {
  Alert,
  AlertSeverity,
  AlertType,
} from '../../../domain/alert/alert.entity';

/**
 * Get Recent Alerts Query
 */
export class GetRecentAlertsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly limit: number = 10,
  ) {}
}

/**
 * Alert DTO for response
 */
export interface AlertDto {
  id: string;
  tenantId: string;
  wellId?: string | null;
  fieldEntryId?: string | null;
  alertType: AlertType;
  severity: AlertSeverity;
  fieldName?: string | null;
  actualValue?: number | null;
  expectedMin?: number | null;
  expectedMax?: number | null;
  message: string;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
  ageMinutes: number; // How old is the alert
  requiresImmediateAttention: boolean; // Critical + unacknowledged
}

/**
 * Get Recent Alerts Query Result
 */
export interface GetRecentAlertsResult {
  alerts: AlertDto[];
  count: number;
  criticalCount: number;
}

/**
 * Get Recent Alerts Query Handler
 *
 * Returns the most recent unacknowledged alerts for dashboard display.
 * Used for the dashboard alert widget showing alerts that need attention.
 */
@Injectable()
@QueryHandler(GetRecentAlertsQuery)
export class GetRecentAlertsHandler
  implements IQueryHandler<GetRecentAlertsQuery>
{
  constructor(
    @Inject('IAlertRepository')
    private readonly alertRepository: IAlertRepository,
  ) {}

  async execute(query: GetRecentAlertsQuery): Promise<GetRecentAlertsResult> {
    // Get recent unacknowledged alerts
    const alerts = await this.alertRepository.getRecentUnacknowledged(
      query.tenantId,
      query.limit,
    );

    // Count critical alerts
    const criticalCount = alerts.filter((alert) => alert.isCritical()).length;

    return {
      alerts: alerts.map((alert) => this.toDto(alert)),
      count: alerts.length,
      criticalCount,
    };
  }

  /**
   * Convert domain entity to DTO (plain object for presentation layer)
   */
  private toDto(alert: Alert): AlertDto {
    return {
      id: alert.id,
      tenantId: alert.tenantId,
      wellId: alert.wellId ?? null,
      fieldEntryId: alert.fieldEntryId ?? null,
      alertType: alert.alertType,
      severity: alert.severity,
      fieldName: alert.fieldName ?? null,
      actualValue: alert.actualValue ?? null,
      expectedMin: alert.expectedMin ?? null,
      expectedMax: alert.expectedMax ?? null,
      message: alert.message,
      acknowledgedAt: alert.acknowledgedAt
        ? alert.acknowledgedAt.toISOString()
        : null,
      acknowledgedBy: alert.acknowledgedBy ?? null,
      metadata: alert.metadata,
      createdAt: alert.createdAt.toISOString(),
      ageMinutes: alert.getAgeInMinutes(),
      requiresImmediateAttention: alert.requiresImmediateAttention(),
    };
  }
}
