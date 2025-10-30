/**
 * Domain Event Interface
 *
 * Base interface for all domain events in the system.
 * Domain events represent significant business occurrences that have already happened.
 *
 * Key Principles:
 * - Events are **immutable** (readonly properties)
 * - Events are **past tense** (WellActivated, not ActivateWell)
 * - Events contain **all relevant data** (no need to query)
 * - Events are **timestamped** (when did it happen?)
 * - Events include **actor** (who triggered it?)
 *
 * Event Flow:
 * 1. Domain entity performs business logic
 * 2. Entity adds event to its internal collection
 * 3. Repository publishes events after successful persistence
 * 4. Event handlers react (audit log, notifications, etc.)
 *
 * Benefits:
 * - Audit trail: Complete history of what happened
 * - Decoupling: Handlers don't pollute domain logic
 * - Event sourcing: Can reconstruct state from events
 * - Integration: Events can trigger external systems
 */

export interface IDomainEvent {
  /**
   * Unique event identifier
   */
  readonly eventId: string;

  /**
   * Event type (e.g., 'WellActivated', 'TenantCreated')
   * Use PascalCase and past tense
   */
  readonly eventType: string;

  /**
   * When the event occurred (business time, not technical time)
   */
  readonly occurredAt: Date;

  /**
   * Tenant ID (for multi-tenant event filtering)
   * Null for cross-tenant events (e.g., TenantCreated)
   */
  readonly tenantId: string | null;

  /**
   * User who triggered the event (for audit trail)
   * Null for system-generated events
   */
  readonly userId: string | null;

  /**
   * Aggregate ID (e.g., well ID, tenant ID)
   */
  readonly aggregateId: string;

  /**
   * Aggregate type (e.g., 'Well', 'Tenant', 'User')
   */
  readonly aggregateType: string;

  /**
   * Event payload (specific data for this event)
   */
  readonly payload: Record<string, unknown>;

  /**
   * Event metadata (correlation ID, source system, etc.)
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Base Domain Event class
 * Provides default implementation with auto-generated ID and timestamp
 */
export abstract class DomainEvent implements IDomainEvent {
  public readonly eventId: string;
  public readonly occurredAt: Date;

  constructor(
    public readonly eventType: string,
    public readonly tenantId: string | null,
    public readonly userId: string | null,
    public readonly aggregateId: string,
    public readonly aggregateType: string,
    public readonly payload: Record<string, unknown>,
    public readonly metadata?: Record<string, unknown>,
  ) {
    this.eventId = this.generateEventId();
    this.occurredAt = new Date();
  }

  /**
   * Generate unique event ID
   * Format: evt_{timestamp}_{random}
   */
  private generateEventId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `evt_${timestamp}_${random}`;
  }
}
