/**
 * Set Well Nominal Range DTO
 *
 * Request body for setting well-specific nominal range override.
 */

import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  Min,
} from 'class-validator';

export class SetWellNominalRangeDto {
  @ApiProperty({
    description: 'Minimum acceptable value',
    example: 0,
  })
  @IsNumber()
  min!: number;

  @ApiProperty({
    description: 'Maximum acceptable value',
    example: 1500,
  })
  @IsNumber()
  max!: number;

  @ApiProperty({
    description: 'Unit of measurement',
    example: 'bbl/day',
  })
  @IsString()
  @IsNotEmpty()
  unit!: string;

  @ApiProperty({
    description: 'Alert severity level',
    enum: ['info', 'warning', 'critical'],
    example: 'critical',
  })
  @IsEnum(['info', 'warning', 'critical'])
  severity!: 'info' | 'warning' | 'critical';

  @ApiProperty({
    description: 'Alert message template',
    example:
      'High-producing well: {fieldName} is {value} {unit} (expected: {min}-{max})',
    required: false,
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({
    description: 'Grace period in minutes before alerting',
    example: 30,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  gracePeriodMinutes?: number;

  @ApiProperty({
    description: 'Reason for well-specific override',
    example: 'High-producing well requires custom thresholds',
    required: false,
  })
  @IsOptional()
  @IsString()
  overrideReason?: string;
}
