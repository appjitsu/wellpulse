/**
 * Get SCADA Readings Query DTO
 *
 * Query parameters for filtering SCADA readings.
 */

import {
  IsOptional,
  IsString,
  IsDateString,
  IsNumberString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetScadaReadingsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by well ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  readonly wellId?: string;

  @ApiPropertyOptional({
    description: 'Filter by SCADA connection ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsOptional()
  @IsString()
  readonly connectionId?: string;

  @ApiPropertyOptional({
    description: 'Filter by tag name',
    example: 'WELLHEAD_PRESSURE',
  })
  @IsOptional()
  @IsString()
  readonly tagName?: string;

  @ApiPropertyOptional({
    description: 'Start time for readings (ISO 8601)',
    example: '2025-10-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  readonly startTime?: string;

  @ApiPropertyOptional({
    description: 'End time for readings (ISO 8601)',
    example: '2025-10-30T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  readonly endTime?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of readings to return',
    example: '100',
    default: '100',
  })
  @IsOptional()
  @IsNumberString()
  readonly limit?: string;

  @ApiPropertyOptional({
    description: 'Number of readings to skip (pagination)',
    example: '0',
    default: '0',
  })
  @IsOptional()
  @IsNumberString()
  readonly offset?: string;
}
