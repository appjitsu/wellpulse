/**
 * Get Dashboard Metrics Query and Handler
 *
 * Retrieves aggregated metrics for the dashboard:
 * - Total wells count (by status)
 * - Daily production (last 24 hours)
 * - Active alerts count
 * - Monthly revenue estimate
 */

import { Injectable, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IWellRepository } from '../../../domain/repositories/well.repository.interface';
import { IFieldEntryRepository } from '../../../domain/repositories/field-entry.repository.interface';
import { IAlertRepository } from '../../../domain/repositories/alert.repository.interface';
import { DashboardMetricsDto, MetricDto } from '../dto';

/**
 * Get Dashboard Metrics Query
 */
export class GetDashboardMetricsQuery {
  constructor(public readonly tenantId: string) {}
}

/**
 * Get Dashboard Metrics Query Handler
 */
@Injectable()
@QueryHandler(GetDashboardMetricsQuery)
export class GetDashboardMetricsHandler
  implements IQueryHandler<GetDashboardMetricsQuery>
{
  // Average oil price for revenue calculation (per barrel)
  private readonly AVG_OIL_PRICE = 75;

  constructor(
    @Inject('IWellRepository')
    private readonly wellRepository: IWellRepository,
    @Inject('IFieldEntryRepository')
    private readonly fieldEntryRepository: IFieldEntryRepository,
    @Inject('IAlertRepository')
    private readonly alertRepository: IAlertRepository,
  ) {}

  async execute(query: GetDashboardMetricsQuery): Promise<DashboardMetricsDto> {
    const { tenantId } = query;

    // Run queries in parallel for performance
    const [
      totalWellsMetric,
      dailyProductionMetric,
      monthlyRevenueMetric,
      activeAlertsMetric,
    ] = await Promise.all([
      this.getTotalWellsMetric(tenantId),
      this.getDailyProductionMetric(tenantId),
      this.getMonthlyRevenueMetric(tenantId),
      this.getActiveAlertsMetric(tenantId),
    ]);

    return {
      totalWells: totalWellsMetric,
      dailyProduction: dailyProductionMetric,
      activeAlerts: activeAlertsMetric,
      monthlyRevenue: monthlyRevenueMetric,
    };
  }

  /**
   * Get total wells count and change from last week
   */
  private async getTotalWellsMetric(tenantId: string): Promise<MetricDto> {
    // Get current total wells (all statuses)
    const currentTotal = await this.wellRepository.count(tenantId);

    // For now, return a simple metric
    // TODO: Track historical counts to calculate actual change
    const change = currentTotal > 0 ? '+0' : '0';
    const trend: 'up' | 'down' | 'neutral' =
      currentTotal > 0 ? 'neutral' : 'neutral';

    return {
      value: currentTotal,
      change,
      trend,
    };
  }

  /**
   * Get daily production (last 24 hours) from field entries
   */
  private async getDailyProductionMetric(tenantId: string): Promise<MetricDto> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get all production entries from last 24 hours
    const entries = await this.fieldEntryRepository.findAll(
      tenantId,
      {
        entryType: 'PRODUCTION',
        startDate: yesterday,
        endDate: now,
      },
      1000, // limit
      0, // offset
    );

    // Sum up oil production volumes
    let totalOil = 0;
    for (const entry of entries) {
      if (entry.productionData) {
        totalOil += entry.productionData.oilVolume;
      }
    }

    // Round to nearest barrel
    const dailyProduction = Math.round(totalOil);

    // For now, return a simple metric
    // TODO: Compare with previous 24h period to calculate actual change
    const change = dailyProduction > 0 ? '+0%' : '0%';
    const trend: 'up' | 'down' | 'neutral' =
      dailyProduction > 0 ? 'neutral' : 'neutral';

    return {
      value: dailyProduction,
      unit: 'bbl',
      change,
      trend,
    };
  }

  /**
   * Get active (unacknowledged) alerts count
   */
  private async getActiveAlertsMetric(tenantId: string): Promise<MetricDto> {
    const unacknowledgedCount =
      await this.alertRepository.countUnacknowledged(tenantId);

    // For now, return simple metric without trend calculation
    // TODO: Track historical counts to calculate actual change
    const change = unacknowledgedCount > 0 ? `+${unacknowledgedCount}` : '0';
    const trend: 'up' | 'down' | 'neutral' =
      unacknowledgedCount > 10
        ? 'up'
        : unacknowledgedCount > 0
          ? 'neutral'
          : 'neutral';

    return {
      value: unacknowledgedCount,
      change,
      trend,
    };
  }

  /**
   * Get monthly revenue estimate based on production
   */
  private async getMonthlyRevenueMetric(tenantId: string): Promise<MetricDto> {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get all production entries for current month
    const entries = await this.fieldEntryRepository.findAll(
      tenantId,
      {
        entryType: 'PRODUCTION',
        startDate: firstDayOfMonth,
        endDate: now,
      },
      10000, // high limit to get all entries
      0, // offset
    );

    // Sum up oil production volumes
    let totalOil = 0;
    for (const entry of entries) {
      if (entry.productionData) {
        totalOil += entry.productionData.oilVolume;
      }
    }

    // Calculate revenue (oil volume * average price)
    const monthlyRevenue = Math.round(totalOil * this.AVG_OIL_PRICE);

    // For now, return a simple metric
    // TODO: Compare with previous month to calculate actual change
    const change = monthlyRevenue > 0 ? '+0%' : '0%';
    const trend: 'up' | 'down' | 'neutral' =
      monthlyRevenue > 0 ? 'neutral' : 'neutral';

    return {
      value: monthlyRevenue,
      change,
      trend,
    };
  }
}
