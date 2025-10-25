/**
 * Monitoring Module
 *
 * Provides comprehensive Prometheus metrics and monitoring capabilities.
 * Exposes /metrics endpoint for Prometheus scraping.
 *
 * Features:
 * - HTTP request metrics (rate, duration, status codes)
 * - Connection pool metrics per tenant
 * - Active users tracking (5-minute window)
 * - Database query metrics
 * - Tenant status metrics
 * - Default Node.js metrics (CPU, memory, GC, event loop)
 *
 * Real-time updates: All metrics refresh every 10 seconds
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
    // Metrics collection services
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
  ],
  exports: [
    ConnectionPoolMetricsService,
    ActiveUsersMetricsService,
    PrometheusModule,
    // Note: HttpMetricsInterceptor is registered as APP_INTERCEPTOR and doesn't need to be exported
  ],
})
export class MonitoringModule {}
