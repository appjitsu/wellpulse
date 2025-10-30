/**
 * User Repository Interface
 *
 * Domain layer contract for user persistence.
 * Implementation will be in infrastructure layer using Drizzle ORM.
 *
 * All operations are tenant-scoped for multi-tenancy isolation.
 */

import { User } from '../users/user.entity';

export interface IUserRepository {
  /**
   * Save a new user to the tenant database
   */
  save(tenantId: string, user: User, databaseName?: string): Promise<void>;

  /**
   * Find user by ID within tenant
   */
  findById(
    tenantId: string,
    userId: string,
    databaseName?: string,
  ): Promise<User | null>;

  /**
   * Find user by email within tenant
   */
  findByEmail(
    tenantId: string,
    email: string,
    databaseName?: string,
  ): Promise<User | null>;

  /**
   * Find all users in tenant with optional filters
   */
  findAll(
    tenantId: string,
    filters?: {
      role?: string;
      status?: string;
      limit?: number;
      offset?: number;
      databaseName?: string;
    },
  ): Promise<User[]>;

  /**
   * Count users in tenant with optional filters
   */
  count(
    tenantId: string,
    filters?: { role?: string; status?: string; databaseName?: string },
  ): Promise<number>;

  /**
   * Update existing user
   */
  update(tenantId: string, user: User, databaseName?: string): Promise<void>;

  /**
   * Soft delete user
   */
  delete(
    tenantId: string,
    userId: string,
    databaseName?: string,
  ): Promise<void>;

  /**
   * Check if email exists within tenant
   */
  existsByEmail(
    tenantId: string,
    email: string,
    databaseName?: string,
  ): Promise<boolean>;

  /**
   * Find user by Azure AD object ID within tenant
   */
  findByAzureObjectId(
    tenantId: string,
    azureObjectId: string,
    databaseName?: string,
  ): Promise<User | null>;
}
