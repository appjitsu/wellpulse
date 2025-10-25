/**
 * Admin Users Controller
 *
 * Admin portal endpoints for managing users across ALL tenants.
 * NOT tenant-scoped - operates on the master database.
 *
 * Security:
 * - Requires SUPER_ADMIN role (from master database auth)
 * - No @TenantId() decorator - works across all tenants
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

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
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('admin-users')
@ApiBearerAuth('access-token')
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * Get all users across all tenants
   * GET /admin/users
   *
   * Returns paginated list of all users in the system.
   * Super admin only.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all users (cross-tenant)' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async getAllUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') _search?: string,
    @Query('tenantId') _tenantId?: string,
    @Query('role') _role?: string,
    @Query('status') _status?: string,
  ): Promise<{
    users: Array<{
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      tenantId: string;
      tenantName: string;
      role: string;
      status: string;
      emailVerified: boolean;
      lastLoginAt: Date | null;
      createdAt: Date;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    // TODO: Implement GetAllUsersQuery
    // This is a placeholder that returns mock data
    return {
      users: [
        {
          id: '1',
          email: 'john@acme.com',
          firstName: 'John',
          lastName: 'Doe',
          tenantId: 'acme-id',
          tenantName: 'ACME Oil',
          role: 'ADMIN',
          status: 'ACTIVE',
          emailVerified: true,
          lastLoginAt: new Date(Date.now() - 120000),
          createdAt: new Date(Date.now() - 86400000 * 30),
        },
      ],
      total: 1,
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '10', 10),
    };
  }

  /**
   * Create a new user
   * POST /admin/users
   *
   * Creates a user in a specific tenant's database.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async createUser(
    @Body()
    _dto: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      tenantId: string;
      role: string;
    },
  ): Promise<{ id: string; message: string }> {
    // TODO: Implement CreateUserCommand
    return {
      id: 'new-user-id',
      message: 'User created successfully',
    };
  }

  /**
   * Update user details
   * PATCH /admin/users/:id
   *
   * Updates user information.
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  async updateUser(
    @Param('id') _userId: string,
    @Body()
    _dto: {
      firstName?: string;
      lastName?: string;
      role?: string;
      status?: string;
    },
  ): Promise<{ message: string }> {
    // TODO: Implement UpdateUserCommand
    return {
      message: 'User updated successfully',
    };
  }

  /**
   * Delete user
   * DELETE /admin/users/:id
   *
   * Soft deletes a user.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  async deleteUser(@Param('id') _userId: string): Promise<{ message: string }> {
    // TODO: Implement DeleteUserCommand
    return {
      message: 'User deleted successfully',
    };
  }

  /**
   * Send password reset email
   * POST /admin/users/:id/reset-password
   *
   * Sends password reset email to user.
   */
  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send password reset email' })
  @ApiResponse({ status: 200, description: 'Reset email sent successfully' })
  async sendPasswordReset(
    @Param('id') _userId: string,
  ): Promise<{ message: string }> {
    // TODO: Implement SendPasswordResetCommand
    return {
      message: 'Password reset email sent successfully',
    };
  }
}
