/**
 * CSV Import Response DTOs
 *
 * Response DTOs for CSV import queries.
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * CSV Import Response DTO
 */
export class CsvImportDto {
  @ApiProperty({
    description: 'Import ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Tenant ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  tenantId!: string;

  @ApiProperty({
    description: 'File name',
    example: 'production_data_2024_01.csv',
  })
  fileName!: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 1048576,
  })
  fileSizeBytes!: number;

  @ApiProperty({
    description: 'Import status',
    enum: ['queued', 'processing', 'completed', 'failed'],
    example: 'processing',
  })
  status!: 'queued' | 'processing' | 'completed' | 'failed';

  @ApiProperty({
    description: 'Total rows to process',
    example: 500,
  })
  totalRows!: number;

  @ApiProperty({
    description: 'Rows successfully processed',
    example: 450,
  })
  rowsProcessed!: number;

  @ApiProperty({
    description: 'Rows that failed validation',
    example: 25,
  })
  rowsFailed!: number;

  @ApiProperty({
    description: 'Rows skipped due to duplicates',
    example: 25,
  })
  rowsSkipped!: number;

  @ApiProperty({
    description: 'Column mapping configuration',
    example: {
      mappings: [
        {
          csvColumn: 'API_Number',
          standardField: 'apiNumber',
          confidence: 0.95,
        },
        {
          csvColumn: 'Oil_Volume',
          standardField: 'oilVolume',
          confidence: 1.0,
        },
      ],
      detectedFormat: 'Prophet',
    },
  })
  columnMapping!: {
    mappings: Array<{
      csvColumn: string;
      standardField: string;
      confidence: number;
    }>;
    detectedFormat?: string;
  };

  @ApiProperty({
    description: 'Conflict strategy',
    enum: ['skip', 'overwrite', 'merge'],
    example: 'skip',
  })
  conflictStrategy!: 'skip' | 'overwrite' | 'merge';

  @ApiProperty({
    description: 'Error summary (if failed)',
    example: 'Failed to parse row 123: Invalid date format',
    nullable: true,
  })
  errorSummary!: string | null;

  @ApiProperty({
    description: 'Completion percentage (0-100)',
    example: 90,
  })
  progress!: number;

  @ApiProperty({
    description: 'Estimated seconds remaining',
    example: 30,
    nullable: true,
  })
  estimatedSecondsRemaining!: number | null;

  @ApiProperty({
    description: 'User who created the import',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  createdBy!: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-10-30T23:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Start timestamp',
    example: '2024-10-30T23:01:00.000Z',
    nullable: true,
  })
  startedAt!: string | null;

  @ApiProperty({
    description: 'Completion timestamp',
    example: '2024-10-30T23:05:00.000Z',
    nullable: true,
  })
  completedAt!: string | null;
}

/**
 * Get CSV Imports Response DTO
 */
export class GetCsvImportsResponseDto {
  @ApiProperty({
    description: 'List of imports',
    type: [CsvImportDto],
  })
  imports!: CsvImportDto[];

  @ApiProperty({
    description: 'Total count (for pagination)',
    example: 50,
  })
  total!: number;
}
