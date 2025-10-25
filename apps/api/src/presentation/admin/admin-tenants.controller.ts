/**
 * Admin Tenants Controller
 *
 * Admin portal endpoints for managing ALL tenants.
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

@ApiTags('admin-tenants')
@ApiBearerAuth('access-token')
@Controller('admin/tenants')
export class AdminTenantsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * Get all tenants
   * GET /admin/tenants
   *
   * Returns paginated list of all tenants.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all tenants' })
  @ApiResponse({ status: 200, description: 'Tenants retrieved successfully' })
  async getAllTenants(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ): Promise<{
    tenants: Array<{
      id: string;
      name: string;
      slug: string;
      subdomain: string;
      status: string;
      subscriptionTier: string;
      contactEmail: string;
      userCount: number;
      createdAt: Date;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    // TODO: Implement GetAllTenantsQuery
    // This is a placeholder that returns mock data
    return {
      tenants: [
        {
          id: '1',
          name: 'ACME Oil & Gas',
          slug: 'acme-oil-gas',
          subdomain: 'acme',
          status: 'ACTIVE',
          subscriptionTier: 'ENTERPRISE',
          contactEmail: 'admin@acme.com',
          userCount: 15,
          createdAt: new Date(Date.now() - 86400000 * 90),
        },
        {
          id: '2',
          name: 'Demo Corporation',
          slug: 'demo-corp',
          subdomain: 'demo',
          status: 'TRIAL',
          subscriptionTier: 'STARTER',
          contactEmail: 'admin@demo.com',
          userCount: 5,
          createdAt: new Date(Date.now() - 86400000 * 7),
        },
      ],
      total: 2,
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '10', 10),
    };
  }

  /**
   * Get tenant by ID
   * GET /admin/tenants/:id
   *
   * Returns detailed tenant information.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get tenant by ID' })
  @ApiResponse({ status: 200, description: 'Tenant retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async getTenant(@Param('id') tenantId: string): Promise<{
    id: string;
    name: string;
    slug: string;
    subdomain: string;
    status: string;
    subscriptionTier: string;
    contactEmail: string;
    contactPhone?: string;
    billingEmail?: string;
    maxWells?: number;
    maxUsers?: number;
    storageQuotaGb?: number;
    databaseConfig: {
      type: string;
      name: string;
      host?: string;
    };
    createdAt: Date;
    updatedAt: Date;
  }> {
    // TODO: Implement GetTenantByIdQuery
    return {
      id: tenantId,
      name: 'ACME Oil & Gas',
      slug: 'acme-oil-gas',
      subdomain: 'acme',
      status: 'ACTIVE',
      subscriptionTier: 'ENTERPRISE',
      contactEmail: 'admin@acme.com',
      contactPhone: '+1-555-0123',
      billingEmail: 'billing@acme.com',
      maxWells: 500,
      maxUsers: 50,
      storageQuotaGb: 100,
      databaseConfig: {
        type: 'postgresql',
        name: 'acme_wellpulse',
        host: 'localhost',
      },
      createdAt: new Date(Date.now() - 86400000 * 90),
      updatedAt: new Date(),
    };
  }

  /**
   * Create a new tenant
   * POST /admin/tenants
   *
   * Creates a new tenant with database provisioning.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create tenant' })
  @ApiResponse({ status: 201, description: 'Tenant created successfully' })
  async createTenant(
    @Body()
    dto: {
      name: string;
      slug: string;
      subdomain: string;
      contactEmail: string;
      subscriptionTier: string;
      databaseType?: string;
      contactPhone?: string;
      billingEmail?: string;
      maxWells?: number;
      maxUsers?: number;
      storageQuotaGb?: number;
      trialDays?: number;
    },
  ): Promise<{ id: string; message: string }> {
    // TODO: Implement CreateTenantCommand (already exists, need to wire up)
    return {
      id: 'new-tenant-id',
      message: 'Tenant created successfully',
    };
  }

  /**
   * Update tenant details
   * PATCH /admin/tenants/:id
   *
   * Updates tenant information.
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update tenant' })
  @ApiResponse({ status: 200, description: 'Tenant updated successfully' })
  async updateTenant(
    @Param('id') tenantId: string,
    @Body()
    dto: {
      name?: string;
      contactEmail?: string;
      contactPhone?: string;
      billingEmail?: string;
      status?: string;
      subscriptionTier?: string;
      maxWells?: number;
      maxUsers?: number;
      storageQuotaGb?: number;
    },
  ): Promise<{ message: string }> {
    // TODO: Implement UpdateTenantCommand
    return {
      message: 'Tenant updated successfully',
    };
  }

  /**
   * Delete tenant
   * DELETE /admin/tenants/:id
   *
   * Soft deletes a tenant and marks database for archival.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete tenant' })
  @ApiResponse({ status: 200, description: 'Tenant deleted successfully' })
  async deleteTenant(
    @Param('id') tenantId: string,
  ): Promise<{ message: string }> {
    // TODO: Implement DeleteTenantCommand
    return {
      message: 'Tenant deleted successfully. Database marked for archival.',
    };
  }

  /**
   * Suspend tenant
   * POST /admin/tenants/:id/suspend
   *
   * Suspends tenant access (billing issues, violation, etc.)
   */
  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend tenant' })
  @ApiResponse({ status: 200, description: 'Tenant suspended successfully' })
  async suspendTenant(
    @Param('id') tenantId: string,
    @Body() dto: { reason?: string },
  ): Promise<{ message: string }> {
    // TODO: Implement SuspendTenantCommand
    return {
      message: 'Tenant suspended successfully',
    };
  }

  /**
   * Activate tenant
   * POST /admin/tenants/:id/activate
   *
   * Reactivates a suspended tenant.
   */
  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate tenant' })
  @ApiResponse({ status: 200, description: 'Tenant activated successfully' })
  async activateTenant(
    @Param('id') tenantId: string,
  ): Promise<{ message: string }> {
    // TODO: Implement ActivateTenantCommand
    return {
      message: 'Tenant activated successfully',
    };
  }
}
