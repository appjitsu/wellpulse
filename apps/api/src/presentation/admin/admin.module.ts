/**
 * Admin Module
 *
 * Provides admin portal endpoints for managing users and tenants.
 * These endpoints are NOT tenant-scoped and work across all tenants.
 *
 * Routes:
 * - POST   /admin/users - Create user
 * - GET    /admin/users - List all users (cross-tenant)
 * - PATCH  /admin/users/:id - Update user
 * - DELETE /admin/users/:id - Delete user
 * - POST   /admin/users/:id/reset-password - Send password reset
 *
 * - POST   /admin/tenants - Create tenant
 * - GET    /admin/tenants - List all tenants
 * - GET    /admin/tenants/:id - Get tenant details
 * - PATCH  /admin/tenants/:id - Update tenant
 * - DELETE /admin/tenants/:id - Delete tenant
 * - POST   /admin/tenants/:id/suspend - Suspend tenant
 * - POST   /admin/tenants/:id/activate - Activate tenant
 */

import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AdminUsersController } from './admin-users.controller';
import { AdminTenantsController } from './admin-tenants.controller';

@Module({
  imports: [CqrsModule],
  controllers: [AdminUsersController, AdminTenantsController],
})
export class AdminModule {}
