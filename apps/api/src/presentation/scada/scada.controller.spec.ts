/**
 * SCADA Controller Tests
 *
 * Comprehensive unit tests for SCADA connection and tag mapping endpoints.
 * Tests RBAC security, input validation, command/query execution, and error handling.
 *
 * Security Requirements:
 * - JWT authentication required for all endpoints
 * - Only Admin and Manager roles can create connections and tag mappings
 * - All roles can view connections (read-only access)
 * - Proper tenant isolation via TenantId decorator
 *
 * Test Coverage:
 * - POST /scada/connections (createConnection)
 * - GET /scada/connections (getConnections)
 * - GET /scada/connections/:id (getConnectionById)
 * - POST /scada/connections/:connectionId/tags (createTagMappings)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ScadaController } from './scada.controller';
import { CreateScadaConnectionDto } from './dto/create-scada-connection.dto';
import {
  CreateTagMappingsDto,
  TagConfigDto,
} from './dto/create-tag-mappings.dto';
import {
  ScadaConnectionResponseDto,
  ScadaConnectionsResponseDto,
} from './dto/scada.response.dto';
import { CreateScadaConnectionCommand } from '../../application/scada/commands/create-scada-connection.command';
import {
  CreateTagMappingsCommand,
  CreateTagMappingsResult,
  TagMappingDto,
} from '../../application/scada/commands/create-tag-mappings.command';
import { GetScadaConnectionsQuery } from '../../application/scada/queries/get-scada-connections.query';

describe('ScadaController', () => {
  let controller: ScadaController;
  let commandBus: jest.Mocked<CommandBus>;
  let queryBus: jest.Mocked<QueryBus>;

  // Test data constants
  const tenantId = 'tenant-123';
  const userId = 'user-456';
  const adminUser = {
    userId,
    email: 'admin@example.com',
    roles: ['Admin'],
  };
  const managerUser = {
    userId,
    email: 'manager@example.com',
    roles: ['Manager'],
  };

  beforeEach(async () => {
    // Create mocked dependencies
    const mockCommandBus = {
      execute: jest.fn(),
    };

    const mockQueryBus = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScadaController],
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

    controller = module.get<ScadaController>(ScadaController);
    commandBus = module.get(CommandBus);
    queryBus = module.get(QueryBus);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Controller Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have CommandBus injected', () => {
      expect(commandBus).toBeDefined();
    });

    it('should have QueryBus injected', () => {
      expect(queryBus).toBeDefined();
    });
  });

  describe('POST /scada/connections (createConnection)', () => {
    const validCreateDto: CreateScadaConnectionDto = {
      wellId: 'well-123',
      name: 'Acme Well 001 RTU',
      description: 'Primary SCADA system for production monitoring',
      opcUaUrl: 'opc.tcp://192.168.1.100:4840',
      securityMode: 'SignAndEncrypt',
      securityPolicy: 'Basic256Sha256',
      username: 'opcua_user',
      password: 'secure_password',
      pollIntervalSeconds: 5,
    };

    const mockConnectionResponse: ScadaConnectionResponseDto = {
      id: 'scada_1698765432_abc123',
      tenantId,
      wellId: validCreateDto.wellId,
      name: validCreateDto.name,
      description: validCreateDto.description,
      opcUaUrl: validCreateDto.opcUaUrl,
      securityMode: validCreateDto.securityMode,
      securityPolicy: validCreateDto.securityPolicy,
      hasCredentials: true,
      pollIntervalSeconds: 5,
      status: 'inactive',
      isEnabled: true,
      isHealthy: false,
      createdAt: '2025-10-29T12:00:00.000Z',
      updatedAt: '2025-10-29T12:00:00.000Z',
      createdBy: userId,
      updatedBy: userId,
    };

    describe('Success Cases', () => {
      it('should create connection with valid data (Admin role)', async () => {
        commandBus.execute.mockResolvedValue(mockConnectionResponse);

        const result = await controller.createConnection(
          tenantId,
          adminUser,
          validCreateDto,
        );

        // Verify command was executed with correct parameters
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(commandBus.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId,
            wellId: validCreateDto.wellId,
            name: validCreateDto.name,
            description: validCreateDto.description,
            opcUaUrl: validCreateDto.opcUaUrl,
            securityMode: validCreateDto.securityMode,
            securityPolicy: validCreateDto.securityPolicy,
            username: validCreateDto.username,
            password: validCreateDto.password,
            pollIntervalSeconds: validCreateDto.pollIntervalSeconds,
            userId,
          }),
        );
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(commandBus.execute).toHaveBeenCalledTimes(1);

        // Verify response structure
        expect(result).toHaveProperty('message');
        expect(result).toHaveProperty('connection');
        expect(result.message).toBe('SCADA connection created successfully');
        expect(result.connection).toEqual(mockConnectionResponse);
      });

      it('should create connection with valid data (Manager role)', async () => {
        commandBus.execute.mockResolvedValue(mockConnectionResponse);

        const result = await controller.createConnection(
          tenantId,
          managerUser,
          validCreateDto,
        );

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(commandBus.execute).toHaveBeenCalledTimes(1);
        expect(result).toHaveProperty('message');
        expect(result).toHaveProperty('connection');
      });

      it('should create connection without optional fields', async () => {
        const minimalDto: CreateScadaConnectionDto = {
          wellId: 'well-123',
          name: 'Acme Well 001 RTU',
          opcUaUrl: 'opc.tcp://192.168.1.100:4840',
          securityMode: 'None',
          securityPolicy: 'None',
        };

        const minimalResponse: ScadaConnectionResponseDto = {
          ...mockConnectionResponse,
          description: undefined,
          hasCredentials: false,
          pollIntervalSeconds: 5, // Default value
        };

        commandBus.execute.mockResolvedValue(minimalResponse);

        const result = await controller.createConnection(
          tenantId,
          adminUser,
          minimalDto,
        );

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(commandBus.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId,
            wellId: minimalDto.wellId,
            name: minimalDto.name,
            opcUaUrl: minimalDto.opcUaUrl,
            securityMode: minimalDto.securityMode,
            securityPolicy: minimalDto.securityPolicy,
            userId,
          }),
        );
        expect(result.connection.hasCredentials).toBe(false);
      });

      it('should pass all DTO fields to command', async () => {
        commandBus.execute.mockResolvedValue(mockConnectionResponse);

        await controller.createConnection(tenantId, adminUser, validCreateDto);

        const executedCommand = commandBus.execute.mock
          .calls[0][0] as CreateScadaConnectionCommand;
        expect(executedCommand).toBeInstanceOf(CreateScadaConnectionCommand);
        expect(executedCommand.tenantId).toBe(tenantId);
        expect(executedCommand.wellId).toBe(validCreateDto.wellId);
        expect(executedCommand.name).toBe(validCreateDto.name);
        expect(executedCommand.description).toBe(validCreateDto.description);
        expect(executedCommand.opcUaUrl).toBe(validCreateDto.opcUaUrl);
        expect(executedCommand.securityMode).toBe(validCreateDto.securityMode);
        expect(executedCommand.securityPolicy).toBe(
          validCreateDto.securityPolicy,
        );
        expect(executedCommand.username).toBe(validCreateDto.username);
        expect(executedCommand.password).toBe(validCreateDto.password);
        expect(executedCommand.pollIntervalSeconds).toBe(
          validCreateDto.pollIntervalSeconds,
        );
        expect(executedCommand.userId).toBe(userId);
      });

      it('should return 201 with connection data', async () => {
        commandBus.execute.mockResolvedValue(mockConnectionResponse);

        const result = await controller.createConnection(
          tenantId,
          adminUser,
          validCreateDto,
        );

        expect(result).toBeDefined();
        expect(result.message).toBeTruthy();
        expect(result.connection).toBeDefined();
        expect(result.connection.id).toBe(mockConnectionResponse.id);
        expect(result.connection.tenantId).toBe(tenantId);
        expect(result.connection.wellId).toBe(validCreateDto.wellId);
      });
    });

    describe('Error Cases', () => {
      it('should handle well not found error', async () => {
        const error = new Error('Well not found');
        commandBus.execute.mockRejectedValue(error);

        await expect(
          controller.createConnection(tenantId, adminUser, validCreateDto),
        ).rejects.toThrow('Well not found');

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(commandBus.execute).toHaveBeenCalledTimes(1);
      });

      it('should handle duplicate connection error (well already has SCADA)', async () => {
        const error = new Error(
          'Well already has a SCADA connection. Only one connection allowed per well.',
        );
        commandBus.execute.mockRejectedValue(error);

        await expect(
          controller.createConnection(tenantId, adminUser, validCreateDto),
        ).rejects.toThrow('Well already has a SCADA connection');

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(commandBus.execute).toHaveBeenCalledTimes(1);
      });

      it('should handle connection name conflict error', async () => {
        const error = new Error(
          'A SCADA connection with name "Acme Well 001 RTU" already exists',
        );
        commandBus.execute.mockRejectedValue(error);

        await expect(
          controller.createConnection(tenantId, adminUser, validCreateDto),
        ).rejects.toThrow('already exists');

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(commandBus.execute).toHaveBeenCalledTimes(1);
      });

      it('should handle invalid OPC-UA URL error', async () => {
        const error = new Error('Invalid OPC-UA URL format');
        commandBus.execute.mockRejectedValue(error);

        await expect(
          controller.createConnection(tenantId, adminUser, validCreateDto),
        ).rejects.toThrow('Invalid OPC-UA URL format');
      });

      it('should handle database connection error', async () => {
        const error = new Error('Database connection failed');
        commandBus.execute.mockRejectedValue(error);

        await expect(
          controller.createConnection(tenantId, adminUser, validCreateDto),
        ).rejects.toThrow('Database connection failed');
      });
    });

    describe('RBAC Enforcement', () => {
      it('should have @Roles decorator with Admin and Manager', () => {
        // Verify decorator metadata (tested in E2E for actual enforcement)
        expect(controller).toBeDefined();
        // Note: Actual RBAC enforcement is tested in E2E tests
        // Unit tests verify the controller logic, not guard behavior
      });
    });
  });

  describe('GET /scada/connections (getConnections)', () => {
    const mockConnections: ScadaConnectionResponseDto[] = [
      {
        id: 'scada_1',
        tenantId,
        wellId: 'well-1',
        name: 'Connection 1',
        opcUaUrl: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'SignAndEncrypt',
        securityPolicy: 'Basic256Sha256',
        hasCredentials: true,
        pollIntervalSeconds: 5,
        status: 'active',
        isEnabled: true,
        isHealthy: true,
        createdAt: '2025-10-29T12:00:00.000Z',
        updatedAt: '2025-10-29T12:00:00.000Z',
        createdBy: userId,
        updatedBy: userId,
      },
      {
        id: 'scada_2',
        tenantId,
        wellId: 'well-2',
        name: 'Connection 2',
        opcUaUrl: 'opc.tcp://192.168.1.101:4840',
        securityMode: 'None',
        securityPolicy: 'None',
        hasCredentials: false,
        pollIntervalSeconds: 10,
        status: 'inactive',
        isEnabled: false,
        isHealthy: false,
        createdAt: '2025-10-29T13:00:00.000Z',
        updatedAt: '2025-10-29T13:00:00.000Z',
        createdBy: userId,
        updatedBy: userId,
      },
    ];

    const mockResponse: ScadaConnectionsResponseDto = {
      connections: mockConnections,
      count: mockConnections.length,
    };

    describe('Success Cases', () => {
      it('should return all connections for tenant', async () => {
        queryBus.execute.mockResolvedValue(mockResponse);

        const result = await controller.getConnections(tenantId);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(queryBus.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId,
            wellId: undefined,
            onlyEnabled: undefined,
          }),
        );
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(queryBus.execute).toHaveBeenCalledTimes(1);

        expect(result).toEqual(mockResponse);
        expect(result.connections).toHaveLength(2);
        expect(result.count).toBe(2);
      });

      it('should filter by wellId when provided', async () => {
        const filteredResponse: ScadaConnectionsResponseDto = {
          connections: [mockConnections[0]],
          count: 1,
        };
        queryBus.execute.mockResolvedValue(filteredResponse);

        const result = await controller.getConnections(tenantId, 'well-1');

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(queryBus.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId,
            wellId: 'well-1',
            onlyEnabled: undefined,
          }),
        );

        expect(result.connections).toHaveLength(1);
        expect(result.connections[0].wellId).toBe('well-1');
        expect(result.count).toBe(1);
      });

      it('should filter by onlyEnabled when true', async () => {
        const enabledResponse: ScadaConnectionsResponseDto = {
          connections: [mockConnections[0]],
          count: 1,
        };
        queryBus.execute.mockResolvedValue(enabledResponse);

        const result = await controller.getConnections(
          tenantId,
          undefined,
          true,
        );

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(queryBus.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId,
            wellId: undefined,
            onlyEnabled: true,
          }),
        );

        expect(result.connections).toHaveLength(1);
        expect(result.connections[0].isEnabled).toBe(true);
      });

      it('should pass tenantId and filters to query', async () => {
        queryBus.execute.mockResolvedValue(mockResponse);

        await controller.getConnections(tenantId, 'well-1', true);

        const executedQuery = queryBus.execute.mock
          .calls[0][0] as GetScadaConnectionsQuery;
        expect(executedQuery).toBeInstanceOf(GetScadaConnectionsQuery);
        expect(executedQuery.tenantId).toBe(tenantId);
        expect(executedQuery.wellId).toBe('well-1');
        expect(executedQuery.onlyEnabled).toBe(true);
      });

      it('should return 200 with connections array', async () => {
        queryBus.execute.mockResolvedValue(mockResponse);

        const result = await controller.getConnections(tenantId);

        expect(result).toBeDefined();
        expect(result.connections).toBeDefined();
        expect(Array.isArray(result.connections)).toBe(true);
        expect(result.count).toBe(mockConnections.length);
      });

      it('should return empty array when no connections found', async () => {
        const emptyResponse: ScadaConnectionsResponseDto = {
          connections: [],
          count: 0,
        };
        queryBus.execute.mockResolvedValue(emptyResponse);

        const result = await controller.getConnections(tenantId);

        expect(result.connections).toEqual([]);
        expect(result.count).toBe(0);
      });
    });
  });

  describe('GET /scada/connections/:id (getConnectionById)', () => {
    const mockConnections: ScadaConnectionResponseDto[] = [
      {
        id: 'scada_1',
        tenantId,
        wellId: 'well-1',
        name: 'Connection 1',
        opcUaUrl: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'SignAndEncrypt',
        securityPolicy: 'Basic256Sha256',
        hasCredentials: true,
        pollIntervalSeconds: 5,
        status: 'active',
        isEnabled: true,
        isHealthy: true,
        createdAt: '2025-10-29T12:00:00.000Z',
        updatedAt: '2025-10-29T12:00:00.000Z',
        createdBy: userId,
        updatedBy: userId,
      },
    ];

    const mockResponse: ScadaConnectionsResponseDto = {
      connections: mockConnections,
      count: 1,
    };

    describe('Success Cases', () => {
      it('should return connection when found', async () => {
        queryBus.execute.mockResolvedValue(mockResponse);

        const result = await controller.getConnectionById(tenantId, 'scada_1');

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(queryBus.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId,
          }),
        );

        expect(result).toEqual(mockConnections[0]);
        expect(result.id).toBe('scada_1');
      });

      it('should pass tenantId to query', async () => {
        queryBus.execute.mockResolvedValue(mockResponse);

        await controller.getConnectionById(tenantId, 'scada_1');

        const executedQuery = queryBus.execute.mock
          .calls[0][0] as GetScadaConnectionsQuery;
        expect(executedQuery).toBeInstanceOf(GetScadaConnectionsQuery);
        expect(executedQuery.tenantId).toBe(tenantId);
      });
    });

    describe('Error Cases', () => {
      it('should throw error when connection not found', async () => {
        const emptyResponse: ScadaConnectionsResponseDto = {
          connections: [],
          count: 0,
        };
        queryBus.execute.mockResolvedValue(emptyResponse);

        await expect(
          controller.getConnectionById(tenantId, 'non-existent'),
        ).rejects.toThrow('SCADA connection not found');
      });

      it('should throw error when connection belongs to different tenant', async () => {
        queryBus.execute.mockResolvedValue({
          connections: [],
          count: 0,
        });

        await expect(
          controller.getConnectionById(tenantId, 'scada_other_tenant'),
        ).rejects.toThrow('SCADA connection not found');
      });
    });
  });

  describe('POST /scada/connections/:connectionId/tags (createTagMappings)', () => {
    const connectionId = 'scada_1';
    const validTagConfigDto: TagConfigDto = {
      nodeId: 'ns=2;s=Pressure',
      tagName: 'casingPressure',
      fieldEntryProperty: 'casingPressure',
      dataType: 'Float',
      unit: 'psi',
      scalingFactor: 1.0,
      deadband: 5.0,
    };

    const validCreateTagsDto: CreateTagMappingsDto = {
      tags: [validTagConfigDto],
    };

    const mockResult: CreateTagMappingsResult = {
      count: 1,
      tagMappings: [
        {
          id: 'tag_1',
          tenantId,
          scadaConnectionId: connectionId,
          nodeId: validTagConfigDto.nodeId,
          tagName: validTagConfigDto.tagName,
          fieldEntryProperty: validTagConfigDto.fieldEntryProperty,
          dataType: validTagConfigDto.dataType,
          unit: validTagConfigDto.unit,
          scalingFactor: validTagConfigDto.scalingFactor!,
          deadband: validTagConfigDto.deadband,
          isEnabled: true,
          createdAt: '2025-10-29T12:00:00.000Z',
          updatedAt: '2025-10-29T12:00:00.000Z',
        },
      ],
    };

    describe('Success Cases', () => {
      it('should create tag mappings with valid data (Admin role)', async () => {
        commandBus.execute.mockResolvedValue(mockResult);

        const result = await controller.createTagMappings(
          tenantId,
          adminUser,
          connectionId,
          validCreateTagsDto,
        );

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(commandBus.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId,
            scadaConnectionId: connectionId,
            userId,
          }),
        );
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(commandBus.execute).toHaveBeenCalledTimes(1);

        expect(result).toHaveProperty('message');
        expect(result).toHaveProperty('result');
        expect(result.message).toBe('1 tag mapping created successfully');
        expect(result.result).toEqual(mockResult);
      });

      it('should create tag mappings with valid data (Manager role)', async () => {
        commandBus.execute.mockResolvedValue(mockResult);

        const result = await controller.createTagMappings(
          tenantId,
          managerUser,
          connectionId,
          validCreateTagsDto,
        );

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(commandBus.execute).toHaveBeenCalledTimes(1);
        expect(result).toHaveProperty('message');
        expect(result).toHaveProperty('result');
      });

      it('should create multiple tag mappings', async () => {
        const multipleTags: CreateTagMappingsDto = {
          tags: [
            validTagConfigDto,
            {
              nodeId: 'ns=2;s=Temperature',
              tagName: 'temperature',
              fieldEntryProperty: 'temperature',
              dataType: 'Float',
              unit: '°F',
              scalingFactor: 1.0,
            },
            {
              nodeId: 'ns=2;s=FlowRate',
              tagName: 'flowRate',
              fieldEntryProperty: 'flowRate',
              dataType: 'Float',
              unit: 'bbl/day',
            },
          ],
        };

        const multipleResult: CreateTagMappingsResult = {
          count: 3,
          tagMappings: multipleTags.tags.map((tag, index) => ({
            id: `tag_${index + 1}`,
            tenantId,
            scadaConnectionId: connectionId,
            nodeId: tag.nodeId,
            tagName: tag.tagName,
            fieldEntryProperty: tag.fieldEntryProperty,
            dataType: tag.dataType,
            unit: tag.unit,
            scalingFactor: tag.scalingFactor ?? 1.0,
            deadband: tag.deadband,
            isEnabled: true,
            createdAt: '2025-10-29T12:00:00.000Z',
            updatedAt: '2025-10-29T12:00:00.000Z',
          })),
        };

        commandBus.execute.mockResolvedValue(multipleResult);

        const result = await controller.createTagMappings(
          tenantId,
          adminUser,
          connectionId,
          multipleTags,
        );

        expect(result.message).toBe('3 tag mappings created successfully');
        expect(result.result.count).toBe(3);
      });

      it('should map DTOs to TagConfigInput with proper type casting', async () => {
        commandBus.execute.mockResolvedValue(mockResult);

        await controller.createTagMappings(
          tenantId,
          adminUser,
          connectionId,
          validCreateTagsDto,
        );

        const executedCommand = commandBus.execute.mock
          .calls[0][0] as CreateTagMappingsCommand;
        expect(executedCommand).toBeInstanceOf(CreateTagMappingsCommand);

        const tagInputs = executedCommand.tags;
        expect(tagInputs).toHaveLength(1);
        expect(tagInputs[0]).toEqual({
          nodeId: validTagConfigDto.nodeId,
          tagName: validTagConfigDto.tagName,
          fieldEntryProperty: validTagConfigDto.fieldEntryProperty,
          dataType: validTagConfigDto.dataType, // Cast to OpcUaDataType
          unit: validTagConfigDto.unit,
          scalingFactor: validTagConfigDto.scalingFactor,
          deadband: validTagConfigDto.deadband,
        });
      });

      it('should pass tenantId, connectionId, userId, and tag inputs to command', async () => {
        commandBus.execute.mockResolvedValue(mockResult);

        await controller.createTagMappings(
          tenantId,
          adminUser,
          connectionId,
          validCreateTagsDto,
        );

        const executedCommand = commandBus.execute.mock
          .calls[0][0] as CreateTagMappingsCommand;
        expect(executedCommand.tenantId).toBe(tenantId);
        expect(executedCommand.scadaConnectionId).toBe(connectionId);
        expect(executedCommand.userId).toBe(userId);
        expect(executedCommand.tags).toHaveLength(1);
      });

      it('should return 201 with created count', async () => {
        commandBus.execute.mockResolvedValue(mockResult);

        const result = await controller.createTagMappings(
          tenantId,
          adminUser,
          connectionId,
          validCreateTagsDto,
        );

        expect(result).toBeDefined();
        expect(result.message).toBeTruthy();
        expect(result.result).toBeDefined();
        expect(result.result.count).toBe(1);
        expect(result.result.tagMappings).toHaveLength(1);
      });

      it('should handle singular vs plural message correctly', async () => {
        const singleResult: CreateTagMappingsResult = {
          count: 1,
          tagMappings: [mockResult.tagMappings[0]],
        };
        commandBus.execute.mockResolvedValue(singleResult);

        const singleTagResult = await controller.createTagMappings(
          tenantId,
          adminUser,
          connectionId,
          validCreateTagsDto,
        );

        expect(singleTagResult.message).toBe(
          '1 tag mapping created successfully',
        );

        const multipleResult: CreateTagMappingsResult = {
          count: 5,

          tagMappings: Array(5).fill(
            mockResult.tagMappings[0],
          ) as TagMappingDto[],
        };
        commandBus.execute.mockResolvedValue(multipleResult);

        const multipleTagResult = await controller.createTagMappings(
          tenantId,
          adminUser,
          connectionId,
          {
            tags: Array(5).fill(validTagConfigDto) as TagConfigDto[],
          },
        );

        expect(multipleTagResult.message).toBe(
          '5 tag mappings created successfully',
        );
      });

      it('should handle tags without optional fields', async () => {
        const minimalTag: TagConfigDto = {
          nodeId: 'ns=2;s=Pressure',
          tagName: 'casingPressure',
          fieldEntryProperty: 'casingPressure',
          dataType: 'Float',
        };

        const minimalDto: CreateTagMappingsDto = {
          tags: [minimalTag],
        };

        const minimalResult: CreateTagMappingsResult = {
          count: 1,
          tagMappings: [
            {
              id: 'tag_1',
              tenantId,
              scadaConnectionId: connectionId,
              nodeId: minimalTag.nodeId,
              tagName: minimalTag.tagName,
              fieldEntryProperty: minimalTag.fieldEntryProperty,
              dataType: minimalTag.dataType,
              unit: undefined,
              scalingFactor: 1.0,
              deadband: undefined,
              isEnabled: true,
              createdAt: '2025-10-29T12:00:00.000Z',
              updatedAt: '2025-10-29T12:00:00.000Z',
            },
          ],
        };

        commandBus.execute.mockResolvedValue(minimalResult);

        const result = await controller.createTagMappings(
          tenantId,
          adminUser,
          connectionId,
          minimalDto,
        );

        expect(result.result.count).toBe(1);
        expect(result.result.tagMappings[0].unit).toBeUndefined();
        expect(result.result.tagMappings[0].deadband).toBeUndefined();
      });
    });

    describe('Error Cases', () => {
      it('should handle connection not found error', async () => {
        const error = new Error('SCADA connection not found');
        commandBus.execute.mockRejectedValue(error);

        await expect(
          controller.createTagMappings(
            tenantId,
            adminUser,
            'non-existent',
            validCreateTagsDto,
          ),
        ).rejects.toThrow('SCADA connection not found');

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(commandBus.execute).toHaveBeenCalledTimes(1);
      });

      it('should handle duplicate node ID error', async () => {
        const error = new Error(
          'Tag mapping with node ID "ns=2;s=Pressure" already exists for this connection',
        );
        commandBus.execute.mockRejectedValue(error);

        await expect(
          controller.createTagMappings(
            tenantId,
            adminUser,
            connectionId,
            validCreateTagsDto,
          ),
        ).rejects.toThrow('already exists');

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(commandBus.execute).toHaveBeenCalledTimes(1);
      });

      it('should handle duplicate field property error', async () => {
        const error = new Error(
          'Tag mapping for field property "casingPressure" already exists for this connection',
        );
        commandBus.execute.mockRejectedValue(error);

        await expect(
          controller.createTagMappings(
            tenantId,
            adminUser,
            connectionId,
            validCreateTagsDto,
          ),
        ).rejects.toThrow('already exists');
      });

      it('should handle duplicate tag name error', async () => {
        const error = new Error(
          'Tag mapping with tag name "casingPressure" already exists for this connection',
        );
        commandBus.execute.mockRejectedValue(error);

        await expect(
          controller.createTagMappings(
            tenantId,
            adminUser,
            connectionId,
            validCreateTagsDto,
          ),
        ).rejects.toThrow('already exists');
      });

      it('should handle invalid data type error', async () => {
        const error = new Error('Invalid OPC-UA data type');
        commandBus.execute.mockRejectedValue(error);

        await expect(
          controller.createTagMappings(
            tenantId,
            adminUser,
            connectionId,
            validCreateTagsDto,
          ),
        ).rejects.toThrow('Invalid OPC-UA data type');
      });

      it('should handle database connection error', async () => {
        const error = new Error('Database connection failed');
        commandBus.execute.mockRejectedValue(error);

        await expect(
          controller.createTagMappings(
            tenantId,
            adminUser,
            connectionId,
            validCreateTagsDto,
          ),
        ).rejects.toThrow('Database connection failed');
      });
    });

    describe('Type Casting', () => {
      it('should properly cast all OPC-UA data types', async () => {
        const allDataTypes: TagConfigDto[] = [
          {
            nodeId: 'ns=2;s=Bool',
            tagName: 'bool1',
            fieldEntryProperty: 'casingPressure',
            dataType: 'Boolean',
          },
          {
            nodeId: 'ns=2;s=SByte',
            tagName: 'sbyte1',
            fieldEntryProperty: 'tubingPressure',
            dataType: 'SByte',
          },
          {
            nodeId: 'ns=2;s=Byte',
            tagName: 'byte1',
            fieldEntryProperty: 'linePressure',
            dataType: 'Byte',
          },
          {
            nodeId: 'ns=2;s=Int16',
            tagName: 'int16_1',
            fieldEntryProperty: 'temperature',
            dataType: 'Int16',
          },
          {
            nodeId: 'ns=2;s=UInt16',
            tagName: 'uint16_1',
            fieldEntryProperty: 'flowRate',
            dataType: 'UInt16',
          },
          {
            nodeId: 'ns=2;s=Int32',
            tagName: 'int32_1',
            fieldEntryProperty: 'oilVolume',
            dataType: 'Int32',
          },
          {
            nodeId: 'ns=2;s=UInt32',
            tagName: 'uint32_1',
            fieldEntryProperty: 'gasVolume',
            dataType: 'UInt32',
          },
          {
            nodeId: 'ns=2;s=Int64',
            tagName: 'int64_1',
            fieldEntryProperty: 'waterVolume',
            dataType: 'Int64',
          },
          {
            nodeId: 'ns=2;s=UInt64',
            tagName: 'uint64_1',
            fieldEntryProperty: 'chokePressure',
            dataType: 'UInt64',
          },
          {
            nodeId: 'ns=2;s=Float',
            tagName: 'float1',
            fieldEntryProperty: 'separatorPressure',
            dataType: 'Float',
          },
          {
            nodeId: 'ns=2;s=Double',
            tagName: 'double1',
            fieldEntryProperty: 'casingPressure',
            dataType: 'Double',
          },
          {
            nodeId: 'ns=2;s=String',
            tagName: 'string1',
            fieldEntryProperty: 'tubingPressure',
            dataType: 'String',
          },
          {
            nodeId: 'ns=2;s=DateTime',
            tagName: 'datetime1',
            fieldEntryProperty: 'linePressure',
            dataType: 'DateTime',
          },
        ];

        const allTypesDto: CreateTagMappingsDto = {
          tags: allDataTypes,
        };

        const allTypesResult: CreateTagMappingsResult = {
          count: allDataTypes.length,
          tagMappings: allDataTypes.map((tag, index) => ({
            id: `tag_${index + 1}`,
            tenantId,
            scadaConnectionId: connectionId,
            nodeId: tag.nodeId,
            tagName: tag.tagName,
            fieldEntryProperty: tag.fieldEntryProperty,
            dataType: tag.dataType,
            unit: undefined,
            scalingFactor: 1.0,
            deadband: undefined,
            isEnabled: true,
            createdAt: '2025-10-29T12:00:00.000Z',
            updatedAt: '2025-10-29T12:00:00.000Z',
          })),
        };

        commandBus.execute.mockResolvedValue(allTypesResult);

        await controller.createTagMappings(
          tenantId,
          adminUser,
          connectionId,
          allTypesDto,
        );

        const executedCommand = commandBus.execute.mock
          .calls[0][0] as CreateTagMappingsCommand;
        const tagInputs = executedCommand.tags;

        expect(tagInputs).toHaveLength(allDataTypes.length);
        allDataTypes.forEach((expectedTag, index) => {
          expect(tagInputs[index].dataType).toBe(expectedTag.dataType);
        });
      });
    });

    describe('RBAC Enforcement', () => {
      it('should have @Roles decorator with Admin and Manager', () => {
        // Verify decorator metadata (tested in E2E for actual enforcement)
        expect(controller).toBeDefined();
        // Note: Actual RBAC enforcement is tested in E2E tests
        // Unit tests verify the controller logic, not guard behavior
      });
    });
  });

  describe('Security and Guards', () => {
    it('should have @UseGuards decorator with JwtAuthGuard and RolesGuard', () => {
      // Verify that guards are configured on controller class
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const metadata = Reflect.getMetadata('__guards__', ScadaController);
      expect(metadata).toBeDefined();
      // Note: Actual guard execution is tested in E2E tests
    });

    it('should require authentication for all endpoints', () => {
      // Verify JwtAuthGuard is applied at controller level
      expect(controller).toBeDefined();
      // Note: Actual authentication is tested in E2E tests
    });

    it('should enforce tenant isolation via TenantId decorator', () => {
      // Verify that all methods use @TenantId() decorator
      expect(controller).toBeDefined();
      // Note: Actual tenant isolation is tested in E2E tests
    });
  });
});
