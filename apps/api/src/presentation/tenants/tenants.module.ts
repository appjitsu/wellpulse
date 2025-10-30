/**
 * Tenants Module
 *
 * Wires together tenant controller, handlers, and repository.
 */

import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TenantsController } from './tenants.controller';
import { CreateTenantHandler } from '../../application/tenants/commands/create-tenant/create-tenant.handler';
import { GetTenantHandler } from '../../application/tenants/queries/get-tenant/get-tenant.handler';
import { TenantRepository } from '../../infrastructure/database/repositories/tenant.repository';
import { TenantProvisioningService } from '../../infrastructure/services/tenant-provisioning.service';
import { SlackNotificationService } from '../../infrastructure/services/slack-notification.service';

@Module({
  imports: [CqrsModule],
  controllers: [TenantsController],
  providers: [
    CreateTenantHandler,
    GetTenantHandler,
    TenantRepository,
    TenantProvisioningService,
    SlackNotificationService,
    {
      provide: 'ITenantRepository',
      useExisting: TenantRepository,
    },
  ],
  exports: [
    TenantRepository,
    'ITenantRepository',
    TenantProvisioningService,
    SlackNotificationService,
    CreateTenantHandler,
  ],
})
export class TenantsModule {}
