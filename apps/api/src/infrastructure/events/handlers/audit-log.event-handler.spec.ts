/**
 * Audit Log Event Handler Tests
 *
 * Tests automatic audit trail persistence for all domain events.
 * CRITICAL for compliance (GDPR, SOC 2, HIPAA), security auditing, and debugging.
 *
 * Test Coverage:
 * - Event persistence to tenant databases
 * - Wildcard event listener functionality
 * - Error isolation (handler failures don't break main flow)
 * - Tenant context validation
 * - Audit log querying (aggregate history, user activity)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogEventHandler } from './audit-log.event-handler';
import { TenantDatabaseService } from '../../database/tenant-database.service';
import {
  DomainEvent,
  IDomainEvent,
} from '../../../domain/common/domain-event.interface';
import { eq, and, gte, lte } from 'drizzle-orm';

// Test event class
class TestDomainEvent extends DomainEvent {
  constructor(
    tenantId: string,
    userId: string,
    aggregateId: string,
    aggregateType: string,
    payload: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ) {
    super(
      'test.event',
      tenantId,
      userId,
      aggregateId,
      aggregateType,
      payload,
      metadata || { source: 'test' },
    );
  }
}

describe('AuditLogEventHandler', () => {
  let handler: AuditLogEventHandler;
  let tenantDbService: jest.Mocked<TenantDatabaseService>;
  let mockDb: any;

  beforeEach(async () => {
    // Mock database operations
    mockDb = {
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      }),
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    const mockTenantDbService = {
      getTenantDatabase: jest.fn().mockResolvedValue(mockDb),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogEventHandler,
        {
          provide: TenantDatabaseService,
          useValue: mockTenantDbService,
        },
      ],
    }).compile();

    handler = module.get<AuditLogEventHandler>(AuditLogEventHandler);
    tenantDbService = module.get(TenantDatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(handler).toBeDefined();
    });
  });

  describe('handleEvent() - Event Persistence', () => {
    it('should persist event to tenant database', async () => {
      const event = new TestDomainEvent(
        'tenant-123',
        'user-456',
        'well-789',
        'Well',
        { name: 'Test Well' },
      );

      await handler.handleEvent(event);

      expect(tenantDbService.getTenantDatabase).toHaveBeenCalledWith(
        'tenant-123',
      );
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should store all event properties in audit log', async () => {
      const event = new TestDomainEvent(
        'tenant-123',
        'user-456',
        'well-789',
        'Well',
        { name: 'Test Well', status: 'ACTIVE' },
      );

      let capturedData: any;
      mockDb.insert.mockReturnValue({
        values: jest.fn((data) => {
          capturedData = data;
          return Promise.resolve(undefined);
        }),
      });

      await handler.handleEvent(event);

      expect(capturedData).toMatchObject({
        eventId: event.eventId,
        eventType: event.eventType,
        occurredAt: event.occurredAt,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        userId: event.userId,
        tenantId: event.tenantId,
        payload: event.payload,
        metadata: event.metadata,
      });
    });

    it('should skip events without tenant context', async () => {
      const event = new TestDomainEvent(
        null as any, // No tenant ID
        'user-456',
        'agg-789',
        'Test',
        {},
      );

      const loggerSpy = jest.spyOn(handler['logger'], 'warn');

      await handler.handleEvent(event);

      expect(tenantDbService.getTenantDatabase).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('no tenant context'),
      );
    });

    it('should log successful audit log persistence', async () => {
      const event = new TestDomainEvent(
        'tenant-123',
        'user-456',
        'well-789',
        'Well',
        {},
      );

      const loggerSpy = jest.spyOn(handler['logger'], 'log');

      await handler.handleEvent(event);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Audit log recorded'),
      );
    });

    it('should log debug message before recording', async () => {
      const event = new TestDomainEvent(
        'tenant-123',
        'user-456',
        'well-789',
        'Well',
        {},
      );

      const loggerSpy = jest.spyOn(handler['logger'], 'debug');

      await handler.handleEvent(event);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Recording audit log for'),
      );
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should not throw when database insertion fails', async () => {
      const event = new TestDomainEvent(
        'tenant-123',
        'user-456',
        'well-789',
        'Well',
        {},
      );

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      await expect(handler.handleEvent(event)).resolves.not.toThrow();
    });

    it('should log error when audit log persistence fails', async () => {
      const event = new TestDomainEvent(
        'tenant-123',
        'user-456',
        'well-789',
        'Well',
        {},
      );

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockRejectedValue(new Error('Connection timeout')),
      });

      const loggerSpy = jest.spyOn(handler['logger'], 'error');

      await handler.handleEvent(event);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to record audit log'),
        expect.anything(),
      );
    });

    it('should not propagate errors to main application flow', async () => {
      const event = new TestDomainEvent(
        'tenant-123',
        'user-456',
        'well-789',
        'Well',
        {},
      );

      tenantDbService.getTenantDatabase.mockRejectedValue(
        new Error('Tenant database unavailable'),
      );

      // Should swallow error
      await expect(handler.handleEvent(event)).resolves.not.toThrow();
    });

    it('should handle tenant database service errors', async () => {
      const event = new TestDomainEvent(
        'tenant-123',
        'user-456',
        'well-789',
        'Well',
        {},
      );

      tenantDbService.getTenantDatabase.mockRejectedValue(
        new Error('Tenant not provisioned'),
      );

      const loggerSpy = jest.spyOn(handler['logger'], 'error');

      await handler.handleEvent(event);

      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('Wildcard Event Listener', () => {
    it('should capture events of different types', async () => {
      const events = [
        new TestDomainEvent('tenant-1', 'user-1', 'well-1', 'Well', {}),
        new TestDomainEvent('tenant-1', 'user-1', 'equip-1', 'Equipment', {}),
        new TestDomainEvent('tenant-1', 'user-1', 'field-1', 'FieldData', {}),
      ];

      for (const event of events) {
        await handler.handleEvent(event);
      }

      expect(mockDb.insert).toHaveBeenCalledTimes(3);
    });

    it('should handle system events (null userId)', async () => {
      const event = new TestDomainEvent(
        'tenant-123',
        null as any, // System event
        'well-789',
        'Well',
        { source: 'system' },
      );

      await handler.handleEvent(event);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should preserve event metadata', async () => {
      const event = new TestDomainEvent(
        'tenant-123',
        'user-456',
        'well-789',
        'Well',
        {},
        { source: 'api', ip: '192.168.1.1', userAgent: 'test' }, // Pass metadata in constructor
      );

      let capturedData: any;
      mockDb.insert.mockReturnValue({
        values: jest.fn((data) => {
          capturedData = data;
          return Promise.resolve(undefined);
        }),
      });

      await handler.handleEvent(event);

      expect(capturedData.metadata).toEqual(event.metadata);
    });
  });

  describe('getAggregateHistory()', () => {
    it('should query audit logs for specific aggregate', async () => {
      const mockLogs = [
        {
          eventId: 'evt-1',
          eventType: 'well.created',
          occurredAt: new Date('2025-01-01'),
          aggregateId: 'well-123',
          aggregateType: 'Well',
          userId: 'user-1',
          tenantId: 'tenant-1',
          payload: { name: 'Well 1' },
          metadata: {},
        },
      ];

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(mockLogs),
          }),
        }),
      });

      const result = await handler.getAggregateHistory('tenant-1', 'well-123');

      expect(result).toHaveLength(1);
      expect(result[0].aggregateId).toBe('well-123');
      expect(tenantDbService.getTenantDatabase).toHaveBeenCalledWith(
        'tenant-1',
      );
    });

    it('should filter by aggregate type when provided', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await handler.getAggregateHistory('tenant-1', 'well-123', 'Well');

      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return events in chronological order', async () => {
      const mockLogs = [
        {
          eventId: 'evt-1',
          eventType: 'well.created',
          occurredAt: new Date('2025-01-01T10:00:00Z'),
          aggregateId: 'well-123',
          aggregateType: 'Well',
          userId: 'user-1',
          tenantId: 'tenant-1',
          payload: {},
          metadata: {},
        },
        {
          eventId: 'evt-2',
          eventType: 'well.updated',
          occurredAt: new Date('2025-01-01T11:00:00Z'),
          aggregateId: 'well-123',
          aggregateType: 'Well',
          userId: 'user-1',
          tenantId: 'tenant-1',
          payload: {},
          metadata: {},
        },
      ];

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(mockLogs),
          }),
        }),
      });

      const result = await handler.getAggregateHistory('tenant-1', 'well-123');

      expect(result[0].eventType).toBe('well.created');
      expect(result[1].eventType).toBe('well.updated');
    });

    it('should throw error when query fails', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockRejectedValue(new Error('Query failed')),
          }),
        }),
      });

      await expect(
        handler.getAggregateHistory('tenant-1', 'well-123'),
      ).rejects.toThrow();
    });

    it('should log error when query fails', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockRejectedValue(new Error('Query failed')),
          }),
        }),
      });

      const loggerSpy = jest.spyOn(handler['logger'], 'error');

      await expect(
        handler.getAggregateHistory('tenant-1', 'well-123'),
      ).rejects.toThrow();

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get aggregate history'),
      );
    });
  });

  describe('getUserActivity()', () => {
    it('should query audit logs for specific user', async () => {
      const mockLogs = [
        {
          eventId: 'evt-1',
          eventType: 'well.created',
          occurredAt: new Date(),
          aggregateId: 'well-123',
          aggregateType: 'Well',
          userId: 'user-1',
          tenantId: 'tenant-1',
          payload: {},
          metadata: {},
        },
      ];

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(mockLogs),
          }),
        }),
      });

      const result = await handler.getUserActivity('tenant-1', 'user-1');

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user-1');
    });

    it('should filter by date range when provided', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await handler.getUserActivity('tenant-1', 'user-1', startDate, endDate);

      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return events in chronological order', async () => {
      const mockLogs = [
        {
          eventId: 'evt-1',
          eventType: 'well.created',
          occurredAt: new Date('2025-01-01T10:00:00Z'),
          aggregateId: 'well-1',
          aggregateType: 'Well',
          userId: 'user-1',
          tenantId: 'tenant-1',
          payload: {},
          metadata: {},
        },
        {
          eventId: 'evt-2',
          eventType: 'well.updated',
          occurredAt: new Date('2025-01-01T11:00:00Z'),
          aggregateId: 'well-2',
          aggregateType: 'Well',
          userId: 'user-1',
          tenantId: 'tenant-1',
          payload: {},
          metadata: {},
        },
      ];

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(mockLogs),
          }),
        }),
      });

      const result = await handler.getUserActivity('tenant-1', 'user-1');

      expect(result[0].occurredAt.getTime()).toBeLessThan(
        result[1].occurredAt.getTime(),
      );
    });

    it('should throw error when query fails', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockRejectedValue(new Error('Query failed')),
          }),
        }),
      });

      await expect(
        handler.getUserActivity('tenant-1', 'user-1'),
      ).rejects.toThrow();
    });

    it('should log error when query fails', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockRejectedValue(new Error('Query failed')),
          }),
        }),
      });

      const loggerSpy = jest.spyOn(handler['logger'], 'error');

      await expect(
        handler.getUserActivity('tenant-1', 'user-1'),
      ).rejects.toThrow();

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get user activity'),
      );
    });
  });

  describe('Compliance and Audit Trail', () => {
    it('should preserve complete audit trail for entity', async () => {
      const events = [
        new TestDomainEvent('tenant-1', 'user-1', 'well-1', 'Well', {
          action: 'created',
        }),
        new TestDomainEvent('tenant-1', 'user-2', 'well-1', 'Well', {
          action: 'updated',
        }),
        new TestDomainEvent('tenant-1', 'user-3', 'well-1', 'Well', {
          action: 'deleted',
        }),
      ];

      for (const event of events) {
        await handler.handleEvent(event);
      }

      expect(mockDb.insert).toHaveBeenCalledTimes(3);
    });

    it('should store tenant isolation context', async () => {
      const event = new TestDomainEvent(
        'tenant-123',
        'user-456',
        'well-789',
        'Well',
        {},
      );

      let capturedData: any;
      mockDb.insert.mockReturnValue({
        values: jest.fn((data) => {
          capturedData = data;
          return Promise.resolve(undefined);
        }),
      });

      await handler.handleEvent(event);

      expect(capturedData.tenantId).toBe('tenant-123');
    });

    it('should store user attribution for compliance', async () => {
      const event = new TestDomainEvent(
        'tenant-123',
        'user-456',
        'well-789',
        'Well',
        {},
      );

      let capturedData: any;
      mockDb.insert.mockReturnValue({
        values: jest.fn((data) => {
          capturedData = data;
          return Promise.resolve(undefined);
        }),
      });

      await handler.handleEvent(event);

      expect(capturedData.userId).toBe('user-456');
    });
  });
});
