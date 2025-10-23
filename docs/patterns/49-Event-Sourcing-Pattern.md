# Pattern 49: Event Sourcing Pattern

**Version**: 1.0
**Last Updated**: October 8, 2025
**Category**: Architecture & Data

---

## Table of Contents

1. [Overview](#overview)
2. [When to Use](#when-to-use)
3. [Core Concepts](#core-concepts)
4. [Event Store](#event-store)
5. [Event Stream](#event-stream)
6. [Projections](#projections)
7. [Snapshots](#snapshots)
8. [Event Versioning](#event-versioning)
9. [NestJS Implementation](#nestjs-implementation)
10. [CQRS Integration](#cqrs-integration)
11. [Replay and Time Travel](#replay-and-time-travel)
12. [Best Practices](#best-practices)
13. [Anti-Patterns](#anti-patterns)
14. [Related Patterns](#related-patterns)
15. [References](#references)

---

## Overview

**Event Sourcing** is a pattern where state changes are stored as a sequence of events rather than updating records in-place. Instead of storing the current state, you store all events that led to the current state.

**Traditional Approach** (CRUD):

```
User { id: 1, balance: 1000 }
// After deposit: User { id: 1, balance: 1500 }
// Lost: Who deposited? When? Why?
```

**Event Sourcing Approach**:

```
Events:
1. UserRegistered(userId: 1, initialBalance: 1000)
2. MoneyDeposited(userId: 1, amount: 500, by: "admin", reason: "bonus")

Current State: balance = 1000 + 500 = 1500
```

**Key Benefits**:

- 📜 **Complete audit trail** - Every change is recorded
- 🔙 **Time travel** - Reconstruct state at any point in time
- 🐛 **Debugging** - Understand exactly how state evolved
- 📊 **Analytics** - Rich historical data for reporting
- 🔄 **Event replay** - Rebuild state from scratch

**Use Cases in WellPulse**:

- **Time entry tracking** - Every edit, approval, billable status change
- **Invoice lifecycle** - Created, sent, paid, voided events
- **Project management** - Status changes, budget updates, team changes
- **Audit logging** - Compliance and security requirements

---

## When to Use

### ✅ Use Event Sourcing When:

1. **Audit trail is critical** - Compliance, legal requirements
   - Financial transactions (invoices, payments)
   - Time entry approvals
   - Contract changes

2. **Historical analysis is valuable** - Business intelligence
   - Project profitability trends over time
   - User behavior patterns
   - Resource utilization analytics

3. **State reconstruction is needed** - Debugging, support
   - "Show me the state of this project on March 15th"
   - "What was the invoice total before the last edit?"

4. **Event-driven workflows** - Integrate with external systems
   - Publish time approval event → QuickBooks sync
   - Publish invoice event → Email notification

### ❌ Don't Use Event Sourcing When:

1. **Simple CRUD is sufficient** - User preferences, static data
2. **Performance is critical** - High-frequency updates (>1000/sec per aggregate)
3. **Storage is expensive** - Events grow without bounds
4. **Team lacks experience** - Steep learning curve

---

## Core Concepts

### 1. Events

**Events** are immutable facts that represent something that happened.

```typescript
// apps/api/src/domain/time-entry/events/time-entry.events.ts
export class TimeEntryCreatedEvent {
  constructor(
    public readonly timeEntryId: string,
    public readonly userId: string,
    public readonly projectId: string,
    public readonly hours: number,
    public readonly date: Date,
    public readonly description: string,
    public readonly createdAt: Date,
  ) {}
}

export class TimeEntryHoursUpdatedEvent {
  constructor(
    public readonly timeEntryId: string,
    public readonly previousHours: number,
    public readonly newHours: number,
    public readonly updatedBy: string,
    public readonly reason: string,
    public readonly updatedAt: Date,
  ) {}
}

export class TimeEntryApprovedEvent {
  constructor(
    public readonly timeEntryId: string,
    public readonly approvedBy: string,
    public readonly approvedAt: Date,
  ) {}
}

export class TimeEntryMarkedBillableEvent {
  constructor(
    public readonly timeEntryId: string,
    public readonly billableRate: number,
    public readonly invoiceId?: string,
    public readonly markedAt: Date,
  ) {}
}
```

### 2. Aggregate

**Aggregate** is an entity that processes commands and emits events.

```typescript
// apps/api/src/domain/time-entry/time-entry.aggregate.ts
import { AggregateRoot } from '@nestjs/cqrs';

export class TimeEntryAggregate extends AggregateRoot {
  private id: string;
  private userId: string;
  private projectId: string;
  private hours: number;
  private date: Date;
  private description: string;
  private status: 'draft' | 'submitted' | 'approved' | 'rejected';
  private billable: boolean;
  private version: number = 0;

  constructor(id: string) {
    super();
    this.id = id;
  }

  // Command: Create time entry
  create(userId: string, projectId: string, hours: number, date: Date, description: string) {
    // Business rules validation
    if (hours <= 0 || hours > 24) {
      throw new Error('Hours must be between 0 and 24');
    }

    // Emit event
    this.apply(
      new TimeEntryCreatedEvent(this.id, userId, projectId, hours, date, description, new Date()),
    );
  }

  // Command: Update hours
  updateHours(newHours: number, updatedBy: string, reason: string) {
    if (this.status === 'approved') {
      throw new Error('Cannot update approved time entry');
    }

    if (newHours === this.hours) {
      return; // No change
    }

    this.apply(
      new TimeEntryHoursUpdatedEvent(this.id, this.hours, newHours, updatedBy, reason, new Date()),
    );
  }

  // Command: Approve
  approve(approvedBy: string) {
    if (this.status === 'approved') {
      throw new Error('Time entry already approved');
    }

    this.apply(new TimeEntryApprovedEvent(this.id, approvedBy, new Date()));
  }

  // Event handler: Apply TimeEntryCreatedEvent
  onTimeEntryCreatedEvent(event: TimeEntryCreatedEvent) {
    this.userId = event.userId;
    this.projectId = event.projectId;
    this.hours = event.hours;
    this.date = event.date;
    this.description = event.description;
    this.status = 'draft';
    this.billable = false;
    this.version++;
  }

  // Event handler: Apply TimeEntryHoursUpdatedEvent
  onTimeEntryHoursUpdatedEvent(event: TimeEntryHoursUpdatedEvent) {
    this.hours = event.newHours;
    this.version++;
  }

  // Event handler: Apply TimeEntryApprovedEvent
  onTimeEntryApprovedEvent(event: TimeEntryApprovedEvent) {
    this.status = 'approved';
    this.version++;
  }

  // Getters for current state
  getState() {
    return {
      id: this.id,
      userId: this.userId,
      projectId: this.projectId,
      hours: this.hours,
      date: this.date,
      description: this.description,
      status: this.status,
      billable: this.billable,
      version: this.version,
    };
  }
}
```

### 3. Event Store

**Event Store** persists and retrieves events.

---

## Event Store

### Event Store Schema

```typescript
// apps/api/src/infrastructure/database/schema/event-store.schema.ts
import { pgTable, text, jsonb, timestamp, integer, index } from 'drizzle-orm/pg-core';

export const events = pgTable(
  'events',
  {
    id: text('id').primaryKey(),
    aggregateId: text('aggregate_id').notNull(),
    aggregateType: text('aggregate_type').notNull(),
    eventType: text('event_type').notNull(),
    eventData: jsonb('event_data').notNull(),
    metadata: jsonb('metadata'),
    version: integer('version').notNull(),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
  },
  (table) => ({
    aggregateIdIdx: index('aggregate_id_idx').on(table.aggregateId),
    aggregateTypeIdx: index('aggregate_type_idx').on(table.aggregateType),
    timestampIdx: index('timestamp_idx').on(table.timestamp),
  }),
);
```

### Event Store Implementation

```typescript
// apps/api/src/infrastructure/event-store/event-store.service.ts
import { Injectable } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { events } from '../database/schema/event-store.schema';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export interface StoredEvent {
  id: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  eventData: any;
  metadata?: any;
  version: number;
  timestamp: Date;
}

@Injectable()
export class EventStoreService {
  constructor(private readonly db: typeof drizzle) {}

  async append(
    aggregateId: string,
    aggregateType: string,
    eventType: string,
    eventData: any,
    expectedVersion?: number,
  ): Promise<void> {
    // Optimistic concurrency control
    if (expectedVersion !== undefined) {
      const currentVersion = await this.getVersion(aggregateId);
      if (currentVersion !== expectedVersion) {
        throw new Error(
          `Concurrency conflict: expected version ${expectedVersion}, but current is ${currentVersion}`,
        );
      }
    }

    const nextVersion = expectedVersion !== undefined ? expectedVersion + 1 : 0;

    await this.db.insert(events).values({
      id: uuidv4(),
      aggregateId,
      aggregateType,
      eventType,
      eventData,
      metadata: {
        correlationId: this.getCorrelationId(),
        causationId: this.getCausationId(),
      },
      version: nextVersion,
      timestamp: new Date(),
    });
  }

  async getEvents(aggregateId: string, fromVersion: number = 0): Promise<StoredEvent[]> {
    return this.db
      .select()
      .from(events)
      .where(and(eq(events.aggregateId, aggregateId), gte(events.version, fromVersion)))
      .orderBy(events.version);
  }

  async getAllEvents(aggregateType?: string, fromTimestamp?: Date): Promise<StoredEvent[]> {
    const conditions = [];

    if (aggregateType) {
      conditions.push(eq(events.aggregateType, aggregateType));
    }

    if (fromTimestamp) {
      conditions.push(gte(events.timestamp, fromTimestamp));
    }

    return this.db
      .select()
      .from(events)
      .where(and(...conditions))
      .orderBy(events.timestamp);
  }

  async getVersion(aggregateId: string): Promise<number> {
    const result = await this.db
      .select({ version: events.version })
      .from(events)
      .where(eq(events.aggregateId, aggregateId))
      .orderBy(desc(events.version))
      .limit(1);

    return result[0]?.version ?? -1;
  }

  private getCorrelationId(): string {
    // Get from request context
    return requestContext.getStore()?.requestId || uuidv4();
  }

  private getCausationId(): string {
    // ID of the event that caused this event
    return uuidv4();
  }
}
```

---

## Event Stream

### Loading Aggregate from Events

```typescript
// apps/api/src/infrastructure/event-store/aggregate-repository.ts
import { Injectable } from '@nestjs/common';
import { EventStoreService } from './event-store.service';
import { TimeEntryAggregate } from '@/domain/time-entry/time-entry.aggregate';

@Injectable()
export class AggregateRepository {
  constructor(private readonly eventStore: EventStoreService) {}

  async load(AggregateClass: any, aggregateId: string): Promise<TimeEntryAggregate> {
    const aggregate = new AggregateClass(aggregateId);

    // Load events from event store
    const events = await this.eventStore.getEvents(aggregateId);

    // Replay events to rebuild state
    for (const event of events) {
      const eventInstance = this.deserializeEvent(event);
      aggregate.loadFromHistory([eventInstance]);
    }

    return aggregate;
  }

  async save(aggregate: TimeEntryAggregate, expectedVersion?: number): Promise<void> {
    const uncommittedEvents = aggregate.getUncommittedEvents();

    for (const event of uncommittedEvents) {
      await this.eventStore.append(
        aggregate.id,
        aggregate.constructor.name,
        event.constructor.name,
        event,
        expectedVersion,
      );
      expectedVersion = expectedVersion !== undefined ? expectedVersion + 1 : undefined;
    }

    aggregate.commit(); // Clear uncommitted events
  }

  private deserializeEvent(storedEvent: StoredEvent): any {
    // Map event type to event class
    const EventClass = this.getEventClass(storedEvent.eventType);
    return new EventClass(...Object.values(storedEvent.eventData));
  }

  private getEventClass(eventType: string): any {
    // Registry of event types
    const eventRegistry = {
      TimeEntryCreatedEvent,
      TimeEntryHoursUpdatedEvent,
      TimeEntryApprovedEvent,
      // ...
    };
    return eventRegistry[eventType];
  }
}
```

---

## Projections

**Projections** are read models built from events. They provide optimized query views.

### Projection Schema

```typescript
// apps/api/src/infrastructure/database/schema/time-entry-projection.schema.ts
export const timeEntryProjection = pgTable('time_entry_projection', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  projectId: text('project_id').notNull(),
  hours: real('hours').notNull(),
  date: timestamp('date').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull(),
  billable: boolean('billable').notNull().default(false),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at'),
  version: integer('version').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});
```

### Projection Builder

```typescript
// apps/api/src/application/time-entry/projections/time-entry-projection.handler.ts
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import {
  TimeEntryCreatedEvent,
  TimeEntryHoursUpdatedEvent,
  TimeEntryApprovedEvent,
} from '@/domain/time-entry/events/time-entry.events';

@EventsHandler(TimeEntryCreatedEvent)
export class TimeEntryCreatedProjectionHandler implements IEventHandler<TimeEntryCreatedEvent> {
  constructor(private readonly db: typeof drizzle) {}

  async handle(event: TimeEntryCreatedEvent) {
    await this.db.insert(timeEntryProjection).values({
      id: event.timeEntryId,
      userId: event.userId,
      projectId: event.projectId,
      hours: event.hours,
      date: event.date,
      description: event.description,
      status: 'draft',
      billable: false,
      version: 0,
      updatedAt: event.createdAt,
    });
  }
}

@EventsHandler(TimeEntryHoursUpdatedEvent)
export class TimeEntryHoursUpdatedProjectionHandler
  implements IEventHandler<TimeEntryHoursUpdatedEvent>
{
  constructor(private readonly db: typeof drizzle) {}

  async handle(event: TimeEntryHoursUpdatedEvent) {
    await this.db
      .update(timeEntryProjection)
      .set({
        hours: event.newHours,
        version: sql`${timeEntryProjection.version} + 1`,
        updatedAt: event.updatedAt,
      })
      .where(eq(timeEntryProjection.id, event.timeEntryId));
  }
}

@EventsHandler(TimeEntryApprovedEvent)
export class TimeEntryApprovedProjectionHandler implements IEventHandler<TimeEntryApprovedEvent> {
  constructor(private readonly db: typeof drizzle) {}

  async handle(event: TimeEntryApprovedEvent) {
    await this.db
      .update(timeEntryProjection)
      .set({
        status: 'approved',
        approvedBy: event.approvedBy,
        approvedAt: event.approvedAt,
        version: sql`${timeEntryProjection.version} + 1`,
        updatedAt: event.approvedAt,
      })
      .where(eq(timeEntryProjection.id, event.timeEntryId));
  }
}
```

---

## Snapshots

**Snapshots** optimize aggregate loading by storing periodic state checkpoints.

### Snapshot Schema

```typescript
// apps/api/src/infrastructure/database/schema/snapshot.schema.ts
export const snapshots = pgTable('snapshots', {
  aggregateId: text('aggregate_id').primaryKey(),
  aggregateType: text('aggregate_type').notNull(),
  state: jsonb('state').notNull(),
  version: integer('version').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
});
```

### Snapshot Service

```typescript
// apps/api/src/infrastructure/event-store/snapshot.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class SnapshotService {
  private readonly snapshotInterval = 10; // Snapshot every 10 events

  constructor(private readonly db: typeof drizzle) {}

  async save(
    aggregateId: string,
    aggregateType: string,
    state: any,
    version: number,
  ): Promise<void> {
    await this.db
      .insert(snapshots)
      .values({
        aggregateId,
        aggregateType,
        state,
        version,
        timestamp: new Date(),
      })
      .onConflictDoUpdate({
        target: snapshots.aggregateId,
        set: {
          state,
          version,
          timestamp: new Date(),
        },
      });
  }

  async load(aggregateId: string): Promise<{ state: any; version: number } | null> {
    const result = await this.db
      .select()
      .from(snapshots)
      .where(eq(snapshots.aggregateId, aggregateId))
      .limit(1);

    return result[0] ? { state: result[0].state, version: result[0].version } : null;
  }

  shouldCreateSnapshot(version: number): boolean {
    return version % this.snapshotInterval === 0;
  }
}
```

### Loading with Snapshot

```typescript
// Enhanced aggregate loading with snapshots
async load(AggregateClass: any, aggregateId: string): Promise<TimeEntryAggregate> {
  const aggregate = new AggregateClass(aggregateId);

  // Try to load snapshot
  const snapshot = await this.snapshotService.load(aggregateId);

  let fromVersion = 0;
  if (snapshot) {
    // Restore state from snapshot
    aggregate.loadFromSnapshot(snapshot.state, snapshot.version);
    fromVersion = snapshot.version + 1;
  }

  // Load events since snapshot
  const events = await this.eventStore.getEvents(aggregateId, fromVersion);

  // Replay events
  for (const event of events) {
    const eventInstance = this.deserializeEvent(event);
    aggregate.loadFromHistory([eventInstance]);
  }

  return aggregate;
}

async save(aggregate: TimeEntryAggregate): Promise<void> {
  const uncommittedEvents = aggregate.getUncommittedEvents();

  for (const event of uncommittedEvents) {
    await this.eventStore.append(/* ... */);
  }

  // Create snapshot if needed
  const version = aggregate.getVersion();
  if (this.snapshotService.shouldCreateSnapshot(version)) {
    await this.snapshotService.save(
      aggregate.id,
      aggregate.constructor.name,
      aggregate.getState(),
      version,
    );
  }

  aggregate.commit();
}
```

---

## Event Versioning

Handle schema changes in events over time.

### Upcasting Strategy

```typescript
// apps/api/src/infrastructure/event-store/event-upcaster.ts
import { Injectable } from '@nestjs/common';

interface EventUpcaster {
  canUpcast(event: any): boolean;
  upcast(event: any): any;
}

// Example: TimeEntryCreatedEvent v1 → v2 (added 'billableRate' field)
class TimeEntryCreatedEventV1ToV2Upcaster implements EventUpcaster {
  canUpcast(event: any): boolean {
    return event.eventType === 'TimeEntryCreatedEvent' && event.version === 1;
  }

  upcast(event: any): any {
    return {
      ...event,
      eventData: {
        ...event.eventData,
        billableRate: 0, // Default value for old events
      },
      version: 2,
    };
  }
}

@Injectable()
export class EventUpcasterService {
  private upcasters: EventUpcaster[] = [
    new TimeEntryCreatedEventV1ToV2Upcaster(),
    // Add more upcasters as schema evolves
  ];

  upcast(event: any): any {
    let upcastedEvent = event;

    for (const upcaster of this.upcasters) {
      if (upcaster.canUpcast(upcastedEvent)) {
        upcastedEvent = upcaster.upcast(upcastedEvent);
      }
    }

    return upcastedEvent;
  }
}
```

---

## NestJS Implementation

### Complete Command Handler

```typescript
// apps/api/src/application/time-entry/commands/create-time-entry.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateTimeEntryCommand } from './create-time-entry.command';
import { AggregateRepository } from '@/infrastructure/event-store/aggregate-repository';
import { TimeEntryAggregate } from '@/domain/time-entry/time-entry.aggregate';

@CommandHandler(CreateTimeEntryCommand)
export class CreateTimeEntryHandler implements ICommandHandler<CreateTimeEntryCommand> {
  constructor(private readonly repository: AggregateRepository) {}

  async execute(command: CreateTimeEntryCommand) {
    const { timeEntryId, userId, projectId, hours, date, description } = command;

    // Create new aggregate
    const aggregate = new TimeEntryAggregate(timeEntryId);

    // Execute command (emits events)
    aggregate.create(userId, projectId, hours, date, description);

    // Save events to event store
    await this.repository.save(aggregate);

    return { timeEntryId };
  }
}
```

---

## CQRS Integration

Event Sourcing pairs perfectly with CQRS.

**Commands** → Modify aggregates → Emit events → Store in event store
**Queries** → Read from projections (read models)

```typescript
// Command (Write)
await commandBus.execute(
  new CreateTimeEntryCommand(id, userId, projectId, hours, date, description),
);

// Query (Read) - Uses projection
const timeEntries = await queryBus.execute(new GetTimeEntriesQuery(userId, startDate, endDate));
```

---

## Replay and Time Travel

### Rebuild Projections

```typescript
// apps/api/src/infrastructure/event-store/projection-rebuilder.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class ProjectionRebuilderService {
  constructor(
    private readonly eventStore: EventStoreService,
    private readonly db: typeof drizzle,
  ) {}

  async rebuildTimeEntryProjection(): Promise<void> {
    // Clear existing projection
    await this.db.delete(timeEntryProjection);

    // Get all events
    const events = await this.eventStore.getAllEvents('TimeEntryAggregate');

    // Replay events to rebuild projection
    for (const event of events) {
      await this.applyEventToProjection(event);
    }

    console.log(`Rebuilt projection with ${events.length} events`);
  }

  private async applyEventToProjection(event: StoredEvent): Promise<void> {
    // Deserialize and apply event to projection
    const eventInstance = this.deserializeEvent(event);
    const handler = this.getProjectionHandler(event.eventType);
    await handler.handle(eventInstance);
  }
}
```

### Time Travel Query

```typescript
// Get state at specific point in time
async getTimeEntryStateAt(timeEntryId: string, timestamp: Date): Promise<any> {
  const events = await this.eventStore.getEvents(timeEntryId);

  // Filter events up to timestamp
  const historicalEvents = events.filter((e) => e.timestamp <= timestamp);

  // Rebuild aggregate from historical events
  const aggregate = new TimeEntryAggregate(timeEntryId);
  for (const event of historicalEvents) {
    const eventInstance = this.deserializeEvent(event);
    aggregate.loadFromHistory([eventInstance]);
  }

  return aggregate.getState();
}
```

---

## Best Practices

### ✅ DO

1. **Use descriptive event names** - Past tense, business language

   ```typescript
   (TimeEntryApproved, InvoiceSent, ProjectCompleted);
   ```

2. **Make events immutable** - Never change event data

   ```typescript
   readonly properties only
   ```

3. **Version events** - Schema evolution

   ```typescript
   TimeEntryCreatedEventV2, upcasters for migration
   ```

4. **Keep aggregates small** - Max ~100-1000 events

   ```typescript
   Use snapshots, split large aggregates
   ```

5. **Use projections for queries** - Don't query event store

   ```typescript
   Read from denormalized projections
   ```

6. **Include metadata** - Correlation ID, causation ID, user ID
   ```typescript
   {
     (correlationId, causationId, userId, timestamp);
   }
   ```

---

### ❌ DON'T

1. **Don't delete events** - Events are immutable history

   ```typescript
   // ❌ Bad: Delete event
   await eventStore.delete(eventId);

   // ✅ Good: Emit compensating event
   aggregate.apply(new TimeEntryDeletedEvent(id));
   ```

2. **Don't query event store for reads** - Use projections

   ```typescript
   // ❌ Bad: Query events for listing
   const events = await eventStore.getAllEvents();

   // ✅ Good: Query projection
   const entries = await db.select().from(timeEntryProjection);
   ```

3. **Don't store large data in events** - Keep events small

   ```typescript
   // ❌ Bad: Store file contents
   new DocumentUploadedEvent(documentId, fileContents);

   // ✅ Good: Store reference
   new DocumentUploadedEvent(documentId, fileUrl);
   ```

---

## Anti-Patterns

### 1. Event Store as Query Database

```typescript
// ❌ Anti-pattern: Query event store for reports
async getTimeEntryReport(userId: string) {
  const events = await eventStore.getAllEvents('TimeEntryAggregate');
  // Complex filtering and aggregation...
}

// ✅ Solution: Use projection
async getTimeEntryReport(userId: string) {
  return db.select().from(timeEntryProjection).where(eq(userId));
}
```

### 2. Mutable Events

```typescript
// ❌ Anti-pattern: Modify event data
event.hours = 10;

// ✅ Solution: Emit new event
aggregate.updateHours(10, userId, reason);
```

---

## Related Patterns

- **Pattern 05: CQRS Pattern** - Separates commands and queries
- **Pattern 11: Domain Events Pattern** - Events within domain layer
- **Pattern 47: Monitoring & Observability Patterns** - Event streaming for analytics

---

## References

### Books

- **"Implementing Domain-Driven Design"** by Vaughn Vernon
- **"Versioning in an Event Sourced System"** by Greg Young
- **"Event Sourcing Basics"** - Microsoft Architecture Guide

### Libraries

- **EventStore** - Purpose-built event store database
- **Axon Framework** - Event sourcing for Java
- **NestJS CQRS** - CQRS and Event Sourcing for NestJS

---

## Summary

**Event Sourcing** stores all changes as events rather than current state:

✅ **Complete audit trail** - Every change is recorded
✅ **Time travel** - Reconstruct state at any point
✅ **Event-driven architecture** - Publish events for integration
✅ **Debugging** - Understand exactly what happened
✅ **Projections** - Optimized read models
✅ **Snapshots** - Performance optimization for large event streams

**Remember**: Event Sourcing adds complexity. Use it when audit trail, time travel, or event-driven workflows are critical. For simple CRUD, stick with traditional approach.

---

**Next Steps**:

1. Identify aggregates suitable for event sourcing (invoices, time entries)
2. Design event schema and event store
3. Implement aggregate root with event replay
4. Build projections for queries
5. Add snapshots for performance
6. Set up event versioning strategy
