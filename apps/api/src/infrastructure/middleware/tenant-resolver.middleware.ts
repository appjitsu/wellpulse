/**
 * Tenant Resolver Middleware
 *
 * Extracts subdomain from request hostname and loads tenant context.
 * Runs on every request to tenant-facing endpoints.
 *
 * Flow:
 * 1. Extract subdomain from hostname (acme.wellpulse.app → "acme")
 * 2. Look up tenant in master database by subdomain
 * 3. Attach tenant context to request object
 * 4. Return 404 if tenant not found or inactive
 *
 * Subdomain Patterns:
 * - acme.wellpulse.app → subdomain: "acme"
 * - acme.localhost:3001 → subdomain: "acme" (local dev)
 * - localhost:3001 → no subdomain (admin portal)
 */

import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ITenantRepository } from '../../domain/repositories/tenant.repository.interface';
import { TenantContextDto } from '../decorators/tenant-context.decorator';

@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  constructor(private readonly tenantRepository: ITenantRepository) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const subdomain = this.extractSubdomain(req.hostname);

    // Skip tenant resolution for admin portal (no subdomain)
    if (!subdomain) {
      return next();
    }

    // Look up tenant by subdomain
    const tenant = await this.tenantRepository.findBySubdomain(subdomain);

    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${subdomain}`);
    }

    // Check if tenant can access the platform
    if (!tenant.status.canAccess()) {
      throw new NotFoundException(
        `Tenant is ${tenant.status.toString().toLowerCase()} and cannot access the platform`,
      );
    }

    // Attach tenant context to request
    const tenantContext: TenantContextDto = {
      id: tenant.id,
      subdomain: tenant.subdomain,
      slug: tenant.slug,
      databaseUrl: tenant.databaseConfig.url,
      databaseType: tenant.databaseConfig.type,
    };

    req.tenant = tenantContext;

    next();
  }

  /**
   * Extract subdomain from hostname
   *
   * Examples:
   * - acme.wellpulse.app → "acme"
   * - acme.localhost → "acme"
   * - localhost → null
   * - wellpulse.app → null
   */
  private extractSubdomain(hostname: string): string | null {
    // Remove port if present
    const host = hostname.split(':')[0];

    // Split by dots
    const parts = host.split('.');

    // No subdomain if:
    // - Single part (localhost)
    // - Two parts and second is "localhost" (app.localhost)
    // - Two parts and it's the base domain (wellpulse.app)
    if (parts.length === 1) {
      return null; // localhost
    }

    if (parts.length === 2) {
      // Check if it's localhost or base domain
      if (parts[1] === 'localhost' || host === 'wellpulse.app') {
        return null;
      }
      // Otherwise first part is subdomain (acme.localhost)
      return parts[0];
    }

    // Three or more parts: first part is subdomain
    // acme.wellpulse.app → "acme"
    // acme.staging.wellpulse.app → "acme"
    return parts[0];
  }
}
