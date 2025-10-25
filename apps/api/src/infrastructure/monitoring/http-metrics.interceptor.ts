/**
 * HTTP Metrics Interceptor
 *
 * Captures Prometheus metrics for all HTTP requests:
 * - Request count (http_requests_total)
 * - Request duration (http_request_duration_seconds)
 * - Tracks method, route, status code labels
 *
 * Registered globally in AppModule via APP_INTERCEPTOR.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpMetricsInterceptor.name);

  constructor(
    @InjectMetric('http_requests_total')
    private readonly httpRequestsCounter: Counter<string>,
    @InjectMetric('http_request_duration_seconds')
    private readonly httpDurationHistogram: Histogram<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const request = context.switchToHttp().getRequest();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    // Extract request metadata
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const method = request.method;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const path = request.route?.path || request.path || 'unknown';

    return next.handle().pipe(
      tap({
        next: () => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
          this.recordMetrics(method, path, response.statusCode, startTime);
        },
        error: (error: { status?: number }) => {
          // Record metrics even for errors (500, etc.)

          const statusCode = error.status || 500;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          this.recordMetrics(method, path, statusCode, startTime);
        },
      }),
    );
  }

  private recordMetrics(
    method: string,
    route: string,
    statusCode: number,
    startTime: number,
  ): void {
    const duration = (Date.now() - startTime) / 1000; // Convert to seconds

    const labels = {
      method,
      route,
      status_code: statusCode.toString(),
    };

    try {
      // Increment request counter
      this.httpRequestsCounter.inc(labels);

      // Record request duration
      this.httpDurationHistogram.observe(labels, duration);
    } catch (error) {
      this.logger.error('Failed to record HTTP metrics:', error);
    }
  }
}
