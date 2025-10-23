# Domain Event Choreography Designer

Map domain events to handlers and visualize event-driven workflows.

Ensures event publishers have subscribers and identifies orphaned events.

## What This Command Shows

1. **Event Publishers**
   - Which entities/aggregates publish which events
   - When events are published (which methods)
   - Event payload structure

2. **Event Subscribers**
   - Handlers that listen to each event
   - What actions they perform
   - Execution order (if sequential)

3. **Event Flow**
   - Complete workflow from trigger to completion
   - Async vs sync handlers
   - Cascading events (events that trigger other events)

4. **Missing Handlers**
   - Events published but no subscribers
   - Handlers registered but events never published
   - Incomplete event coverage

## Usage

```bash
/events estimate.entity.ts
/events EstimateAcceptedEvent
/events apps/api/src/application/estimate/
/events --orphaned  # Find orphaned events
```

## Example Output

```text
📢 Domain Event Analysis: estimate.entity.ts

════════════════════════════════════════════════════════════════

EVENTS PUBLISHED (4 events):

1. EstimateCreatedEvent
   Published by: Estimate.create() (line 45)
   Payload: { estimateId, clientId, organizationId, createdBy, createdAt }

   Subscribers (2 handlers):
     ✓ SendWelcomeEmailHandler (application/email/handlers/)
       → Sends email notification to client
       → Execution time: ~500ms

     ✓ UpdateOrganizationHealthHandler (application/org-health/handlers/)
       → Tracks milestone: FIRST_ESTIMATE_CREATED
       → Execution time: ~50ms

   Flow:
     Estimate.create()
       → EstimateCreatedEvent published
         ├→ SendWelcomeEmailHandler (async)
         │    → EmailService.send()
         │    → AuditLog created
         └→ UpdateOrganizationHealthHandler (async)
              → OrganizationHealth.trackMilestone()

════════════════════════════════════════════════════════════════

2. EstimateSentEvent
   Published by: Estimate.send() (line 123)
   Payload: { estimateId, clientId, validUntil, sentBy, sentAt }

   Subscribers (3 handlers):
     ✓ SendEstimateEmailHandler (application/email/handlers/)
       → Sends estimate PDF to client via email
       → Includes acceptance link
       → Execution time: ~1200ms

     ✓ ScheduleExpirationCheckHandler (application/estimate/handlers/)
       → Schedules job to check if estimate expires
       → Uses BullMQ delayed job (runs at validUntil date)
       → Execution time: ~100ms

     ✓ AuditLogHandler (application/audit-log/handlers/)
       → Records estimate sent action
       → Execution time: ~50ms

   Flow:
     Estimate.send()
       → EstimateSentEvent published
         ├→ SendEstimateEmailHandler (async)
         │    → GenerateEstimatePdfService.generate()
         │    → EmailService.sendWithAttachment()
         │    → ClientPortalToken.create()
         ├→ ScheduleExpirationCheckHandler (async)
         │    → BullMQ.add('check-expiration', { estimateId }, { delay: validUntil })
         └→ AuditLogHandler (async)
              → AuditLog.create()

════════════════════════════════════════════════════════════════

3. EstimateAcceptedEvent
   Published by: Estimate.accept() (line 187)
   Payload: { estimateId, clientId, acceptedBy, acceptedAt, digitalSignature }

   Subscribers (4 handlers):
     ✓ SendAcceptanceConfirmationHandler (application/email/handlers/)
       → Emails client confirming acceptance
       → Execution time: ~500ms

     ✓ CreateProjectFromEstimateHandler (application/project/handlers/)
       → Automatically creates project from estimate
       → Uses Factory pattern
       → Publishes ProjectCreatedEvent
       → Execution time: ~300ms

     ✓ UpdateOrganizationHealthHandler (application/org-health/handlers/)
       → Tracks revenue milestone
       → Updates conversion rate metrics
       → Execution time: ~50ms

     ✓ NotifySalesTeamHandler (application/notification/handlers/)
       → Sends Slack notification to sales channel
       → Execution time: ~200ms

   Flow:
     Estimate.accept()
       → EstimateAcceptedEvent published
         ├→ SendAcceptanceConfirmationHandler (async)
         │    → EmailService.send()
         ├→ CreateProjectFromEstimateHandler (async)
         │    → ProjectFactory.createFromEstimate()
         │    → ProjectRepository.save()
         │    → ProjectCreatedEvent published ← CASCADING EVENT
         │         ├→ SendProjectKickoffEmailHandler
         │         ├→ CreateDefaultTasksHandler
         │         └→ AssignTeamMembersHandler
         ├→ UpdateOrganizationHealthHandler (async)
         │    → OrganizationHealth.trackRevenue()
         └→ NotifySalesTeamHandler (async)
              → SlackService.notify()

   ⚠️ Cascading Events Detected!
   EstimateAcceptedEvent → ProjectCreatedEvent → 3 more handlers
   Total handlers in chain: 7

════════════════════════════════════════════════════════════════

4. EstimateRejectedEvent
   Published by: Estimate.reject() (line 215)
   Payload: { estimateId, clientId, rejectionReason, rejectedAt }

   🔴 WARNING: No subscribers found!

   Event is published but no handlers are listening.

   Suggested handlers to implement:
     - SendRejectionFollowUpHandler
       → Email sales team about rejection
       → Opportunity for feedback/improvement

     - AnalyzeRejectionReasonsHandler
       → Track rejection patterns
       → Feed into business intelligence

     - UpdateConversionMetricsHandler
       → Update organization health metrics
       → Track rejection rate

════════════════════════════════════════════════════════════════

SUMMARY

Events Published: 4
Total Handlers: 9 unique handlers (13 total subscriptions)
Orphaned Events: 1 (EstimateRejectedEvent)
Cascading Events: 1 (EstimateAcceptedEvent → ProjectCreatedEvent)

Event Workflow Diagram:

Estimate Lifecycle Events:
  CREATE → SEND → ACCEPT/REJECT
    ↓       ↓        ↓
  Welcome  Email    Project + Notify
  Health   Expiry   Health
           Audit    Confirm

Performance Profile:
  - EstimateCreatedEvent: ~550ms total (2 handlers)
  - EstimateSentEvent: ~1350ms total (3 handlers, PDF generation)
  - EstimateAcceptedEvent: ~1050ms total (4 handlers + cascading)
  - EstimateRejectedEvent: 0ms (no handlers)

Recommendations:
  1. Add handlers for EstimateRejectedEvent
  2. Consider making PDF generation async (current bottleneck)
  3. Add retry logic for email handlers (transient failures)
  4. Add event versioning for future changes
  5. Implement event sourcing for audit trail
```

## Event Flow Visualization

```text
┌─────────────────────────────────────────────────────────────┐
│  EstimateAcceptedEvent Flow                                 │
└─────────────────────────────────────────────────────────────┘

USER ACTION: Client clicks "Accept Estimate" button
     ↓
[Estimate.accept()] ← Domain Entity Method
     ↓
{EstimateAcceptedEvent} ← Event Published (EventEmitter2)
     ↓
     ├─→ [SendAcceptanceConfirmationHandler] ⏱ 500ms
     │       ├─ Generate confirmation email
     │       ├─ EmailService.send()
     │       └─ ✅ Email sent
     │
     ├─→ [CreateProjectFromEstimateHandler] ⏱ 300ms
     │       ├─ ProjectFactory.createFromEstimate()
     │       │     ├─ Calculate weighted avg hourly rate
     │       │     ├─ Map estimate → project
     │       │     └─ Project.create()
     │       ├─ ProjectRepository.save()
     │       └─ {ProjectCreatedEvent} ← CASCADES!
     │               ├─→ SendProjectKickoffEmailHandler
     │               ├─→ CreateDefaultTasksHandler
     │               └─→ AssignTeamMembersHandler
     │
     ├─→ [UpdateOrganizationHealthHandler] ⏱ 50ms
     │       ├─ Calculate conversion rate
     │       ├─ Track revenue milestone
     │       └─ ✅ Metrics updated
     │
     └─→ [NotifySalesTeamHandler] ⏱ 200ms
             ├─ SlackService.notify('#sales')
             └─ ✅ Slack message sent

TOTAL: ~1050ms + cascading handlers
RESULT: Estimate accepted → Project created → Team notified
```

## Event Patterns

### ✅ Good: Domain Event

```typescript
// In domain entity
export class Estimate {
  accept(clientSignature: string, acceptedAt: Date): Estimate {
    // Business logic
    const accepted = new Estimate({
      ...this,
      status: EstimateStatus.ACCEPTED,
      acceptedAt,
      clientSignature,
    });

    // Publish domain event
    EventBus.publish(
      new EstimateAcceptedEvent({
        estimateId: this.id,
        clientId: this.clientId,
        acceptedBy: clientSignature,
        acceptedAt,
      }),
    );

    return accepted;
  }
}
```

### ✅ Good: Event Handler

```typescript
@EventHandler(EstimateAcceptedEvent)
export class CreateProjectFromEstimateHandler {
  constructor(
    private projectFactory: ProjectFactory,
    private projectRepository: IProjectRepository,
    private estimateRepository: IEstimateRepository,
  ) {}

  async handle(event: EstimateAcceptedEvent): Promise<void> {
    // Get estimate
    const estimate = await this.estimateRepository.findById(event.estimateId);

    // Create project using factory
    const project = await this.projectFactory.createFromEstimate(estimate);

    // Save project
    await this.projectRepository.save(project);

    // Mark estimate as converted
    const converted = estimate.markAsConverted(project.id);
    await this.estimateRepository.save(converted);
  }
}
```

### ❌ Bad: Missing Error Handling

```typescript
// ❌ No error handling - event handler failures are silent!
async handle(event: EstimateAcceptedEvent): Promise<void> {
  await this.emailService.send(...); // What if this fails?
  await this.projectRepository.save(...); // What if this fails?
}

// ✅ With error handling
async handle(event: EstimateAcceptedEvent): Promise<void> {
  try {
    await this.emailService.send(...);
  } catch (error) {
    this.logger.error('Failed to send acceptance email', {
      estimateId: event.estimateId,
      error: error.message,
    });
    // Don't throw - allow other handlers to continue
    // Or: Add to retry queue
  }
}
```

## Event Versioning

When changing event payloads:

```typescript
// V1: Original event
export class EstimateAcceptedEventV1 {
  constructor(
    public readonly estimateId: string,
    public readonly acceptedBy: string,
  ) {}
}

// V2: Added digital signature
export class EstimateAcceptedEventV2 {
  constructor(
    public readonly estimateId: string,
    public readonly acceptedBy: string,
    public readonly digitalSignature?: string, // Optional for backward compatibility
  ) {}
}

// Handler supports both versions
@EventHandler(EstimateAcceptedEventV1, EstimateAcceptedEventV2)
export class CreateProjectFromEstimateHandler {
  async handle(event: EstimateAcceptedEventV1 | EstimateAcceptedEventV2) {
    const signature = 'digitalSignature' in event ? event.digitalSignature : undefined;
    // Handle both versions
  }
}
```

## After Event Analysis

1. **Implement Missing Handlers**: For orphaned events
2. **Add Error Handling**: Wrap handlers in try-catch
3. **Add Retry Logic**: For transient failures (email, external APIs)
4. **Monitor Performance**: Track handler execution times
5. **Add Tests**: Test each handler in isolation
6. **Document Workflows**: Update docs with event flows
7. **Consider Event Sourcing**: For audit trail and replay
