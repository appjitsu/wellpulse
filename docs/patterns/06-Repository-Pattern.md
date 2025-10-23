# Repository Pattern

## Overview

The Repository pattern encapsulates the logic needed to access data sources. It
provides a uniform interface for accessing domain objects while hiding the
complexities of the underlying storage mechanism. This pattern promotes
separation of concerns and makes the code more testable and maintainable.

## Core Concepts

### Repository Interface

Defines the contract for data access operations without exposing implementation
details.

### Repository Implementation

Concrete implementation that handles the actual data storage and retrieval.

### Domain Objects

Business entities that the repository manages.

### Query Abstraction

Methods that express business intent rather than technical data access patterns.

## Benefits

- **Testability**: Easy to mock for unit testing
- **Flexibility**: Can switch between different storage mechanisms
- **Separation of Concerns**: Business logic separated from data access
- **Consistency**: Uniform interface for data operations
- **Caching**: Centralized location for caching strategies
- **Query Optimization**: Repository can optimize queries for specific use cases

## Implementation in Our Project

### Before: Direct Database Access

```typescript
@Injectable()
export class VendorService {
  constructor(@Inject('DATABASE_CONNECTION') private readonly db: Database) {}

  async createVendor(dto: CreateVendorDto): Promise<VendorDto> {
    // Direct database access mixed with business logic
    const existingVendor = await this.db
      .select()
      .from(vendors)
      .where(eq(vendors.code, dto.code))
      .limit(1);

    if (existingVendor.length > 0) {
      throw new ConflictException('Vendor code already exists');
    }

    // Complex mapping logic
    const vendorData = {
      id: generateId(),
      organizationId: dto.organizationId,
      name: dto.name,
      code: dto.code,
      status: 'PENDING',
      contactInfo: JSON.stringify(dto.contactInfo),
      insurance: JSON.stringify(dto.insurance),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Raw SQL operations
    const result = await this.db.insert(vendors).values(vendorData).returning();

    // Manual mapping back to DTO
    const created = result[0];
    return {
      id: created.id,
      name: created.name,
      code: created.code,
      status: created.status,
      contactInfo: JSON.parse(created.contactInfo),
      insurance: JSON.parse(created.insurance),
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  async getActiveVendorsByOrganization(orgId: string): Promise<VendorDto[]> {
    // Complex query logic scattered throughout service layer
    const results = await this.db
      .select({
        id: vendors.id,
        name: vendors.name,
        code: vendors.code,
        status: vendors.status,
        contactInfo: vendors.contactInfo,
        lastPaymentDate: sql`(
          SELECT MAX(payment_date)
          FROM payments
          WHERE vendor_id = ${vendors.id}
        )`,
        contractCount: sql`(
          SELECT COUNT(*)
          FROM contracts
          WHERE vendor_id = ${vendors.id} AND status = 'ACTIVE'
        )`,
      })
      .from(vendors)
      .where(and(eq(vendors.organizationId, orgId), eq(vendors.status, 'ACTIVE')));

    // Manual mapping
    return results.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      status: row.status,
      contactInfo: JSON.parse(row.contactInfo),
      lastPaymentDate: row.lastPaymentDate,
      contractCount: row.contractCount,
    }));
  }
}
```

### After: Repository Pattern

```typescript
// Domain Repository Interface
export interface IVendorRepository {
  // Basic CRUD operations
  findById(id: VendorId): Promise<Vendor | null>;
  findByCode(code: VendorCode): Promise<Vendor | null>;
  save(vendor: Vendor): Promise<void>;
  delete(id: VendorId): Promise<void>;

  // Business-specific queries
  findActiveVendorsByOrganization(organizationId: string): Promise<Vendor[]>;
  findVendorsWithExpiredInsurance(organizationId: string): Promise<Vendor[]>;
  findVendorsByStatus(organizationId: string, status: VendorStatus): Promise<Vendor[]>;

  // Complex domain queries
  existsByCodeInOrganization(code: VendorCode, organizationId: string): Promise<boolean>;

  findVendorsForPayment(organizationId: string, minAmount: Money): Promise<Vendor[]>;

  // Pagination support
  findByOrganizationPaginated(
    organizationId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<Vendor>>;
}

// Infrastructure Implementation
@Injectable()
export class VendorRepository implements IVendorRepository {
  constructor(
    @Inject('DATABASE_CONNECTION')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findById(id: VendorId): Promise<Vendor | null> {
    const result = await this.db
      .select()
      .from(vendors)
      .where(eq(vendors.id, id.getValue()))
      .limit(1);

    return result[0] ? this.mapToDomainEntity(result[0]) : null;
  }

  async findByCode(code: VendorCode): Promise<Vendor | null> {
    const result = await this.db
      .select()
      .from(vendors)
      .where(eq(vendors.code, code.getValue()))
      .limit(1);

    return result[0] ? this.mapToDomainEntity(result[0]) : null;
  }

  async save(vendor: Vendor): Promise<void> {
    const persistenceData = vendor.toPersistence();

    const existing = await this.findById(vendor.getId());

    if (existing) {
      await this.updateVendor(persistenceData);
    } else {
      await this.createVendor(persistenceData);
    }
  }

  async findActiveVendorsByOrganization(organizationId: string): Promise<Vendor[]> {
    const results = await this.db
      .select()
      .from(vendors)
      .where(
        and(eq(vendors.organizationId, organizationId), eq(vendors.status, VendorStatus.ACTIVE)),
      )
      .orderBy(vendors.name);

    return results.map((row) => this.mapToDomainEntity(row));
  }

  async findVendorsWithExpiredInsurance(organizationId: string): Promise<Vendor[]> {
    const results = await this.db
      .select()
      .from(vendors)
      .where(
        and(
          eq(vendors.organizationId, organizationId),
          lte(sql`(${vendors.insurance}->>'expiryDate')::date`, new Date()),
        ),
      );

    return results.map((row) => this.mapToDomainEntity(row));
  }

  async existsByCodeInOrganization(code: VendorCode, organizationId: string): Promise<boolean> {
    const result = await this.db
      .select({ count: count() })
      .from(vendors)
      .where(and(eq(vendors.code, code.getValue()), eq(vendors.organizationId, organizationId)));

    return (result[0]?.count ?? 0) > 0;
  }

  async findByOrganizationPaginated(
    organizationId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<Vendor>> {
    const { limit = 20, offset = 0, sortBy = 'name', sortOrder = 'asc' } = options;

    // Count total for pagination
    const [countResult] = await this.db
      .select({ count: count() })
      .from(vendors)
      .where(eq(vendors.organizationId, organizationId));

    const total = countResult?.count ?? 0;

    // Get page data
    const results = await this.db
      .select()
      .from(vendors)
      .where(eq(vendors.organizationId, organizationId))
      .orderBy(sortOrder === 'desc' ? desc(vendors[sortBy]) : asc(vendors[sortBy]))
      .limit(limit)
      .offset(offset);

    const items = results.map((row) => this.mapToDomainEntity(row));

    return new PaginatedResult(items, total, limit, offset);
  }

  // Private mapping methods
  private async createVendor(data: VendorPersistenceData): Promise<void> {
    await this.db.insert(vendors).values({
      id: data.id,
      organizationId: data.organizationId,
      name: data.name,
      code: data.code,
      status: data.status,
      contactInfo: data.contactInfo,
      insurance: data.insurance,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  private async updateVendor(data: VendorPersistenceData): Promise<void> {
    await this.db
      .update(vendors)
      .set({
        name: data.name,
        contactInfo: data.contactInfo,
        insurance: data.insurance,
        status: data.status,
        updatedAt: data.updatedAt,
      })
      .where(eq(vendors.id, data.id));
  }

  private mapToDomainEntity(row: any): Vendor {
    return Vendor.fromPersistence({
      id: row.id,
      organizationId: row.organizationId,
      name: row.name,
      code: row.code,
      status: row.status,
      contactInfo: row.contactInfo,
      insurance: row.insurance,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}

// Clean Service Layer
@Injectable()
export class CreateVendorHandler implements ICommandHandler<CreateVendorCommand> {
  constructor(
    private readonly vendorRepository: IVendorRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateVendorCommand): Promise<string> {
    // Business logic focused on domain concepts
    const vendorCode = new VendorCode(command.code);

    // Repository handles the complex query logic
    if (
      await this.vendorRepository.existsByCodeInOrganization(vendorCode, command.organizationId)
    ) {
      throw new VendorCodeAlreadyExistsError(command.code);
    }

    // Create domain entity
    const vendor = Vendor.create({
      organizationId: command.organizationId,
      name: command.name,
      code: command.code,
      contactInfo: command.contactInfo,
      insurance: command.insurance,
    });

    // Repository handles persistence complexity
    await this.vendorRepository.save(vendor);

    // Domain events
    const events = vendor.getDomainEvents();
    for (const event of events) {
      this.eventBus.publish(event);
    }

    return vendor.getId().getValue();
  }
}
```

## Advanced Repository Patterns

### Specification Pattern Integration

```typescript
// Specification for complex queries
export abstract class VendorSpecification {
  abstract isSatisfiedBy(vendor: Vendor): boolean;
  abstract toQuery(): QueryCondition;
}

export class ActiveVendorWithValidInsuranceSpecification extends VendorSpecification {
  isSatisfiedBy(vendor: Vendor): boolean {
    return vendor.isActive() && vendor.hasValidInsurance();
  }

  toQuery(): QueryCondition {
    return and(
      eq(vendors.status, VendorStatus.ACTIVE),
      gte(sql`(${vendors.insurance}->>'expiryDate')::date`, new Date()),
    );
  }
}

// Repository with specification support
export interface IVendorRepository {
  findBySpecification(
    specification: VendorSpecification,
    organizationId: string,
  ): Promise<Vendor[]>;
}

@Injectable()
export class VendorRepository implements IVendorRepository {
  async findBySpecification(
    specification: VendorSpecification,
    organizationId: string,
  ): Promise<Vendor[]> {
    const queryCondition = specification.toQuery();

    const results = await this.db
      .select()
      .from(vendors)
      .where(and(eq(vendors.organizationId, organizationId), queryCondition));

    return results.map((row) => this.mapToDomainEntity(row));
  }
}
```

### Unit of Work Integration

```typescript
export interface IUnitOfWork {
  vendorRepository: IVendorRepository;
  contractRepository: IContractRepository;
  paymentRepository: IPaymentRepository;

  commit(): Promise<void>;
  rollback(): Promise<void>;
}

@Injectable()
export class UnitOfWork implements IUnitOfWork {
  private transaction: any;

  constructor(@Inject('DATABASE_CONNECTION') private readonly db: Database) {}

  get vendorRepository(): IVendorRepository {
    return new TransactionalVendorRepository(this.db, this.transaction);
  }

  get contractRepository(): IContractRepository {
    return new TransactionalContractRepository(this.db, this.transaction);
  }

  async commit(): Promise<void> {
    if (this.transaction) {
      await this.transaction.commit();
      this.transaction = null;
    }
  }

  async rollback(): Promise<void> {
    if (this.transaction) {
      await this.transaction.rollback();
      this.transaction = null;
    }
  }

  async begin(): Promise<void> {
    this.transaction = await this.db.transaction();
  }
}

// Usage in application service
@Injectable()
export class ActivateVendorHandler {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(command: ActivateVendorCommand): Promise<void> {
    await this.unitOfWork.begin();

    try {
      const vendor = await this.unitOfWork.vendorRepository.findById(
        new VendorId(command.vendorId),
      );

      if (!vendor) {
        throw new VendorNotFoundError(command.vendorId);
      }

      vendor.activate();

      // Update vendor
      await this.unitOfWork.vendorRepository.save(vendor);

      // Activate related contracts
      const contracts = await this.unitOfWork.contractRepository.findByVendorId(vendor.getId());

      for (const contract of contracts) {
        contract.activate();
        await this.unitOfWork.contractRepository.save(contract);
      }

      await this.unitOfWork.commit();
    } catch (error) {
      await this.unitOfWork.rollback();
      throw error;
    }
  }
}
```

### Read/Write Repository Separation

```typescript
// Write-optimized repository
export interface IVendorWriteRepository {
  save(vendor: Vendor): Promise<void>;
  delete(id: VendorId): Promise<void>;
}

// Read-optimized repository
export interface IVendorReadRepository {
  findById(id: string): Promise<VendorReadModel | null>;
  findByOrganization(organizationId: string, filters?: VendorFilters): Promise<VendorReadModel[]>;

  // Specialized read operations
  getVendorSummary(organizationId: string): Promise<VendorSummaryDto>;
  getVendorPaymentHistory(vendorId: string): Promise<PaymentHistoryDto[]>;
  searchVendors(organizationId: string, searchTerm: string): Promise<VendorSearchResultDto[]>;
}

@Injectable()
export class VendorReadRepository implements IVendorReadRepository {
  constructor(@Inject('DATABASE_CONNECTION') private readonly db: Database) {}

  async findByOrganization(
    organizationId: string,
    filters?: VendorFilters,
  ): Promise<VendorReadModel[]> {
    let query = this.db
      .select({
        id: vendors.id,
        name: vendors.name,
        code: vendors.code,
        status: vendors.status,
        contactEmail: sql`${vendors.contactInfo}->>'email'`,
        lastPaymentDate: sql`(
          SELECT MAX(payment_date)
          FROM payments
          WHERE vendor_id = ${vendors.id}
        )`,
        totalPaid: sql`(
          SELECT COALESCE(SUM(amount), 0)
          FROM payments
          WHERE vendor_id = ${vendors.id}
        )`,
        activeContractCount: sql`(
          SELECT COUNT(*)
          FROM contracts
          WHERE vendor_id = ${vendors.id} AND status = 'ACTIVE'
        )`,
      })
      .from(vendors)
      .where(eq(vendors.organizationId, organizationId));

    // Apply filters
    if (filters?.status) {
      query = query.where(eq(vendors.status, filters.status));
    }

    if (filters?.searchTerm) {
      query = query.where(
        or(
          ilike(vendors.name, `%${filters.searchTerm}%`),
          ilike(vendors.code, `%${filters.searchTerm}%`),
        ),
      );
    }

    return await query;
  }

  async getVendorSummary(organizationId: string): Promise<VendorSummaryDto> {
    const [statusCounts, paymentStats] = await Promise.all([
      this.getVendorStatusCounts(organizationId),
      this.getPaymentStatistics(organizationId),
    ]);

    return {
      totalVendors: statusCounts.total,
      activeVendors: statusCounts.active,
      pendingVendors: statusCounts.pending,
      totalAmountPaid: paymentStats.totalPaid,
      averagePaymentAmount: paymentStats.averageAmount,
    };
  }

  private async getVendorStatusCounts(organizationId: string) {
    const result = await this.db
      .select({
        status: vendors.status,
        count: count(),
      })
      .from(vendors)
      .where(eq(vendors.organizationId, organizationId))
      .groupBy(vendors.status);

    return result.reduce(
      (acc, row) => {
        acc[row.status] = row.count;
        acc.total += row.count;
        return acc;
      },
      { total: 0, active: 0, pending: 0, blocked: 0 },
    );
  }
}
```

## Repository Testing

### Unit Testing Repository Interface

```typescript
describe('VendorRepository', () => {
  let repository: VendorRepository;
  let mockDb: jest.Mocked<Database>;

  beforeEach(() => {
    mockDb = createMockDatabase();
    repository = new VendorRepository(mockDb);
  });

  describe('findById', () => {
    it('should return vendor when found', async () => {
      // Given
      const vendorId = new VendorId('vendor-123');
      const mockDbResult = [createMockVendorDbRow()];
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockDbResult),
      } as any);

      // When
      const result = await repository.findById(vendorId);

      // Then
      expect(result).toBeInstanceOf(Vendor);
      expect(result?.getId()).toEqual(vendorId);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return null when not found', async () => {
      // Given
      const vendorId = new VendorId('non-existent');
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      } as any);

      // When
      const result = await repository.findById(vendorId);

      // Then
      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('should create new vendor when not exists', async () => {
      // Given
      const vendor = createMockVendor();
      jest.spyOn(repository, 'findById').mockResolvedValue(null);
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      } as any);

      // When
      await repository.save(vendor);

      // Then
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should update existing vendor', async () => {
      // Given
      const vendor = createMockVendor();
      jest.spyOn(repository, 'findById').mockResolvedValue(vendor);
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(undefined),
      } as any);

      // When
      await repository.save(vendor);

      // Then
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('findActiveVendorsByOrganization', () => {
    it('should return active vendors for organization', async () => {
      // Given
      const organizationId = 'org-123';
      const mockDbResults = [
        createMockVendorDbRow({ status: VendorStatus.ACTIVE }),
        createMockVendorDbRow({ status: VendorStatus.ACTIVE }),
      ];

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(mockDbResults),
      } as any);

      // When
      const results = await repository.findActiveVendorsByOrganization(organizationId);

      // Then
      expect(results).toHaveLength(2);
      expect(results.every((v) => v.isActive())).toBe(true);
    });
  });
});
```

### Integration Testing with Real Database

```typescript
describe('VendorRepository Integration', () => {
  let repository: VendorRepository;
  let testDb: Database;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    repository = new VendorRepository(testDb);
  });

  afterAll(async () => {
    await testDb.close();
  });

  beforeEach(async () => {
    await cleanDatabase(testDb);
  });

  it('should persist and retrieve vendor', async () => {
    // Given
    const vendor = Vendor.create({
      organizationId: 'test-org',
      name: 'Test Vendor',
      code: 'TEST-01',
      contactInfo: createValidContactInfo(),
      insurance: createValidInsurance(),
    });

    // When
    await repository.save(vendor);
    const retrieved = await repository.findById(vendor.getId());

    // Then
    expect(retrieved).toBeTruthy();
    expect(retrieved?.getName().getValue()).toBe('Test Vendor');
    expect(retrieved?.getCode().getValue()).toBe('TEST-01');
  });

  it('should handle concurrent saves correctly', async () => {
    // Given
    const vendor = createTestVendor();
    await repository.save(vendor);

    // When - Simulate concurrent updates
    const [vendor1, vendor2] = await Promise.all([
      repository.findById(vendor.getId()),
      repository.findById(vendor.getId()),
    ]);

    vendor1?.updateName(new VendorName('Updated Name 1'));
    vendor2?.updateName(new VendorName('Updated Name 2'));

    // Then - Should handle optimistic concurrency appropriately
    await repository.save(vendor1!);
    await expect(repository.save(vendor2!)).rejects.toThrow();
  });
});
```

## Best Practices

### Implementation Strategy (Drizzle ORM)

When implementing repositories with Drizzle ORM, follow these proven patterns:

#### 1. Mapper Functions

**Separate `toDomain()` and `toDatabase()` methods handle value object conversions.**

Value objects (Money, Duration, ProjectSlug) need explicit conversion between domain and database representations:

```typescript
export class DrizzleProjectRepository implements IProjectRepository {
  /**
   * Convert database row to domain entity
   */
  private toDomain(row: typeof projectsTable.$inferSelect): Project {
    return Project.fromPersistence({
      id: row.id,
      name: row.name,
      slug: ProjectSlug.fromString(row.slug), // String → Value Object
      budget: row.budget ? Money.fromAmount(Number(row.budget)) : null, // String → Money
      defaultHourlyRate: row.defaultHourlyRate
        ? HourlyRate.fromAmount(Number(row.defaultHourlyRate)) // String → HourlyRate
        : null,
      status: row.status as ProjectStatus,
      // ... other fields
    });
  }

  /**
   * Convert domain entity to database row
   */
  private toDatabase(project: Project): typeof projectsTable.$inferInsert {
    return {
      id: project.id,
      name: project.name,
      slug: project.slug.value, // Value Object → String
      budget: project.budget?.amount.toString() || null, // Money → String
      defaultHourlyRate: project.defaultHourlyRate?.amount.toString() || null, // HourlyRate → String
      status: project.status,
      // ... other fields
    };
  }

  async save(project: Project): Promise<Project> {
    const data = this.toDatabase(project); // Domain → DB

    const [row] = await this.db
      .insert(projectsTable)
      .values(data)
      .onConflictDoUpdate({
        target: projectsTable.id,
        set: data,
      })
      .returning();

    return this.toDomain(row); // DB → Domain
  }
}
```

**Why This Matters**:

- Domain entities remain pure (no database concerns)
- Value objects enforce business rules during conversion
- Type safety at boundaries (compile-time errors if fields mismatch)
- Single responsibility (mappers only handle translation)

#### 2. Type Conversions

**Drizzle returns decimals as strings; convert to domain types (Money, HourlyRate).**

PostgreSQL `DECIMAL` and `NUMERIC` columns are returned as strings to preserve precision:

```typescript
// Database schema
export const projectsTable = pgTable('projects', {
  budget: decimal('budget', { precision: 12, scale: 2 }), // DECIMAL(12,2)
  defaultHourlyRate: decimal('default_hourly_rate', { precision: 10, scale: 2 }),
});

// ❌ Common mistake - Using string directly
const budget: string = row.budget; // Type: string | null

// ✅ Correct - Convert to domain type
const budget: Money | null = row.budget ? Money.fromAmount(Number(row.budget)) : null;

// ✅ Correct - Convert to value object
const rate: HourlyRate | null = row.defaultHourlyRate
  ? HourlyRate.fromAmount(Number(row.defaultHourlyRate))
  : null;
```

**Decimal Handling Checklist**:

- ✅ Always convert `decimal` columns to `Number` before passing to domain
- ✅ Always convert `Money` and `HourlyRate` to `.toString()` before saving
- ✅ Use `.toFixed(2)` when displaying to users
- ✅ Never do math on decimal strings (convert to number first)

**Example: Time Entry with Duration**:

```typescript
private toDomain(row: typeof timeEntriesTable.$inferSelect): TimeEntry {
  return TimeEntry.fromPersistence({
    duration: row.duration
      ? Duration.fromSeconds(row.duration) // Integer → Value Object
      : null,
    hourlyRate: row.hourlyRate
      ? HourlyRate.fromAmount(Number(row.hourlyRate)) // String → Value Object
      : null,
    // ...
  });
}

private toDatabase(entry: TimeEntry): typeof timeEntriesTable.$inferInsert {
  return {
    duration: entry.duration?.seconds || null, // Value Object → Integer
    hourlyRate: entry.hourlyRate?.amount.toString() || null, // Value Object → String
    // ...
  };
}
```

#### 3. Soft Delete Filtering

**Always filter `isNull(deletedAt)` in queries unless explicitly including deleted records.**

Soft delete is a cross-cutting concern that must be consistently applied:

```typescript
import { isNull, and, eq } from 'drizzle-orm';

// ✅ Correct - Always filter soft-deleted records
async findById(id: string): Promise<Project | null> {
  const [row] = await this.db
    .select()
    .from(projectsTable)
    .where(
      and(
        eq(projectsTable.id, id),
        isNull(projectsTable.deletedAt), // CRITICAL: Filter soft-deleted
      ),
    );

  return row ? this.toDomain(row) : null;
}

// ✅ Correct - Conditional soft delete filtering
async findAll(filters: ProjectFilters): Promise<Project[]> {
  const conditions = [];

  if (!filters.includeDeleted) {
    conditions.push(isNull(projectsTable.deletedAt)); // Apply by default
  }

  const rows = await this.db
    .select()
    .from(projectsTable)
    .where(and(...conditions));

  return rows.map(row => this.toDomain(row));
}

// ❌ Common mistake - Forgetting soft delete filter
async findById(id: string): Promise<Project | null> {
  const [row] = await this.db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, id)); // BUG: Returns deleted records!

  return row ? this.toDomain(row) : null;
}
```

**Soft Delete Best Practices**:

1. **Always filter** `isNull(deletedAt)` unless `includeDeleted` flag is true
2. **Update soft delete** using `update().set({ deletedAt: new Date(), deletedBy })`
3. **Never hard delete** (use soft delete for audit trail)
4. **Cascade consideration**: Soft-deleting parent should cascade to children (handled at application layer)

**Example: Soft Delete Implementation**:

```typescript
async delete(id: string, deletedBy: string): Promise<void> {
  await this.db
    .update(projectsTable)
    .set({
      deletedAt: new Date(),
      deletedBy,
      updatedAt: new Date(),
    })
    .where(eq(projectsTable.id, id));

  // No hard delete - preserve for audit trail
}

// Restore from soft delete (if needed)
async restore(id: string): Promise<void> {
  await this.db
    .update(projectsTable)
    .set({
      deletedAt: null,
      deletedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(projectsTable.id, id));
}
```

### 1. Interface Segregation

```typescript
// Separate interfaces for different needs
export interface IVendorReadRepository {
  findById(id: string): Promise<VendorReadModel | null>;
  search(criteria: SearchCriteria): Promise<VendorReadModel[]>;
}

export interface IVendorWriteRepository {
  save(vendor: Vendor): Promise<void>;
  delete(id: VendorId): Promise<void>;
}

// Combined interface when both are needed
export interface IVendorRepository extends IVendorReadRepository, IVendorWriteRepository {}
```

### 2. Business-Focused Methods

```typescript
// Good: Business intent is clear
interface IVendorRepository {
  findVendorsRequiringInsuranceRenewal(days: number): Promise<Vendor[]>;
  findHighRiskVendors(organizationId: string): Promise<Vendor[]>;
  findVendorsEligibleForPayment(minAmount: Money): Promise<Vendor[]>;
}

// Avoid: Technical operations exposed
interface IVendorRepository {
  selectWithJoins(tables: string[], conditions: any[]): Promise<any[]>;
  executeCustomQuery(sql: string, params: any[]): Promise<any[]>;
}
```

### 3. Consistent Error Handling

```typescript
export abstract class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class VendorNotFoundError extends RepositoryError {
  constructor(vendorId: string) {
    super(`Vendor with ID ${vendorId} not found`);
  }
}

export class VendorPersistenceError extends RepositoryError {
  constructor(operation: string, cause?: Error) {
    super(`Failed to ${operation} vendor`, cause);
  }
}
```

### 4. Caching Strategy

```typescript
@Injectable()
export class CachedVendorRepository implements IVendorRepository {
  constructor(
    private readonly baseRepository: IVendorRepository,
    private readonly cache: ICacheService,
  ) {}

  async findById(id: VendorId): Promise<Vendor | null> {
    const cacheKey = `vendor:${id.getValue()}`;

    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return Vendor.fromCached(cached);
    }

    // Fall back to repository
    const vendor = await this.baseRepository.findById(id);

    // Cache for future use
    if (vendor) {
      await this.cache.set(cacheKey, vendor.toCached(), { ttl: 300 });
    }

    return vendor;
  }

  async save(vendor: Vendor): Promise<void> {
    await this.baseRepository.save(vendor);

    // Invalidate cache
    const cacheKey = `vendor:${vendor.getId().getValue()}`;
    await this.cache.delete(cacheKey);
  }
}
```

## Anti-Patterns to Avoid

### 1. Leaky Abstraction

```typescript
// DON'T: Exposing database-specific details
interface IVendorRepository {
  findByQuery(drizzleQuery: SelectQuery): Promise<Vendor[]>;
  executeTransaction(callback: (tx: Transaction) => Promise<void>): Promise<void>;
}
```

### 2. Generic Repository Anti-Pattern

```typescript
// DON'T: Over-generic repository
interface IGenericRepository<T> {
  find(id: string): Promise<T | null>;
  save(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
  findAll(): Promise<T[]>;
}

// This loses business meaning and forces all entities into same mold
```

### 3. Repository as Data Access Layer

```typescript
// DON'T: Repository doing business logic
class VendorRepository {
  async activateVendor(id: string): Promise<void> {
    const vendor = await this.findById(id);

    // Business logic in repository
    if (vendor.contracts.some((c) => c.isPending())) {
      throw new Error('Cannot activate vendor with pending contracts');
    }

    vendor.status = 'ACTIVE';
    await this.save(vendor);
  }
}
```

The Repository pattern in our oil & gas management system provides a clean
abstraction over complex data access operations, allowing our domain logic to
focus on business rules while keeping persistence concerns properly separated.
