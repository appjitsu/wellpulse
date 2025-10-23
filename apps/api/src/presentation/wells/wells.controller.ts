/**
 * Wells Controller (EXAMPLE - Demonstrates Tenant Context Usage)
 *
 * This controller demonstrates how to use tenant-scoped routing:
 * - @UseGuards(TenantRequiredGuard) ensures tenant context exists
 * - @TenantContext() decorator extracts tenant info from request
 *
 * Example requests:
 * - http://acme.localhost:3001/wells (tenant: acme)
 * - http://demo.localhost:3001/wells (tenant: demo)
 * - http://localhost:3001/wells (throws ForbiddenException - no tenant)
 */

import { Controller, Get, UseGuards } from '@nestjs/common';
import { TenantRequiredGuard } from '../../infrastructure/guards/tenant-required.guard';
import {
  TenantContext,
  TenantContextDto,
} from '../../infrastructure/decorators/tenant-context.decorator';

@Controller('wells')
@UseGuards(TenantRequiredGuard)
export class WellsController {
  /**
   * Get all wells for the current tenant
   * GET /wells
   *
   * Example:
   * curl http://acme.localhost:3001/wells
   * -> Returns wells for ACME Oil & Gas tenant
   */
  @Get()
  getWells(@TenantContext() tenant: TenantContextDto | undefined) {
    // Guard ensures tenant is defined, but TypeScript doesn't know that
    if (!tenant) {
      throw new Error('Tenant context is required');
    }

    // In a real implementation, this would query the tenant's database
    // using the tenant.databaseUrl connection string
    return {
      message: `Fetching wells for tenant: ${tenant.subdomain}`,
      tenant: {
        id: tenant.id,
        subdomain: tenant.subdomain,
        slug: tenant.slug,
        databaseType: tenant.databaseType,
      },
      wells: [
        // Mock data - in reality this would come from tenant database
        { id: '1', name: 'Well 001', status: 'ACTIVE' },
        { id: '2', name: 'Well 002', status: 'ACTIVE' },
      ],
    };
  }

  /**
   * Get tenant info (demonstrates decorator usage)
   * GET /wells/tenant-info
   *
   * Example:
   * curl http://acme.localhost:3001/wells/tenant-info
   */
  @Get('tenant-info')
  getTenantInfo(@TenantContext() tenant: TenantContextDto | undefined) {
    return {
      tenant,
      message: 'This endpoint can access the current tenant context',
    };
  }
}
