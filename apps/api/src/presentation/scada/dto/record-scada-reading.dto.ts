/**
 * Record SCADA Reading DTO
 *
 * Request payload for recording individual SCADA readings.
 * Used by SCADA polling service and manual data entry.
 */

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDate,
  IsNumber,
  IsIn,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ReadingQuality } from '../../../domain/scada/scada-reading.entity';

// Valid reading quality values
const READING_QUALITIES = [
  'GOOD',
  'BAD',
  'UNCERTAIN',
  'OUT_OF_RANGE',
  'STALE',
] as const;

export class RecordScadaReadingDto {
  @ApiProperty({
    description: 'Well ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  readonly wellId!: string;

  @ApiProperty({
    description: 'SCADA connection ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsString()
  @IsNotEmpty()
  readonly scadaConnectionId!: string;

  @ApiProperty({
    description: 'Tag/point name from SCADA system',
    example: 'WELLHEAD_PRESSURE',
  })
  @IsString()
  @IsNotEmpty()
  readonly tagName!: string;

  @ApiProperty({
    description: 'Reading value (can be number, string, or boolean)',
    example: 150.5,
  })
  @IsNotEmpty()
  readonly value!: number | string | boolean;

  @ApiPropertyOptional({
    description: 'Reading quality indicator',
    enum: READING_QUALITIES,
    default: 'GOOD',
    example: 'GOOD',
  })
  @IsOptional()
  @IsIn(READING_QUALITIES)
  readonly quality?: ReadingQuality;

  @ApiPropertyOptional({
    description: 'Timestamp of the reading (ISO 8601)',
    example: '2025-10-30T10:30:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  readonly timestamp?: Date;

  @ApiPropertyOptional({
    description: 'Unit of measurement',
    example: 'PSI',
  })
  @IsOptional()
  @IsString()
  readonly unit?: string;

  @ApiPropertyOptional({
    description: 'Minimum valid value for range checking',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  readonly minValue?: number;

  @ApiPropertyOptional({
    description: 'Maximum valid value for range checking',
    example: 500,
  })
  @IsOptional()
  @IsNumber()
  readonly maxValue?: number;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { source: 'RTU', deviceId: 'RTU-001' },
  })
  @IsOptional()
  @IsObject()
  readonly metadata?: Record<string, unknown>;
}
