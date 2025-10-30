/**
 * Token Blacklist Service Tests
 *
 * Tests Redis-based JWT token invalidation functionality.
 * Critical for security - ensures logout, password changes, and account suspension work correctly.
 */

/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TokenBlacklistService } from './token-blacklist.service';
import Redis from 'ioredis';

// Mock ioredis
jest.mock('ioredis');

describe('TokenBlacklistService', () => {
  let service: TokenBlacklistService;
  let mockRedis: jest.Mocked<Redis>;

  const mockConfigService = {
    get: jest.fn(<T = string>(key: string, defaultValue?: T): T | undefined => {
      const config: Record<string, string | number> = {
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_PASSWORD: 'test-password',
      };
      return (config[key] as T) || defaultValue;
    }),
  };

  beforeEach(async () => {
    // Reset the mock before each test
    jest.clearAllMocks();

    // Create mock Redis instance
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    mockRedis = {
      setex: jest.fn(),
      exists: jest.fn(),
      sadd: jest.fn(),
      expire: jest.fn(),
      smembers: jest.fn(),

      pipeline: jest.fn(() => ({
        setex: jest.fn().mockReturnThis(),
        exec: jest.fn(),
      })) as any,

      del: jest.fn(),
      scan: jest.fn(),
      quit: jest.fn(),
      on: jest.fn(),
    } as unknown as jest.Mocked<Redis>;
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */

    // Mock the Redis constructor
    (Redis as unknown as jest.Mock).mockImplementation(() => mockRedis);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenBlacklistService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TokenBlacklistService>(TokenBlacklistService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Redis Connection', () => {
    it('should initialize Redis connection with config values', () => {
      expect(Redis).toHaveBeenCalledWith({
        host: 'localhost',
        port: 6379,
        password: 'test-password',
        retryStrategy: expect.any(Function),
      });
    });

    it('should register error and connect event handlers', () => {
      expect(mockRedis.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith(
        'connect',
        expect.any(Function),
      );
    });
  });

  describe('blacklistToken', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
    const userId = 'user-123';
    const ttlSeconds = 3600;

    it('should blacklist a token with default TTL', async () => {
      await service.blacklistToken(token, userId);

      // Should store token hash with 24 hour default TTL
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('blacklist:token:'),
        86400, // 24 hours
        expect.stringContaining(userId),
      );

      // Should add to user token set
      expect(mockRedis.sadd).toHaveBeenCalledWith(
        `blacklist:user:${userId}`,
        expect.any(String),
      );

      // Should set expiry on user token set
      expect(mockRedis.expire).toHaveBeenCalledWith(
        `blacklist:user:${userId}`,
        86400,
      );
    });

    it('should blacklist a token with custom TTL', async () => {
      await service.blacklistToken(token, userId, ttlSeconds);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('blacklist:token:'),
        ttlSeconds,
        expect.stringContaining(userId),
      );

      expect(mockRedis.expire).toHaveBeenCalledWith(
        `blacklist:user:${userId}`,
        ttlSeconds,
      );
    });

    it('should store token metadata correctly', async () => {
      await service.blacklistToken(token, userId, ttlSeconds);

      const setexCall = (mockRedis.setex as jest.Mock).mock.calls[0];
      const storedData = JSON.parse(setexCall[2]);

      expect(storedData).toHaveProperty('userId', userId);
      expect(storedData).toHaveProperty('blacklistedAt');
      expect(storedData).toHaveProperty('expiresAt');
      expect(new Date(storedData.blacklistedAt)).toBeInstanceOf(Date);
      expect(new Date(storedData.expiresAt)).toBeInstanceOf(Date);
    });

    it('should hash token before storing', async () => {
      await service.blacklistToken(token, userId);

      const setexCall = (mockRedis.setex as jest.Mock).mock.calls[0];
      const key = setexCall[0];

      // Key should not contain the actual token
      expect(key).not.toContain(token);
      // Key should be a hash (64 hex characters for SHA-256)
      expect(key).toMatch(/^blacklist:token:[a-f0-9]{64}$/);
    });

    it('should handle Redis errors gracefully (fail-open)', async () => {
      (mockRedis.setex as jest.Mock).mockRejectedValue(
        new Error('Redis connection failed'),
      );

      // Should not throw error - blacklist failures shouldn't break logout
      await expect(
        service.blacklistToken(token, userId),
      ).resolves.toBeUndefined();
    });
  });

  describe('isTokenBlacklisted', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';

    it('should return true if token is blacklisted', async () => {
      (mockRedis.exists as jest.Mock).mockResolvedValue(1);

      const result = await service.isTokenBlacklisted(token);

      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith(
        expect.stringContaining('blacklist:token:'),
      );
    });

    it('should return false if token is not blacklisted', async () => {
      (mockRedis.exists as jest.Mock).mockResolvedValue(0);

      const result = await service.isTokenBlacklisted(token);

      expect(result).toBe(false);
    });

    it('should use token hash for lookup', async () => {
      (mockRedis.exists as jest.Mock).mockResolvedValue(0);

      await service.isTokenBlacklisted(token);

      const existsCall = (mockRedis.exists as jest.Mock).mock.calls[0];
      const key = existsCall[0];

      // Key should not contain the actual token
      expect(key).not.toContain(token);
      // Key should be a hash
      expect(key).toMatch(/^blacklist:token:[a-f0-9]{64}$/);
    });

    it('should handle Redis errors gracefully (fail-open)', async () => {
      (mockRedis.exists as jest.Mock).mockRejectedValue(
        new Error('Redis connection failed'),
      );

      // Should return false (fail-open for availability)
      const result = await service.isTokenBlacklisted(token);

      expect(result).toBe(false);
    });
  });

  describe('blacklistAllUserTokens', () => {
    const userId = 'user-123';
    const tokenHashes = [
      'hash1'.padEnd(64, '0'),
      'hash2'.padEnd(64, '0'),
      'hash3'.padEnd(64, '0'),
    ];
    const ttlSeconds = 3600;

    beforeEach(() => {
      (mockRedis.smembers as jest.Mock).mockResolvedValue(tokenHashes);
    });

    it('should blacklist all tokens for a user', async () => {
      const mockPipeline = {
        setex: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      (mockRedis.pipeline as jest.Mock).mockReturnValue(mockPipeline);

      await service.blacklistAllUserTokens(userId, ttlSeconds);

      // Should retrieve user token set
      expect(mockRedis.smembers).toHaveBeenCalledWith(
        `blacklist:user:${userId}`,
      );

      // Should create pipeline
      expect(mockRedis.pipeline).toHaveBeenCalled();

      // Should add all tokens to pipeline
      expect(mockPipeline.setex).toHaveBeenCalledTimes(tokenHashes.length);

      // Should execute pipeline
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should include bulk_revocation reason', async () => {
      const mockPipeline = {
        setex: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      (mockRedis.pipeline as jest.Mock).mockReturnValue(mockPipeline);

      await service.blacklistAllUserTokens(userId, ttlSeconds);

      const setexCalls = mockPipeline.setex.mock.calls;
      setexCalls.forEach((call: any[]) => {
        const data = JSON.parse(call[2]);
        expect(data).toHaveProperty('reason', 'bulk_revocation');
        expect(data).toHaveProperty('userId', userId);
      });
    });

    it('should handle empty user token set', async () => {
      (mockRedis.smembers as jest.Mock).mockResolvedValue([]);

      // Should not throw error
      await expect(
        service.blacklistAllUserTokens(userId),
      ).resolves.toBeUndefined();

      // Should not create pipeline
      expect(mockRedis.pipeline).not.toHaveBeenCalled();
    });

    it('should throw error on failure (fail-closed)', async () => {
      (mockRedis.smembers as jest.Mock).mockRejectedValue(
        new Error('Redis connection failed'),
      );

      // This is critical - should fail (unlike individual blacklist)
      await expect(service.blacklistAllUserTokens(userId)).rejects.toThrow(
        'Redis connection failed',
      );
    });
  });

  describe('removeFromBlacklist', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';

    it('should remove token from blacklist', async () => {
      await service.removeFromBlacklist(token);

      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining('blacklist:token:'),
      );
    });

    it('should use token hash for removal', async () => {
      await service.removeFromBlacklist(token);

      const delCall = (mockRedis.del as jest.Mock).mock.calls[0];
      const key = delCall[0];

      // Key should be a hash
      expect(key).toMatch(/^blacklist:token:[a-f0-9]{64}$/);
    });

    it('should handle Redis errors gracefully', async () => {
      (mockRedis.del as jest.Mock).mockRejectedValue(
        new Error('Redis connection failed'),
      );

      // Should not throw error
      await expect(service.removeFromBlacklist(token)).resolves.toBeUndefined();
    });
  });

  describe('getBlacklistStats', () => {
    it('should return blacklist statistics', async () => {
      const tokenKeys = ['key1', 'key2', 'key3'];
      const userKeys = ['user1', 'user2'];

      (mockRedis.scan as jest.Mock)
        .mockResolvedValueOnce(['0', tokenKeys])
        .mockResolvedValueOnce(['0', userKeys]);

      const stats = await service.getBlacklistStats();

      expect(stats).toEqual({
        totalBlacklistedTokens: tokenKeys.length,
        totalUsers: userKeys.length,
      });
    });

    it('should handle scan pagination', async () => {
      // First scan returns cursor '5', second scan returns cursor '0' (done)
      (mockRedis.scan as jest.Mock)
        .mockResolvedValueOnce(['5', ['key1', 'key2']])
        .mockResolvedValueOnce(['0', ['key3']])
        .mockResolvedValueOnce(['0', ['user1']]);

      const stats = await service.getBlacklistStats();

      expect(stats.totalBlacklistedTokens).toBe(3);
      expect(stats.totalUsers).toBe(1);
    });

    it('should return zeros on error', async () => {
      (mockRedis.scan as jest.Mock).mockRejectedValue(
        new Error('Redis connection failed'),
      );

      const stats = await service.getBlacklistStats();

      expect(stats).toEqual({
        totalBlacklistedTokens: 0,
        totalUsers: 0,
      });
    });
  });

  describe('clearAllBlacklists', () => {
    it('should clear all blacklisted tokens', async () => {
      const tokenKeys = ['key1', 'key2'];
      const userKeys = ['user1'];

      (mockRedis.scan as jest.Mock)
        .mockResolvedValueOnce(['0', tokenKeys])
        .mockResolvedValueOnce(['0', userKeys]);

      await service.clearAllBlacklists();

      expect(mockRedis.del).toHaveBeenCalledWith(...tokenKeys);
      expect(mockRedis.del).toHaveBeenCalledWith(...userKeys);
    });

    it('should handle empty blacklists', async () => {
      (mockRedis.scan as jest.Mock)
        .mockResolvedValueOnce(['0', []])
        .mockResolvedValueOnce(['0', []]);

      await service.clearAllBlacklists();

      // Should not call del if no keys
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (mockRedis.scan as jest.Mock).mockRejectedValue(
        new Error('Redis connection failed'),
      );

      // Should not throw error
      await expect(service.clearAllBlacklists()).resolves.toBeUndefined();
    });
  });

  describe('onModuleDestroy', () => {
    it('should close Redis connection', async () => {
      await service.onModuleDestroy();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });

  describe('Token Hashing', () => {
    it('should produce consistent hashes for same token', async () => {
      const token = 'test-token-123';

      await service.blacklistToken(token, 'user-1');
      const blacklistCall1 = (mockRedis.setex as jest.Mock).mock.calls[0];

      await service.blacklistToken(token, 'user-2');
      const blacklistCall2 = (mockRedis.setex as jest.Mock).mock.calls[1];

      // Both should use the same hash
      expect(blacklistCall1[0]).toBe(blacklistCall2[0]);
    });

    it('should produce different hashes for different tokens', async () => {
      await service.blacklistToken('token-1', 'user-1');
      const blacklistCall1 = (mockRedis.setex as jest.Mock).mock.calls[0];

      await service.blacklistToken('token-2', 'user-1');
      const blacklistCall2 = (mockRedis.setex as jest.Mock).mock.calls[1];

      // Should use different hashes
      expect(blacklistCall1[0]).not.toBe(blacklistCall2[0]);
    });
  });

  describe('Security', () => {
    it('should never store full JWT token in Redis', async () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';

      await service.blacklistToken(token, 'user-1');

      const setexCall = (mockRedis.setex as jest.Mock).mock.calls[0];
      const key = setexCall[0];
      const data = setexCall[2];

      // Neither key nor data should contain the actual token
      expect(key).not.toContain(token);
      expect(data).not.toContain(token);
    });

    it('should use SHA-256 for token hashing (64 hex chars)', async () => {
      await service.blacklistToken('test-token', 'user-1');

      const setexCall = (mockRedis.setex as jest.Mock).mock.calls[0];
      const key = setexCall[0];

      // SHA-256 produces 64 hexadecimal characters
      const hash = key.replace('blacklist:token:', '');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('TTL Management', () => {
    it('should calculate correct expiration timestamp', async () => {
      const ttlSeconds = 3600;
      const beforeTime = Date.now();

      await service.blacklistToken('token', 'user-1', ttlSeconds);

      const afterTime = Date.now();
      const setexCall = (mockRedis.setex as jest.Mock).mock.calls[0];
      const data = JSON.parse(setexCall[2]);
      const expiresAt = new Date(data.expiresAt).getTime();

      // Should expire approximately 1 hour from now
      const expectedExpiry = beforeTime + ttlSeconds * 1000;
      expect(expiresAt).toBeGreaterThanOrEqual(expectedExpiry);
      expect(expiresAt).toBeLessThanOrEqual(afterTime + ttlSeconds * 1000);
    });
  });
});
