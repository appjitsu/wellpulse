/**
 * Get All Users Query Handler
 *
 * Fetches users across all tenants or for a specific tenant.
 * Aggregates results from multiple tenant databases.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetAllUsersQuery } from './get-all-users.query';
import { IUserRepository } from '../../../../domain/repositories/user.repository.interface';
import { ITenantRepository } from '../../../../domain/repositories/tenant.repository.interface';
import { Inject } from '@nestjs/common';

interface UserWithTenant {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  tenantName: string;
  role: string;
  status: string;
  emailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

@QueryHandler(GetAllUsersQuery)
export class GetAllUsersHandler implements IQueryHandler<GetAllUsersQuery> {
  constructor(
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
    @Inject('ITenantRepository')
    private readonly tenantRepository: ITenantRepository,
  ) {}

  async execute(query: GetAllUsersQuery): Promise<{
    users: UserWithTenant[];
    total: number;
    page: number;
    limit: number;
  }> {
    const offset = (query.page - 1) * query.limit;

    // If tenantId is specified, query only that tenant
    if (query.tenantId) {
      return this.getUsersForTenant(
        query.tenantId,
        query.limit,
        offset,
        query.role,
        query.status,
        query.search,
      );
    }

    // Otherwise, get users from all tenants
    return this.getUsersAcrossAllTenants(
      query.limit,
      offset,
      query.role,
      query.status,
      query.search,
    );
  }

  /**
   * Get users for a specific tenant
   */
  private async getUsersForTenant(
    tenantId: string,
    limit: number,
    offset: number,
    role?: string,
    status?: string,
    search?: string,
  ): Promise<{
    users: UserWithTenant[];
    total: number;
    page: number;
    limit: number;
  }> {
    // Get tenant information
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) {
      return { users: [], total: 0, page: 1, limit };
    }

    // Get users from tenant's database
    const users = await this.userRepository.findAll(tenantId, {
      role,
      status,
      limit,
      offset,
      databaseName: tenant.databaseConfig.name,
    });

    // Get total count
    const total = await this.userRepository.count(tenantId, {
      role,
      status,
      databaseName: tenant.databaseConfig.name,
    });

    // Map users to include tenant information
    const usersWithTenant: UserWithTenant[] = users
      .filter((user) => {
        // Apply search filter if provided
        if (search) {
          const searchLower = search.toLowerCase();
          const fullName = `${user.name}`.toLowerCase();
          return (
            user.email.toLowerCase().includes(searchLower) ||
            fullName.includes(searchLower)
          );
        }
        return true;
      })
      .map((user) => ({
        id: user.id,
        email: user.email,
        firstName: user.name.split(' ')[0] || user.name,
        lastName: user.name.split(' ').slice(1).join(' ') || '',
        tenantId: tenant.id,
        tenantName: tenant.name,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      }));

    return {
      users: usersWithTenant,
      total: search ? usersWithTenant.length : total,
      page: Math.floor(offset / limit) + 1,
      limit,
    };
  }

  /**
   * Get users across all tenants
   * Note: This is less efficient as it requires querying multiple databases
   */
  private async getUsersAcrossAllTenants(
    limit: number,
    offset: number,
    role?: string,
    status?: string,
    search?: string,
  ): Promise<{
    users: UserWithTenant[];
    total: number;
    page: number;
    limit: number;
  }> {
    // Get all active tenants
    // We'll fetch more than the limit to account for filtering
    const { tenants } = await this.tenantRepository.findAll({
      page: 1,
      limit: 1000, // Get all tenants (adjust if you have more than 1000)
      status: 'ACTIVE',
    });

    // Fetch users from each tenant in parallel
    const usersPromises = tenants.map(async (tenant) => {
      try {
        const users = await this.userRepository.findAll(tenant.id, {
          role,
          status,
          limit: 1000, // Get all users from each tenant for aggregation
          offset: 0,
          databaseName: tenant.databaseConfig.name,
        });

        return users.map((user) => ({
          id: user.id,
          email: user.email,
          firstName: user.name.split(' ')[0] || user.name,
          lastName: user.name.split(' ').slice(1).join(' ') || '',
          tenantId: tenant.id,
          tenantName: tenant.name,
          role: user.role,
          status: user.status,
          emailVerified: user.emailVerified,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
        }));
      } catch (error: unknown) {
        // If a tenant database is unavailable, log and continue
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.error(
          `Failed to fetch users for tenant ${tenant.id}: ${errorMessage}`,
        );
        return [];
      }
    });

    const userArrays = await Promise.all(usersPromises);
    let allUsers = userArrays.flat();

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      allUsers = allUsers.filter((user) => {
        const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
        return (
          user.email.toLowerCase().includes(searchLower) ||
          fullName.includes(searchLower) ||
          user.tenantName.toLowerCase().includes(searchLower)
        );
      });
    }

    // Sort by creation date (newest first)
    allUsers.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const total = allUsers.length;
    const paginatedUsers = allUsers.slice(offset, offset + limit);

    return {
      users: paginatedUsers,
      total,
      page: Math.floor(offset / limit) + 1,
      limit,
    };
  }
}
