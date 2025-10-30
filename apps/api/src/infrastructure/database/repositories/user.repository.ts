/**
 * User Repository Implementation
 *
 * Drizzle ORM implementation of IUserRepository.
 * Handles conversion between domain entities and database records using UserMapper.
 *
 * Multi-Tenancy Architecture:
 * - Requires tenantId for all operations to ensure tenant isolation
 * - Uses TenantDatabaseService to get tenant-specific database connection
 * - Each tenant has their own isolated users table in their dedicated database
 */

import { Injectable } from '@nestjs/common';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { User } from '../../../domain/users/user.entity';
import { UserMapper } from './mappers/user.mapper';
import { tenantUsers } from '../schema/tenant/users.schema';
import { TenantDatabaseService } from '../tenant-database.service';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly tenantDbService: TenantDatabaseService) {}

  /**
   * Save a new user to tenant database
   */
  async save(
    tenantId: string,
    user: User,
    databaseName?: string,
  ): Promise<void> {
    const db = await this.tenantDbService.getTenantDatabase(
      tenantId,
      databaseName,
    );
    const data = UserMapper.toPersistence(user);

    await db.insert(tenantUsers).values(data);
  }

  /**
   * Find user by ID within tenant
   * Respects soft deletes (deletedAt must be null)
   */
  async findById(
    tenantId: string,
    userId: string,
    databaseName?: string,
  ): Promise<User | null> {
    const db = await this.tenantDbService.getTenantDatabase(
      tenantId,
      databaseName,
    );

    const results = await db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.id, userId), isNull(tenantUsers.deletedAt)))
      .limit(1);

    return results[0] ? UserMapper.toDomain(results[0]) : null;
  }

  /**
   * Find user by email within tenant
   * Respects soft deletes (deletedAt must be null)
   */
  async findByEmail(
    tenantId: string,
    email: string,
    databaseName?: string,
  ): Promise<User | null> {
    const db = await this.tenantDbService.getTenantDatabase(
      tenantId,
      databaseName,
    );

    const results = await db
      .select()
      .from(tenantUsers)
      .where(
        and(
          eq(tenantUsers.email, email.toLowerCase().trim()),
          isNull(tenantUsers.deletedAt),
        ),
      )
      .limit(1);

    return results[0] ? UserMapper.toDomain(results[0]) : null;
  }

  /**
   * Find all users within tenant with optional filters
   * Supports pagination, role filtering, and status filtering
   */
  async findAll(
    tenantId: string,
    filters?: {
      role?: string;
      status?: string;
      limit?: number;
      offset?: number;
      databaseName?: string;
    },
  ): Promise<User[]> {
    const db = await this.tenantDbService.getTenantDatabase(
      tenantId,
      filters?.databaseName,
    );

    const conditions = [isNull(tenantUsers.deletedAt)];

    if (filters?.role) {
      conditions.push(eq(tenantUsers.role, filters.role));
    }

    if (filters?.status) {
      conditions.push(eq(tenantUsers.status, filters.status));
    }

    const whereClause = and(...conditions);

    const results = await db
      .select()
      .from(tenantUsers)
      .where(whereClause)
      .limit(filters?.limit ?? 100)
      .offset(filters?.offset ?? 0);

    return results.map((r) => UserMapper.toDomain(r));
  }

  /**
   * Count users within tenant with optional filters
   */
  async count(
    tenantId: string,
    filters?: { role?: string; status?: string; databaseName?: string },
  ): Promise<number> {
    const db = await this.tenantDbService.getTenantDatabase(
      tenantId,
      filters?.databaseName,
    );

    const conditions = [isNull(tenantUsers.deletedAt)];

    if (filters?.role) {
      conditions.push(eq(tenantUsers.role, filters.role));
    }

    if (filters?.status) {
      conditions.push(eq(tenantUsers.status, filters.status));
    }

    const whereClause = and(...conditions);

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenantUsers)
      .where(whereClause);

    return Number(result[0]?.count ?? 0);
  }

  /**
   * Update existing user in tenant database
   * Updates all user properties except ID and createdAt
   */
  async update(
    tenantId: string,
    user: User,
    databaseName?: string,
  ): Promise<void> {
    const db = await this.tenantDbService.getTenantDatabase(
      tenantId,
      databaseName,
    );
    const data = UserMapper.toPersistence(user);

    await db
      .update(tenantUsers)
      .set({
        email: data.email,
        passwordHash: data.passwordHash,
        name: data.name,
        role: data.role,
        status: data.status,
        emailVerified: data.emailVerified,
        emailVerificationCode: data.emailVerificationCode,
        emailVerificationExpires: data.emailVerificationExpires,
        passwordResetToken: data.passwordResetToken,
        passwordResetExpires: data.passwordResetExpires,
        lastLoginAt: data.lastLoginAt,
        azureObjectId: data.azureObjectId,
        ssoProvider: data.ssoProvider,
        updatedAt: new Date(),
      })
      .where(eq(tenantUsers.id, user.id));
  }

  /**
   * Delete user (soft delete) in tenant database
   * Sets deletedAt timestamp instead of removing record
   */
  async delete(
    tenantId: string,
    userId: string,
    databaseName?: string,
  ): Promise<void> {
    const db = await this.tenantDbService.getTenantDatabase(
      tenantId,
      databaseName,
    );

    await db
      .update(tenantUsers)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tenantUsers.id, userId));
  }

  /**
   * Check if email exists within tenant
   * Respects soft deletes (deletedAt must be null)
   */
  async existsByEmail(
    tenantId: string,
    email: string,
    databaseName?: string,
  ): Promise<boolean> {
    const user = await this.findByEmail(tenantId, email, databaseName);
    return user !== null;
  }

  /**
   * Find user by Azure AD object ID within tenant
   * Respects soft deletes (deletedAt must be null)
   */
  async findByAzureObjectId(
    tenantId: string,
    azureObjectId: string,
    databaseName?: string,
  ): Promise<User | null> {
    const db = await this.tenantDbService.getTenantDatabase(
      tenantId,
      databaseName,
    );

    const results = await db
      .select()
      .from(tenantUsers)
      .where(
        and(
          eq(tenantUsers.azureObjectId, azureObjectId),
          isNull(tenantUsers.deletedAt),
        ),
      )
      .limit(1);

    return results[0] ? UserMapper.toDomain(results[0]) : null;
  }
}
