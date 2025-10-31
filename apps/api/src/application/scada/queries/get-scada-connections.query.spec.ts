/**
 * GetScadaConnectionsHandler Tests
 *
 * Tests SCADA connections query handler with comprehensive coverage of:
 * - Retrieving all connections for tenant
 * - Filtering by well ID
 * - Filtering by enabled status
 * - Health status calculation (isHealthy property)
 * - Empty result handling
 * - Multiple connections handling
 * - DTO mapping accuracy
 * - Error handling
 */

import {
  GetScadaConnectionsHandler,
  GetScadaConnectionsQuery,
} from './get-scada-connections.query';
import { IScadaConnectionRepository } from '../../../domain/repositories/scada-connection.repository.interface';
import { ScadaConnection } from '../../../domain/scada/scada-connection.entity';
import { OpcUaEndpoint } from '../../../domain/scada/value-objects/opc-ua-endpoint.vo';

/* eslint-disable @typescript-eslint/unbound-method */

describe('GetScadaConnectionsHandler', () => {
  let handler: GetScadaConnectionsHandler;
  let mockScadaConnectionRepo: jest.Mocked<IScadaConnectionRepository>;

  const tenantId = 'tenant-123';
  const wellId1 = 'well-456';
  const wellId2 = 'well-789';
  const userId = 'user-101';

  beforeEach(() => {
    // Create mock SCADA connection repository
    mockScadaConnectionRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByWellId: jest.fn(),
      findAll: jest.fn(),
      findActive: jest.fn(),
      findEnabled: jest.fn(),
      existsByName: jest.fn(),
      existsByWellId: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IScadaConnectionRepository>;

    // Initialize handler with mock
    handler = new GetScadaConnectionsHandler(mockScadaConnectionRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Retrieving All Connections', () => {
    it('should return all SCADA connections for tenant', async () => {
      // Arrange
      const endpoint1 = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const endpoint2 = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.101:4840',
        securityMode: 'SignAndEncrypt',
        securityPolicy: 'Basic256Sha256',
        username: 'opcuser',
        password: 'opcpassword',
      });

      const connection1 = ScadaConnection.create({
        tenantId,
        wellId: wellId1,
        name: 'RTU-001',
        endpoint: endpoint1,
        createdBy: userId,
      });

      const connection2 = ScadaConnection.create({
        tenantId,
        wellId: wellId2,
        name: 'RTU-002',
        description: 'Production well RTU',
        endpoint: endpoint2,
        pollIntervalSeconds: 10,
        createdBy: userId,
      });

      const query = new GetScadaConnectionsQuery(tenantId);

      mockScadaConnectionRepo.findAll.mockResolvedValue([
        connection1,
        connection2,
      ]);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result).toBeDefined();
      expect(result.count).toBe(2);
      expect(result.connections).toHaveLength(2);
      expect(result.connections[0].name).toBe('RTU-001');
      expect(result.connections[1].name).toBe('RTU-002');
      expect(mockScadaConnectionRepo.findAll).toHaveBeenCalledWith(tenantId);
    });

    it('should return empty array when no connections exist', async () => {
      // Arrange
      const query = new GetScadaConnectionsQuery(tenantId);

      mockScadaConnectionRepo.findAll.mockResolvedValue([]);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result.count).toBe(0);
      expect(result.connections).toEqual([]);
    });

    it('should handle single connection', async () => {
      // Arrange
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const connection = ScadaConnection.create({
        tenantId,
        wellId: wellId1,
        name: 'RTU-001',
        endpoint,
        createdBy: userId,
      });

      const query = new GetScadaConnectionsQuery(tenantId);

      mockScadaConnectionRepo.findAll.mockResolvedValue([connection]);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result.count).toBe(1);
      expect(result.connections).toHaveLength(1);
    });

    it('should handle multiple connections for same tenant', async () => {
      // Arrange
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const connections = Array.from({ length: 5 }, (_, i) =>
        ScadaConnection.create({
          tenantId,
          wellId: `well-${i}`,
          name: `RTU-00${i + 1}`,
          endpoint,
          createdBy: userId,
        }),
      );

      const query = new GetScadaConnectionsQuery(tenantId);

      mockScadaConnectionRepo.findAll.mockResolvedValue(connections);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result.count).toBe(5);
      expect(result.connections).toHaveLength(5);
      expect(mockScadaConnectionRepo.findAll).toHaveBeenCalledWith(tenantId);
    });
  });

  describe('Filtering by Well ID', () => {
    it('should return connection for specific well', async () => {
      // Arrange
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const connection = ScadaConnection.create({
        tenantId,
        wellId: wellId1,
        name: 'RTU-001',
        endpoint,
        createdBy: userId,
      });

      const query = new GetScadaConnectionsQuery(tenantId, wellId1);

      mockScadaConnectionRepo.findByWellId.mockResolvedValue(connection);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result.count).toBe(1);
      expect(result.connections).toHaveLength(1);
      expect(result.connections[0].wellId).toBe(wellId1);
      expect(mockScadaConnectionRepo.findByWellId).toHaveBeenCalledWith(
        tenantId,
        wellId1,
      );
    });

    it('should return empty array when well has no connection', async () => {
      // Arrange
      const query = new GetScadaConnectionsQuery(tenantId, wellId1);

      mockScadaConnectionRepo.findByWellId.mockResolvedValue(null);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result.count).toBe(0);
      expect(result.connections).toEqual([]);
    });

    it('should not call findAll when wellId is provided', async () => {
      // Arrange
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const connection = ScadaConnection.create({
        tenantId,
        wellId: wellId1,
        name: 'RTU-001',
        endpoint,
        createdBy: userId,
      });

      const query = new GetScadaConnectionsQuery(tenantId, wellId1);

      mockScadaConnectionRepo.findByWellId.mockResolvedValue(connection);

      // Act
      await handler.execute(query);

      // Assert
      expect(mockScadaConnectionRepo.findByWellId).toHaveBeenCalled();
      expect(mockScadaConnectionRepo.findAll).not.toHaveBeenCalled();
      expect(mockScadaConnectionRepo.findEnabled).not.toHaveBeenCalled();
    });
  });

  describe('Filtering by Enabled Status', () => {
    it('should return only enabled connections when onlyEnabled is true', async () => {
      // Arrange
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const connection1 = ScadaConnection.create({
        tenantId,
        wellId: wellId1,
        name: 'RTU-001',
        endpoint,
        createdBy: userId,
      });

      const connection2 = ScadaConnection.create({
        tenantId,
        wellId: wellId2,
        name: 'RTU-002',
        endpoint,
        createdBy: userId,
      });

      const query = new GetScadaConnectionsQuery(
        tenantId,
        undefined,
        true, // onlyEnabled
      );

      mockScadaConnectionRepo.findEnabled.mockResolvedValue([
        connection1,
        connection2,
      ]);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result.count).toBe(2);
      expect(result.connections).toHaveLength(2);
      expect(result.connections[0].isEnabled).toBe(true);
      expect(result.connections[1].isEnabled).toBe(true);
      expect(mockScadaConnectionRepo.findEnabled).toHaveBeenCalledWith(
        tenantId,
      );
    });

    it('should return empty array when no enabled connections exist', async () => {
      // Arrange
      const query = new GetScadaConnectionsQuery(tenantId, undefined, true);

      mockScadaConnectionRepo.findEnabled.mockResolvedValue([]);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result.count).toBe(0);
      expect(result.connections).toEqual([]);
    });

    it('should not call findAll when onlyEnabled is true', async () => {
      // Arrange
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const connection = ScadaConnection.create({
        tenantId,
        wellId: wellId1,
        name: 'RTU-001',
        endpoint,
        createdBy: userId,
      });

      const query = new GetScadaConnectionsQuery(tenantId, undefined, true);

      mockScadaConnectionRepo.findEnabled.mockResolvedValue([connection]);

      // Act
      await handler.execute(query);

      // Assert
      expect(mockScadaConnectionRepo.findEnabled).toHaveBeenCalled();
      expect(mockScadaConnectionRepo.findAll).not.toHaveBeenCalled();
      expect(mockScadaConnectionRepo.findByWellId).not.toHaveBeenCalled();
    });

    it('should prioritize wellId filter over onlyEnabled filter', async () => {
      // Arrange
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const connection = ScadaConnection.create({
        tenantId,
        wellId: wellId1,
        name: 'RTU-001',
        endpoint,
        createdBy: userId,
      });

      const query = new GetScadaConnectionsQuery(
        tenantId,
        wellId1, // Well ID provided
        true, // onlyEnabled also true
      );

      mockScadaConnectionRepo.findByWellId.mockResolvedValue(connection);

      // Act
      await handler.execute(query);

      // Assert
      expect(mockScadaConnectionRepo.findByWellId).toHaveBeenCalled();
      expect(mockScadaConnectionRepo.findEnabled).not.toHaveBeenCalled();
      expect(mockScadaConnectionRepo.findAll).not.toHaveBeenCalled();
    });
  });

  describe('Health Status Calculation', () => {
    it('should calculate isHealthy as true for active connection with recent timestamp', async () => {
      // Arrange
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const connection = ScadaConnection.create({
        tenantId,
        wellId: wellId1,
        name: 'RTU-001',
        endpoint,
        createdBy: userId,
      });

      // Mark as connected recently (within 60 seconds)
      connection.markConnected();

      const query = new GetScadaConnectionsQuery(tenantId);

      mockScadaConnectionRepo.findAll.mockResolvedValue([connection]);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result.connections[0].isHealthy).toBe(true);
      expect(result.connections[0].status).toBe('active');
    });

    it('should calculate isHealthy as false for connection that has never connected', async () => {
      // Arrange
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const connection = ScadaConnection.create({
        tenantId,
        wellId: wellId1,
        name: 'RTU-001',
        endpoint,
        createdBy: userId,
      });

      // Never connected (lastConnectedAt is undefined)

      const query = new GetScadaConnectionsQuery(tenantId);

      mockScadaConnectionRepo.findAll.mockResolvedValue([connection]);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result.connections[0].isHealthy).toBe(false);
      expect(result.connections[0].status).toBe('inactive');
      expect(result.connections[0].lastConnectedAt).toBeUndefined();
    });

    it('should calculate isHealthy as false for connection in error state', async () => {
      // Arrange
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const connection = ScadaConnection.create({
        tenantId,
        wellId: wellId1,
        name: 'RTU-001',
        endpoint,
        createdBy: userId,
      });

      connection.markError('Connection timeout');

      const query = new GetScadaConnectionsQuery(tenantId);

      mockScadaConnectionRepo.findAll.mockResolvedValue([connection]);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result.connections[0].isHealthy).toBe(false);
      expect(result.connections[0].status).toBe('error');
      expect(result.connections[0].lastErrorMessage).toBe('Connection timeout');
    });

    it('should calculate isHealthy as false for disabled connection', async () => {
      // Arrange
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const connection = ScadaConnection.create({
        tenantId,
        wellId: wellId1,
        name: 'RTU-001',
        endpoint,
        createdBy: userId,
      });

      connection.markConnected();
      connection.disable(userId);

      const query = new GetScadaConnectionsQuery(tenantId);

      mockScadaConnectionRepo.findAll.mockResolvedValue([connection]);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result.connections[0].isHealthy).toBe(false);
      expect(result.connections[0].isEnabled).toBe(false);
      expect(result.connections[0].status).toBe('inactive');
    });

    it('should use 60 second staleness threshold for health calculation', async () => {
      // Arrange
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const connection = ScadaConnection.create({
        tenantId,
        wellId: wellId1,
        name: 'RTU-001',
        endpoint,
        createdBy: userId,
      });

      // Mark as connected (will be recent)
      connection.markConnected();

      const query = new GetScadaConnectionsQuery(tenantId);

      mockScadaConnectionRepo.findAll.mockResolvedValue([connection]);

      // Act
      const result = await handler.execute(query);

      // Assert - connection is recent, so should be healthy
      expect(result.connections[0].isHealthy).toBe(true);
      expect(result.connections[0].status).toBe('active');
    });

    it('should handle mix of healthy and unhealthy connections', async () => {
      // Arrange
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const healthyConnection = ScadaConnection.create({
        tenantId,
        wellId: wellId1,
        name: 'RTU-001',
        endpoint,
        createdBy: userId,
      });
      healthyConnection.markConnected();

      const unhealthyConnection = ScadaConnection.create({
        tenantId,
        wellId: wellId2,
        name: 'RTU-002',
        endpoint,
        createdBy: userId,
      });
      unhealthyConnection.markError('Connection failed');

      const query = new GetScadaConnectionsQuery(tenantId);

      mockScadaConnectionRepo.findAll.mockResolvedValue([
        healthyConnection,
        unhealthyConnection,
      ]);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result.count).toBe(2);
      expect(result.connections[0].isHealthy).toBe(true);
      expect(result.connections[0].status).toBe('active');
      expect(result.connections[1].isHealthy).toBe(false);
      expect(result.connections[1].status).toBe('error');
    });
  });

  describe('DTO Mapping', () => {
    it('should correctly map all connection properties to DTO', async () => {
      // Arrange
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'SignAndEncrypt',
        securityPolicy: 'Basic256Sha256',
        username: 'opcuser',
        password: 'opcpassword',
      });

      const connection = ScadaConnection.create({
        tenantId,
        wellId: wellId1,
        name: 'RTU-001',
        description: 'Production well RTU',
        endpoint,
        pollIntervalSeconds: 30,
        createdBy: userId,
      });

      connection.markConnected();

      const query = new GetScadaConnectionsQuery(tenantId);

      mockScadaConnectionRepo.findAll.mockResolvedValue([connection]);

      // Act
      const result = await handler.execute(query);

      // Assert
      const dto = result.connections[0];
      expect(dto.id).toBeDefined();
      expect(dto.id).toMatch(/^scada_/);
      expect(dto.tenantId).toBe(tenantId);
      expect(dto.wellId).toBe(wellId1);
      expect(dto.name).toBe('RTU-001');
      expect(dto.description).toBe('Production well RTU');
      expect(dto.opcUaUrl).toBe('opc.tcp://192.168.1.100:4840');
      expect(dto.securityMode).toBe('SignAndEncrypt');
      expect(dto.securityPolicy).toBe('Basic256Sha256');
      expect(dto.hasCredentials).toBe(true);
      expect(dto.pollIntervalSeconds).toBe(30);
      expect(dto.status).toBe('active');
      expect(dto.lastConnectedAt).toBeDefined();
      expect(dto.lastErrorMessage).toBeUndefined();
      expect(dto.isEnabled).toBe(true);
      expect(dto.isHealthy).toBe(true);
      expect(dto.createdAt).toBeDefined();
      expect(dto.updatedAt).toBeDefined();
      expect(dto.createdBy).toBe(userId);
      expect(dto.updatedBy).toBe(userId);
    });

    it('should format timestamps as ISO strings in DTO', async () => {
      // Arrange
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const connection = ScadaConnection.create({
        tenantId,
        wellId: wellId1,
        name: 'RTU-001',
        endpoint,
        createdBy: userId,
      });

      connection.markConnected();

      const query = new GetScadaConnectionsQuery(tenantId);

      mockScadaConnectionRepo.findAll.mockResolvedValue([connection]);

      // Act
      const result = await handler.execute(query);

      // Assert
      const dto = result.connections[0];
      expect(dto.createdAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
      expect(dto.updatedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
      expect(dto.lastConnectedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it('should handle undefined optional fields in DTO', async () => {
      // Arrange
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const connection = ScadaConnection.create({
        tenantId,
        wellId: wellId1,
        name: 'RTU-001',
        // No description
        endpoint,
        createdBy: userId,
      });

      // Never connected

      const query = new GetScadaConnectionsQuery(tenantId);

      mockScadaConnectionRepo.findAll.mockResolvedValue([connection]);

      // Act
      const result = await handler.execute(query);

      // Assert
      const dto = result.connections[0];
      expect(dto.description).toBeUndefined();
      expect(dto.lastConnectedAt).toBeUndefined();
      expect(dto.lastErrorMessage).toBeUndefined();
    });

    it('should correctly map hasCredentials property', async () => {
      // Arrange
      const endpointWithCreds = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'SignAndEncrypt',
        securityPolicy: 'Basic256Sha256',
        username: 'opcuser',
        password: 'opcpassword',
      });

      const endpointWithoutCreds = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.101:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const connection1 = ScadaConnection.create({
        tenantId,
        wellId: wellId1,
        name: 'RTU-001',
        endpoint: endpointWithCreds,
        createdBy: userId,
      });

      const connection2 = ScadaConnection.create({
        tenantId,
        wellId: wellId2,
        name: 'RTU-002',
        endpoint: endpointWithoutCreds,
        createdBy: userId,
      });

      const query = new GetScadaConnectionsQuery(tenantId);

      mockScadaConnectionRepo.findAll.mockResolvedValue([
        connection1,
        connection2,
      ]);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result.connections[0].hasCredentials).toBe(true);
      expect(result.connections[1].hasCredentials).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should propagate repository errors from findAll', async () => {
      // Arrange
      const query = new GetScadaConnectionsQuery(tenantId);

      mockScadaConnectionRepo.findAll.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Act & Assert
      await expect(handler.execute(query)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should propagate repository errors from findByWellId', async () => {
      // Arrange
      const query = new GetScadaConnectionsQuery(tenantId, wellId1);

      mockScadaConnectionRepo.findByWellId.mockRejectedValue(
        new Error('Database query failed'),
      );

      // Act & Assert
      await expect(handler.execute(query)).rejects.toThrow(
        'Database query failed',
      );
    });

    it('should propagate repository errors from findEnabled', async () => {
      // Arrange
      const query = new GetScadaConnectionsQuery(tenantId, undefined, true);

      mockScadaConnectionRepo.findEnabled.mockRejectedValue(
        new Error('Database timeout'),
      );

      // Act & Assert
      await expect(handler.execute(query)).rejects.toThrow('Database timeout');
    });
  });

  describe('Filter Priority', () => {
    it('should apply filters in correct priority order', async () => {
      // Arrange
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const connection = ScadaConnection.create({
        tenantId,
        wellId: wellId1,
        name: 'RTU-001',
        endpoint,
        createdBy: userId,
      });

      // Test 1: wellId takes priority
      const query1 = new GetScadaConnectionsQuery(tenantId, wellId1, true);
      mockScadaConnectionRepo.findByWellId.mockResolvedValue(connection);

      await handler.execute(query1);

      expect(mockScadaConnectionRepo.findByWellId).toHaveBeenCalled();
      expect(mockScadaConnectionRepo.findEnabled).not.toHaveBeenCalled();
      expect(mockScadaConnectionRepo.findAll).not.toHaveBeenCalled();

      jest.clearAllMocks();

      // Test 2: onlyEnabled when no wellId
      const query2 = new GetScadaConnectionsQuery(tenantId, undefined, true);
      mockScadaConnectionRepo.findEnabled.mockResolvedValue([connection]);

      await handler.execute(query2);

      expect(mockScadaConnectionRepo.findEnabled).toHaveBeenCalled();
      expect(mockScadaConnectionRepo.findByWellId).not.toHaveBeenCalled();
      expect(mockScadaConnectionRepo.findAll).not.toHaveBeenCalled();

      jest.clearAllMocks();

      // Test 3: findAll when no filters
      const query3 = new GetScadaConnectionsQuery(tenantId);
      mockScadaConnectionRepo.findAll.mockResolvedValue([connection]);

      await handler.execute(query3);

      expect(mockScadaConnectionRepo.findAll).toHaveBeenCalled();
      expect(mockScadaConnectionRepo.findByWellId).not.toHaveBeenCalled();
      expect(mockScadaConnectionRepo.findEnabled).not.toHaveBeenCalled();
    });
  });
});
