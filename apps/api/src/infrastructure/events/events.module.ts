/**
 * Events Module
 *
 * Provides domain event infrastructure for event-driven architecture.
 * Registers event publisher and event handlers.
 *
 * Features:
 * - EventEmitter2 for in-process event handling
 * - DomainEventPublisher for publishing domain events
 * - AuditLogEventHandler for audit trail
 * - Global module (available everywhere)
 *
 * Future Handlers:
 * - NotificationEventHandler (email/SMS notifications)
 * - WebhookEventHandler (external system integrations)
 * - MetricsEventHandler (business metrics tracking)
 * - CacheInvalidationEventHandler (invalidate caches on updates)
 */

import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DomainEventPublisher } from './domain-event-publisher.service';
import { AuditLogEventHandler } from './handlers/audit-log.event-handler';

@Global()
@Module({
  imports: [
    // EventEmitter2 with configuration
    EventEmitterModule.forRoot({
      // Use wildcards to support pattern-based listeners
      wildcard: true,
      // Delimiter for namespaced events (e.g., 'Well.Activated', 'Tenant.Created')
      delimiter: '.',
      // Process events asynchronously
      maxListeners: 100,
      // Don't use namespace (simpler event names)
      verboseMemoryLeak: false,
    }),
  ],
  providers: [
    DomainEventPublisher,
    AuditLogEventHandler,
    // Add more event handlers here as needed:
    // NotificationEventHandler,
    // WebhookEventHandler,
    // MetricsEventHandler,
  ],
  exports: [DomainEventPublisher],
})
export class EventsModule {}
