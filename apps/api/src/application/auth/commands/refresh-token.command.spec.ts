/**
 * RefreshTokenHandler Tests
 *
 * Tests token refresh command handler with comprehensive coverage of:
 * - Successful token refresh with rotation
 * - Invalid/expired refresh tokens
 * - Token type validation
 * - User validation (not found, suspended, inactive)
 * - Access and refresh token generation
 * - Error handling
 */

import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  RefreshTokenHandler,
  RefreshTokenCommand,
} from './refresh-token.command';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { User } from '../../../domain/users/user.entity';

/* eslint-disable @typescript-eslint/unbound-method */

describe('RefreshTokenHandler', () => {
  let handler: RefreshTokenHandler;
  let mockRepository: jest.Mocked<IUserRepository>;
  let mockJwtService: jest.Mocked<JwtService>;

  const validPassword = 'Test123!@#';
  const tenantId = 'tenant-123';
  const userId = 'user-123';

  beforeEach(() => {
    // Create mock repository
    mockRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByAzureObjectId: jest.fn(),
      update: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      existsByEmail: jest.fn(),
    } as jest.Mocked<IUserRepository>;

    // Create mock JWT service
    mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    // Initialize handler with mocks
    handler = new RefreshTokenHandler(mockRepository, mockJwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    describe('Successful token refresh', () => {
      it('should refresh tokens with valid refresh token', async () => {
        // Arrange
        const user = await User.create(
          {
            email: 'user@acme.com',
            password: validPassword,
            name: 'Test User',
            role: 'OPERATOR',
          },
          userId,
        );

        user.verifyEmail(user.emailVerificationCode!);

        const command = new RefreshTokenCommand(
          tenantId,
          'valid-refresh-token',
        );

        mockJwtService.verify.mockReturnValue({
          sub: userId,
          type: 'refresh',
        });
        mockRepository.findById.mockResolvedValue(user);
        mockJwtService.sign
          .mockReturnValueOnce('new-access-token')
          .mockReturnValueOnce('new-refresh-token');

        // Act
        const result = await handler.execute(command);

        // Assert
        expect(result).toBeDefined();
        expect(result.accessToken).toBe('new-access-token');
        expect(result.refreshToken).toBe('new-refresh-token');
      });

      it('should verify refresh token with JWT service', async () => {
        // Arrange
        const user = await User.create(
          {
            email: 'user@acme.com',
            password: validPassword,
            name: 'Test User',
          },
          userId,
        );

        user.verifyEmail(user.emailVerificationCode!);

        const command = new RefreshTokenCommand(
          tenantId,
          'valid-refresh-token',
        );

        mockJwtService.verify.mockReturnValue({
          sub: userId,
          type: 'refresh',
        });
        mockRepository.findById.mockResolvedValue(user);
        mockJwtService.sign.mockReturnValue('token');

        // Act
        await handler.execute(command);

        // Assert
        expect(mockJwtService.verify).toHaveBeenCalledWith(
          'valid-refresh-token',
        );
      });

      it('should generate new access token with correct payload', async () => {
        // Arrange
        const user = await User.create(
          {
            email: 'manager@acme.com',
            password: validPassword,
            name: 'Manager User',
            role: 'MANAGER',
          },
          userId,
        );

        user.verifyEmail(user.emailVerificationCode!);

        const command = new RefreshTokenCommand(tenantId, 'refresh-token');

        mockJwtService.verify.mockReturnValue({
          sub: userId,
          type: 'refresh',
        });
        mockRepository.findById.mockResolvedValue(user);
        mockJwtService.sign.mockReturnValue('token');

        // Act
        await handler.execute(command);

        // Assert - first call is for access token
        expect(mockJwtService.sign).toHaveBeenNthCalledWith(
          1,
          {
            sub: userId,
            email: 'manager@acme.com',
            role: 'MANAGER',
            tenantId: tenantId,
          },
          { expiresIn: '15m' },
        );
      });

      it('should rotate refresh token for security', async () => {
        // Arrange
        const user = await User.create(
          {
            email: 'user@acme.com',
            password: validPassword,
            name: 'Test User',
          },
          userId,
        );

        user.verifyEmail(user.emailVerificationCode!);

        const command = new RefreshTokenCommand(tenantId, 'old-refresh-token');

        mockJwtService.verify.mockReturnValue({
          sub: userId,
          type: 'refresh',
        });
        mockRepository.findById.mockResolvedValue(user);
        mockJwtService.sign.mockReturnValue('new-refresh-token');

        // Act
        await handler.execute(command);

        // Assert - second call is for new refresh token
        expect(mockJwtService.sign).toHaveBeenNthCalledWith(
          2,
          {
            sub: userId,
            type: 'refresh',
          },
          { expiresIn: '7d' },
        );
      });

      it('should return new refresh token different from old one', async () => {
        // Arrange
        const user = await User.create(
          {
            email: 'user@acme.com',
            password: validPassword,
            name: 'Test User',
          },
          userId,
        );

        user.verifyEmail(user.emailVerificationCode!);

        const oldRefreshToken = 'old-refresh-token';
        const command = new RefreshTokenCommand(tenantId, oldRefreshToken);

        mockJwtService.verify.mockReturnValue({
          sub: userId,
          type: 'refresh',
        });
        mockRepository.findById.mockResolvedValue(user);
        mockJwtService.sign
          .mockReturnValueOnce('access-token')
          .mockReturnValueOnce('new-refresh-token');

        // Act
        const result = await handler.execute(command);

        // Assert
        expect(result.refreshToken).not.toBe(oldRefreshToken);
        expect(result.refreshToken).toBe('new-refresh-token');
      });
    });

    describe('Invalid refresh tokens', () => {
      it('should throw UnauthorizedException when token is expired', async () => {
        // Arrange
        const command = new RefreshTokenCommand(tenantId, 'expired-token');

        mockJwtService.verify.mockImplementation(() => {
          throw new Error('Token expired');
        });

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(handler.execute(command)).rejects.toThrow(
          'Invalid or expired refresh token',
        );
      });

      it('should throw UnauthorizedException when token is malformed', async () => {
        // Arrange
        const command = new RefreshTokenCommand(tenantId, 'malformed-token');

        mockJwtService.verify.mockImplementation(() => {
          throw new Error('Invalid token');
        });

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(handler.execute(command)).rejects.toThrow(
          'Invalid or expired refresh token',
        );
      });

      it('should throw UnauthorizedException when token signature is invalid', async () => {
        // Arrange
        const command = new RefreshTokenCommand(
          tenantId,
          'invalid-signature-token',
        );

        mockJwtService.verify.mockImplementation(() => {
          throw new Error('Invalid signature');
        });

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'Invalid or expired refresh token',
        );
      });
    });

    describe('Token type validation', () => {
      it('should throw UnauthorizedException when token type is not refresh', async () => {
        // Arrange
        const command = new RefreshTokenCommand(tenantId, 'access-token');

        mockJwtService.verify.mockReturnValue({
          sub: userId,
          type: 'access', // Wrong type
        });

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(handler.execute(command)).rejects.toThrow(
          'Invalid token type',
        );
      });

      it('should throw UnauthorizedException when token type is missing', async () => {
        // Arrange
        const command = new RefreshTokenCommand(tenantId, 'token-without-type');

        mockJwtService.verify.mockReturnValue({
          sub: userId,
          // No type field
        });

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'Invalid token type',
        );
      });
    });

    describe('User validation', () => {
      it('should throw UnauthorizedException when user does not exist', async () => {
        // Arrange
        const command = new RefreshTokenCommand(tenantId, 'valid-token');

        mockJwtService.verify.mockReturnValue({
          sub: 'nonexistent-user-id',
          type: 'refresh',
        });
        mockRepository.findById.mockResolvedValue(null);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(handler.execute(command)).rejects.toThrow(
          'User not found',
        );
      });

      it('should throw UnauthorizedException when user is suspended', async () => {
        // Arrange
        const user = await User.create(
          {
            email: 'user@acme.com',
            password: validPassword,
            name: 'Test User',
          },
          userId,
        );

        user.verifyEmail(user.emailVerificationCode!);
        user.suspend();

        const command = new RefreshTokenCommand(tenantId, 'valid-token');

        mockJwtService.verify.mockReturnValue({
          sub: userId,
          type: 'refresh',
        });
        mockRepository.findById.mockResolvedValue(user);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(handler.execute(command)).rejects.toThrow(
          'Account suspended',
        );
      });

      it('should throw UnauthorizedException when user is not active', async () => {
        // Arrange
        const user = await User.create(
          {
            email: 'user@acme.com',
            password: validPassword,
            name: 'Test User',
          },
          userId,
        );

        // Don't verify email - user will be PENDING

        const command = new RefreshTokenCommand(tenantId, 'valid-token');

        mockJwtService.verify.mockReturnValue({
          sub: userId,
          type: 'refresh',
        });
        mockRepository.findById.mockResolvedValue(user);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(handler.execute(command)).rejects.toThrow(
          'Account not active',
        );
      });

      it('should check suspended status before active status', async () => {
        // Arrange
        const user = User.reconstitute({
          id: userId,
          email: 'user@acme.com',
          passwordHash: 'hash',
          name: 'Test User',
          role: 'OPERATOR',
          status: 'SUSPENDED',
          emailVerified: true,
          emailVerificationCode: null,
          emailVerificationExpires: null,
          passwordResetToken: null,
          passwordResetExpires: null,
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const command = new RefreshTokenCommand(tenantId, 'valid-token');

        mockJwtService.verify.mockReturnValue({
          sub: userId,
          type: 'refresh',
        });
        mockRepository.findById.mockResolvedValue(user);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'Account suspended',
        );
      });
    });

    describe('User lookup', () => {
      it('should find user by ID from token payload', async () => {
        // Arrange
        const specificUserId = 'specific-user-123';
        const user = await User.create(
          {
            email: 'user@acme.com',
            password: validPassword,
            name: 'Test User',
          },
          specificUserId,
        );

        user.verifyEmail(user.emailVerificationCode!);

        const command = new RefreshTokenCommand(tenantId, 'refresh-token');

        mockJwtService.verify.mockReturnValue({
          sub: specificUserId,
          type: 'refresh',
        });
        mockRepository.findById.mockResolvedValue(user);
        mockJwtService.sign.mockReturnValue('token');

        // Act
        await handler.execute(command);

        // Assert
        expect(mockRepository.findById).toHaveBeenCalledWith(
          tenantId,
          specificUserId,
        );
      });
    });

    describe('Error handling', () => {
      it('should propagate repository errors from findById', async () => {
        // Arrange
        const command = new RefreshTokenCommand(tenantId, 'valid-token');

        mockJwtService.verify.mockReturnValue({
          sub: userId,
          type: 'refresh',
        });
        mockRepository.findById.mockRejectedValue(
          new Error('Database connection failed'),
        );

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'Database connection failed',
        );
      });

      it('should handle JWT service exceptions gracefully', async () => {
        // Arrange
        const command = new RefreshTokenCommand(tenantId, 'token');

        mockJwtService.verify.mockImplementation(() => {
          throw new Error('JWT secret mismatch');
        });

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'Invalid or expired refresh token',
        );
      });
    });
  });
});
