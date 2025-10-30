/**
 * Application Insights Service
 *
 * Provides Azure Application Insights integration for:
 * - Custom event tracking
 * - Custom metrics
 * - Exception tracking
 * - Dependency tracking (external API calls, database queries)
 *
 * Gracefully degrades if Application Insights is not configured (local development).
 *
 * Usage:
 * - trackEvent('WellCreated', { tenantId, wellId })
 * - trackMetric('ApiRequestDuration', duration, { endpoint, status })
 * - trackException(error, { context: 'AuthController' })
 * - trackDependency('PostgreSQL', 'SELECT * FROM wells', duration, true)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as appInsights from 'applicationinsights';

@Injectable()
export class ApplicationInsightsService {
  private readonly logger = new Logger(ApplicationInsightsService.name);
  private client: appInsights.TelemetryClient | null = null;
  private isConfigured = false;

  constructor(private readonly configService: ConfigService) {
    this.initialize();
  }

  /**
   * Initialize Application Insights SDK
   * Called in constructor - runs early in application lifecycle
   */
  private initialize(): void {
    const connectionString = this.configService.get<string>(
      'APPLICATIONINSIGHTS_CONNECTION_STRING',
    );

    if (!connectionString) {
      this.logger.warn(
        'Application Insights not configured - metrics will only be logged locally',
      );
      return;
    }

    try {
      // Setup Application Insights
      appInsights
        .setup(connectionString)
        .setAutoDependencyCorrelation(true) // Correlate dependencies with requests
        .setAutoCollectRequests(true) // Track incoming HTTP requests
        .setAutoCollectPerformance(true, true) // Track performance counters
        .setAutoCollectExceptions(true) // Track unhandled exceptions
        .setAutoCollectDependencies(true) // Track outgoing dependencies (HTTP, SQL, Redis)
        .setAutoCollectConsole(true, true) // Track console.log, console.error
        .setUseDiskRetryCaching(true) // Retry failed uploads from disk
        .setSendLiveMetrics(true) // Enable Live Metrics Stream
        .setDistributedTracingMode(
          appInsights.DistributedTracingModes.AI_AND_W3C,
        ) // Support W3C trace context
        .start();

      this.client = appInsights.defaultClient;
      this.isConfigured = true;

      // Add common properties to all telemetry
      this.client.commonProperties = {
        environment: this.configService.get<string>('NODE_ENV') || 'unknown',
        application: 'wellpulse-api',
      };

      this.logger.log('Application Insights initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Application Insights', error);
    }
  }

  /**
   * Track a custom event
   * @param name Event name (e.g., 'AlertCreated', 'WellCreated')
   * @param properties Custom properties (e.g., { tenantId, wellId })
   * @param measurements Custom measurements (e.g., { duration: 123 })
   */
  trackEvent(
    name: string,
    properties?: Record<string, string>,
    measurements?: Record<string, number>,
  ): void {
    if (this.client && this.isConfigured) {
      this.client.trackEvent({
        name,
        properties,
        measurements,
      });
    } else {
      this.logger.debug(`[Event] ${name}`, { properties, measurements });
    }
  }

  /**
   * Track a custom metric
   * @param name Metric name (e.g., 'ApiRequestDuration', 'AlertsCreated')
   * @param value Metric value
   * @param properties Tags/dimensions (e.g., { endpoint: '/api/wells', status: '200' })
   */
  trackMetric(
    name: string,
    value: number,
    properties?: Record<string, string>,
  ): void {
    if (this.client && this.isConfigured) {
      this.client.trackMetric({
        name,
        value,
        properties,
      });
    } else {
      this.logger.debug(`[Metric] ${name}: ${value}`, properties);
    }
  }

  /**
   * Track an exception/error
   * @param error Error object
   * @param properties Additional context (e.g., { tenantId, userId, context })
   */
  trackException(error: Error, properties?: Record<string, string>): void {
    if (this.client && this.isConfigured) {
      this.client.trackException({
        exception: error,
        properties,
      });
    } else {
      this.logger.error(
        `[Exception] ${error.message}`,
        error.stack,
        properties,
      );
    }
  }

  /**
   * Track a dependency call (external API, database query, cache lookup)
   * @param name Dependency name (e.g., 'PostgreSQL', 'Redis', 'ML-Service')
   * @param data Command/query executed (e.g., 'SELECT * FROM wells', 'GET /predict')
   * @param duration Duration in milliseconds
   * @param success Whether the call succeeded
   * @param properties Additional context
   */
  trackDependency(
    name: string,
    data: string,
    duration: number,
    success: boolean,
    properties?: Record<string, string>,
  ): void {
    if (this.client && this.isConfigured) {
      this.client.trackDependency({
        name,
        data,
        duration,
        success,
        resultCode: success ? 200 : 500,
        properties,
      });
    } else {
      this.logger.debug(`[Dependency] ${name}: ${data} (${duration}ms)`, {
        success,
        ...properties,
      });
    }
  }

  /**
   * Track a page view (for web analytics)
   * @param name Page name
   * @param url Page URL
   * @param properties Additional properties
   */
  trackPageView(
    name: string,
    url: string,
    properties?: Record<string, string>,
  ): void {
    if (this.client && this.isConfigured) {
      this.client.trackPageView({
        name,
        url,
        id: `${name}-${Date.now()}`, // Required by new API
        properties,
      });
    } else {
      this.logger.debug(`[PageView] ${name}: ${url}`, properties);
    }
  }

  /**
   * Track a custom trace/log message
   * @param message Log message
   * @param properties Additional properties
   */
  trackTrace(message: string, properties?: Record<string, string>): void {
    if (this.client && this.isConfigured) {
      this.client.trackTrace({
        message,
        properties,
      });
    } else {
      this.logger.debug(`[Trace] ${message}`, properties);
    }
  }

  /**
   * Flush all pending telemetry
   * Useful before application shutdown
   */
  async flush(): Promise<void> {
    if (this.client && this.isConfigured) {
      return new Promise<void>((resolve) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.client!.flush();
        // Give it a moment to complete
        setTimeout(() => {
          resolve();
        }, 100);
      });
    }
  }

  /**
   * Check if Application Insights is configured and ready
   */
  isEnabled(): boolean {
    return this.isConfigured;
  }
}
