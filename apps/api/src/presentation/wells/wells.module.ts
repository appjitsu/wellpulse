/**
 * Wells Module (EXAMPLE)
 *
 * Demonstrates how to set up a tenant-scoped module.
 */

import { Module } from '@nestjs/common';
import { WellsController } from './wells.controller';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [
    // Import TenantsModule to get access to TenantRepository
    // (needed by TenantResolverMiddleware)
    TenantsModule,
  ],
  controllers: [WellsController],
})
export class WellsModule {}
