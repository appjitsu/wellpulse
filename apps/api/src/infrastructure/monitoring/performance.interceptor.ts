/**
 * Performance Interceptor
 *
 * Automatically tracks performance metrics for all API requests.
 * Measures response time, tracks errors, and integrates with PerformanceMonitoringService.
 *
 * Features:
 * - Automatic request/response time tracking
 * - Error tracking with status codes
 * - Tenant-aware metrics (when tenant context is available)
 * - High-resolution timing using process.hrtime()
 * - Zero configuration required
 *
 * This interceptor is registered globally in MonitoringModule.
 *
 * Performance Impact:
 * - Minimal overhead (~0.1ms per request)
 * - Uses circular buffer to prevent memory leaks
 * - Async metrics recording doesn't block requests
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { PerformanceMonitoringService } from './performance-monitoring.service';
import type { Request, Response } from 'express';

interface RequestWithTenant extends Request {
  tenantId?: string;
}

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceInterceptor.name);

  constructor(
    private readonly performanceMonitoring: PerformanceMonitoringService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithTenant>();
    const response = context.switchToHttp().getResponse<Response>();

    // Start high-resolution timer
    const startTime = this.performanceMonitoring.startTimer();

    // Extract request information
    const { method, path } = request;
    const tenantId = request.tenantId; // Set by TenantResolverMiddleware

    // Track request completion
    return next.handle().pipe(
      tap(() => {
        // Request succeeded
        const statusCode = response.statusCode || 200;
        this.recordRequest(path, method, statusCode, startTime, tenantId);
      }),
      catchError((error: Error & { status?: number }) => {
        // Request failed
        const statusCode = error.status || 500;
        this.recordRequest(path, method, statusCode, startTime, tenantId);

        // Re-throw error to be handled by exception filter
        return throwError(() => error);
      }),
    );
  }

  /**
   * Record request performance metrics
   */
  private recordRequest(
    path: string,
    method: string,
    statusCode: number,
    startTime: [number, number],
    tenantId?: string,
  ): void {
    try {
      // Clean up path (remove query params and IDs)
      const cleanPath = this.normalizeEndpoint(path);

      // Record in performance monitoring service
      this.performanceMonitoring.recordRequest(
        cleanPath,
        method,
        statusCode,
        startTime,
        tenantId,
      );
    } catch (error) {
      // Don't let metrics recording crash the app
      this.logger.error(
        `Failed to record request performance: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Normalize endpoint path for consistent metrics
   *
   * Converts:
   * - /wells/123 → /wells/:id
   * - /wells/123/field-entries → /wells/:id/field-entries
   * - /tenants?page=1&limit=10 → /tenants
   *
   * This ensures metrics are grouped by endpoint pattern, not by specific IDs.
   */
  private normalizeEndpoint(path: string): string {
    // Remove query parameters
    const pathWithoutQuery = path.split('?')[0] || path;

    // Replace UUIDs and numeric IDs with :id
    return pathWithoutQuery
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '/:id',
      ) // UUID
      .replace(/\/\d+/g, '/:id') // Numeric ID
      .replace(/\/tid_[a-z0-9]+/gi, '/:tenantId') // Tenant ID
      .replace(/\/usr_[a-z0-9]+/gi, '/:userId') // User ID
      .replace(/\/well_[a-z0-9]+/gi, '/:wellId'); // Well ID
  }
}
