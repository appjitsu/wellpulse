/**
 * Connection Pool Metrics Service
 *
 * Collects and exposes Prometheus metrics for tenant database connection pools.
 * Provides visibility into connection pool health and resource utilization.
 *
 * Metrics Exposed:
 * - tenant_connection_pool_size: Total connections in pool (active + idle)
 * - tenant_connection_pool_idle: Number of idle connections
 * - tenant_connection_pool_waiting: Number of clients waiting for connection
 * - tenant_connection_pools_total: Total number of tenant connection pools
 *
 * Usage:
 * - Metrics are automatically collected every 10 seconds
 * - Accessible via GET /metrics endpoint
 * - Compatible with Prometheus scraping
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Gauge, register } from 'prom-client';
import { TenantDatabaseService } from '../database/tenant-database.service';
import { TenantRepository } from '../database/repositories/tenant.repository';

@Injectable()
export class ConnectionPoolMetricsService implements OnModuleInit {
  private readonly logger = new Logger(ConnectionPoolMetricsService.name);

  // Prometheus gauges for connection pool metrics
  private readonly poolSizeGauge: Gauge<string>;
  private readonly poolIdleGauge: Gauge<string>;
  private readonly poolWaitingGauge: Gauge<string>;
  private readonly poolsTotalGauge: Gauge<string>;

  // Tenant metrics
  private readonly tenantsTotalGauge: Gauge<string>;
  private readonly tenantsByStatusGauge: Gauge<string>;

  // Metrics collection interval (10 seconds)
  private readonly COLLECTION_INTERVAL_MS = 10000;
  private collectionInterval?: NodeJS.Timeout;

  constructor(
    private readonly tenantDatabaseService: TenantDatabaseService,
    private readonly tenantRepository: TenantRepository,
  ) {
    // Initialize Prometheus gauges
    // Use the default prom-client registry which is automatically exposed by PrometheusModule
    this.poolSizeGauge = new Gauge({
      name: 'tenant_connection_pool_size',
      help: 'Total number of connections in the pool (active + idle)',
      labelNames: ['tenant_id', 'tenant_name', 'database_name'],
      registers: [register],
    });

    this.poolIdleGauge = new Gauge({
      name: 'tenant_connection_pool_idle',
      help: 'Number of idle connections in the pool',
      labelNames: ['tenant_id', 'tenant_name', 'database_name'],
      registers: [register],
    });

    this.poolWaitingGauge = new Gauge({
      name: 'tenant_connection_pool_waiting',
      help: 'Number of clients waiting for a connection',
      labelNames: ['tenant_id', 'tenant_name', 'database_name'],
      registers: [register],
    });

    this.poolsTotalGauge = new Gauge({
      name: 'tenant_connection_pools_total',
      help: 'Total number of tenant connection pools',
      registers: [register],
    });

    this.tenantsTotalGauge = new Gauge({
      name: 'tenants_total',
      help: 'Total number of tenants',
      registers: [register],
    });

    this.tenantsByStatusGauge = new Gauge({
      name: 'tenants_by_status',
      help: 'Number of tenants by status',
      labelNames: ['status'],
      registers: [register],
    });
  }

  /**
   * Start collecting metrics on module initialization
   */
  async onModuleInit(): Promise<void> {
    // Warm up connection pools for all active tenants (create pools on startup)
    await this.warmUpConnectionPools();

    // Collect initial metrics (async, but don't await to avoid blocking module init)
    void this.collectMetrics();

    // Set up periodic collection
    this.collectionInterval = setInterval(() => {
      void this.collectMetrics();
    }, this.COLLECTION_INTERVAL_MS);

    this.logger.log(
      `Connection pool metrics collection started (interval: ${this.COLLECTION_INTERVAL_MS}ms)`,
    );
  }

  /**
   * Warm up connection pools for all ACTIVE tenants on startup
   * This ensures pools are ready for metrics collection and reduces first-request latency
   */
  private async warmUpConnectionPools(): Promise<void> {
    try {
      this.logger.log('Warming up connection pools for active tenants...');

      const { tenants: allTenants } = await this.tenantRepository.findAll({
        page: 1,
        limit: 1000,
      });

      // Only warm up pools for ACTIVE tenants (not TRIAL, SUSPENDED, etc.)
      const activeTenants = allTenants.filter((tenant) =>
        tenant.status.isActive(),
      );

      this.logger.log(
        `Found ${activeTenants.length} active tenants (${allTenants.length} total)`,
      );

      // Create connection pools for all active tenants in parallel
      const warmupPromises = activeTenants.map(async (tenant) => {
        try {
          const databaseName =
            tenant.databaseConfig.name ||
            `${tenant.id.replace(/-/g, '_')}_wellpulse`;

          // This will create the pool if it doesn't exist
          await this.tenantDatabaseService.getTenantDatabase(
            tenant.id,
            databaseName,
          );

          this.logger.debug(`✅ Pool created for tenant: ${tenant.id}`);
        } catch (error) {
          this.logger.warn(
            `❌ Failed to create pool for tenant ${tenant.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      });

      await Promise.all(warmupPromises);

      const activePoolCount =
        this.tenantDatabaseService.getActiveConnectionCount();
      this.logger.log(
        `✅ Connection pool warmup complete: ${activePoolCount} pools created`,
      );
    } catch (error) {
      this.logger.error('Failed to warm up connection pools:', error);
    }
  }

  /**
   * Stop metrics collection on module destruction
   */
  onModuleDestroy(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.logger.log('Connection pool metrics collection stopped');
    }
  }

  /**
   * Collect metrics from all tenant connection pools
   * Shows metrics for ALL active tenants (even those without active connection pools)
   */
  private async collectMetrics(): Promise<void> {
    try {
      // Get all tenants from master database (regardless of status)
      // This includes ACTIVE, TRIAL, SUSPENDED, etc.
      const { tenants: allTenants } = await this.tenantRepository.findAll({
        page: 1,
        limit: 1000, // Get all tenants (adjust if you have > 1000 tenants)
      });

      // Get active connection pools
      const connections = this.tenantDatabaseService.getAllConnections();

      // Update total pools gauge (count of active connection pools)
      this.poolsTotalGauge.set(connections.size);

      // Update tenant metrics
      this.tenantsTotalGauge.set(allTenants.length);

      // Count tenants by status
      const statusCounts = new Map<string, number>();
      for (const tenant of allTenants) {
        const status = String(tenant.status || 'UNKNOWN');
        statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
      }

      // Update status metrics
      for (const [status, count] of statusCounts.entries()) {
        this.tenantsByStatusGauge.set({ status: status }, count);
      }

      // Collect metrics for each tenant
      for (const tenant of allTenants) {
        const tenantId = tenant.id;
        const tenantName = tenant.name;
        const connection = connections.get(tenantId);

        // Get database name from tenant's config
        const databaseName =
          tenant.databaseConfig.name ||
          `${tenantId.replace(/-/g, '_')}_wellpulse`;

        if (connection) {
          // Tenant has an active connection pool - show real metrics
          const { pool } = connection;

          const totalCount = pool.totalCount; // Total connections (active + idle)
          const idleCount = pool.idleCount; // Idle connections
          const waitingCount = pool.waitingCount; // Clients waiting for connection

          this.poolSizeGauge.set(
            {
              tenant_id: tenantId,
              tenant_name: tenantName,
              database_name: databaseName,
            },
            totalCount,
          );

          this.poolIdleGauge.set(
            {
              tenant_id: tenantId,
              tenant_name: tenantName,
              database_name: databaseName,
            },
            idleCount,
          );

          this.poolWaitingGauge.set(
            {
              tenant_id: tenantId,
              tenant_name: tenantName,
              database_name: databaseName,
            },
            waitingCount,
          );
        } else {
          // Tenant exists but no connection pool - show zero metrics
          this.poolSizeGauge.set(
            {
              tenant_id: tenantId,
              tenant_name: tenantName,
              database_name: databaseName,
            },
            0,
          );

          this.poolIdleGauge.set(
            {
              tenant_id: tenantId,
              tenant_name: tenantName,
              database_name: databaseName,
            },
            0,
          );

          this.poolWaitingGauge.set(
            {
              tenant_id: tenantId,
              tenant_name: tenantName,
              database_name: databaseName,
            },
            0,
          );
        }
      }
    } catch (error) {
      this.logger.error('Failed to collect connection pool metrics:', error);
    }
  }

  /**
   * Manually trigger metrics collection
   * Useful for testing or on-demand updates
   */
  async collect(): Promise<void> {
    await this.collectMetrics();
  }
}
