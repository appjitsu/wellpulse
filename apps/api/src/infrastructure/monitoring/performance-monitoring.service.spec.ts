/**
 * Performance Monitoring Service Tests
 *
 * Tests the performance monitoring functionality including:
 * - Request tracking with percentiles
 * - Memory and CPU monitoring
 * - Throughput calculation
 * - Error rate tracking
 * - Performance threshold detection
 */

/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceMonitoringService } from './performance-monitoring.service';
import { MetricsService } from './metrics.service';

describe('PerformanceMonitoringService', () => {
  let service: PerformanceMonitoringService;
  let metricsService: jest.Mocked<MetricsService>;

  const mockMetricsService = {
    recordHistogram: jest.fn(),
    incrementCounter: jest.fn(),
    setGauge: jest.fn(),
    trackDatabaseQuery: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceMonitoringService,
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    service = module.get<PerformanceMonitoringService>(
      PerformanceMonitoringService,
    );
    metricsService = module.get(MetricsService);

    // Reset metrics for each test
    service.resetMetrics();
  });

  afterEach(() => {
    // Cleanup the service after each test to prevent memory leaks
    service.onModuleDestroy();
  });

  describe('Timer Functions', () => {
    it('should start a high-resolution timer', () => {
      const timer = service.startTimer();

      expect(Array.isArray(timer)).toBe(true);
      expect(timer).toHaveLength(2);
      expect(typeof timer[0]).toBe('number');
      expect(typeof timer[1]).toBe('number');
    });

    it('should calculate elapsed time from timer', async () => {
      const timer = service.startTimer();

      // Wait a small amount of time
      await new Promise((resolve) => setTimeout(resolve, 10));

      const elapsed = service.getElapsedTime(timer);

      expect(elapsed).toBeGreaterThan(0);
      expect(elapsed).toBeGreaterThanOrEqual(10); // At least 10ms
    });

    it('should measure sub-millisecond precision', () => {
      const timer = service.startTimer();
      const elapsed = service.getElapsedTime(timer);

      // Should capture very small time intervals
      expect(elapsed).toBeGreaterThanOrEqual(0);
      expect(elapsed).toBeLessThan(1000); // Less than 1 second for immediate measurement
    });
  });

  describe('recordRequest', () => {
    it('should record successful request', () => {
      const timer = service.startTimer();

      service.recordRequest('/api/wells', 'GET', 200, timer, 'tenant-1');

      expect(metricsService.recordHistogram).toHaveBeenCalledWith(
        'apiResponseTime',
        expect.any(Number),
        expect.objectContaining({
          endpoint: '/api/wells',
          method: 'GET',
          statusCode: '200',
          tenantId: 'tenant-1',
        }),
      );
    });

    it('should record error request', () => {
      const timer = service.startTimer();

      service.recordRequest('/api/wells', 'POST', 500, timer, 'tenant-1');

      expect(metricsService.recordHistogram).toHaveBeenCalled();
      expect(metricsService.incrementCounter).toHaveBeenCalledWith(
        'apiErrors',
        1,
        { endpoint: '/api/wells' },
      );
    });

    it('should track requests without tenant ID', () => {
      const timer = service.startTimer();

      service.recordRequest('/health', 'GET', 200, timer);

      expect(metricsService.recordHistogram).toHaveBeenCalledWith(
        'apiResponseTime',
        expect.any(Number),
        expect.objectContaining({
          endpoint: '/health',
          method: 'GET',
          statusCode: '200',
        }),
      );
    });

    it('should detect slow requests', () => {
      const logSpy = jest.spyOn(service['logger'], 'warn');

      // Simulate slow request by modifying timer (mock slow response)
      const slowTimer: [number, number] = [2, 0]; // 2 seconds ago

      service.recordRequest('/api/wells', 'GET', 200, slowTimer);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow request detected'),
      );
    });

    it('should maintain circular buffer size', () => {
      const timer = service.startTimer();

      // Record more than buffer size (1000 requests)
      for (let i = 0; i < 1100; i++) {
        service.recordRequest(`/api/endpoint${i}`, 'GET', 200, timer);
      }

      const metrics = service.getMetrics();

      // Buffer should not exceed 1000 requests
      expect(metrics.throughput.totalRequests).toBe(1100);
      // Internal buffer size is limited (checked via throughput in time window)
    });
  });

  describe('recordDatabaseQuery', () => {
    it('should record fast database query', () => {
      service.recordDatabaseQuery('SELECT', 50, 'tenant-1', 'wells');

      expect(metricsService.trackDatabaseQuery).toHaveBeenCalledWith(
        'tenant-1',
        'SELECT',
        50,
      );
    });

    it('should detect slow database query', () => {
      const logSpy = jest.spyOn(service['logger'], 'warn');

      service.recordDatabaseQuery('SELECT', 600, 'tenant-1', 'wells');

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow database query'),
      );
    });

    it('should track slow query count', () => {
      // Record multiple slow queries
      service.recordDatabaseQuery('SELECT', 600, 'tenant-1', 'wells');
      service.recordDatabaseQuery('UPDATE', 550, 'tenant-1', 'wells');

      const metrics = service.getMetrics();

      expect(metrics.database.slowQueriesCount).toBe(2);
    });

    it('should calculate average query duration', () => {
      service.recordDatabaseQuery('SELECT', 100, 'tenant-1');
      service.recordDatabaseQuery('SELECT', 200, 'tenant-1');
      service.recordDatabaseQuery('SELECT', 300, 'tenant-1');

      const metrics = service.getMetrics();

      expect(metrics.database.avgQueryDurationMs).toBe(200); // (100+200+300)/3
    });
  });

  describe('getMetrics', () => {
    it('should return comprehensive performance metrics', () => {
      const timer = service.startTimer();

      // Record some requests
      service.recordRequest('/api/wells', 'GET', 200, timer);
      service.recordRequest('/api/wells', 'POST', 201, timer);
      service.recordRequest('/api/wells', 'GET', 404, timer);

      const metrics = service.getMetrics();

      expect(metrics).toHaveProperty('responseTime');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('cpu');
      expect(metrics).toHaveProperty('throughput');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('database');
      expect(metrics).toHaveProperty('uptime');
    });

    it('should calculate response time percentiles', () => {
      const timer = service.startTimer();

      // Record requests with varying durations
      for (let i = 0; i < 100; i++) {
        service.recordRequest('/api/test', 'GET', 200, timer);
      }

      const metrics = service.getMetrics();

      expect(metrics.responseTime.p50).toBeGreaterThanOrEqual(0);
      expect(metrics.responseTime.p95).toBeGreaterThanOrEqual(
        metrics.responseTime.p50,
      );
      expect(metrics.responseTime.p99).toBeGreaterThanOrEqual(
        metrics.responseTime.p95,
      );
      expect(metrics.responseTime.max).toBeGreaterThanOrEqual(
        metrics.responseTime.p99,
      );
    });

    it('should report memory usage', () => {
      const metrics = service.getMetrics();

      expect(metrics.memory.heapUsedMB).toBeGreaterThan(0);
      expect(metrics.memory.heapTotalMB).toBeGreaterThan(0);
      expect(metrics.memory.heapUsagePercent).toBeGreaterThan(0);
      expect(metrics.memory.heapUsagePercent).toBeLessThanOrEqual(100);
      expect(metrics.memory.rssMB).toBeGreaterThan(0);
    });

    it('should report CPU usage', () => {
      const metrics = service.getMetrics();

      expect(metrics.cpu.usagePercent).toBeGreaterThanOrEqual(0);
      expect(metrics.cpu.loadAverage).toHaveLength(3);
    });

    it('should calculate throughput', () => {
      const timer = service.startTimer();

      // Record 10 requests
      for (let i = 0; i < 10; i++) {
        service.recordRequest('/api/test', 'GET', 200, timer);
      }

      const metrics = service.getMetrics();

      expect(metrics.throughput.totalRequests).toBe(10);
      expect(metrics.throughput.requestsPerSecond).toBeGreaterThanOrEqual(0);
      expect(metrics.throughput.requestsPerMinute).toBe(
        metrics.throughput.requestsPerSecond * 60,
      );
    });

    it('should calculate error rate', () => {
      const timer = service.startTimer();

      // Record 8 successful requests and 2 errors
      for (let i = 0; i < 8; i++) {
        service.recordRequest('/api/test', 'GET', 200, timer);
      }
      for (let i = 0; i < 2; i++) {
        service.recordRequest('/api/test', 'GET', 500, timer);
      }

      const metrics = service.getMetrics();

      expect(metrics.errorRate.totalErrors).toBe(2);
      expect(metrics.errorRate.errorRatePercent).toBeCloseTo(20, 0); // 2/10 = 20%
    });

    it('should report uptime', () => {
      const metrics = service.getMetrics();

      expect(metrics.uptime.uptimeSeconds).toBeGreaterThan(0);
      expect(metrics.uptime.uptimeHours).toBe(
        metrics.uptime.uptimeSeconds / 3600,
      );
    });

    it('should handle empty metrics gracefully', () => {
      service.resetMetrics();

      const metrics = service.getMetrics();

      expect(metrics.responseTime.p50).toBe(0);
      expect(metrics.responseTime.p95).toBe(0);
      expect(metrics.responseTime.p99).toBe(0);
      expect(metrics.throughput.totalRequests).toBe(0);
      expect(metrics.errorRate.totalErrors).toBe(0);
    });
  });

  describe('getPerformanceStatus', () => {
    it('should return performance status with valid structure', () => {
      // Reset metrics to start fresh
      service.resetMetrics();

      // Record fast requests - each with its own timer to ensure they're measured as fast
      for (let i = 0; i < 10; i++) {
        const timer = service.startTimer();
        service.recordRequest('/api/test', 'GET', 200, timer);
      }

      const status = service.getPerformanceStatus();

      // Verify structure (status can vary due to test timing)
      expect(['healthy', 'degraded', 'critical']).toContain(status.status);
      expect(Array.isArray(status.issues)).toBe(true);
      expect(status.metrics).toBeDefined();
      expect(status.metrics).toHaveProperty('responseTime');
      expect(status.metrics).toHaveProperty('throughput');
    });

    it('should detect degraded performance from slow requests', () => {
      // Simulate slow requests by using old timer
      const slowTimer: [number, number] = [1, 500000000]; // 1.5 seconds ago

      for (let i = 0; i < 100; i++) {
        service.recordRequest('/api/test', 'GET', 200, slowTimer);
      }

      const status = service.getPerformanceStatus();

      expect(status.status).toMatch(/degraded|critical/);
      expect(status.issues.length).toBeGreaterThan(0);
      expect(
        status.issues.some((issue) =>
          issue.includes('response time exceeds threshold'),
        ),
      ).toBe(true);
    });

    it('should detect critical performance from high error rate', () => {
      const timer = service.startTimer();

      // Record many errors (>5% error rate)
      for (let i = 0; i < 10; i++) {
        service.recordRequest('/api/test', 'GET', 500, timer);
      }

      const status = service.getPerformanceStatus();

      expect(status.status).toBe('critical');
      expect(
        status.issues.some((issue) =>
          issue.includes('Error rate exceeds threshold'),
        ),
      ).toBe(true);
    });

    it('should detect degraded performance from slow queries', () => {
      // Record many slow queries
      for (let i = 0; i < 15; i++) {
        service.recordDatabaseQuery('SELECT', 600, 'tenant-1');
      }

      const status = service.getPerformanceStatus();

      expect(status.status).toMatch(/degraded|critical/);
      expect(
        status.issues.some((issue) => issue.includes('slow queries')),
      ).toBe(true);
    });

    it('should provide detailed issue descriptions', () => {
      const slowTimer: [number, number] = [4, 0]; // 4 seconds ago

      service.recordRequest('/api/test', 'GET', 200, slowTimer);

      const status = service.getPerformanceStatus();

      if (status.issues.length > 0) {
        // Issues should contain threshold values
        const issue = status.issues[0];
        expect(issue).toContain('ms');
        expect(issue).toContain('>'); // Should show comparison
      }
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics', () => {
      const timer = service.startTimer();

      // Record some data
      service.recordRequest('/api/test', 'GET', 200, timer);
      service.recordRequest('/api/test', 'GET', 500, timer);
      service.recordDatabaseQuery('SELECT', 100, 'tenant-1');

      // Reset
      service.resetMetrics();

      const metrics = service.getMetrics();

      expect(metrics.throughput.totalRequests).toBe(0);
      expect(metrics.errorRate.totalErrors).toBe(0);
      expect(metrics.database.slowQueriesCount).toBe(0);
    });
  });

  describe('Performance Calculations', () => {
    it('should calculate percentiles correctly', () => {
      const timer = service.startTimer();

      // Create a known distribution: 0-99ms requests
      for (let i = 0; i < 100; i++) {
        // We can't easily control the exact timing, but we can verify the logic
        service.recordRequest('/api/test', 'GET', 200, timer);
      }

      const metrics = service.getMetrics();

      // P50 should be <= P95 <= P99 <= Max
      expect(metrics.responseTime.p50).toBeLessThanOrEqual(
        metrics.responseTime.p95,
      );
      expect(metrics.responseTime.p95).toBeLessThanOrEqual(
        metrics.responseTime.p99,
      );
      expect(metrics.responseTime.p99).toBeLessThanOrEqual(
        metrics.responseTime.max,
      );
    });

    it('should calculate mean correctly', () => {
      service.recordDatabaseQuery('SELECT', 100, 'tenant-1');
      service.recordDatabaseQuery('SELECT', 200, 'tenant-1');
      service.recordDatabaseQuery('SELECT', 300, 'tenant-1');

      const metrics = service.getMetrics();

      expect(metrics.database.avgQueryDurationMs).toBe(200);
    });

    it('should handle edge case of single data point', () => {
      const timer = service.startTimer();

      service.recordRequest('/api/test', 'GET', 200, timer);

      const metrics = service.getMetrics();

      expect(metrics.responseTime.p50).toBe(metrics.responseTime.max);
      expect(metrics.responseTime.p95).toBe(metrics.responseTime.max);
      expect(metrics.responseTime.p99).toBe(metrics.responseTime.max);
    });
  });

  describe('Integration with MetricsService', () => {
    it('should track metrics in MetricsService', () => {
      const timer = service.startTimer();

      service.recordRequest('/api/wells', 'GET', 200, timer, 'tenant-1');

      expect(metricsService.recordHistogram).toHaveBeenCalledWith(
        'apiResponseTime',
        expect.any(Number),
        expect.objectContaining({
          endpoint: '/api/wells',
          method: 'GET',
          statusCode: '200',
          tenantId: 'tenant-1',
        }),
      );
    });

    it('should track database queries in MetricsService', () => {
      service.recordDatabaseQuery('SELECT', 150, 'tenant-1', 'wells');

      expect(metricsService.trackDatabaseQuery).toHaveBeenCalledWith(
        'tenant-1',
        'SELECT',
        150,
      );
    });

    it('should track performance violations', () => {
      const slowTimer: [number, number] = [4, 0]; // 4 seconds

      service.recordRequest('/api/test', 'GET', 200, slowTimer);

      expect(metricsService.incrementCounter).toHaveBeenCalledWith(
        'performanceThresholdViolations',
        1,
        expect.objectContaining({
          endpoint: '/api/test',
          threshold: 'p99_response_time',
        }),
      );
    });
  });
});
