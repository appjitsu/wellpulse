/**
 * Well DTO
 *
 * Response DTO for well data.
 */

import { ApiProperty } from '@nestjs/swagger';

export class WellDto {
  @ApiProperty({
    description: 'Well ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Well name',
    example: 'Smith Ranch #3',
  })
  name!: string;

  @ApiProperty({
    description: 'Texas RRC API number',
    example: '42-165-12345',
  })
  apiNumber!: string;

  @ApiProperty({
    description: 'Latitude coordinate',
    example: 31.7619,
  })
  latitude!: number;

  @ApiProperty({
    description: 'Longitude coordinate',
    example: -102.3421,
  })
  longitude!: number;

  @ApiProperty({
    description: 'Well status',
    enum: ['ACTIVE', 'INACTIVE', 'PLUGGED'],
    example: 'ACTIVE',
  })
  status!: 'ACTIVE' | 'INACTIVE' | 'PLUGGED';

  @ApiProperty({
    description: 'Lease name',
    example: 'Smith Ranch Lease',
    nullable: true,
  })
  lease!: string | null;

  @ApiProperty({
    description: 'Field name',
    example: 'Permian Basin',
    nullable: true,
  })
  field!: string | null;

  @ApiProperty({
    description: 'Operator name',
    example: 'ACME Oil & Gas',
    nullable: true,
  })
  operator!: string | null;

  @ApiProperty({
    description: 'Spud date (ISO 8601 format)',
    example: '2024-01-15T00:00:00.000Z',
    nullable: true,
  })
  spudDate!: string | null;

  @ApiProperty({
    description: 'Completion date (ISO 8601 format)',
    example: '2024-03-20T00:00:00.000Z',
    nullable: true,
  })
  completionDate!: string | null;

  @ApiProperty({
    description: 'Custom metadata',
    example: { formation: 'Wolfcamp', depth: 8500 },
  })
  metadata!: Record<string, unknown>;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2024-01-10T12:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2024-01-15T14:30:00.000Z',
  })
  updatedAt!: string;
}

export class GetWellsResponseDto {
  @ApiProperty({
    description: 'List of wells',
    type: [WellDto],
  })
  wells!: WellDto[];

  @ApiProperty({
    description: 'Total count of wells matching filters',
    example: 150,
  })
  total!: number;
}

export class CreateWellResponseDto {
  @ApiProperty({
    description: 'Created well ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Success message',
    example: 'Well created successfully',
  })
  message!: string;
}
