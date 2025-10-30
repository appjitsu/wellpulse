/**
 * Token Blacklist Service
 *
 * Manages JWT token invalidation using Redis for secure logout and token revocation.
 * Critical for security - handles token invalidation for:
 * - User logout
 * - Password changes
 * - Account suspension
 * - Security incidents
 * - Token rotation
 *
 * Architecture:
 * - Redis for fast, distributed token lookups
 * - TTL-based automatic cleanup (tokens expire from blacklist)
 * - Token hash storage (doesn't store full JWT)
 * - Supports both access and refresh token invalidation
 *
 * Usage:
 * ```typescript
 * // Blacklist on logout
 * await tokenBlacklistService.blacklistToken(accessToken, userId);
 *
 * // Check in guard
 * const isBlacklisted = await tokenBlacklistService.isTokenBlacklisted(accessToken);
 *
 * // Revoke all user tokens (password change, security event)
 * await tokenBlacklistService.blacklistAllUserTokens(userId);
 * ```
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as crypto from 'crypto';

@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private readonly redis: Redis;
  private readonly keyPrefix = 'blacklist:token:';
  private readonly userTokensPrefix = 'blacklist:user:';

  constructor(private readonly configService: ConfigService) {
    // Initialize Redis connection
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD'),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redis.on('error', (error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis for token blacklist');
    });
  }

  /**
   * Blacklist a JWT token
   *
   * Stores token hash in Redis with TTL matching token expiration.
   * After TTL expires, token is automatically removed from blacklist.
   *
   * @param token - JWT token to blacklist
   * @param userId - User ID for tracking
   * @param ttlSeconds - Time to live (defaults to 24 hours)
   */
  async blacklistToken(
    token: string,
    userId: string,
    ttlSeconds: number = 86400, // 24 hours default
  ): Promise<void> {
    try {
      const tokenHash = this.hashToken(token);
      const key = `${this.keyPrefix}${tokenHash}`;

      // Store token hash with metadata
      const data = JSON.stringify({
        userId,
        blacklistedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      });

      await this.redis.setex(key, ttlSeconds, data);

      // Add to user's token set for bulk revocation
      const userKey = `${this.userTokensPrefix}${userId}`;
      await this.redis.sadd(userKey, tokenHash);
      await this.redis.expire(userKey, ttlSeconds);

      this.logger.log(
        `Token blacklisted for user ${userId}, expires in ${ttlSeconds}s`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to blacklist token: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Don't throw - blacklist failures shouldn't break logout
    }
  }

  /**
   * Check if a token is blacklisted
   *
   * @param token - JWT token to check
   * @returns True if token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const tokenHash = this.hashToken(token);
      const key = `${this.keyPrefix}${tokenHash}`;

      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      this.logger.error(
        `Failed to check token blacklist: ${error instanceof Error ? error.message : String(error)}`,
      );
      // On error, assume token is NOT blacklisted (fail open for availability)
      // Consider changing to fail closed (return true) for higher security
      return false;
    }
  }

  /**
   * Blacklist all tokens for a user
   *
   * Used when:
   * - Password is changed
   * - Account is suspended
   * - Security incident detected
   *
   * @param userId - User ID
   * @param ttlSeconds - How long to keep tokens blacklisted
   */
  async blacklistAllUserTokens(
    userId: string,
    ttlSeconds: number = 86400,
  ): Promise<void> {
    try {
      const userKey = `${this.userTokensPrefix}${userId}`;

      // Get all token hashes for this user
      const tokenHashes = await this.redis.smembers(userKey);

      if (tokenHashes.length === 0) {
        this.logger.warn(`No tokens found for user ${userId}`);
        return;
      }

      // Blacklist each token
      const pipeline = this.redis.pipeline();
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

      for (const tokenHash of tokenHashes) {
        const key = `${this.keyPrefix}${tokenHash}`;
        const data = JSON.stringify({
          userId,
          blacklistedAt: now,
          expiresAt,
          reason: 'bulk_revocation',
        });
        pipeline.setex(key, ttlSeconds, data);
      }

      await pipeline.exec();

      this.logger.warn(
        `Blacklisted ${tokenHashes.length} tokens for user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to blacklist all user tokens: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error; // This is critical - should fail
    }
  }

  /**
   * Remove a token from blacklist
   *
   * Rarely used - tokens expire automatically via TTL.
   * May be used for customer support scenarios.
   *
   * @param token - JWT token to whitelist
   */
  async removeFromBlacklist(token: string): Promise<void> {
    try {
      const tokenHash = this.hashToken(token);
      const key = `${this.keyPrefix}${tokenHash}`;

      await this.redis.del(key);

      this.logger.log(`Token removed from blacklist: ${tokenHash}`);
    } catch (error) {
      this.logger.error(
        `Failed to remove token from blacklist: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get blacklist statistics
   *
   * Useful for monitoring and debugging.
   *
   * @returns Statistics about blacklisted tokens
   */
  async getBlacklistStats(): Promise<{
    totalBlacklistedTokens: number;
    totalUsers: number;
  }> {
    try {
      // Scan for all blacklist keys (use cursor for large datasets)
      const tokenKeys = await this.scanKeys(`${this.keyPrefix}*`);
      const userKeys = await this.scanKeys(`${this.userTokensPrefix}*`);

      return {
        totalBlacklistedTokens: tokenKeys.length,
        totalUsers: userKeys.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get blacklist stats: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        totalBlacklistedTokens: 0,
        totalUsers: 0,
      };
    }
  }

  /**
   * Clear all blacklisted tokens (USE WITH CAUTION)
   *
   * Only for testing or emergency scenarios.
   */
  async clearAllBlacklists(): Promise<void> {
    try {
      const tokenKeys = await this.scanKeys(`${this.keyPrefix}*`);
      const userKeys = await this.scanKeys(`${this.userTokensPrefix}*`);

      if (tokenKeys.length > 0) {
        await this.redis.del(...tokenKeys);
      }

      if (userKeys.length > 0) {
        await this.redis.del(...userKeys);
      }

      this.logger.warn(
        `Cleared ${tokenKeys.length} token blacklists and ${userKeys.length} user token sets`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to clear blacklists: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Hash token for storage
   *
   * We don't store full JWTs in Redis for security.
   * SHA-256 hash provides:
   * - Security (can't reconstruct JWT from hash)
   * - Consistent key length
   * - Fast lookups
   *
   * @param token - JWT token
   * @returns SHA-256 hash of token
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Scan Redis keys with cursor (handles large datasets)
   *
   * @param pattern - Key pattern to match
   * @returns Array of matching keys
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, foundKeys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      keys.push(...foundKeys);
    } while (cursor !== '0');

    return keys;
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    await this.redis.quit();
    this.logger.log('Redis connection closed');
  }
}
