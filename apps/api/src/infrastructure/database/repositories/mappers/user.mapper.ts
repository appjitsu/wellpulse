/**
 * User Mapper
 *
 * Converts between domain entities (User) and database records (TenantUser).
 * Follows hexagonal architecture pattern where domain entities are reconstituted
 * from persistence layer.
 */

import {
  User,
  UserRole,
  UserStatus,
} from '../../../../domain/users/user.entity';
import { TenantUser } from '../../schema/tenant/users.schema';

export class UserMapper {
  /**
   * Convert database record to User domain entity
   * Uses User.reconstitute() to restore entity from persistence
   */
  static toDomain(record: TenantUser): User {
    return User.reconstitute({
      id: record.id,
      email: record.email,
      passwordHash: record.passwordHash,
      name: record.name,
      role: record.role as UserRole,
      status: record.status as UserStatus,
      emailVerified: record.emailVerified ?? false,
      emailVerificationCode: record.emailVerificationCode ?? null,
      emailVerificationExpires: record.emailVerificationExpires ?? null,
      passwordResetToken: record.passwordResetToken ?? null,
      passwordResetExpires: record.passwordResetExpires ?? null,
      lastLoginAt: record.lastLoginAt ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  /**
   * Convert User domain entity to database record format
   * Extracts primitive values for database persistence
   */
  static toPersistence(
    user: User,
  ): Omit<TenantUser, 'refreshTokenHash' | 'deletedBy'> {
    return {
      id: user.id,
      email: user.email, // Email value object automatically extracted via getter
      passwordHash: user.passwordHash,
      name: user.name,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      emailVerificationCode: user.emailVerificationCode,
      emailVerificationExpires: user.emailVerificationExpires,
      passwordResetToken: user.passwordResetToken,
      passwordResetExpires: user.passwordResetExpires,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: null, // Always null when saving (soft delete handled separately)
    };
  }
}
