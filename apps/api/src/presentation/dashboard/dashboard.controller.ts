/**
 * Dashboard Controller
 *
 * REST API endpoints for dashboard analytics.
 * All endpoints require authentication and tenant context.
 */

import { Controller, Get, UseGuards } from '@nestjs/common';
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
  DashboardMetricsDto,
  WellStatusDto,
  RecentActivityDto,
  TopProducersDto,
} from '../../application/dashboard/dto';
import {
  GetDashboardMetricsQuery,
  GetWellStatusQuery,
  GetRecentActivityQuery,
  GetTopProducersQuery,
} from '../../application/dashboard/queries';

@ApiTags('dashboard')
@ApiBearerAuth('access-token')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly queryBus: QueryBus) {}

  /**
   * Get dashboard metrics
   * GET /dashboard/metrics
   *
   * Returns aggregated metrics for the dashboard:
   * - Total wells count
   * - Daily production (last 24 hours)
   * - Active alerts count
   * - Monthly revenue estimate
   */
  @Get('metrics')
  @ApiOperation({ summary: 'Get dashboard metrics' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard metrics retrieved successfully',
    type: DashboardMetricsDto,
  })
  async getDashboardMetrics(
    @TenantId() tenantId: string,
  ): Promise<DashboardMetricsDto> {
    return this.queryBus.execute<GetDashboardMetricsQuery, DashboardMetricsDto>(
      new GetDashboardMetricsQuery(tenantId),
    );
  }

  /**
   * Get well status distribution
   * GET /dashboard/well-status
   *
   * Returns count of wells by status (ACTIVE, INACTIVE, PLUGGED).
   */
  @Get('well-status')
  @ApiOperation({ summary: 'Get well status distribution' })
  @ApiResponse({
    status: 200,
    description: 'Well status distribution retrieved successfully',
    type: WellStatusDto,
  })
  async getWellStatus(@TenantId() tenantId: string): Promise<WellStatusDto> {
    return this.queryBus.execute<GetWellStatusQuery, WellStatusDto>(
      new GetWellStatusQuery(tenantId),
    );
  }

  /**
   * Get recent activity
   * GET /dashboard/recent-activity
   *
   * Returns recent well events (field entries, anomalies, maintenance).
   * Limited to 10 most recent activities.
   */
  @Get('recent-activity')
  @ApiOperation({ summary: 'Get recent activity' })
  @ApiResponse({
    status: 200,
    description: 'Recent activity retrieved successfully',
    type: RecentActivityDto,
  })
  async getRecentActivity(
    @TenantId() tenantId: string,
  ): Promise<RecentActivityDto> {
    return this.queryBus.execute<GetRecentActivityQuery, RecentActivityDto>(
      new GetRecentActivityQuery(tenantId),
    );
  }

  /**
   * Get top producers
   * GET /dashboard/top-producers
   *
   * Returns top 5 producing wells based on average daily production.
   * Includes trend comparison with previous period.
   */
  @Get('top-producers')
  @ApiOperation({ summary: 'Get top producers' })
  @ApiResponse({
    status: 200,
    description: 'Top producers retrieved successfully',
    type: TopProducersDto,
  })
  async getTopProducers(
    @TenantId() tenantId: string,
  ): Promise<TopProducersDto> {
    return this.queryBus.execute<GetTopProducersQuery, TopProducersDto>(
      new GetTopProducersQuery(tenantId),
    );
  }
}
