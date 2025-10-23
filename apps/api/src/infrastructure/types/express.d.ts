/**
 * Express Request Type Extensions
 *
 * Extends Express Request interface to include custom properties
 * added by middleware.
 */

import { TenantContextDto } from '../decorators/tenant-context.decorator';

declare module 'express' {
  interface Request {
    tenant?: TenantContextDto;
  }
}
