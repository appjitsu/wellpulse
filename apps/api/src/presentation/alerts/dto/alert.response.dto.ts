/**
 * Alert Response DTOs
 *
 * Response formats for alert endpoints.
 */

import { ApiProperty } from '@nestjs/swagger';

export class AlertResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the alert',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Well ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  wellId!: string;

  @ApiProperty({
    description: 'Well name',
    example: 'Smith Ranch #3',
  })
  wellName!: string;

  @ApiProperty({
    description: 'Well API number',
    example: '42-165-12345',
  })
  wellApiNumber!: string;

  @ApiProperty({
    description: 'Field entry ID that triggered the alert',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  fieldEntryId!: string;

  @ApiProperty({
    description: 'Nominal range ID that was violated',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  nominalRangeId!: string;

  @ApiProperty({
    description: 'Field name that violated the range',
    example: 'oilRate',
  })
  fieldName!: string;

  @ApiProperty({
    description: 'Value that triggered the alert',
    example: 1500,
  })
  value!: number;

  @ApiProperty({
    description: 'Expected minimum value',
    example: 0,
  })
  expectedMin!: number;

  @ApiProperty({
    description: 'Expected maximum value',
    example: 1000,
  })
  expectedMax!: number;

  @ApiProperty({
    description: 'Unit of measurement',
    example: 'bbl/day',
  })
  unit!: string;

  @ApiProperty({
    description: 'Alert severity level',
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    example: 'HIGH',
  })
  severity!: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiProperty({
    description: 'Alert message',
    example: 'Oil rate is out of range: 1500 bbl/day (expected: 0-1000)',
  })
  message!: string;

  @ApiProperty({
    description: 'Timestamp when alert was triggered',
    example: '2024-10-29T14:30:00Z',
  })
  triggeredAt!: string;

  @ApiProperty({
    description: 'Has the alert been acknowledged?',
    example: false,
  })
  isAcknowledged!: boolean;

  @ApiProperty({
    description: 'User ID who acknowledged the alert',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  acknowledgedBy?: string | null;

  @ApiProperty({
    description: 'Timestamp when alert was acknowledged',
    example: '2024-10-29T15:00:00Z',
    required: false,
  })
  acknowledgedAt?: string | null;

  @ApiProperty({
    description: 'Notes added when acknowledging the alert',
    example: 'Well has been shut in for maintenance',
    required: false,
  })
  acknowledgedNotes?: string | null;
}

export class AlertHistoryResponseDto {
  @ApiProperty({
    description: 'Array of alerts',
    type: [AlertResponseDto],
  })
  alerts!: AlertResponseDto[];

  @ApiProperty({
    description: 'Total count of alerts matching filters',
    example: 156,
  })
  total!: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 50,
  })
  limit!: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 4,
  })
  totalPages!: number;
}

export class AlertStatsResponseDto {
  @ApiProperty({
    description: 'Total count of active (unacknowledged) alerts',
    example: 23,
  })
  activeCount!: number;

  @ApiProperty({
    description: 'Count by severity level',
    example: { LOW: 5, MEDIUM: 10, HIGH: 6, CRITICAL: 2 },
  })
  bySeverity!: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
  };

  @ApiProperty({
    description: 'Count by field name',
    example: {
      oilRate: 8,
      gasRate: 6,
      waterRate: 4,
      casingPressure: 3,
      tubingPressure: 2,
    },
  })
  byField!: Record<string, number>;

  @ApiProperty({
    description: 'Top 10 wells with most alerts',
    example: [
      { wellId: '550e8400...', wellName: 'Smith Ranch #3', alertCount: 5 },
      { wellId: '660e8400...', wellName: 'Jones Well #1', alertCount: 4 },
    ],
  })
  topWells!: Array<{
    wellId: string;
    wellName: string;
    wellApiNumber: string;
    alertCount: number;
  }>;

  @ApiProperty({
    description: 'Alerts trend over last 7 days',
    example: [
      { date: '2024-10-23', count: 12 },
      { date: '2024-10-24', count: 15 },
      { date: '2024-10-25', count: 18 },
    ],
  })
  trend!: Array<{
    date: string;
    count: number;
  }>;
}

export class RecentAlertsResponseDto {
  @ApiProperty({
    description: 'Array of recent unacknowledged alerts',
    type: [AlertResponseDto],
  })
  alerts!: AlertResponseDto[];

  @ApiProperty({
    description: 'Count of recent alerts',
    example: 10,
  })
  count!: number;

  @ApiProperty({
    description: 'Count of critical alerts',
    example: 2,
  })
  criticalCount!: number;

  @ApiProperty({
    description: 'Timestamp of last check',
    example: '2024-10-29T14:35:00Z',
  })
  lastCheckedAt!: string;
}

export class AcknowledgeAlertSuccessDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Alert acknowledged successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'Alert ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  alertId!: string;

  @ApiProperty({
    description: 'Timestamp when acknowledged',
    example: '2024-10-29T15:00:00Z',
  })
  acknowledgedAt!: string;
}
