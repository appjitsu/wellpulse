/**
 * Health Check Service
 *
 * Performs comprehensive health checks for production monitoring:
 * - Database connectivity (master DB)
 * - Redis connectivity
 * - Memory usage
 * - Application uptime
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import Redis from 'ioredis';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  service: string;
  version: string;
  uptime: number;
  checks: {
    database: HealthCheckDetail;
    redis: HealthCheckDetail;
    memory: HealthCheckDetail;
  };
}

export interface HealthCheckDetail {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  message?: string;
  details?: any;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime: number;
  private masterPool: Pool | null = null;
  private redisClient: Redis | null = null;

  constructor(private readonly configService: ConfigService) {
    this.startTime = Date.now();
    this.initializeMasterPool();
    this.initializeRedisClient();
  }

  /**
   * Initialize master database connection pool
   */
  private initializeMasterPool(): void {
    try {
      const masterDbUrl = this.configService.get<string>('MASTER_DATABASE_URL');
      if (masterDbUrl) {
        this.masterPool = new Pool({
          connectionString: masterDbUrl,
          max: 2, // Only 2 connections for health checks
          idleTimeoutMillis: 30000,
        });
      }
    } catch (error) {
      this.logger.error(
        'Failed to initialize master database pool for health checks',
        error,
      );
    }
  }

  /**
   * Initialize Redis client for health checks
   */
  private initializeRedisClient(): void {
    try {
      const redisUrl = this.configService.get<string>(
        'REDIS_URL',
        'redis://localhost:6379',
      );

      this.redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
      });

      this.redisClient.on('error', (err: Error) => {
        this.logger.warn('Redis health check client error:', err);
      });

      this.redisClient.on('connect', () => {
        this.logger.log('Redis health check client connected');
      });
    } catch (error) {
      this.logger.error(
        'Failed to initialize Redis client for health checks',
        error,
      );
    }
  }

  /**
   * Perform comprehensive health check
   */
  async check(): Promise<HealthCheckResult> {
    const [databaseCheck, redisCheck] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);
    const memoryCheck = this.checkMemory();

    // Determine overall status
    const allChecks = [databaseCheck, redisCheck, memoryCheck];
    const hasDown = allChecks.some((check) => check.status === 'down');
    const hasDegraded = allChecks.some((check) => check.status === 'degraded');

    const overallStatus = hasDown
      ? 'unhealthy'
      : hasDegraded
        ? 'degraded'
        : 'healthy';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: 'wellpulse-api',
      version: this.configService.get<string>('npm_package_version') || '0.0.1',
      uptime: Math.floor((Date.now() - this.startTime) / 1000), // seconds
      checks: {
        database: databaseCheck,
        redis: redisCheck,
        memory: memoryCheck,
      },
    };
  }

  /**
   * Check master database connectivity
   */
  private async checkDatabase(): Promise<HealthCheckDetail> {
    if (!this.masterPool) {
      return {
        status: 'down',
        message: 'Database pool not initialized',
      };
    }

    const startTime = Date.now();

    try {
      // Simple connectivity check
      const result = await this.masterPool.query<{ health_check: number }>(
        'SELECT 1 as health_check',
      );

      const responseTime = Date.now() - startTime;

      if (result.rows.length > 0 && result.rows[0].health_check === 1) {
        return {
          status: 'up',
          responseTime,
          message: 'Database connection successful',
        };
      } else {
        return {
          status: 'down',
          responseTime,
          message: 'Database query returned unexpected result',
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;

      this.logger.error('Database health check failed:', error);

      return {
        status: 'down',
        responseTime,
        message:
          error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  /**
   * Check Redis connectivity
   */
  private async checkRedis(): Promise<HealthCheckDetail> {
    if (!this.redisClient) {
      return {
        status: 'down',
        message: 'Redis client not initialized',
      };
    }

    const startTime = Date.now();

    try {
      // Check if connected
      if (this.redisClient.status !== 'ready') {
        return {
          status: 'down',
          message: 'Redis client not connected',
        };
      }

      // Simple PING check
      const pong = await this.redisClient.ping();

      const responseTime = Date.now() - startTime;

      if (pong === 'PONG') {
        return {
          status: 'up',
          responseTime,
          message: 'Redis connection successful',
        };
      } else {
        return {
          status: 'down',
          responseTime,
          message: 'Redis PING returned unexpected response',
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;

      this.logger.error('Redis health check failed:', error);

      return {
        status: 'down',
        responseTime,
        message: error instanceof Error ? error.message : 'Unknown Redis error',
      };
    }
  }

  /**
   * Check memory usage
   */
  private checkMemory(): HealthCheckDetail {
    try {
      const memoryUsage = process.memoryUsage();

      // Convert to MB
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
      const rssMB = Math.round(memoryUsage.rss / 1024 / 1024);

      // Check for memory pressure (>80% heap usage)
      const heapUsagePercent =
        (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

      const status =
        heapUsagePercent > 90
          ? 'degraded'
          : heapUsagePercent > 80
            ? 'degraded'
            : 'up';

      return {
        status,
        message: `Heap usage: ${heapUsedMB}MB / ${heapTotalMB}MB (${heapUsagePercent.toFixed(1)}%)`,
        details: {
          heapUsedMB,
          heapTotalMB,
          heapUsagePercent: Math.round(heapUsagePercent),
          rssMB,
        },
      };
    } catch (error) {
      this.logger.error('Memory health check failed:', error);

      return {
        status: 'down',
        message:
          error instanceof Error ? error.message : 'Unknown memory check error',
      };
    }
  }

  /**
   * Cleanup resources on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    if (this.masterPool) {
      await this.masterPool.end();
    }

    if (this.redisClient && this.redisClient.status === 'ready') {
      await this.redisClient.quit();
    }
  }
}
