/**
 * Redis Throttler Storage
 *
 * Distributed rate limiting using Redis as the storage backend.
 * Enables rate limiting to work across multiple API instances.
 *
 * Features:
 * - Distributed state (works with horizontal scaling)
 * - Atomic increment operations (prevents race conditions)
 * - Automatic key expiration (TTL-based cleanup)
 * - Configurable Redis connection (standalone or cluster)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly redis: Redis;
  private readonly prefix: string = 'throttle:';

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );

    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    this.redis.on('connect', () => {
      this.logger.log('✅ Redis throttler storage connected');
    });

    this.redis.on('error', (error) => {
      this.logger.error('❌ Redis throttler storage error:', error);
    });

    this.redis.on('close', () => {
      this.logger.warn('⚠️  Redis throttler storage connection closed');
    });
  }

  /**
   * Increment the hit count for a key
   *
   * Uses Redis INCR command (atomic) to prevent race conditions.
   * Sets TTL on first hit to ensure automatic cleanup.
   * Supports blocking when limit is exceeded.
   *
   * @param key - Throttle key (e.g., "ip:192.168.1.1:route:/api/auth/login")
   * @param ttl - Time to live in milliseconds
   * @param limit - Maximum number of requests allowed
   * @param blockDuration - Duration to block in milliseconds (0 = no blocking)
   * @param throttlerName - Name of the throttler (for logging)
   * @returns Current hit count, time to expiration, and blocking status
   */
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const redisKey = this.prefix + key;
    const blockKey = `${this.prefix}block:${key}`;
    const ttlSeconds = Math.ceil(ttl / 1000);
    const blockDurationSeconds = Math.ceil(blockDuration / 1000);

    try {
      // Check if key is currently blocked
      const blockTtl = await this.redis.ttl(blockKey);
      if (blockTtl > 0) {
        // Key is blocked
        return {
          totalHits: limit,
          timeToExpire: ttl,
          isBlocked: true,
          timeToBlockExpire: blockTtl * 1000,
        };
      }

      // Use pipeline for atomic operations
      const pipeline = this.redis.pipeline();

      // Increment counter
      pipeline.incr(redisKey);

      // Set expiration if key is new (NX = only if not exists)
      pipeline.expire(redisKey, ttlSeconds, 'NX');

      // Get TTL to return
      pipeline.ttl(redisKey);

      const results = await pipeline.exec();

      if (!results || results.length !== 3) {
        throw new Error('Redis pipeline failed');
      }

      const totalHits = results[0][1] as number;
      const ttlResult = results[2][1] as number;

      // Check if we should block this key
      if (blockDuration > 0 && totalHits > limit) {
        await this.redis.setex(blockKey, blockDurationSeconds, '1');
        this.logger.warn(
          `Throttler [${throttlerName}]: Key ${key} exceeded limit (${totalHits}/${limit}), blocked for ${blockDuration}ms`,
        );

        return {
          totalHits,
          timeToExpire: ttlResult > 0 ? ttlResult * 1000 : ttl,
          isBlocked: true,
          timeToBlockExpire: blockDuration,
        };
      }

      return {
        totalHits,
        timeToExpire: ttlResult > 0 ? ttlResult * 1000 : ttl,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    } catch (error) {
      this.logger.error(`Failed to increment throttle key ${key}:`, error);
      // Fallback: allow the request (fail open)
      return {
        totalHits: 0,
        timeToExpire: ttl,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }

  /**
   * Decrement the hit count for a key
   *
   * Used when a request should be "refunded" (e.g., request failed before processing).
   * Not commonly used in typical throttling scenarios.
   *
   * @param key - Throttle key
   */
  async decrement(key: string): Promise<void> {
    const redisKey = this.prefix + key;

    try {
      const value = await this.redis.decr(redisKey);

      // If counter reaches 0, delete the key
      if (value <= 0) {
        await this.redis.del(redisKey);
      }
    } catch (error) {
      this.logger.error(`Failed to decrement throttle key ${key}:`, error);
    }
  }

  /**
   * Reset a throttle key manually
   *
   * Useful for:
   * - Admin override to unblock a user
   * - Testing scenarios
   * - Clearing rate limits after configuration changes
   *
   * @param key - Throttle key to reset
   */
  async reset(key: string): Promise<void> {
    const redisKey = this.prefix + key;

    try {
      await this.redis.del(redisKey);
      this.logger.log(`Reset throttle key: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to reset throttle key ${key}:`, error);
    }
  }

  /**
   * Get current status of a throttle key
   *
   * @param key - Throttle key
   * @returns Current hit count, TTL, and blocking status, or null if key doesn't exist
   */
  async getRecord(key: string): Promise<ThrottlerStorageRecord | null> {
    const redisKey = this.prefix + key;
    const blockKey = `${this.prefix}block:${key}`;

    try {
      const pipeline = this.redis.pipeline();
      pipeline.get(redisKey);
      pipeline.ttl(redisKey);
      pipeline.ttl(blockKey);

      const results = await pipeline.exec();

      if (!results || results.length !== 3) {
        return null;
      }

      const value = results[0][1] as string | null;
      const ttl = results[1][1] as number;
      const blockTtl = results[2][1] as number;

      if (value === null || ttl === -2) {
        // Key doesn't exist
        return null;
      }

      return {
        totalHits: parseInt(value, 10),
        timeToExpire: ttl > 0 ? ttl * 1000 : 0,
        isBlocked: blockTtl > 0,
        timeToBlockExpire: blockTtl > 0 ? blockTtl * 1000 : 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get throttle record for ${key}:`, error);
      return null;
    }
  }

  /**
   * Cleanup method for graceful shutdown
   *
   * Closes Redis connection when application shuts down.
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing Redis throttler storage connection...');
    await this.redis.quit();
  }
}
