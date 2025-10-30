/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * LoginHandler Tests
 *
 * Tests login command handler with comprehensive coverage of:
 * - Successful login with JWT token generation
 * - Invalid credentials (user not found, wrong password)
 * - Account status validation (suspended, unverified)
 * - Last login timestamp update
 * - Token payload structure
 * - Error handling
 */

import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginHandler, LoginCommand } from './login.command';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { User } from '../../../domain/users/user.entity';

/* eslint-disable @typescript-eslint/unbound-method */

describe('LoginHandler', () => {
  let handler: LoginHandler;
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockTenantRepository: jest.Mocked<any>;
  let mockJwtService: jest.Mocked<JwtService>;

  const validPassword = 'Test123!@#';
  const tenantId = 'tenant-123';

  beforeEach(() => {
    // Create mock user repository
    mockUserRepository = {
      findByEmail: jest.fn(),
      findByAzureObjectId: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      existsByEmail: jest.fn(),
    } as jest.Mocked<IUserRepository>;

    // Create mock tenant repository
    mockTenantRepository = {
      findById: jest.fn(),
      findBySlug: jest.fn(),
      findBySubdomain: jest.fn(),
      findByTenantId: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      slugExists: jest.fn(),
      subdomainExists: jest.fn(),
      countByStatus: jest.fn(),
      findExpiredTrials: jest.fn(),
    };

    // Create mock JWT service
    mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    // Initialize handler with mocks
    handler = new LoginHandler(
      mockUserRepository,
      mockTenantRepository,
      mockJwtService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    describe('Successful login', () => {
      it('should login user with valid credentials and return tokens', async () => {
        // Arrange
        const user = await User.create({
          email: 'admin@acme.com',
          password: validPassword,
          name: 'Admin User',
          role: 'ADMIN',
        });

        // Auto-verify admin user
        user.verifyEmail(user.emailVerificationCode!);

        const command = new LoginCommand(
          tenantId,
          'admin@acme.com',
          validPassword,
        );

        mockUserRepository.findByEmail.mockResolvedValue(user);
        mockUserRepository.update.mockResolvedValue(undefined);
        mockJwtService.sign
          .mockReturnValueOnce('mock-access-token')
          .mockReturnValueOnce('mock-refresh-token');

        // Act
        const result = await handler.execute(command);

        // Assert
        expect(result).toBeDefined();
        expect(result.accessToken).toBe('mock-access-token');
        expect(result.refreshToken).toBe('mock-refresh-token');
        expect(result.user).toEqual({
          id: user.id,
          email: 'admin@acme.com',
          name: 'Admin User',
          role: 'ADMIN',
        });
      });

      it('should generate access token with correct payload and expiry', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
          role: 'OPERATOR',
        });

        user.verifyEmail(user.emailVerificationCode!);

        const command = new LoginCommand(
          tenantId,
          'user@acme.com',
          validPassword,
        );

        mockUserRepository.findByEmail.mockResolvedValue(user);
        mockUserRepository.update.mockResolvedValue(undefined);
        mockJwtService.sign.mockReturnValue('token');

        // Act
        await handler.execute(command);

        // Assert - first call is for access token
        expect(mockJwtService.sign).toHaveBeenNthCalledWith(
          1,
          {
            sub: user.id,
            email: 'user@acme.com',
            role: 'OPERATOR',
            tenantId: tenantId,
          },
          { expiresIn: '15m' },
        );
      });

      it('should generate refresh token with correct payload and expiry', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        user.verifyEmail(user.emailVerificationCode!);

        const command = new LoginCommand(
          tenantId,
          'user@acme.com',
          validPassword,
        );

        mockUserRepository.findByEmail.mockResolvedValue(user);
        mockUserRepository.update.mockResolvedValue(undefined);
        mockJwtService.sign.mockReturnValue('token');

        // Act
        await handler.execute(command);

        // Assert - second call is for refresh token
        expect(mockJwtService.sign).toHaveBeenNthCalledWith(
          2,
          {
            sub: user.id,
            type: 'refresh',
          },
          { expiresIn: '7d' },
        );
      });

      it('should update last login timestamp', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        user.verifyEmail(user.emailVerificationCode!);

        const beforeLogin = user.lastLoginAt;

        const command = new LoginCommand(
          tenantId,
          'user@acme.com',
          validPassword,
        );

        mockUserRepository.findByEmail.mockResolvedValue(user);
        mockUserRepository.update.mockResolvedValue(undefined);
        mockJwtService.sign.mockReturnValue('token');

        // Act
        await handler.execute(command);

        // Assert
        expect(user.lastLoginAt).not.toBe(beforeLogin);
        expect(user.lastLoginAt).toBeInstanceOf(Date);
        expect(mockUserRepository.update).toHaveBeenCalledWith(
          tenantId,
          user,
          undefined,
        );
      });

      it('should pass databaseName to repository methods when provided', async () => {
        // Arrange
        const databaseName = 'custom_db';
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        user.verifyEmail(user.emailVerificationCode!);

        const command = new LoginCommand(
          tenantId,
          'user@acme.com',
          validPassword,
          databaseName,
        );

        mockUserRepository.findByEmail.mockResolvedValue(user);
        mockUserRepository.update.mockResolvedValue(undefined);
        mockJwtService.sign.mockReturnValue('token');

        // Act
        await handler.execute(command);

        // Assert
        expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(
          tenantId,
          'user@acme.com',
          databaseName,
        );
        expect(mockUserRepository.update).toHaveBeenCalledWith(
          tenantId,
          user,
          databaseName,
        );
      });
    });

    describe('Invalid credentials', () => {
      it('should throw UnauthorizedException when user does not exist', async () => {
        // Arrange
        const command = new LoginCommand(
          tenantId,
          'nonexistent@acme.com',
          validPassword,
        );

        mockUserRepository.findByEmail.mockResolvedValue(null);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(handler.execute(command)).rejects.toThrow(
          'Invalid credentials',
        );

        // Verify no tokens were generated
        expect(mockJwtService.sign).not.toHaveBeenCalled();
        expect(mockUserRepository.update).not.toHaveBeenCalled();
      });

      it('should throw UnauthorizedException when password is incorrect', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        user.verifyEmail(user.emailVerificationCode!);

        const command = new LoginCommand(
          tenantId,
          'user@acme.com',
          'WrongPassword123!',
        );

        mockUserRepository.findByEmail.mockResolvedValue(user);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(handler.execute(command)).rejects.toThrow(
          'Invalid credentials',
        );

        // Verify no tokens were generated
        expect(mockJwtService.sign).not.toHaveBeenCalled();
      });

      it('should not reveal whether user exists when credentials are invalid', async () => {
        // Arrange - user doesn't exist
        const command1 = new LoginCommand(
          tenantId,
          'nonexistent@acme.com',
          validPassword,
        );
        mockUserRepository.findByEmail.mockResolvedValue(null);

        // Act & Assert
        const error1 = handler.execute(command1);
        await expect(error1).rejects.toThrow('Invalid credentials');

        // Arrange - user exists but wrong password
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });
        user.verifyEmail(user.emailVerificationCode!);

        const command2 = new LoginCommand(
          tenantId,
          'user@acme.com',
          'WrongPassword123!',
        );
        mockUserRepository.findByEmail.mockResolvedValue(user);

        // Act & Assert - same error message
        const error2 = handler.execute(command2);
        await expect(error2).rejects.toThrow('Invalid credentials');
      });
    });

    describe('Account status validation', () => {
      it('should throw UnauthorizedException when account is suspended', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        user.verifyEmail(user.emailVerificationCode!);
        user.suspend(); // Suspend the account

        const command = new LoginCommand(
          tenantId,
          'user@acme.com',
          validPassword,
        );

        mockUserRepository.findByEmail.mockResolvedValue(user);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(handler.execute(command)).rejects.toThrow(
          'Account suspended',
        );

        // Verify no tokens were generated
        expect(mockJwtService.sign).not.toHaveBeenCalled();
      });

      it('should throw UnauthorizedException when email is not verified', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        // Don't verify email

        const command = new LoginCommand(
          tenantId,
          'user@acme.com',
          validPassword,
        );

        mockUserRepository.findByEmail.mockResolvedValue(user);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(handler.execute(command)).rejects.toThrow(
          'Email not verified',
        );

        // Verify no tokens were generated
        expect(mockJwtService.sign).not.toHaveBeenCalled();
      });

      it('should check suspension before verifying password', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        user.verifyEmail(user.emailVerificationCode!);
        user.suspend();

        const command = new LoginCommand(
          tenantId,
          'user@acme.com',
          'WrongPassword123!', // Wrong password
        );

        mockUserRepository.findByEmail.mockResolvedValue(user);

        // Act & Assert - should fail on suspension, not password
        await expect(handler.execute(command)).rejects.toThrow(
          'Account suspended',
        );
      });

      it('should check email verification after password validation', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        // Don't verify email

        const command = new LoginCommand(
          tenantId,
          'user@acme.com',
          validPassword,
        );

        mockUserRepository.findByEmail.mockResolvedValue(user);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'Email not verified',
        );
      });
    });

    describe('Token generation', () => {
      it('should include all required fields in access token payload', async () => {
        // Arrange
        const user = await User.create({
          email: 'manager@acme.com',
          password: validPassword,
          name: 'Manager User',
          role: 'MANAGER',
        });

        user.verifyEmail(user.emailVerificationCode!);

        const command = new LoginCommand(
          tenantId,
          'manager@acme.com',
          validPassword,
        );

        mockUserRepository.findByEmail.mockResolvedValue(user);
        mockUserRepository.update.mockResolvedValue(undefined);
        mockJwtService.sign.mockReturnValue('token');

        // Act
        await handler.execute(command);

        // Assert
        const accessTokenCall = mockJwtService.sign.mock.calls[0];
        expect(accessTokenCall[0]).toHaveProperty('sub', user.id);
        expect(accessTokenCall[0]).toHaveProperty('email', 'manager@acme.com');
        expect(accessTokenCall[0]).toHaveProperty('role', 'MANAGER');
        expect(accessTokenCall[0]).toHaveProperty('tenantId', tenantId);
      });

      it('should include type field in refresh token payload', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        user.verifyEmail(user.emailVerificationCode!);

        const command = new LoginCommand(
          tenantId,
          'user@acme.com',
          validPassword,
        );

        mockUserRepository.findByEmail.mockResolvedValue(user);
        mockUserRepository.update.mockResolvedValue(undefined);
        mockJwtService.sign.mockReturnValue('token');

        // Act
        await handler.execute(command);

        // Assert
        const refreshTokenCall = mockJwtService.sign.mock.calls[1];
        expect(refreshTokenCall[0]).toHaveProperty('sub', user.id);
        expect(refreshTokenCall[0]).toHaveProperty('type', 'refresh');
      });
    });

    describe('Error handling', () => {
      it('should propagate repository errors from findByEmail', async () => {
        // Arrange
        const command = new LoginCommand(
          tenantId,
          'user@acme.com',
          validPassword,
        );

        mockUserRepository.findByEmail.mockRejectedValue(
          new Error('Database connection failed'),
        );

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'Database connection failed',
        );
      });

      it('should propagate repository errors from update', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        user.verifyEmail(user.emailVerificationCode!);

        const command = new LoginCommand(
          tenantId,
          'user@acme.com',
          validPassword,
        );

        mockUserRepository.findByEmail.mockResolvedValue(user);
        mockJwtService.sign.mockReturnValue('token');
        mockUserRepository.update.mockRejectedValue(new Error('Update failed'));

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow('Update failed');
      });
    });
  });
});
