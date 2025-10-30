/**
 * JWT Blacklist Guard Tests
 *
 * Tests the guard that checks if tokens are blacklisted before allowing requests.
 * Critical security feature - ensures revoked tokens cannot be used.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtBlacklistGuard } from './jwt-blacklist.guard';
import { TokenBlacklistService } from '../../infrastructure/services/token-blacklist.service';

describe('JwtBlacklistGuard', () => {
  let guard: JwtBlacklistGuard;
  let tokenBlacklistService: jest.Mocked<TokenBlacklistService>;
  let reflector: jest.Mocked<Reflector>;

  const mockTokenBlacklistService = {
    isTokenBlacklisted: jest.fn(),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtBlacklistGuard,
        {
          provide: TokenBlacklistService,
          useValue: mockTokenBlacklistService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<JwtBlacklistGuard>(JwtBlacklistGuard);
    tokenBlacklistService = module.get(TokenBlacklistService);
    reflector = module.get(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Public Routes', () => {
    it('should allow access to public routes without checking blacklist', async () => {
      // Mock public route
      reflector.getAllAndOverride.mockReturnValue(true);

      const mockContext = createMockExecutionContext({
        headers: { authorization: 'Bearer valid-token' },
      });

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(tokenBlacklistService.isTokenBlacklisted).not.toHaveBeenCalled();
    });

    it('should check metadata from both handler and class', async () => {
      reflector.getAllAndOverride.mockReturnValue(true);

      const mockContext = createMockExecutionContext({
        headers: {},
      });

      await guard.canActivate(mockContext);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        'isPublic',
        expect.any(Array),
      );
    });
  });

  describe('Protected Routes - No Token', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(false); // Not public
    });

    it('should return true when no Authorization header (let JwtAuthGuard handle)', async () => {
      const mockContext = createMockExecutionContext({
        headers: {},
      });

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(tokenBlacklistService.isTokenBlacklisted).not.toHaveBeenCalled();
    });

    it('should return true when Authorization header is malformed', async () => {
      const mockContext = createMockExecutionContext({
        headers: { authorization: 'InvalidFormat' },
      });

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(tokenBlacklistService.isTokenBlacklisted).not.toHaveBeenCalled();
    });

    it('should return true when Authorization header is not Bearer type', async () => {
      const mockContext = createMockExecutionContext({
        headers: { authorization: 'Basic dXNlcjpwYXNz' },
      });

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(tokenBlacklistService.isTokenBlacklisted).not.toHaveBeenCalled();
    });

    it('should return true when Bearer token is empty', async () => {
      const mockContext = createMockExecutionContext({
        headers: { authorization: 'Bearer ' },
      });

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(tokenBlacklistService.isTokenBlacklisted).not.toHaveBeenCalled();
    });
  });

  describe('Protected Routes - Valid Token', () => {
    const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';

    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(false); // Not public
    });

    it('should allow access when token is not blacklisted', async () => {
      tokenBlacklistService.isTokenBlacklisted.mockResolvedValue(false);

      const mockContext = createMockExecutionContext({
        headers: { authorization: `Bearer ${validToken}` },
      });

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(tokenBlacklistService.isTokenBlacklisted).toHaveBeenCalledWith(
        validToken,
      );
    });

    it('should deny access when token is blacklisted', async () => {
      tokenBlacklistService.isTokenBlacklisted.mockResolvedValue(true);

      const mockContext = createMockExecutionContext({
        headers: { authorization: `Bearer ${validToken}` },
        user: { id: 'user-123' },
      });

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        'Token has been revoked. Please log in again.',
      );

      expect(tokenBlacklistService.isTokenBlacklisted).toHaveBeenCalledWith(
        validToken,
      );
    });

    it('should extract token correctly from Authorization header', async () => {
      tokenBlacklistService.isTokenBlacklisted.mockResolvedValue(false);

      const mockContext = createMockExecutionContext({
        headers: { authorization: `Bearer ${validToken}` },
      });

      await guard.canActivate(mockContext);

      expect(tokenBlacklistService.isTokenBlacklisted).toHaveBeenCalledWith(
        validToken,
      );
    });

    it('should handle tokens with extra whitespace (treated as no token)', async () => {
      tokenBlacklistService.isTokenBlacklisted.mockResolvedValue(false);

      const mockContext = createMockExecutionContext({
        headers: { authorization: `Bearer  ${validToken}` },
      });

      const result = await guard.canActivate(mockContext);

      // Extra space after Bearer means split won't extract token correctly
      // This is expected behavior - malformed headers should be handled by JwtAuthGuard
      expect(result).toBe(true);
      expect(tokenBlacklistService.isTokenBlacklisted).not.toHaveBeenCalled();
    });
  });

  describe('Case Sensitivity', () => {
    const validToken = 'test-token';

    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(false);
    });

    it('should handle Bearer with different casing correctly', async () => {
      tokenBlacklistService.isTokenBlacklisted.mockResolvedValue(false);

      // Only "Bearer" (exact case) should be accepted
      const mockContext1 = createMockExecutionContext({
        headers: { authorization: `bearer ${validToken}` },
      });

      const result1 = await guard.canActivate(mockContext1);

      // "bearer" (lowercase) should not match - should return true (let JwtAuthGuard handle)
      expect(result1).toBe(true);
      expect(tokenBlacklistService.isTokenBlacklisted).not.toHaveBeenCalled();

      // Reset mock
      jest.clearAllMocks();
      tokenBlacklistService.isTokenBlacklisted.mockResolvedValue(false);

      // "Bearer" (correct case) should match
      const mockContext2 = createMockExecutionContext({
        headers: { authorization: `Bearer ${validToken}` },
      });

      const result2 = await guard.canActivate(mockContext2);

      expect(result2).toBe(true);
      expect(tokenBlacklistService.isTokenBlacklisted).toHaveBeenCalledWith(
        validToken,
      );
    });
  });

  describe('Authorization Header Formats', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(false);
    });

    it('should handle lowercase authorization header name', async () => {
      tokenBlacklistService.isTokenBlacklisted.mockResolvedValue(false);

      const mockContext = createMockExecutionContext({
        headers: { authorization: 'Bearer test-token' },
      });

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(tokenBlacklistService.isTokenBlacklisted).toHaveBeenCalledWith(
        'test-token',
      );
    });

    it('should handle Authorization header with capital A', async () => {
      tokenBlacklistService.isTokenBlacklisted.mockResolvedValue(false);

      const mockContext = createMockExecutionContext({
        headers: { Authorization: 'Bearer test-token' },
      });

      // Node.js/Express lowercase all header names
      // But we should handle both cases in tests
      await guard.canActivate(mockContext);

      // Should not have been called because header name doesn't match
      expect(tokenBlacklistService.isTokenBlacklisted).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    const validToken = 'test-token';

    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(false);
    });

    it('should propagate TokenBlacklistService errors', async () => {
      const error = new Error('Redis connection failed');
      tokenBlacklistService.isTokenBlacklisted.mockRejectedValue(error);

      const mockContext = createMockExecutionContext({
        headers: { authorization: `Bearer ${validToken}` },
      });

      // Should propagate the error (not catch it)
      await expect(guard.canActivate(mockContext)).rejects.toThrow(error);
    });

    it('should handle undefined user in request', async () => {
      tokenBlacklistService.isTokenBlacklisted.mockResolvedValue(true);

      const mockContext = createMockExecutionContext({
        headers: { authorization: `Bearer ${validToken}` },
        user: undefined, // No user in request
      });

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
      // Should not crash when accessing request.user?.id
    });
  });

  describe('Logging', () => {
    const validToken = 'test-token';

    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(false);
    });

    it('should log warning when blacklisted token is used', async () => {
      tokenBlacklistService.isTokenBlacklisted.mockResolvedValue(true);

      // Spy on logger
      const loggerSpy = jest.spyOn(guard['logger'], 'warn');

      const mockContext = createMockExecutionContext({
        headers: { authorization: `Bearer ${validToken}` },
        user: { id: 'user-123' },
      });

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Blacklisted token attempted access'),
      );
    });

    it('should log "unknown" when user ID is not available', async () => {
      tokenBlacklistService.isTokenBlacklisted.mockResolvedValue(true);

      const loggerSpy = jest.spyOn(guard['logger'], 'warn');

      const mockContext = createMockExecutionContext({
        headers: { authorization: `Bearer ${validToken}` },
        user: undefined,
      });

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('unknown'),
      );
    });
  });

  describe('Integration with JWT Auth Flow', () => {
    const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';

    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(false);
    });

    it('should work in sequence: JwtBlacklistGuard -> JwtAuthGuard', async () => {
      tokenBlacklistService.isTokenBlacklisted.mockResolvedValue(false);

      const mockContext = createMockExecutionContext({
        headers: { authorization: `Bearer ${validToken}` },
      });

      // Step 1: JwtBlacklistGuard checks blacklist
      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true); // Allow to proceed
      expect(tokenBlacklistService.isTokenBlacklisted).toHaveBeenCalledWith(
        validToken,
      );

      // Step 2: JwtAuthGuard would then validate JWT (not tested here)
    });

    it('should block blacklisted token before JwtAuthGuard sees it', async () => {
      tokenBlacklistService.isTokenBlacklisted.mockResolvedValue(true);

      const mockContext = createMockExecutionContext({
        headers: { authorization: `Bearer ${validToken}` },
        user: { id: 'user-123' },
      });

      // JwtBlacklistGuard should reject immediately
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );

      // JwtAuthGuard would never be reached
    });
  });

  describe('Real-World Scenarios', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(false);
    });

    it('should handle logout scenario', async () => {
      const token = 'logged-out-token';

      // Token was blacklisted during logout
      tokenBlacklistService.isTokenBlacklisted.mockResolvedValue(true);

      const mockContext = createMockExecutionContext({
        headers: { authorization: `Bearer ${token}` },
        user: { id: 'user-123' },
      });

      // Should deny access
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle password change scenario', async () => {
      const oldToken = 'token-before-password-change';

      // All user tokens were blacklisted after password change
      tokenBlacklistService.isTokenBlacklisted.mockResolvedValue(true);

      const mockContext = createMockExecutionContext({
        headers: { authorization: `Bearer ${oldToken}` },
        user: { id: 'user-123' },
      });

      // Should deny access with old token
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle account suspension scenario', async () => {
      const suspendedUserToken = 'suspended-user-token';

      // Token was blacklisted when account was suspended
      tokenBlacklistService.isTokenBlacklisted.mockResolvedValue(true);

      const mockContext = createMockExecutionContext({
        headers: { authorization: `Bearer ${suspendedUserToken}` },
        user: { id: 'suspended-user' },
      });

      // Should deny access
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should allow fresh token after password reset', async () => {
      const newToken = 'token-after-password-reset';

      // New token is not blacklisted
      tokenBlacklistService.isTokenBlacklisted.mockResolvedValue(false);

      const mockContext = createMockExecutionContext({
        headers: { authorization: `Bearer ${newToken}` },
        user: { id: 'user-123' },
      });

      // Should allow access with new token
      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });
  });
});

/**
 * Helper function to create mock ExecutionContext
 */
function createMockExecutionContext(requestData: any): ExecutionContext {
  const mockRequest = {
    headers: requestData.headers || {},
    user: requestData.user,
  };

  return {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
      getResponse: () => ({}),
      getNext: () => jest.fn(),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
    getArgs: () => [],
    getArgByIndex: () => ({}),
    switchToRpc: () => ({
      getContext: () => ({}),
      getData: () => ({}),
    }),
    switchToWs: () => ({
      getClient: () => ({}),
      getData: () => ({}),
    }),
    getType: () => 'http' as any,
  } as unknown as ExecutionContext;
}
