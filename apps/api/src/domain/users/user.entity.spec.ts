/**
 * User Entity Tests
 *
 * Tests all business rules and lifecycle methods of the User entity.
 * Covers authentication, email verification, password management, and user lifecycle.
 */

import { User, CreateUserParams } from './user.entity';
import * as bcrypt from 'bcryptjs';

// Mock bcrypt for consistent testing
jest.mock('bcryptjs');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('User Entity', () => {
  const validPassword = 'Test@1234';
  const hashedPassword = '$2a$12$mockedHashedPassword';

  const validUserParams: CreateUserParams = {
    email: 'john.doe@acme.com',
    password: validPassword,
    name: 'John Doe',
    role: 'OPERATOR',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock bcrypt.hash to return a predictable hash
    mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);
    // Mock bcrypt.compare to check password equality
    mockedBcrypt.compare.mockImplementation(((plain: string, hash: string) => {
      // For testing purposes, match against our test password
      return Promise.resolve(
        plain === validPassword && hash === hashedPassword,
      );
    }) as never);
  });

  describe('create', () => {
    it('should create a valid user with all required fields', async () => {
      const user = await User.create(validUserParams);

      expect(user).toBeInstanceOf(User);
      expect(user.email).toBe('john.doe@acme.com');
      expect(user.name).toBe('John Doe');
      expect(user.role).toBe('OPERATOR');
      expect(user.status).toBe('PENDING');
      expect(user.emailVerified).toBe(false);
      expect(user.id).toBeDefined();
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should hash password with bcrypt (12 rounds)', async () => {
      await User.create(validUserParams);

      expect(mockedBcrypt.hash).toHaveBeenCalledWith(validPassword, 12);
    });

    it('should store hashed password, not plain text', async () => {
      const user = await User.create(validUserParams);

      expect(user.passwordHash).toBe(hashedPassword);
      expect(user.passwordHash).not.toBe(validPassword);
    });

    it('should generate 6-digit verification code', async () => {
      const user = await User.create(validUserParams);

      expect(user.emailVerificationCode).toBeDefined();
      expect(user.emailVerificationCode).toMatch(/^\d{6}$/);
    });

    it('should set verification expiry to 24 hours from now', async () => {
      const beforeCreate = Date.now();
      const user = await User.create(validUserParams);
      const afterCreate = Date.now();

      expect(user.emailVerificationExpires).toBeInstanceOf(Date);
      const expiryTime = user.emailVerificationExpires!.getTime();
      const expectedMin = beforeCreate + 24 * 60 * 60 * 1000 - 1000; // -1s tolerance
      const expectedMax = afterCreate + 24 * 60 * 60 * 1000 + 1000; // +1s tolerance

      expect(expiryTime).toBeGreaterThanOrEqual(expectedMin);
      expect(expiryTime).toBeLessThanOrEqual(expectedMax);
    });

    it('should default role to OPERATOR if not provided', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { role, ...paramsWithoutRole } = validUserParams;
      const user = await User.create(paramsWithoutRole);

      expect(user.role).toBe('OPERATOR');
    });

    it('should accept ADMIN role', async () => {
      const user = await User.create({
        ...validUserParams,
        role: 'ADMIN',
      });

      expect(user.role).toBe('ADMIN');
    });

    it('should accept MANAGER role', async () => {
      const user = await User.create({
        ...validUserParams,
        role: 'MANAGER',
      });

      expect(user.role).toBe('MANAGER');
    });

    it('should initialize password reset fields as null', async () => {
      const user = await User.create(validUserParams);

      expect(user.passwordResetToken).toBeNull();
      expect(user.passwordResetExpires).toBeNull();
    });

    it('should initialize lastLoginAt as null', async () => {
      const user = await User.create(validUserParams);

      expect(user.lastLoginAt).toBeNull();
    });

    it('should accept custom ID if provided', async () => {
      const customId = 'custom-uuid-123';
      const user = await User.create(validUserParams, customId);

      expect(user.id).toBe(customId);
    });

    it('should generate unique IDs for different users', async () => {
      const user1 = await User.create(validUserParams);
      const user2 = await User.create({
        ...validUserParams,
        email: 'jane.doe@acme.com',
      });

      expect(user1.id).not.toBe(user2.id);
    });

    it('should normalize email to lowercase', async () => {
      const user = await User.create({
        ...validUserParams,
        email: 'John.Doe@ACME.COM',
      });

      expect(user.email).toBe('john.doe@acme.com');
    });

    it('should trim whitespace from email', async () => {
      const user = await User.create({
        ...validUserParams,
        email: '  john.doe@acme.com  ',
      });

      expect(user.email).toBe('john.doe@acme.com');
    });
  });

  describe('password validation', () => {
    it('should reject password shorter than 8 characters', async () => {
      await expect(
        User.create({
          ...validUserParams,
          password: 'Test@12', // 7 chars
        }),
      ).rejects.toThrow('Password must be at least 8 characters long');
    });

    it('should reject password without uppercase letter', async () => {
      await expect(
        User.create({
          ...validUserParams,
          password: 'test@1234',
        }),
      ).rejects.toThrow('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase letter', async () => {
      await expect(
        User.create({
          ...validUserParams,
          password: 'TEST@1234',
        }),
      ).rejects.toThrow('Password must contain at least one lowercase letter');
    });

    it('should reject password without number', async () => {
      await expect(
        User.create({
          ...validUserParams,
          password: 'Test@test',
        }),
      ).rejects.toThrow('Password must contain at least one number');
    });

    it('should reject password without special character', async () => {
      await expect(
        User.create({
          ...validUserParams,
          password: 'Test1234',
        }),
      ).rejects.toThrow('Password must contain at least one special character');
    });

    it('should accept password with all required characteristics', async () => {
      const user = await User.create({
        ...validUserParams,
        password: 'Valid@Pass123',
      });

      expect(user).toBeInstanceOf(User);
    });

    it('should accept various special characters', async () => {
      const specialChars = ['!', '#', '$', '%', '^', '&', '*', '(', ')'];

      for (const char of specialChars) {
        const user = await User.create({
          ...validUserParams,
          email: `test.user${Math.random()}@acme.com`,
          password: `Test${char}1234`,
        });
        expect(user).toBeInstanceOf(User);
      }
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      const user = await User.create(validUserParams);

      const isValid = await user.verifyPassword(validPassword);

      expect(isValid).toBe(true);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        validPassword,
        hashedPassword,
      );
    });

    it('should return false for incorrect password', async () => {
      const user = await User.create(validUserParams);
      mockedBcrypt.compare.mockResolvedValueOnce(false as never);

      const isValid = await user.verifyPassword('WrongPassword123!');

      expect(isValid).toBe(false);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email with valid code', async () => {
      const user = await User.create(validUserParams);
      const code = user.emailVerificationCode!;

      user.verifyEmail(code);

      expect(user.emailVerified).toBe(true);
      expect(user.status).toBe('ACTIVE');
      expect(user.emailVerificationCode).toBeNull();
      expect(user.emailVerificationExpires).toBeNull();
    });

    it('should throw error for invalid verification code', async () => {
      const user = await User.create(validUserParams);

      expect(() => {
        user.verifyEmail('000000');
      }).toThrow('Invalid verification code');
    });

    it('should throw error for expired verification code', async () => {
      const user = await User.create(validUserParams);
      const code = user.emailVerificationCode!;

      // Mock expired verification
      const reconstitutedUser = User.reconstitute({
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        name: user.name,
        role: user.role,
        status: user.status,
        emailVerified: false,
        emailVerificationCode: code,
        emailVerificationExpires: new Date(Date.now() - 1000), // Expired 1 second ago
        passwordResetToken: null,
        passwordResetExpires: null,
        lastLoginAt: null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });

      expect(() => {
        reconstitutedUser.verifyEmail(code);
      }).toThrow('Verification code has expired');
    });

    it('should throw error if no verification code is set', async () => {
      const user = await User.create(validUserParams);

      // Simulate user with no verification code
      const reconstitutedUser = User.reconstitute({
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        name: user.name,
        role: user.role,
        status: user.status,
        emailVerified: false,
        emailVerificationCode: null,
        emailVerificationExpires: null,
        passwordResetToken: null,
        passwordResetExpires: null,
        lastLoginAt: null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });

      expect(() => {
        reconstitutedUser.verifyEmail('123456');
      }).toThrow('No verification code set for this user');
    });

    it('should update updatedAt timestamp on verification', async () => {
      const user = await User.create(validUserParams);
      const code = user.emailVerificationCode!;
      const originalUpdatedAt = user.updatedAt;

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      user.verifyEmail(code);

      expect(user.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
    });
  });

  describe('resendVerificationCode', () => {
    it('should generate new verification code', async () => {
      const user = await User.create(validUserParams);

      user.resendVerificationCode();

      expect(user.emailVerificationCode).toBeDefined();
      expect(user.emailVerificationCode).toMatch(/^\d{6}$/);
      // Note: There's a small chance the new code could be the same as the old one
      // but we can still verify the format
    });

    it('should extend verification expiry to 24 hours from now', async () => {
      const user = await User.create(validUserParams);

      const beforeResend = Date.now();
      user.resendVerificationCode();
      const afterResend = Date.now();

      const expiryTime = user.emailVerificationExpires!.getTime();
      const expectedMin = beforeResend + 24 * 60 * 60 * 1000 - 1000;
      const expectedMax = afterResend + 24 * 60 * 60 * 1000 + 1000;

      expect(expiryTime).toBeGreaterThanOrEqual(expectedMin);
      expect(expiryTime).toBeLessThanOrEqual(expectedMax);
    });

    it('should throw error if email already verified', async () => {
      const user = await User.create(validUserParams);
      const code = user.emailVerificationCode!;
      user.verifyEmail(code);

      expect(() => {
        user.resendVerificationCode();
      }).toThrow('Email is already verified');
    });

    it('should update updatedAt timestamp', async () => {
      const user = await User.create(validUserParams);
      const originalUpdatedAt = user.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      user.resendVerificationCode();

      expect(user.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
    });
  });

  describe('generatePasswordResetToken', () => {
    it('should generate a password reset token', async () => {
      const user = await User.create(validUserParams);

      const token = user.generatePasswordResetToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should store token in user entity', async () => {
      const user = await User.create(validUserParams);

      const token = user.generatePasswordResetToken();

      expect(user.passwordResetToken).toBe(token);
    });

    it('should set token expiry to 1 hour from now', async () => {
      const user = await User.create(validUserParams);

      const beforeGenerate = Date.now();
      user.generatePasswordResetToken();
      const afterGenerate = Date.now();

      const expiryTime = user.passwordResetExpires!.getTime();
      const expectedMin = beforeGenerate + 60 * 60 * 1000 - 1000;
      const expectedMax = afterGenerate + 60 * 60 * 1000 + 1000;

      expect(expiryTime).toBeGreaterThanOrEqual(expectedMin);
      expect(expiryTime).toBeLessThanOrEqual(expectedMax);
    });

    it('should generate unique tokens', async () => {
      const user = await User.create(validUserParams);

      const token1 = user.generatePasswordResetToken();
      const token2 = user.generatePasswordResetToken();

      expect(token1).not.toBe(token2);
    });

    it('should update updatedAt timestamp', async () => {
      const user = await User.create(validUserParams);
      const originalUpdatedAt = user.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      user.generatePasswordResetToken();

      expect(user.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const user = await User.create(validUserParams);
      const token = user.generatePasswordResetToken();
      const newPassword = 'NewPass@123';

      await user.resetPassword(token, newPassword);

      expect(mockedBcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(user.passwordResetToken).toBeNull();
      expect(user.passwordResetExpires).toBeNull();
    });

    it('should throw error for invalid token', async () => {
      const user = await User.create(validUserParams);
      user.generatePasswordResetToken();

      await expect(
        user.resetPassword('invalid-token', 'NewPass@123'),
      ).rejects.toThrow('Invalid password reset token');
    });

    it('should throw error if no token exists', async () => {
      const user = await User.create(validUserParams);

      await expect(
        user.resetPassword('some-token', 'NewPass@123'),
      ).rejects.toThrow('Invalid password reset token');
    });

    it('should throw error for expired token', async () => {
      const user = await User.create(validUserParams);
      const token = user.generatePasswordResetToken();

      // Reconstitute with expired token
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
        passwordResetToken: token,
        passwordResetExpires: new Date(Date.now() - 1000), // Expired
        lastLoginAt: null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });

      await expect(
        expiredUser.resetPassword(token, 'NewPass@123'),
      ).rejects.toThrow('Password reset token has expired');
    });

    it('should validate new password strength', async () => {
      const user = await User.create(validUserParams);
      const token = user.generatePasswordResetToken();

      await expect(
        user.resetPassword(token, 'weak'), // Invalid password
      ).rejects.toThrow('Password must be at least 8 characters long');
    });

    it('should update updatedAt timestamp', async () => {
      const user = await User.create(validUserParams);
      const token = user.generatePasswordResetToken();
      const originalUpdatedAt = user.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      await user.resetPassword(token, 'NewPass@123');

      expect(user.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
    });
  });

  describe('changePassword', () => {
    it('should change password with valid current password', async () => {
      const user = await User.create(validUserParams);
      const newPassword = 'NewPass@123';

      await user.changePassword(validPassword, newPassword);

      expect(mockedBcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
    });

    it('should throw error for incorrect current password', async () => {
      const user = await User.create(validUserParams);
      mockedBcrypt.compare.mockResolvedValueOnce(false as never);

      await expect(
        user.changePassword('WrongPass@123', 'NewPass@123'),
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should validate new password strength', async () => {
      const user = await User.create(validUserParams);

      await expect(user.changePassword(validPassword, 'weak')).rejects.toThrow(
        'Password must be at least 8 characters long',
      );
    });

    it('should update updatedAt timestamp', async () => {
      const user = await User.create(validUserParams);
      const originalUpdatedAt = user.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      await user.changePassword(validPassword, 'NewPass@123');

      expect(user.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
    });
  });

  describe('activate', () => {
    it('should activate user if email is verified', async () => {
      const user = await User.create(validUserParams);
      const code = user.emailVerificationCode!;
      user.verifyEmail(code);

      expect(user.status).toBe('ACTIVE');

      user.activate();

      expect(user.status).toBe('ACTIVE');
    });

    it('should throw error if email is not verified', async () => {
      const user = await User.create(validUserParams);

      expect(() => {
        user.activate();
      }).toThrow('Cannot activate user without email verification');
    });

    it('should do nothing if user is already active', async () => {
      const user = await User.create(validUserParams);
      const code = user.emailVerificationCode!;
      user.verifyEmail(code);
      const updatedAt = user.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      user.activate();

      // Should not update timestamp if already active
      expect(user.updatedAt).toEqual(updatedAt);
    });

    it('should activate suspended user if email verified', async () => {
      const user = await User.create(validUserParams);
      const code = user.emailVerificationCode!;
      user.verifyEmail(code);
      user.suspend();

      expect(user.status).toBe('SUSPENDED');

      user.activate();

      expect(user.status).toBe('ACTIVE');
    });

    it('should update updatedAt timestamp when activating suspended user', async () => {
      const user = await User.create(validUserParams);
      const code = user.emailVerificationCode!;
      user.verifyEmail(code);
      user.suspend();
      const originalUpdatedAt = user.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      user.activate();

      expect(user.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
    });
  });

  describe('suspend', () => {
    it('should suspend an active user', async () => {
      const user = await User.create(validUserParams);
      const code = user.emailVerificationCode!;
      user.verifyEmail(code);

      user.suspend();

      expect(user.status).toBe('SUSPENDED');
    });

    it('should suspend a pending user', async () => {
      const user = await User.create(validUserParams);

      user.suspend();

      expect(user.status).toBe('SUSPENDED');
    });

    it('should update updatedAt timestamp', async () => {
      const user = await User.create(validUserParams);
      const originalUpdatedAt = user.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      user.suspend();

      expect(user.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      const user = await User.create(validUserParams);

      expect(user.lastLoginAt).toBeNull();

      const beforeUpdate = Date.now();
      user.updateLastLogin();
      const afterUpdate = Date.now();

      expect(user.lastLoginAt).toBeInstanceOf(Date);
      expect(user.lastLoginAt!.getTime()).toBeGreaterThanOrEqual(beforeUpdate);
      expect(user.lastLoginAt!.getTime()).toBeLessThanOrEqual(afterUpdate);
    });

    it('should update updatedAt timestamp', async () => {
      const user = await User.create(validUserParams);
      const originalUpdatedAt = user.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      user.updateLastLogin();

      expect(user.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
    });

    it('should update last login on subsequent logins', async () => {
      const user = await User.create(validUserParams);

      user.updateLastLogin();
      const firstLogin = user.lastLoginAt!;

      await new Promise((resolve) => setTimeout(resolve, 10));

      user.updateLastLogin();
      const secondLogin = user.lastLoginAt!;

      expect(secondLogin.getTime()).toBeGreaterThan(firstLogin.getTime());
    });
  });

  describe('changeRole', () => {
    it('should change role from OPERATOR to ADMIN', async () => {
      const user = await User.create(validUserParams);

      user.changeRole('ADMIN');

      expect(user.role).toBe('ADMIN');
    });

    it('should change role from OPERATOR to MANAGER', async () => {
      const user = await User.create(validUserParams);

      user.changeRole('MANAGER');

      expect(user.role).toBe('MANAGER');
    });

    it('should change role from ADMIN to OPERATOR', async () => {
      const user = await User.create({ ...validUserParams, role: 'ADMIN' });

      user.changeRole('OPERATOR');

      expect(user.role).toBe('OPERATOR');
    });

    it('should update updatedAt timestamp', async () => {
      const user = await User.create(validUserParams);
      const originalUpdatedAt = user.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      user.changeRole('ADMIN');

      expect(user.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
    });
  });

  describe('updateName', () => {
    it('should update user name', async () => {
      const user = await User.create(validUserParams);

      user.updateName('Jane Smith');

      expect(user.name).toBe('Jane Smith');
    });

    it('should trim whitespace from name', async () => {
      const user = await User.create(validUserParams);

      user.updateName('  Jane Smith  ');

      expect(user.name).toBe('Jane Smith');
    });

    it('should throw error for empty name', async () => {
      const user = await User.create(validUserParams);

      expect(() => {
        user.updateName('');
      }).toThrow('Name cannot be empty');
    });

    it('should throw error for whitespace-only name', async () => {
      const user = await User.create(validUserParams);

      expect(() => {
        user.updateName('   ');
      }).toThrow('Name cannot be empty');
    });

    it('should update updatedAt timestamp', async () => {
      const user = await User.create(validUserParams);
      const originalUpdatedAt = user.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      user.updateName('Jane Smith');

      expect(user.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute user from persistence data', () => {
      const persistenceData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'john.doe@acme.com',
        passwordHash: hashedPassword,
        name: 'John Doe',
        role: 'MANAGER' as const,
        status: 'ACTIVE' as const,
        emailVerified: true,
        emailVerificationCode: null,
        emailVerificationExpires: null,
        passwordResetToken: null,
        passwordResetExpires: null,
        lastLoginAt: new Date('2025-10-20T10:00:00Z'),
        createdAt: new Date('2025-10-01T10:00:00Z'),
        updatedAt: new Date('2025-10-20T10:00:00Z'),
      };

      const user = User.reconstitute(persistenceData);

      expect(user.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(user.email).toBe('john.doe@acme.com');
      expect(user.name).toBe('John Doe');
      expect(user.role).toBe('MANAGER');
      expect(user.status).toBe('ACTIVE');
      expect(user.emailVerified).toBe(true);
      expect(user.lastLoginAt).toEqual(new Date('2025-10-20T10:00:00Z'));
    });

    it('should reconstitute user with verification code', () => {
      const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const persistenceData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'john.doe@acme.com',
        passwordHash: hashedPassword,
        name: 'John Doe',
        role: 'OPERATOR' as const,
        status: 'PENDING' as const,
        emailVerified: false,
        emailVerificationCode: '123456',
        emailVerificationExpires: verificationExpiry,
        passwordResetToken: null,
        passwordResetExpires: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const user = User.reconstitute(persistenceData);

      expect(user.emailVerificationCode).toBe('123456');
      expect(user.emailVerificationExpires).toEqual(verificationExpiry);
    });

    it('should reconstitute user with password reset token', () => {
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);
      const persistenceData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'john.doe@acme.com',
        passwordHash: hashedPassword,
        name: 'John Doe',
        role: 'OPERATOR' as const,
        status: 'ACTIVE' as const,
        emailVerified: true,
        emailVerificationCode: null,
        emailVerificationExpires: null,
        passwordResetToken: 'reset-token-uuid',
        passwordResetExpires: resetExpiry,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const user = User.reconstitute(persistenceData);

      expect(user.passwordResetToken).toBe('reset-token-uuid');
      expect(user.passwordResetExpires).toEqual(resetExpiry);
    });
  });

  describe('email value object integration', () => {
    it('should reject invalid email format', async () => {
      await expect(
        User.create({
          ...validUserParams,
          email: 'invalid-email',
        }),
      ).rejects.toThrow('Invalid email format');
    });

    it('should reject email exceeding 255 characters', async () => {
      const longEmail = 'a'.repeat(250) + '@test.com';

      await expect(
        User.create({
          ...validUserParams,
          email: longEmail,
        }),
      ).rejects.toThrow('Email must not exceed 255 characters');
    });

    it('should normalize email via value object', async () => {
      const user = await User.create({
        ...validUserParams,
        email: '  JOHN.DOE@ACME.COM  ',
      });

      expect(user.email).toBe('john.doe@acme.com');
    });
  });

  describe('getters', () => {
    it('should expose all required getters', async () => {
      const user = await User.create(validUserParams);

      expect(user.id).toBeDefined();
      expect(user.email).toBe('john.doe@acme.com');
      expect(user.passwordHash).toBe(hashedPassword);
      expect(user.name).toBe('John Doe');
      expect(user.role).toBe('OPERATOR');
      expect(user.status).toBe('PENDING');
      expect(user.emailVerified).toBe(false);
      expect(user.emailVerificationCode).toBeDefined();
      expect(user.emailVerificationExpires).toBeInstanceOf(Date);
      expect(user.passwordResetToken).toBeNull();
      expect(user.passwordResetExpires).toBeNull();
      expect(user.lastLoginAt).toBeNull();
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });
  });
});
