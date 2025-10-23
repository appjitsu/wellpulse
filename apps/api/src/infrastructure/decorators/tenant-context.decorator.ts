/**
 * Tenant Context Decorator
 *
 * Extracts tenant information from the request context.
 * Used in controllers to access the current tenant.
 *
 * Usage:
 * @Get()
 * async getData(@TenantContext() tenant: TenantContextDto) {
 *   // tenant.id, tenant.subdomain, tenant.databaseUrl available
 * }
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface TenantContextDto {
  id: string;
  subdomain: string;
  slug: string;
  databaseUrl: string;
  databaseType: string;
}

export const TenantContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): TenantContextDto | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ tenant?: TenantContextDto }>();
    return request.tenant;
  },
);
