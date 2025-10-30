/**
 * Alerts Controller
 *
 * REST API endpoints for managing alerts triggered by nominal range violations.
 * Provides alert history, statistics, and acknowledgment functionality.
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
import { AlertHistoryQueryDto } from './dto/alert-history-query.dto';
import {
  AlertHistoryResponseDto,
  AlertStatsResponseDto,
  RecentAlertsResponseDto,
  AcknowledgeAlertSuccessDto,
} from './dto/alert.response.dto';
import { AcknowledgeAlertCommand } from '../../application/alerts/commands/acknowledge-alert.command';
import { GetAlertHistoryQuery } from '../../application/alerts/queries/get-alert-history.query';
import { GetAlertStatsQuery } from '../../application/alerts/queries/get-alert-stats.query';
import { GetRecentAlertsQuery } from '../../application/alerts/queries/get-recent-alerts.query';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for acknowledging an alert
 */
class AcknowledgeAlertDto {
  @ApiProperty({
    description: 'Notes about why the alert is being acknowledged',
    example: 'Well has been shut in for scheduled maintenance',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

@ApiTags('alerts')
@ApiBearerAuth('access-token')
@Controller('alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * Get alert history with filtering and pagination
   * GET /alerts/history
   *
   * Returns paginated list of alerts with optional filters for well, field,
   * severity, date range, and acknowledgment status.
   * All authenticated users can view alert history.
   */
  @Get('history')
  @ApiOperation({
    summary: 'Get alert history',
    description:
      'Retrieve paginated alert history with optional filters (well, field, severity, date range)',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert history retrieved successfully',
    type: AlertHistoryResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  async getAlertHistory(
    @TenantId() tenantId: string,
    @Query() query: AlertHistoryQueryDto,
  ): Promise<AlertHistoryResponseDto> {
    // Validate date range if both provided
    if (query.startDate && query.endDate) {
      const start = new Date(query.startDate);
      const end = new Date(query.endDate);
      if (start > end) {
        throw new BadRequestException('startDate must be before endDate');
      }
    }

    return this.queryBus.execute<GetAlertHistoryQuery, AlertHistoryResponseDto>(
      new GetAlertHistoryQuery(tenantId, {
        wellId: query.wellId,
        severity: query.severity,
        acknowledged: query.isAcknowledged,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
      }),
    );
  }

  /**
   * Get alert statistics
   * GET /alerts/stats
   *
   * Returns comprehensive statistics about alerts including:
   * - Total active alert count
   * - Breakdown by severity level
   * - Breakdown by field name
   * - Top wells with most alerts
   * - 7-day trend
   *
   * All authenticated users can view alert statistics.
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Get alert statistics',
    description:
      'Retrieve comprehensive statistics about alerts (counts, trends, top wells)',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert statistics retrieved successfully',
    type: AlertStatsResponseDto,
  })
  async getAlertStats(
    @TenantId() tenantId: string,
  ): Promise<AlertStatsResponseDto> {
    return this.queryBus.execute<GetAlertStatsQuery, AlertStatsResponseDto>(
      new GetAlertStatsQuery(tenantId),
    );
  }

  /**
   * Get recent unacknowledged alerts
   * GET /alerts/recent
   *
   * Returns the most recent unacknowledged alerts (last 10).
   * Used for dashboard notifications and real-time monitoring.
   * All authenticated users can view recent alerts.
   */
  @Get('recent')
  @ApiOperation({
    summary: 'Get recent unacknowledged alerts',
    description:
      'Retrieve the 10 most recent unacknowledged alerts for dashboard display',
  })
  @ApiResponse({
    status: 200,
    description: 'Recent alerts retrieved successfully',
    type: RecentAlertsResponseDto,
  })
  async getRecentAlerts(
    @TenantId() tenantId: string,
  ): Promise<RecentAlertsResponseDto> {
    return this.queryBus.execute<GetRecentAlertsQuery, RecentAlertsResponseDto>(
      new GetRecentAlertsQuery(tenantId),
    );
  }

  /**
   * Acknowledge an alert
   * POST /alerts/:alertId/acknowledge
   *
   * Marks an alert as acknowledged by the current user.
   * Acknowledged alerts are moved out of the active queue.
   * Only Admin, Manager, and Operator roles can acknowledge alerts.
   */
  @Post(':alertId/acknowledge')
  @Roles('ADMIN', 'MANAGER', 'OPERATOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Acknowledge an alert',
    description: 'Mark an alert as acknowledged with optional notes',
  })
  @ApiParam({
    name: 'alertId',
    description: 'Alert ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert acknowledged successfully',
    type: AcknowledgeAlertSuccessDto,
  })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  @ApiResponse({ status: 400, description: 'Alert already acknowledged' })
  async acknowledgeAlert(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('alertId') alertId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Body() _dto: AcknowledgeAlertDto,
  ): Promise<AcknowledgeAlertSuccessDto> {
    await this.commandBus.execute<AcknowledgeAlertCommand, void>(
      new AcknowledgeAlertCommand(tenantId, alertId, userId),
    );

    return {
      message: 'Alert acknowledged successfully',
      alertId,
      acknowledgedAt: new Date().toISOString(),
    };
  }
}
