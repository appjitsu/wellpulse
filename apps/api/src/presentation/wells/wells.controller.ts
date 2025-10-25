/**
 * Wells Controller
 *
 * REST API endpoints for well management.
 * All endpoints require authentication and tenant context.
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { TenantId } from '../decorators/tenant-id.decorator';
import { CreateWellDto } from './dto/create-well.dto';
import { UpdateWellDto } from './dto/update-well.dto';
import { GetWellsQueryDto } from './dto/get-wells-query.dto';
import {
  WellDto,
  GetWellsResponseDto,
  CreateWellResponseDto,
} from './dto/well.dto';
import { CreateWellCommand } from '../../application/wells/commands/create-well.command';
import { UpdateWellCommand } from '../../application/wells/commands/update-well.command';
import { DeleteWellCommand } from '../../application/wells/commands/delete-well.command';
import { ActivateWellCommand } from '../../application/wells/commands/activate-well.command';
import { DeactivateWellCommand } from '../../application/wells/commands/deactivate-well.command';
import {
  GetWellsQuery,
  GetWellsResult,
} from '../../application/wells/queries/get-wells.query';
import {
  GetWellByIdQuery,
  WellDto as GetWellByIdResult,
} from '../../application/wells/queries/get-well-by-id.query';

@ApiTags('wells')
@ApiBearerAuth('access-token')
@Controller('wells')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WellsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * Create a new well
   * POST /wells
   *
   * Only Admin and Manager roles can create wells.
   */
  @Post()
  @Roles('ADMIN', 'MANAGER')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new well' })
  @ApiResponse({
    status: 201,
    description: 'Well created successfully',
    type: CreateWellResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'API number already exists' })
  async createWell(
    @TenantId() tenantId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateWellDto,
  ): Promise<CreateWellResponseDto> {
    const wellId = await this.commandBus.execute<CreateWellCommand, string>(
      new CreateWellCommand(tenantId, user.userId, dto),
    );

    return {
      id: wellId,
      message: 'Well created successfully',
    };
  }

  /**
   * Get all wells with optional filters
   * GET /wells
   *
   * All authenticated users can view wells.
   */
  @Get()
  @ApiOperation({ summary: 'Get all wells for tenant' })
  @ApiResponse({
    status: 200,
    description: 'Wells retrieved successfully',
    type: GetWellsResponseDto,
  })
  async getWells(
    @TenantId() tenantId: string,
    @Query() query: GetWellsQueryDto,
  ): Promise<GetWellsResponseDto> {
    return this.queryBus.execute<GetWellsQuery, GetWellsResult>(
      new GetWellsQuery(tenantId, query),
    );
  }

  /**
   * Get well by ID
   * GET /wells/:id
   *
   * All authenticated users can view well details.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get well by ID' })
  @ApiResponse({
    status: 200,
    description: 'Well retrieved successfully',
    type: WellDto,
  })
  @ApiResponse({ status: 404, description: 'Well not found' })
  async getWellById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ): Promise<WellDto> {
    const well = await this.queryBus.execute<
      GetWellByIdQuery,
      GetWellByIdResult | null
    >(new GetWellByIdQuery(tenantId, id));

    if (!well) {
      throw new NotFoundException('Well not found');
    }

    return well;
  }

  /**
   * Update well
   * PATCH /wells/:id
   *
   * Only Admin and Manager roles can update wells.
   */
  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update well' })
  @ApiResponse({ status: 200, description: 'Well updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Well not found' })
  async updateWell(
    @TenantId() tenantId: string,
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateWellDto,
  ): Promise<{ message: string }> {
    await this.commandBus.execute(
      new UpdateWellCommand(tenantId, user.userId, id, dto),
    );

    return {
      message: 'Well updated successfully',
    };
  }

  /**
   * Delete well (soft delete)
   * DELETE /wells/:id
   *
   * Only Admin role can delete wells.
   */
  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete well (soft delete)' })
  @ApiResponse({ status: 200, description: 'Well deleted successfully' })
  @ApiResponse({ status: 404, description: 'Well not found' })
  async deleteWell(
    @TenantId() tenantId: string,
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    await this.commandBus.execute(
      new DeleteWellCommand(tenantId, user.userId, id),
    );

    return {
      message: 'Well deleted successfully',
    };
  }

  /**
   * Activate well
   * PATCH /wells/:id/activate
   *
   * Only Admin and Manager roles can activate wells.
   */
  @Patch(':id/activate')
  @Roles('ADMIN', 'MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate well' })
  @ApiResponse({ status: 200, description: 'Well activated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot activate plugged well' })
  @ApiResponse({ status: 404, description: 'Well not found' })
  async activateWell(
    @TenantId() tenantId: string,
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    await this.commandBus.execute(
      new ActivateWellCommand(tenantId, user.userId, id),
    );

    return {
      message: 'Well activated successfully',
    };
  }

  /**
   * Deactivate well
   * PATCH /wells/:id/deactivate
   *
   * Only Admin and Manager roles can deactivate wells.
   */
  @Patch(':id/deactivate')
  @Roles('ADMIN', 'MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate well' })
  @ApiResponse({ status: 200, description: 'Well deactivated successfully' })
  @ApiResponse({ status: 404, description: 'Well not found' })
  async deactivateWell(
    @TenantId() tenantId: string,
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    await this.commandBus.execute(
      new DeactivateWellCommand(tenantId, user.userId, id),
    );

    return {
      message: 'Well deactivated successfully',
    };
  }
}
