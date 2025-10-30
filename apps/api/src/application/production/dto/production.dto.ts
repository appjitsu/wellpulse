import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Monthly Production Trend DTO
 */
export class MonthlyTrendDto {
  @ApiProperty({ example: 'Oct', description: 'Month abbreviation' })
  month: string;

  @ApiProperty({ example: 38450, description: 'Total production in barrels' })
  production: number;

  @ApiProperty({ example: 37000, description: 'Target production in barrels' })
  target: number;

  @ApiProperty({
    example: 103.9,
    description: 'Efficiency percentage (production/target * 100)',
  })
  efficiency: number;
}

/**
 * Well Type Breakdown DTO
 */
export class WellTypeBreakdownDto {
  @ApiProperty({ example: 'Horizontal', description: 'Well type' })
  type: string;

  @ApiProperty({ example: 82, description: 'Number of wells of this type' })
  wells: number;

  @ApiProperty({
    example: 28540,
    description: 'Total production from this well type',
  })
  production: number;

  @ApiProperty({
    example: 68,
    description: 'Percentage of total production',
  })
  percentage: number;
}

/**
 * Query parameters for monthly trend
 */
export class GetMonthlyTrendQueryDto {
  @ApiProperty({
    required: false,
    minimum: 1,
    maximum: 12,
    default: 6,
    description: 'Number of months to include in trend',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  months?: number = 6;
}

/**
 * Response DTOs
 */
export class GetMonthlyTrendResponseDto {
  @ApiProperty({ type: [MonthlyTrendDto] })
  data: MonthlyTrendDto[];
}

export class GetWellTypeBreakdownResponseDto {
  @ApiProperty({ type: [WellTypeBreakdownDto] })
  data: WellTypeBreakdownDto[];
}
