/**
 * Get Alert Stats Query and Handler
 *
 * Retrieves alert statistics for dashboard KPIs.
 */

import { Injectable, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IAlertRepository } from '../../../domain/repositories/alert.repository.interface';

/**
 * Get Alert Stats Query
 */
export class GetAlertStatsQuery {
  constructor(public readonly tenantId: string) {}
}

/**
 * Alert Statistics
 */
export interface AlertStats {
  total: number;
  unacknowledged: number;
  acknowledged: number;
  critical: number;
  warning: number;
  info: number;
  acknowledgedRate: number; // Percentage of alerts acknowledged
  criticalUnacknowledged: number; // Critical alerts needing attention
}

/**
 * Get Alert Stats Query Handler
 *
 * Returns aggregated alert statistics for dashboard KPIs.
 * Used for the dashboard summary cards and metrics.
 */
@Injectable()
@QueryHandler(GetAlertStatsQuery)
export class GetAlertStatsHandler implements IQueryHandler<GetAlertStatsQuery> {
  constructor(
    @Inject('IAlertRepository')
    private readonly alertRepository: IAlertRepository,
  ) {}

  async execute(query: GetAlertStatsQuery): Promise<AlertStats> {
    // Get basic stats from repository
    const stats = await this.alertRepository.getAlertStats(query.tenantId);

    // Calculate derived metrics
    const acknowledgedRate =
      stats.total > 0
        ? Math.round(((stats.total - stats.unacknowledged) / stats.total) * 100)
        : 0;

    // Get count of unacknowledged critical alerts
    const criticalUnacknowledged =
      await this.alertRepository.countUnacknowledged(
        query.tenantId,
        'critical',
      );

    return {
      total: stats.total,
      unacknowledged: stats.unacknowledged,
      acknowledged: stats.total - stats.unacknowledged,
      critical: stats.critical,
      warning: stats.warning,
      info: stats.info,
      acknowledgedRate,
      criticalUnacknowledged,
    };
  }
}
