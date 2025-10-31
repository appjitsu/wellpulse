/**
 * CreateTagMappingsHandler Tests
 *
 * Tests tag mappings creation command handler with comprehensive coverage of:
 * - Successful creation of single and multiple tag mappings
 * - SCADA connection existence validation
 * - Duplicate prevention (node IDs, field properties, tag names)
 * - Tag configuration validation (data types, scaling factors, deadbands)
 * - Bulk creation scenarios
 * - Error handling
 * - DTO mapping accuracy
 */

import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  CreateTagMappingsHandler,
  CreateTagMappingsCommand,
  TagConfigInput,
} from './create-tag-mappings.command';
import { ITagMappingRepository } from '../../../domain/repositories/tag-mapping.repository.interface';
import { IScadaConnectionRepository } from '../../../domain/repositories/scada-connection.repository.interface';
import { ScadaConnection } from '../../../domain/scada/scada-connection.entity';
import { OpcUaEndpoint } from '../../../domain/scada/value-objects/opc-ua-endpoint.vo';

/* eslint-disable @typescript-eslint/unbound-method */

describe('CreateTagMappingsHandler', () => {
  let handler: CreateTagMappingsHandler;
  let mockTagMappingRepo: jest.Mocked<ITagMappingRepository>;
  let mockScadaConnectionRepo: jest.Mocked<IScadaConnectionRepository>;

  const tenantId = 'tenant-123';
  const scadaConnectionId = 'scada-456';
  const userId = 'user-789';

  const validTagConfig: TagConfigInput = {
    nodeId: 'ns=2;s=Pressure',
    tagName: 'casingPressure',
    fieldEntryProperty: 'casingPressure',
    dataType: 'Float',
    unit: 'psi',
    scalingFactor: 1.0,
    deadband: 0.5,
  };

  beforeEach(() => {
    // Create mock tag mapping repository
    mockTagMappingRepo = {
      save: jest.fn(),
      saveMany: jest.fn(),
      findById: jest.fn(),
      findByConnectionId: jest.fn(),
      findEnabledByConnectionId: jest.fn(),
      findByNodeId: jest.fn(),
      findByFieldProperty: jest.fn(),
      existsByNodeId: jest.fn(),
      existsByFieldProperty: jest.fn(),
      delete: jest.fn(),
      deleteByConnectionId: jest.fn(),
    } as jest.Mocked<ITagMappingRepository>;

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

    // Initialize handler with mocks
    handler = new CreateTagMappingsHandler(
      mockTagMappingRepo,
      mockScadaConnectionRepo,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful Creation', () => {
    it('should create single tag mapping successfully', async () => {
      // Arrange
      const mockEndpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const mockConnection = ScadaConnection.create({
        tenantId,
        wellId: 'well-123',
        name: 'RTU-001',
        endpoint: mockEndpoint,
        createdBy: userId,
      });

      const command = new CreateTagMappingsCommand(
        tenantId,
        scadaConnectionId,
        [validTagConfig],
        userId,
      );

      mockScadaConnectionRepo.findById.mockResolvedValue(mockConnection);
      mockTagMappingRepo.existsByNodeId.mockResolvedValue(false);
      mockTagMappingRepo.existsByFieldProperty.mockResolvedValue(false);
      mockTagMappingRepo.saveMany.mockResolvedValue(undefined);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result).toBeDefined();
      expect(result.count).toBe(1);
      expect(result.tagMappings).toHaveLength(1);
      expect(result.tagMappings[0].nodeId).toBe('ns=2;s=Pressure');
      expect(result.tagMappings[0].tagName).toBe('casingPressure');
      expect(result.tagMappings[0].fieldEntryProperty).toBe('casingPressure');
      expect(result.tagMappings[0].dataType).toBe('Float');
      expect(result.tagMappings[0].unit).toBe('psi');
      expect(result.tagMappings[0].scalingFactor).toBe(1.0);
      expect(result.tagMappings[0].deadband).toBe(0.5);
      expect(result.tagMappings[0].isEnabled).toBe(true);
      expect(mockTagMappingRepo.saveMany).toHaveBeenCalledTimes(1);
    });

    it('should create multiple tag mappings in bulk', async () => {
      // Arrange
      const mockEndpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const mockConnection = ScadaConnection.create({
        tenantId,
        wellId: 'well-123',
        name: 'RTU-001',
        endpoint: mockEndpoint,
        createdBy: userId,
      });

      const tagConfigs: TagConfigInput[] = [
        {
          nodeId: 'ns=2;s=CasingPressure',
          tagName: 'casingPressure',
          fieldEntryProperty: 'casingPressure',
          dataType: 'Float',
          unit: 'psi',
          scalingFactor: 1.0,
        },
        {
          nodeId: 'ns=2;s=TubingPressure',
          tagName: 'tubingPressure',
          fieldEntryProperty: 'tubingPressure',
          dataType: 'Float',
          unit: 'psi',
          scalingFactor: 1.0,
        },
        {
          nodeId: 'ns=2;s=Temperature',
          tagName: 'temperature',
          fieldEntryProperty: 'temperature',
          dataType: 'Float',
          unit: 'F',
          scalingFactor: 1.0,
        },
        {
          nodeId: 'ns=2;s=FlowRate',
          tagName: 'flowRate',
          fieldEntryProperty: 'flowRate',
          dataType: 'Float',
          unit: 'bbl/day',
          scalingFactor: 1.0,
        },
        {
          nodeId: 'ns=2;s=GasVolume',
          tagName: 'gasVolume',
          fieldEntryProperty: 'gasVolume',
          dataType: 'Float',
          unit: 'mcf',
          scalingFactor: 1.0,
        },
      ];

      const command = new CreateTagMappingsCommand(
        tenantId,
        scadaConnectionId,
        tagConfigs,
        userId,
      );

      mockScadaConnectionRepo.findById.mockResolvedValue(mockConnection);
      mockTagMappingRepo.existsByNodeId.mockResolvedValue(false);
      mockTagMappingRepo.existsByFieldProperty.mockResolvedValue(false);
      mockTagMappingRepo.saveMany.mockResolvedValue(undefined);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.count).toBe(5);
      expect(result.tagMappings).toHaveLength(5);
      expect(result.tagMappings[0].fieldEntryProperty).toBe('casingPressure');
      expect(result.tagMappings[1].fieldEntryProperty).toBe('tubingPressure');
      expect(result.tagMappings[2].fieldEntryProperty).toBe('temperature');
      expect(result.tagMappings[3].fieldEntryProperty).toBe('flowRate');
      expect(result.tagMappings[4].fieldEntryProperty).toBe('gasVolume');
      expect(mockTagMappingRepo.saveMany).toHaveBeenCalledTimes(1);
      expect(mockTagMappingRepo.saveMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            _tenantId: tenantId,
            _scadaConnectionId: scadaConnectionId,
          }),
        ]),
      );
    });

    it('should create tag mapping without optional fields', async () => {
      // Arrange
      const mockEndpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const mockConnection = ScadaConnection.create({
        tenantId,
        wellId: 'well-123',
        name: 'RTU-001',
        endpoint: mockEndpoint,
        createdBy: userId,
      });

      const minimalTagConfig: TagConfigInput = {
        nodeId: 'ns=2;s=FlowRate',
        tagName: 'flowRate',
        fieldEntryProperty: 'flowRate',
        dataType: 'Double',
        // No unit, scalingFactor, or deadband
      };

      const command = new CreateTagMappingsCommand(
        tenantId,
        scadaConnectionId,
        [minimalTagConfig],
        userId,
      );

      mockScadaConnectionRepo.findById.mockResolvedValue(mockConnection);
      mockTagMappingRepo.existsByNodeId.mockResolvedValue(false);
      mockTagMappingRepo.existsByFieldProperty.mockResolvedValue(false);
      mockTagMappingRepo.saveMany.mockResolvedValue(undefined);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.tagMappings[0].unit).toBeUndefined();
      expect(result.tagMappings[0].scalingFactor).toBe(1.0); // Default value
      expect(result.tagMappings[0].deadband).toBeUndefined();
    });

    it('should create tag mappings with different data types', async () => {
      // Arrange
      const mockEndpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const mockConnection = ScadaConnection.create({
        tenantId,
        wellId: 'well-123',
        name: 'RTU-001',
        endpoint: mockEndpoint,
        createdBy: userId,
      });

      const tagConfigs: TagConfigInput[] = [
        {
          nodeId: 'ns=2;s=IntValue',
          tagName: 'intValue',
          fieldEntryProperty: 'casingPressure',
          dataType: 'Int32',
        },
        {
          nodeId: 'ns=2;s=BoolValue',
          tagName: 'boolValue',
          fieldEntryProperty: 'tubingPressure',
          dataType: 'Boolean',
        },
        {
          nodeId: 'ns=2;s=StringValue',
          tagName: 'stringValue',
          fieldEntryProperty: 'temperature',
          dataType: 'String',
        },
      ];

      const command = new CreateTagMappingsCommand(
        tenantId,
        scadaConnectionId,
        tagConfigs,
        userId,
      );

      mockScadaConnectionRepo.findById.mockResolvedValue(mockConnection);
      mockTagMappingRepo.existsByNodeId.mockResolvedValue(false);
      mockTagMappingRepo.existsByFieldProperty.mockResolvedValue(false);
      mockTagMappingRepo.saveMany.mockResolvedValue(undefined);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.count).toBe(3);
      expect(result.tagMappings[0].dataType).toBe('Int32');
      expect(result.tagMappings[1].dataType).toBe('Boolean');
      expect(result.tagMappings[2].dataType).toBe('String');
    });

    it('should verify connection lookup uses correct tenant ID', async () => {
      // Arrange
      const mockEndpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const mockConnection = ScadaConnection.create({
        tenantId,
        wellId: 'well-123',
        name: 'RTU-001',
        endpoint: mockEndpoint,
        createdBy: userId,
      });

      const command = new CreateTagMappingsCommand(
        tenantId,
        scadaConnectionId,
        [validTagConfig],
        userId,
      );

      mockScadaConnectionRepo.findById.mockResolvedValue(mockConnection);
      mockTagMappingRepo.existsByNodeId.mockResolvedValue(false);
      mockTagMappingRepo.existsByFieldProperty.mockResolvedValue(false);
      mockTagMappingRepo.saveMany.mockResolvedValue(undefined);

      // Act
      await handler.execute(command);

      // Assert
      expect(mockScadaConnectionRepo.findById).toHaveBeenCalledWith(
        tenantId,
        scadaConnectionId,
      );
    });
  });

  describe('SCADA Connection Validation', () => {
    it('should throw NotFoundException when SCADA connection does not exist', async () => {
      // Arrange
      const command = new CreateTagMappingsCommand(
        tenantId,
        scadaConnectionId,
        [validTagConfig],
        userId,
      );

      mockScadaConnectionRepo.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
      await expect(handler.execute(command)).rejects.toThrow(
        `SCADA connection with ID ${scadaConnectionId} not found`,
      );

      // Verify no tag mappings were created
      expect(mockTagMappingRepo.saveMany).not.toHaveBeenCalled();
    });

    it('should validate connection before checking duplicates', async () => {
      // Arrange
      const command = new CreateTagMappingsCommand(
        tenantId,
        scadaConnectionId,
        [validTagConfig],
        userId,
      );

      mockScadaConnectionRepo.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(NotFoundException);

      // Verify subsequent checks were not performed
      expect(mockTagMappingRepo.existsByNodeId).not.toHaveBeenCalled();
      expect(mockTagMappingRepo.existsByFieldProperty).not.toHaveBeenCalled();
    });
  });

  describe('Duplicate Prevention in Request', () => {
    it('should throw ConflictException for duplicate node IDs in request', async () => {
      // Arrange
      const mockEndpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const mockConnection = ScadaConnection.create({
        tenantId,
        wellId: 'well-123',
        name: 'RTU-001',
        endpoint: mockEndpoint,
        createdBy: userId,
      });

      const duplicateNodeId = 'ns=2;s=Pressure';
      const tagConfigs: TagConfigInput[] = [
        {
          nodeId: duplicateNodeId,
          tagName: 'casingPressure',
          fieldEntryProperty: 'casingPressure',
          dataType: 'Float',
        },
        {
          nodeId: duplicateNodeId, // Duplicate
          tagName: 'tubingPressure',
          fieldEntryProperty: 'tubingPressure',
          dataType: 'Float',
        },
      ];

      const command = new CreateTagMappingsCommand(
        tenantId,
        scadaConnectionId,
        tagConfigs,
        userId,
      );

      mockScadaConnectionRepo.findById.mockResolvedValue(mockConnection);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(ConflictException);
      await expect(handler.execute(command)).rejects.toThrow(
        `Duplicate node ID in request: ${duplicateNodeId}`,
      );

      // Verify no tag mappings were created
      expect(mockTagMappingRepo.saveMany).not.toHaveBeenCalled();
    });

    it('should throw ConflictException for duplicate field properties in request', async () => {
      // Arrange
      const mockEndpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const mockConnection = ScadaConnection.create({
        tenantId,
        wellId: 'well-123',
        name: 'RTU-001',
        endpoint: mockEndpoint,
        createdBy: userId,
      });

      const duplicateProperty = 'casingPressure';
      const tagConfigs: TagConfigInput[] = [
        {
          nodeId: 'ns=2;s=Pressure1',
          tagName: 'pressure1',
          fieldEntryProperty: duplicateProperty,
          dataType: 'Float',
        },
        {
          nodeId: 'ns=2;s=Pressure2',
          tagName: 'pressure2',
          fieldEntryProperty: duplicateProperty, // Duplicate
          dataType: 'Float',
        },
      ];

      const command = new CreateTagMappingsCommand(
        tenantId,
        scadaConnectionId,
        tagConfigs,
        userId,
      );

      mockScadaConnectionRepo.findById.mockResolvedValue(mockConnection);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(ConflictException);
      await expect(handler.execute(command)).rejects.toThrow(
        `Duplicate field entry property in request: ${duplicateProperty}`,
      );

      // Verify no tag mappings were created
      expect(mockTagMappingRepo.saveMany).not.toHaveBeenCalled();
    });

    it('should throw ConflictException for duplicate tag names in request', async () => {
      // Arrange
      const mockEndpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const mockConnection = ScadaConnection.create({
        tenantId,
        wellId: 'well-123',
        name: 'RTU-001',
        endpoint: mockEndpoint,
        createdBy: userId,
      });

      const duplicateTagName = 'pressure';
      const tagConfigs: TagConfigInput[] = [
        {
          nodeId: 'ns=2;s=Pressure1',
          tagName: duplicateTagName,
          fieldEntryProperty: 'casingPressure',
          dataType: 'Float',
        },
        {
          nodeId: 'ns=2;s=Pressure2',
          tagName: duplicateTagName, // Duplicate
          fieldEntryProperty: 'tubingPressure',
          dataType: 'Float',
        },
      ];

      const command = new CreateTagMappingsCommand(
        tenantId,
        scadaConnectionId,
        tagConfigs,
        userId,
      );

      mockScadaConnectionRepo.findById.mockResolvedValue(mockConnection);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(ConflictException);
      await expect(handler.execute(command)).rejects.toThrow(
        `Duplicate tag name in request: ${duplicateTagName}`,
      );

      // Verify no tag mappings were created
      expect(mockTagMappingRepo.saveMany).not.toHaveBeenCalled();
    });
  });

  describe('Duplicate Prevention in Database', () => {
    it('should throw ConflictException when node ID already exists in database', async () => {
      // Arrange
      const mockEndpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const mockConnection = ScadaConnection.create({
        tenantId,
        wellId: 'well-123',
        name: 'RTU-001',
        endpoint: mockEndpoint,
        createdBy: userId,
      });

      const existingNodeId = 'ns=2;s=ExistingPressure';
      const tagConfig: TagConfigInput = {
        nodeId: existingNodeId,
        tagName: 'newPressure',
        fieldEntryProperty: 'casingPressure',
        dataType: 'Float',
      };

      const command = new CreateTagMappingsCommand(
        tenantId,
        scadaConnectionId,
        [tagConfig],
        userId,
      );

      mockScadaConnectionRepo.findById.mockResolvedValue(mockConnection);
      mockTagMappingRepo.existsByNodeId.mockResolvedValue(true); // Already exists

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(ConflictException);
      await expect(handler.execute(command)).rejects.toThrow(
        `Tag mapping with node ID "${existingNodeId}" already exists for this connection`,
      );

      // Verify no tag mappings were created
      expect(mockTagMappingRepo.saveMany).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when field property already exists in database', async () => {
      // Arrange
      const mockEndpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const mockConnection = ScadaConnection.create({
        tenantId,
        wellId: 'well-123',
        name: 'RTU-001',
        endpoint: mockEndpoint,
        createdBy: userId,
      });

      const existingProperty = 'casingPressure';
      const tagConfig: TagConfigInput = {
        nodeId: 'ns=2;s=NewNode',
        tagName: 'newTag',
        fieldEntryProperty: existingProperty,
        dataType: 'Float',
      };

      const command = new CreateTagMappingsCommand(
        tenantId,
        scadaConnectionId,
        [tagConfig],
        userId,
      );

      mockScadaConnectionRepo.findById.mockResolvedValue(mockConnection);
      mockTagMappingRepo.existsByNodeId.mockResolvedValue(false);
      mockTagMappingRepo.existsByFieldProperty.mockResolvedValue(true); // Already exists

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(ConflictException);
      await expect(handler.execute(command)).rejects.toThrow(
        `Tag mapping with field entry property "${existingProperty}" already exists for this connection`,
      );

      // Verify no tag mappings were created
      expect(mockTagMappingRepo.saveMany).not.toHaveBeenCalled();
    });

    it('should check all tags for database duplicates', async () => {
      // Arrange
      const mockEndpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const mockConnection = ScadaConnection.create({
        tenantId,
        wellId: 'well-123',
        name: 'RTU-001',
        endpoint: mockEndpoint,
        createdBy: userId,
      });

      const tagConfigs: TagConfigInput[] = [
        {
          nodeId: 'ns=2;s=Node1',
          tagName: 'tag1',
          fieldEntryProperty: 'casingPressure',
          dataType: 'Float',
        },
        {
          nodeId: 'ns=2;s=Node2',
          tagName: 'tag2',
          fieldEntryProperty: 'tubingPressure',
          dataType: 'Float',
        },
      ];

      const command = new CreateTagMappingsCommand(
        tenantId,
        scadaConnectionId,
        tagConfigs,
        userId,
      );

      mockScadaConnectionRepo.findById.mockResolvedValue(mockConnection);
      mockTagMappingRepo.existsByNodeId.mockResolvedValue(false);
      mockTagMappingRepo.existsByFieldProperty.mockResolvedValue(false);
      mockTagMappingRepo.saveMany.mockResolvedValue(undefined);

      // Act
      await handler.execute(command);

      // Assert - should check each tag
      expect(mockTagMappingRepo.existsByNodeId).toHaveBeenCalledTimes(2);
      expect(mockTagMappingRepo.existsByFieldProperty).toHaveBeenCalledTimes(2);
    });
  });

  describe('Tag Configuration Validation', () => {
    it('should throw BadRequestException for invalid node ID format', async () => {
      // Arrange
      const mockEndpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const mockConnection = ScadaConnection.create({
        tenantId,
        wellId: 'well-123',
        name: 'RTU-001',
        endpoint: mockEndpoint,
        createdBy: userId,
      });

      const invalidTagConfig: TagConfigInput = {
        nodeId: 'InvalidNodeId', // Missing namespace
        tagName: 'pressure',
        fieldEntryProperty: 'casingPressure',
        dataType: 'Float',
      };

      const command = new CreateTagMappingsCommand(
        tenantId,
        scadaConnectionId,
        [invalidTagConfig],
        userId,
      );

      mockScadaConnectionRepo.findById.mockResolvedValue(mockConnection);
      mockTagMappingRepo.existsByNodeId.mockResolvedValue(false);
      mockTagMappingRepo.existsByFieldProperty.mockResolvedValue(false);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        BadRequestException,
      );
      await expect(handler.execute(command)).rejects.toThrow(
        /Invalid tag configuration/,
      );
      await expect(handler.execute(command)).rejects.toThrow(
        /must include namespace/,
      );

      // Verify no tag mappings were created
      expect(mockTagMappingRepo.saveMany).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid tag name format', async () => {
      // Arrange
      const mockEndpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const mockConnection = ScadaConnection.create({
        tenantId,
        wellId: 'well-123',
        name: 'RTU-001',
        endpoint: mockEndpoint,
        createdBy: userId,
      });

      const invalidTagConfig: TagConfigInput = {
        nodeId: 'ns=2;s=Pressure',
        tagName: '123invalidName', // Starts with number
        fieldEntryProperty: 'casingPressure',
        dataType: 'Float',
      };

      const command = new CreateTagMappingsCommand(
        tenantId,
        scadaConnectionId,
        [invalidTagConfig],
        userId,
      );

      mockScadaConnectionRepo.findById.mockResolvedValue(mockConnection);
      mockTagMappingRepo.existsByNodeId.mockResolvedValue(false);
      mockTagMappingRepo.existsByFieldProperty.mockResolvedValue(false);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        BadRequestException,
      );
      await expect(handler.execute(command)).rejects.toThrow(
        /must start with a letter/,
      );

      // Verify no tag mappings were created
      expect(mockTagMappingRepo.saveMany).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid field entry property', async () => {
      // Arrange
      const mockEndpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const mockConnection = ScadaConnection.create({
        tenantId,
        wellId: 'well-123',
        name: 'RTU-001',
        endpoint: mockEndpoint,
        createdBy: userId,
      });

      const invalidTagConfig: TagConfigInput = {
        nodeId: 'ns=2;s=Pressure',
        tagName: 'pressure',
        fieldEntryProperty: 'invalidProperty', // Not in allowed list
        dataType: 'Float',
      };

      const command = new CreateTagMappingsCommand(
        tenantId,
        scadaConnectionId,
        [invalidTagConfig],
        userId,
      );

      mockScadaConnectionRepo.findById.mockResolvedValue(mockConnection);
      mockTagMappingRepo.existsByNodeId.mockResolvedValue(false);
      mockTagMappingRepo.existsByFieldProperty.mockResolvedValue(false);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        BadRequestException,
      );
      await expect(handler.execute(command)).rejects.toThrow(
        /Field entry property must be one of/,
      );

      // Verify no tag mappings were created
      expect(mockTagMappingRepo.saveMany).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for negative scaling factor', async () => {
      // Arrange
      const mockEndpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const mockConnection = ScadaConnection.create({
        tenantId,
        wellId: 'well-123',
        name: 'RTU-001',
        endpoint: mockEndpoint,
        createdBy: userId,
      });

      const invalidTagConfig: TagConfigInput = {
        nodeId: 'ns=2;s=Pressure',
        tagName: 'pressure',
        fieldEntryProperty: 'casingPressure',
        dataType: 'Float',
        scalingFactor: -1.0, // Invalid: negative
      };

      const command = new CreateTagMappingsCommand(
        tenantId,
        scadaConnectionId,
        [invalidTagConfig],
        userId,
      );

      mockScadaConnectionRepo.findById.mockResolvedValue(mockConnection);
      mockTagMappingRepo.existsByNodeId.mockResolvedValue(false);
      mockTagMappingRepo.existsByFieldProperty.mockResolvedValue(false);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        BadRequestException,
      );
      await expect(handler.execute(command)).rejects.toThrow(
        /Scaling factor must be positive/,
      );

      // Verify no tag mappings were created
      expect(mockTagMappingRepo.saveMany).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for negative deadband', async () => {
      // Arrange
      const mockEndpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const mockConnection = ScadaConnection.create({
        tenantId,
        wellId: 'well-123',
        name: 'RTU-001',
        endpoint: mockEndpoint,
        createdBy: userId,
      });

      const invalidTagConfig: TagConfigInput = {
        nodeId: 'ns=2;s=Pressure',
        tagName: 'pressure',
        fieldEntryProperty: 'casingPressure',
        dataType: 'Float',
        deadband: -0.5, // Invalid: negative
      };

      const command = new CreateTagMappingsCommand(
        tenantId,
        scadaConnectionId,
        [invalidTagConfig],
        userId,
      );

      mockScadaConnectionRepo.findById.mockResolvedValue(mockConnection);
      mockTagMappingRepo.existsByNodeId.mockResolvedValue(false);
      mockTagMappingRepo.existsByFieldProperty.mockResolvedValue(false);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        BadRequestException,
      );
      await expect(handler.execute(command)).rejects.toThrow(
        /Deadband must be non-negative/,
      );

      // Verify no tag mappings were created
      expect(mockTagMappingRepo.saveMany).not.toHaveBeenCalled();
    });
  });

  describe('DTO Mapping', () => {
    it('should correctly map all tag mapping properties to DTO', async () => {
      // Arrange
      const mockEndpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const mockConnection = ScadaConnection.create({
        tenantId,
        wellId: 'well-123',
        name: 'RTU-001',
        endpoint: mockEndpoint,
        createdBy: userId,
      });

      const fullTagConfig: TagConfigInput = {
        nodeId: 'ns=2;s=Pressure',
        tagName: 'casingPressure',
        fieldEntryProperty: 'casingPressure',
        dataType: 'Float',
        unit: 'psi',
        scalingFactor: 2.5,
        deadband: 0.75,
      };

      const command = new CreateTagMappingsCommand(
        tenantId,
        scadaConnectionId,
        [fullTagConfig],
        userId,
      );

      mockScadaConnectionRepo.findById.mockResolvedValue(mockConnection);
      mockTagMappingRepo.existsByNodeId.mockResolvedValue(false);
      mockTagMappingRepo.existsByFieldProperty.mockResolvedValue(false);
      mockTagMappingRepo.saveMany.mockResolvedValue(undefined);

      // Act
      const result = await handler.execute(command);

      // Assert
      const dto = result.tagMappings[0];
      expect(dto.id).toBeDefined();
      expect(dto.id).toMatch(/^tag_/);
      expect(dto.tenantId).toBe(tenantId);
      expect(dto.scadaConnectionId).toBe(scadaConnectionId);
      expect(dto.nodeId).toBe('ns=2;s=Pressure');
      expect(dto.tagName).toBe('casingPressure');
      expect(dto.fieldEntryProperty).toBe('casingPressure');
      expect(dto.dataType).toBe('Float');
      expect(dto.unit).toBe('psi');
      expect(dto.scalingFactor).toBe(2.5);
      expect(dto.deadband).toBe(0.75);
      expect(dto.isEnabled).toBe(true);
      expect(dto.lastValue).toBeUndefined();
      expect(dto.lastReadAt).toBeUndefined();
      expect(dto.createdAt).toBeDefined();
      expect(dto.updatedAt).toBeDefined();
    });

    it('should format timestamps as ISO strings in DTO', async () => {
      // Arrange
      const mockEndpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const mockConnection = ScadaConnection.create({
        tenantId,
        wellId: 'well-123',
        name: 'RTU-001',
        endpoint: mockEndpoint,
        createdBy: userId,
      });

      const command = new CreateTagMappingsCommand(
        tenantId,
        scadaConnectionId,
        [validTagConfig],
        userId,
      );

      mockScadaConnectionRepo.findById.mockResolvedValue(mockConnection);
      mockTagMappingRepo.existsByNodeId.mockResolvedValue(false);
      mockTagMappingRepo.existsByFieldProperty.mockResolvedValue(false);
      mockTagMappingRepo.saveMany.mockResolvedValue(undefined);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.tagMappings[0].createdAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
      expect(result.tagMappings[0].updatedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });

  describe('Error Handling', () => {
    it('should propagate repository errors from connection lookup', async () => {
      // Arrange
      const command = new CreateTagMappingsCommand(
        tenantId,
        scadaConnectionId,
        [validTagConfig],
        userId,
      );

      mockScadaConnectionRepo.findById.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should propagate repository errors from saveMany', async () => {
      // Arrange
      const mockEndpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const mockConnection = ScadaConnection.create({
        tenantId,
        wellId: 'well-123',
        name: 'RTU-001',
        endpoint: mockEndpoint,
        createdBy: userId,
      });

      const command = new CreateTagMappingsCommand(
        tenantId,
        scadaConnectionId,
        [validTagConfig],
        userId,
      );

      mockScadaConnectionRepo.findById.mockResolvedValue(mockConnection);
      mockTagMappingRepo.existsByNodeId.mockResolvedValue(false);
      mockTagMappingRepo.existsByFieldProperty.mockResolvedValue(false);
      mockTagMappingRepo.saveMany.mockRejectedValue(
        new Error('Bulk insert failed'),
      );

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        'Bulk insert failed',
      );
    });
  });
});
