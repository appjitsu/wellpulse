/**
 * ResetPasswordHandler Tests
 *
 * Tests password reset command handler with comprehensive coverage of:
 * - Successful password reset with valid token
 * - Token validation (invalid, expired)
 * - Password strength validation
 * - Token clearing after reset
 * - User lookup by reset token
 * - Error handling
 */

import { NotFoundException } from '@nestjs/common';
import {
  ResetPasswordHandler,
  ResetPasswordCommand,
} from './reset-password.command';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { User } from '../../../domain/users/user.entity';

/* eslint-disable @typescript-eslint/unbound-method */

describe('ResetPasswordHandler', () => {
  let handler: ResetPasswordHandler;
  let mockRepository: jest.Mocked<IUserRepository>;

  const validPassword = 'Test123!@#';
  const newValidPassword = 'NewPass123!@#';
  const tenantId = 'tenant-123';

  beforeEach(() => {
    // Create mock repository
    mockRepository = {
      findAll: jest.fn(),
      update: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      existsByEmail: jest.fn(),
    } as jest.Mocked<IUserRepository>;

    // Initialize handler with mocks
    handler = new ResetPasswordHandler(mockRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    describe('Successful password reset', () => {
      it('should reset password with valid token', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        const resetToken = user.generatePasswordResetToken();

        const command = new ResetPasswordCommand(
          tenantId,
          resetToken,
          newValidPassword,
        );

        mockRepository.findAll.mockResolvedValue([user]);
        mockRepository.update.mockResolvedValue(undefined);

        // Act
        await handler.execute(command);

        // Assert
        expect(mockRepository.findAll).toHaveBeenCalledWith(tenantId);
        expect(mockRepository.update).toHaveBeenCalledWith(tenantId, user);
      });

      it('should clear reset token after successful password reset', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        const resetToken = user.generatePasswordResetToken();

        const command = new ResetPasswordCommand(
          tenantId,
          resetToken,
          newValidPassword,
        );

        mockRepository.findAll.mockResolvedValue([user]);
        mockRepository.update.mockResolvedValue(undefined);

        // Act
        await handler.execute(command);

        // Assert
        expect(user.passwordResetToken).toBeNull();
        expect(user.passwordResetExpires).toBeNull();
      });

      it('should hash new password', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        const resetToken = user.generatePasswordResetToken();
        const oldPasswordHash = user.passwordHash;

        const command = new ResetPasswordCommand(
          tenantId,
          resetToken,
          newValidPassword,
        );

        mockRepository.findAll.mockResolvedValue([user]);
        mockRepository.update.mockResolvedValue(undefined);

        // Act
        await handler.execute(command);

        // Assert
        expect(user.passwordHash).not.toBe(oldPasswordHash);
        expect(user.passwordHash).not.toBe(newValidPassword); // Should be hashed

        // Verify new password works
        const isValid = await user.verifyPassword(newValidPassword);
        expect(isValid).toBe(true);
      });

      it('should update user in repository', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        const resetToken = user.generatePasswordResetToken();

        const command = new ResetPasswordCommand(
          tenantId,
          resetToken,
          newValidPassword,
        );

        mockRepository.findAll.mockResolvedValue([user]);
        mockRepository.update.mockResolvedValue(undefined);

        // Act
        await handler.execute(command);

        // Assert
        expect(mockRepository.update).toHaveBeenCalledTimes(1);
        expect(mockRepository.update).toHaveBeenCalledWith(tenantId, user);
      });
    });

    describe('Invalid reset tokens', () => {
      it('should throw NotFoundException when token does not match any user', async () => {
        // Arrange
        const user1 = await User.create({
          email: 'user1@acme.com',
          password: validPassword,
          name: 'User 1',
        });

        const user2 = await User.create({
          email: 'user2@acme.com',
          password: validPassword,
          name: 'User 2',
        });

        const command = new ResetPasswordCommand(
          tenantId,
          'invalid-token-123',
          newValidPassword,
        );

        mockRepository.findAll.mockResolvedValue([user1, user2]);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          NotFoundException,
        );
        await expect(handler.execute(command)).rejects.toThrow(
          'Invalid or expired reset token',
        );

        // Verify no user was updated
        expect(mockRepository.update).not.toHaveBeenCalled();
      });

      it('should throw NotFoundException when no users exist', async () => {
        // Arrange
        const command = new ResetPasswordCommand(
          tenantId,
          'any-token',
          newValidPassword,
        );

        mockRepository.findAll.mockResolvedValue([]);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          NotFoundException,
        );
        await expect(handler.execute(command)).rejects.toThrow(
          'Invalid or expired reset token',
        );
      });

      it('should throw NotFoundException when user has no reset token', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        // No reset token generated

        const command = new ResetPasswordCommand(
          tenantId,
          'some-random-token',
          newValidPassword,
        );

        mockRepository.findAll.mockResolvedValue([user]);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'Invalid or expired reset token',
        );
      });
    });

    describe('Expired reset tokens', () => {
      it('should throw NotFoundException when token has expired', async () => {
        // Arrange
        const user = User.reconstitute({
          id: 'user-123',
          email: 'user@acme.com',
          passwordHash: 'hashed',
          name: 'Test User',
          role: 'OPERATOR',
          status: 'ACTIVE',
          emailVerified: true,
          emailVerificationCode: null,
          emailVerificationExpires: null,
          passwordResetToken: 'valid-token-format',
          passwordResetExpires: new Date(Date.now() - 1000), // Expired 1 second ago
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const command = new ResetPasswordCommand(
          tenantId,
          'valid-token-format',
          newValidPassword,
        );

        mockRepository.findAll.mockResolvedValue([user]);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          NotFoundException,
        );
        await expect(handler.execute(command)).rejects.toThrow(
          'Invalid or expired reset token',
        );

        // Verify user was not updated
        expect(mockRepository.update).not.toHaveBeenCalled();
      });

      it('should accept token that has not yet expired', async () => {
        // Arrange
        const user = User.reconstitute({
          id: 'user-123',
          email: 'user@acme.com',
          passwordHash: 'hashed',
          name: 'Test User',
          role: 'OPERATOR',
          status: 'ACTIVE',
          emailVerified: true,
          emailVerificationCode: null,
          emailVerificationExpires: null,
          passwordResetToken: 'valid-token',
          passwordResetExpires: new Date(Date.now() + 60000), // Expires in 1 minute
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const command = new ResetPasswordCommand(
          tenantId,
          'valid-token',
          newValidPassword,
        );

        mockRepository.findAll.mockResolvedValue([user]);
        mockRepository.update.mockResolvedValue(undefined);

        // Act & Assert
        await expect(handler.execute(command)).resolves.toBeUndefined();
        expect(mockRepository.update).toHaveBeenCalled();
      });
    });

    describe('Password validation', () => {
      it('should accept valid password with all requirements', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        const resetToken = user.generatePasswordResetToken();

        const command = new ResetPasswordCommand(
          tenantId,
          resetToken,
          'ValidNew123!@#',
        );

        mockRepository.findAll.mockResolvedValue([user]);
        mockRepository.update.mockResolvedValue(undefined);

        // Act & Assert
        await expect(handler.execute(command)).resolves.toBeUndefined();
      });

      it('should reject password shorter than 8 characters', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        const resetToken = user.generatePasswordResetToken();

        const command = new ResetPasswordCommand(
          tenantId,
          resetToken,
          'Short1!', // Only 7 characters
        );

        mockRepository.findAll.mockResolvedValue([user]);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'Password must be at least 8 characters long',
        );
        expect(mockRepository.update).not.toHaveBeenCalled();
      });

      it('should reject password without uppercase letter', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        const resetToken = user.generatePasswordResetToken();

        const command = new ResetPasswordCommand(
          tenantId,
          resetToken,
          'lowercase123!',
        );

        mockRepository.findAll.mockResolvedValue([user]);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'Password must contain at least one uppercase letter',
        );
      });

      it('should reject password without lowercase letter', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        const resetToken = user.generatePasswordResetToken();

        const command = new ResetPasswordCommand(
          tenantId,
          resetToken,
          'UPPERCASE123!',
        );

        mockRepository.findAll.mockResolvedValue([user]);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'Password must contain at least one lowercase letter',
        );
      });

      it('should reject password without number', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        const resetToken = user.generatePasswordResetToken();

        const command = new ResetPasswordCommand(
          tenantId,
          resetToken,
          'NoNumbers!',
        );

        mockRepository.findAll.mockResolvedValue([user]);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'Password must contain at least one number',
        );
      });

      it('should reject password without special character', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        const resetToken = user.generatePasswordResetToken();

        const command = new ResetPasswordCommand(
          tenantId,
          resetToken,
          'NoSpecial123',
        );

        mockRepository.findAll.mockResolvedValue([user]);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'Password must contain at least one special character',
        );
      });
    });

    describe('User lookup', () => {
      it('should find user with matching reset token among multiple users', async () => {
        // Arrange
        const user1 = await User.create({
          email: 'user1@acme.com',
          password: validPassword,
          name: 'User 1',
        });

        const user2 = await User.create({
          email: 'user2@acme.com',
          password: validPassword,
          name: 'User 2',
        });

        const user3 = await User.create({
          email: 'user3@acme.com',
          password: validPassword,
          name: 'User 3',
        });

        const resetToken = user2.generatePasswordResetToken();

        const command = new ResetPasswordCommand(
          tenantId,
          resetToken,
          newValidPassword,
        );

        mockRepository.findAll.mockResolvedValue([user1, user2, user3]);
        mockRepository.update.mockResolvedValue(undefined);

        // Act
        await handler.execute(command);

        // Assert - should update user2, not user1 or user3
        expect(mockRepository.update).toHaveBeenCalledWith(tenantId, user2);
        expect(user2.passwordResetToken).toBeNull();
      });

      it('should retrieve all users from tenant', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        const resetToken = user.generatePasswordResetToken();

        const command = new ResetPasswordCommand(
          tenantId,
          resetToken,
          newValidPassword,
        );

        mockRepository.findAll.mockResolvedValue([user]);
        mockRepository.update.mockResolvedValue(undefined);

        // Act
        await handler.execute(command);

        // Assert
        expect(mockRepository.findAll).toHaveBeenCalledWith(tenantId);
      });
    });

    describe('Error handling', () => {
      it('should propagate repository errors from findAll', async () => {
        // Arrange
        const command = new ResetPasswordCommand(
          tenantId,
          'token',
          newValidPassword,
        );

        mockRepository.findAll.mockRejectedValue(
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

        const resetToken = user.generatePasswordResetToken();

        const command = new ResetPasswordCommand(
          tenantId,
          resetToken,
          newValidPassword,
        );

        mockRepository.findAll.mockResolvedValue([user]);
        mockRepository.update.mockRejectedValue(new Error('Update failed'));

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow('Update failed');
      });

      it('should convert domain errors to NotFoundException', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        const resetToken = user.generatePasswordResetToken();

        // Manually expire the token
        const expiredUser = User.reconstitute({
          id: user.id,
          email: user.email,
          passwordHash: user.passwordHash,
          name: user.name,
          role: user.role,
          status: user.status,
          emailVerified: user.emailVerified,
          emailVerificationCode: user.emailVerificationCode,
          emailVerificationExpires: user.emailVerificationExpires,
          passwordResetToken: resetToken,
          passwordResetExpires: new Date(Date.now() - 1000), // Expired
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        });

        const command = new ResetPasswordCommand(
          tenantId,
          resetToken,
          newValidPassword,
        );

        mockRepository.findAll.mockResolvedValue([expiredUser]);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          NotFoundException,
        );
      });
    });
  });
});
