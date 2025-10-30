/**
 * Alert History Query DTO
 *
 * Query parameters for filtering alert history.
 */

import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class AlertHistoryQueryDto {
  @ApiProperty({
    description: 'Filter by well ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsOptional()
  @IsString()
  wellId?: string;

  @ApiProperty({
    description: 'Filter by field name',
    example: 'oilRate',
    required: false,
  })
  @IsOptional()
  @IsString()
  fieldName?: string;

  @ApiProperty({
    description: 'Filter by severity level',
    enum: ['info', 'warning', 'critical'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['info', 'warning', 'critical'])
  severity?: 'info' | 'warning' | 'critical';

  @ApiProperty({
    description: 'Filter by multiple severity levels',
    enum: ['info', 'warning', 'critical'],
    isArray: true,
    required: false,
    example: ['warning', 'critical'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(['info', 'warning', 'critical'], { each: true })
  @Transform(
    ({ value }: { value: unknown }): ('info' | 'warning' | 'critical')[] =>
      Array.isArray(value)
        ? (value as ('info' | 'warning' | 'critical')[])
        : [value as 'info' | 'warning' | 'critical'],
  )
  severities?: ('info' | 'warning' | 'critical')[];

  @ApiProperty({
    description: 'Filter by acknowledged status',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value as boolean;
  })
  isAcknowledged?: boolean;

  @ApiProperty({
    description: 'Start date for date range filter (ISO 8601)',
    example: '2024-10-01T00:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'End date for date range filter (ISO 8601)',
    example: '2024-10-29T23:59:59Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: 'Page number (1-indexed)',
    example: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 50,
    default: 50,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiProperty({
    description: 'Sort field',
    enum: ['triggeredAt', 'severity', 'fieldName'],
    default: 'triggeredAt',
    required: false,
  })
  @IsOptional()
  @IsEnum(['triggeredAt', 'severity', 'fieldName'])
  sortBy?: 'triggeredAt' | 'severity' | 'fieldName' = 'triggeredAt';

  @ApiProperty({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
    required: false,
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
