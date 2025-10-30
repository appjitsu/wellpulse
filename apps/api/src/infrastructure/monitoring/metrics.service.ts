/**
 * Custom Metrics Service
 *
 * Provides business-specific metrics tracking for WellPulse API.
 * Sends metrics to both Prometheus and Application Insights.
 *
 * Business Metrics:
 * - alertsCreated: Count of alerts created
 * - nominalRangeViolations: Count of nominal range violations detected
 * - apiRequestDuration: Request duration histogram
 * - databaseQueryDuration: Database query duration histogram
 * - tenantActiveUsers: Active users per tenant
 * - syncOperations: Count of offline sync operations
 *
 * Usage:
 * - incrementCounter('alertsCreated', 1, { tenantId, severity })
 * - recordHistogram('databaseQueryDuration', duration, { tenantId, operation })
 * - setGauge('tenantActiveUsers', count, { tenantId })
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ApplicationInsightsService } from './application-insights.service';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    @Optional()
    private readonly appInsights?: ApplicationInsightsService,
  ) {}

  /**
   * Increment a counter metric
   * @param name Metric name
   * @param value Value to increment by (default: 1)
   * @param tags Dimensions/tags for the metric
   */
  incrementCounter(
    name: string,
    value = 1,
    tags?: Record<string, string>,
  ): void {
    try {
      if (this.appInsights) {
        // Track as custom metric in Application Insights
        this.appInsights.trackMetric(name, value, tags);

        // Also track as event for better querying
        this.appInsights.trackEvent(name, {
          ...tags,
          value: value.toString(),
        });
      } else {
        this.logger.debug(`[Counter] ${name}: ${value}`, tags);
      }
    } catch (error) {
      this.logger.error(`Failed to increment counter ${name}:`, error);
    }
  }

  /**
   * Record a histogram metric (duration, size, etc.)
   * @param name Metric name
   * @param value Value to record
   * @param tags Dimensions/tags for the metric
   */
  recordHistogram(
    name: string,
    value: number,
    tags?: Record<string, string>,
  ): void {
    try {
      if (this.appInsights) {
        this.appInsights.trackMetric(name, value, tags);
      } else {
        this.logger.debug(`[Histogram] ${name}: ${value}`, tags);
      }
    } catch (error) {
      this.logger.error(`Failed to record histogram ${name}:`, error);
    }
  }

  /**
   * Set a gauge metric (current value)
   * @param name Metric name
   * @param value Current value
   * @param tags Dimensions/tags for the metric
   */
  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    try {
      if (this.appInsights) {
        this.appInsights.trackMetric(name, value, tags);
      } else {
        this.logger.debug(`[Gauge] ${name}: ${value}`, tags);
      }
    } catch (error) {
      this.logger.error(`Failed to set gauge ${name}:`, error);
    }
  }

  /**
   * Track an alert created event
   * @param tenantId Tenant ID
   * @param severity Alert severity
   * @param type Alert type
   */
  trackAlertCreated(tenantId: string, severity: string, type: string): void {
    this.incrementCounter('alertsCreated', 1, {
      tenantId,
      severity,
      type,
    });

    this.logger.log(
      `Alert created: tenant=${tenantId}, severity=${severity}, type=${type}`,
    );
  }

  /**
   * Track a nominal range violation detected
   * @param tenantId Tenant ID
   * @param wellId Well ID
   * @param parameter Parameter that violated (e.g., 'oilProduction', 'gasProduction')
   */
  trackNominalRangeViolation(
    tenantId: string,
    wellId: string,
    parameter: string,
  ): void {
    this.incrementCounter('nominalRangeViolations', 1, {
      tenantId,
      wellId,
      parameter,
    });

    this.logger.warn(
      `Nominal range violation: tenant=${tenantId}, well=${wellId}, parameter=${parameter}`,
    );
  }

  /**
   * Track database query duration
   * @param tenantId Tenant ID
   * @param operation Operation type (e.g., 'SELECT', 'INSERT', 'UPDATE')
   * @param durationMs Duration in milliseconds
   */
  trackDatabaseQuery(
    tenantId: string,
    operation: string,
    durationMs: number,
  ): void {
    this.recordHistogram('databaseQueryDuration', durationMs, {
      tenantId,
      operation,
    });

    // Log slow queries
    if (durationMs > 1000) {
      this.logger.warn(
        `Slow database query detected: tenant=${tenantId}, operation=${operation}, duration=${durationMs}ms`,
      );
    }
  }

  /**
   * Track active users for a tenant
   * @param tenantId Tenant ID
   * @param count Number of active users
   */
  trackActiveUsers(tenantId: string, count: number): void {
    this.setGauge('tenantActiveUsers', count, { tenantId });
  }

  /**
   * Track offline sync operation
   * @param tenantId Tenant ID
   * @param userId User ID
   * @param entriesCount Number of entries synced
   * @param success Whether sync succeeded
   */
  trackSyncOperation(
    tenantId: string,
    userId: string,
    entriesCount: number,
    success: boolean,
  ): void {
    this.incrementCounter('syncOperations', 1, {
      tenantId,
      userId,
      success: success.toString(),
    });

    this.incrementCounter('syncEntriesProcessed', entriesCount, {
      tenantId,
      userId,
    });

    this.logger.log(
      `Sync operation: tenant=${tenantId}, user=${userId}, entries=${entriesCount}, success=${success}`,
    );
  }

  /**
   * Track API endpoint usage
   * @param endpoint Endpoint path
   * @param method HTTP method
   * @param tenantId Tenant ID (optional)
   */
  trackEndpointUsage(
    endpoint: string,
    method: string,
    tenantId?: string,
  ): void {
    this.incrementCounter('endpointUsage', 1, {
      endpoint,
      method,
      ...(tenantId && { tenantId }),
    });
  }

  /**
   * Track ML prediction request
   * @param tenantId Tenant ID
   * @param modelType Model type (e.g., 'predictive-maintenance', 'anomaly-detection')
   * @param durationMs Duration in milliseconds
   * @param success Whether prediction succeeded
   */
  trackMLPrediction(
    tenantId: string,
    modelType: string,
    durationMs: number,
    success: boolean,
  ): void {
    this.incrementCounter('mlPredictions', 1, {
      tenantId,
      modelType,
      success: success.toString(),
    });

    this.recordHistogram('mlPredictionDuration', durationMs, {
      tenantId,
      modelType,
    });

    this.logger.log(
      `ML prediction: tenant=${tenantId}, model=${modelType}, duration=${durationMs}ms, success=${success}`,
    );
  }

  /**
   * Track file upload
   * @param tenantId Tenant ID
   * @param fileType File type (e.g., 'image', 'pdf', 'csv')
   * @param fileSizeBytes File size in bytes
   */
  trackFileUpload(
    tenantId: string,
    fileType: string,
    fileSizeBytes: number,
  ): void {
    this.incrementCounter('fileUploads', 1, {
      tenantId,
      fileType,
    });

    this.recordHistogram('fileUploadSize', fileSizeBytes, {
      tenantId,
      fileType,
    });

    this.logger.log(
      `File upload: tenant=${tenantId}, type=${fileType}, size=${fileSizeBytes} bytes`,
    );
  }

  /**
   * Track authentication event
   * @param eventType Event type (e.g., 'login', 'logout', 'token-refresh')
   * @param tenantId Tenant ID
   * @param success Whether event succeeded
   */
  trackAuthEvent(eventType: string, tenantId: string, success: boolean): void {
    this.incrementCounter('authEvents', 1, {
      eventType,
      tenantId,
      success: success.toString(),
    });

    this.logger.log(
      `Auth event: type=${eventType}, tenant=${tenantId}, success=${success}`,
    );
  }
}
