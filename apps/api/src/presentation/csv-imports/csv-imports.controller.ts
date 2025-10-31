/**
 * CSV Imports Controller
 *
 * REST API endpoints for CSV import management.
 * All endpoints require authentication and tenant context.
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import {
  TenantContext,
  TenantContextDto,
} from '../../infrastructure/decorators/tenant-context.decorator';
import {
  CreateCsvImportDto,
  CreateCsvImportResponseDto,
} from './dto/create-csv-import.dto';
import {
  CsvImportDto,
  GetCsvImportsResponseDto,
} from './dto/csv-import.response.dto';
import { GetCsvImportsQueryDto } from './dto/get-csv-imports-query.dto';
import { CreateCsvImportCommand } from '../../application/csv-imports/commands/create-csv-import.command';
import { ProcessCsvImportCommand } from '../../application/csv-imports/commands/process-csv-import.command';
import { GetCsvImportQuery } from '../../application/csv-imports/queries/get-csv-import.query';
import { GetCsvImportsQuery } from '../../application/csv-imports/queries/get-csv-imports.query';

@ApiTags('csv-imports')
@ApiBearerAuth('access-token')
@Controller('csv-imports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CsvImportsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * Create a new CSV import
   *
   * Creates an import record after file upload and validation.
   * The import starts in 'queued' status.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN', 'MANAGER', 'OPERATOR')
  @ApiOperation({
    summary: 'Create CSV import',
    description: 'Create a new CSV import record after file upload',
  })
  @ApiResponse({
    status: 201,
    description: 'Import created successfully',
    type: CreateCsvImportResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createImport(
    @TenantContext() tenantContext: TenantContextDto,
    @CurrentUser() user: { userId: string },
    @Body() createDto: CreateCsvImportDto,
  ): Promise<CreateCsvImportResponseDto> {
    const importId = await this.commandBus.execute<
      CreateCsvImportCommand,
      string
    >(
      new CreateCsvImportCommand(
        tenantContext.id,
        user.userId,
        {
          fileName: createDto.fileName,
          fileSizeBytes: createDto.fileSizeBytes,
          totalRows: createDto.totalRows,
          columnMapping: createDto.columnMapping,
          conflictStrategy: createDto.conflictStrategy,
        },
        tenantContext.databaseName,
      ),
    );

    // Optionally trigger background processing here
    // await this.commandBus.execute(
    //   new ProcessCsvImportCommand(
    //     tenantContext.id,
    //     importId,
    //     tenantContext.databaseName,
    //   ),
    // );

    return {
      importId,
      status: 'queued',
      message: 'Import created successfully and queued for processing',
    };
  }

  /**
   * Get import by ID
   *
   * Retrieves detailed information about a specific import.
   */
  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER')
  @ApiOperation({
    summary: 'Get import details',
    description: 'Retrieve detailed information about a CSV import',
  })
  @ApiResponse({
    status: 200,
    description: 'Import details retrieved successfully',
    type: CsvImportDto,
  })
  @ApiResponse({ status: 404, description: 'Import not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getImport(
    @TenantContext() tenantContext: TenantContextDto,
    @Param('id') importId: string,
  ): Promise<CsvImportDto> {
    const result = await this.queryBus.execute<GetCsvImportQuery, CsvImportDto>(
      new GetCsvImportQuery(
        tenantContext.id,
        importId,
        tenantContext.databaseName,
      ),
    );

    if (!result) {
      throw new NotFoundException(`Import ${importId} not found`);
    }

    return result;
  }

  /**
   * Get all imports for tenant
   *
   * Retrieves paginated list of imports with optional filtering.
   */
  @Get()
  @Roles('ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER')
  @ApiOperation({
    summary: 'List imports',
    description: 'Get paginated list of CSV imports with optional filters',
  })
  @ApiResponse({
    status: 200,
    description: 'Imports retrieved successfully',
    type: GetCsvImportsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getImports(
    @TenantContext() tenantContext: TenantContextDto,
    @Query() queryDto: GetCsvImportsQueryDto,
  ): Promise<GetCsvImportsResponseDto> {
    const result = await this.queryBus.execute<
      GetCsvImportsQuery,
      GetCsvImportsResponseDto
    >(
      new GetCsvImportsQuery(tenantContext.id, {
        status: queryDto.status,
        limit: queryDto.limit,
        offset: queryDto.offset,
        databaseName: tenantContext.databaseName,
      }),
    );

    return result;
  }

  /**
   * Trigger import processing
   *
   * Manually trigger processing for a queued import.
   * Typically used for retrying failed imports.
   */
  @Post(':id/process')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Process import',
    description: 'Trigger background processing for a queued import',
  })
  @ApiResponse({
    status: 202,
    description: 'Import processing started',
  })
  @ApiResponse({ status: 404, description: 'Import not found' })
  @ApiResponse({ status: 400, description: 'Import not in queued status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async processImport(
    @TenantContext() tenantContext: TenantContextDto,
    @Param('id') importId: string,
  ): Promise<{ message: string }> {
    // First check if import exists and is queued
    const csvImport = await this.queryBus.execute<
      GetCsvImportQuery,
      CsvImportDto
    >(
      new GetCsvImportQuery(
        tenantContext.id,
        importId,
        tenantContext.databaseName,
      ),
    );

    if (!csvImport) {
      throw new NotFoundException(`Import ${importId} not found`);
    }

    // Trigger background processing
    await this.commandBus.execute<ProcessCsvImportCommand, void>(
      new ProcessCsvImportCommand(
        tenantContext.id,
        importId,
        tenantContext.databaseName,
      ),
    );

    return {
      message: 'Import processing started',
    };
  }
}
