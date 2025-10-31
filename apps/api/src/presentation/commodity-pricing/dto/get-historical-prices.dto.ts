/**
 * Get Historical Prices Request DTO
 *
 * Validates incoming requests for historical commodity price data.
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

/**
 * Get Historical Prices Query DTO
 */
export class GetHistoricalPricesDto {
  @ApiProperty({
    description: 'Commodity type',
    enum: [
      'WTI_CRUDE',
      'BRENT_CRUDE',
      'HENRY_HUB_GAS',
      'NY_HARBOR_HEATING_OIL',
      'GULF_COAST_GASOLINE',
    ],
    example: 'WTI_CRUDE',
  })
  @IsString()
  @IsNotEmpty()
  commodityType!: string;

  @ApiProperty({
    description: 'Start date (ISO 8601 format)',
    example: '2024-01-01',
  })
  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @ApiProperty({
    description: 'End date (ISO 8601 format)',
    example: '2024-12-31',
  })
  @IsDateString()
  @IsNotEmpty()
  endDate!: string;
}
