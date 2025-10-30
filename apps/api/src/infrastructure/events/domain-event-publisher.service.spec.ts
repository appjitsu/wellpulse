/**
 * Domain Event Publisher Tests
 *
 * Tests event publishing infrastructure for domain-driven design.
 * CRITICAL for audit logging, event sourcing, and system integration.
 *
 * Test Coverage:
 * - Single event publishing
 * - Batch event publishing
 * - Error handling and resilience
 * - Event type routing
 * - Async event emission
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEventPublisher } from './domain-event-publisher.service';
import { DomainEvent } from '../../domain/common/domain-event.interface';

// Test event class
class TestEvent extends DomainEvent {
  constructor(
    tenantId: string,
    userId: string,
    aggregateId: string,
    payload: Record<string, unknown>,
  ) {
    super(
      'test.event.created',
      tenantId,
      userId,
      aggregateId,
      'Test',
      payload,
      { source: 'unit-test' },
    );
  }
}

describe('DomainEventPublisher', () => {
  let publisher: DomainEventPublisher;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const mockEventEmitter = {
      emitAsync: jest.fn(),
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DomainEventPublisher,
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    publisher = module.get<DomainEventPublisher>(DomainEventPublisher);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(publisher).toBeDefined();
    });
  });

  describe('publish()', () => {
    it('should publish event via EventEmitter2', async () => {
      const event = new TestEvent('tenant-1', 'user-1', 'agg-1', {
        data: 'test',
      });
      eventEmitter.emitAsync.mockResolvedValue([]);

      await publisher.publish(event);

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        'test.event.created',
        event,
      );
    });

    it('should handle successful event emission', async () => {
      const event = new TestEvent('tenant-1', 'user-1', 'agg-1', {
        data: 'test',
      });
      eventEmitter.emitAsync.mockResolvedValue([true]);

      await expect(publisher.publish(event)).resolves.not.toThrow();
    });

    it('should not throw when event emission fails', async () => {
      const event = new TestEvent('tenant-1', 'user-1', 'agg-1', {
        data: 'test',
      });
      eventEmitter.emitAsync.mockRejectedValue(new Error('Handler failed'));

      // Should not throw - resilient to handler failures
      await expect(publisher.publish(event)).resolves.not.toThrow();
    });

    it('should log error when event emission fails', async () => {
      const event = new TestEvent('tenant-1', 'user-1', 'agg-1', {
        data: 'test',
      });
      eventEmitter.emitAsync.mockRejectedValue(new Error('Handler failed'));
      const loggerSpy = jest.spyOn(publisher['logger'], 'error');

      await publisher.publish(event);

      // Check first argument (message) - logger.error receives (message, stack)
      expect(loggerSpy.mock.calls[0][0]).toContain('Failed to publish event');
    });

    it('should log event details before publishing', async () => {
      const event = new TestEvent('tenant-1', 'user-1', 'agg-1', {
        data: 'test',
      });
      eventEmitter.emitAsync.mockResolvedValue([]);
      const loggerSpy = jest.spyOn(publisher['logger'], 'log');

      await publisher.publish(event);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Publishing event: test.event.created'),
      );
    });

    it('should publish event with all required properties', async () => {
      const event = new TestEvent('tenant-1', 'user-1', 'agg-1', {
        field1: 'value1',
        field2: 42,
      });
      eventEmitter.emitAsync.mockResolvedValue([]);

      await publisher.publish(event);

      const publishedEvent = eventEmitter.emitAsync.mock.calls[0][1];
      expect(publishedEvent).toHaveProperty('eventId');
      expect(publishedEvent).toHaveProperty('eventType', 'test.event.created');
      expect(publishedEvent).toHaveProperty('occurredAt');
      expect(publishedEvent).toHaveProperty('tenantId', 'tenant-1');
      expect(publishedEvent).toHaveProperty('userId', 'user-1');
      expect(publishedEvent).toHaveProperty('aggregateId', 'agg-1');
      expect(publishedEvent).toHaveProperty('aggregateType', 'Test');
      expect(publishedEvent).toHaveProperty('payload');
      expect(publishedEvent).toHaveProperty('metadata');
    });

    it('should preserve event payload data', async () => {
      const payload = {
        name: 'Test Well',
        location: { lat: 31.8, lng: -102.4 },
        status: 'ACTIVE',
      };
      const event = new TestEvent('tenant-1', 'user-1', 'well-123', payload);
      eventEmitter.emitAsync.mockResolvedValue([]);

      await publisher.publish(event);

      const publishedEvent = eventEmitter.emitAsync.mock.calls[0][1];
      expect(publishedEvent.payload).toEqual(payload);
    });

    it('should preserve event metadata', async () => {
      const event = new TestEvent('tenant-1', 'user-1', 'agg-1', {
        data: 'test',
      });
      eventEmitter.emitAsync.mockResolvedValue([]);

      await publisher.publish(event);

      const publishedEvent = eventEmitter.emitAsync.mock.calls[0][1];
      expect(publishedEvent.metadata).toEqual({ source: 'unit-test' });
    });
  });

  describe('publishAll()', () => {
    it('should publish multiple events in order', async () => {
      const events = [
        new TestEvent('tenant-1', 'user-1', 'agg-1', { order: 1 }),
        new TestEvent('tenant-1', 'user-1', 'agg-2', { order: 2 }),
        new TestEvent('tenant-1', 'user-1', 'agg-3', { order: 3 }),
      ];
      eventEmitter.emitAsync.mockResolvedValue([]);

      await publisher.publishAll(events);

      expect(eventEmitter.emitAsync).toHaveBeenCalledTimes(3);

      // Verify order
      expect(eventEmitter.emitAsync.mock.calls[0][1].payload.order).toBe(1);
      expect(eventEmitter.emitAsync.mock.calls[1][1].payload.order).toBe(2);
      expect(eventEmitter.emitAsync.mock.calls[2][1].payload.order).toBe(3);
    });

    it('should handle empty event array', async () => {
      await publisher.publishAll([]);

      expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
    });

    it('should continue publishing after single event failure', async () => {
      const events = [
        new TestEvent('tenant-1', 'user-1', 'agg-1', { id: 1 }),
        new TestEvent('tenant-1', 'user-1', 'agg-2', { id: 2 }),
        new TestEvent('tenant-1', 'user-1', 'agg-3', { id: 3 }),
      ];

      // First and third succeed, second fails
      eventEmitter.emitAsync
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('Event 2 failed'))
        .mockResolvedValueOnce([]);

      await publisher.publishAll(events);

      // All three events should be attempted
      expect(eventEmitter.emitAsync).toHaveBeenCalledTimes(3);
    });

    it('should log errors for failed events but continue', async () => {
      const events = [
        new TestEvent('tenant-1', 'user-1', 'agg-1', { id: 1 }),
        new TestEvent('tenant-1', 'user-1', 'agg-2', { id: 2 }),
      ];

      eventEmitter.emitAsync
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('Event 2 failed'));

      const loggerSpy = jest.spyOn(publisher['logger'], 'error');

      await publisher.publishAll(events);

      // Check first argument (message) - logger.error receives (message, stack)
      expect(loggerSpy.mock.calls[0][0]).toContain('Failed to publish event');
      expect(eventEmitter.emitAsync).toHaveBeenCalledTimes(2);
    });

    it('should publish events with different event types', async () => {
      class WellCreatedEvent extends DomainEvent {
        constructor(tenantId: string, wellId: string) {
          super('well.created', tenantId, 'system', wellId, 'Well', {
            name: 'Test Well',
          });
        }
      }

      class WellUpdatedEvent extends DomainEvent {
        constructor(tenantId: string, wellId: string) {
          super('well.updated', tenantId, 'user-1', wellId, 'Well', {
            status: 'ACTIVE',
          });
        }
      }

      const events = [
        new WellCreatedEvent('tenant-1', 'well-1'),
        new WellUpdatedEvent('tenant-1', 'well-1'),
      ];

      eventEmitter.emitAsync.mockResolvedValue([]);

      await publisher.publishAll(events);

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        'well.created',
        expect.any(Object),
      );
      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        'well.updated',
        expect.any(Object),
      );
    });
  });

  describe('Event Type Routing', () => {
    it('should route events by event type', async () => {
      const event = new TestEvent('tenant-1', 'user-1', 'agg-1', {
        data: 'test',
      });
      eventEmitter.emitAsync.mockResolvedValue([]);

      await publisher.publish(event);

      // First argument is event type (used for routing to handlers)
      expect(eventEmitter.emitAsync.mock.calls[0][0]).toBe(
        'test.event.created',
      );
    });

    it('should handle events with different naming conventions', async () => {
      class CamelCaseEvent extends DomainEvent {
        constructor() {
          super('userCreated', 'tenant-1', 'user-1', 'user-1', 'User', {});
        }
      }

      class DotNotationEvent extends DomainEvent {
        constructor() {
          super('user.created', 'tenant-1', 'user-1', 'user-1', 'User', {});
        }
      }

      const camelEvent = new CamelCaseEvent();
      const dotEvent = new DotNotationEvent();

      eventEmitter.emitAsync.mockResolvedValue([]);

      await publisher.publish(camelEvent);
      await publisher.publish(dotEvent);

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        'userCreated',
        expect.any(Object),
      );
      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        'user.created',
        expect.any(Object),
      );
    });
  });

  describe('Resilience and Error Handling', () => {
    it('should be resilient to EventEmitter2 errors', async () => {
      const event = new TestEvent('tenant-1', 'user-1', 'agg-1', {
        data: 'test',
      });
      eventEmitter.emitAsync.mockRejectedValue(
        new Error('EventEmitter2 crashed'),
      );

      // Should not propagate error
      await expect(publisher.publish(event)).resolves.not.toThrow();
    });

    it('should be resilient to handler errors', async () => {
      const event = new TestEvent('tenant-1', 'user-1', 'agg-1', {
        data: 'test',
      });
      eventEmitter.emitAsync.mockRejectedValue(
        new Error('Handler threw exception'),
      );

      await expect(publisher.publish(event)).resolves.not.toThrow();
    });

    it('should not block main request flow on event failures', async () => {
      const event = new TestEvent('tenant-1', 'user-1', 'agg-1', {
        data: 'test',
      });
      eventEmitter.emitAsync.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Publisher should swallow error and log
      await expect(publisher.publish(event)).resolves.not.toThrow();
    });

    it('should log meaningful error messages', async () => {
      const event = new TestEvent('tenant-1', 'user-1', 'agg-1', {
        data: 'test',
      });
      const error = new Error('Audit log database unavailable');
      eventEmitter.emitAsync.mockRejectedValue(error);

      const loggerSpy = jest.spyOn(publisher['logger'], 'error');

      await publisher.publish(event);

      // Check first argument (message) contains event type and error message
      const logMessage = loggerSpy.mock.calls[0][0];
      expect(logMessage).toContain('Failed to publish event');
      expect(logMessage).toContain('test.event.created');
      expect(logMessage).toContain('Audit log database unavailable');
    });
  });

  describe('Event Properties', () => {
    it('should include tenant context in events', async () => {
      const event = new TestEvent('tenant-123', 'user-1', 'agg-1', {});
      eventEmitter.emitAsync.mockResolvedValue([]);

      await publisher.publish(event);

      const publishedEvent = eventEmitter.emitAsync.mock.calls[0][1];
      expect(publishedEvent.tenantId).toBe('tenant-123');
    });

    it('should include user context in events', async () => {
      const event = new TestEvent('tenant-1', 'user-456', 'agg-1', {});
      eventEmitter.emitAsync.mockResolvedValue([]);

      await publisher.publish(event);

      const publishedEvent = eventEmitter.emitAsync.mock.calls[0][1];
      expect(publishedEvent.userId).toBe('user-456');
    });

    it('should handle null user ID (system events)', async () => {
      const event = new TestEvent('tenant-1', null as any, 'agg-1', {});
      eventEmitter.emitAsync.mockResolvedValue([]);

      await publisher.publish(event);

      const publishedEvent = eventEmitter.emitAsync.mock.calls[0][1];
      expect(publishedEvent.userId).toBeNull();
    });

    it('should generate unique event IDs', async () => {
      const event1 = new TestEvent('tenant-1', 'user-1', 'agg-1', {});
      const event2 = new TestEvent('tenant-1', 'user-1', 'agg-1', {});
      eventEmitter.emitAsync.mockResolvedValue([]);

      await publisher.publish(event1);
      await publisher.publish(event2);

      const eventId1 = eventEmitter.emitAsync.mock.calls[0][1].eventId;
      const eventId2 = eventEmitter.emitAsync.mock.calls[1][1].eventId;

      expect(eventId1).not.toBe(eventId2);
    });

    it('should include timestamp in events', async () => {
      const event = new TestEvent('tenant-1', 'user-1', 'agg-1', {});
      eventEmitter.emitAsync.mockResolvedValue([]);

      await publisher.publish(event);

      const publishedEvent = eventEmitter.emitAsync.mock.calls[0][1];
      expect(publishedEvent.occurredAt).toBeInstanceOf(Date);
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle rapid event publishing', async () => {
      const events = Array.from(
        { length: 100 },
        (_, i) => new TestEvent('tenant-1', 'user-1', `agg-${i}`, { index: i }),
      );
      eventEmitter.emitAsync.mockResolvedValue([]);

      await publisher.publishAll(events);

      expect(eventEmitter.emitAsync).toHaveBeenCalledTimes(100);
    });

    it('should maintain event order during batch publishing', async () => {
      const events = Array.from(
        { length: 10 },
        (_, i) =>
          new TestEvent('tenant-1', 'user-1', `agg-${i}`, { sequence: i }),
      );
      eventEmitter.emitAsync.mockResolvedValue([]);

      await publisher.publishAll(events);

      // Verify events were published in order
      for (let i = 0; i < 10; i++) {
        const publishedEvent = eventEmitter.emitAsync.mock.calls[i][1];
        expect(publishedEvent.payload.sequence).toBe(i);
      }
    });
  });
});
