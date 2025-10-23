/**
 * Tenants Controller
 *
 * REST API endpoints for tenant management (Admin Portal only).
 * Requires admin authentication.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CreateTenantHandler } from '../../application/tenants/commands/create-tenant/create-tenant.handler';
import { CreateTenantCommand } from '../../application/tenants/commands/create-tenant/create-tenant.command';
import { GetTenantHandler } from '../../application/tenants/queries/get-tenant/get-tenant.handler';
import { GetTenantQuery } from '../../application/tenants/queries/get-tenant/get-tenant.query';
import { CreateTenantRequestDto } from './dtos/create-tenant-request.dto';
import { TenantResponseDto } from './dtos/tenant-response.dto';

@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly createTenantHandler: CreateTenantHandler,
    private readonly getTenantHandler: GetTenantHandler,
  ) {}

  /**
   * Create a new tenant
   * POST /tenants
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateTenantRequestDto,
  ): Promise<TenantResponseDto> {
    const command = new CreateTenantCommand(
      dto.slug,
      dto.subdomain,
      dto.name,
      dto.contactEmail,
      dto.subscriptionTier,
      dto.databaseType,
      dto.contactPhone,
      dto.billingEmail,
      dto.maxWells,
      dto.maxUsers,
      dto.storageQuotaGb,
      dto.trialDays,
      // TODO: Get admin user ID from auth context
      undefined,
    );

    const tenant = await this.createTenantHandler.execute(command);
    return TenantResponseDto.fromDomain(tenant);
  }

  /**
   * Get tenant by ID
   * GET /tenants/:id
   */
  @Get(':id')
  async getById(@Param('id') id: string): Promise<TenantResponseDto> {
    const query = new GetTenantQuery(id);
    const tenant = await this.getTenantHandler.execute(query);
    return TenantResponseDto.fromDomain(tenant);
  }

  /**
   * Get tenant by slug or subdomain
   * GET /tenants?slug=acme-oil-gas
   * GET /tenants?subdomain=acme
   */
  @Get()
  async getByIdentifier(
    @Query('slug') slug?: string,
    @Query('subdomain') subdomain?: string,
  ): Promise<TenantResponseDto> {
    const query = new GetTenantQuery(undefined, slug, subdomain);
    const tenant = await this.getTenantHandler.execute(query);
    return TenantResponseDto.fromDomain(tenant);
  }
}
