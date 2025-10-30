/**
 * Monitoring Module
 *
 * Provides comprehensive monitoring via:
 * - Prometheus metrics (for /metrics endpoint)
 * - Azure Application Insights (for production monitoring)
 * - Structured logging via Winston
 * - Performance monitoring with percentiles and thresholds
 *
 * Features:
 * - HTTP request metrics (rate, duration, status codes)
 * - Performance metrics (p50, p95, p99 response times)
 * - Connection pool metrics per tenant
 * - Active users tracking (5-minute window)
 * - Database query metrics with slow query detection
 * - Memory and CPU usage monitoring
 * - Request throughput and error rate tracking
 * - Performance threshold alerting
 * - Tenant status metrics
 * - Custom business metrics (alerts, violations, sync operations)
 * - Default Node.js metrics (CPU, memory, GC, event loop)
 *
 * Real-time updates: All metrics refresh every 10 seconds (basic), 60 seconds (performance)
 */

import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  PrometheusModule,
  makeCounterProvider,
  makeGaugeProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';
import { ConnectionPoolMetricsService } from './connection-pool-metrics.service';
import { ActiveUsersMetricsService } from './active-users-metrics.service';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { ApplicationInsightsService } from './application-insights.service';
import { MetricsService } from './metrics.service';
import { PerformanceMonitoringService } from './performance-monitoring.service';
import { PerformanceInterceptor } from './performance.interceptor';
import { TenantsModule } from '../../presentation/tenants/tenants.module';

@Module({
  imports: [
    // Prometheus module with default metrics
    // This registers a controller at /metrics path
    PrometheusModule.register({
      // Default Node.js metrics (CPU, memory, GC, event loop lag)
      defaultMetrics: {
        enabled: true,
        config: {
          prefix: 'wellpulse_',
        },
      },
      // Optional: change the metrics endpoint path (default is '/metrics')
      // path: '/metrics',
    }),
    // Import TenantsModule to access TenantRepository
    TenantsModule,
  ],
  providers: [
    // Core monitoring services
    ApplicationInsightsService,
    MetricsService,
    PerformanceMonitoringService,
    ConnectionPoolMetricsService,
    ActiveUsersMetricsService,

    // HTTP metrics
    makeHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    }),

    makeCounterProvider({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    }),

    // Application metrics
    makeCounterProvider({
      name: 'tenant_database_queries_total',
      help: 'Total number of database queries executed',
      labelNames: ['tenant_id', 'operation'],
    }),

    makeGaugeProvider({
      name: 'tenant_active_users',
      help: 'Number of active users per tenant (5-minute window)',
      labelNames: ['tenant_id'],
    }),

    // Note: tenants_total and tenants_by_status are created in ConnectionPoolMetricsService

    // Register HTTP interceptor globally (but within this module's context)
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
    // Register Performance interceptor globally for detailed performance tracking
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceInterceptor,
    },
  ],
  exports: [
    ApplicationInsightsService,
    MetricsService,
    PerformanceMonitoringService,
    ConnectionPoolMetricsService,
    ActiveUsersMetricsService,
    PrometheusModule,
    // Note: HttpMetricsInterceptor and PerformanceInterceptor are registered as APP_INTERCEPTOR and don't need to be exported
  ],
})
export class MonitoringModule {}
