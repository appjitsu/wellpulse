import { Test, TestingModule } from '@nestjs/testing';
import { AlarmRepository } from './alarm.repository';
import { TenantDatabaseService } from '../tenant-database.service';
import { Alarm } from '../../../domain/scada/alarm.entity';

describe('AlarmRepository', () => {
  let repository: AlarmRepository;
  let mockTenantDb: jest.Mocked<TenantDatabaseService>;
  let mockDb: any;

  const mockTenantId = 'tenant-123';
  const mockWellId = 'well-456';
  const mockConnectionId = 'connection-789';

  beforeEach(async () => {
    // Mock database operations
    mockDb = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      onConflictDoUpdate: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]), // Return promise
      delete: jest.fn().mockReturnThis(),
    };

    mockTenantDb = {
      getTenantDatabase: jest.fn().mockResolvedValue(mockDb),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlarmRepository,
        {
          provide: TenantDatabaseService,
          useValue: mockTenantDb,
        },
      ],
    }).compile();

    repository = module.get<AlarmRepository>(AlarmRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should find an alarm by ID', async () => {
      const now = new Date();
      const mockRow = {
        id: 'alarm-123',
        tenantId: mockTenantId,
        wellId: mockWellId,
        scadaConnectionId: mockConnectionId,
        tagName: 'pressure',
        alarmType: 'HIGH_VALUE',
        severity: 'WARNING',
        state: 'ACTIVE',
        message: 'Pressure exceeds threshold',
        value: 175.5,
        threshold: 150,
        triggerCount: 1,
        firstTriggeredAt: now,
        lastTriggeredAt: now,
        acknowledgedAt: null,
        acknowledgedBy: null,
        clearedAt: null,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      };

      mockDb.limit.mockResolvedValue([mockRow]);

      const result = await repository.findById(mockTenantId, 'alarm-123');

      expect(result).toBeInstanceOf(Alarm);
      expect(result?.id).toBe('alarm-123');
      expect(result?.severity).toBe('WARNING');
    });

    it('should return null when alarm not found', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await repository.findById(mockTenantId, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findActive', () => {
    it('should find all active alarms', async () => {
      const now = new Date();
      const mockRows = [
        {
          id: 'alarm-1',
          tenantId: mockTenantId,
          wellId: mockWellId,
          scadaConnectionId: mockConnectionId,
          tagName: 'pressure',
          alarmType: 'HIGH_VALUE',
          severity: 'WARNING',
          state: 'ACTIVE',
          message: 'High pressure',
          value: null,
          threshold: null,
          triggerCount: 1,
          firstTriggeredAt: now,
          lastTriggeredAt: now,
          acknowledgedAt: null,
          acknowledgedBy: null,
          clearedAt: null,
          metadata: null,
          createdAt: now,
          updatedAt: now,
        },
      ];

      mockDb.where.mockResolvedValue(mockRows);

      const result = await repository.findActive(mockTenantId);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(Alarm);
      expect(result[0].state).toBe('ACTIVE');
    });

    it('should filter active alarms by well', async () => {
      mockDb.where.mockResolvedValue([]);

      await repository.findActive(mockTenantId, { wellId: mockWellId });

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('findByState', () => {
    it('should find alarms by state', async () => {
      const now = new Date();
      const mockRows = [
        {
          id: 'alarm-1',
          tenantId: mockTenantId,
          wellId: mockWellId,
          scadaConnectionId: mockConnectionId,
          tagName: 'pressure',
          alarmType: 'HIGH_VALUE',
          severity: 'WARNING',
          state: 'ACKNOWLEDGED',
          message: 'High pressure',
          value: null,
          threshold: null,
          triggerCount: 1,
          firstTriggeredAt: now,
          lastTriggeredAt: now,
          acknowledgedAt: now,
          acknowledgedBy: 'user-123',
          clearedAt: null,
          metadata: null,
          createdAt: now,
          updatedAt: now,
        },
      ];

      mockDb.where.mockResolvedValue(mockRows);

      const result = await repository.findByState(mockTenantId, 'ACKNOWLEDGED');

      expect(result).toHaveLength(1);
      expect(result[0].state).toBe('ACKNOWLEDGED');
    });
  });

  describe('findWithFilters', () => {
    it('should find alarms with multiple filters', async () => {
      mockDb.where.mockResolvedValue([]);

      await repository.findWithFilters(mockTenantId, {
        wellId: mockWellId,
        severity: 'CRITICAL',
        state: 'ACTIVE',
      });

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('findExistingAlarm', () => {
    it('should find an existing non-cleared alarm for same condition', async () => {
      const now = new Date();
      const mockRow = {
        id: 'alarm-existing',
        tenantId: mockTenantId,
        wellId: mockWellId,
        scadaConnectionId: mockConnectionId,
        tagName: 'pressure',
        alarmType: 'HIGH_VALUE',
        severity: 'WARNING',
        state: 'ACTIVE',
        message: 'High pressure',
        value: null,
        threshold: null,
        triggerCount: 3,
        firstTriggeredAt: now,
        lastTriggeredAt: now,
        acknowledgedAt: null,
        acknowledgedBy: null,
        clearedAt: null,
        metadata: null,
        createdAt: now,
        updatedAt: now,
      };

      mockDb.limit.mockResolvedValue([mockRow]);

      const result = await repository.findExistingAlarm(
        mockTenantId,
        mockWellId,
        mockConnectionId,
        'pressure',
        'HIGH_VALUE',
      );

      expect(result).toBeInstanceOf(Alarm);
      expect(result?.triggerCount).toBe(3);
    });

    it('should return null when no existing alarm found', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await repository.findExistingAlarm(
        mockTenantId,
        mockWellId,
        mockConnectionId,
        'pressure',
        'HIGH_VALUE',
      );

      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('should save a new alarm', async () => {
      const alarm = Alarm.create({
        tenantId: mockTenantId,
        wellId: mockWellId,
        scadaConnectionId: mockConnectionId,
        tagName: 'pressure',
        alarmType: 'HIGH_VALUE',
        severity: 'WARNING',
        message: 'Pressure exceeds threshold',
        value: 175.5,
        threshold: 150,
      });

      await repository.save(alarm);

      expect(mockTenantDb.getTenantDatabase).toHaveBeenCalledWith(mockTenantId);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.onConflictDoUpdate).toHaveBeenCalled();
    });

    it('should update an existing alarm on conflict', async () => {
      const alarm = Alarm.create({
        tenantId: mockTenantId,
        wellId: mockWellId,
        scadaConnectionId: mockConnectionId,
        tagName: 'pressure',
        alarmType: 'HIGH_VALUE',
        severity: 'WARNING',
        message: 'Pressure exceeds threshold',
      });

      alarm.acknowledge('user-123');

      await repository.save(alarm);

      expect(mockDb.onConflictDoUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          set: expect.objectContaining({
            state: 'ACKNOWLEDGED',
          }),
        }),
      );
    });
  });

  describe('countActiveBySeverity', () => {
    it('should count active alarms by severity', async () => {
      mockDb.where.mockResolvedValue([{ count: 5 }]);

      const result = await repository.countActiveBySeverity(
        mockTenantId,
        'CRITICAL',
      );

      expect(result).toBe(5);
    });

    it('should count all active alarms when no severity specified', async () => {
      mockDb.where.mockResolvedValue([{ count: 10 }]);

      const result = await repository.countActiveBySeverity(mockTenantId);

      expect(result).toBe(10);
    });

    it('should return 0 when no alarms found', async () => {
      mockDb.where.mockResolvedValue([]);

      const result = await repository.countActiveBySeverity(
        mockTenantId,
        'WARNING',
      );

      expect(result).toBe(0);
    });
  });

  describe('countActiveForWell', () => {
    it('should count active alarms for a specific well', async () => {
      mockDb.where.mockResolvedValue([{ count: 3 }]);

      const result = await repository.countActiveForWell(
        mockTenantId,
        mockWellId,
      );

      expect(result).toBe(3);
    });
  });

  describe('delete', () => {
    it('should delete an alarm', async () => {
      await repository.delete(mockTenantId, 'alarm-123');

      expect(mockTenantDb.getTenantDatabase).toHaveBeenCalledWith(mockTenantId);
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe('domain mapping', () => {
    it('should correctly map domain entity to database row', async () => {
      const alarm = Alarm.create({
        tenantId: mockTenantId,
        wellId: mockWellId,
        scadaConnectionId: mockConnectionId,
        tagName: 'pressure',
        alarmType: 'HIGH_VALUE',
        severity: 'CRITICAL',
        message: 'Critical pressure level',
        value: 200,
        threshold: 150,
      });

      await repository.save(alarm);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: mockTenantId,
          wellId: mockWellId,
          scadaConnectionId: mockConnectionId,
          tagName: 'pressure',
          alarmType: 'HIGH_VALUE',
          severity: 'CRITICAL',
          state: 'ACTIVE',
          message: 'Critical pressure level',
          value: 200,
          threshold: 150,
          triggerCount: 1,
        }),
      );
    });

    it('should handle acknowledged alarms', async () => {
      const alarm = Alarm.create({
        tenantId: mockTenantId,
        wellId: mockWellId,
        scadaConnectionId: mockConnectionId,
        tagName: 'pressure',
        alarmType: 'HIGH_VALUE',
        severity: 'WARNING',
        message: 'High pressure',
      });

      alarm.acknowledge('user-123');

      await repository.save(alarm);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'ACKNOWLEDGED',
          acknowledgedBy: 'user-123',
        }),
      );
    });

    it('should handle cleared alarms', async () => {
      const alarm = Alarm.create({
        tenantId: mockTenantId,
        wellId: mockWellId,
        scadaConnectionId: mockConnectionId,
        tagName: 'pressure',
        alarmType: 'HIGH_VALUE',
        severity: 'WARNING',
        message: 'High pressure',
      });

      alarm.acknowledge('user-123');
      alarm.clear();

      await repository.save(alarm);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'CLEARED',
        }),
      );
    });
  });
});
