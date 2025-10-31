/**
 * Get Active Alarms Query DTO
 *
 * Query parameters for filtering active alarms.
 */

import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { AlarmSeverity } from '../../../domain/scada/alarm.entity';

// Valid alarm severity values
const ALARM_SEVERITIES = ['INFORMATIONAL', 'WARNING', 'CRITICAL'] as const;

export class GetActiveAlarmsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by well ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  readonly wellId?: string;

  @ApiPropertyOptional({
    description: 'Filter by alarm severity',
    enum: ALARM_SEVERITIES,
    example: 'CRITICAL',
  })
  @IsOptional()
  @IsIn(ALARM_SEVERITIES)
  readonly severity?: AlarmSeverity;
}
