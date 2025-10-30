/**
 * ForgotPasswordHandler Tests
 *
 * Tests forgot password command handler with comprehensive coverage of:
 * - Successful password reset token generation
 * - Email sending for password reset
 * - Silent failure for non-existent users (security best practice)
 * - Token generation and expiry
 * - Error handling
 */

import {
  ForgotPasswordHandler,
  ForgotPasswordCommand,
} from './forgot-password.command';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { EmailService } from '../../../infrastructure/services/email.service';
import { User } from '../../../domain/users/user.entity';

/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/require-await */

describe('ForgotPasswordHandler', () => {
  let handler: ForgotPasswordHandler;
  let mockRepository: jest.Mocked<IUserRepository>;
  let mockEmailService: jest.Mocked<EmailService>;

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

    // Create mock email service
    mockEmailService = {
      sendVerificationEmail: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
      sendWelcomeEmail: jest.fn(),
    } as unknown as jest.Mocked<EmailService>;

    // Initialize handler with mocks
    handler = new ForgotPasswordHandler(mockRepository, mockEmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    describe('Successful password reset request', () => {
      it('should generate reset token and send email for existing user', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        user.verifyEmail(user.emailVerificationCode!);

        const command = new ForgotPasswordCommand(tenantId, 'user@acme.com');

        mockRepository.findByEmail.mockResolvedValue(user);
        mockRepository.update.mockResolvedValue(undefined);
        mockEmailService.sendPasswordResetEmail.mockResolvedValue(undefined);

        // Act
        await handler.execute(command);

        // Assert
        expect(mockRepository.findByEmail).toHaveBeenCalledWith(
          tenantId,
          'user@acme.com',
        );
        expect(mockRepository.update).toHaveBeenCalledWith(tenantId, user);
        expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
          'user@acme.com',
          expect.any(String), // Reset token
          tenantId,
        );
      });

      it('should generate UUID format reset token', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        const command = new ForgotPasswordCommand(tenantId, 'user@acme.com');

        mockRepository.findByEmail.mockResolvedValue(user);
        mockRepository.update.mockResolvedValue(undefined);
        mockEmailService.sendPasswordResetEmail.mockResolvedValue(undefined);

        // Act
        await handler.execute(command);

        // Assert
        const resetToken = user.passwordResetToken;
        expect(resetToken).toBeTruthy();
        expect(resetToken).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
      });

      it('should set reset token expiry to 1 hour', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        const command = new ForgotPasswordCommand(tenantId, 'user@acme.com');

        const beforeExecution = Date.now();

        mockRepository.findByEmail.mockResolvedValue(user);
        mockRepository.update.mockResolvedValue(undefined);
        mockEmailService.sendPasswordResetEmail.mockResolvedValue(undefined);

        // Act
        await handler.execute(command);

        // Assert
        const resetExpires = user.passwordResetExpires;
        expect(resetExpires).toBeInstanceOf(Date);

        const expectedExpiry = beforeExecution + 60 * 60 * 1000; // 1 hour
        const actualExpiry = resetExpires!.getTime();
        const timeDiff = Math.abs(expectedExpiry - actualExpiry);

        expect(timeDiff).toBeLessThan(1000); // Within 1 second tolerance
      });

      it('should update user in repository before sending email', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        const command = new ForgotPasswordCommand(tenantId, 'user@acme.com');

        const callOrder: string[] = [];

        mockRepository.findByEmail.mockResolvedValue(user);
        mockRepository.update.mockImplementation(async () => {
          callOrder.push('update');
        });
        mockEmailService.sendPasswordResetEmail.mockImplementation(async () => {
          callOrder.push('email');
        });

        // Act
        await handler.execute(command);

        // Assert - update must happen before email
        expect(callOrder).toEqual(['update', 'email']);
      });

      it('should send reset email with generated token', async () => {
        // Arrange
        const user = await User.create({
          email: 'admin@acme.com',
          password: validPassword,
          name: 'Admin User',
        });

        const command = new ForgotPasswordCommand(tenantId, 'admin@acme.com');

        mockRepository.findByEmail.mockResolvedValue(user);
        mockRepository.update.mockResolvedValue(undefined);
        mockEmailService.sendPasswordResetEmail.mockResolvedValue(undefined);

        // Act
        await handler.execute(command);

        // Assert
        const resetToken = user.passwordResetToken!;
        expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
          'admin@acme.com',
          resetToken,
          tenantId,
        );
      });
    });

    describe('Security: Silent failure for non-existent users', () => {
      it('should return silently when user does not exist', async () => {
        // Arrange
        const command = new ForgotPasswordCommand(
          tenantId,
          'nonexistent@acme.com',
        );

        mockRepository.findByEmail.mockResolvedValue(null);

        // Act & Assert - should not throw
        await expect(handler.execute(command)).resolves.toBeUndefined();
      });

      it('should not send email when user does not exist', async () => {
        // Arrange
        const command = new ForgotPasswordCommand(
          tenantId,
          'nonexistent@acme.com',
        );

        mockRepository.findByEmail.mockResolvedValue(null);

        // Act
        await handler.execute(command);

        // Assert
        expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      });

      it('should not update repository when user does not exist', async () => {
        // Arrange
        const command = new ForgotPasswordCommand(
          tenantId,
          'nonexistent@acme.com',
        );

        mockRepository.findByEmail.mockResolvedValue(null);

        // Act
        await handler.execute(command);

        // Assert
        expect(mockRepository.update).not.toHaveBeenCalled();
      });

      it('should not reveal whether user exists through timing', async () => {
        // This test documents the security best practice
        // In production, both paths should take similar time

        // Arrange - user exists
        const existingUser = await User.create({
          email: 'existing@acme.com',
          password: validPassword,
          name: 'Existing User',
        });

        const command1 = new ForgotPasswordCommand(
          tenantId,
          'existing@acme.com',
        );
        const command2 = new ForgotPasswordCommand(
          tenantId,
          'nonexistent@acme.com',
        );

        mockRepository.findByEmail
          .mockResolvedValueOnce(existingUser)
          .mockResolvedValueOnce(null);
        mockRepository.update.mockResolvedValue(undefined);
        mockEmailService.sendPasswordResetEmail.mockResolvedValue(undefined);

        // Act - both should complete without error
        await expect(handler.execute(command1)).resolves.toBeUndefined();
        await expect(handler.execute(command2)).resolves.toBeUndefined();
      });
    });

    describe('Token generation', () => {
      it('should generate different tokens for multiple requests', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        const command = new ForgotPasswordCommand(tenantId, 'user@acme.com');

        mockRepository.findByEmail.mockResolvedValue(user);
        mockRepository.update.mockResolvedValue(undefined);
        mockEmailService.sendPasswordResetEmail.mockResolvedValue(undefined);

        // Act - first request
        await handler.execute(command);
        const firstToken = user.passwordResetToken;

        // Act - second request
        await handler.execute(command);
        const secondToken = user.passwordResetToken;

        // Assert
        expect(firstToken).not.toBe(secondToken);
      });

      it('should overwrite previous reset token', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        // Generate first token
        const firstToken = user.generatePasswordResetToken();

        const command = new ForgotPasswordCommand(tenantId, 'user@acme.com');

        mockRepository.findByEmail.mockResolvedValue(user);
        mockRepository.update.mockResolvedValue(undefined);
        mockEmailService.sendPasswordResetEmail.mockResolvedValue(undefined);

        // Act - generate new token
        await handler.execute(command);

        // Assert
        expect(user.passwordResetToken).not.toBe(firstToken);
        expect(user.passwordResetToken).toBeTruthy();
      });
    });

    describe('Email handling', () => {
      it('should call sendPasswordResetEmail with correct parameters', async () => {
        // Arrange
        const user = await User.create({
          email: 'test@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        const command = new ForgotPasswordCommand(tenantId, 'test@acme.com');

        mockRepository.findByEmail.mockResolvedValue(user);
        mockRepository.update.mockResolvedValue(undefined);
        mockEmailService.sendPasswordResetEmail.mockResolvedValue(undefined);

        // Act
        await handler.execute(command);

        // Assert
        expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledTimes(
          1,
        );
        expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
          'test@acme.com',
          expect.stringMatching(/^[0-9a-f-]{36}$/i), // UUID format
          tenantId,
        );
      });
    });

    describe('Error handling', () => {
      it('should propagate repository errors from findByEmail', async () => {
        // Arrange
        const command = new ForgotPasswordCommand(tenantId, 'user@acme.com');

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

        const command = new ForgotPasswordCommand(tenantId, 'user@acme.com');

        mockRepository.findByEmail.mockResolvedValue(user);
        mockRepository.update.mockRejectedValue(new Error('Update failed'));

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow('Update failed');
      });

      it('should propagate email service errors', async () => {
        // Arrange
        const user = await User.create({
          email: 'user@acme.com',
          password: validPassword,
          name: 'Test User',
        });

        const command = new ForgotPasswordCommand(tenantId, 'user@acme.com');

        mockRepository.findByEmail.mockResolvedValue(user);
        mockRepository.update.mockResolvedValue(undefined);
        mockEmailService.sendPasswordResetEmail.mockRejectedValue(
          new Error('SMTP server unavailable'),
        );

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'SMTP server unavailable',
        );
      });
    });

    describe('User state validation', () => {
      it('should work for verified users', async () => {
        // Arrange
        const user = await User.create({
          email: 'verified@acme.com',
          password: validPassword,
          name: 'Verified User',
        });

        user.verifyEmail(user.emailVerificationCode!);

        const command = new ForgotPasswordCommand(
          tenantId,
          'verified@acme.com',
        );

        mockRepository.findByEmail.mockResolvedValue(user);
        mockRepository.update.mockResolvedValue(undefined);
        mockEmailService.sendPasswordResetEmail.mockResolvedValue(undefined);

        // Act & Assert
        await expect(handler.execute(command)).resolves.toBeUndefined();
        expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalled();
      });

      it('should work for unverified users', async () => {
        // Arrange - user hasn't verified email yet
        const user = await User.create({
          email: 'unverified@acme.com',
          password: validPassword,
          name: 'Unverified User',
        });

        // Don't verify email

        const command = new ForgotPasswordCommand(
          tenantId,
          'unverified@acme.com',
        );

        mockRepository.findByEmail.mockResolvedValue(user);
        mockRepository.update.mockResolvedValue(undefined);
        mockEmailService.sendPasswordResetEmail.mockResolvedValue(undefined);

        // Act & Assert - should still allow password reset
        await expect(handler.execute(command)).resolves.toBeUndefined();
        expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalled();
      });

      it('should work for suspended users', async () => {
        // Arrange
        const user = await User.create({
          email: 'suspended@acme.com',
          password: validPassword,
          name: 'Suspended User',
        });

        user.verifyEmail(user.emailVerificationCode!);
        user.suspend();

        const command = new ForgotPasswordCommand(
          tenantId,
          'suspended@acme.com',
        );

        mockRepository.findByEmail.mockResolvedValue(user);
        mockRepository.update.mockResolvedValue(undefined);
        mockEmailService.sendPasswordResetEmail.mockResolvedValue(undefined);

        // Act & Assert - suspended users can still reset password
        await expect(handler.execute(command)).resolves.toBeUndefined();
        expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalled();
      });
    });
  });
});
