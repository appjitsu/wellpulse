/**
 * SCADA Readings Controller Tests
 *
 * Unit tests for SCADA readings REST API endpoints.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { ScadaReadingsController } from './scada-readings.controller';
import {
  RecordScadaReadingCommand,
  GetScadaReadingsQuery,
} from '../../application/scada';
import type { ReadingQuality } from '../../domain/scada/scada-reading.entity';
import { RecordScadaReadingDto } from './dto';

describe('ScadaReadingsController', () => {
  let controller: ScadaReadingsController;
  let commandBus: jest.Mocked<CommandBus>;
  let queryBus: jest.Mocked<QueryBus>;

  const mockCommandBus = {
    execute: jest.fn(),
  };

  const mockQueryBus = {
    execute: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScadaReadingsController],
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

    controller = module.get<ScadaReadingsController>(ScadaReadingsController);
    commandBus = module.get(CommandBus);
    queryBus = module.get(QueryBus);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('recordReading', () => {
    const tenantId = 'tenant-123';
    const dto: RecordScadaReadingDto = {
      wellId: 'well-123',
      scadaConnectionId: 'connection-123',
      tagName: 'WELLHEAD_PRESSURE',
      value: 150.5,
      quality: 'GOOD' as ReadingQuality,
      timestamp: new Date('2025-10-30T10:30:00Z'),
      unit: 'PSI',
      minValue: 0,
      maxValue: 500,
      metadata: { source: 'RTU' },
    };

    it('should record a SCADA reading successfully', async () => {
      // Arrange
      const readingId = 'reading-123';
      commandBus.execute.mockResolvedValue(readingId);

      // Act
      const result = await controller.recordReading(tenantId, dto);

      // Assert
      expect(result).toEqual({ readingId });
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          wellId: dto.wellId,
          scadaConnectionId: dto.scadaConnectionId,
          tagName: dto.tagName,
          value: dto.value,
          quality: dto.quality,
          timestamp: dto.timestamp,
          unit: dto.unit,
          minValue: dto.minValue,
          maxValue: dto.maxValue,
          metadata: dto.metadata,
        }),
      );
      expect(commandBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when tenant context is missing', async () => {
      // Act & Assert
      await expect(controller.recordReading('', dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.recordReading('', dto)).rejects.toThrow(
        'Tenant context is required',
      );
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('should handle command execution errors', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      commandBus.execute.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.recordReading(tenantId, dto)).rejects.toThrow(
        error,
      );
      expect(commandBus.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('getReadings', () => {
    const tenantId = 'tenant-123';

    it('should retrieve SCADA readings with all filters', async () => {
      // Arrange
      const queryDto = {
        wellId: 'well-123',
        connectionId: 'connection-123',
        tagName: 'WELLHEAD_PRESSURE',
        startTime: '2025-10-01T00:00:00Z',
        endTime: '2025-10-30T23:59:59Z',
        limit: '100',
        offset: '0',
      };

      const mockReadings = [
        {
          id: 'reading-1',
          tenantId,
          wellId: 'well-123',
          scadaConnectionId: 'connection-123',
          tagName: 'WELLHEAD_PRESSURE',
          value: 150.5,
          quality: 'GOOD' as ReadingQuality,
          timestamp: '2025-10-30T10:30:00Z',
        },
      ];

      queryBus.execute.mockResolvedValue(mockReadings);

      // Act
      const result = await controller.getReadings(tenantId, queryDto);

      // Assert
      expect(result).toEqual(mockReadings);
      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          wellId: queryDto.wellId,
          scadaConnectionId: queryDto.connectionId,
          tagName: queryDto.tagName,
          startTime: new Date(queryDto.startTime),
          endTime: new Date(queryDto.endTime),
          limit: 100,
          offset: 0,
        }),
      );
      expect(queryBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should retrieve SCADA readings with default pagination', async () => {
      // Arrange
      const queryDto = {};
      const mockReadings: any[] = [];
      queryBus.execute.mockResolvedValue(mockReadings);

      // Act
      const result = await controller.getReadings(tenantId, queryDto);

      // Assert
      expect(result).toEqual(mockReadings);
      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          wellId: undefined,
          scadaConnectionId: undefined,
          tagName: undefined,
          startTime: undefined,
          endTime: undefined,
          limit: 100,
          offset: 0,
        }),
      );
      expect(queryBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when tenant context is missing', async () => {
      // Arrange
      const queryDto = {};

      // Act & Assert
      await expect(controller.getReadings('', queryDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.getReadings('', queryDto)).rejects.toThrow(
        'Tenant context is required',
      );
      expect(queryBus.execute).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when start time is after end time', async () => {
      // Arrange
      const queryDto = {
        startTime: '2025-10-30T23:59:59Z',
        endTime: '2025-10-01T00:00:00Z',
      };

      // Act & Assert
      await expect(controller.getReadings(tenantId, queryDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.getReadings(tenantId, queryDto)).rejects.toThrow(
        'Start time must be before end time',
      );
      expect(queryBus.execute).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when limit is out of range', async () => {
      // Arrange
      const queryDto = {
        limit: '2000', // Over maximum of 1000
      };

      // Act & Assert
      await expect(controller.getReadings(tenantId, queryDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.getReadings(tenantId, queryDto)).rejects.toThrow(
        'Limit must be between 1 and 1000',
      );
      expect(queryBus.execute).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when offset is negative', async () => {
      // Arrange
      const queryDto = {
        offset: '-10',
      };

      // Act & Assert
      await expect(controller.getReadings(tenantId, queryDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.getReadings(tenantId, queryDto)).rejects.toThrow(
        'Offset must be non-negative',
      );
      expect(queryBus.execute).not.toHaveBeenCalled();
    });

    it('should handle query execution errors', async () => {
      // Arrange
      const queryDto = {};
      const error = new Error('Database query failed');
      queryBus.execute.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.getReadings(tenantId, queryDto)).rejects.toThrow(
        error,
      );
      expect(queryBus.execute).toHaveBeenCalledTimes(1);
    });
  });
});
