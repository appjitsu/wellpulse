/**
 * SCADA Readings Controller
 *
 * REST API endpoints for recording and querying SCADA readings.
 * Handles time-series data from RTU/PLC devices and SCADA systems.
 *
 * All endpoints require authentication and tenant context.
 *
 * Architecture:
 * - Uses CQRS pattern (CommandBus/QueryBus)
 * - Tenant-scoped data access
 * - Role-based access control
 * - Input validation via DTOs
 * - Proper error handling with HTTP status codes
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { TenantId } from '../decorators/tenant-id.decorator';
import {
  RecordScadaReadingCommand,
  GetScadaReadingsQuery,
} from '../../application/scada';
import { ScadaReadingDto } from '../../application/scada/dto';
import { RecordScadaReadingDto, GetScadaReadingsQueryDto } from './dto';

@ApiTags('scada')
@ApiBearerAuth('access-token')
@Controller('scada/readings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScadaReadingsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * Record a SCADA reading
   * POST /scada/readings
   *
   * Records a single SCADA reading from RTU/PLC device.
   * Used by SCADA polling service for real-time data ingestion.
   *
   * Only Admin, Manager, and Consultant roles can record readings.
   * In production, SCADA service will use a dedicated service account.
   */
  @Post()
  @Roles('ADMIN', 'MANAGER', 'CONSULTANT')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record SCADA reading',
    description: 'Records a single SCADA reading from RTU/PLC device',
  })
  @ApiResponse({
    status: 201,
    description: 'Reading recorded successfully',
    schema: {
      type: 'object',
      properties: {
        readingId: {
          type: 'string',
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input (validation error or out-of-range value)',
  })
  @ApiResponse({
    status: 404,
    description: 'Well or SCADA connection not found',
  })
  async recordReading(
    @TenantId() tenantId: string,
    @Body() dto: RecordScadaReadingDto,
  ): Promise<{ readingId: string }> {
    // Validate tenant context
    if (!tenantId) {
      throw new BadRequestException('Tenant context is required');
    }

    // Execute command to record reading
    const command = new RecordScadaReadingCommand(
      tenantId,
      dto.wellId,
      dto.scadaConnectionId,
      dto.tagName,
      dto.value,
      dto.quality,
      dto.timestamp,
      dto.unit,
      dto.minValue,
      dto.maxValue,
      dto.metadata,
    );

    const readingId = await this.commandBus.execute<
      RecordScadaReadingCommand,
      string
    >(command);

    return { readingId };
  }

  /**
   * Get SCADA readings with filters
   * GET /scada/readings
   *
   * Retrieves time-series SCADA readings with optional filters.
   * Supports filtering by well, connection, tag, and time range.
   * Includes pagination for large datasets.
   *
   * All authenticated users can view SCADA readings.
   */
  @Get()
  @ApiOperation({
    summary: 'Get SCADA readings',
    description:
      'Retrieves time-series SCADA readings with optional filters and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Readings retrieved successfully',
    type: [ScadaReadingDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
  })
  async getReadings(
    @TenantId() tenantId: string,
    @Query() queryDto: GetScadaReadingsQueryDto,
  ): Promise<ScadaReadingDto[]> {
    // Validate tenant context
    if (!tenantId) {
      throw new BadRequestException('Tenant context is required');
    }

    // Parse optional date filters
    const startTime = queryDto.startTime
      ? new Date(queryDto.startTime)
      : undefined;
    const endTime = queryDto.endTime ? new Date(queryDto.endTime) : undefined;

    // Validate date range
    if (startTime && endTime && startTime > endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    // Parse pagination parameters with defaults
    const limit = queryDto.limit ? parseInt(queryDto.limit, 10) : 100;
    const offset = queryDto.offset ? parseInt(queryDto.offset, 10) : 0;

    // Validate pagination parameters
    if (limit < 1 || limit > 1000) {
      throw new BadRequestException('Limit must be between 1 and 1000');
    }

    if (offset < 0) {
      throw new BadRequestException('Offset must be non-negative');
    }

    // Execute query to fetch readings
    const query = new GetScadaReadingsQuery(
      tenantId,
      queryDto.wellId,
      queryDto.connectionId,
      queryDto.tagName,
      startTime,
      endTime,
      limit,
      offset,
    );

    return this.queryBus.execute<GetScadaReadingsQuery, ScadaReadingDto[]>(
      query,
    );
  }
}
