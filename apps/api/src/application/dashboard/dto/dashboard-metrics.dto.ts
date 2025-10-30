import { ApiProperty } from '@nestjs/swagger';

/**
 * Single metric with value, change, and trend
 */
export class MetricDto {
  @ApiProperty({ example: 128, description: 'Current metric value' })
  value: number;

  @ApiProperty({ example: '+4', description: 'Change from previous period' })
  change: string;

  @ApiProperty({
    example: 'up',
    enum: ['up', 'down', 'neutral'],
    description: 'Trend direction',
  })
  trend: 'up' | 'down' | 'neutral';

  @ApiProperty({
    example: 'bbl',
    required: false,
    description: 'Optional unit',
  })
  unit?: string;
}

/**
 * Dashboard metrics response
 * GET /api/dashboard/metrics
 */
export class DashboardMetricsDto {
  @ApiProperty({ type: MetricDto, description: 'Total wells count' })
  totalWells: MetricDto;

  @ApiProperty({ type: MetricDto, description: 'Daily production (last 24h)' })
  dailyProduction: MetricDto;

  @ApiProperty({ type: MetricDto, description: 'Active alerts count' })
  activeAlerts: MetricDto;

  @ApiProperty({ type: MetricDto, description: 'Monthly revenue estimate' })
  monthlyRevenue: MetricDto;
}
