/**
 * Domain Event Publisher Service
 *
 * Central event bus for publishing and subscribing to domain events.
 * Uses NestJS EventEmitter2 for in-process event handling.
 *
 * Features:
 * - Type-safe event publishing
 * - Asynchronous event handlers
 * - Error isolation (one handler failure doesn't affect others)
 * - Event logging and monitoring
 * - Support for event patterns (wildcards)
 *
 * Architecture:
 * - Domain entities collect events
 * - Repositories publish events after successful persistence
 * - Handlers react to events (audit, notifications, integrations)
 *
 * Event Flow:
 * 1. Entity: well.activate() → adds WellActivatedEvent
 * 2. Repository: wellRepository.save() → publishes collected events
 * 3. EventPublisher: publish(events) → emits to EventEmitter2
 * 4. Handlers: @OnEvent('WellActivated') → react to event
 *
 * Usage:
 * ```typescript
 * // In repository after save
 * const events = entity.getUncommittedEvents();
 * await this.eventPublisher.publishAll(events);
 * entity.clearEvents();
 * ```
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IDomainEvent } from '../../domain/common/domain-event.interface';

@Injectable()
export class DomainEventPublisher {
  private readonly logger = new Logger(DomainEventPublisher.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Publish a single domain event
   *
   * @param event - Domain event to publish
   */
  async publish(event: IDomainEvent): Promise<void> {
    try {
      this.logger.log(
        `Publishing event: ${event.eventType} (${event.eventId}) for aggregate ${event.aggregateType}:${event.aggregateId}`,
      );

      // Emit event to all registered handlers
      // EventEmitter2 will call all handlers that match the event type
      await this.eventEmitter.emitAsync(event.eventType, event);

      this.logger.debug(`Event published successfully: ${event.eventId}`);
    } catch (error) {
      this.logger.error(
        `Failed to publish event ${event.eventType} (${event.eventId}): ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      // Optionally: Store failed events for retry
      // await this.storeFailedEvent(event, error);

      // Don't throw - we don't want event publishing failures to break the request
      // The primary operation (e.g., creating a well) should still succeed
    }
  }

  /**
   * Publish multiple domain events
   *
   * Events are published sequentially to maintain ordering.
   * If one fails, subsequent events are still published.
   *
   * @param events - Array of domain events
   */
  async publishAll(events: IDomainEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    this.logger.log(`Publishing ${events.length} domain events`);

    for (const event of events) {
      await this.publish(event);
    }
  }

  /**
   * Publish event with delay
   *
   * Useful for scheduled notifications or time-based workflows.
   *
   * @param event - Domain event
   * @param delayMs - Delay in milliseconds
   */
  async publishDelayed(event: IDomainEvent, delayMs: number): Promise<void> {
    this.logger.log(
      `Scheduling event ${event.eventType} (${event.eventId}) for ${delayMs}ms delay`,
    );

    setTimeout(async () => {
      await this.publish(event);
    }, delayMs);
  }

  /**
   * Get event emitter for advanced usage
   *
   * Allows direct access to EventEmitter2 for advanced patterns:
   * - Event patterns (e.g., 'Well.*' for all well events)
   * - Priority listeners
   * - Once-only listeners
   *
   * @returns EventEmitter2 instance
   */
  getEventEmitter(): EventEmitter2 {
    return this.eventEmitter;
  }
}
