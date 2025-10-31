/**
 * Create CSV Import DTOs
 *
 * Request/response DTOs for creating CSV import records.
 */

import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsObject,
  IsEnum,
  IsArray,
  ValidateNested,
  IsOptional,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Field mapping for column detection
 */
export class FieldMappingDto {
  @ApiProperty({
    description: 'CSV column name',
    example: 'API_Number',
  })
  @IsString()
  csvColumn!: string;

  @ApiProperty({
    description: 'Standard field name to map to',
    example: 'apiNumber',
  })
  @IsString()
  standardField!: string;

  @ApiProperty({
    description: 'Confidence score (0-1) for auto-detection',
    example: 0.95,
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  @Min(0)
  confidence!: number;
}

/**
 * Column mapping configuration
 */
export class ColumnMappingDto {
  @ApiProperty({
    description: 'Array of field mappings',
    type: [FieldMappingDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldMappingDto)
  mappings!: FieldMappingDto[];

  @ApiProperty({
    description: 'Detected CSV format (e.g., Prophet, Enveyo, Custom)',
    example: 'Prophet',
    required: false,
  })
  @IsOptional()
  @IsString()
  detectedFormat?: string;
}

/**
 * Create CSV Import Request DTO
 */
export class CreateCsvImportDto {
  @ApiProperty({
    description: 'Name of uploaded CSV file',
    example: 'production_data_2024_01.csv',
  })
  @IsString()
  fileName!: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 1048576,
  })
  @IsNumber()
  @Min(1)
  fileSizeBytes!: number;

  @ApiProperty({
    description: 'Total number of rows in CSV (excluding header)',
    example: 500,
  })
  @IsNumber()
  @Min(0)
  totalRows!: number;

  @ApiProperty({
    description: 'Column mapping configuration',
    type: ColumnMappingDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => ColumnMappingDto)
  columnMapping!: ColumnMappingDto;

  @ApiProperty({
    description: 'Strategy for handling duplicate entries',
    enum: ['skip', 'overwrite', 'merge'],
    example: 'skip',
  })
  @IsEnum(['skip', 'overwrite', 'merge'])
  conflictStrategy!: 'skip' | 'overwrite' | 'merge';
}

/**
 * Create CSV Import Response DTO
 */
export class CreateCsvImportResponseDto {
  @ApiProperty({
    description: 'ID of created import',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  importId!: string;

  @ApiProperty({
    description: 'Import status',
    example: 'queued',
  })
  status!: string;

  @ApiProperty({
    description: 'Message describing next steps',
    example: 'Import queued for processing',
  })
  message!: string;
}
