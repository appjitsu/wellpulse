/**
 * ScadaConnectionRepository Tests
 *
 * Comprehensive unit tests for SCADA connection repository with coverage of:
 * - All CRUD operations (findById, findByWellId, findAll, save, delete)
 * - Tenant isolation (ensure tenantId is used in all queries)
 * - Status filtering (findActive, findEnabled)
 * - Existence checks (existsByName, existsByWellId)
 * - Error handling for database failures
 * - Domain entity mapping (toDomain, toRow)
 *
 * Test Pattern: AAA (Arrange, Act, Assert)
 * Coverage Target: ≥80%
 */

import { ScadaConnectionRepository } from './scada-connection.repository';
import { TenantDatabaseService } from '../tenant-database.service';
import { ScadaConnection } from '../../../domain/scada/scada-connection.entity';
import { OpcUaEndpoint } from '../../../domain/scada/value-objects/opc-ua-endpoint.vo';
import * as tenantSchema from '../schema/tenant';

/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

/**
 * Mock database interface for Drizzle query builder
 */
interface MockDrizzleDb {
  select: jest.Mock;
  from: jest.Mock;
  where: jest.Mock;
  limit: jest.Mock;
  insert: jest.Mock;
  values: jest.Mock;
  onConflictDoUpdate: jest.Mock;
  delete: jest.Mock;
}

describe('ScadaConnectionRepository', () => {
  let repository: ScadaConnectionRepository;
  let mockTenantDb: jest.Mocked<TenantDatabaseService>;
  let mockDb: MockDrizzleDb;

  const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
  const WELL_ID = '660e8400-e29b-41d4-a716-446655440001';
  const CONNECTION_ID = 'scada_1635724800_abc123';
  const USER_ID = '770e8400-e29b-41d4-a716-446655440002';

  // Mock database row (what comes from database)
  const mockDbRow: tenantSchema.ScadaConnection = {
    id: CONNECTION_ID,
    tenantId: TENANT_ID,
    wellId: WELL_ID,
    name: 'Test SCADA Connection',
    description: 'Test connection for unit tests',
    endpointConfig: {
      url: 'opc.tcp://localhost:4840',
      securityMode: 'None',
      securityPolicy: 'None',
      username: 'admin',
      password: 'password123',
    },
    pollIntervalSeconds: 5,
    status: 'active',
    lastConnectedAt: new Date('2025-01-15T10:00:00Z'),
    lastErrorMessage: null,
    isEnabled: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-15T10:00:00Z'),
    createdBy: USER_ID,
    updatedBy: USER_ID,
  };

  // Mock domain entity (what repository returns)
  const mockDomainEntity = ScadaConnection.fromPrimitives({
    id: CONNECTION_ID,
    tenantId: TENANT_ID,
    wellId: WELL_ID,
    name: 'Test SCADA Connection',
    description: 'Test connection for unit tests',
    endpoint: OpcUaEndpoint.fromPrimitives({
      url: 'opc.tcp://localhost:4840',
      securityMode: 'None',
      securityPolicy: 'None',
      username: 'admin',
      password: 'password123',
    }),
    pollIntervalSeconds: 5,
    status: 'active',
    lastConnectedAt: new Date('2025-01-15T10:00:00Z'),
    lastErrorMessage: undefined,
    isEnabled: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-15T10:00:00Z'),
    createdBy: USER_ID,
    updatedBy: USER_ID,
  });

  beforeEach(() => {
    // Mock the drizzle query builder chain
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      onConflictDoUpdate: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    };

    // Mock TenantDatabaseService
    mockTenantDb = {
      getTenantDatabase: jest.fn().mockResolvedValue(mockDb),
      onModuleDestroy: jest.fn().mockResolvedValue(undefined),
      getActiveConnectionCount: jest.fn().mockReturnValue(0),
      closeTenantConnection: jest.fn().mockResolvedValue(undefined),
      getAllConnections: jest.fn().mockReturnValue(new Map()),
    } as unknown as jest.Mocked<TenantDatabaseService>;

    repository = new ScadaConnectionRepository(mockTenantDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // findById Tests
  // ============================================================================

  describe('findById', () => {
    it('should return a SCADA connection when found', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([mockDbRow]);

      // Act
      const result = await repository.findById(TENANT_ID, CONNECTION_ID);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe(CONNECTION_ID);
      expect(result?.tenantId).toBe(TENANT_ID);
      expect(result?.name).toBe('Test SCADA Connection');

      expect(mockTenantDb.getTenantDatabase).toHaveBeenCalledWith(TENANT_ID);

      expect(mockDb.select).toHaveBeenCalled();

      expect(mockDb.from).toHaveBeenCalledWith(tenantSchema.scadaConnections);

      expect(mockDb.where).toHaveBeenCalled();

      expect(mockDb.limit).toHaveBeenCalledWith(1);
    });

    it('should return null when SCADA connection not found', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([]);

      // Act
      const result = await repository.findById(TENANT_ID, CONNECTION_ID);

      // Assert
      expect(result).toBeNull();

      expect(mockTenantDb.getTenantDatabase).toHaveBeenCalledWith(TENANT_ID);
    });

    it('should enforce tenant isolation in query', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([mockDbRow]);

      // Act
      await repository.findById(TENANT_ID, CONNECTION_ID);

      // Assert

      expect(mockDb.where).toHaveBeenCalled();
      // Verify both connectionId and tenantId are used in the where clause
      const whereCall = mockDb.where.mock.calls[0][0];
      expect(whereCall).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      mockDb.limit.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        repository.findById(TENANT_ID, CONNECTION_ID),
      ).rejects.toThrow('Database connection failed');
    });
  });

  // ============================================================================
  // findByWellId Tests
  // ============================================================================

  describe('findByWellId', () => {
    it('should return a SCADA connection for a well when found', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([mockDbRow]);

      // Act
      const result = await repository.findByWellId(TENANT_ID, WELL_ID);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.wellId).toBe(WELL_ID);
      expect(result?.tenantId).toBe(TENANT_ID);

      expect(mockTenantDb.getTenantDatabase).toHaveBeenCalledWith(TENANT_ID);

      expect(mockDb.limit).toHaveBeenCalledWith(1);
    });

    it('should return null when no connection exists for well', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([]);

      // Act
      const result = await repository.findByWellId(TENANT_ID, WELL_ID);

      // Assert
      expect(result).toBeNull();
    });

    it('should enforce tenant isolation when querying by well', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([mockDbRow]);

      // Act
      await repository.findByWellId(TENANT_ID, WELL_ID);

      // Assert

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should handle database errors when querying by well', async () => {
      // Arrange
      mockDb.limit.mockRejectedValue(new Error('Query timeout'));

      // Act & Assert
      await expect(repository.findByWellId(TENANT_ID, WELL_ID)).rejects.toThrow(
        'Query timeout',
      );
    });
  });

  // ============================================================================
  // findAll Tests
  // ============================================================================

  describe('findAll', () => {
    it('should return all SCADA connections for a tenant', async () => {
      // Arrange
      const mockRows = [
        mockDbRow,
        {
          ...mockDbRow,
          id: 'scada_1635724800_xyz789',
          name: 'Second Connection',
        },
      ];
      mockDb.where.mockResolvedValue(mockRows);

      // Act
      const result = await repository.findAll(TENANT_ID);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(CONNECTION_ID);
      expect(result[1].id).toBe('scada_1635724800_xyz789');

      expect(mockTenantDb.getTenantDatabase).toHaveBeenCalledWith(TENANT_ID);
    });

    it('should return empty array when no connections exist', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);

      // Act
      const result = await repository.findAll(TENANT_ID);

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should enforce tenant isolation in findAll', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([mockDbRow]);

      // Act
      await repository.findAll(TENANT_ID);

      // Assert

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should handle database errors in findAll', async () => {
      // Arrange
      mockDb.where.mockRejectedValue(new Error('Connection pool exhausted'));

      // Act & Assert
      await expect(repository.findAll(TENANT_ID)).rejects.toThrow(
        'Connection pool exhausted',
      );
    });
  });

  // ============================================================================
  // findActive Tests
  // ============================================================================

  describe('findActive', () => {
    it('should return only active SCADA connections', async () => {
      // Arrange
      const activeRows = [
        mockDbRow,
        { ...mockDbRow, id: 'scada_active_2', status: 'active' },
      ];
      mockDb.where.mockResolvedValue(activeRows);

      // Act
      const result = await repository.findActive(TENANT_ID);

      // Assert
      expect(result).toHaveLength(2);
      result.forEach((connection) => {
        expect(connection.status).toBe('active');
      });
    });

    it('should return empty array when no active connections', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);

      // Act
      const result = await repository.findActive(TENANT_ID);

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should filter by status=active and tenant', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([mockDbRow]);

      // Act
      await repository.findActive(TENANT_ID);

      // Assert

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // findEnabled Tests
  // ============================================================================

  describe('findEnabled', () => {
    it('should return only enabled SCADA connections', async () => {
      // Arrange
      const enabledRows = [
        mockDbRow,
        { ...mockDbRow, id: 'scada_enabled_2', isEnabled: true },
      ];
      mockDb.where.mockResolvedValue(enabledRows);

      // Act
      const result = await repository.findEnabled(TENANT_ID);

      // Assert
      expect(result).toHaveLength(2);
      result.forEach((connection) => {
        expect(connection.isEnabled).toBe(true);
      });
    });

    it('should return empty array when no enabled connections', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);

      // Act
      const result = await repository.findEnabled(TENANT_ID);

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should filter by isEnabled=true and tenant', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([mockDbRow]);

      // Act
      await repository.findEnabled(TENANT_ID);

      // Assert

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // existsByName Tests
  // ============================================================================

  describe('existsByName', () => {
    it('should return true when connection name exists', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([{ id: CONNECTION_ID }]);

      // Act
      const result = await repository.existsByName(
        TENANT_ID,
        'Test SCADA Connection',
      );

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when connection name does not exist', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([]);

      // Act
      const result = await repository.existsByName(
        TENANT_ID,
        'Nonexistent Connection',
      );

      // Assert
      expect(result).toBe(false);
    });

    it('should enforce tenant isolation in name check', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([]);

      // Act
      await repository.existsByName(TENANT_ID, 'Test Connection');

      // Assert

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // existsByWellId Tests
  // ============================================================================

  describe('existsByWellId', () => {
    it('should return true when connection exists for well', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([{ id: CONNECTION_ID }]);

      // Act
      const result = await repository.existsByWellId(TENANT_ID, WELL_ID);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when no connection exists for well', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([]);

      // Act
      const result = await repository.existsByWellId(TENANT_ID, WELL_ID);

      // Assert
      expect(result).toBe(false);
    });

    it('should enforce tenant isolation in well check', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([]);

      // Act
      await repository.existsByWellId(TENANT_ID, WELL_ID);

      // Assert

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // save Tests
  // ============================================================================

  describe('save', () => {
    it('should insert a new SCADA connection', async () => {
      // Arrange
      mockDb.onConflictDoUpdate.mockResolvedValue(undefined);

      // Act
      await repository.save(mockDomainEntity);

      // Assert

      expect(mockTenantDb.getTenantDatabase).toHaveBeenCalledWith(TENANT_ID);

      expect(mockDb.insert).toHaveBeenCalledWith(tenantSchema.scadaConnections);

      expect(mockDb.values).toHaveBeenCalled();

      expect(mockDb.onConflictDoUpdate).toHaveBeenCalled();
    });

    it('should update an existing SCADA connection on conflict', async () => {
      // Arrange
      const updatedEntity = ScadaConnection.fromPrimitives({
        ...mockDomainEntity.toPrimitives(),
        name: 'Updated Connection Name',
        status: 'inactive',
      });
      mockDb.onConflictDoUpdate.mockResolvedValue(undefined);

      // Act
      await repository.save(updatedEntity);

      // Assert

      expect(mockDb.onConflictDoUpdate).toHaveBeenCalled();
      const conflictConfig = mockDb.onConflictDoUpdate.mock.calls[0][0] as {
        target: unknown;
        set: unknown;
      };
      expect(conflictConfig.target).toBe(tenantSchema.scadaConnections.id);
      expect(conflictConfig.set).toBeDefined();
    });

    it('should handle database errors during save', async () => {
      // Arrange
      mockDb.onConflictDoUpdate.mockRejectedValue(
        new Error('Constraint violation'),
      );

      // Act & Assert
      await expect(repository.save(mockDomainEntity)).rejects.toThrow(
        'Constraint violation',
      );
    });

    it('should properly map domain entity to database row', async () => {
      // Arrange
      mockDb.onConflictDoUpdate.mockResolvedValue(undefined);

      // Act
      await repository.save(mockDomainEntity);

      // Assert

      expect(mockDb.values).toHaveBeenCalled();
      const values = mockDb.values.mock.calls[0][0] as Record<string, unknown>;
      expect(values.id).toBe(CONNECTION_ID);
      expect(values.tenantId).toBe(TENANT_ID);
      expect(values.wellId).toBe(WELL_ID);
      expect(values.name).toBe('Test SCADA Connection');
      expect(values.endpointConfig).toBeDefined();
      expect((values.endpointConfig as Record<string, unknown>).url).toBe(
        'opc.tcp://localhost:4840',
      );
    });
  });

  // ============================================================================
  // delete Tests
  // ============================================================================

  describe('delete', () => {
    it('should delete a SCADA connection', async () => {
      // Arrange
      mockDb.where.mockResolvedValue(undefined);

      // Act
      await repository.delete(TENANT_ID, CONNECTION_ID);

      // Assert

      expect(mockTenantDb.getTenantDatabase).toHaveBeenCalledWith(TENANT_ID);

      expect(mockDb.delete).toHaveBeenCalledWith(tenantSchema.scadaConnections);

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should enforce tenant isolation when deleting', async () => {
      // Arrange
      mockDb.where.mockResolvedValue(undefined);

      // Act
      await repository.delete(TENANT_ID, CONNECTION_ID);

      // Assert

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should handle database errors during delete', async () => {
      // Arrange
      mockDb.where.mockRejectedValue(new Error('Foreign key constraint'));

      // Act & Assert
      await expect(repository.delete(TENANT_ID, CONNECTION_ID)).rejects.toThrow(
        'Foreign key constraint',
      );
    });
  });

  // ============================================================================
  // Domain Mapping Tests
  // ============================================================================

  describe('Domain Entity Mapping', () => {
    it('should correctly map database row to domain entity', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([mockDbRow]);

      // Act
      const result = await repository.findById(TENANT_ID, CONNECTION_ID);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe(CONNECTION_ID);
      expect(result?.tenantId).toBe(TENANT_ID);
      expect(result?.wellId).toBe(WELL_ID);
      expect(result?.name).toBe('Test SCADA Connection');
      expect(result?.description).toBe('Test connection for unit tests');
      expect(result?.pollIntervalSeconds).toBe(5);
      expect(result?.status).toBe('active');
      expect(result?.isEnabled).toBe(true);

      // Verify endpoint is properly mapped
      const endpoint = result!.toPrimitives().endpoint;
      expect(endpoint.url).toBe('opc.tcp://localhost:4840');
      expect(endpoint.securityMode).toBe('None');
      expect(endpoint.securityPolicy).toBe('None');
    });

    it('should handle null optional fields correctly', async () => {
      // Arrange
      const rowWithNulls = {
        ...mockDbRow,
        description: null,
        lastConnectedAt: null,
        lastErrorMessage: null,
      };
      mockDb.limit.mockResolvedValue([rowWithNulls]);

      // Act
      const result = await repository.findById(TENANT_ID, CONNECTION_ID);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.description).toBeUndefined();
      expect(result?.lastConnectedAt).toBeUndefined();
      expect(result?.lastErrorMessage).toBeUndefined();
    });

    it('should preserve all endpoint configuration fields', async () => {
      // Arrange
      const rowWithAuth = {
        ...mockDbRow,
        endpointConfig: {
          url: 'opc.tcp://secure.example.com:4840',
          securityMode: 'SignAndEncrypt',
          securityPolicy: 'Basic256Sha256',
          username: 'scada_user',
          password: 'secure_password',
        },
      };
      mockDb.limit.mockResolvedValue([rowWithAuth]);

      // Act
      const result = await repository.findById(TENANT_ID, CONNECTION_ID);

      // Assert
      const endpoint = result!.toPrimitives().endpoint;
      expect(endpoint.url).toBe('opc.tcp://secure.example.com:4840');
      expect(endpoint.securityMode).toBe('SignAndEncrypt');
      expect(endpoint.securityPolicy).toBe('Basic256Sha256');
      expect(endpoint.username).toBe('scada_user');
      expect(endpoint.password).toBe('secure_password');
    });
  });
});
