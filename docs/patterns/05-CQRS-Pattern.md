# Command Query Responsibility Segregation (CQRS) Pattern

## Overview

CQRS is a pattern that separates read and write operations for a data store.
Commands handle updates to data, while queries handle reading data. This
separation allows for optimized data models and improved performance,
scalability, and security.

## Core Concepts

### Commands

Operations that change the state of the system but don't return data.

### Queries

Operations that return data but don't change the state of the system.

### Command Handlers

Process commands and coordinate business operations.

### Query Handlers

Process queries and return read-optimized data.

### Separation of Models

Different models optimized for reading vs writing operations.

## Benefits

- **Performance Optimization**: Read and write operations can be optimized
  independently
- **Scalability**: Read and write databases can scale differently
- **Security**: Different permissions for read vs write operations
- **Flexibility**: Different technologies for reads vs writes
- **Complex Business Logic**: Commands can handle complex business rules
- **Simplified Queries**: Queries can be optimized for specific use cases

## Implementation in Our Project

### Before: Mixed Read/Write Operations

```typescript
@Controller('vendors')
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  // Mixed concerns - both command and query logic
  @Post()
  async createVendor(@Body() dto: CreateVendorDto) {
    // Command operation mixed with query response
    const vendor = await this.vendorService.create(dto);

    // Immediate query to return full data
    return await this.vendorService.getVendorWithDetails(vendor.id);
  }

  @Get(':id')
  async getVendor(@Param('id') id: string) {
    // Query operation
    return await this.vendorService.findById(id);
  }

  @Put(':id')
  async updateVendor(@Param('id') id: string, @Body() dto: UpdateVendorDto) {
    // Update operation mixed with return
    await this.vendorService.update(id, dto);
    return await this.vendorService.findById(id); // Immediate read
  }
}

// Service with mixed responsibilities
@Injectable()
export class VendorService {
  constructor(private readonly repository: VendorRepository) {}

  // Mixed read/write operations
  async create(dto: CreateVendorDto): Promise<VendorEntity> {
    const vendor = new VendorEntity();
    // ... mapping logic
    const saved = await this.repository.save(vendor);

    // Mixed with business logic and queries
    await this.auditService.logCreation(saved.id);
    await this.notificationService.notifyCreated(saved.id);

    return saved;
  }

  async findById(id: string): Promise<VendorDto> {
    const vendor = await this.repository.findById(id);
    // ... mapping to DTO
    return dto;
  }
}
```

### After: CQRS Implementation

```typescript
// Commands (Write Side)
export class CreateVendorCommand {
  constructor(
    public readonly organizationId: string,
    public readonly name: string,
    public readonly code: string,
    public readonly contactInfo: ContactInfoData,
    public readonly insurance: InsuranceData,
  ) {}
}

export class UpdateVendorCommand {
  constructor(
    public readonly vendorId: string,
    public readonly name?: string,
    public readonly contactInfo?: ContactInfoData,
  ) {}
}

// Queries (Read Side)
export class GetVendorByIdQuery {
  constructor(public readonly vendorId: string) {}
}

export class GetVendorsByOrganizationQuery {
  constructor(
    public readonly organizationId: string,
    public readonly filters?: VendorFilters,
    public readonly pagination?: PaginationOptions,
  ) {}
}

// Command Handlers
@CommandHandler(CreateVendorCommand)
export class CreateVendorHandler implements ICommandHandler<CreateVendorCommand> {
  constructor(
    private readonly vendorRepository: IVendorRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateVendorCommand): Promise<string> {
    // Focus only on business logic and persistence
    const vendor = Vendor.create({
      organizationId: command.organizationId,
      name: command.name,
      code: command.code,
      contactInfo: command.contactInfo,
      insurance: command.insurance,
    });

    await this.vendorRepository.save(vendor);

    // Publish events for side effects
    const events = vendor.getDomainEvents();
    for (const event of events) {
      this.eventBus.publish(event);
    }

    return vendor.getId().getValue();
  }
}

@CommandHandler(UpdateVendorCommand)
export class UpdateVendorHandler implements ICommandHandler<UpdateVendorCommand> {
  constructor(private readonly vendorRepository: IVendorRepository) {}

  async execute(command: UpdateVendorCommand): Promise<void> {
    const vendor = await this.vendorRepository.findById(new VendorId(command.vendorId));

    if (!vendor) {
      throw new VendorNotFoundError(command.vendorId);
    }

    // Business logic focused on state changes
    if (command.name) {
      vendor.updateName(new VendorName(command.name));
    }

    if (command.contactInfo) {
      vendor.updateContactInfo(new ContactInfo(command.contactInfo));
    }

    await this.vendorRepository.save(vendor);
  }
}

// Query Handlers
@QueryHandler(GetVendorByIdQuery)
export class GetVendorByIdHandler implements IQueryHandler<GetVendorByIdQuery> {
  constructor(private readonly vendorReadRepository: IVendorReadRepository) {}

  async execute(query: GetVendorByIdQuery): Promise<VendorDetailDto> {
    const vendor = await this.vendorReadRepository.findByIdWithDetails(query.vendorId);

    if (!vendor) {
      throw new VendorNotFoundError(query.vendorId);
    }

    // Return optimized read model
    return {
      id: vendor.id,
      organizationId: vendor.organizationId,
      name: vendor.name,
      code: vendor.code,
      status: vendor.status,
      contactInfo: vendor.contactInfo,
      insurance: vendor.insurance,
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt,
      // Joined data for efficient reading
      activeContracts: vendor.activeContractCount,
      totalPaid: vendor.totalAmountPaid,
      lastPaymentDate: vendor.lastPaymentDate,
    };
  }
}

@QueryHandler(GetVendorsByOrganizationQuery)
export class GetVendorsByOrganizationHandler
  implements IQueryHandler<GetVendorsByOrganizationQuery>
{
  constructor(private readonly vendorReadRepository: IVendorReadRepository) {}

  async execute(query: GetVendorsByOrganizationQuery): Promise<VendorListDto[]> {
    const vendors = await this.vendorReadRepository.findByOrganization(
      query.organizationId,
      query.filters,
      query.pagination,
    );

    // Return list-optimized read models
    return vendors.map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      code: vendor.code,
      status: vendor.status,
      lastActivity: vendor.lastActivity,
      activeContractCount: vendor.activeContractCount,
    }));
  }
}

// Controller with CQRS
@Controller('vendors')
export class VendorController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  async createVendor(@Body() dto: CreateVendorDto): Promise<{ id: string; message: string }> {
    // Execute command - only returns ID
    const vendorId = await this.commandBus.execute(
      new CreateVendorCommand(
        dto.organizationId,
        dto.name,
        dto.code,
        dto.contactInfo,
        dto.insurance,
      ),
    );

    return {
      id: vendorId,
      message: 'Vendor created successfully',
    };
  }

  @Get(':id')
  async getVendor(@Param('id') id: string): Promise<VendorDetailDto> {
    // Execute query
    return await this.queryBus.execute(new GetVendorByIdQuery(id));
  }

  @Get()
  async getVendors(
    @Query('organizationId') organizationId: string,
    @Query() filters: VendorFiltersDto,
  ): Promise<VendorListDto[]> {
    return await this.queryBus.execute(new GetVendorsByOrganizationQuery(organizationId, filters));
  }

  @Put(':id')
  async updateVendor(
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
  ): Promise<{ message: string }> {
    // Execute command - no return data
    await this.commandBus.execute(new UpdateVendorCommand(id, dto.name, dto.contactInfo));

    return { message: 'Vendor updated successfully' };
  }
}
```

## Read and Write Models

### Write Model (Domain-Focused)

```typescript
// Optimized for business logic and consistency
export class Vendor {
  private constructor(
    private readonly id: VendorId,
    private readonly organizationId: string,
    private name: VendorName,
    private code: VendorCode,
    private status: VendorStatus,
    private contactInfo: ContactInfo,
    private insurance: Insurance,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  // Rich behavior for business operations
  activate(): void {
    if (this.status.isBlocked()) {
      throw new VendorDomainError('Cannot activate blocked vendor');
    }
    this.status = VendorStatus.ACTIVE;
    this.updatedAt = new Date();
  }

  updateInsurance(insurance: Insurance): void {
    this.validateInsuranceRequirements(insurance);
    this.insurance = insurance;
    this.updatedAt = new Date();
  }

  private validateInsuranceRequirements(insurance: Insurance): void {
    if (this.status.isActive() && !insurance.isValid()) {
      throw new VendorDomainError('Active vendors must have valid insurance');
    }
  }
}
```

### Read Model (Query-Optimized)

```typescript
// Optimized for queries and display
export interface VendorReadModel {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  status: string;
  contactEmail: string;
  contactPhone: string;
  insuranceExpiry: Date | null;
  createdAt: Date;
  updatedAt: Date;

  // Denormalized data for efficient reading
  activeContractCount: number;
  totalAmountPaid: number;
  lastPaymentDate: Date | null;
  lastActivity: Date;
  riskScore: number;
  complianceStatus: 'COMPLIANT' | 'WARNING' | 'NON_COMPLIANT';
}

// Separate repository for reads
export interface IVendorReadRepository {
  findByIdWithDetails(id: string): Promise<VendorReadModel | null>;
  findByOrganization(
    organizationId: string,
    filters?: VendorFilters,
    pagination?: PaginationOptions,
  ): Promise<VendorReadModel[]>;

  // Specialized queries
  findExpiringInsurance(days: number): Promise<VendorReadModel[]>;
  findHighRiskVendors(organizationId: string): Promise<VendorReadModel[]>;
  getVendorSummaryStats(organizationId: string): Promise<VendorStatsDto>;
}
```

## Event-Driven Updates

### Domain Events

```typescript
export class VendorCreatedEvent implements DomainEvent {
  constructor(
    public readonly vendorId: string,
    public readonly organizationId: string,
    public readonly name: string,
    public readonly code: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}

export class VendorActivatedEvent implements DomainEvent {
  constructor(
    public readonly vendorId: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}

// Event handlers update read models
@EventsHandler(VendorCreatedEvent)
export class VendorCreatedEventHandler implements IEventHandler<VendorCreatedEvent> {
  constructor(private readonly vendorReadRepository: IVendorReadRepository) {}

  async handle(event: VendorCreatedEvent): Promise<void> {
    // Update read model
    await this.vendorReadRepository.create({
      id: event.vendorId,
      organizationId: event.organizationId,
      name: event.name,
      code: event.code,
      status: 'PENDING',
      activeContractCount: 0,
      totalAmountPaid: 0,
      lastActivity: event.occurredAt,
      complianceStatus: 'COMPLIANT',
    });
  }
}

@EventsHandler(VendorActivatedEvent)
export class VendorActivatedEventHandler implements IEventHandler<VendorActivatedEvent> {
  constructor(
    private readonly vendorReadRepository: IVendorReadRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async handle(event: VendorActivatedEvent): Promise<void> {
    // Update read model
    await this.vendorReadRepository.updateStatus(event.vendorId, 'ACTIVE');

    // Side effects
    await this.notificationService.notifyVendorActivated(event.vendorId);
  }
}
```

## Complex Query Examples

### Lease Operating Statement Queries

```typescript
// Query for LOS dashboard
export class GetLosDashboardQuery {
  constructor(
    public readonly organizationId: string,
    public readonly year: number,
  ) {}
}

@QueryHandler(GetLosDashboardQuery)
export class GetLosDashboardHandler implements IQueryHandler<GetLosDashboardQuery> {
  constructor(private readonly losReadRepository: ILosReadRepository) {}

  async execute(query: GetLosDashboardQuery): Promise<LosDashboardDto> {
    // Complex aggregated query optimized for dashboard
    const [monthlyTotals, statusCounts, topExpenseCategories, trendData] = await Promise.all([
      this.losReadRepository.getMonthlyTotals(query.organizationId, query.year),
      this.losReadRepository.getStatusCounts(query.organizationId, query.year),
      this.losReadRepository.getTopExpenseCategories(query.organizationId, query.year),
      this.losReadRepository.getTrendData(query.organizationId, 12),
    ]);

    return {
      year: query.year,
      monthlyTotals,
      statusCounts,
      topExpenseCategories,
      trendData,
    };
  }
}

// Specialized read repository
export class LosReadRepository implements ILosReadRepository {
  constructor(@Inject('DATABASE_CONNECTION') private readonly db: Database) {}

  async getMonthlyTotals(organizationId: string, year: number): Promise<MonthlyTotal[]> {
    // Optimized query with precomputed aggregations
    return await this.db
      .select({
        month: sql`EXTRACT(MONTH FROM statement_month)`,
        operatingExpenses: sql`SUM(operating_expenses)`,
        capitalExpenses: sql`SUM(capital_expenses)`,
        totalExpenses: sql`SUM(total_expenses)`,
      })
      .from(leaseOperatingStatements)
      .where(
        and(
          eq(leaseOperatingStatements.organizationId, organizationId),
          sql`EXTRACT(YEAR FROM statement_month) = ${year}`,
        ),
      )
      .groupBy(sql`EXTRACT(MONTH FROM statement_month)`)
      .orderBy(sql`EXTRACT(MONTH FROM statement_month)`);
  }
}
```

## CQRS Module Setup

### NestJS Module Configuration

```typescript
@Module({
  imports: [CqrsModule, DatabaseModule],
  controllers: [VendorController, LeaseOperatingStatementController],
  providers: [
    // Command Handlers
    CreateVendorHandler,
    UpdateVendorHandler,
    FinalizeLosHandler,

    // Query Handlers
    GetVendorByIdHandler,
    GetVendorsByOrganizationHandler,
    GetLosByIdHandler,

    // Event Handlers
    VendorCreatedEventHandler,
    VendorActivatedEventHandler,

    // Repositories
    { provide: 'IVendorRepository', useClass: VendorRepository },
    { provide: 'IVendorReadRepository', useClass: VendorReadRepository },
    { provide: 'ILosRepository', useClass: LosRepository },
    { provide: 'ILosReadRepository', useClass: LosReadRepository },
  ],
})
export class VendorModule {}
```

## Testing CQRS

### Command Handler Testing

```typescript
describe('CreateVendorHandler', () => {
  let handler: CreateVendorHandler;
  let mockRepository: jest.Mocked<IVendorRepository>;
  let mockEventBus: jest.Mocked<EventBus>;

  beforeEach(() => {
    mockRepository = createMockRepository();
    mockEventBus = createMockEventBus();
    handler = new CreateVendorHandler(mockRepository, mockEventBus);
  });

  it('should create vendor and publish events', async () => {
    // Given
    const command = new CreateVendorCommand(
      'org-123',
      'Test Vendor',
      'TEST-01',
      validContactInfo,
      validInsurance,
    );

    // When
    const vendorId = await handler.execute(command);

    // Then
    expect(mockRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: expect.objectContaining({ value: 'Test Vendor' }),
      }),
    );
    expect(mockEventBus.publish).toHaveBeenCalledWith(expect.any(VendorCreatedEvent));
    expect(vendorId).toBeDefined();
  });
});
```

### Query Handler Testing

```typescript
describe('GetVendorByIdHandler', () => {
  let handler: GetVendorByIdHandler;
  let mockReadRepository: jest.Mocked<IVendorReadRepository>;

  beforeEach(() => {
    mockReadRepository = createMockReadRepository();
    handler = new GetVendorByIdHandler(mockReadRepository);
  });

  it('should return vendor details', async () => {
    // Given
    const vendorId = 'vendor-123';
    const mockVendorData = createMockVendorReadModel();
    mockReadRepository.findByIdWithDetails.mockResolvedValue(mockVendorData);

    // When
    const result = await handler.execute(new GetVendorByIdQuery(vendorId));

    // Then
    expect(result).toEqual({
      id: mockVendorData.id,
      name: mockVendorData.name,
      // ... other fields
    });
    expect(mockReadRepository.findByIdWithDetails).toHaveBeenCalledWith(vendorId);
  });
});
```

## Performance Considerations

### Read Model Optimization

- **Denormalization**: Store computed values to avoid complex joins
- **Indexing**: Create indexes optimized for query patterns
- **Caching**: Cache frequently accessed read models
- **Materialized Views**: Use database views for complex aggregations

### Command Processing

- **Async Processing**: Use message queues for time-consuming operations
- **Event Sourcing**: Consider event sourcing for audit trails
- **Optimistic Concurrency**: Handle concurrent updates appropriately

## Command vs Query Return Values

### Commands Return Minimal Data

Commands should return only what's necessary for the client to take the next action, typically just an ID:

```typescript
// ✅ Good - Returns minimal data
async execute(command: StartTimerCommand): Promise<{ id: string }> {
  // ... business logic
  const saved = await this.timeEntryRepository.save(timeEntry);
  return { id: saved.id };
}

// ❌ Bad - Returns full entity
async execute(command: StartTimerCommand): Promise<TimeEntry> {
  const saved = await this.timeEntryRepository.save(timeEntry);
  return saved; // Don't return full entity from command
}
```

**Why?** Commands are about _doing something_, not _retrieving data_. If the client needs full data after a command, they should issue a separate query with the returned ID.

### Queries Return Full Data or DTOs

Queries should return complete data structures optimized for the client's needs:

```typescript
// ✅ Good - Returns full entity or DTO
async execute(query: GetRunningTimerQuery): Promise<TimeEntry | null> {
  return await this.timeEntryRepository.findRunningTimerByUser(query.userId);
}

// ✅ Also good - Returns paginated result
async execute(query: GetTimeEntriesQuery): Promise<PaginatedResult<TimeEntry>> {
  return await this.timeEntryRepository.findAll(filters, pagination);
}
```

### Exception Handling Differences

**Commands** should throw exceptions when business rules are violated:

```typescript
// Commands throw exceptions
if (existingTimer) {
  throw new ConflictException('A timer is already running');
}

if (!project) {
  throw new NotFoundException('Project not found');
}
```

**Queries** should return null or empty results instead of throwing NotFoundException:

```typescript
// ✅ Queries return null for missing data
async execute(query: GetRunningTimerQuery): Promise<TimeEntry | null> {
  const timeEntry = await this.repository.findRunningTimerByUser(query.userId);
  return timeEntry; // Returns null if not found
}

// ❌ Don't throw NotFoundException in queries
async execute(query: GetRunningTimerQuery): Promise<TimeEntry> {
  const timeEntry = await this.repository.findRunningTimerByUser(query.userId);
  if (!timeEntry) {
    throw new NotFoundException(); // Don't do this in queries
  }
  return timeEntry;
}
```

**Why?** Queries are about reading - missing data is a valid query result. Commands are about state changes - missing data is an error condition that prevents the command from executing.

## When to Use CQRS

### Good Fit

- **Complex Business Logic**: Commands with rich business rules
- **Read-Heavy Applications**: Many more reads than writes
- **Different Scaling Requirements**: Reads and writes need different scaling
- **Complex Reporting**: Advanced analytics and reporting requirements
- **Event-Driven Architecture**: When using domain events extensively

### Not Recommended

- **Simple CRUD Applications**: Basic create, read, update, delete operations
- **Small Applications**: Overhead not justified for simple use cases
- **Tight Consistency Requirements**: When immediate consistency is critical
- **Limited Team Experience**: Requires understanding of event-driven patterns

CQRS in our PSA system helps us handle complex business operations (like time entry approval workflows) separately from optimized queries (like timesheet views and project analytics), leading to better performance and maintainability.
