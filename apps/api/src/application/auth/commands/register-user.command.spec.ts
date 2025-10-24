/**
 * RegisterUserHandler Tests
 *
 * Tests user registration command handler with comprehensive coverage of:
 * - Successful user registration (first user and subsequent users)
 * - First user auto-admin logic
 * - Email uniqueness validation
 * - Email verification flow
 * - Password validation
 * - Error handling
 */

import { ConflictException } from '@nestjs/common';
import {
  RegisterUserHandler,
  RegisterUserCommand,
} from './register-user.command';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { EmailService } from '../../../infrastructure/services/email.service';
import { User } from '../../../domain/users/user.entity';

/* eslint-disable @typescript-eslint/unbound-method */

describe('RegisterUserHandler', () => {
  let handler: RegisterUserHandler;
  let mockRepository: jest.Mocked<IUserRepository>;
  let mockEmailService: jest.Mocked<EmailService>;

  const validPassword = 'Test123!@#';
  const tenantId = 'tenant-123';
  const databaseName = 'tenant_db';

  beforeEach(() => {
    // Create mock repository
    mockRepository = {
      findByEmail: jest.fn(),
      count: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
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
    handler = new RegisterUserHandler(mockRepository, mockEmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    describe('First user registration (auto-admin)', () => {
      it('should create first user as ADMIN with auto-verification', async () => {
        // Arrange
        const command = new RegisterUserCommand(
          tenantId,
          'admin@acme.com',
          validPassword,
          'John Admin',
          databaseName,
        );

        mockRepository.findByEmail.mockResolvedValue(null); // Email not exists
        mockRepository.count.mockResolvedValue(0); // First user
        mockRepository.save.mockResolvedValue(undefined);

        // Act
        const result = await handler.execute(command);

        // Assert
        expect(result).toBeDefined();
        expect(result.userId).toBeDefined();
        expect(result.requiresVerification).toBe(false); // First user is auto-verified

        // Verify repository interactions
        expect(mockRepository.findByEmail).toHaveBeenCalledWith(
          tenantId,
          'admin@acme.com',
          databaseName,
        );
        expect(mockRepository.count).toHaveBeenCalledWith(tenantId, {
          databaseName,
        });
        expect(mockRepository.save).toHaveBeenCalledTimes(1);

        // Verify email was NOT sent to first user
        expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();

        // Verify saved user properties
        const savedUser = mockRepository.save.mock.calls[0][1];
        expect(savedUser.email).toBe('admin@acme.com');
        expect(savedUser.name).toBe('John Admin');
        expect(savedUser.role).toBe('ADMIN');
        expect(savedUser.emailVerified).toBe(true);
        expect(savedUser.status).toBe('ACTIVE');
      });

      it('should not send verification email to first user', async () => {
        // Arrange
        const command = new RegisterUserCommand(
          tenantId,
          'admin@acme.com',
          validPassword,
          'Admin User',
        );

        mockRepository.findByEmail.mockResolvedValue(null);
        mockRepository.count.mockResolvedValue(0); // First user
        mockRepository.save.mockResolvedValue(undefined);

        // Act
        await handler.execute(command);

        // Assert
        expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
      });
    });

    describe('Subsequent user registration (requires verification)', () => {
      it('should create subsequent user as OPERATOR requiring verification', async () => {
        // Arrange
        const command = new RegisterUserCommand(
          tenantId,
          'operator@acme.com',
          validPassword,
          'Jane Operator',
          databaseName,
        );

        mockRepository.findByEmail.mockResolvedValue(null);
        mockRepository.count.mockResolvedValue(1); // Not first user
        mockRepository.save.mockResolvedValue(undefined);
        mockEmailService.sendVerificationEmail.mockResolvedValue(undefined);

        // Act
        const result = await handler.execute(command);

        // Assert
        expect(result).toBeDefined();
        expect(result.userId).toBeDefined();
        expect(result.requiresVerification).toBe(true);

        // Verify saved user properties
        const savedUser = mockRepository.save.mock.calls[0][1];
        expect(savedUser.email).toBe('operator@acme.com');
        expect(savedUser.name).toBe('Jane Operator');
        expect(savedUser.role).toBe('OPERATOR');
        expect(savedUser.emailVerified).toBe(false);
        expect(savedUser.status).toBe('PENDING');
        expect(savedUser.emailVerificationCode).toBeTruthy();
      });

      it('should send verification email to subsequent users', async () => {
        // Arrange
        const command = new RegisterUserCommand(
          tenantId,
          'operator@acme.com',
          validPassword,
          'Jane Operator',
        );

        mockRepository.findByEmail.mockResolvedValue(null);
        mockRepository.count.mockResolvedValue(2); // Third user
        mockRepository.save.mockResolvedValue(undefined);
        mockEmailService.sendVerificationEmail.mockResolvedValue(undefined);

        // Act
        await handler.execute(command);

        // Assert
        expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
        expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith(
          'operator@acme.com',
          expect.any(String), // Verification code
          tenantId,
        );
      });

      it('should generate 6-digit verification code for subsequent users', async () => {
        // Arrange
        const command = new RegisterUserCommand(
          tenantId,
          'user@acme.com',
          validPassword,
          'Test User',
        );

        mockRepository.findByEmail.mockResolvedValue(null);
        mockRepository.count.mockResolvedValue(1);
        mockRepository.save.mockResolvedValue(undefined);
        mockEmailService.sendVerificationEmail.mockResolvedValue(undefined);

        // Act
        await handler.execute(command);

        // Assert
        const savedUser = mockRepository.save.mock.calls[0][1];
        expect(savedUser.emailVerificationCode).toBeTruthy();
        expect(savedUser.emailVerificationCode?.length).toBe(6);
        expect(savedUser.emailVerificationCode).toMatch(/^\d{6}$/);
      });
    });

    describe('Email uniqueness validation', () => {
      it('should throw ConflictException when email already exists', async () => {
        // Arrange
        const command = new RegisterUserCommand(
          tenantId,
          'existing@acme.com',
          validPassword,
          'Test User',
        );

        const existingUser = await User.create({
          email: 'existing@acme.com',
          password: validPassword,
          name: 'Existing User',
          role: 'OPERATOR',
        });

        mockRepository.findByEmail.mockResolvedValue(existingUser);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          ConflictException,
        );
        await expect(handler.execute(command)).rejects.toThrow(
          'Email already registered',
        );

        // Verify save was not called
        expect(mockRepository.save).not.toHaveBeenCalled();
        expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
      });

      it('should validate email uniqueness before checking user count', async () => {
        // Arrange
        const command = new RegisterUserCommand(
          tenantId,
          'duplicate@acme.com',
          validPassword,
          'Test User',
        );

        const existingUser = await User.create({
          email: 'duplicate@acme.com',
          password: validPassword,
          name: 'Existing',
        });

        mockRepository.findByEmail.mockResolvedValue(existingUser);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          ConflictException,
        );

        // count should not be called if email exists
        expect(mockRepository.count).not.toHaveBeenCalled();
      });
    });

    describe('Password validation', () => {
      it('should accept valid password with all requirements', async () => {
        // Arrange
        const command = new RegisterUserCommand(
          tenantId,
          'user@acme.com',
          'ValidPass123!',
          'Test User',
        );

        mockRepository.findByEmail.mockResolvedValue(null);
        mockRepository.count.mockResolvedValue(0);
        mockRepository.save.mockResolvedValue(undefined);

        // Act & Assert
        await expect(handler.execute(command)).resolves.toBeDefined();
      });

      it('should reject password shorter than 8 characters', async () => {
        // Arrange
        const command = new RegisterUserCommand(
          tenantId,
          'user@acme.com',
          'Short1!', // Only 7 characters
          'Test User',
        );

        mockRepository.findByEmail.mockResolvedValue(null);
        mockRepository.count.mockResolvedValue(0);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'Password must be at least 8 characters long',
        );
      });

      it('should reject password without uppercase letter', async () => {
        // Arrange
        const command = new RegisterUserCommand(
          tenantId,
          'user@acme.com',
          'lowercase123!',
          'Test User',
        );

        mockRepository.findByEmail.mockResolvedValue(null);
        mockRepository.count.mockResolvedValue(0);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'Password must contain at least one uppercase letter',
        );
      });

      it('should reject password without lowercase letter', async () => {
        // Arrange
        const command = new RegisterUserCommand(
          tenantId,
          'user@acme.com',
          'UPPERCASE123!',
          'Test User',
        );

        mockRepository.findByEmail.mockResolvedValue(null);
        mockRepository.count.mockResolvedValue(0);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'Password must contain at least one lowercase letter',
        );
      });

      it('should reject password without number', async () => {
        // Arrange
        const command = new RegisterUserCommand(
          tenantId,
          'user@acme.com',
          'NoNumbers!',
          'Test User',
        );

        mockRepository.findByEmail.mockResolvedValue(null);
        mockRepository.count.mockResolvedValue(0);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'Password must contain at least one number',
        );
      });

      it('should reject password without special character', async () => {
        // Arrange
        const command = new RegisterUserCommand(
          tenantId,
          'user@acme.com',
          'NoSpecial123',
          'Test User',
        );

        mockRepository.findByEmail.mockResolvedValue(null);
        mockRepository.count.mockResolvedValue(0);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'Password must contain at least one special character',
        );
      });
    });

    describe('Database interaction', () => {
      it('should pass tenantId and databaseName to repository methods', async () => {
        // Arrange
        const customDbName = 'custom_tenant_db';
        const command = new RegisterUserCommand(
          tenantId,
          'user@acme.com',
          validPassword,
          'Test User',
          customDbName,
        );

        mockRepository.findByEmail.mockResolvedValue(null);
        mockRepository.count.mockResolvedValue(0);
        mockRepository.save.mockResolvedValue(undefined);

        // Act
        await handler.execute(command);

        // Assert
        expect(mockRepository.findByEmail).toHaveBeenCalledWith(
          tenantId,
          'user@acme.com',
          customDbName,
        );
        expect(mockRepository.count).toHaveBeenCalledWith(tenantId, {
          databaseName: customDbName,
        });
        expect(mockRepository.save).toHaveBeenCalledWith(
          tenantId,
          expect.any(User),
          customDbName,
        );
      });

      it('should work without databaseName parameter', async () => {
        // Arrange
        const command = new RegisterUserCommand(
          tenantId,
          'user@acme.com',
          validPassword,
          'Test User',
          undefined, // No database name
        );

        mockRepository.findByEmail.mockResolvedValue(null);
        mockRepository.count.mockResolvedValue(0);
        mockRepository.save.mockResolvedValue(undefined);

        // Act
        await handler.execute(command);

        // Assert
        expect(mockRepository.findByEmail).toHaveBeenCalledWith(
          tenantId,
          'user@acme.com',
          undefined,
        );
        expect(mockRepository.save).toHaveBeenCalledWith(
          tenantId,
          expect.any(User),
          undefined,
        );
      });
    });

    describe('Error handling', () => {
      it('should propagate repository errors from findByEmail', async () => {
        // Arrange
        const command = new RegisterUserCommand(
          tenantId,
          'user@acme.com',
          validPassword,
          'Test User',
        );

        mockRepository.findByEmail.mockRejectedValue(
          new Error('Database connection failed'),
        );

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'Database connection failed',
        );
      });

      it('should propagate repository errors from count', async () => {
        // Arrange
        const command = new RegisterUserCommand(
          tenantId,
          'user@acme.com',
          validPassword,
          'Test User',
        );

        mockRepository.findByEmail.mockResolvedValue(null);
        mockRepository.count.mockRejectedValue(new Error('Query timeout'));

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow('Query timeout');
      });

      it('should propagate repository errors from save', async () => {
        // Arrange
        const command = new RegisterUserCommand(
          tenantId,
          'user@acme.com',
          validPassword,
          'Test User',
        );

        mockRepository.findByEmail.mockResolvedValue(null);
        mockRepository.count.mockResolvedValue(0);
        mockRepository.save.mockRejectedValue(new Error('Insert failed'));

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow('Insert failed');
      });

      it('should propagate email service errors', async () => {
        // Arrange
        const command = new RegisterUserCommand(
          tenantId,
          'user@acme.com',
          validPassword,
          'Test User',
        );

        mockRepository.findByEmail.mockResolvedValue(null);
        mockRepository.count.mockResolvedValue(1); // Not first user
        mockRepository.save.mockResolvedValue(undefined);
        mockEmailService.sendVerificationEmail.mockRejectedValue(
          new Error('SMTP server unavailable'),
        );

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'SMTP server unavailable',
        );
      });
    });
  });
});
