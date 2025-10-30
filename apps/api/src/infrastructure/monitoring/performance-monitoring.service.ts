/**
 * Performance Monitoring Service
 *
 * Tracks system performance metrics for the WellPulse API.
 * Monitors response times, memory usage, CPU, throughput, and error rates.
 *
 * Key Features:
 * - Real-time performance tracking with percentiles (p50, p95, p99)
 * - Memory and CPU monitoring
 * - Request throughput measurement (requests per second)
 * - Error rate tracking
 * - Performance threshold alerting
 * - Automatic performance degradation detection
 *
 * Performance Metrics:
 * - Response Time: API endpoint response duration (ms)
 * - Memory Usage: Heap used/total (MB)
 * - CPU Usage: Process CPU percentage
 * - Throughput: Requests per second
 * - Error Rate: Errors per total requests (percentage)
 * - Slow Query Count: Database queries exceeding threshold
 *
 * Usage:
 * ```typescript
 * // Track API request
 * const startTime = performanceMonitoring.startTimer();
 * // ... handle request ...
 * performanceMonitoring.recordRequest(req.path, req.method, statusCode, startTime);
 *
 * // Track database query
 * performanceMonitoring.recordDatabaseQuery(queryType, durationMs, tenantId);
 *
 * // Get current metrics
 * const metrics = await performanceMonitoring.getMetrics();
 * ```
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as os from 'os';
import { MetricsService } from './metrics.service';

interface PerformanceThresholds {
  responseTimeP95Ms: number; // 95th percentile response time threshold
  responseTimeP99Ms: number; // 99th percentile response time threshold
  errorRatePercent: number; // Error rate threshold
  memoryUsagePercent: number; // Memory usage threshold
  cpuUsagePercent: number; // CPU usage threshold
  slowQueryThresholdMs: number; // Slow query threshold
}

interface RequestMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  timestamp: number;
}

interface PerformanceMetrics {
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
    mean: number;
    max: number;
  };
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    heapUsagePercent: number;
    rssMB: number;
  };
  cpu: {
    usagePercent: number;
    loadAverage: number[];
  };
  throughput: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    totalRequests: number;
  };
  errorRate: {
    errorsPerSecond: number;
    errorRatePercent: number;
    totalErrors: number;
  };
  database: {
    slowQueriesCount: number;
    avgQueryDurationMs: number;
  };
  uptime: {
    uptimeSeconds: number;
    uptimeHours: number;
  };
}

@Injectable()
export class PerformanceMonitoringService implements OnModuleDestroy {
  private readonly logger = new Logger(PerformanceMonitoringService.name);

  // Performance thresholds (configurable)
  private readonly thresholds: PerformanceThresholds = {
    responseTimeP95Ms: 1000, // 1 second
    responseTimeP99Ms: 3000, // 3 seconds
    errorRatePercent: 5, // 5%
    memoryUsagePercent: 80, // 80% of heap
    cpuUsagePercent: 80, // 80% CPU usage
    slowQueryThresholdMs: 500, // 500ms
  };

  // In-memory circular buffer for request metrics (last 1000 requests)
  private readonly requestBuffer: RequestMetrics[] = [];
  private readonly bufferSize = 1000;

  // Request counters
  private totalRequests = 0;
  private totalErrors = 0;
  private slowQueriesCount = 0;
  private queryDurations: number[] = [];

  // Time window for throughput calculation (1 minute)
  private readonly timeWindowMs = 60000;
  private startTime = Date.now();

  // CPU tracking
  private lastCpuUsage = process.cpuUsage();
  private lastCpuCheck = Date.now();

  // Periodic collection interval
  private periodicCollectionInterval?: NodeJS.Timeout;

  constructor(private readonly metricsService: MetricsService) {
    this.logger.log('Performance Monitoring Service initialized');

    // Start periodic metrics collection
    this.startPeriodicCollection();
  }

  /**
   * Start a high-resolution timer for performance measurement
   *
   * @returns Timer start value (high-resolution timestamp)
   */
  startTimer(): [number, number] {
    return process.hrtime();
  }

  /**
   * Calculate elapsed time from timer start
   *
   * @param start Timer start value from startTimer()
   * @returns Elapsed time in milliseconds
   */
  getElapsedTime(start: [number, number]): number {
    const [seconds, nanoseconds] = process.hrtime(start);
    return seconds * 1000 + nanoseconds / 1000000;
  }

  /**
   * Record API request performance
   *
   * @param endpoint API endpoint path
   * @param method HTTP method
   * @param statusCode HTTP status code
   * @param startTime Timer start value from startTimer()
   * @param tenantId Optional tenant ID
   */
  recordRequest(
    endpoint: string,
    method: string,
    statusCode: number,
    startTime: [number, number],
    tenantId?: string,
  ): void {
    const durationMs = this.getElapsedTime(startTime);
    const isError = statusCode >= 400;

    // Add to circular buffer
    const metrics: RequestMetrics = {
      endpoint,
      method,
      statusCode,
      durationMs,
      timestamp: Date.now(),
    };

    if (this.requestBuffer.length >= this.bufferSize) {
      this.requestBuffer.shift(); // Remove oldest
    }
    this.requestBuffer.push(metrics);

    // Update counters
    this.totalRequests++;
    if (isError) {
      this.totalErrors++;
    }

    // Track in MetricsService
    this.metricsService.recordHistogram('apiResponseTime', durationMs, {
      endpoint,
      method,
      statusCode: statusCode.toString(),
      ...(tenantId && { tenantId }),
    });

    // Check performance thresholds
    this.checkPerformanceThresholds(endpoint, durationMs, isError);

    // Log slow requests
    if (durationMs > this.thresholds.responseTimeP95Ms) {
      this.logger.warn(
        `Slow request detected: ${method} ${endpoint} - ${durationMs.toFixed(2)}ms (status: ${statusCode})`,
      );
    }
  }

  /**
   * Record database query performance
   *
   * @param queryType Query type (SELECT, INSERT, UPDATE, DELETE)
   * @param durationMs Query duration in milliseconds
   * @param tenantId Tenant ID
   * @param tableName Optional table name
   */
  recordDatabaseQuery(
    queryType: string,
    durationMs: number,
    tenantId: string,
    tableName?: string,
  ): void {
    this.queryDurations.push(durationMs);

    // Keep only last 1000 query durations
    if (this.queryDurations.length > this.bufferSize) {
      this.queryDurations.shift();
    }

    // Track slow queries
    if (durationMs > this.thresholds.slowQueryThresholdMs) {
      this.slowQueriesCount++;
      this.logger.warn(
        `Slow database query: ${queryType} ${tableName || 'unknown'} - ${durationMs.toFixed(2)}ms (tenant: ${tenantId})`,
      );
    }

    // Track in MetricsService
    this.metricsService.trackDatabaseQuery(tenantId, queryType, durationMs);
  }

  /**
   * Get current performance metrics
   *
   * @returns Current performance metrics snapshot
   */
  getMetrics(): PerformanceMetrics {
    const memUsage = process.memoryUsage();
    const cpuUsage = this.getCpuUsage();
    const uptime = process.uptime();

    // Calculate response time percentiles
    const responseTimes = this.requestBuffer
      .map((r) => r.durationMs)
      .sort((a, b) => a - b);

    const responseTimeMetrics = {
      p50: this.getPercentile(responseTimes, 50),
      p95: this.getPercentile(responseTimes, 95),
      p99: this.getPercentile(responseTimes, 99),
      mean: this.getMean(responseTimes),
      max: responseTimes[responseTimes.length - 1] || 0,
    };

    // Calculate throughput (requests in time window)
    const now = Date.now();
    const timeWindowRequests = this.requestBuffer.filter(
      (r) => r.timestamp > now - this.timeWindowMs,
    );
    const timeWindowSeconds = this.timeWindowMs / 1000;
    const requestsPerSecond = timeWindowRequests.length / timeWindowSeconds;

    // Calculate error rate
    const timeWindowErrors = timeWindowRequests.filter(
      (r) => r.statusCode >= 400,
    ).length;
    const errorRatePercent =
      timeWindowRequests.length > 0
        ? (timeWindowErrors / timeWindowRequests.length) * 100
        : 0;

    // Database metrics
    const avgQueryDuration =
      this.queryDurations.length > 0 ? this.getMean(this.queryDurations) : 0;

    return {
      responseTime: responseTimeMetrics,
      memory: {
        heapUsedMB: memUsage.heapUsed / 1024 / 1024,
        heapTotalMB: memUsage.heapTotal / 1024 / 1024,
        heapUsagePercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        rssMB: memUsage.rss / 1024 / 1024,
      },
      cpu: {
        usagePercent: cpuUsage,
        loadAverage: os.loadavg(),
      },
      throughput: {
        requestsPerSecond,
        requestsPerMinute: requestsPerSecond * 60,
        totalRequests: this.totalRequests,
      },
      errorRate: {
        errorsPerSecond: timeWindowErrors / timeWindowSeconds,
        errorRatePercent,
        totalErrors: this.totalErrors,
      },
      database: {
        slowQueriesCount: this.slowQueriesCount,
        avgQueryDurationMs: avgQueryDuration,
      },
      uptime: {
        uptimeSeconds: uptime,
        uptimeHours: uptime / 3600,
      },
    };
  }

  /**
   * Get current performance status (healthy, degraded, critical)
   *
   * @returns Performance status and issues
   */
  getPerformanceStatus(): {
    status: 'healthy' | 'degraded' | 'critical';
    issues: string[];
    metrics: PerformanceMetrics;
  } {
    const metrics = this.getMetrics();
    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';

    // Check response time
    if (metrics.responseTime.p99 > this.thresholds.responseTimeP99Ms) {
      issues.push(
        `P99 response time exceeds threshold (${metrics.responseTime.p99.toFixed(0)}ms > ${this.thresholds.responseTimeP99Ms}ms)`,
      );
      status = 'critical';
    } else if (metrics.responseTime.p95 > this.thresholds.responseTimeP95Ms) {
      issues.push(
        `P95 response time exceeds threshold (${metrics.responseTime.p95.toFixed(0)}ms > ${this.thresholds.responseTimeP95Ms}ms)`,
      );
      status = status === 'healthy' ? 'degraded' : status;
    }

    // Check error rate
    if (metrics.errorRate.errorRatePercent > this.thresholds.errorRatePercent) {
      issues.push(
        `Error rate exceeds threshold (${metrics.errorRate.errorRatePercent.toFixed(1)}% > ${this.thresholds.errorRatePercent}%)`,
      );
      status = 'critical';
    }

    // Check memory usage
    if (metrics.memory.heapUsagePercent > this.thresholds.memoryUsagePercent) {
      issues.push(
        `Memory usage exceeds threshold (${metrics.memory.heapUsagePercent.toFixed(1)}% > ${this.thresholds.memoryUsagePercent}%)`,
      );
      status = status === 'healthy' ? 'degraded' : status;
    }

    // Check CPU usage
    if (metrics.cpu.usagePercent > this.thresholds.cpuUsagePercent) {
      issues.push(
        `CPU usage exceeds threshold (${metrics.cpu.usagePercent.toFixed(1)}% > ${this.thresholds.cpuUsagePercent}%)`,
      );
      status = status === 'healthy' ? 'degraded' : status;
    }

    // Check slow queries
    if (metrics.database.slowQueriesCount > 10) {
      issues.push(
        `High number of slow queries detected (${metrics.database.slowQueriesCount})`,
      );
      status = status === 'healthy' ? 'degraded' : status;
    }

    return { status, issues, metrics };
  }

  /**
   * Reset performance metrics (useful for testing)
   */
  resetMetrics(): void {
    this.requestBuffer.length = 0;
    this.totalRequests = 0;
    this.totalErrors = 0;
    this.slowQueriesCount = 0;
    this.queryDurations.length = 0;
    this.startTime = Date.now();

    this.logger.log('Performance metrics reset');
  }

  /**
   * Calculate percentile from sorted array
   */
  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)] || 0;
  }

  /**
   * Calculate mean (average) from array
   */
  private getMean(array: number[]): number {
    if (array.length === 0) return 0;

    const sum = array.reduce((acc, val) => acc + val, 0);
    return sum / array.length;
  }

  /**
   * Get current CPU usage percentage
   */
  private getCpuUsage(): number {
    const now = Date.now();
    const cpuUsage = process.cpuUsage(this.lastCpuUsage);
    const elapsedMs = now - this.lastCpuCheck;

    // Calculate CPU usage percentage
    // cpuUsage is in microseconds, so we need to convert
    const totalCpuMs = (cpuUsage.user + cpuUsage.system) / 1000;
    const cpuPercent = (totalCpuMs / elapsedMs) * 100;

    // Update for next calculation
    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuCheck = now;

    return cpuPercent;
  }

  /**
   * Check performance thresholds and log warnings
   */
  private checkPerformanceThresholds(
    endpoint: string,
    durationMs: number,
    isError: boolean,
  ): void {
    // Check if response time exceeds P99 threshold
    if (durationMs > this.thresholds.responseTimeP99Ms) {
      this.logger.error(
        `CRITICAL: Response time exceeds P99 threshold: ${endpoint} - ${durationMs.toFixed(2)}ms`,
      );
      this.metricsService.incrementCounter(
        'performanceThresholdViolations',
        1,
        {
          endpoint,
          threshold: 'p99_response_time',
        },
      );
    }

    // Check if this is an error
    if (isError) {
      this.metricsService.incrementCounter('apiErrors', 1, {
        endpoint,
      });
    }
  }

  /**
   * Start periodic metrics collection and reporting
   */
  private startPeriodicCollection(): void {
    // Collect metrics every 60 seconds
    this.periodicCollectionInterval = setInterval(() => {
      void this.collectMetrics();
    }, 60000); // 60 seconds

    this.logger.log('Periodic metrics collection started (every 60 seconds)');
  }

  /**
   * Collect and track metrics periodically
   */
  private collectMetrics(): void {
    try {
      const metrics = this.getMetrics();

      // Track memory metrics
      this.metricsService.setGauge(
        'systemMemoryUsagePercent',
        metrics.memory.heapUsagePercent,
      );

      // Track CPU metrics
      this.metricsService.setGauge(
        'systemCpuUsagePercent',
        metrics.cpu.usagePercent,
      );

      // Track throughput
      this.metricsService.setGauge(
        'apiRequestsPerSecond',
        metrics.throughput.requestsPerSecond,
      );

      // Track error rate
      this.metricsService.setGauge(
        'apiErrorRatePercent',
        metrics.errorRate.errorRatePercent,
      );

      // Check for performance degradation
      const status = this.getPerformanceStatus();
      if (status.status !== 'healthy') {
        this.logger.warn(
          `Performance degradation detected: ${status.status.toUpperCase()}`,
          status.issues,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to collect periodic metrics: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Cleanup on module destroy
   */
  onModuleDestroy(): void {
    if (this.periodicCollectionInterval) {
      clearInterval(this.periodicCollectionInterval);
      this.logger.log('Periodic metrics collection stopped');
    }
  }
}
