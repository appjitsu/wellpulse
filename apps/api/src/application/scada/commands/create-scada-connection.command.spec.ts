/**
 * CreateScadaConnectionHandler Tests
 *
 * Tests SCADA connection creation command handler with comprehensive coverage of:
 * - Successful connection creation with various OPC-UA configurations
 * - Well existence validation
 * - Duplicate connection prevention (by well ID and connection name)
 * - OPC-UA endpoint validation (security modes, policies, credentials)
 * - Poll interval validation (1-300 seconds range)
 * - Error handling for invalid configurations
 * - DTO mapping accuracy
 */

import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  CreateScadaConnectionHandler,
  CreateScadaConnectionCommand,
} from './create-scada-connection.command';
import { IScadaConnectionRepository } from '../../../domain/repositories/scada-connection.repository.interface';
import { IWellRepository } from '../../../domain/repositories/well.repository.interface';
import { Well } from '../../../domain/wells/well.entity';
import { ScadaConnection } from '../../../domain/scada/scada-connection.entity';
import { OpcUaEndpoint } from '../../../domain/scada/value-objects/opc-ua-endpoint.vo';

/* eslint-disable @typescript-eslint/unbound-method */

describe('CreateScadaConnectionHandler', () => {
  let handler: CreateScadaConnectionHandler;
  let mockScadaConnectionRepo: jest.Mocked<IScadaConnectionRepository>;
  let mockWellRepo: jest.Mocked<IWellRepository>;

  const tenantId = 'tenant-123';
  const wellId = 'well-456';
  const userId = 'user-789';
  const opcUaUrl = 'opc.tcp://192.168.1.100:4840';

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

    // Create mock well repository
    mockWellRepo = {
      findById: jest.fn(),
      findByApiNumber: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      existsByApiNumber: jest.fn(),
    } as jest.Mocked<IWellRepository>;

    // Initialize handler with mocks
    handler = new CreateScadaConnectionHandler(
      mockScadaConnectionRepo,
      mockWellRepo,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful Creation', () => {
    it('should create SCADA connection with minimal configuration', async () => {
      // Arrange
      const mockWell = Well.create({
        name: 'Test Well #1',
        apiNumber: '42-123-45678',
        status: 'ACTIVE',
        latitude: 31.8457,
        longitude: -102.3676,
        createdBy: userId,
      });

      const command = new CreateScadaConnectionCommand(
        tenantId,
        wellId,
        'RTU-001',
        undefined, // No description
        opcUaUrl,
        'None',
        'None',
        undefined, // No username
        undefined, // No password
        undefined, // Default poll interval
        userId,
      );

      mockWellRepo.findById.mockResolvedValue(mockWell);
      mockScadaConnectionRepo.findByWellId.mockResolvedValue(null);
      mockScadaConnectionRepo.existsByName.mockResolvedValue(false);
      mockScadaConnectionRepo.save.mockResolvedValue(undefined);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe('RTU-001');
      expect(result.wellId).toBe(wellId);
      expect(result.tenantId).toBe(tenantId);
      expect(result.opcUaUrl).toBe(opcUaUrl);
      expect(result.securityMode).toBe('None');
      expect(result.securityPolicy).toBe('None');
      expect(result.hasCredentials).toBe(false);
      expect(result.pollIntervalSeconds).toBe(5); // Default value
      expect(result.status).toBe('inactive');
      expect(result.isEnabled).toBe(true);
      expect(result.createdBy).toBe(userId);
      expect(result.updatedBy).toBe(userId);

      expect(mockScadaConnectionRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should create SCADA connection with full configuration including credentials', async () => {
      // Arrange
      const mockWell = Well.create({
        name: 'Test Well #1',
        apiNumber: '42-123-45678',
        status: 'ACTIVE',
        latitude: 31.8457,
        longitude: -102.3676,
        createdBy: userId,
      });

      const command = new CreateScadaConnectionCommand(
        tenantId,
        wellId,
        'RTU-002',
        'Production well RTU connection',
        opcUaUrl,
        'SignAndEncrypt',
        'Basic256Sha256',
        'opcuser',
        'opcpassword',
        10,
        userId,
      );

      mockWellRepo.findById.mockResolvedValue(mockWell);
      mockScadaConnectionRepo.findByWellId.mockResolvedValue(null);
      mockScadaConnectionRepo.existsByName.mockResolvedValue(false);
      mockScadaConnectionRepo.save.mockResolvedValue(undefined);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe('RTU-002');
      expect(result.description).toBe('Production well RTU connection');
      expect(result.securityMode).toBe('SignAndEncrypt');
      expect(result.securityPolicy).toBe('Basic256Sha256');
      expect(result.hasCredentials).toBe(true);
      expect(result.pollIntervalSeconds).toBe(10);

      expect(mockScadaConnectionRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should create connection with Sign security mode', async () => {
      // Arrange
      const mockWell = Well.create({
        name: 'Test Well #1',
        apiNumber: '42-123-45678',
        status: 'ACTIVE',
        latitude: 31.8457,
        longitude: -102.3676,
        createdBy: userId,
      });

      const command = new CreateScadaConnectionCommand(
        tenantId,
        wellId,
        'RTU-003',
        undefined,
        opcUaUrl,
        'Sign',
        'Basic256',
        undefined,
        undefined,
        undefined,
        userId,
      );

      mockWellRepo.findById.mockResolvedValue(mockWell);
      mockScadaConnectionRepo.findByWellId.mockResolvedValue(null);
      mockScadaConnectionRepo.existsByName.mockResolvedValue(false);
      mockScadaConnectionRepo.save.mockResolvedValue(undefined);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.securityMode).toBe('Sign');
      expect(result.securityPolicy).toBe('Basic256');
    });

    it('should create connection with custom poll interval (minimum)', async () => {
      // Arrange
      const mockWell = Well.create({
        name: 'Test Well #1',
        apiNumber: '42-123-45678',
        status: 'ACTIVE',
        latitude: 31.8457,
        longitude: -102.3676,
        createdBy: userId,
      });

      const command = new CreateScadaConnectionCommand(
        tenantId,
        wellId,
        'RTU-004',
        undefined,
        opcUaUrl,
        'None',
        'None',
        undefined,
        undefined,
        1, // Minimum poll interval
        userId,
      );

      mockWellRepo.findById.mockResolvedValue(mockWell);
      mockScadaConnectionRepo.findByWellId.mockResolvedValue(null);
      mockScadaConnectionRepo.existsByName.mockResolvedValue(false);
      mockScadaConnectionRepo.save.mockResolvedValue(undefined);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.pollIntervalSeconds).toBe(1);
    });

    it('should create connection with custom poll interval (maximum)', async () => {
      // Arrange
      const mockWell = Well.create({
        name: 'Test Well #1',
        apiNumber: '42-123-45678',
        status: 'ACTIVE',
        latitude: 31.8457,
        longitude: -102.3676,
        createdBy: userId,
      });

      const command = new CreateScadaConnectionCommand(
        tenantId,
        wellId,
        'RTU-005',
        undefined,
        opcUaUrl,
        'None',
        'None',
        undefined,
        undefined,
        300, // Maximum poll interval
        userId,
      );

      mockWellRepo.findById.mockResolvedValue(mockWell);
      mockScadaConnectionRepo.findByWellId.mockResolvedValue(null);
      mockScadaConnectionRepo.existsByName.mockResolvedValue(false);
      mockScadaConnectionRepo.save.mockResolvedValue(undefined);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.pollIntervalSeconds).toBe(300);
    });

    it('should verify well lookup uses correct tenant ID', async () => {
      // Arrange
      const mockWell = Well.create({
        name: 'Test Well #1',
        apiNumber: '42-123-45678',
        status: 'ACTIVE',
        latitude: 31.8457,
        longitude: -102.3676,
        createdBy: userId,
      });

      const command = new CreateScadaConnectionCommand(
        tenantId,
        wellId,
        'RTU-006',
        undefined,
        opcUaUrl,
        'None',
        'None',
        undefined,
        undefined,
        undefined,
        userId,
      );

      mockWellRepo.findById.mockResolvedValue(mockWell);
      mockScadaConnectionRepo.findByWellId.mockResolvedValue(null);
      mockScadaConnectionRepo.existsByName.mockResolvedValue(false);
      mockScadaConnectionRepo.save.mockResolvedValue(undefined);

      // Act
      await handler.execute(command);

      // Assert

      expect(mockWellRepo.findById).toHaveBeenCalledWith(tenantId, wellId);
    });
  });

  describe('Well Validation', () => {
    it('should throw NotFoundException when well does not exist', async () => {
      // Arrange
      const command = new CreateScadaConnectionCommand(
        tenantId,
        wellId,
        'RTU-007',
        undefined,
        opcUaUrl,
        'None',
        'None',
        undefined,
        undefined,
        undefined,
        userId,
      );

      mockWellRepo.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
      await expect(handler.execute(command)).rejects.toThrow(
        `Well with ID ${wellId} not found`,
      );

      // Verify no connection was created

      expect(mockScadaConnectionRepo.save).not.toHaveBeenCalled();
    });

    it('should validate well before checking for existing connection', async () => {
      // Arrange
      const command = new CreateScadaConnectionCommand(
        tenantId,
        wellId,
        'RTU-008',
        undefined,
        opcUaUrl,
        'None',
        'None',
        undefined,
        undefined,
        undefined,
        userId,
      );

      mockWellRepo.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(NotFoundException);

      // Verify subsequent checks were not performed

      expect(mockScadaConnectionRepo.findByWellId).not.toHaveBeenCalled();

      expect(mockScadaConnectionRepo.existsByName).not.toHaveBeenCalled();
    });
  });

  describe('Duplicate Connection Prevention', () => {
    it('should throw ConflictException when well already has a SCADA connection', async () => {
      // Arrange
      const mockWell = Well.create({
        name: 'Test Well #1',
        apiNumber: '42-123-45678',
        status: 'ACTIVE',
        latitude: 31.8457,
        longitude: -102.3676,
        createdBy: userId,
      });

      const existingEndpoint = OpcUaEndpoint.create({
        url: opcUaUrl,
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const existingConnection = ScadaConnection.create({
        tenantId,
        wellId,
        name: 'Existing RTU',
        endpoint: existingEndpoint,
        createdBy: userId,
      });

      const command = new CreateScadaConnectionCommand(
        tenantId,
        wellId,
        'RTU-009',
        undefined,
        opcUaUrl,
        'None',
        'None',
        undefined,
        undefined,
        undefined,
        userId,
      );

      mockWellRepo.findById.mockResolvedValue(mockWell);
      mockScadaConnectionRepo.findByWellId.mockResolvedValue(
        existingConnection as unknown as ScadaConnection | null,
      );

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(ConflictException);
      await expect(handler.execute(command)).rejects.toThrow(
        `Well ${wellId} already has a SCADA connection`,
      );

      // Verify no connection was created

      expect(mockScadaConnectionRepo.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when connection name already exists', async () => {
      // Arrange
      const mockWell = Well.create({
        name: 'Test Well #1',
        apiNumber: '42-123-45678',
        status: 'ACTIVE',
        latitude: 31.8457,
        longitude: -102.3676,
        createdBy: userId,
      });

      const connectionName = 'RTU-010';

      const command = new CreateScadaConnectionCommand(
        tenantId,
        wellId,
        connectionName,
        undefined,
        opcUaUrl,
        'None',
        'None',
        undefined,
        undefined,
        undefined,
        userId,
      );

      mockWellRepo.findById.mockResolvedValue(mockWell);
      mockScadaConnectionRepo.findByWellId.mockResolvedValue(null);
      mockScadaConnectionRepo.existsByName.mockResolvedValue(true);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(ConflictException);
      await expect(handler.execute(command)).rejects.toThrow(
        `SCADA connection with name "${connectionName}" already exists`,
      );

      // Verify no connection was created

      expect(mockScadaConnectionRepo.save).not.toHaveBeenCalled();
    });

    it('should check name uniqueness with correct tenant ID', async () => {
      // Arrange
      const mockWell = Well.create({
        name: 'Test Well #1',
        apiNumber: '42-123-45678',
        status: 'ACTIVE',
        latitude: 31.8457,
        longitude: -102.3676,
        createdBy: userId,
      });

      const connectionName = 'RTU-011';

      const command = new CreateScadaConnectionCommand(
        tenantId,
        wellId,
        connectionName,
        undefined,
        opcUaUrl,
        'None',
        'None',
        undefined,
        undefined,
        undefined,
        userId,
      );

      mockWellRepo.findById.mockResolvedValue(mockWell);
      mockScadaConnectionRepo.findByWellId.mockResolvedValue(null);
      mockScadaConnectionRepo.existsByName.mockResolvedValue(true);

      // Act
      try {
        await handler.execute(command);
      } catch {
        // Expected error
      }

      // Assert

      expect(mockScadaConnectionRepo.existsByName).toHaveBeenCalledWith(
        tenantId,
        connectionName,
      );
    });
  });

  describe('OPC-UA Endpoint Validation', () => {
    it('should throw BadRequestException when OPC-UA URL is invalid', async () => {
      // Arrange
      const mockWell = Well.create({
        name: 'Test Well #1',
        apiNumber: '42-123-45678',
        status: 'ACTIVE',
        latitude: 31.8457,
        longitude: -102.3676,
        createdBy: userId,
      });

      const command = new CreateScadaConnectionCommand(
        tenantId,
        wellId,
        'RTU-012',
        undefined,
        'http://invalid-url.com', // Invalid OPC-UA URL
        'None',
        'None',
        undefined,
        undefined,
        undefined,
        userId,
      );

      mockWellRepo.findById.mockResolvedValue(mockWell);
      mockScadaConnectionRepo.findByWellId.mockResolvedValue(null);
      mockScadaConnectionRepo.existsByName.mockResolvedValue(false);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        BadRequestException,
      );
      await expect(handler.execute(command)).rejects.toThrow(
        /Invalid OPC-UA endpoint configuration/,
      );
      await expect(handler.execute(command)).rejects.toThrow(
        /must start with opc\.tcp/,
      );

      // Verify no connection was created

      expect(mockScadaConnectionRepo.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when security mode and policy mismatch (None mode with policy)', async () => {
      // Arrange
      const mockWell = Well.create({
        name: 'Test Well #1',
        apiNumber: '42-123-45678',
        status: 'ACTIVE',
        latitude: 31.8457,
        longitude: -102.3676,
        createdBy: userId,
      });

      const command = new CreateScadaConnectionCommand(
        tenantId,
        wellId,
        'RTU-013',
        undefined,
        opcUaUrl,
        'None', // None security mode
        'Basic256Sha256', // But has security policy (invalid)
        undefined,
        undefined,
        undefined,
        userId,
      );

      mockWellRepo.findById.mockResolvedValue(mockWell);
      mockScadaConnectionRepo.findByWellId.mockResolvedValue(null);
      mockScadaConnectionRepo.existsByName.mockResolvedValue(false);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        BadRequestException,
      );
      await expect(handler.execute(command)).rejects.toThrow(
        /Security policy must be None when security mode is None/,
      );

      // Verify no connection was created

      expect(mockScadaConnectionRepo.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when security mode and policy mismatch (Sign mode with None policy)', async () => {
      // Arrange
      const mockWell = Well.create({
        name: 'Test Well #1',
        apiNumber: '42-123-45678',
        status: 'ACTIVE',
        latitude: 31.8457,
        longitude: -102.3676,
        createdBy: userId,
      });

      const command = new CreateScadaConnectionCommand(
        tenantId,
        wellId,
        'RTU-014',
        undefined,
        opcUaUrl,
        'Sign', // Sign security mode
        'None', // But no security policy (invalid)
        undefined,
        undefined,
        undefined,
        userId,
      );

      mockWellRepo.findById.mockResolvedValue(mockWell);
      mockScadaConnectionRepo.findByWellId.mockResolvedValue(null);
      mockScadaConnectionRepo.existsByName.mockResolvedValue(false);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        BadRequestException,
      );
      await expect(handler.execute(command)).rejects.toThrow(
        /Security policy cannot be None when security mode is not None/,
      );

      // Verify no connection was created

      expect(mockScadaConnectionRepo.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when username provided without password', async () => {
      // Arrange
      const mockWell = Well.create({
        name: 'Test Well #1',
        apiNumber: '42-123-45678',
        status: 'ACTIVE',
        latitude: 31.8457,
        longitude: -102.3676,
        createdBy: userId,
      });

      const command = new CreateScadaConnectionCommand(
        tenantId,
        wellId,
        'RTU-015',
        undefined,
        opcUaUrl,
        'None',
        'None',
        'opcuser', // Username provided
        undefined, // No password (invalid)
        undefined,
        userId,
      );

      mockWellRepo.findById.mockResolvedValue(mockWell);
      mockScadaConnectionRepo.findByWellId.mockResolvedValue(null);
      mockScadaConnectionRepo.existsByName.mockResolvedValue(false);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        BadRequestException,
      );
      await expect(handler.execute(command)).rejects.toThrow(
        /Password is required when username is provided/,
      );

      // Verify no connection was created

      expect(mockScadaConnectionRepo.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when password provided without username', async () => {
      // Arrange
      const mockWell = Well.create({
        name: 'Test Well #1',
        apiNumber: '42-123-45678',
        status: 'ACTIVE',
        latitude: 31.8457,
        longitude: -102.3676,
        createdBy: userId,
      });

      const command = new CreateScadaConnectionCommand(
        tenantId,
        wellId,
        'RTU-016',
        undefined,
        opcUaUrl,
        'None',
        'None',
        undefined, // No username (invalid)
        'opcpassword', // Password provided
        undefined,
        userId,
      );

      mockWellRepo.findById.mockResolvedValue(mockWell);
      mockScadaConnectionRepo.findByWellId.mockResolvedValue(null);
      mockScadaConnectionRepo.existsByName.mockResolvedValue(false);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        BadRequestException,
      );
      await expect(handler.execute(command)).rejects.toThrow(
        /Username is required when password is provided/,
      );

      // Verify no connection was created

      expect(mockScadaConnectionRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('Poll Interval Validation', () => {
    it('should throw BadRequestException when poll interval is less than 1 second', async () => {
      // Arrange
      const mockWell = Well.create({
        name: 'Test Well #1',
        apiNumber: '42-123-45678',
        status: 'ACTIVE',
        latitude: 31.8457,
        longitude: -102.3676,
        createdBy: userId,
      });

      const command = new CreateScadaConnectionCommand(
        tenantId,
        wellId,
        'RTU-017',
        undefined,
        opcUaUrl,
        'None',
        'None',
        undefined,
        undefined,
        0, // Invalid: less than 1
        userId,
      );

      mockWellRepo.findById.mockResolvedValue(mockWell);
      mockScadaConnectionRepo.findByWellId.mockResolvedValue(null);
      mockScadaConnectionRepo.existsByName.mockResolvedValue(false);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        BadRequestException,
      );
      await expect(handler.execute(command)).rejects.toThrow(
        /Poll interval must be between 1 and 300 seconds/,
      );

      // Verify no connection was created

      expect(mockScadaConnectionRepo.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when poll interval is greater than 300 seconds', async () => {
      // Arrange
      const mockWell = Well.create({
        name: 'Test Well #1',
        apiNumber: '42-123-45678',
        status: 'ACTIVE',
        latitude: 31.8457,
        longitude: -102.3676,
        createdBy: userId,
      });

      const command = new CreateScadaConnectionCommand(
        tenantId,
        wellId,
        'RTU-018',
        undefined,
        opcUaUrl,
        'None',
        'None',
        undefined,
        undefined,
        301, // Invalid: greater than 300
        userId,
      );

      mockWellRepo.findById.mockResolvedValue(mockWell);
      mockScadaConnectionRepo.findByWellId.mockResolvedValue(null);
      mockScadaConnectionRepo.existsByName.mockResolvedValue(false);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        BadRequestException,
      );
      await expect(handler.execute(command)).rejects.toThrow(
        /Poll interval must be between 1 and 300 seconds/,
      );

      // Verify no connection was created

      expect(mockScadaConnectionRepo.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when poll interval is negative', async () => {
      // Arrange
      const mockWell = Well.create({
        name: 'Test Well #1',
        apiNumber: '42-123-45678',
        status: 'ACTIVE',
        latitude: 31.8457,
        longitude: -102.3676,
        createdBy: userId,
      });

      const command = new CreateScadaConnectionCommand(
        tenantId,
        wellId,
        'RTU-019',
        undefined,
        opcUaUrl,
        'None',
        'None',
        undefined,
        undefined,
        -5, // Invalid: negative
        userId,
      );

      mockWellRepo.findById.mockResolvedValue(mockWell);
      mockScadaConnectionRepo.findByWellId.mockResolvedValue(null);
      mockScadaConnectionRepo.existsByName.mockResolvedValue(false);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        BadRequestException,
      );
      await expect(handler.execute(command)).rejects.toThrow(
        /Poll interval must be between 1 and 300 seconds/,
      );

      // Verify no connection was created

      expect(mockScadaConnectionRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('DTO Mapping', () => {
    it('should correctly map all connection properties to DTO', async () => {
      // Arrange
      const mockWell = Well.create({
        name: 'Test Well #1',
        apiNumber: '42-123-45678',
        status: 'ACTIVE',
        latitude: 31.8457,
        longitude: -102.3676,
        createdBy: userId,
      });

      const command = new CreateScadaConnectionCommand(
        tenantId,
        wellId,
        'RTU-020',
        'Full configuration test',
        opcUaUrl,
        'SignAndEncrypt',
        'Aes256_Sha256_RsaPss',
        'testuser',
        'testpassword',
        30,
        userId,
      );

      mockWellRepo.findById.mockResolvedValue(mockWell);
      mockScadaConnectionRepo.findByWellId.mockResolvedValue(null);
      mockScadaConnectionRepo.existsByName.mockResolvedValue(false);
      mockScadaConnectionRepo.save.mockResolvedValue(undefined);

      // Act
      const result = await handler.execute(command);

      // Assert - verify all DTO properties
      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^scada_/);
      expect(result.tenantId).toBe(tenantId);
      expect(result.wellId).toBe(wellId);
      expect(result.name).toBe('RTU-020');
      expect(result.description).toBe('Full configuration test');
      expect(result.opcUaUrl).toBe(opcUaUrl);
      expect(result.securityMode).toBe('SignAndEncrypt');
      expect(result.securityPolicy).toBe('Aes256_Sha256_RsaPss');
      expect(result.hasCredentials).toBe(true);
      expect(result.pollIntervalSeconds).toBe(30);
      expect(result.status).toBe('inactive');
      expect(result.lastConnectedAt).toBeUndefined();
      expect(result.lastErrorMessage).toBeUndefined();
      expect(result.isEnabled).toBe(true);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(result.createdBy).toBe(userId);
      expect(result.updatedBy).toBe(userId);
    });

    it('should format timestamps as ISO strings in DTO', async () => {
      // Arrange
      const mockWell = Well.create({
        name: 'Test Well #1',
        apiNumber: '42-123-45678',
        status: 'ACTIVE',
        latitude: 31.8457,
        longitude: -102.3676,
        createdBy: userId,
      });

      const command = new CreateScadaConnectionCommand(
        tenantId,
        wellId,
        'RTU-021',
        undefined,
        opcUaUrl,
        'None',
        'None',
        undefined,
        undefined,
        undefined,
        userId,
      );

      mockWellRepo.findById.mockResolvedValue(mockWell);
      mockScadaConnectionRepo.findByWellId.mockResolvedValue(null);
      mockScadaConnectionRepo.existsByName.mockResolvedValue(false);
      mockScadaConnectionRepo.save.mockResolvedValue(undefined);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.createdAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
      expect(result.updatedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });

  describe('Error Handling', () => {
    it('should propagate repository errors from well lookup', async () => {
      // Arrange
      const command = new CreateScadaConnectionCommand(
        tenantId,
        wellId,
        'RTU-022',
        undefined,
        opcUaUrl,
        'None',
        'None',
        undefined,
        undefined,
        undefined,
        userId,
      );

      mockWellRepo.findById.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should propagate repository errors from save', async () => {
      // Arrange
      const mockWell = Well.create({
        name: 'Test Well #1',
        apiNumber: '42-123-45678',
        status: 'ACTIVE',
        latitude: 31.8457,
        longitude: -102.3676,
        createdBy: userId,
      });

      const command = new CreateScadaConnectionCommand(
        tenantId,
        wellId,
        'RTU-023',
        undefined,
        opcUaUrl,
        'None',
        'None',
        undefined,
        undefined,
        undefined,
        userId,
      );

      mockWellRepo.findById.mockResolvedValue(mockWell);
      mockScadaConnectionRepo.findByWellId.mockResolvedValue(null);
      mockScadaConnectionRepo.existsByName.mockResolvedValue(false);
      mockScadaConnectionRepo.save.mockRejectedValue(
        new Error('Insert failed'),
      );

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow('Insert failed');
    });
  });
});
