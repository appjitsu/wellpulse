/**
 * Get Top Producers Query and Handler
 *
 * Retrieves the top 5 producing wells based on average daily production.
 * Compares current week production to previous week to calculate trend.
 */

import { Injectable, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IWellRepository } from '../../../domain/repositories/well.repository.interface';
import { IFieldEntryRepository } from '../../../domain/repositories/field-entry.repository.interface';
import { TopProducersDto, TopProducerItemDto } from '../dto';

/**
 * Get Top Producers Query
 */
export class GetTopProducersQuery {
  constructor(public readonly tenantId: string) {}
}

/**
 * Interface for well production data
 */
interface WellProduction {
  wellId: string;
  wellName: string;
  currentWeekProduction: number;
  previousWeekProduction: number;
}

/**
 * Get Top Producers Query Handler
 */
@Injectable()
@QueryHandler(GetTopProducersQuery)
export class GetTopProducersHandler
  implements IQueryHandler<GetTopProducersQuery>
{
  constructor(
    @Inject('IWellRepository')
    private readonly wellRepository: IWellRepository,
    @Inject('IFieldEntryRepository')
    private readonly fieldEntryRepository: IFieldEntryRepository,
  ) {}

  async execute(query: GetTopProducersQuery): Promise<TopProducersDto> {
    const { tenantId } = query;

    // Get all wells
    const wells = await this.wellRepository.findAll(tenantId, {
      status: 'ACTIVE', // Only include active wells
      limit: 1000,
    });

    if (wells.length === 0) {
      return {
        topProducers: [],
      };
    }

    // Calculate date ranges
    const now = new Date();
    const currentWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previousWeekStart = new Date(
      now.getTime() - 14 * 24 * 60 * 60 * 1000,
    );
    const previousWeekEnd = currentWeekStart;

    // Calculate production for each well
    const wellProductions: WellProduction[] = await Promise.all(
      wells.map(async (well) => {
        // Get current week production
        const currentWeekSummary =
          await this.fieldEntryRepository.getProductionSummary(
            tenantId,
            well.id,
            currentWeekStart,
            now,
          );

        // Get previous week production
        const previousWeekSummary =
          await this.fieldEntryRepository.getProductionSummary(
            tenantId,
            well.id,
            previousWeekStart,
            previousWeekEnd,
          );

        return {
          wellId: well.id,
          wellName: well.name,
          currentWeekProduction: currentWeekSummary.totalOil,
          previousWeekProduction: previousWeekSummary.totalOil,
        };
      }),
    );

    // Sort by current week production (descending)
    const sortedProductions = wellProductions
      .filter((wp) => wp.currentWeekProduction > 0) // Only include wells with production
      .sort((a, b) => b.currentWeekProduction - a.currentWeekProduction)
      .slice(0, 5); // Top 5

    // Convert to DTOs
    const topProducers: TopProducerItemDto[] = sortedProductions.map((wp) => {
      // Calculate average daily production (divide by 7 days)
      const avgDailyProduction = Math.round(wp.currentWeekProduction / 7);

      // Calculate trend percentage
      const trendPercentage = this.calculateTrendPercentage(
        wp.currentWeekProduction,
        wp.previousWeekProduction,
      );

      // Determine trend direction
      const trend: 'up' | 'down' | 'neutral' =
        trendPercentage > 0 ? 'up' : trendPercentage < 0 ? 'down' : 'neutral';

      return {
        wellId: wp.wellId,
        wellName: wp.wellName,
        avgDailyProduction,
        trendPercentage,
        trend,
      };
    });

    return {
      topProducers,
    };
  }

  /**
   * Calculate trend percentage comparing current to previous period
   */
  private calculateTrendPercentage(current: number, previous: number): number {
    if (previous === 0) {
      // If previous was 0, return 0 (no comparison possible)
      return 0;
    }

    const change = ((current - previous) / previous) * 100;
    return Math.round(change);
  }
}
