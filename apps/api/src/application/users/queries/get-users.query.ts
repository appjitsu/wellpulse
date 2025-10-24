/**
 * Get Users Query
 *
 * Retrieves all users for a tenant with optional filtering.
 * Admin-only operation.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { User } from '../../../domain/users/user.entity';

export class GetUsersQuery {
  constructor(
    public readonly tenantId: string,
    public readonly filters?: {
      role?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
  ) {}
}

export interface GetUsersResult {
  users: {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    emailVerified: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
  }[];
  total: number;
}

@QueryHandler(GetUsersQuery)
export class GetUsersHandler implements IQueryHandler<GetUsersQuery> {
  constructor(
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(query: GetUsersQuery): Promise<GetUsersResult> {
    const users = await this.userRepository.findAll(
      query.tenantId,
      query.filters,
    );

    const total = await this.userRepository.count(query.tenantId, {
      role: query.filters?.role,
      status: query.filters?.status,
    });

    return {
      users: users.map((user) => this.toDto(user)),
      total,
    };
  }

  private toDto(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}
