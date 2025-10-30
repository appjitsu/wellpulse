import { ApiProperty } from '@nestjs/swagger';

/**
 * Single top producer item
 */
export class TopProducerItemDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  wellId: string;

  @ApiProperty({ example: 'Well TX-450' })
  wellName: string;

  @ApiProperty({
    example: 245,
    description: 'Average daily production (bbl/day)',
  })
  avgDailyProduction: number;

  @ApiProperty({
    example: 12,
    description: 'Trend percentage compared to previous period',
  })
  trendPercentage: number;

  @ApiProperty({
    example: 'up',
    enum: ['up', 'down', 'neutral'],
  })
  trend: 'up' | 'down' | 'neutral';
}

/**
 * Top producers response
 * GET /api/dashboard/top-producers
 */
export class TopProducersDto {
  @ApiProperty({
    type: [TopProducerItemDto],
    description: 'Top 5 producing wells',
  })
  topProducers: TopProducerItemDto[];
}
