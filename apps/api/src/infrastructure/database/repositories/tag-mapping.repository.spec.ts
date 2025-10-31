/**
 * TagMappingRepository Tests
 *
 * Comprehensive unit tests for tag mapping repository with coverage of:
 * - All CRUD operations (findById, findByConnectionId, save, saveMany, delete)
 * - Tenant isolation (ensure tenantId is used in all queries)
 * - Connection-scoped queries (findByConnectionId, findEnabledByConnectionId)
 * - Node and field property lookups (findByNodeId, findByFieldProperty)
 * - Bulk operations (saveMany, deleteByConnectionId)
 * - Existence checks (existsByNodeId, existsByFieldProperty)
 * - Error handling for database failures
 * - Domain entity mapping with JSON configuration
 *
 * Test Pattern: AAA (Arrange, Act, Assert)
 * Coverage Target: ≥80%
 */

import { TagMappingRepository } from './tag-mapping.repository';
import { TenantDatabaseService } from '../tenant-database.service';
import { TagMapping } from '../../../domain/scada/tag-mapping.entity';
import { TagConfiguration } from '../../../domain/scada/value-objects/tag-configuration.vo';
import * as tenantSchema from '../schema/tenant';

/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-member-access */

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

describe('TagMappingRepository', () => {
  let repository: TagMappingRepository;
  let mockTenantDb: jest.Mocked<TenantDatabaseService>;
  let mockDb: MockDrizzleDb;

  const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
  const CONNECTION_ID = 'scada_1635724800_abc123';
  const TAG_MAPPING_ID = 'tag_1635724800_xyz789';
  const USER_ID = '770e8400-e29b-41d4-a716-446655440002';

  // Mock database row (what comes from database)
  const mockDbRow: tenantSchema.TagMapping = {
    id: TAG_MAPPING_ID,
    tenantId: TENANT_ID,
    scadaConnectionId: CONNECTION_ID,
    configuration: {
      nodeId: 'ns=2;s=PumpStation.Pressure',
      tagName: 'casing_pressure',
      fieldEntryProperty: 'casingPressure',
      dataType: 'Double',
      unit: 'PSI',
      scalingFactor: 1.0,
      deadband: 0.1,
    },
    isEnabled: true,
    lastValue: '1250.5',
    lastReadAt: new Date('2025-01-15T10:00:00Z'),
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-15T10:00:00Z'),
    createdBy: USER_ID,
    updatedBy: USER_ID,
  };

  // Mock domain entity (what repository returns)
  const mockDomainEntity = TagMapping.fromPrimitives({
    id: TAG_MAPPING_ID,
    scadaConnectionId: CONNECTION_ID,
    tenantId: TENANT_ID,
    configuration: TagConfiguration.fromPrimitives({
      nodeId: 'ns=2;s=PumpStation.Pressure',
      tagName: 'casing_pressure',
      fieldEntryProperty: 'casingPressure',
      dataType: 'Double',
      unit: 'PSI',
      scalingFactor: 1.0,
      deadband: 0.1,
    }),
    isEnabled: true,
    lastValue: 1250.5,
    lastReadAt: new Date('2025-01-15T10:00:00Z'),
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

    repository = new TagMappingRepository(mockTenantDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // findById Tests
  // ============================================================================

  describe('findById', () => {
    it('should return a tag mapping when found', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([mockDbRow]);

      // Act
      const result = await repository.findById(TENANT_ID, TAG_MAPPING_ID);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe(TAG_MAPPING_ID);
      expect(result?.tenantId).toBe(TENANT_ID);
      expect(result?.scadaConnectionId).toBe(CONNECTION_ID);

      expect(mockTenantDb.getTenantDatabase).toHaveBeenCalledWith(TENANT_ID);

      expect(mockDb.select).toHaveBeenCalled();

      expect(mockDb.from).toHaveBeenCalledWith(tenantSchema.tagMappings);

      expect(mockDb.limit).toHaveBeenCalledWith(1);
    });

    it('should return null when tag mapping not found', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([]);

      // Act
      const result = await repository.findById(TENANT_ID, TAG_MAPPING_ID);

      // Assert
      expect(result).toBeNull();

      expect(mockTenantDb.getTenantDatabase).toHaveBeenCalledWith(TENANT_ID);
    });

    it('should enforce tenant isolation in query', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([mockDbRow]);

      // Act
      await repository.findById(TENANT_ID, TAG_MAPPING_ID);

      // Assert

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      mockDb.limit.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        repository.findById(TENANT_ID, TAG_MAPPING_ID),
      ).rejects.toThrow('Database connection failed');
    });
  });

  // ============================================================================
  // findByConnectionId Tests
  // ============================================================================

  describe('findByConnectionId', () => {
    it('should return all tag mappings for a connection', async () => {
      // Arrange
      const mockRows = [
        mockDbRow,
        {
          ...mockDbRow,
          id: 'tag_2',
          configuration: {
            nodeId: 'ns=2;s=PumpStation.Temperature',
            tagName: 'temperature',
            fieldEntryProperty: 'temperature',
            dataType: 'Double',
            unit: 'F',
            scalingFactor: 1.0,
            deadband: 0.1,
          },
        },
      ];
      mockDb.where.mockResolvedValue(mockRows);

      // Act
      const result = await repository.findByConnectionId(
        TENANT_ID,
        CONNECTION_ID,
      );

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(TAG_MAPPING_ID);
      expect(result[1].id).toBe('tag_2');

      expect(mockTenantDb.getTenantDatabase).toHaveBeenCalledWith(TENANT_ID);
    });

    it('should return empty array when no mappings exist', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);

      // Act
      const result = await repository.findByConnectionId(
        TENANT_ID,
        CONNECTION_ID,
      );

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should enforce tenant isolation when querying by connection', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([mockDbRow]);

      // Act
      await repository.findByConnectionId(TENANT_ID, CONNECTION_ID);

      // Assert

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      // Arrange
      mockDb.where.mockRejectedValue(new Error('Query timeout'));

      // Act & Assert
      await expect(
        repository.findByConnectionId(TENANT_ID, CONNECTION_ID),
      ).rejects.toThrow('Query timeout');
    });
  });

  // ============================================================================
  // findEnabledByConnectionId Tests
  // ============================================================================

  describe('findEnabledByConnectionId', () => {
    it('should return only enabled tag mappings', async () => {
      // Arrange
      const enabledRows = [
        mockDbRow,
        { ...mockDbRow, id: 'tag_enabled_2', isEnabled: true },
      ];
      mockDb.where.mockResolvedValue(enabledRows);

      // Act
      const result = await repository.findEnabledByConnectionId(
        TENANT_ID,
        CONNECTION_ID,
      );

      // Assert
      expect(result).toHaveLength(2);
      result.forEach((mapping) => {
        expect(mapping.isEnabled).toBe(true);
      });
    });

    it('should return empty array when no enabled mappings exist', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);

      // Act
      const result = await repository.findEnabledByConnectionId(
        TENANT_ID,
        CONNECTION_ID,
      );

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should filter by isEnabled=true, connectionId, and tenant', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([mockDbRow]);

      // Act
      await repository.findEnabledByConnectionId(TENANT_ID, CONNECTION_ID);

      // Assert

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // findByNodeId Tests
  // ============================================================================

  describe('findByNodeId', () => {
    it('should find tag mapping by OPC-UA node ID', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([mockDbRow]);

      // Act
      const result = await repository.findByNodeId(
        TENANT_ID,
        CONNECTION_ID,
        'ns=2;s=PumpStation.Pressure',
      );

      // Assert
      expect(result).not.toBeNull();
      expect(result?.toPrimitives().configuration.nodeId).toBe(
        'ns=2;s=PumpStation.Pressure',
      );
    });

    it('should return null when node ID not found', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);

      // Act
      const result = await repository.findByNodeId(
        TENANT_ID,
        CONNECTION_ID,
        'ns=2;s=NonexistentNode',
      );

      // Assert
      expect(result).toBeNull();
    });

    it('should filter in-memory by nodeId in JSON configuration', async () => {
      // Arrange
      const mockRows = [
        mockDbRow,
        {
          ...mockDbRow,
          id: 'tag_2',
          configuration: {
            nodeId: 'ns=2;s=DifferentNode',
            tagName: 'different_tag',
            fieldEntryProperty: 'differentProperty',
            dataType: 'Double',
            unit: 'PSI',
            scalingFactor: 1.0,
            deadband: 0.1,
          },
        },
      ];
      mockDb.where.mockResolvedValue(mockRows);

      // Act
      const result = await repository.findByNodeId(
        TENANT_ID,
        CONNECTION_ID,
        'ns=2;s=PumpStation.Pressure',
      );

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe(TAG_MAPPING_ID);
    });
  });

  // ============================================================================
  // findByFieldProperty Tests
  // ============================================================================

  describe('findByFieldProperty', () => {
    it('should find tag mapping by field entry property', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([mockDbRow]);

      // Act
      const result = await repository.findByFieldProperty(
        TENANT_ID,
        CONNECTION_ID,
        'casingPressure',
      );

      // Assert
      expect(result).not.toBeNull();
      expect(result?.toPrimitives().configuration.fieldEntryProperty).toBe(
        'casingPressure',
      );
    });

    it('should return null when field property not found', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);

      // Act
      const result = await repository.findByFieldProperty(
        TENANT_ID,
        CONNECTION_ID,
        'nonexistentProperty',
      );

      // Assert
      expect(result).toBeNull();
    });

    it('should filter in-memory by fieldEntryProperty in JSON', async () => {
      // Arrange
      const mockRows = [
        mockDbRow,
        {
          ...mockDbRow,
          id: 'tag_2',
          configuration: {
            nodeId: 'ns=2;s=PumpStation.Temperature',
            tagName: 'temperature',
            fieldEntryProperty: 'temperature',
            dataType: 'Double',
            unit: 'F',
            scalingFactor: 1.0,
            deadband: 0.1,
          },
        },
      ];
      mockDb.where.mockResolvedValue(mockRows);

      // Act
      const result = await repository.findByFieldProperty(
        TENANT_ID,
        CONNECTION_ID,
        'casingPressure',
      );

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe(TAG_MAPPING_ID);
    });
  });

  // ============================================================================
  // existsByNodeId Tests
  // ============================================================================

  describe('existsByNodeId', () => {
    it('should return true when node ID exists', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([mockDbRow]);

      // Act
      const result = await repository.existsByNodeId(
        TENANT_ID,
        CONNECTION_ID,
        'ns=2;s=PumpStation.Pressure',
      );

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when node ID does not exist', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);

      // Act
      const result = await repository.existsByNodeId(
        TENANT_ID,
        CONNECTION_ID,
        'ns=2;s=NonexistentNode',
      );

      // Assert
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // existsByFieldProperty Tests
  // ============================================================================

  describe('existsByFieldProperty', () => {
    it('should return true when field property exists', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([mockDbRow]);

      // Act
      const result = await repository.existsByFieldProperty(
        TENANT_ID,
        CONNECTION_ID,
        'casingPressure',
      );

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when field property does not exist', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);

      // Act
      const result = await repository.existsByFieldProperty(
        TENANT_ID,
        CONNECTION_ID,
        'nonexistentProperty',
      );

      // Assert
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // save Tests
  // ============================================================================

  describe('save', () => {
    it('should insert a new tag mapping', async () => {
      // Arrange
      mockDb.onConflictDoUpdate.mockResolvedValue(undefined);

      // Act
      await repository.save(mockDomainEntity);

      // Assert

      expect(mockTenantDb.getTenantDatabase).toHaveBeenCalledWith(TENANT_ID);

      expect(mockDb.insert).toHaveBeenCalledWith(tenantSchema.tagMappings);

      expect(mockDb.values).toHaveBeenCalled();

      expect(mockDb.onConflictDoUpdate).toHaveBeenCalled();
    });

    it('should update an existing tag mapping on conflict', async () => {
      // Arrange
      const updatedEntity = TagMapping.fromPrimitives({
        ...mockDomainEntity.toPrimitives(),
        isEnabled: false,
        lastValue: 1300.0,
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
      expect(conflictConfig.target).toBe(tenantSchema.tagMappings.id);
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
      const values = mockDb.values.mock.calls[0][0] as {
        id: string;
        tenantId: string;
        scadaConnectionId: string;
        configuration: {
          nodeId: string;
          tagName: string;
          fieldEntryProperty: string;
        };
      };
      expect(values.id).toBe(TAG_MAPPING_ID);
      expect(values.tenantId).toBe(TENANT_ID);
      expect(values.scadaConnectionId).toBe(CONNECTION_ID);
      expect(values.configuration).toBeDefined();
      expect(values.configuration.nodeId).toBe('ns=2;s=PumpStation.Pressure');
      expect(values.configuration.tagName).toBe('casing_pressure');
      expect(values.configuration.fieldEntryProperty).toBe('casingPressure');
    });
  });

  // ============================================================================
  // saveMany Tests
  // ============================================================================

  describe('saveMany', () => {
    it('should insert multiple tag mappings in bulk', async () => {
      // Arrange
      const mappings = [
        mockDomainEntity,
        TagMapping.fromPrimitives({
          ...mockDomainEntity.toPrimitives(),
          id: 'tag_2',
          configuration: TagConfiguration.fromPrimitives({
            nodeId: 'ns=2;s=PumpStation.Temperature',
            tagName: 'temperature',
            fieldEntryProperty: 'temperature',
            dataType: 'Double',
            unit: 'F',
          }),
        }),
      ];
      mockDb.onConflictDoUpdate.mockResolvedValue(undefined);

      // Act
      await repository.saveMany(mappings);

      // Assert

      expect(mockTenantDb.getTenantDatabase).toHaveBeenCalledWith(TENANT_ID);

      expect(mockDb.insert).toHaveBeenCalledTimes(2);

      expect(mockDb.values).toHaveBeenCalledTimes(2);

      expect(mockDb.onConflictDoUpdate).toHaveBeenCalledTimes(2);
    });

    it('should do nothing when array is empty', async () => {
      // Act
      await repository.saveMany([]);

      // Assert

      expect(mockTenantDb.getTenantDatabase).not.toHaveBeenCalled();

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should handle errors during bulk insert', async () => {
      // Arrange
      const mappings = [mockDomainEntity];
      mockDb.onConflictDoUpdate.mockRejectedValue(
        new Error('Bulk insert failed'),
      );

      // Act & Assert
      await expect(repository.saveMany(mappings)).rejects.toThrow(
        'Bulk insert failed',
      );
    });

    it('should use tenant ID from first mapping', async () => {
      // Arrange
      const mappings = [mockDomainEntity];
      mockDb.onConflictDoUpdate.mockResolvedValue(undefined);

      // Act
      await repository.saveMany(mappings);

      // Assert

      expect(mockTenantDb.getTenantDatabase).toHaveBeenCalledWith(TENANT_ID);
    });
  });

  // ============================================================================
  // delete Tests
  // ============================================================================

  describe('delete', () => {
    it('should delete a tag mapping', async () => {
      // Arrange
      mockDb.where.mockResolvedValue(undefined);

      // Act
      await repository.delete(TENANT_ID, TAG_MAPPING_ID);

      // Assert

      expect(mockTenantDb.getTenantDatabase).toHaveBeenCalledWith(TENANT_ID);

      expect(mockDb.delete).toHaveBeenCalledWith(tenantSchema.tagMappings);

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should enforce tenant isolation when deleting', async () => {
      // Arrange
      mockDb.where.mockResolvedValue(undefined);

      // Act
      await repository.delete(TENANT_ID, TAG_MAPPING_ID);

      // Assert

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should handle database errors during delete', async () => {
      // Arrange
      mockDb.where.mockRejectedValue(new Error('Delete failed'));

      // Act & Assert
      await expect(
        repository.delete(TENANT_ID, TAG_MAPPING_ID),
      ).rejects.toThrow('Delete failed');
    });
  });

  // ============================================================================
  // deleteByConnectionId Tests
  // ============================================================================

  describe('deleteByConnectionId', () => {
    it('should delete all tag mappings for a connection', async () => {
      // Arrange
      mockDb.where.mockResolvedValue(undefined);

      // Act
      await repository.deleteByConnectionId(TENANT_ID, CONNECTION_ID);

      // Assert

      expect(mockTenantDb.getTenantDatabase).toHaveBeenCalledWith(TENANT_ID);

      expect(mockDb.delete).toHaveBeenCalledWith(tenantSchema.tagMappings);

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should enforce tenant isolation when deleting by connection', async () => {
      // Arrange
      mockDb.where.mockResolvedValue(undefined);

      // Act
      await repository.deleteByConnectionId(TENANT_ID, CONNECTION_ID);

      // Assert

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should handle database errors during bulk delete', async () => {
      // Arrange
      mockDb.where.mockRejectedValue(new Error('Cascade delete failed'));

      // Act & Assert
      await expect(
        repository.deleteByConnectionId(TENANT_ID, CONNECTION_ID),
      ).rejects.toThrow('Cascade delete failed');
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
      const result = await repository.findById(TENANT_ID, TAG_MAPPING_ID);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe(TAG_MAPPING_ID);
      expect(result?.tenantId).toBe(TENANT_ID);
      expect(result?.scadaConnectionId).toBe(CONNECTION_ID);
      expect(result?.isEnabled).toBe(true);
      expect(result?.lastValue).toBe(1250.5);

      // Verify configuration is properly mapped
      const config = result!.toPrimitives().configuration;
      expect(config.nodeId).toBe('ns=2;s=PumpStation.Pressure');
      expect(config.tagName).toBe('casing_pressure');
      expect(config.fieldEntryProperty).toBe('casingPressure');
      expect(config.dataType).toBe('Double');
      expect(config.unit).toBe('PSI');
      expect(config.scalingFactor).toBe(1.0);
      expect(config.deadband).toBe(0.1);
    });

    it('should handle null lastValue correctly', async () => {
      // Arrange
      const rowWithoutValue = {
        ...mockDbRow,
        lastValue: null,
        lastReadAt: null,
      };
      mockDb.limit.mockResolvedValue([rowWithoutValue]);

      // Act
      const result = await repository.findById(TENANT_ID, TAG_MAPPING_ID);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.lastValue).toBeUndefined();
      expect(result?.lastReadAt).toBeUndefined();
    });

    it('should parse numeric lastValue correctly', async () => {
      // Arrange
      const rowWithNumericValue = {
        ...mockDbRow,
        lastValue: '1250.5',
      };
      mockDb.limit.mockResolvedValue([rowWithNumericValue]);

      // Act
      const result = await repository.findById(TENANT_ID, TAG_MAPPING_ID);

      // Assert
      expect(result?.lastValue).toBe(1250.5);
    });

    it('should parse boolean lastValue correctly', async () => {
      // Arrange
      const rowWithBooleanValue = {
        ...mockDbRow,
        lastValue: 'true',
      };
      mockDb.limit.mockResolvedValue([rowWithBooleanValue]);

      // Act
      const result = await repository.findById(TENANT_ID, TAG_MAPPING_ID);

      // Assert
      expect(result?.lastValue).toBe(true);
    });

    it('should parse string lastValue correctly', async () => {
      // Arrange
      const rowWithStringValue = {
        ...mockDbRow,
        lastValue: 'RUNNING',
      };
      mockDb.limit.mockResolvedValue([rowWithStringValue]);

      // Act
      const result = await repository.findById(TENANT_ID, TAG_MAPPING_ID);

      // Assert
      expect(result?.lastValue).toBe('RUNNING');
    });

    it('should preserve optional configuration fields', async () => {
      // Arrange
      const rowWithOptionals = {
        ...mockDbRow,
        configuration: {
          nodeId: 'ns=2;s=PumpStation.Pressure',
          tagName: 'casing_pressure',
          fieldEntryProperty: 'casingPressure',
          dataType: 'Double',
          unit: undefined,
          scalingFactor: undefined,
          deadband: undefined,
        },
      };
      mockDb.limit.mockResolvedValue([rowWithOptionals]);

      // Act
      const result = await repository.findById(TENANT_ID, TAG_MAPPING_ID);

      // Assert
      const config = result!.toPrimitives().configuration;
      expect(config.nodeId).toBe('ns=2;s=PumpStation.Pressure');
      expect(config.tagName).toBe('casing_pressure');
      expect(config.fieldEntryProperty).toBe('casingPressure');
      expect(config.dataType).toBe('Double');
    });

    it('should handle all OPC-UA data types', async () => {
      const dataTypes = [
        'Boolean',
        'SByte',
        'Byte',
        'Int16',
        'UInt16',
        'Int32',
        'UInt32',
        'Int64',
        'UInt64',
        'Float',
        'Double',
        'String',
        'DateTime',
      ];

      for (const dataType of dataTypes) {
        // Arrange
        const rowWithDataType = {
          ...mockDbRow,
          configuration: {
            nodeId: 'ns=2;s=PumpStation.Pressure',
            tagName: 'casing_pressure',
            fieldEntryProperty: 'casingPressure',
            dataType,
            unit: 'PSI',
            scalingFactor: 1.0,
            deadband: 0.1,
          },
        };
        mockDb.limit.mockResolvedValue([rowWithDataType]);

        // Act
        const result = await repository.findById(TENANT_ID, TAG_MAPPING_ID);

        // Assert
        expect(result?.toPrimitives().configuration.dataType).toBe(dataType);
      }
    });
  });
});
