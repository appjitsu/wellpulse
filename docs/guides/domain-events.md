# Domain Events Guide

**Version**: 1.0
**Last Updated**: October 29, 2025

Complete guide to using domain events in WellPulse for event-driven architecture, audit logging, and system integration.

---

## Overview

Domain events represent significant business occurrences that have already happened. They provide:
- **Audit Trail**: Complete history of what happened, when, and by whom
- **Decoupling**: Handlers react to events without polluting domain logic
- **Event Sourcing**: Ability to reconstruct state from event history
- **Integration**: Events can trigger external systems (webhooks, notifications)

---

## Architecture

### Event Flow

```
1. Domain Entity            2. Repository           3. Event Publisher      4. Event Handlers
   │                            │                       │                      │
   ├─ Business Logic           ├─ Save Entity          ├─ Publish Events      ├─ Audit Log
   ├─ Add Event                ├─ Get Events           ├─ Emit to            ├─ Notifications
   └─ getUncommittedEvents()   └─ Publish              │   EventEmitter2      ├─ Webhooks
                                                        └─ Log Event           └─ Metrics
```

### Example: Well Activation

```typescript
// 1. Domain Entity (Well)
well.activate(userId);  // Business logic + adds WellActivatedEvent

// 2. Repository
await wellRepository.save(well);
const events = well.getUncommittedEvents();
await eventPublisher.publishAll(events);
well.clearEvents();

// 3. Event Publisher
eventPublisher emits 'WellActivated' → EventEmitter2

// 4. Event Handlers (automatically triggered)
- AuditLogEventHandler → Persists to audit_logs table
- NotificationEventHandler → Sends email to well operators
- MetricsEventHandler → Updates dashboard statistics
```

---

## Creating Domain Events

### Step 1: Define the Event

```typescript
// src/domain/wells/events/well-activated.event.ts
import { DomainEvent } from '../../common/domain-event.interface';

export class WellActivatedEvent extends DomainEvent {
  constructor(
    tenantId: string,
    userId: string,
    wellId: string,
    payload: {
      wellName: string;
      apiNumber: string;
      operator: string;
      latitude: number;
      longitude: number;
      activatedAt: Date;
      reason?: string;
    },
  ) {
    super(
      'WellActivated',              // Event type (PascalCase, past tense)
      tenantId,                     // Tenant ID
      userId,                       // Who triggered it
      wellId,                       // Aggregate ID
      'Well',                       // Aggregate type
      payload,                      // Event-specific data
      {                             // Optional metadata
        source: 'domain',
        version: '1.0',
      },
    );
  }
}
```

### Step 2: Add Event to Entity

```typescript
// src/domain/wells/well.entity.ts
import { IDomainEvent } from '../common/domain-event.interface';
import { WellActivatedEvent } from './events/well-activated.event';

export class Well {
  private uncommittedEvents: IDomainEvent[] = [];

  // ... existing properties and constructor ...

  /**
   * Activate the well
   */
  activate(userId: string): void {
    // Business rule validation
    if (this.props.status === 'ACTIVE') {
      throw new Error('Well is already active');
    }

    // Update state
    this.props.status = 'ACTIVE';
    this.props.updatedAt = new Date();

    // Add domain event
    this.addEvent(
      new WellActivatedEvent(
        this.props.tenantId,
        userId,
        this.props.id,
        {
          wellName: this.props.name,
          apiNumber: this.props.apiNumber.toString(),
          operator: this.props.operator,
          latitude: this.props.location.latitude,
          longitude: this.props.location.longitude,
          activatedAt: new Date(),
        },
      ),
    );
  }

  /**
   * Add an event to the uncommitted events list
   */
  private addEvent(event: IDomainEvent): void {
    this.uncommittedEvents.push(event);
  }

  /**
   * Get all uncommitted events
   */
  getUncommittedEvents(): IDomainEvent[] {
    return [...this.uncommittedEvents];
  }

  /**
   * Clear uncommitted events (after publishing)
   */
  clearEvents(): void {
    this.uncommittedEvents = [];
  }
}
```

### Step 3: Publish Events in Repository

```typescript
// src/infrastructure/database/repositories/well.repository.ts
import { DomainEventPublisher } from '../../events/domain-event-publisher.service';

@Injectable()
export class WellRepository implements IWellRepository {
  constructor(
    private readonly tenantDbService: TenantDatabaseService,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async save(well: Well): Promise<Well> {
    // Save to database
    const updated = await this.update(well);

    // Publish domain events
    const events = well.getUncommittedEvents();
    if (events.length > 0) {
      await this.eventPublisher.publishAll(events);
      well.clearEvents();
    }

    return updated;
  }

  async create(well: Well): Promise<Well> {
    // Insert to database
    const created = await this.insert(well);

    // Publish domain events
    const events = well.getUncommittedEvents();
    if (events.length > 0) {
      await this.eventPublisher.publishAll(events);
      well.clearEvents();
    }

    return created;
  }
}
```

---

## Event Handlers

### Built-in Handlers

#### 1. AuditLogEventHandler (Automatic)

Automatically persists ALL events to `audit_logs` table for compliance.

```typescript
// Automatically active - no configuration needed
// All events → audit_logs table
```

### Creating Custom Handlers

#### 2. Notification Handler

```typescript
// src/infrastructure/events/handlers/notification.event-handler.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WellActivatedEvent } from '../../../domain/wells/events/well-activated.event';

@Injectable()
export class NotificationEventHandler {
  private readonly logger = new Logger(NotificationEventHandler.name);

  constructor(private readonly emailService: EmailService) {}

  /**
   * Send notification when well is activated
   */
  @OnEvent('WellActivated', { async: true })
  async handleWellActivated(event: WellActivatedEvent): Promise<void> {
    this.logger.log(`Sending well activation notification for ${event.aggregateId}`);

    try {
      await this.emailService.send({
        to: event.payload.operator,
        subject: `Well Activated: ${event.payload.wellName}`,
        template: 'well-activated',
        data: {
          wellName: event.payload.wellName,
          apiNumber: event.payload.apiNumber,
          activatedAt: event.payload.activatedAt,
        },
      });
    } catch (error) {
      // Log error but don't throw - notifications shouldn't break the workflow
      this.logger.error(`Failed to send notification: ${error.message}`);
    }
  }
}
```

#### 3. Webhook Handler

```typescript
// src/infrastructure/events/handlers/webhook.event-handler.ts
@Injectable()
export class WebhookEventHandler {
  private readonly logger = new Logger(WebhookEventHandler.name);

  constructor(private readonly httpService: HttpService) {}

  /**
   * Send webhook when well is activated
   */
  @OnEvent('WellActivated', { async: true })
  async handleWellActivated(event: WellActivatedEvent): Promise<void> {
    this.logger.log(`Sending webhook for ${event.eventType}`);

    // Get tenant's webhook URL from configuration
    const webhookUrl = await this.getWebhookUrl(event.tenantId, 'well.activated');

    if (!webhookUrl) {
      return; // No webhook configured
    }

    try {
      await this.httpService.post(webhookUrl, {
        eventId: event.eventId,
        eventType: event.eventType,
        occurredAt: event.occurredAt,
        data: event.payload,
      });
    } catch (error) {
      this.logger.error(`Webhook failed: ${error.message}`);
      // Optional: Retry with exponential backoff
    }
  }
}
```

#### 4. Metrics Handler

```typescript
// src/infrastructure/events/handlers/metrics.event-handler.ts
@Injectable()
export class MetricsEventHandler {
  private readonly logger = new Logger(MetricsEventHandler.name);

  constructor(private readonly metricsService: MetricsService) {}

  /**
   * Track well activation metrics
   */
  @OnEvent('WellActivated', { async: true })
  async handleWellActivated(event: WellActivatedEvent): Promise<void> {
    // Increment counter
    this.metricsService.incrementCounter('wells.activated', {
      tenantId: event.tenantId,
    });

    // Track activation time
    this.metricsService.recordGauge('wells.total_active', 1, {
      tenantId: event.tenantId,
    });
  }
}
```

---

## Registering Event Handlers

Add your handler to `EventsModule`:

```typescript
// src/infrastructure/events/events.module.ts
@Global()
@Module({
  imports: [EventEmitterModule.forRoot({ /* config */ })],
  providers: [
    DomainEventPublisher,
    AuditLogEventHandler,       // Built-in
    NotificationEventHandler,   // Custom
    WebhookEventHandler,        // Custom
    MetricsEventHandler,        // Custom
  ],
  exports: [DomainEventPublisher],
})
export class EventsModule {}
```

---

## Event Patterns

### 1. Listen to Specific Event

```typescript
@OnEvent('WellActivated')
async handle(event: WellActivatedEvent) {
  // Only triggered by WellActivated events
}
```

### 2. Listen to Multiple Events

```typescript
@OnEvent('WellActivated')
@OnEvent('WellDeactivated')
async handle(event: WellActivatedEvent | WellDeactivatedEvent) {
  // Triggered by either event
}
```

### 3. Listen to All Well Events

```typescript
@OnEvent('Well.*')
async handle(event: IDomainEvent) {
  // Triggered by WellActivated, WellDeactivated, WellUpdated, etc.
}
```

### 4. Listen to All Events

```typescript
@OnEvent('**')
async handle(event: IDomainEvent) {
  // Triggered by ALL events (like AuditLogEventHandler)
}
```

---

## Common Domain Events

### Well Events
- `WellCreated` - New well added
- `WellActivated` - Well activated
- `WellDeactivated` - Well deactivated
- `WellUpdated` - Well details changed
- `WellDeleted` - Well soft-deleted

### Tenant Events
- `TenantCreated` - New tenant registered
- `TenantUpgraded` - Subscription tier upgraded
- `TenantDowngraded` - Subscription tier downgraded
- `TenantSuspended` - Tenant suspended
- `TenantDeleted` - Tenant soft-deleted

### User Events
- `UserRegistered` - New user registered
- `UserActivated` - User activated
- `UserSuspended` - User suspended
- `UserRoleChanged` - User role updated
- `UserPasswordChanged` - Password changed

### Field Data Events
- `FieldEntryCreated` - New field entry
- `FieldEntryUpdated` - Field entry modified
- `FieldEntrySynced` - Offline entry synced
- `PhotoAttached` - Photo added to entry

### Alert Events
- `AlertTriggered` - New alert triggered
- `AlertAcknowledged` - Alert acknowledged
- `AlertResolved` - Alert resolved

---

## Querying Audit Logs

### Get Entity History

```typescript
// Get all events for a well
const events = await auditLogHandler.getAggregateHistory(
  tenantId,
  'well-123',
  'Well',
);

// Reconstruct state from events
for (const event of events) {
  console.log(`${event.occurredAt}: ${event.eventType}`);
  console.log(event.payload);
}
```

### Get User Activity

```typescript
// Get all actions by a user in last 30 days
const startDate = new Date();
startDate.setDate(startDate.getDate() - 30);

const activity = await auditLogHandler.getUserActivity(
  tenantId,
  'user-456',
  startDate,
);

for (const event of activity) {
  console.log(`${event.occurredAt}: ${event.eventType} on ${event.aggregateType}:${event.aggregateId}`);
}
```

### Query via API

```typescript
@Controller('audit')
export class AuditController {
  constructor(
    private readonly auditLogHandler: AuditLogEventHandler,
  ) {}

  @Get('aggregates/:id/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getHistory(
    @TenantId() tenantId: string,
    @Param('id') aggregateId: string,
    @Query('type') aggregateType?: string,
  ) {
    return this.auditLogHandler.getAggregateHistory(
      tenantId,
      aggregateId,
      aggregateType,
    );
  }

  @Get('users/:id/activity')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getUserActivity(
    @TenantId() tenantId: string,
    @Param('id') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditLogHandler.getUserActivity(
      tenantId,
      userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
```

---

## Best Practices

### 1. Event Naming
- **Past tense**: `WellActivated` (not `ActivateWell`)
- **PascalCase**: `UserRegistered` (not `user_registered`)
- **Specific**: `WellActivated` (not `WellStatusChanged`)

### 2. Event Payload
- **Complete data**: Include all relevant information
- **Immutable**: Events should never change
- **No references**: Embed data, don't reference other entities
- **Flat structure**: Avoid deep nesting when possible

```typescript
// ✅ Good: Complete, embedded data
payload: {
  wellName: 'West Texas 42A',
  apiNumber: '42-123-12345',
  operator: 'Acme Oil',
  latitude: 31.5,
  longitude: -102.1,
}

// ❌ Bad: References that require lookups
payload: {
  wellId: 'well-123',  // Requires lookup to get well details
}
```

### 3. Error Handling
- **Never throw in handlers**: Log errors but don't break the workflow
- **Async handlers**: Use `{ async: true }` to avoid blocking
- **Idempotent handlers**: Design to handle duplicate events

```typescript
@OnEvent('WellActivated', { async: true })
async handle(event: WellActivatedEvent) {
  try {
    // Handler logic
  } catch (error) {
    this.logger.error(`Handler failed: ${error.message}`);
    // Don't throw - log and continue
  }
}
```

### 4. Event Versioning
- Add `version` to metadata
- Support multiple versions in handlers
- Migrate old events when necessary

```typescript
super(
  'WellActivated',
  tenantId,
  userId,
  wellId,
  'Well',
  payload,
  {
    source: 'domain',
    version: '2.0',  // Version for breaking changes
  },
);
```

---

## Testing

### Unit Tests

```typescript
describe('Well Entity', () => {
  it('should add WellActivatedEvent when activated', () => {
    const well = createWell({ status: 'INACTIVE' });

    well.activate('user-123');

    const events = well.getUncommittedEvents();
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('WellActivated');
    expect(events[0].userId).toBe('user-123');
  });
});
```

### Integration Tests

```typescript
describe('WellRepository (Integration)', () => {
  it('should publish events after save', async () => {
    const well = createWell({ status: 'INACTIVE' });
    well.activate('user-123');

    // Mock event publisher
    const publishSpy = jest.spyOn(eventPublisher, 'publishAll');

    await wellRepository.save(well);

    expect(publishSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ eventType: 'WellActivated' }),
      ]),
    );
  });
});
```

### E2E Tests

```typescript
describe('Well Activation (E2E)', () => {
  it('should create audit log when well activated', async () => {
    // Activate well via API
    await request(app.getHttpServer())
      .post('/wells/well-123/activate')
      .set('Authorization', `Bearer ${token}`)
      .send();

    // Check audit log
    const db = tenantDbService.getTenantDb(tenantId);
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.eventType, 'WellActivated'));

    expect(logs).toHaveLength(1);
    expect(logs[0].aggregateId).toBe('well-123');
  });
});
```

---

## Migration Guide

### Adding Events to Existing Entities

1. **Add event storage to entity**:
   ```typescript
   private uncommittedEvents: IDomainEvent[] = [];
   ```

2. **Add helper methods**:
   ```typescript
   private addEvent(event: IDomainEvent): void { /* ... */ }
   getUncommittedEvents(): IDomainEvent[] { /* ... */ }
   clearEvents(): void { /* ... */ }
   ```

3. **Add events to business methods**:
   ```typescript
   activate(userId: string): void {
     // ... business logic ...
     this.addEvent(new WellActivatedEvent(/* ... */));
   }
   ```

4. **Update repository to publish events**:
   ```typescript
   async save(entity: Entity): Promise<Entity> {
     const saved = await this.update(entity);
     const events = entity.getUncommittedEvents();
     await this.eventPublisher.publishAll(events);
     entity.clearEvents();
     return saved;
   }
   ```

---

## Troubleshooting

### Events Not Being Persisted

1. Check EventsModule is imported in app.module.ts
2. Verify AuditLogEventHandler is registered
3. Check database permissions
4. Look for errors in logs

### Handler Not Triggered

1. Verify handler is registered in EventsModule
2. Check `@OnEvent()` decorator has correct event type
3. Ensure handler method is `async`
4. Check for exceptions in handler (add try/catch)

### Duplicate Events

1. Ensure `clearEvents()` is called after publishing
2. Check repository doesn't call `save()` multiple times
3. Verify event handlers are idempotent

---

## Related Patterns

- **Event Sourcing**: See [docs/patterns/36-Event-Sourcing-Pattern.md](../patterns/36-Event-Sourcing-Pattern.md)
- **Observer Pattern**: See [docs/patterns/38-Observer-Pattern.md](../patterns/38-Observer-Pattern.md)
- **CQRS**: See [docs/patterns/35-CQRS-Pattern.md](../patterns/35-CQRS-Pattern.md)

---

## Summary

✅ **Define events** with DomainEvent base class (past tense, complete data)
✅ **Collect events** in entities during business operations
✅ **Publish events** in repositories after successful persistence
✅ **Handle events** with `@OnEvent()` decorators (async, error-safe)
✅ **Automatic audit trail** via AuditLogEventHandler
✅ **Query history** for compliance and debugging

Domain events provide a robust foundation for event-driven architecture, audit logging, and system integration across the WellPulse platform.
