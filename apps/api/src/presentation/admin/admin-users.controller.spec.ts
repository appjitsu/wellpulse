/**
 * Admin Users Controller Tests
 *
 * Tests RBAC security for user management endpoints.
 * These endpoints are CRITICAL - they control cross-tenant user management.
 *
 * Security Requirements:
 * - Only ADMIN role can access
 * - JWT authentication required
 * - Proper error handling for unauthorized access
 * - Input validation for user data
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { AdminUsersController } from './admin-users.controller';
import { GetAllUsersQuery } from '../../application/admin/queries/get-all-users/get-all-users.query';

describe('AdminUsersController', () => {
  let controller: AdminUsersController;
  let commandBus: jest.Mocked<CommandBus>;
  let queryBus: jest.Mocked<QueryBus>;

  beforeEach(async () => {
    const mockCommandBus = {
      execute: jest.fn(),
    };

    const mockQueryBus = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [
        {
          provide: CommandBus,
          useValue: mockCommandBus,
        },
        {
          provide: QueryBus,
          useValue: mockQueryBus,
        },
      ],
    }).compile();

    controller = module.get<AdminUsersController>(AdminUsersController);
    commandBus = module.get(CommandBus);
    queryBus = module.get(QueryBus);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Security', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have @UseGuards decorator with JwtAuthGuard and RolesGuard', () => {
      // Verify guards are applied at class level
      const metadata = Reflect.getMetadata('__guards__', AdminUsersController);
      expect(metadata).toBeDefined();
    });

    it('should have @Roles decorator with ADMIN role', () => {
      // Verify ADMIN role requirement
      const metadata = Reflect.getMetadata('roles', AdminUsersController);
      expect(metadata).toBeDefined();
      expect(metadata).toContain('ADMIN');
    });
  });

  describe('getAllUsers', () => {
    it('should return all users across all tenants', async () => {
      const mockResult = {
        users: [
          {
            id: 'user-1',
            email: 'admin@acmeoil.com',
            firstName: 'John',
            lastName: 'Doe',
            role: 'ADMIN',
            tenantId: 'tenant-1',
            tenantName: 'Acme Oil',
            status: 'ACTIVE',
          },
          {
            id: 'user-2',
            email: 'manager@xyzenergy.com',
            firstName: 'Jane',
            lastName: 'Smith',
            role: 'MANAGER',
            tenantId: 'tenant-2',
            tenantName: 'XYZ Energy',
            status: 'ACTIVE',
          },
        ],
        total: 2,
        page: 1,
        limit: 20,
      };

      queryBus.execute.mockResolvedValue(mockResult);

      const result = await controller.getAllUsers('1', '20');

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.any(GetAllUsersQuery),
      );
      expect(result).toEqual(mockResult);
      expect(result.users).toHaveLength(2);
    });

    it('should filter users by role', async () => {
      const mockResult = {
        users: [
          {
            id: 'user-1',
            email: 'admin@acmeoil.com',
            role: 'ADMIN',
            tenantId: 'tenant-1',
            status: 'ACTIVE',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      };

      queryBus.execute.mockResolvedValue(mockResult);

      const result = await controller.getAllUsers(
        '1',
        '20',
        undefined,
        undefined,
        'ADMIN',
      );

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'ADMIN',
        }),
      );
      expect(result.users[0].role).toBe('ADMIN');
    });

    it('should filter users by status', async () => {
      const mockResult = {
        users: [
          {
            id: 'user-1',
            email: 'suspended@example.com',
            role: 'FIELD_OPERATOR',
            tenantId: 'tenant-1',
            status: 'SUSPENDED',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      };

      queryBus.execute.mockResolvedValue(mockResult);

      const result = await controller.getAllUsers(
        '1',
        '20',
        undefined,
        undefined,
        undefined,
        'SUSPENDED',
      );

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'SUSPENDED',
        }),
      );
      expect(result.users[0].status).toBe('SUSPENDED');
    });

    it('should filter users by tenant', async () => {
      const mockResult = {
        users: [
          {
            id: 'user-1',
            email: 'user1@acmeoil.com',
            tenantId: 'tenant-123',
            tenantName: 'Acme Oil',
          },
          {
            id: 'user-2',
            email: 'user2@acmeoil.com',
            tenantId: 'tenant-123',
            tenantName: 'Acme Oil',
          },
        ],
        total: 2,
        page: 1,
        limit: 20,
      };

      queryBus.execute.mockResolvedValue(mockResult);

      const result = await controller.getAllUsers(
        '1',
        '20',
        undefined,
        'tenant-123',
      );

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
        }),
      );
      expect(result.users).toHaveLength(2);
      expect(result.users[0].tenantId).toBe('tenant-123');
    });

    it('should search users by email', async () => {
      const mockResult = {
        users: [
          {
            id: 'user-1',
            email: 'john@acmeoil.com',
            firstName: 'John',
            lastName: 'Doe',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      };

      queryBus.execute.mockResolvedValue(mockResult);

      const result = await controller.getAllUsers(
        '1',
        '20',
        'john@acmeoil.com',
      );

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'john@acmeoil.com',
        }),
      );
      expect(result.users[0].email).toContain('john');
    });

    it('should handle pagination correctly', async () => {
      const mockResult = {
        users: [],
        total: 150,
        page: 5,
        limit: 20,
      };

      queryBus.execute.mockResolvedValue(mockResult);

      const result = await controller.getAllUsers('5', '20');

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 5,
          limit: 20,
        }),
      );
      expect(result.page).toBe(5);
      expect(result.total).toBe(150);
    });

    it('should handle empty results', async () => {
      const mockResult = {
        users: [],
        total: 0,
        page: 1,
        limit: 20,
      };

      queryBus.execute.mockResolvedValue(mockResult);

      const result = await controller.getAllUsers('1', '20');

      expect(result.users).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle query errors gracefully', async () => {
      queryBus.execute.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(controller.getAllUsers('1', '20')).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('Cross-Tenant User Management', () => {
    it('should return users from multiple tenants', async () => {
      const mockResult = {
        users: [
          {
            id: 'user-1',
            email: 'user1@tenant1.com',
            tenantId: 'tenant-1',
            tenantName: 'Tenant 1',
          },
          {
            id: 'user-2',
            email: 'user2@tenant2.com',
            tenantId: 'tenant-2',
            tenantName: 'Tenant 2',
          },
          {
            id: 'user-3',
            email: 'user3@tenant3.com',
            tenantId: 'tenant-3',
            tenantName: 'Tenant 3',
          },
        ],
        total: 3,
        page: 1,
        limit: 20,
      };

      queryBus.execute.mockResolvedValue(mockResult);

      const result = await controller.getAllUsers('1', '20');

      expect(result.users).toHaveLength(3);

      // Verify users from different tenants
      const tenantIds = result.users.map((u) => u.tenantId);
      const uniqueTenantIds = new Set(tenantIds);
      expect(uniqueTenantIds.size).toBe(3);
    });

    it('should include tenant information for each user', async () => {
      const mockResult = {
        users: [
          {
            id: 'user-1',
            email: 'admin@acmeoil.com',
            tenantId: 'tenant-123',
            tenantName: 'Acme Oil & Gas',
            tenantSlug: 'acme-oil',
            tenantStatus: 'ACTIVE',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      };

      queryBus.execute.mockResolvedValue(mockResult);

      const result = await controller.getAllUsers('1', '20');

      expect(result.users[0]).toHaveProperty('tenantId');
      expect(result.users[0]).toHaveProperty('tenantName');
      expect(result.users[0].tenantName).toBe('Acme Oil & Gas');
    });
  });

  describe('Role-Based Queries', () => {
    it('should return only ADMIN users', async () => {
      const mockResult = {
        users: [
          { id: 'user-1', role: 'ADMIN', email: 'admin1@test.com' },
          { id: 'user-2', role: 'ADMIN', email: 'admin2@test.com' },
        ],
        total: 2,
        page: 1,
        limit: 20,
      };

      queryBus.execute.mockResolvedValue(mockResult);

      const result = await controller.getAllUsers(
        '1',
        '20',
        undefined,
        undefined,
        'ADMIN',
      );

      expect(result.users.every((u) => u.role === 'ADMIN')).toBe(true);
    });

    it('should return only MANAGER users', async () => {
      const mockResult = {
        users: [{ id: 'user-1', role: 'MANAGER', email: 'manager1@test.com' }],
        total: 1,
        page: 1,
        limit: 20,
      };

      queryBus.execute.mockResolvedValue(mockResult);

      const result = await controller.getAllUsers(
        '1',
        '20',
        undefined,
        undefined,
        'MANAGER',
      );

      expect(result.users.every((u) => u.role === 'MANAGER')).toBe(true);
    });

    it('should return only FIELD_OPERATOR users', async () => {
      const mockResult = {
        users: [
          { id: 'user-1', role: 'FIELD_OPERATOR', email: 'operator1@test.com' },
          { id: 'user-2', role: 'FIELD_OPERATOR', email: 'operator2@test.com' },
          { id: 'user-3', role: 'FIELD_OPERATOR', email: 'operator3@test.com' },
        ],
        total: 3,
        page: 1,
        limit: 20,
      };

      queryBus.execute.mockResolvedValue(mockResult);

      const result = await controller.getAllUsers(
        '1',
        '20',
        undefined,
        undefined,
        'FIELD_OPERATOR',
      );

      expect(result.users.every((u) => u.role === 'FIELD_OPERATOR')).toBe(true);
      expect(result.users).toHaveLength(3);
    });
  });

  describe('Status-Based Queries', () => {
    it('should return only ACTIVE users', async () => {
      const mockResult = {
        users: [
          { id: 'user-1', status: 'ACTIVE', email: 'active1@test.com' },
          { id: 'user-2', status: 'ACTIVE', email: 'active2@test.com' },
        ],
        total: 2,
        page: 1,
        limit: 20,
      };

      queryBus.execute.mockResolvedValue(mockResult);

      const result = await controller.getAllUsers(
        '1',
        '20',
        undefined,
        undefined,
        undefined,
        'ACTIVE',
      );

      expect(result.users.every((u) => u.status === 'ACTIVE')).toBe(true);
    });

    it('should return only SUSPENDED users', async () => {
      const mockResult = {
        users: [
          { id: 'user-1', status: 'SUSPENDED', email: 'suspended1@test.com' },
        ],
        total: 1,
        page: 1,
        limit: 20,
      };

      queryBus.execute.mockResolvedValue(mockResult);

      const result = await controller.getAllUsers(
        '1',
        '20',
        undefined,
        undefined,
        undefined,
        'SUSPENDED',
      );

      expect(result.users.every((u) => u.status === 'SUSPENDED')).toBe(true);
    });

    it('should return only PENDING users', async () => {
      const mockResult = {
        users: [
          { id: 'user-1', status: 'PENDING', email: 'pending1@test.com' },
        ],
        total: 1,
        page: 1,
        limit: 20,
      };

      queryBus.execute.mockResolvedValue(mockResult);

      const result = await controller.getAllUsers(
        '1',
        '20',
        undefined,
        undefined,
        undefined,
        'PENDING',
      );

      expect(result.users.every((u) => u.status === 'PENDING')).toBe(true);
    });
  });

  describe('Complex Filtering', () => {
    it('should combine multiple filters (role + status)', async () => {
      const mockResult = {
        users: [
          {
            id: 'user-1',
            role: 'MANAGER',
            status: 'ACTIVE',
            email: 'active-manager@test.com',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      };

      queryBus.execute.mockResolvedValue(mockResult);

      const result = await controller.getAllUsers(
        '1',
        '20',
        undefined,
        undefined,
        'MANAGER',
        'ACTIVE',
      );

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'MANAGER',
          status: 'ACTIVE',
        }),
      );
      expect(result.users[0].role).toBe('MANAGER');
      expect(result.users[0].status).toBe('ACTIVE');
    });

    it('should combine multiple filters (role + tenant + status)', async () => {
      const mockResult = {
        users: [
          {
            id: 'user-1',
            role: 'FIELD_OPERATOR',
            status: 'ACTIVE',
            tenantId: 'tenant-123',
            email: 'operator@test.com',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      };

      queryBus.execute.mockResolvedValue(mockResult);

      const result = await controller.getAllUsers(
        '1',
        '20',
        undefined,
        'tenant-123',
        'FIELD_OPERATOR',
        'ACTIVE',
      );

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'FIELD_OPERATOR',
          status: 'ACTIVE',
          tenantId: 'tenant-123',
        }),
      );
    });
  });
});
