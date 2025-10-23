# Observer Pattern

## Overview

The Observer pattern defines a one-to-many dependency between objects so that
when one object changes state, all its dependents are notified and updated
automatically. It promotes loose coupling between the subject (observable) and
its observers, allowing for flexible event-driven architectures.

## Core Concepts

### Subject (Observable)

The object being watched that maintains a list of observers and notifies them of
state changes.

### Observer

The interface that defines how objects should be notified of changes in the
subject.

### Concrete Observer

Specific implementations that react to notifications from the subject.

### Event-Driven Communication

Decoupled communication where observers respond to events without tight coupling
to the subject.

## Benefits

- **Loose Coupling**: Subjects and observers are loosely coupled
- **Dynamic Relationships**: Observers can be added/removed at runtime
- **Event-Driven Architecture**: Supports reactive programming patterns
- **Single Responsibility**: Each observer handles specific concerns
- **Open/Closed Principle**: New observers can be added without modifying
  existing code
- **Broadcast Communication**: One subject can notify many observers

## Implementation in Our Project

### Before: Tightly Coupled Notifications

```typescript
@Injectable()
export class VendorService {
  constructor(
    private readonly vendorRepository: VendorRepository,
    private readonly notificationService: NotificationService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    private readonly integrationService: IntegrationService,
  ) {}

  async activateVendor(vendorId: string, userId: string): Promise<void> {
    const vendor = await this.vendorRepository.findById(vendorId);

    if (!vendor) {
      throw new VendorNotFoundError(vendorId);
    }

    vendor.activate();
    await this.vendorRepository.save(vendor);

    // Tightly coupled side effects - all handled directly in service
    try {
      // Send notification
      await this.notificationService.notify('VENDOR_ACTIVATED', {
        vendorId,
        vendorName: vendor.getName(),
      });
    } catch (error) {
      // Log error but don't fail the main operation
      console.error('Failed to send notification', error);
    }

    try {
      // Create audit entry
      await this.auditService.createAuditEntry({
        action: 'VENDOR_ACTIVATED',
        entityId: vendorId,
        entityType: 'Vendor',
        userId,
        timestamp: new Date(),
        details: { vendorName: vendor.getName() },
      });
    } catch (error) {
      console.error('Failed to create audit entry', error);
    }

    try {
      // Send email to vendor
      await this.emailService.sendEmail({
        to: vendor.getContactEmail(),
        subject: 'Your vendor account has been activated',
        template: 'vendor-activated',
        data: { vendorName: vendor.getName() },
      });
    } catch (error) {
      console.error('Failed to send email', error);
    }

    try {
      // Update external systems
      await this.integrationService.updateVendorStatus(vendorId, 'ACTIVE');
    } catch (error) {
      console.error('Failed to update external systems', error);
    }

    // More side effects...
  }

  async updateVendorInsurance(
    vendorId: string,
    insurance: InsuranceData,
    userId: string,
  ): Promise<void> {
    const vendor = await this.vendorRepository.findById(vendorId);

    if (!vendor) {
      throw new VendorNotFoundError(vendorId);
    }

    const oldInsurance = vendor.getInsurance();
    vendor.updateInsurance(new Insurance(insurance));
    await this.vendorRepository.save(vendor);

    // Duplicate notification logic
    try {
      await this.notificationService.notify('VENDOR_INSURANCE_UPDATED', {
        vendorId,
        vendorName: vendor.getName(),
      });
    } catch (error) {
      console.error('Failed to send notification', error);
    }

    try {
      await this.auditService.createAuditEntry({
        action: 'VENDOR_INSURANCE_UPDATED',
        entityId: vendorId,
        entityType: 'Vendor',
        userId,
        timestamp: new Date(),
        details: {
          vendorName: vendor.getName(),
          oldInsurance: oldInsurance?.toPlain(),
          newInsurance: insurance,
        },
      });
    } catch (error) {
      console.error('Failed to create audit entry', error);
    }

    // Insurance-specific notifications
    try {
      if (this.isInsuranceExpiringSoon(vendor.getInsurance())) {
        await this.notificationService.notify('INSURANCE_EXPIRING_SOON', {
          vendorId,
          expiryDate: vendor.getInsurance().getExpiryDate(),
        });
      }
    } catch (error) {
      console.error('Failed to check insurance expiry', error);
    }
  }
}
```

### After: Observer Pattern Implementation

```typescript
// Observer interface
export interface IVendorObserver {
  onVendorActivated(event: VendorActivatedEvent): Promise<void>;
  onVendorDeactivated(event: VendorDeactivatedEvent): Promise<void>;
  onVendorInsuranceUpdated(event: VendorInsuranceUpdatedEvent): Promise<void>;
  onVendorCreated(event: VendorCreatedEvent): Promise<void>;
}

// Base observer with selective handling
export abstract class BaseVendorObserver implements IVendorObserver {
  async onVendorActivated(event: VendorActivatedEvent): Promise<void> {
    // Override in concrete observers if needed
  }

  async onVendorDeactivated(event: VendorDeactivatedEvent): Promise<void> {
    // Override in concrete observers if needed
  }

  async onVendorInsuranceUpdated(event: VendorInsuranceUpdatedEvent): Promise<void> {
    // Override in concrete observers if needed
  }

  async onVendorCreated(event: VendorCreatedEvent): Promise<void> {
    // Override in concrete observers if needed
  }
}

// Concrete observers
@Injectable()
export class VendorNotificationObserver extends BaseVendorObserver {
  constructor(private readonly notificationService: INotificationService) {
    super();
  }

  async onVendorActivated(event: VendorActivatedEvent): Promise<void> {
    await this.notificationService.notify('VENDOR_ACTIVATED', {
      vendorId: event.vendorId,
      vendorName: event.vendorName,
      organizationId: event.organizationId,
    });
  }

  async onVendorInsuranceUpdated(event: VendorInsuranceUpdatedEvent): Promise<void> {
    await this.notificationService.notify('VENDOR_INSURANCE_UPDATED', {
      vendorId: event.vendorId,
      vendorName: event.vendorName,
      expiryDate: event.newInsurance.expiryDate,
    });

    // Check for expiring insurance
    if (this.isInsuranceExpiringSoon(event.newInsurance)) {
      await this.notificationService.notify('INSURANCE_EXPIRING_SOON', {
        vendorId: event.vendorId,
        expiryDate: event.newInsurance.expiryDate,
      });
    }
  }

  private isInsuranceExpiringSoon(insurance: InsuranceData): boolean {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return new Date(insurance.expiryDate) <= thirtyDaysFromNow;
  }
}

@Injectable()
export class VendorAuditObserver extends BaseVendorObserver {
  constructor(private readonly auditService: IAuditService) {
    super();
  }

  async onVendorActivated(event: VendorActivatedEvent): Promise<void> {
    await this.auditService.createAuditEntry({
      action: 'VENDOR_ACTIVATED',
      entityId: event.vendorId,
      entityType: 'Vendor',
      userId: event.userId,
      timestamp: event.occurredAt,
      details: {
        vendorName: event.vendorName,
        organizationId: event.organizationId,
      },
    });
  }

  async onVendorCreated(event: VendorCreatedEvent): Promise<void> {
    await this.auditService.createAuditEntry({
      action: 'VENDOR_CREATED',
      entityId: event.vendorId,
      entityType: 'Vendor',
      userId: event.userId,
      timestamp: event.occurredAt,
      details: {
        vendorName: event.vendorName,
        vendorCode: event.vendorCode,
        organizationId: event.organizationId,
      },
    });
  }

  async onVendorInsuranceUpdated(event: VendorInsuranceUpdatedEvent): Promise<void> {
    await this.auditService.createAuditEntry({
      action: 'VENDOR_INSURANCE_UPDATED',
      entityId: event.vendorId,
      entityType: 'Vendor',
      userId: event.userId,
      timestamp: event.occurredAt,
      details: {
        vendorName: event.vendorName,
        oldInsurance: event.oldInsurance,
        newInsurance: event.newInsurance,
      },
    });
  }
}

@Injectable()
export class VendorEmailObserver extends BaseVendorObserver {
  constructor(private readonly emailService: IEmailService) {
    super();
  }

  async onVendorActivated(event: VendorActivatedEvent): Promise<void> {
    if (!event.contactEmail) {
      return; // No email to send to
    }

    await this.emailService.sendEmail({
      to: event.contactEmail,
      subject: 'Your vendor account has been activated',
      template: 'vendor-activated',
      data: {
        vendorName: event.vendorName,
        activationDate: event.occurredAt,
      },
    });
  }

  async onVendorCreated(event: VendorCreatedEvent): Promise<void> {
    if (!event.contactEmail) {
      return;
    }

    await this.emailService.sendEmail({
      to: event.contactEmail,
      subject: 'Welcome to our vendor network',
      template: 'vendor-welcome',
      data: {
        vendorName: event.vendorName,
        vendorCode: event.vendorCode,
      },
    });
  }
}

@Injectable()
export class VendorIntegrationObserver extends BaseVendorObserver {
  constructor(private readonly integrationService: IIntegrationService) {
    super();
  }

  async onVendorActivated(event: VendorActivatedEvent): Promise<void> {
    await this.integrationService.updateVendorStatus(event.vendorId, 'ACTIVE');
  }

  async onVendorDeactivated(event: VendorDeactivatedEvent): Promise<void> {
    await this.integrationService.updateVendorStatus(event.vendorId, 'INACTIVE');
  }

  async onVendorCreated(event: VendorCreatedEvent): Promise<void> {
    await this.integrationService.syncNewVendor({
      vendorId: event.vendorId,
      vendorName: event.vendorName,
      vendorCode: event.vendorCode,
      organizationId: event.organizationId,
    });
  }
}

// Subject (Observable) - Event Publisher
@Injectable()
export class VendorEventPublisher {
  private observers: IVendorObserver[] = [];

  addObserver(observer: IVendorObserver): void {
    this.observers.push(observer);
  }

  removeObserver(observer: IVendorObserver): void {
    const index = this.observers.indexOf(observer);
    if (index > -1) {
      this.observers.splice(index, 1);
    }
  }

  async publishVendorActivated(event: VendorActivatedEvent): Promise<void> {
    await this.notifyObservers((observer) => observer.onVendorActivated(event));
  }

  async publishVendorCreated(event: VendorCreatedEvent): Promise<void> {
    await this.notifyObservers((observer) => observer.onVendorCreated(event));
  }

  async publishVendorInsuranceUpdated(event: VendorInsuranceUpdatedEvent): Promise<void> {
    await this.notifyObservers((observer) => observer.onVendorInsuranceUpdated(event));
  }

  private async notifyObservers(
    notification: (observer: IVendorObserver) => Promise<void>,
  ): Promise<void> {
    // Notify observers in parallel but handle errors gracefully
    const promises = this.observers.map(async (observer) => {
      try {
        await notification(observer);
      } catch (error) {
        console.error('Observer notification failed', {
          observer: observer.constructor.name,
          error: error.message,
        });
        // Don't let observer failures affect the main flow
      }
    });

    await Promise.allSettled(promises);
  }
}

// Clean service using Observer pattern
@Injectable()
export class VendorService {
  constructor(
    private readonly vendorRepository: IVendorRepository,
    private readonly eventPublisher: VendorEventPublisher,
  ) {}

  async activateVendor(vendorId: string, userId: string): Promise<void> {
    const vendor = await this.vendorRepository.findById(new VendorId(vendorId));

    if (!vendor) {
      throw new VendorNotFoundError(vendorId);
    }

    vendor.activate();
    await this.vendorRepository.save(vendor);

    // Single responsibility: just publish the event
    const event = new VendorActivatedEvent(
      vendorId,
      vendor.getName().getValue(),
      vendor.getOrganizationId(),
      vendor.getContactInfo().getEmail()?.getValue(),
      userId,
      new Date(),
    );

    await this.eventPublisher.publishVendorActivated(event);
  }

  async updateVendorInsurance(
    vendorId: string,
    insurance: InsuranceData,
    userId: string,
  ): Promise<void> {
    const vendor = await this.vendorRepository.findById(new VendorId(vendorId));

    if (!vendor) {
      throw new VendorNotFoundError(vendorId);
    }

    const oldInsurance = vendor.getInsurance()?.toPlain();
    vendor.updateInsurance(new Insurance(insurance));
    await this.vendorRepository.save(vendor);

    const event = new VendorInsuranceUpdatedEvent(
      vendorId,
      vendor.getName().getValue(),
      vendor.getOrganizationId(),
      oldInsurance,
      insurance,
      userId,
      new Date(),
    );

    await this.eventPublisher.publishVendorInsuranceUpdated(event);
  }
}

// Event classes
export class VendorActivatedEvent {
  constructor(
    public readonly vendorId: string,
    public readonly vendorName: string,
    public readonly organizationId: string,
    public readonly contactEmail: string | undefined,
    public readonly userId: string,
    public readonly occurredAt: Date,
  ) {}
}

export class VendorCreatedEvent {
  constructor(
    public readonly vendorId: string,
    public readonly vendorName: string,
    public readonly vendorCode: string,
    public readonly organizationId: string,
    public readonly contactEmail: string | undefined,
    public readonly userId: string,
    public readonly occurredAt: Date,
  ) {}
}

export class VendorInsuranceUpdatedEvent {
  constructor(
    public readonly vendorId: string,
    public readonly vendorName: string,
    public readonly organizationId: string,
    public readonly oldInsurance: InsuranceData | undefined,
    public readonly newInsurance: InsuranceData,
    public readonly userId: string,
    public readonly occurredAt: Date,
  ) {}
}
```

## Advanced Observer Patterns

### Event-Driven Domain Events

```typescript
// Domain Event Observer using NestJS Event Emitter
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class LosEventObserver {
  constructor(
    private readonly notificationService: INotificationService,
    private readonly reportService: IReportService,
  ) {}

  @OnEvent('los.finalized')
  async handleLosFinalized(event: LosFinalizedEvent): Promise<void> {
    // Generate finalization report
    await this.reportService.generateFinalizationReport(event.losId);

    // Notify stakeholders
    await this.notificationService.notifyLosFinalized({
      losId: event.losId,
      leaseId: event.leaseId,
      totalExpenses: event.totalExpenses,
      finalizedBy: event.userId,
    });
  }

  @OnEvent('los.expense.added')
  async handleExpenseAdded(event: LosExpenseAddedEvent): Promise<void> {
    // Check if expense needs approval
    if (event.amount > 10000) {
      await this.notificationService.notifyExpenseRequiresApproval({
        losId: event.losId,
        expenseId: event.expenseId,
        amount: event.amount,
        description: event.description,
      });
    }
  }

  @OnEvent('los.distributed')
  async handleLosDistributed(event: LosDistributedEvent): Promise<void> {
    // Send distribution notifications to partners
    for (const partner of event.partners) {
      await this.notificationService.notifyPartnerLosDistribution({
        partnerId: partner.id,
        losId: event.losId,
        allocation: partner.allocation,
        amount: partner.amount,
      });
    }
  }
}

// Domain events in entities
export class LeaseOperatingStatement {
  // ... entity properties

  finalize(userId: string): void {
    if (this.status !== LosStatus.DRAFT) {
      throw new LosDomainError('Only draft LOS can be finalized');
    }

    this.status = LosStatus.FINALIZED;
    this.finalizedAt = new Date();
    this.finalizedBy = userId;

    // Emit domain event
    this.addDomainEvent(
      new LosFinalizedEvent(
        this.id.getValue(),
        this.leaseId,
        this.totalExpenses.getAmount(),
        userId,
        new Date(),
      ),
    );
  }

  addExpense(expense: ExpenseLineItem, userId: string): void {
    this.expenseLineItems.push(expense);
    this.recalculateTotals();

    // Emit domain event
    this.addDomainEvent(
      new LosExpenseAddedEvent(
        this.id.getValue(),
        expense.getId().getValue(),
        expense.getAmount().getAmount(),
        expense.getDescription(),
        userId,
        new Date(),
      ),
    );
  }

  private addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  getDomainEvents(): readonly DomainEvent[] {
    return this.domainEvents;
  }

  clearDomainEvents(): void {
    this.domainEvents.length = 0;
  }
}
```

### Observer with Filtering

```typescript
// Observer interface with filtering capability
export interface IFilterableVendorObserver extends IVendorObserver {
  shouldHandle(event: VendorEvent): boolean;
}

// Filtered observer
@Injectable()
export class HighValueVendorObserver implements IFilterableVendorObserver {
  constructor(private readonly specialHandlingService: ISpecialHandlingService) {}

  shouldHandle(event: VendorEvent): boolean {
    // Only handle events for high-value vendors
    return event.vendorValue > 100000;
  }

  async onVendorActivated(event: VendorActivatedEvent): Promise<void> {
    if (!this.shouldHandle(event)) return;

    await this.specialHandlingService.setupHighValueVendorMonitoring(event.vendorId);
  }

  async onVendorCreated(event: VendorCreatedEvent): Promise<void> {
    if (!this.shouldHandle(event)) return;

    await this.specialHandlingService.assignSpecialAccountManager(event.vendorId);
  }

  // ... other methods
}

// Enhanced event publisher with filtering
@Injectable()
export class FilteringVendorEventPublisher {
  private observers: IFilterableVendorObserver[] = [];

  addObserver(observer: IFilterableVendorObserver): void {
    this.observers.push(observer);
  }

  async publishVendorActivated(event: VendorActivatedEvent): Promise<void> {
    const applicableObservers = this.observers.filter((observer) => observer.shouldHandle(event));

    await this.notifyObservers(applicableObservers, (observer) =>
      observer.onVendorActivated(event),
    );
  }

  private async notifyObservers(
    observers: IFilterableVendorObserver[],
    notification: (observer: IFilterableVendorObserver) => Promise<void>,
  ): Promise<void> {
    const promises = observers.map(async (observer) => {
      try {
        await notification(observer);
      } catch (error) {
        console.error('Observer notification failed', {
          observer: observer.constructor.name,
          error: error.message,
        });
      }
    });

    await Promise.allSettled(promises);
  }
}
```

### Prioritized Observer Execution

```typescript
// Observer with priority
export interface IPriorityVendorObserver extends IVendorObserver {
  getPriority(): number; // Lower numbers = higher priority
}

@Injectable()
export class CriticalVendorAuditObserver implements IPriorityVendorObserver {
  constructor(private readonly auditService: IAuditService) {}

  getPriority(): number {
    return 1; // Highest priority - audit first
  }

  async onVendorActivated(event: VendorActivatedEvent): Promise<void> {
    await this.auditService.createCriticalAuditEntry({
      action: 'VENDOR_ACTIVATED',
      entityId: event.vendorId,
      priority: 'HIGH',
      timestamp: event.occurredAt,
    });
  }

  // ... other methods
}

@Injectable()
export class PriorityVendorEventPublisher {
  private observers: IPriorityVendorObserver[] = [];

  addObserver(observer: IPriorityVendorObserver): void {
    this.observers.push(observer);
    // Keep observers sorted by priority
    this.observers.sort((a, b) => a.getPriority() - b.getPriority());
  }

  async publishVendorActivated(event: VendorActivatedEvent): Promise<void> {
    // Execute observers in priority order
    for (const observer of this.observers) {
      try {
        await observer.onVendorActivated(event);
      } catch (error) {
        console.error('Priority observer failed', {
          observer: observer.constructor.name,
          priority: observer.getPriority(),
          error: error.message,
        });

        // For high-priority observers, we might want to fail fast
        if (observer.getPriority() === 1) {
          throw error;
        }
      }
    }
  }
}
```

## Observer Configuration and Registration

### Module Configuration

```typescript
@Module({
  providers: [
    VendorService,
    VendorEventPublisher,

    // Observers
    VendorNotificationObserver,
    VendorAuditObserver,
    VendorEmailObserver,
    VendorIntegrationObserver,

    // Observer registration
    {
      provide: 'VENDOR_OBSERVERS',
      useFactory: (
        notificationObserver: VendorNotificationObserver,
        auditObserver: VendorAuditObserver,
        emailObserver: VendorEmailObserver,
        integrationObserver: VendorIntegrationObserver,
      ) => [notificationObserver, auditObserver, emailObserver, integrationObserver],
      inject: [
        VendorNotificationObserver,
        VendorAuditObserver,
        VendorEmailObserver,
        VendorIntegrationObserver,
      ],
    },
  ],
})
export class VendorModule implements OnModuleInit {
  constructor(
    private readonly eventPublisher: VendorEventPublisher,
    @Inject('VENDOR_OBSERVERS')
    private readonly observers: IVendorObserver[],
  ) {}

  onModuleInit(): void {
    // Register all observers
    this.observers.forEach((observer) => {
      this.eventPublisher.addObserver(observer);
    });
  }
}
```

## Testing Observer Pattern

### Observer Testing

```typescript
describe('VendorObservers', () => {
  describe('VendorNotificationObserver', () => {
    let observer: VendorNotificationObserver;
    let mockNotificationService: jest.Mocked<INotificationService>;

    beforeEach(() => {
      mockNotificationService = {
        notify: jest.fn().mockResolvedValue(undefined),
      };

      observer = new VendorNotificationObserver(mockNotificationService);
    });

    describe('onVendorActivated', () => {
      it('should send activation notification', async () => {
        const event = new VendorActivatedEvent(
          'vendor-123',
          'Test Vendor',
          'org-456',
          'test@vendor.com',
          'user-789',
          new Date(),
        );

        await observer.onVendorActivated(event);

        expect(mockNotificationService.notify).toHaveBeenCalledWith('VENDOR_ACTIVATED', {
          vendorId: 'vendor-123',
          vendorName: 'Test Vendor',
          organizationId: 'org-456',
        });
      });
    });

    describe('onVendorInsuranceUpdated', () => {
      it('should send insurance update notification', async () => {
        const event = new VendorInsuranceUpdatedEvent(
          'vendor-123',
          'Test Vendor',
          'org-456',
          undefined,
          {
            provider: 'New Insurance',
            policyNumber: 'POL-456',
            expiryDate: '2025-12-31',
            coverageAmount: 1000000,
          },
          'user-789',
          new Date(),
        );

        await observer.onVendorInsuranceUpdated(event);

        expect(mockNotificationService.notify).toHaveBeenCalledWith(
          'VENDOR_INSURANCE_UPDATED',
          expect.objectContaining({
            vendorId: 'vendor-123',
            vendorName: 'Test Vendor',
          }),
        );
      });

      it('should send expiry warning for expiring insurance', async () => {
        const soonToExpire = new Date();
        soonToExpire.setDate(soonToExpire.getDate() + 15); // 15 days from now

        const event = new VendorInsuranceUpdatedEvent(
          'vendor-123',
          'Test Vendor',
          'org-456',
          undefined,
          {
            provider: 'New Insurance',
            policyNumber: 'POL-456',
            expiryDate: soonToExpire.toISOString(),
            coverageAmount: 1000000,
          },
          'user-789',
          new Date(),
        );

        await observer.onVendorInsuranceUpdated(event);

        expect(mockNotificationService.notify).toHaveBeenCalledWith(
          'INSURANCE_EXPIRING_SOON',
          expect.objectContaining({
            vendorId: 'vendor-123',
            expiryDate: soonToExpire.toISOString(),
          }),
        );
      });
    });
  });
});

describe('VendorEventPublisher', () => {
  let publisher: VendorEventPublisher;
  let mockObserver1: jest.Mocked<IVendorObserver>;
  let mockObserver2: jest.Mocked<IVendorObserver>;

  beforeEach(() => {
    publisher = new VendorEventPublisher();

    mockObserver1 = {
      onVendorActivated: jest.fn().mockResolvedValue(undefined),
      onVendorCreated: jest.fn().mockResolvedValue(undefined),
      onVendorDeactivated: jest.fn().mockResolvedValue(undefined),
      onVendorInsuranceUpdated: jest.fn().mockResolvedValue(undefined),
    };

    mockObserver2 = {
      onVendorActivated: jest.fn().mockResolvedValue(undefined),
      onVendorCreated: jest.fn().mockResolvedValue(undefined),
      onVendorDeactivated: jest.fn().mockResolvedValue(undefined),
      onVendorInsuranceUpdated: jest.fn().mockResolvedValue(undefined),
    };

    publisher.addObserver(mockObserver1);
    publisher.addObserver(mockObserver2);
  });

  describe('publishVendorActivated', () => {
    it('should notify all observers', async () => {
      const event = new VendorActivatedEvent(
        'vendor-123',
        'Test Vendor',
        'org-456',
        'test@vendor.com',
        'user-789',
        new Date(),
      );

      await publisher.publishVendorActivated(event);

      expect(mockObserver1.onVendorActivated).toHaveBeenCalledWith(event);
      expect(mockObserver2.onVendorActivated).toHaveBeenCalledWith(event);
    });

    it('should handle observer failures gracefully', async () => {
      const event = new VendorActivatedEvent(
        'vendor-123',
        'Test Vendor',
        'org-456',
        'test@vendor.com',
        'user-789',
        new Date(),
      );

      mockObserver1.onVendorActivated.mockRejectedValue(new Error('Observer 1 failed'));

      // Should not throw despite observer failure
      await expect(publisher.publishVendorActivated(event)).resolves.not.toThrow();

      // Other observers should still be called
      expect(mockObserver2.onVendorActivated).toHaveBeenCalledWith(event);
    });
  });

  describe('observer management', () => {
    it('should add observers', () => {
      const newObserver = mockObserver1;
      publisher.addObserver(newObserver);

      expect(publisher['observers']).toContain(newObserver);
    });

    it('should remove observers', () => {
      publisher.removeObserver(mockObserver1);

      expect(publisher['observers']).not.toContain(mockObserver1);
      expect(publisher['observers']).toContain(mockObserver2);
    });
  });
});
```

## Best Practices

### 1. Error Isolation

```typescript
// Good: Isolate observer failures
async function notifyObservers(observers: Observer[], event: Event): Promise<void> {
  const promises = observers.map(async (observer) => {
    try {
      await observer.handle(event);
    } catch (error) {
      console.error('Observer failed', {
        observer: observer.constructor.name,
        error,
      });
      // Don't let one observer failure affect others
    }
  });

  await Promise.allSettled(promises);
}

// Avoid: Letting observer failures bubble up
async function notifyObservers(observers: Observer[], event: Event): Promise<void> {
  for (const observer of observers) {
    await observer.handle(event); // If one fails, others won't be called
  }
}
```

### 2. Selective Observer Registration

```typescript
// Good: Observers can opt-in to specific events
export interface ISelectiveObserver {
  getInterestedEvents(): string[];
  handle(event: Event): Promise<void>;
}

class EventPublisher {
  async publish(event: Event): Promise<void> {
    const interestedObservers = this.observers.filter((observer) =>
      observer.getInterestedEvents().includes(event.type),
    );

    await this.notifyObservers(interestedObservers, event);
  }
}
```

### 3. Observer Performance Monitoring

```typescript
// Good: Monitor observer performance
class PerformanceMonitoringObserver implements IVendorObserver {
  constructor(
    private readonly wrappedObserver: IVendorObserver,
    private readonly metricsService: IMetricsService,
  ) {}

  async onVendorActivated(event: VendorActivatedEvent): Promise<void> {
    const start = Date.now();
    try {
      await this.wrappedObserver.onVendorActivated(event);
      this.recordSuccess(start, 'onVendorActivated');
    } catch (error) {
      this.recordError(start, 'onVendorActivated', error);
      throw error;
    }
  }

  private recordSuccess(start: number, method: string): void {
    const duration = Date.now() - start;
    this.metricsService.recordObserverExecutionTime(
      this.wrappedObserver.constructor.name,
      method,
      duration,
    );
  }
}
```

The Observer pattern in our oil & gas management system enables loose coupling
between business operations and their side effects, allowing for flexible
event-driven architectures that can easily accommodate new requirements without
modifying existing code.
