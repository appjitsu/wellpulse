/**
 * HTTP Metrics Interceptor
 *
 * Captures metrics for all HTTP requests to both:
 * - Prometheus: Request count and duration (for /metrics endpoint)
 * - Application Insights: Request telemetry (for Azure monitoring)
 *
 * Features:
 * - Tracks method, route, status code
 * - Measures request duration
 * - Logs slow requests (>1s warning, >5s error)
 * - Sends custom metrics to Application Insights
 *
 * Registered globally in MonitoringModule via APP_INTERCEPTOR.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApplicationInsightsService } from './application-insights.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpMetricsInterceptor.name);

  constructor(
    @InjectMetric('http_requests_total')
    private readonly httpRequestsCounter: Counter<string>,
    @InjectMetric('http_request_duration_seconds')
    private readonly httpDurationHistogram: Histogram<string>,
    @Optional()
    private readonly appInsights?: ApplicationInsightsService,
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
    const durationMs = Date.now() - startTime;
    const durationSeconds = durationMs / 1000;

    const labels = {
      method,
      route,
      status_code: statusCode.toString(),
    };

    try {
      // Prometheus metrics
      this.httpRequestsCounter.inc(labels);
      this.httpDurationHistogram.observe(labels, durationSeconds);

      // Application Insights metrics
      if (this.appInsights) {
        // Track custom metric for request duration
        this.appInsights.trackMetric('ApiRequestDuration', durationMs, {
          method,
          route,
          statusCode: statusCode.toString(),
        });

        // Track event for slow requests
        if (durationSeconds > 5) {
          this.logger.error(
            `Slow request detected: ${method} ${route} took ${durationSeconds.toFixed(2)}s`,
            { statusCode, duration: durationMs },
          );
          this.appInsights.trackEvent('SlowRequest', {
            method,
            route,
            statusCode: statusCode.toString(),
            duration: durationMs.toString(),
            severity: 'error',
          });
        } else if (durationSeconds > 1) {
          this.logger.warn(
            `Request took longer than expected: ${method} ${route} took ${durationSeconds.toFixed(2)}s`,
          );
          this.appInsights.trackEvent('SlowRequest', {
            method,
            route,
            statusCode: statusCode.toString(),
            duration: durationMs.toString(),
            severity: 'warning',
          });
        }

        // Track event for errors (4xx, 5xx)
        if (statusCode >= 400) {
          const isServerError = statusCode >= 500;

          this.appInsights.trackEvent(
            isServerError ? 'ServerError' : 'ClientError',
            {
              method,
              route,
              statusCode: statusCode.toString(),
              duration: durationMs.toString(),
            },
          );
        }
      }
    } catch (error) {
      this.logger.error('Failed to record HTTP metrics:', error);
    }
  }
}
