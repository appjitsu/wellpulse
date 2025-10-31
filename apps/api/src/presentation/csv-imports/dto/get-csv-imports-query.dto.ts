/**
 * Get CSV Imports Query DTO
 *
 * Query parameters for filtering CSV imports list.
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetCsvImportsQueryDto {
  @ApiProperty({
    description: 'Filter by import status',
    enum: ['queued', 'processing', 'completed', 'failed'],
    required: false,
    example: 'completed',
  })
  @IsOptional()
  @IsEnum(['queued', 'processing', 'completed', 'failed'])
  status?: 'queued' | 'processing' | 'completed' | 'failed';

  @ApiProperty({
    description: 'Maximum number of results to return',
    required: false,
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({
    description: 'Number of results to skip',
    required: false,
    example: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}
