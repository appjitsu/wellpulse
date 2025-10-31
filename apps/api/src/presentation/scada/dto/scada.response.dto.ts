/**
 * SCADA Response DTOs
 *
 * Response data transfer objects for SCADA API endpoints.
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * SCADA Connection Response DTO
 */
export class ScadaConnectionResponseDto {
  @ApiProperty({
    description: 'Unique connection identifier',
    example: 'scada_1698765432_abc123',
  })
  id!: string;

  @ApiProperty({
    description: 'Tenant ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  tenantId!: string;

  @ApiProperty({
    description: 'Well ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  wellId!: string;

  @ApiProperty({
    description: 'Connection name',
    example: 'Acme Well 001 RTU',
  })
  name!: string;

  @ApiProperty({
    description: 'Connection description',
    example: 'Primary SCADA system for production monitoring',
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: 'OPC-UA endpoint URL',
    example: 'opc.tcp://192.168.1.100:4840',
  })
  opcUaUrl!: string;

  @ApiProperty({
    description: 'Security mode',
    example: 'SignAndEncrypt',
  })
  securityMode!: string;

  @ApiProperty({
    description: 'Security policy',
    example: 'Basic256Sha256',
  })
  securityPolicy!: string;

  @ApiProperty({
    description: 'Whether connection has credentials configured',
    example: true,
  })
  hasCredentials!: boolean;

  @ApiProperty({
    description: 'Polling interval in seconds',
    example: 5,
  })
  pollIntervalSeconds!: number;

  @ApiProperty({
    description: 'Connection status',
    enum: ['inactive', 'connecting', 'active', 'error'],
    example: 'active',
  })
  status!: string;

  @ApiProperty({
    description: 'Last successful connection timestamp',
    example: '2025-10-29T12:00:00.000Z',
    required: false,
  })
  lastConnectedAt?: string;

  @ApiProperty({
    description: 'Last error message if status is error',
    example: 'Connection timeout',
    required: false,
  })
  lastErrorMessage?: string;

  @ApiProperty({
    description: 'Whether connection is enabled',
    example: true,
  })
  isEnabled!: boolean;

  @ApiProperty({
    description: 'Whether connection is healthy (connected and recent)',
    example: true,
  })
  isHealthy!: boolean;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-10-29T12:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-10-29T12:00:00.000Z',
  })
  updatedAt!: string;

  @ApiProperty({
    description: 'User who created the connection',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  createdBy!: string;

  @ApiProperty({
    description: 'User who last updated the connection',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  updatedBy!: string;
}

/**
 * SCADA Connections List Response DTO
 */
export class ScadaConnectionsResponseDto {
  @ApiProperty({
    description: 'Array of SCADA connections',
    type: [ScadaConnectionResponseDto],
  })
  connections!: ScadaConnectionResponseDto[];

  @ApiProperty({
    description: 'Total number of connections',
    example: 5,
  })
  count!: number;
}

/**
 * Tag Mapping Response DTO
 */
export class TagMappingResponseDto {
  @ApiProperty({
    description: 'Unique tag mapping identifier',
    example: 'tag_1698765432_xyz789',
  })
  id!: string;

  @ApiProperty({
    description: 'Tenant ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  tenantId!: string;

  @ApiProperty({
    description: 'SCADA connection ID',
    example: 'scada_1698765432_abc123',
  })
  scadaConnectionId!: string;

  @ApiProperty({
    description: 'OPC-UA node ID',
    example: 'ns=2;s=Pressure',
  })
  nodeId!: string;

  @ApiProperty({
    description: 'Tag name',
    example: 'casingPressure',
  })
  tagName!: string;

  @ApiProperty({
    description: 'Field entry property',
    example: 'casingPressure',
  })
  fieldEntryProperty!: string;

  @ApiProperty({
    description: 'Data type',
    example: 'Float',
  })
  dataType!: string;

  @ApiProperty({
    description: 'Measurement unit',
    example: 'psi',
    required: false,
  })
  unit?: string;

  @ApiProperty({
    description: 'Scaling factor',
    example: 1.0,
  })
  scalingFactor!: number;

  @ApiProperty({
    description: 'Deadband threshold',
    example: 5.0,
    required: false,
  })
  deadband?: number;

  @ApiProperty({
    description: 'Whether tag mapping is enabled',
    example: true,
  })
  isEnabled!: boolean;

  @ApiProperty({
    description: 'Last value read',
    example: 1250.5,
    required: false,
  })
  lastValue?: string | number | boolean;

  @ApiProperty({
    description: 'Last read timestamp',
    example: '2025-10-29T12:00:00.000Z',
    required: false,
  })
  lastReadAt?: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-10-29T12:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-10-29T12:00:00.000Z',
  })
  updatedAt!: string;
}

/**
 * Tag Mappings List Response DTO
 */
export class TagMappingsResponseDto {
  @ApiProperty({
    description: 'Array of tag mappings',
    type: [TagMappingResponseDto],
  })
  tagMappings!: TagMappingResponseDto[];

  @ApiProperty({
    description: 'Total number of tag mappings',
    example: 5,
  })
  count!: number;
}

/**
 * Create SCADA Connection Success Response DTO
 */
export class CreateScadaConnectionSuccessDto {
  @ApiProperty({
    description: 'Success message',
    example: 'SCADA connection created successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'Created SCADA connection',
    type: ScadaConnectionResponseDto,
  })
  connection!: ScadaConnectionResponseDto;
}

/**
 * Create Tag Mappings Success Response DTO
 */
export class CreateTagMappingsSuccessDto {
  @ApiProperty({
    description: 'Success message',
    example: '5 tag mappings created successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'Created tag mappings',
    type: TagMappingsResponseDto,
  })
  result!: TagMappingsResponseDto;
}
