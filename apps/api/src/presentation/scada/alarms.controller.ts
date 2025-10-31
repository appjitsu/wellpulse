/**
 * Alarms Controller
 *
 * REST API endpoints for alarm management and monitoring.
 * Handles SCADA alarm conditions, acknowledgment, and monitoring.
 *
 * All endpoints require authentication and tenant context.
 *
 * Architecture:
 * - Uses CQRS pattern (CommandBus/QueryBus)
 * - Tenant-scoped data access
 * - Role-based access control (stricter for acknowledgment)
 * - Input validation via DTOs
 * - Proper error handling with HTTP status codes
 */

import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { TenantId } from '../decorators/tenant-id.decorator';
import {
  AcknowledgeAlarmCommand,
  GetActiveAlarmsQuery,
} from '../../application/scada';
import { AlarmDto } from '../../application/scada/dto';
import { GetActiveAlarmsQueryDto } from './dto';

@ApiTags('alarms')
@ApiBearerAuth('access-token')
@Controller('alarms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlarmsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * Get active alarms
   * GET /alarms
   *
   * Retrieves all active and acknowledged alarms (excludes cleared alarms).
   * Supports filtering by well and severity level.
   *
   * All authenticated users can view alarms to monitor system health.
   */
  @Get()
  @ApiOperation({
    summary: 'Get active alarms',
    description:
      'Retrieves active and acknowledged alarms with optional filters',
  })
  @ApiResponse({
    status: 200,
    description: 'Alarms retrieved successfully',
    type: [AlarmDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
  })
  async getActiveAlarms(
    @TenantId() tenantId: string,
    @Query() queryDto: GetActiveAlarmsQueryDto,
  ): Promise<AlarmDto[]> {
    // Validate tenant context
    if (!tenantId) {
      throw new BadRequestException('Tenant context is required');
    }

    // Execute query to fetch active alarms
    const query = new GetActiveAlarmsQuery(
      tenantId,
      queryDto.wellId,
      queryDto.severity,
    );

    return this.queryBus.execute(query);
  }

  /**
   * Acknowledge alarm
   * PATCH /alarms/:alarmId/acknowledge
   *
   * Acknowledges an active alarm to indicate operator awareness.
   * Only Admin and Manager roles can acknowledge alarms.
   *
   * Business Rules:
   * - Alarm must be in ACTIVE state
   * - Cannot acknowledge already acknowledged alarms
   * - Cannot acknowledge cleared alarms
   * - Records who acknowledged the alarm and when
   * - Critical alarms must be acknowledged before they can be cleared
   */
  @Patch(':alarmId/acknowledge')
  @Roles('ADMIN', 'MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Acknowledge alarm',
    description: 'Acknowledges an active alarm to indicate operator awareness',
  })
  @ApiParam({
    name: 'alarmId',
    description: 'Alarm ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Alarm acknowledged successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Alarm acknowledged successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Cannot acknowledge alarm (already acknowledged or invalid state)',
  })
  @ApiResponse({
    status: 404,
    description: 'Alarm not found',
  })
  async acknowledgeAlarm(
    @TenantId() tenantId: string,
    @Param('alarmId') alarmId: string,
    @CurrentUser('userId') userId: string,
  ): Promise<{ message: string }> {
    // Validate tenant context
    if (!tenantId) {
      throw new BadRequestException('Tenant context is required');
    }

    // Validate alarm ID
    if (!alarmId || alarmId.trim() === '') {
      throw new BadRequestException('Alarm ID is required');
    }

    // Validate user ID (from JWT token)
    if (!userId) {
      throw new BadRequestException('User authentication is required');
    }

    // Execute command to acknowledge alarm
    try {
      const command = new AcknowledgeAlarmCommand(tenantId, alarmId, userId);
      await this.commandBus.execute(command);

      return {
        message: 'Alarm acknowledged successfully',
      };
    } catch (error) {
      // Re-throw known exceptions (NotFoundException, BadRequestException)
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Handle unexpected errors
      throw new BadRequestException(
        (error as Error).message || 'Failed to acknowledge alarm',
      );
    }
  }
}
