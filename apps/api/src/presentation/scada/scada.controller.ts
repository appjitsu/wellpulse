/**
 * SCADA Controller
 *
 * REST API endpoints for managing SCADA connections and tag mappings.
 * Enables automated data collection from RTU/PLC systems via OPC-UA protocol.
 * All endpoints require authentication and tenant context.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { TenantId } from '../decorators/tenant-id.decorator';
import { CreateScadaConnectionDto } from './dto/create-scada-connection.dto';
import { CreateTagMappingsDto } from './dto/create-tag-mappings.dto';
import {
  ScadaConnectionsResponseDto,
  ScadaConnectionResponseDto,
  CreateScadaConnectionSuccessDto,
  CreateTagMappingsSuccessDto,
} from './dto/scada.response.dto';
import { CreateScadaConnectionCommand } from '../../application/scada/commands/create-scada-connection.command';
import {
  CreateTagMappingsCommand,
  TagConfigInput,
  CreateTagMappingsResult,
} from '../../application/scada/commands/create-tag-mappings.command';
import { GetScadaConnectionsQuery } from '../../application/scada/queries/get-scada-connections';
import { OpcUaDataType } from '../../domain/scada/value-objects/tag-configuration.vo';

/**
 * Current User Interface
 */
interface ICurrentUser {
  userId: string;
  email: string;
  roles: string[];
}

@ApiTags('scada')
@ApiBearerAuth('access-token')
@Controller('scada')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScadaController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * Create SCADA Connection
   * POST /scada/connections
   *
   * Creates a new SCADA connection configuration for a well to enable
   * automated data collection from RTU/PLC via OPC-UA protocol.
   * Only Admin and Manager roles can create connections.
   */
  @Post('connections')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Create SCADA connection',
    description:
      'Create a new SCADA connection to enable automated data collection from RTU/PLC systems via OPC-UA',
  })
  @ApiResponse({
    status: 201,
    description: 'SCADA connection created successfully',
    type: CreateScadaConnectionSuccessDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 404, description: 'Well not found' })
  @ApiResponse({
    status: 409,
    description: 'Well already has a SCADA connection or name conflicts',
  })
  async createConnection(
    @TenantId() tenantId: string,
    @CurrentUser() user: ICurrentUser,
    @Body() dto: CreateScadaConnectionDto,
  ): Promise<CreateScadaConnectionSuccessDto> {
    const command = new CreateScadaConnectionCommand(
      tenantId,
      dto.wellId,
      dto.name,
      dto.description,
      dto.opcUaUrl,
      dto.securityMode,
      dto.securityPolicy,
      dto.username,
      dto.password,
      dto.pollIntervalSeconds,
      user.userId,
    );

    const connection = await this.commandBus.execute<
      CreateScadaConnectionCommand,
      ScadaConnectionResponseDto
    >(command);

    return {
      message: 'SCADA connection created successfully',
      connection,
    };
  }

  /**
   * Get SCADA Connections
   * GET /scada/connections
   *
   * Retrieves all SCADA connections for the tenant with optional filtering.
   * All authenticated users can view SCADA connections.
   */
  @Get('connections')
  @ApiOperation({
    summary: 'Get SCADA connections',
    description:
      'Retrieve all SCADA connections for the tenant with optional filtering by well or status',
  })
  @ApiQuery({
    name: 'wellId',
    required: false,
    description: 'Filter by well ID',
  })
  @ApiQuery({
    name: 'onlyEnabled',
    required: false,
    description: 'Only return enabled connections',
    type: Boolean,
  })
  @ApiResponse({
    status: 200,
    description: 'SCADA connections retrieved successfully',
    type: ScadaConnectionsResponseDto,
  })
  async getConnections(
    @TenantId() tenantId: string,
    @Query('wellId') wellId?: string,
    @Query('onlyEnabled') onlyEnabled?: boolean,
  ): Promise<ScadaConnectionsResponseDto> {
    const query = new GetScadaConnectionsQuery(tenantId, wellId, onlyEnabled);

    return this.queryBus.execute<
      GetScadaConnectionsQuery,
      ScadaConnectionsResponseDto
    >(query);
  }

  /**
   * Get SCADA Connection by ID
   * GET /scada/connections/:id
   *
   * Retrieves a specific SCADA connection by ID.
   * All authenticated users can view SCADA connection details.
   */
  @Get('connections/:id')
  @ApiOperation({
    summary: 'Get SCADA connection by ID',
    description: 'Retrieve a specific SCADA connection by its ID',
  })
  @ApiParam({
    name: 'id',
    description: 'SCADA connection ID',
  })
  @ApiResponse({
    status: 200,
    description: 'SCADA connection retrieved successfully',
    type: ScadaConnectionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'SCADA connection not found' })
  async getConnectionById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ): Promise<ScadaConnectionResponseDto> {
    const query = new GetScadaConnectionsQuery(tenantId);
    const result = await this.queryBus.execute<
      GetScadaConnectionsQuery,
      ScadaConnectionsResponseDto
    >(query);

    const connection = result.connections.find(
      (c: ScadaConnectionResponseDto) => c.id === id,
    );

    if (!connection) {
      throw new Error('SCADA connection not found');
    }

    return connection;
  }

  /**
   * Create Tag Mappings
   * POST /scada/connections/:connectionId/tags
   *
   * Creates multiple tag mappings for a SCADA connection to map OPC-UA tags
   * to field entry properties.
   * Only Admin and Manager roles can create tag mappings.
   */
  @Post('connections/:connectionId/tags')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Create tag mappings',
    description:
      'Create multiple tag mappings to map OPC-UA tags to field entry properties',
  })
  @ApiParam({
    name: 'connectionId',
    description: 'SCADA connection ID',
  })
  @ApiResponse({
    status: 201,
    description: 'Tag mappings created successfully',
    type: CreateTagMappingsSuccessDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 404, description: 'SCADA connection not found' })
  @ApiResponse({
    status: 409,
    description: 'Duplicate node ID, field property, or tag name',
  })
  async createTagMappings(
    @TenantId() tenantId: string,
    @CurrentUser() user: ICurrentUser,
    @Param('connectionId') connectionId: string,
    @Body() dto: CreateTagMappingsDto,
  ): Promise<CreateTagMappingsSuccessDto> {
    // Map DTOs to command input type with proper type casting
    const tagInputs: TagConfigInput[] = dto.tags.map((tag) => ({
      nodeId: tag.nodeId,
      tagName: tag.tagName,
      fieldEntryProperty: tag.fieldEntryProperty,
      dataType: tag.dataType as OpcUaDataType,
      unit: tag.unit,
      scalingFactor: tag.scalingFactor,
      deadband: tag.deadband,
    }));

    const command = new CreateTagMappingsCommand(
      tenantId,
      connectionId,
      tagInputs,
      user.userId,
    );

    const result = await this.commandBus.execute<
      CreateTagMappingsCommand,
      CreateTagMappingsResult
    >(command);

    return {
      message: `${result.count} tag mapping${result.count === 1 ? '' : 's'} created successfully`,
      result,
    };
  }
}
