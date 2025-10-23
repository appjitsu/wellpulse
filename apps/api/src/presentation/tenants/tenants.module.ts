/**
 * Tenants Module
 *
 * Wires together tenant controller, handlers, and repository.
 */

import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { CreateTenantHandler } from '../../application/tenants/commands/create-tenant/create-tenant.handler';
import { GetTenantHandler } from '../../application/tenants/queries/get-tenant/get-tenant.handler';
import { TenantRepository } from '../../infrastructure/database/repositories/tenant.repository';
import { TenantProvisioningService } from '../../infrastructure/services/tenant-provisioning.service';

@Module({
  controllers: [TenantsController],
  providers: [
    CreateTenantHandler,
    GetTenantHandler,
    TenantRepository,
    TenantProvisioningService,
    {
      provide: 'ITenantRepository',
      useExisting: TenantRepository,
    },
  ],
  exports: [TenantRepository, 'ITenantRepository'],
})
export class TenantsModule {}
