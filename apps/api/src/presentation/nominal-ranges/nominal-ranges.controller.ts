/**
 * Nominal Ranges Controller
 *
 * REST API endpoints for managing nominal ranges (acceptable value thresholds).
 * Supports both organization-wide defaults and well-specific overrides.
 * All endpoints require authentication and tenant context.
 */

import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { TenantId } from '../decorators/tenant-id.decorator';
import { UpdateOrgNominalRangesDto } from './dto/update-org-nominal-ranges.dto';
import { SetWellNominalRangeDto } from './dto/set-well-nominal-range.dto';
import {
  OrgNominalRangesResponseDto,
  WellNominalRangesResponseDto,
  EffectiveNominalRangesResponseDto,
  UpdateNominalRangesSuccessDto,
  DeleteNominalRangeSuccessDto,
} from './dto/nominal-range.response.dto';
import { UpdateOrgNominalRangesCommand } from '../../application/nominal-ranges/commands/update-org-nominal-ranges.command';
import { SetWellNominalRangeCommand } from '../../application/nominal-ranges/commands/set-well-nominal-range.command';
import { DeleteOrgNominalRangeCommand } from '../../application/nominal-ranges/commands/delete-org-nominal-range.command';
import { DeleteWellNominalRangeCommand } from '../../application/nominal-ranges/commands/delete-well-nominal-range.command';
import { GetOrgNominalRangesQuery } from '../../application/nominal-ranges/queries/get-org-nominal-ranges.query';
import { GetWellNominalRangesQuery } from '../../application/nominal-ranges/queries/get-well-nominal-ranges.query';
import { GetEffectiveNominalRangesQuery } from '../../application/nominal-ranges/queries/get-effective-nominal-ranges.query';

@ApiTags('nominal-ranges')
@ApiBearerAuth('access-token')
@Controller('nominal-ranges')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NominalRangesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * Get organization-wide nominal ranges
   * GET /nominal-ranges/org
   *
   * Returns the default nominal ranges that apply to all wells unless overridden.
   * All authenticated users can view organization ranges.
   */
  @Get('org')
  @ApiOperation({
    summary: 'Get organization-wide nominal ranges',
    description:
      'Retrieve default nominal ranges that apply to all wells in the organization',
  })
  @ApiResponse({
    status: 200,
    description: 'Organization nominal ranges retrieved successfully',
    type: OrgNominalRangesResponseDto,
  })
  async getOrgNominalRanges(
    @TenantId() tenantId: string,
  ): Promise<OrgNominalRangesResponseDto> {
    return this.queryBus.execute<
      GetOrgNominalRangesQuery,
      OrgNominalRangesResponseDto
    >(new GetOrgNominalRangesQuery(tenantId));
  }

  /**
   * Update organization-wide nominal ranges
   * PUT /nominal-ranges/org
   *
   * Updates or creates organization-wide default nominal ranges.
   * Only Admin and Manager roles can update organization ranges.
   */
  @Put('org')
  @Roles('ADMIN', 'MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update organization-wide nominal ranges',
    description:
      'Set or update default nominal ranges for all wells in the organization',
  })
  @ApiResponse({
    status: 200,
    description: 'Organization nominal ranges updated successfully',
    type: UpdateNominalRangesSuccessDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async updateOrgNominalRanges(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateOrgNominalRangesDto,
  ): Promise<UpdateNominalRangesSuccessDto> {
    if (!dto.ranges || dto.ranges.length === 0) {
      throw new BadRequestException('At least one nominal range is required');
    }

    const updatedCount = await this.commandBus.execute<
      UpdateOrgNominalRangesCommand,
      number
    >(new UpdateOrgNominalRangesCommand(tenantId, userId, dto.ranges));

    return {
      message: 'Organization nominal ranges updated successfully',
      updatedCount,
    };
  }

  /**
   * Delete organization-wide nominal range
   * DELETE /nominal-ranges/org/:rangeId
   *
   * Removes an organization-wide nominal range.
   * Only Admin and Manager roles can delete organization ranges.
   */
  @Delete('org/:rangeId')
  @Roles('ADMIN', 'MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete organization-wide nominal range',
    description: 'Remove a default nominal range from the organization',
  })
  @ApiParam({
    name: 'rangeId',
    description: 'Nominal range ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Nominal range deleted successfully',
    type: DeleteNominalRangeSuccessDto,
  })
  @ApiResponse({ status: 404, description: 'Nominal range not found' })
  async deleteOrgNominalRange(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('rangeId') rangeId: string,
  ): Promise<DeleteNominalRangeSuccessDto> {
    await this.commandBus.execute(
      new DeleteOrgNominalRangeCommand(tenantId, userId, rangeId),
    );

    return {
      message: 'Nominal range deleted successfully',
    };
  }

  /**
   * Get well-specific nominal range overrides
   * GET /nominal-ranges/well/:wellId
   *
   * Returns nominal ranges that have been customized for a specific well.
   * All authenticated users can view well-specific ranges.
   */
  @Get('well/:wellId')
  @ApiOperation({
    summary: 'Get well-specific nominal range overrides',
    description:
      'Retrieve custom nominal ranges that override organization defaults for a specific well',
  })
  @ApiParam({
    name: 'wellId',
    description: 'Well ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Well-specific nominal ranges retrieved successfully',
    type: WellNominalRangesResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Well not found' })
  async getWellNominalRanges(
    @TenantId() tenantId: string,
    @Param('wellId') wellId: string,
  ): Promise<WellNominalRangesResponseDto> {
    const result = await this.queryBus.execute<
      GetWellNominalRangesQuery,
      WellNominalRangesResponseDto | null
    >(new GetWellNominalRangesQuery(tenantId, wellId));

    if (!result) {
      throw new NotFoundException('Well not found');
    }

    return result;
  }

  /**
   * Set well-specific nominal range override
   * PUT /nominal-ranges/well/:wellId/:fieldName
   *
   * Creates or updates a well-specific override for a particular field.
   * Only Admin and Manager roles can set well-specific overrides.
   */
  @Put('well/:wellId/:fieldName')
  @Roles('ADMIN', 'MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set well-specific nominal range override',
    description:
      'Create or update a custom nominal range for a specific well and field',
  })
  @ApiParam({
    name: 'wellId',
    description: 'Well ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiParam({
    name: 'fieldName',
    description: 'Field name (e.g., oilRate, gasRate)',
    example: 'oilRate',
  })
  @ApiResponse({
    status: 200,
    description: 'Well-specific nominal range set successfully',
    type: UpdateNominalRangesSuccessDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Well not found' })
  async setWellNominalRange(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('wellId') wellId: string,
    @Param('fieldName') fieldName: string,
    @Body() dto: SetWellNominalRangeDto,
  ): Promise<UpdateNominalRangesSuccessDto> {
    if (dto.min >= dto.max) {
      throw new BadRequestException('Minimum value must be less than maximum');
    }

    await this.commandBus.execute(
      new SetWellNominalRangeCommand(tenantId, wellId, userId, {
        fieldName,
        minValue: dto.min,
        maxValue: dto.max,
        unit: dto.unit,
        severity: dto.severity,
        reason: dto.overrideReason,
      }),
    );

    return {
      message: 'Well-specific nominal range set successfully',
      updatedCount: 1,
    };
  }

  /**
   * Delete well-specific nominal range override
   * DELETE /nominal-ranges/well/:wellId/:fieldName
   *
   * Removes a well-specific override, reverting to organization default.
   * Only Admin and Manager roles can delete well-specific overrides.
   */
  @Delete('well/:wellId/:fieldName')
  @Roles('ADMIN', 'MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete well-specific nominal range override',
    description:
      'Remove a custom nominal range override, reverting to organization default',
  })
  @ApiParam({
    name: 'wellId',
    description: 'Well ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiParam({
    name: 'fieldName',
    description: 'Field name',
    example: 'oilRate',
  })
  @ApiResponse({
    status: 200,
    description: 'Well-specific override deleted successfully',
    type: DeleteNominalRangeSuccessDto,
  })
  @ApiResponse({ status: 404, description: 'Override not found' })
  async deleteWellNominalRange(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('wellId') wellId: string,
    @Param('fieldName') fieldName: string,
  ): Promise<DeleteNominalRangeSuccessDto> {
    await this.commandBus.execute(
      new DeleteWellNominalRangeCommand(tenantId, userId, wellId, fieldName),
    );

    return {
      message: 'Well-specific override deleted successfully',
    };
  }

  /**
   * Get effective nominal ranges for a well
   * GET /nominal-ranges/effective/:wellId
   *
   * Returns the merged view of nominal ranges for a well, combining
   * well-specific overrides with organization defaults.
   * This is the actual set of ranges that will be used for alerting.
   * All authenticated users can view effective ranges.
   */
  @Get('effective/:wellId')
  @ApiOperation({
    summary: 'Get effective nominal ranges for a well',
    description:
      'Retrieve the complete set of nominal ranges for a well (well overrides merged with org defaults)',
  })
  @ApiParam({
    name: 'wellId',
    description: 'Well ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Effective nominal ranges retrieved successfully',
    type: EffectiveNominalRangesResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Well not found' })
  async getEffectiveNominalRanges(
    @TenantId() tenantId: string,
    @Param('wellId') wellId: string,
  ): Promise<EffectiveNominalRangesResponseDto> {
    const result = await this.queryBus.execute<
      GetEffectiveNominalRangesQuery,
      EffectiveNominalRangesResponseDto | null
    >(new GetEffectiveNominalRangesQuery(tenantId, wellId, null));

    if (!result) {
      throw new NotFoundException('Well not found');
    }

    return result;
  }
}
