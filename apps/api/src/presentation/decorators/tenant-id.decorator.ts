/**
 * Tenant ID Decorator
 *
 * Extracts tenant ID from the request context.
 * Used in controllers to access just the tenant ID.
 *
 * Usage:
 * @Post()
 * async create(@TenantId() tenantId: string, @Body() dto: CreateDto) {
 *   // tenantId available directly as string
 * }
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantContextDto } from '../../infrastructure/decorators/tenant-context.decorator';

export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ tenant?: TenantContextDto }>();
    return request.tenant?.id;
  },
);
