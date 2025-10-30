/**
 * Tenant Resolver Middleware
 *
 * Resolves tenant from either subdomain (web) or X-Tenant-ID header (mobile/desktop).
 * Runs on every request to tenant-facing endpoints.
 *
 * Flow (Web Apps - Subdomain):
 * 1. Extract subdomain from hostname (acme.wellpulse.app → "acme")
 * 2. Look up tenant in master database by subdomain
 * 3. Attach tenant context to request object
 * 4. Return 404 if tenant not found or inactive
 *
 * Flow (Mobile/Desktop - Headers):
 * 1. Extract X-Tenant-ID header (e.g., DEMO-A5L32W)
 * 2. Extract X-Tenant-Secret header (server-issued credential)
 * 3. Look up tenant by tenantId
 * 4. Validate secret using constant-time comparison
 * 5. Attach tenant context to request object
 * 6. Return 401 if secret invalid, 404 if tenant not found
 *
 * Subdomain Patterns:
 * - acme.wellpulse.app → subdomain: "acme"
 * - acme.localhost:3001 → subdomain: "acme" (local dev)
 * - localhost:3001 → no subdomain (admin portal)
 *
 * Header Patterns (Mobile/Desktop):
 * - X-Tenant-ID: DEMO-A5L32W
 * - X-Tenant-Secret: base64-encoded-secret
 */

import {
  Inject,
  Injectable,
  NestMiddleware,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ITenantRepository } from '../../domain/repositories/tenant.repository.interface';
import { TenantContextDto } from '../decorators/tenant-context.decorator';

@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  constructor(
    @Inject('ITenantRepository')
    private readonly tenantRepository: ITenantRepository,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Check for mobile/desktop authentication first (X-Tenant-ID header)
    const tenantIdHeader = req.headers['x-tenant-id'];
    const tenantSecretHeader = req.headers['x-tenant-secret'];

    if (tenantIdHeader) {
      // Mobile/Desktop authentication mode
      return this.resolveTenantById(
        req,
        next,
        typeof tenantIdHeader === 'string' ? tenantIdHeader : null,
        typeof tenantSecretHeader === 'string' ? tenantSecretHeader : null,
      );
    }

    // Web app authentication mode (subdomain routing)
    // Try to extract subdomain from hostname first
    let subdomain = this.extractSubdomain(req.hostname);

    // If no subdomain in hostname, check X-Tenant-Subdomain header
    // (used by admin portal and API clients without subdomain routing)
    if (!subdomain) {
      const headerValue = req.headers['x-tenant-subdomain'];
      subdomain = typeof headerValue === 'string' ? headerValue : null;
    }

    // Skip tenant resolution if no subdomain found
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
      databaseName: tenant.databaseConfig.name,
      databaseType: tenant.databaseConfig.type,
    };

    req.tenant = tenantContext;

    next();
  }

  /**
   * Resolve tenant for mobile/desktop apps using X-Tenant-ID + X-Tenant-Secret headers
   * Triple-credential authentication: tenantId + secret + user JWT
   *
   * Note: X-Tenant-Secret is NOT required for login/register endpoints
   * (secret is returned by login and stored for future requests)
   */
  private async resolveTenantById(
    req: Request,
    next: NextFunction,
    tenantId: string | null,
    tenantSecret: string | null,
  ) {
    console.log('[TenantResolver] Mobile/Desktop request:', {
      path: req.path,
      url: req.url,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl,
      method: req.method,
      hasTenantId: !!tenantId,
      hasTenantSecret: !!tenantSecret,
    });

    if (!tenantId) {
      throw new UnauthorizedException('X-Tenant-ID header is required');
    }

    // Check if this is a login or register request (secret not yet available)
    // Use originalUrl since it contains the full path with prefix
    const fullPath = req.originalUrl || req.url || req.path;
    const isAuthEndpoint =
      fullPath.includes('/auth/login') ||
      fullPath.includes('/auth/register') ||
      fullPath === '/api/auth/login' ||
      fullPath === '/api/auth/register';
    console.log(
      '[TenantResolver] fullPath:',
      fullPath,
      'isAuthEndpoint:',
      isAuthEndpoint,
    );

    // Require X-Tenant-Secret for all requests EXCEPT login/register
    if (!isAuthEndpoint && !tenantSecret) {
      throw new UnauthorizedException('X-Tenant-Secret header is required');
    }

    // Look up tenant by tenant ID
    const tenant = await this.tenantRepository.findByTenantId(tenantId);

    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }

    // Validate secret key using constant-time comparison (skip for auth endpoints)
    if (!isAuthEndpoint) {
      if (!tenantSecret) {
        throw new UnauthorizedException('X-Tenant-Secret header is required');
      }

      const isSecretValid = tenant.validateSecretKey(tenantSecret);

      if (!isSecretValid) {
        throw new UnauthorizedException('Invalid tenant secret');
      }
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
      databaseName: tenant.databaseConfig.name,
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
