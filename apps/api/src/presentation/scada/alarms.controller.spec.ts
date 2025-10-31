/**
 * Alarms Controller Tests
 *
 * Unit tests for alarm management REST API endpoints.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AlarmsController } from './alarms.controller';
import {
  AcknowledgeAlarmCommand,
  GetActiveAlarmsQuery,
} from '../../application/scada';
import type {
  AlarmSeverity,
  AlarmState,
  AlarmType,
} from '../../domain/scada/alarm.entity';

describe('AlarmsController', () => {
  let controller: AlarmsController;
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
      controllers: [AlarmsController],
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

    controller = module.get<AlarmsController>(AlarmsController);
    commandBus = module.get(CommandBus);
    queryBus = module.get(QueryBus);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getActiveAlarms', () => {
    const tenantId = 'tenant-123';

    it('should retrieve active alarms with all filters', async () => {
      // Arrange
      const queryDto = {
        wellId: 'well-123',
        severity: 'CRITICAL' as AlarmSeverity,
      };

      const mockAlarms = [
        {
          id: 'alarm-1',
          tenantId,
          wellId: 'well-123',
          scadaConnectionId: 'connection-123',
          tagName: 'WELLHEAD_PRESSURE',
          alarmType: 'HIGH_VALUE' as AlarmType,
          severity: 'CRITICAL' as AlarmSeverity,
          state: 'ACTIVE' as AlarmState,
          message: 'Wellhead pressure exceeded high limit',
          value: 550,
          threshold: 500,
          triggerCount: 1,
          firstTriggeredAt: '2025-10-30T10:30:00Z',
          lastTriggeredAt: '2025-10-30T10:30:00Z',
          createdAt: '2025-10-30T10:30:00Z',
          updatedAt: '2025-10-30T10:30:00Z',
        },
      ];

      queryBus.execute.mockResolvedValue(mockAlarms);

      // Act
      const result = await controller.getActiveAlarms(tenantId, queryDto);

      // Assert
      expect(result).toEqual(mockAlarms);
      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          wellId: queryDto.wellId,
          severity: queryDto.severity,
        }),
      );
      expect(queryBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should retrieve all active alarms without filters', async () => {
      // Arrange
      const queryDto = {};
      const mockAlarms: any[] = [];
      queryBus.execute.mockResolvedValue(mockAlarms);

      // Act
      const result = await controller.getActiveAlarms(tenantId, queryDto);

      // Assert
      expect(result).toEqual(mockAlarms);
      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          wellId: undefined,
          severity: undefined,
        }),
      );
      expect(queryBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when tenant context is missing', async () => {
      // Arrange
      const queryDto = {};

      // Act & Assert
      await expect(controller.getActiveAlarms('', queryDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.getActiveAlarms('', queryDto)).rejects.toThrow(
        'Tenant context is required',
      );
      expect(queryBus.execute).not.toHaveBeenCalled();
    });

    it('should handle query execution errors', async () => {
      // Arrange
      const queryDto = {};
      const error = new Error('Database query failed');
      queryBus.execute.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.getActiveAlarms(tenantId, queryDto),
      ).rejects.toThrow(error);
      expect(queryBus.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('acknowledgeAlarm', () => {
    const tenantId = 'tenant-123';
    const alarmId = 'alarm-123';
    const userId = 'user-123';

    it('should acknowledge alarm successfully', async () => {
      // Arrange
      commandBus.execute.mockResolvedValue(undefined);

      // Act
      const result = await controller.acknowledgeAlarm(
        tenantId,
        alarmId,
        userId,
      );

      // Assert
      expect(result).toEqual({ message: 'Alarm acknowledged successfully' });
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          alarmId,
          acknowledgedBy: userId,
        }),
      );
      expect(commandBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when tenant context is missing', async () => {
      // Act & Assert
      await expect(
        controller.acknowledgeAlarm('', alarmId, userId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.acknowledgeAlarm('', alarmId, userId),
      ).rejects.toThrow('Tenant context is required');
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when alarm ID is missing', async () => {
      // Act & Assert
      await expect(
        controller.acknowledgeAlarm(tenantId, '', userId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.acknowledgeAlarm(tenantId, '', userId),
      ).rejects.toThrow('Alarm ID is required');
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when alarm ID is whitespace', async () => {
      // Act & Assert
      await expect(
        controller.acknowledgeAlarm(tenantId, '   ', userId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.acknowledgeAlarm(tenantId, '   ', userId),
      ).rejects.toThrow('Alarm ID is required');
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when user ID is missing', async () => {
      // Act & Assert
      await expect(
        controller.acknowledgeAlarm(tenantId, alarmId, ''),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.acknowledgeAlarm(tenantId, alarmId, ''),
      ).rejects.toThrow('User authentication is required');
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('should propagate NotFoundException when alarm does not exist', async () => {
      // Arrange
      const error = new NotFoundException('Alarm not found');
      commandBus.execute.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.acknowledgeAlarm(tenantId, alarmId, userId),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.acknowledgeAlarm(tenantId, alarmId, userId),
      ).rejects.toThrow('Alarm not found');
      expect(commandBus.execute).toHaveBeenCalledTimes(2); // Called twice due to two expect calls
    });

    it('should propagate BadRequestException when alarm is already acknowledged', async () => {
      // Arrange
      const error = new BadRequestException('Alarm is already acknowledged');
      commandBus.execute.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.acknowledgeAlarm(tenantId, alarmId, userId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.acknowledgeAlarm(tenantId, alarmId, userId),
      ).rejects.toThrow('Alarm is already acknowledged');
      expect(commandBus.execute).toHaveBeenCalledTimes(2);
    });

    it('should wrap unexpected errors in BadRequestException', async () => {
      // Arrange
      const error = new Error('Unexpected database error');
      commandBus.execute.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.acknowledgeAlarm(tenantId, alarmId, userId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.acknowledgeAlarm(tenantId, alarmId, userId),
      ).rejects.toThrow('Unexpected database error');
      expect(commandBus.execute).toHaveBeenCalledTimes(2);
    });
  });
});
