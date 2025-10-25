/**
 * Update Well DTO
 *
 * Request body validation for well update endpoint.
 * All fields are optional for partial updates.
 */

import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  Min,
  Max,
  IsObject,
} from 'class-validator';

export class UpdateWellDto {
  @ApiProperty({
    description: 'Well name',
    example: 'Smith Ranch #3',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Latitude coordinate (-90 to 90)',
    example: 31.7619,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiProperty({
    description: 'Longitude coordinate (-180 to 180)',
    example: -102.3421,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiProperty({
    description: 'Lease name',
    example: 'Smith Ranch Lease',
    required: false,
  })
  @IsOptional()
  @IsString()
  lease?: string;

  @ApiProperty({
    description: 'Field name',
    example: 'Permian Basin',
    required: false,
  })
  @IsOptional()
  @IsString()
  field?: string;

  @ApiProperty({
    description: 'Operator name',
    example: 'ACME Oil & Gas',
    required: false,
  })
  @IsOptional()
  @IsString()
  operator?: string;

  @ApiProperty({
    description: 'Spud date (ISO 8601 format)',
    example: '2024-01-15',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  spudDate?: string;

  @ApiProperty({
    description: 'Completion date (ISO 8601 format)',
    example: '2024-03-20',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  completionDate?: string;

  @ApiProperty({
    description: 'Custom metadata (JSON object)',
    example: { formation: 'Wolfcamp', depth: 8500 },
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
