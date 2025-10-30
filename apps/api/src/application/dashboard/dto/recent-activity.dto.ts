import { ApiProperty } from '@nestjs/swagger';

/**
 * Single activity item
 */
export class ActivityItemDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Well TX-450' })
  wellName: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  wellId: string;

  @ApiProperty({ example: 'Production entry recorded' })
  event: string;

  @ApiProperty({
    example: 'PRODUCTION',
    enum: ['PRODUCTION', 'INSPECTION', 'MAINTENANCE', 'ANOMALY'],
  })
  eventType: string;

  @ApiProperty({
    example: 'info',
    enum: ['success', 'warning', 'info'],
  })
  severity: 'success' | 'warning' | 'info';

  @ApiProperty({ example: '2025-10-27T10:30:00Z' })
  timestamp: string;

  @ApiProperty({ example: '5 minutes ago' })
  timeAgo: string;
}

/**
 * Recent activity response
 * GET /api/dashboard/recent-activity
 */
export class RecentActivityDto {
  @ApiProperty({
    type: [ActivityItemDto],
    description: 'Recent activities (max 10)',
  })
  activities: ActivityItemDto[];
}
