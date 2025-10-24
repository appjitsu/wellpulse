/**
 * Users Controller
 *
 * REST API endpoints for user management.
 * All endpoints require authentication and ADMIN role.
 */

import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
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
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { TenantId } from '../decorators/tenant-id.decorator';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { GetUsersQuery } from '../../application/users/queries/get-users.query';
import { UpdateUserRoleCommand } from '../../application/users/commands/update-user-role.command';
import { SuspendUserCommand } from '../../application/users/commands/suspend-user.command';
import { ActivateUserCommand } from '../../application/users/commands/activate-user.command';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * Get all users
   * GET /users
   *
   * Returns paginated list of users for the tenant.
   * Admin-only.
   */
  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get all users for tenant' })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: ['ADMIN', 'MANAGER', 'OPERATOR'],
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ACTIVE', 'PENDING', 'SUSPENDED'],
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async getUsers(
    @TenantId() tenantId: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{
    users: Array<{
      id: string;
      email: string;
      name: string;
      role: string;
      status: string;
      emailVerified: boolean;
      lastLoginAt: Date | null;
      createdAt: Date;
    }>;
    total: number;
  }> {
    const query = new GetUsersQuery(tenantId, {
      role,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    return this.queryBus.execute(query);
  }

  /**
   * Update user role
   * PATCH /users/:id/role
   *
   * Changes a user's role.
   * Admin-only.
   */
  @Patch(':id/role')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user role' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot demote last admin' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUserRole(
    @TenantId() tenantId: string,
    @Param('id') userId: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() currentUser: { userId: string },
  ): Promise<{ message: string }> {
    const command = new UpdateUserRoleCommand(
      tenantId,
      userId,
      dto.role,
      currentUser.userId,
    );

    await this.commandBus.execute(command);

    return {
      message: `User role updated to ${dto.role}`,
    };
  }

  /**
   * Suspend user
   * PATCH /users/:id/suspend
   *
   * Suspends a user account.
   * Admin-only.
   */
  @Patch(':id/suspend')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend user account' })
  @ApiResponse({ status: 200, description: 'User suspended successfully' })
  @ApiResponse({ status: 400, description: 'Cannot suspend last admin' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async suspendUser(
    @TenantId() tenantId: string,
    @Param('id') userId: string,
    @CurrentUser() currentUser: { userId: string },
  ): Promise<{ message: string }> {
    const command = new SuspendUserCommand(
      tenantId,
      userId,
      currentUser.userId,
    );

    await this.commandBus.execute(command);

    return {
      message: 'User suspended successfully',
    };
  }

  /**
   * Activate user
   * PATCH /users/:id/activate
   *
   * Activates a suspended user account.
   * Admin-only.
   */
  @Patch(':id/activate')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate user account' })
  @ApiResponse({ status: 200, description: 'User activated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async activateUser(
    @TenantId() tenantId: string,
    @Param('id') userId: string,
    @CurrentUser() currentUser: { userId: string },
  ): Promise<{ message: string }> {
    const command = new ActivateUserCommand(
      tenantId,
      userId,
      currentUser.userId,
    );

    await this.commandBus.execute(command);

    return {
      message: 'User activated successfully',
    };
  }
}
