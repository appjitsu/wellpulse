import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IFieldEntryRepository } from '../../../domain/repositories/field-entry.repository.interface';

/**
 * Get Monthly Production Trend Query
 *
 * Returns aggregated production data by month for trend analysis.
 * Used for dashboard charts showing production vs targets over time.
 */
export class GetMonthlyTrendQuery implements IQuery {
  constructor(
    public readonly tenantId: string,
    public readonly months = 6,
  ) {}
}

export interface MonthlyTrendDto {
  month: string;
  production: number;
  target: number;
  efficiency: number;
}

@QueryHandler(GetMonthlyTrendQuery)
export class GetMonthlyTrendHandler
  implements IQueryHandler<GetMonthlyTrendQuery, MonthlyTrendDto[]>
{
  constructor(
    @Inject('IFieldEntryRepository')
    private readonly fieldEntryRepo: IFieldEntryRepository,
  ) {}

  async execute(query: GetMonthlyTrendQuery): Promise<MonthlyTrendDto[]> {
    const { tenantId, months } = query;

    // Calculate date range (last N months)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Get all production entries in date range
    const entries = await this.fieldEntryRepo.findAll(
      tenantId,
      {
        entryType: 'PRODUCTION',
        startDate,
        endDate,
      },
      10000, // Large limit to get all entries
      0,
    );

    // Group by month and calculate totals
    const monthlyData = new Map<
      string,
      { production: number; count: number }
    >();

    for (const entry of entries) {
      if (!entry.productionData) continue;

      const monthKey = this.getMonthKey(entry.recordedAt);
      const existing = monthlyData.get(monthKey) || { production: 0, count: 0 };

      monthlyData.set(monthKey, {
        production: existing.production + (entry.productionData.oilVolume || 0),
        count: existing.count + 1,
      });
    }

    // Calculate targets based on historical average
    const avgProduction =
      Array.from(monthlyData.values()).reduce(
        (sum, data) => sum + data.production,
        0,
      ) / (monthlyData.size || 1);

    const target = Math.ceil(avgProduction * 1.05); // Target is 5% above average

    // Convert to array and format
    const result: MonthlyTrendDto[] = [];
    const currentDate = new Date(startDate);

    for (let i = 0; i < months; i++) {
      const monthKey = this.getMonthKey(currentDate);
      const data = monthlyData.get(monthKey) || { production: 0, count: 0 };

      result.push({
        month: this.getMonthLabel(currentDate),
        production: Math.round(data.production),
        target,
        efficiency:
          target > 0 ? Math.round((data.production / target) * 1000) / 10 : 0,
      });

      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return result;
  }

  private getMonthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private getMonthLabel(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short' });
  }
}
