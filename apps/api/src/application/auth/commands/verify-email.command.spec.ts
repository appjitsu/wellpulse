/**
 * VerifyEmailHandler Tests
 *
 * Tests email verification command handler with comprehensive coverage of:
 * - Successful email verification
 * - User not found scenarios
 * - Already verified users
 * - Invalid verification codes
 * - Expired verification codes
 * - Account activation after verification
 */

import { NotFoundException } from '@nestjs/common';
import { VerifyEmailHandler, VerifyEmailCommand } from './verify-email.command';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { User } from '../../../domain/users/user.entity';

/* eslint-disable @typescript-eslint/unbound-method */

describe('VerifyEmailHandler', () => {
  let handler: VerifyEmailHandler;
  let mockRepository: jest.Mocked<IUserRepository>;

  const validPassword = 'Test123!@#';
  const tenantId = 'tenant-123';

  beforeEach(() => {
    // Create mock repository
    mockRepository = {
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

    // Initialize handler with mocks
    handler = new VerifyEmailHandler(mockRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    describe('Successful verification', () => {
      it('should verify email with valid code and activate account', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
          role: 'OPERATOR',
        });

        const verificationCode = user.emailVerificationCode!;

        const command = new VerifyEmailCommand(
          tenantId,
          'user@acme.com',
          verificationCode,
        );

        mockRepository.findByEmail.mockResolvedValue(user);
        mockRepository.update.mockResolvedValue(undefined);

        // Act
        await handler.execute(command);

        // Assert
        expect(mockRepository.findByEmail).toHaveBeenCalledWith(
          tenantId,
          'user@acme.com',
        );
        expect(mockRepository.update).toHaveBeenCalledWith(tenantId, user);

        // Verify user state after verification
        expect(user.emailVerified).toBe(true);
        expect(user.status).toBe('ACTIVE');
        expect(user.emailVerificationCode).toBeNull();
        expect(user.emailVerificationExpires).toBeNull();
      });

      it('should update user in repository after verification', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        const command = new VerifyEmailCommand(
          tenantId,
          'user@acme.com',
          user.emailVerificationCode!,
        );

        mockRepository.findByEmail.mockResolvedValue(user);
        mockRepository.update.mockResolvedValue(undefined);

        // Act
        await handler.execute(command);

        // Assert
        expect(mockRepository.update).toHaveBeenCalledTimes(1);
        expect(mockRepository.update).toHaveBeenCalledWith(tenantId, user);
      });
    });

    describe('Already verified users', () => {
      it('should silently succeed when user is already verified', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
          role: 'ADMIN',
        });

        // Manually verify user
        user.verifyEmail(user.emailVerificationCode!);

        const command = new VerifyEmailCommand(
          tenantId,
          'user@acme.com',
          '123456', // Any code - should be ignored
        );

        mockRepository.findByEmail.mockResolvedValue(user);

        // Act
        await handler.execute(command);

        // Assert - should NOT throw and NOT update repository
        expect(mockRepository.update).not.toHaveBeenCalled();
      });

      it('should not change user state when already verified', async () => {
        // Arrange
        const user = await User.create({
          email: 'admin@acme.com',
          password: validPassword,
          name: 'Admin User',
          role: 'ADMIN',
        });

        user.verifyEmail(user.emailVerificationCode!);

        const originalStatus = user.status;
        const originalVerified = user.emailVerified;

        const command = new VerifyEmailCommand(
          tenantId,
          'admin@acme.com',
          '000000',
        );

        mockRepository.findByEmail.mockResolvedValue(user);

        // Act
        await handler.execute(command);

        // Assert
        expect(user.status).toBe(originalStatus);
        expect(user.emailVerified).toBe(originalVerified);
      });
    });

    describe('User not found', () => {
      it('should throw NotFoundException when user does not exist', async () => {
        // Arrange
        const command = new VerifyEmailCommand(
          tenantId,
          'nonexistent@acme.com',
          '123456',
        );

        mockRepository.findByEmail.mockResolvedValue(null);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          NotFoundException,
        );
        await expect(handler.execute(command)).rejects.toThrow(
          'User not found',
        );

        // Verify update was not called
        expect(mockRepository.update).not.toHaveBeenCalled();
      });
    });

    describe('Invalid verification codes', () => {
      it('should throw error when verification code does not match', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        const command = new VerifyEmailCommand(
          tenantId,
          'user@acme.com',
          '999999', // Wrong code
        );

        mockRepository.findByEmail.mockResolvedValue(user);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'Invalid verification code',
        );

        // Verify user was not updated
        expect(mockRepository.update).not.toHaveBeenCalled();
      });

      it('should throw error when verification code is empty', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        const command = new VerifyEmailCommand(tenantId, 'user@acme.com', '');

        mockRepository.findByEmail.mockResolvedValue(user);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'Invalid verification code',
        );
      });

      it('should throw error when verification code has wrong format', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        const command = new VerifyEmailCommand(
          tenantId,
          'user@acme.com',
          'ABCDEF', // Non-numeric
        );

        mockRepository.findByEmail.mockResolvedValue(user);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'Invalid verification code',
        );
      });
    });

    describe('Expired verification codes', () => {
      it('should throw error when verification code has expired', async () => {
        // Arrange
        const user = User.reconstitute({
          id: 'user-123',
          email: 'user@acme.com',
          passwordHash: 'hashed',
          name: 'Test User',
          role: 'OPERATOR',
          status: 'PENDING',
          emailVerified: false,
          emailVerificationCode: '123456',
          emailVerificationExpires: new Date(Date.now() - 1000), // Expired 1 second ago
          passwordResetToken: null,
          passwordResetExpires: null,
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const command = new VerifyEmailCommand(
          tenantId,
          'user@acme.com',
          '123456',
        );

        mockRepository.findByEmail.mockResolvedValue(user);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'Verification code has expired',
        );

        // Verify user was not updated
        expect(mockRepository.update).not.toHaveBeenCalled();
      });

      it('should accept verification code that has not yet expired', async () => {
        // Arrange
        const user = User.reconstitute({
          id: 'user-123',
          email: 'user@acme.com',
          passwordHash: 'hashed',
          name: 'Test User',
          role: 'OPERATOR',
          status: 'PENDING',
          emailVerified: false,
          emailVerificationCode: '123456',
          emailVerificationExpires: new Date(Date.now() + 60000), // Expires in 1 minute
          passwordResetToken: null,
          passwordResetExpires: null,
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const command = new VerifyEmailCommand(
          tenantId,
          'user@acme.com',
          '123456',
        );

        mockRepository.findByEmail.mockResolvedValue(user);
        mockRepository.update.mockResolvedValue(undefined);

        // Act & Assert
        await expect(handler.execute(command)).resolves.toBeUndefined();
        expect(mockRepository.update).toHaveBeenCalled();
      });
    });

    describe('Error handling', () => {
      it('should propagate repository errors from findByEmail', async () => {
        // Arrange
        const command = new VerifyEmailCommand(
          tenantId,
          'user@acme.com',
          '123456',
        );

        mockRepository.findByEmail.mockRejectedValue(
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

        const command = new VerifyEmailCommand(
          tenantId,
          'user@acme.com',
          user.emailVerificationCode!,
        );

        mockRepository.findByEmail.mockResolvedValue(user);
        mockRepository.update.mockRejectedValue(new Error('Update failed'));

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow('Update failed');
      });
    });
  });
});
