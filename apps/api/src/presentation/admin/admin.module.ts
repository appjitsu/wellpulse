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
import { GetAllUsersHandler } from '../../application/admin/queries/get-all-users/get-all-users.handler';
import { UserRepository } from '../../infrastructure/database/repositories/user.repository';
import { TenantRepository } from '../../infrastructure/database/repositories/tenant.repository';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { TenantsModule } from '../tenants/tenants.module';

const QueryHandlers = [GetAllUsersHandler];

@Module({
  imports: [CqrsModule, DatabaseModule, TenantsModule],
  controllers: [AdminUsersController, AdminTenantsController],
  providers: [
    ...QueryHandlers,
    {
      provide: 'IUserRepository',
      useClass: UserRepository,
    },
    {
      provide: 'ITenantRepository',
      useClass: TenantRepository,
    },
  ],
})
export class AdminModule {}
