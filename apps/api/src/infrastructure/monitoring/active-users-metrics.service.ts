/**
 * Active Users Metrics Service
 *
 * Tracks active users per tenant using Redis:
 * - Records user activity with 5-minute TTL
 * - Updates Prometheus gauge every 10 seconds
 * - Shows real-time active user counts in admin dashboard
 *
 * A user is "active" if they made an authenticated request in the last 5 minutes.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Gauge } from 'prom-client';
import Redis from 'ioredis';
import { TenantRepository } from '../database/repositories/tenant.repository';

@Injectable()
export class ActiveUsersMetricsService implements OnModuleInit {
  private readonly logger = new Logger(ActiveUsersMetricsService.name);
  private readonly redis: Redis;
  private collectionInterval?: NodeJS.Timeout;

  // Active user is defined as: authenticated request in last 5 minutes
  private readonly ACTIVE_WINDOW_SECONDS = 300; // 5 minutes
  private readonly COLLECTION_INTERVAL_MS = 10000; // 10 seconds

  constructor(
    @InjectMetric('tenant_active_users')
    private readonly activeUsersGauge: Gauge<string>,
    private readonly tenantRepository: TenantRepository,
    private readonly configService: ConfigService,
  ) {
    // Connect to Redis
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);

    this.redis = new Redis({
      host: redisHost,
      port: redisPort,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
    });
  }

  onModuleInit(): void {
    // Start collecting metrics
    void this.collectMetrics();

    // Set up periodic collection
    this.collectionInterval = setInterval(() => {
      void this.collectMetrics();
    }, this.COLLECTION_INTERVAL_MS);

    this.logger.log(
      `Active users metrics collection started (interval: ${this.COLLECTION_INTERVAL_MS}ms)`,
    );
  }

  onModuleDestroy(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }
    void this.redis.quit();
    this.logger.log('Active users metrics collection stopped');
  }

  /**
   * Record user activity (called from auth middleware/guard)
   */
  async recordUserActivity(tenantId: string, userId: string): Promise<void> {
    try {
      const key = `active_users:${tenantId}`;
      const now = Date.now();

      // Add user to sorted set with current timestamp as score
      await this.redis.zadd(key, now, userId);

      // Set expiration on the key (cleanup old data)
      await this.redis.expire(key, this.ACTIVE_WINDOW_SECONDS * 2);
    } catch (error) {
      this.logger.error('Failed to record user activity:', error);
    }
  }

  /**
   * Collect active user counts for all tenants
   */
  private async collectMetrics(): Promise<void> {
    try {
      // Get all tenants
      const { tenants: allTenants } = await this.tenantRepository.findAll({
        page: 1,
        limit: 1000,
      });

      const now = Date.now();
      const activeWindowStart = now - this.ACTIVE_WINDOW_SECONDS * 1000;

      for (const tenant of allTenants) {
        const tenantId = tenant.id;
        const key = `active_users:${tenantId}`;

        try {
          // Count users with activity in the last 5 minutes
          const activeCount = await this.redis.zcount(
            key,
            activeWindowStart,
            now,
          );

          // Update Prometheus gauge
          this.activeUsersGauge.set({ tenant_id: tenantId }, activeCount);

          // Clean up old entries (beyond active window)
          await this.redis.zremrangebyscore(key, 0, activeWindowStart);
        } catch (error) {
          this.logger.error(
            `Failed to collect metrics for tenant ${tenantId}:`,
            error,
          );
          // Set to 0 on error
          this.activeUsersGauge.set({ tenant_id: tenantId }, 0);
        }
      }
    } catch (error) {
      this.logger.error('Failed to collect active users metrics:', error);
    }
  }

  /**
   * Get active users count for a specific tenant (for testing/debugging)
   */
  async getActiveUsersCount(tenantId: string): Promise<number> {
    try {
      const key = `active_users:${tenantId}`;
      const now = Date.now();
      const activeWindowStart = now - this.ACTIVE_WINDOW_SECONDS * 1000;

      return await this.redis.zcount(key, activeWindowStart, now);
    } catch (error) {
      this.logger.error('Failed to get active users count:', error);
      return 0;
    }
  }
}
