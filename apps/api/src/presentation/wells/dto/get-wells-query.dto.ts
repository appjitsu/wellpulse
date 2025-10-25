/**
 * Get Wells Query DTO
 *
 * Query parameters validation for wells list endpoint.
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetWellsQueryDto {
  @ApiProperty({
    description: 'Filter by well status',
    enum: ['ACTIVE', 'INACTIVE', 'PLUGGED'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE', 'PLUGGED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'PLUGGED';

  @ApiProperty({
    description: 'Filter by lease name',
    example: 'Smith Ranch Lease',
    required: false,
  })
  @IsOptional()
  @IsString()
  lease?: string;

  @ApiProperty({
    description: 'Filter by field name',
    example: 'Permian Basin',
    required: false,
  })
  @IsOptional()
  @IsString()
  field?: string;

  @ApiProperty({
    description: 'Filter by operator name',
    example: 'ACME Oil & Gas',
    required: false,
  })
  @IsOptional()
  @IsString()
  operator?: string;

  @ApiProperty({
    description: 'Search by well name or API number',
    example: 'Smith',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Number of results per page',
    example: 20,
    default: 20,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiProperty({
    description: 'Number of results to skip',
    example: 0,
    default: 0,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
