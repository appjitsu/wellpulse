/**
 * Tenant Required Guard
 *
 * Ensures a valid tenant context exists on the request.
 * Use on routes that require tenant context (e.g., /api/wells, /api/production).
 *
 * Usage:
 * @UseGuards(TenantRequiredGuard)
 * @Get('wells')
 * async getWells(@TenantContext() tenant: TenantContextDto) {
 *   // tenant is guaranteed to exist
 * }
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContextDto } from '../decorators/tenant-context.decorator';

@Injectable()
export class TenantRequiredGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ tenant?: TenantContextDto }>();

    if (!request.tenant) {
      throw new ForbiddenException(
        'This endpoint requires a valid tenant subdomain (e.g., acme.wellpulse.app)',
      );
    }

    return true;
  }
}
