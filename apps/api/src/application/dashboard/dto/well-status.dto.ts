import { ApiProperty } from '@nestjs/swagger';

/**
 * Well status distribution item
 */
export class WellStatusItemDto {
  @ApiProperty({
    example: 'ACTIVE',
    description: 'Well status',
  })
  status: string;

  @ApiProperty({ example: 112, description: 'Count of wells with this status' })
  count: number;

  @ApiProperty({
    example: 87.5,
    description: 'Percentage of total wells',
  })
  percentage: number;
}

/**
 * Well status distribution response
 * GET /api/dashboard/well-status
 */
export class WellStatusDto {
  @ApiProperty({
    type: [WellStatusItemDto],
    description: 'Status distribution',
  })
  statusDistribution: WellStatusItemDto[];

  @ApiProperty({ example: 128, description: 'Total wells count' })
  totalWells: number;
}
