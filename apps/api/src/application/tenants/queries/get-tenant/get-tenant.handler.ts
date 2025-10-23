/**
 * Get Tenant Query Handler
 *
 * Retrieves a single tenant by ID, slug, or subdomain.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { GetTenantQuery } from './get-tenant.query';
import { ITenantRepository } from '../../../../domain/repositories/tenant.repository.interface';
import { Tenant } from '../../../../domain/tenants/tenant.entity';

@Injectable()
export class GetTenantHandler {
  constructor(private readonly tenantRepository: ITenantRepository) {}

  async execute(query: GetTenantQuery): Promise<Tenant> {
    let tenant: Tenant | null = null;

    if (query.id) {
      tenant = await this.tenantRepository.findById(query.id);
    } else if (query.slug) {
      tenant = await this.tenantRepository.findBySlug(query.slug);
    } else if (query.subdomain) {
      tenant = await this.tenantRepository.findBySubdomain(query.subdomain);
    }

    if (!tenant) {
      const identifier = query.id || query.slug || query.subdomain;
      throw new NotFoundException(`Tenant not found: ${identifier}`);
    }

    return tenant;
  }
}
