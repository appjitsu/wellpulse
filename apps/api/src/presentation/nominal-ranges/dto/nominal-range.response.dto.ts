/**
 * Nominal Range Response DTOs
 *
 * Response formats for nominal range endpoints.
 */

import { ApiProperty } from '@nestjs/swagger';

export class NominalRangeResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the nominal range',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Field name',
    example: 'oilRate',
  })
  fieldName!: string;

  @ApiProperty({
    description: 'Minimum acceptable value',
    example: 0,
  })
  min!: number;

  @ApiProperty({
    description: 'Maximum acceptable value',
    example: 1000,
  })
  max!: number;

  @ApiProperty({
    description: 'Unit of measurement',
    example: 'bbl/day',
  })
  unit!: string;

  @ApiProperty({
    description: 'Alert severity level',
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    example: 'MEDIUM',
  })
  severity!: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiProperty({
    description: 'Alert message template',
    example: '{fieldName} is out of range: {value} {unit}',
    required: false,
  })
  message?: string | null;

  @ApiProperty({
    description: 'Grace period in minutes',
    example: 15,
    required: false,
  })
  gracePeriodMinutes?: number | null;

  @ApiProperty({
    description: 'Is this a well-specific override?',
    example: false,
  })
  isWellOverride!: boolean;

  @ApiProperty({
    description: 'Well ID if this is a well-specific override',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  wellId?: string | null;

  @ApiProperty({
    description: 'Override reason if this is a well-specific override',
    example: 'High-producing well requires custom thresholds',
    required: false,
  })
  overrideReason?: string | null;

  @ApiProperty({
    description: 'Timestamp when range was created',
    example: '2024-10-29T12:00:00Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Timestamp when range was last updated',
    example: '2024-10-29T12:00:00Z',
  })
  updatedAt!: string;

  @ApiProperty({
    description: 'User ID who created the range',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  createdBy!: string;

  @ApiProperty({
    description: 'User ID who last updated the range',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  updatedBy!: string;
}

export class OrgNominalRangesResponseDto {
  @ApiProperty({
    description: 'Array of organization-wide nominal ranges',
    type: [NominalRangeResponseDto],
  })
  ranges!: NominalRangeResponseDto[];

  @ApiProperty({
    description: 'Total count of organization ranges',
    example: 6,
  })
  count!: number;
}

export class WellNominalRangesResponseDto {
  @ApiProperty({
    description: 'Well ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  wellId!: string;

  @ApiProperty({
    description: 'Well name',
    example: 'Smith Ranch #3',
  })
  wellName!: string;

  @ApiProperty({
    description: 'Array of well-specific nominal range overrides',
    type: [NominalRangeResponseDto],
  })
  ranges!: NominalRangeResponseDto[];

  @ApiProperty({
    description: 'Total count of well overrides',
    example: 2,
  })
  count!: number;
}

export class EffectiveNominalRangesResponseDto {
  @ApiProperty({
    description: 'Well ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  wellId!: string;

  @ApiProperty({
    description: 'Well name',
    example: 'Smith Ranch #3',
  })
  wellName!: string;

  @ApiProperty({
    description:
      'Effective nominal ranges (well overrides merged with org defaults)',
    type: [NominalRangeResponseDto],
  })
  ranges!: NominalRangeResponseDto[];

  @ApiProperty({
    description: 'Count of well-specific overrides applied',
    example: 2,
  })
  overrideCount!: number;

  @ApiProperty({
    description: 'Count of organization defaults used',
    example: 4,
  })
  defaultCount!: number;
}

export class UpdateNominalRangesSuccessDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Organization nominal ranges updated successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'Count of ranges updated',
    example: 6,
  })
  updatedCount!: number;
}

export class DeleteNominalRangeSuccessDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Nominal range deleted successfully',
  })
  message!: string;
}
