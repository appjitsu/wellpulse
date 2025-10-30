import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Email } from './value-objects/email.vo';

export type UserRole = 'ADMIN' | 'MANAGER' | 'OPERATOR';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';

export interface CreateUserParams {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

/**
 * User Domain Entity
 *
 * Represents a user within a tenant's system.
 * Encapsulates authentication, authorization, and user lifecycle business logic.
 *
 * Business Rules:
 * - Email must be unique within tenant
 * - Password must be hashed (bcrypt, 12 rounds)
 * - Email verification required before ACTIVE status
 * - First user in tenant automatically becomes ADMIN
 * - Verification codes expire after 24 hours
 * - Password reset tokens expire after 1 hour
 */
export class User {
  private constructor(
    public readonly id: string,
    private _email: Email,
    private _passwordHash: string,
    private _name: string,
    private _role: UserRole,
    private _status: UserStatus,
    private _emailVerified: boolean,
    private _emailVerificationCode: string | null,
    private _emailVerificationExpires: Date | null,
    private _passwordResetToken: string | null,
    private _passwordResetExpires: Date | null,
    private _lastLoginAt: Date | null,
    private _azureObjectId: string | null,
    private _ssoProvider: string | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {}

  /**
   * Create a new User entity
   */
  static async create(params: CreateUserParams, id?: string): Promise<User> {
    const email = Email.create(params.email);

    // Validate password strength
    User.validatePassword(params.password);

    const passwordHash = await bcrypt.hash(params.password, 12);

    // Generate 6-digit verification code
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    return new User(
      id ?? crypto.randomUUID(),
      email,
      passwordHash,
      params.name,
      params.role ?? 'OPERATOR',
      'PENDING',
      false,
      verificationCode,
      verificationExpires,
      null,
      null,
      null,
      null, // azureObjectId
      null, // ssoProvider
      new Date(),
      new Date(),
    );
  }

  /**
   * Reconstitute User entity from persistence
   */
  static reconstitute(data: {
    id: string;
    email: string;
    passwordHash: string;
    name: string;
    role: UserRole;
    status: UserStatus;
    emailVerified: boolean;
    emailVerificationCode: string | null;
    emailVerificationExpires: Date | null;
    passwordResetToken: string | null;
    passwordResetExpires: Date | null;
    lastLoginAt: Date | null;
    azureObjectId?: string | null;
    ssoProvider?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return new User(
      data.id,
      Email.create(data.email),
      data.passwordHash,
      data.name,
      data.role,
      data.status,
      data.emailVerified,
      data.emailVerificationCode,
      data.emailVerificationExpires,
      data.passwordResetToken,
      data.passwordResetExpires,
      data.lastLoginAt,
      data.azureObjectId ?? null,
      data.ssoProvider ?? null,
      data.createdAt,
      data.updatedAt,
    );
  }

  // Getters
  get email(): string {
    return this._email.value;
  }

  get passwordHash(): string {
    return this._passwordHash;
  }

  get name(): string {
    return this._name;
  }

  get role(): UserRole {
    return this._role;
  }

  get status(): UserStatus {
    return this._status;
  }

  get emailVerified(): boolean {
    return this._emailVerified;
  }

  get emailVerificationCode(): string | null {
    return this._emailVerificationCode;
  }

  get emailVerificationExpires(): Date | null {
    return this._emailVerificationExpires;
  }

  get passwordResetToken(): string | null {
    return this._passwordResetToken;
  }

  get passwordResetExpires(): Date | null {
    return this._passwordResetExpires;
  }

  get lastLoginAt(): Date | null {
    return this._lastLoginAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get azureObjectId(): string | null {
    return this._azureObjectId;
  }

  get ssoProvider(): string | null {
    return this._ssoProvider;
  }

  // Business Logic Methods

  /**
   * Verify password against stored hash
   */
  async verifyPassword(plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, this._passwordHash);
  }

  /**
   * Verify email with verification code
   *
   * Business rules:
   * - Code must match exactly
   * - Code must not be expired
   * - After verification, user status becomes ACTIVE
   */
  verifyEmail(code: string): void {
    if (!this._emailVerificationCode) {
      throw new Error('No verification code set for this user');
    }

    if (
      this._emailVerificationExpires &&
      new Date() > this._emailVerificationExpires
    ) {
      throw new Error('Verification code has expired');
    }

    if (code !== this._emailVerificationCode) {
      throw new Error('Invalid verification code');
    }

    this._emailVerified = true;
    this._emailVerificationCode = null;
    this._emailVerificationExpires = null;
    this._status = 'ACTIVE';
    this._updatedAt = new Date();
  }

  /**
   * Resend email verification code
   * Generates a new code with fresh expiry
   */
  resendVerificationCode(): void {
    if (this._emailVerified) {
      throw new Error('Email is already verified');
    }

    this._emailVerificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    this._emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    this._updatedAt = new Date();
  }

  /**
   * Generate password reset token
   * Token expires in 1 hour
   */
  generatePasswordResetToken(): string {
    const token = crypto.randomUUID();
    this._passwordResetToken = token;
    this._passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    this._updatedAt = new Date();
    return token;
  }

  /**
   * Reset password with token
   *
   * Business rules:
   * - Token must match
   * - Token must not be expired
   * - New password must meet strength requirements
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!this._passwordResetToken || this._passwordResetToken !== token) {
      throw new Error('Invalid password reset token');
    }

    if (this._passwordResetExpires && new Date() > this._passwordResetExpires) {
      throw new Error('Password reset token has expired');
    }

    // Validate new password strength
    User.validatePassword(newPassword);

    this._passwordHash = await bcrypt.hash(newPassword, 12);
    this._passwordResetToken = null;
    this._passwordResetExpires = null;
    this._updatedAt = new Date();
  }

  /**
   * Change password (authenticated user)
   */
  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const isValid = await this.verifyPassword(currentPassword);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    User.validatePassword(newPassword);

    this._passwordHash = await bcrypt.hash(newPassword, 12);
    this._updatedAt = new Date();
  }

  /**
   * Activate user account
   */
  activate(): void {
    if (this._status === 'ACTIVE') {
      return; // Already active
    }

    if (!this._emailVerified) {
      throw new Error('Cannot activate user without email verification');
    }

    this._status = 'ACTIVE';
    this._updatedAt = new Date();
  }

  /**
   * Suspend user account
   */
  suspend(): void {
    this._status = 'SUSPENDED';
    this._updatedAt = new Date();
  }

  /**
   * Update last login timestamp
   */
  updateLastLogin(): void {
    this._lastLoginAt = new Date();
    this._updatedAt = new Date();
  }

  /**
   * Change user role (Admin only)
   */
  changeRole(newRole: UserRole): void {
    this._role = newRole;
    this._updatedAt = new Date();
  }

  /**
   * Update user role (used by SSO login to sync Azure AD groups)
   */
  updateRole(newRole: UserRole): void {
    this._role = newRole;
    this._updatedAt = new Date();
  }

  /**
   * Set Azure AD integration fields
   */
  setAzureAd(azureObjectId: string): void {
    this._azureObjectId = azureObjectId;
    this._ssoProvider = 'azure-ad';
    this._updatedAt = new Date();
  }

  /**
   * Mark email as verified (for SSO users)
   */
  markEmailAsVerified(): void {
    this._emailVerified = true;
    this._emailVerificationCode = null;
    this._emailVerificationExpires = null;
    this._updatedAt = new Date();
  }

  /**
   * Update user name
   */
  updateName(newName: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new Error('Name cannot be empty');
    }

    this._name = newName.trim();
    this._updatedAt = new Date();
  }

  /**
   * Validate password strength
   *
   * Business rules:
   * - Minimum 8 characters
   * - At least one uppercase letter
   * - At least one lowercase letter
   * - At least one number
   * - At least one special character
   */
  private static validatePassword(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      throw new Error('Password must contain at least one special character');
    }
  }
}
