/**
 * Get Alert History Query and Handler
 *
 * Retrieves paginated alert history with optional filters.
 */

import { Injectable, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  IAlertRepository,
  AlertFilters,
  PaginationOptions,
} from '../../../domain/repositories/alert.repository.interface';
import {
  Alert,
  AlertSeverity,
  AlertType,
} from '../../../domain/alert/alert.entity';

/**
 * Get Alert History Query
 */
export class GetAlertHistoryQuery {
  constructor(
    public readonly tenantId: string,
    public readonly filters?: {
      wellId?: string;
      severity?: AlertSeverity;
      alertType?: AlertType;
      acknowledged?: boolean;
      startDate?: Date;
      endDate?: Date;
    },
    public readonly pagination?: {
      page: number;
      limit: number;
    },
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
}

/**
 * Get Alert History Query Result
 */
export interface GetAlertHistoryResult {
  alerts: AlertDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Get Alert History Query Handler
 *
 * Returns paginated alert history with filters.
 * Used for the alerts dashboard page.
 */
@Injectable()
@QueryHandler(GetAlertHistoryQuery)
export class GetAlertHistoryHandler
  implements IQueryHandler<GetAlertHistoryQuery>
{
  constructor(
    @Inject('IAlertRepository')
    private readonly alertRepository: IAlertRepository,
  ) {}

  async execute(query: GetAlertHistoryQuery): Promise<GetAlertHistoryResult> {
    // Set default pagination
    const pagination: PaginationOptions = {
      page: query.pagination?.page ?? 1,
      limit: query.pagination?.limit ?? 50,
    };

    // Build filters
    const filters: AlertFilters = {
      wellId: query.filters?.wellId,
      severity: query.filters?.severity,
      alertType: query.filters?.alertType,
      acknowledged: query.filters?.acknowledged,
      startDate: query.filters?.startDate,
      endDate: query.filters?.endDate,
    };

    // Get paginated alerts
    const result = await this.alertRepository.findWithFilters(
      query.tenantId,
      filters,
      pagination,
    );

    return {
      alerts: result.alerts.map((alert) => this.toDto(alert)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
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
    };
  }
}
