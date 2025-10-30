/**
 * Update Organization Nominal Ranges DTO
 *
 * Request body for updating organization-wide nominal ranges.
 */

import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  ValidateNested,
  IsEnum,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class NominalRangeDto {
  @ApiProperty({
    description:
      'Field name (e.g., oilRate, gasRate, waterRate, casingPressure)',
    example: 'oilRate',
  })
  @IsString()
  @IsNotEmpty()
  fieldName!: string;

  @ApiProperty({
    description: 'Minimum acceptable value',
    example: 0,
  })
  @IsNumber()
  min!: number;

  @ApiProperty({
    description: 'Maximum acceptable value',
    example: 1000,
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
    example: 'warning',
  })
  @IsEnum(['info', 'warning', 'critical'])
  severity!: 'info' | 'warning' | 'critical';

  @ApiProperty({
    description: 'Alert message template',
    example:
      '{fieldName} is out of range: {value} {unit} (expected: {min}-{max})',
    required: false,
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({
    description: 'Grace period in minutes before alerting',
    example: 15,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  gracePeriodMinutes?: number;
}

export class UpdateOrgNominalRangesDto {
  @ApiProperty({
    description: 'Array of nominal ranges to update',
    type: [NominalRangeDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NominalRangeDto)
  ranges!: NominalRangeDto[];
}
