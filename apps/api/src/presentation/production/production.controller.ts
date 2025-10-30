/**
 * Production Controller
 *
 * REST API endpoints for production analytics.
 * All endpoints require authentication and tenant context.
 */

import { Controller, Get, Query, HttpStatus, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TenantId } from '../decorators/tenant-id.decorator';
import {
  GetMonthlyTrendQueryDto,
  GetMonthlyTrendResponseDto,
  GetWellTypeBreakdownResponseDto,
  MonthlyTrendDto,
  WellTypeBreakdownDto,
} from '../../application/production/dto/production.dto';
import { GetMonthlyTrendQuery } from '../../application/production/queries/get-monthly-trend.query';
import { GetWellTypeBreakdownQuery } from '../../application/production/queries/get-well-type-breakdown.query';

@ApiTags('production')
@ApiBearerAuth('access-token')
@Controller('production')
@UseGuards(JwtAuthGuard)
export class ProductionController {
  constructor(private readonly queryBus: QueryBus) {}

  /**
   * Get monthly production trend
   * GET /production/monthly-trend
   *
   * Returns aggregated production data by month for trend analysis.
   * Used for dashboard charts showing production vs targets over time.
   */
  @Get('monthly-trend')
  @ApiOperation({
    summary: 'Get monthly production trend',
    description:
      'Returns production data aggregated by month with targets and efficiency metrics',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Monthly trend data retrieved successfully',
    type: GetMonthlyTrendResponseDto,
  })
  async getMonthlyTrend(
    @TenantId() tenantId: string,
    @Query() query: GetMonthlyTrendQueryDto,
  ): Promise<GetMonthlyTrendResponseDto> {
    const data = await this.queryBus.execute<
      GetMonthlyTrendQuery,
      MonthlyTrendDto[]
    >(new GetMonthlyTrendQuery(tenantId, query.months));

    return { data };
  }

  /**
   * Get production breakdown by well type
   * GET /production/well-type-breakdown
   *
   * Returns production statistics grouped by well type (horizontal, vertical, directional).
   *
   * NOTE: Currently returns empty array as wellType field is not yet in schema.
   * TODO: Add wellType enum to wells.schema.ts and generate migration.
   */
  @Get('well-type-breakdown')
  @ApiOperation({
    summary: 'Get production breakdown by well type',
    description:
      'Returns production statistics grouped by well type. Currently returns empty array (TODO: add wellType to schema)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Well type breakdown retrieved successfully',
    type: GetWellTypeBreakdownResponseDto,
  })
  async getWellTypeBreakdown(
    @TenantId() tenantId: string,
  ): Promise<GetWellTypeBreakdownResponseDto> {
    const data = await this.queryBus.execute<
      GetWellTypeBreakdownQuery,
      WellTypeBreakdownDto[]
    >(new GetWellTypeBreakdownQuery(tenantId));

    return { data };
  }
}
