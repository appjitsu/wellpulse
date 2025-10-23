# Specification Pattern

## Overview

The Specification pattern is a behavioral design pattern that allows you to
encapsulate business rules and logic in reusable, composable objects. It
separates the statement of how to match a candidate from the candidate object
that it is matched against. This pattern is particularly useful for validation,
querying, and filtering complex business objects.

## Core Concepts

### Specification

An object that encapsulates a single business rule and can determine if an
entity satisfies that rule.

### Composite Specifications

Specifications can be combined using logical operators (AND, OR, NOT) to create
complex criteria.

### Repository Integration

Specifications can be translated to database queries for efficient filtering.

### Domain Validation

Business rules can be expressed as specifications and reused across the domain.

## Benefits

- **Reusability**: Business rules can be reused across different contexts
- **Composability**: Simple specifications can be combined into complex ones
- **Testability**: Each specification can be tested in isolation
- **Expressiveness**: Business rules are clearly stated in code
- **Separation of Concerns**: Query logic separated from repository
  implementation
- **Maintainability**: Changes to business rules are centralized

## Implementation in Our Project

### Before: Scattered Business Logic

```typescript
@Injectable()
export class VendorService {
  constructor(private readonly vendorRepository: VendorRepository) {}

  async findActiveVendorsWithValidInsurance(organizationId: string): Promise<Vendor[]> {
    // Complex filtering logic scattered across service methods
    const vendors = await this.vendorRepository.findByOrganization(organizationId);

    return vendors.filter((vendor) => {
      // Inline business logic
      if (vendor.status !== VendorStatus.ACTIVE) {
        return false;
      }

      const insurance = vendor.getInsurance();
      if (!insurance) {
        return false;
      }

      const expiryDate = insurance.getExpiryDate();
      const now = new Date();
      if (expiryDate <= now) {
        return false;
      }

      if (insurance.getCoverageAmount().getAmount() < 500000) {
        return false;
      }

      return true;
    });
  }

  async findHighRiskVendors(organizationId: string): Promise<Vendor[]> {
    const vendors = await this.vendorRepository.findByOrganization(organizationId);

    return vendors.filter((vendor) => {
      // Duplicate logic with slight variations
      const insurance = vendor.getInsurance();
      if (!insurance) {
        return true; // No insurance is high risk
      }

      const expiryDate = insurance.getExpiryDate();
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      if (expiryDate <= thirtyDaysFromNow) {
        return true; // Expiring soon is high risk
      }

      if (insurance.getCoverageAmount().getAmount() < 1000000) {
        return true; // Low coverage is high risk
      }

      // More complex risk assessment logic...
      return false;
    });
  }

  async validateVendorForActivation(vendor: Vendor): Promise<ValidationResult> {
    // Validation logic mixed with query logic
    const errors: string[] = [];

    if (!vendor.hasValidInsurance()) {
      errors.push('Vendor must have valid insurance');
    }

    if (vendor.getContactInfo().getEmail().getValue() === '') {
      errors.push('Vendor must have email contact');
    }

    // More validation rules...

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
```

### After: Specification Pattern

```typescript
// Base specification interface
export abstract class Specification<T> {
  abstract isSatisfiedBy(candidate: T): boolean;

  and(other: Specification<T>): AndSpecification<T> {
    return new AndSpecification(this, other);
  }

  or(other: Specification<T>): OrSpecification<T> {
    return new OrSpecification(this, other);
  }

  not(): NotSpecification<T> {
    return new NotSpecification(this);
  }

  // For repository integration
  abstract toQueryExpression(): QueryExpression;
}

// Composite specifications
export class AndSpecification<T> extends Specification<T> {
  constructor(
    private readonly left: Specification<T>,
    private readonly right: Specification<T>,
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) && this.right.isSatisfiedBy(candidate);
  }

  toQueryExpression(): QueryExpression {
    return {
      type: 'AND',
      left: this.left.toQueryExpression(),
      right: this.right.toQueryExpression(),
    };
  }
}

export class OrSpecification<T> extends Specification<T> {
  constructor(
    private readonly left: Specification<T>,
    private readonly right: Specification<T>,
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) || this.right.isSatisfiedBy(candidate);
  }

  toQueryExpression(): QueryExpression {
    return {
      type: 'OR',
      left: this.left.toQueryExpression(),
      right: this.right.toQueryExpression(),
    };
  }
}

export class NotSpecification<T> extends Specification<T> {
  constructor(private readonly specification: Specification<T>) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return !this.specification.isSatisfiedBy(candidate);
  }

  toQueryExpression(): QueryExpression {
    return {
      type: 'NOT',
      operand: this.specification.toQueryExpression(),
    };
  }
}

// Concrete vendor specifications
export class ActiveVendorSpecification extends Specification<Vendor> {
  isSatisfiedBy(vendor: Vendor): boolean {
    return vendor.getStatus().isActive();
  }

  toQueryExpression(): QueryExpression {
    return {
      type: 'EQUALS',
      field: 'status',
      value: VendorStatus.ACTIVE,
    };
  }
}

export class ValidInsuranceSpecification extends Specification<Vendor> {
  isSatisfiedBy(vendor: Vendor): boolean {
    const insurance = vendor.getInsurance();

    if (!insurance) {
      return false;
    }

    return insurance.isValid() && !insurance.isExpired();
  }

  toQueryExpression(): QueryExpression {
    const now = new Date();
    return {
      type: 'AND',
      left: {
        type: 'NOT_NULL',
        field: 'insurance',
      },
      right: {
        type: 'GREATER_THAN',
        field: 'insurance.expiryDate',
        value: now,
      },
    };
  }
}

export class MinimumInsuranceCoverageSpecification extends Specification<Vendor> {
  constructor(private readonly minAmount: number) {
    super();
  }

  isSatisfiedBy(vendor: Vendor): boolean {
    const insurance = vendor.getInsurance();

    if (!insurance) {
      return false;
    }

    return insurance.getCoverageAmount().getAmount() >= this.minAmount;
  }

  toQueryExpression(): QueryExpression {
    return {
      type: 'GREATER_THAN_OR_EQUALS',
      field: 'insurance.coverageAmount',
      value: this.minAmount,
    };
  }
}

export class HasValidEmailSpecification extends Specification<Vendor> {
  isSatisfiedBy(vendor: Vendor): boolean {
    const email = vendor.getContactInfo().getEmail();
    return email && email.getValue() !== '' && email.isValid();
  }

  toQueryExpression(): QueryExpression {
    return {
      type: 'AND',
      left: {
        type: 'NOT_NULL',
        field: 'contactInfo.email',
      },
      right: {
        type: 'NOT_EQUALS',
        field: 'contactInfo.email',
        value: '',
      },
    };
  }
}

export class InsuranceExpiringSpecification extends Specification<Vendor> {
  constructor(private readonly daysAhead: number = 30) {
    super();
  }

  isSatisfiedBy(vendor: Vendor): boolean {
    const insurance = vendor.getInsurance();

    if (!insurance) {
      return true; // No insurance means "expiring"
    }

    const expiryDate = insurance.getExpiryDate();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + this.daysAhead);

    return expiryDate <= cutoffDate;
  }

  toQueryExpression(): QueryExpression {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + this.daysAhead);

    return {
      type: 'OR',
      left: {
        type: 'IS_NULL',
        field: 'insurance.expiryDate',
      },
      right: {
        type: 'LESS_THAN_OR_EQUALS',
        field: 'insurance.expiryDate',
        value: cutoffDate,
      },
    };
  }
}

// Clean service using specifications
@Injectable()
export class VendorSpecificationService {
  constructor(private readonly vendorRepository: IVendorRepository) {}

  async findActiveVendorsWithValidInsurance(organizationId: string): Promise<Vendor[]> {
    const specification = new ActiveVendorSpecification()
      .and(new ValidInsuranceSpecification())
      .and(new MinimumInsuranceCoverageSpecification(500000));

    return await this.vendorRepository.findBySpecification(specification, organizationId);
  }

  async findHighRiskVendors(organizationId: string): Promise<Vendor[]> {
    const highRiskSpecification = new InsuranceExpiringSpecification(30)
      .or(new MinimumInsuranceCoverageSpecification(1000000).not())
      .or(new ValidInsuranceSpecification().not());

    return await this.vendorRepository.findBySpecification(highRiskSpecification, organizationId);
  }

  validateVendorForActivation(vendor: Vendor): ValidationResult {
    const activationRequirements = new ValidInsuranceSpecification()
      .and(new HasValidEmailSpecification())
      .and(new MinimumInsuranceCoverageSpecification(500000));

    const isValid = activationRequirements.isSatisfiedBy(vendor);

    if (isValid) {
      return ValidationResult.success();
    }

    // Collect specific validation errors
    const errors: string[] = [];

    if (!new ValidInsuranceSpecification().isSatisfiedBy(vendor)) {
      errors.push('Vendor must have valid, non-expired insurance');
    }

    if (!new HasValidEmailSpecification().isSatisfiedBy(vendor)) {
      errors.push('Vendor must have a valid email address');
    }

    if (!new MinimumInsuranceCoverageSpecification(500000).isSatisfiedBy(vendor)) {
      errors.push('Vendor insurance must have minimum $500,000 coverage');
    }

    return ValidationResult.failure(errors);
  }
}
```

## Repository Query Integration

### Query Expression Translation

```typescript
// Query expression types
export interface QueryExpression {
  type: string;
  field?: string;
  value?: any;
  left?: QueryExpression;
  right?: QueryExpression;
  operand?: QueryExpression;
}

// Query translator for Drizzle ORM
export class DrizzleQueryTranslator {
  static translate(expression: QueryExpression): any {
    switch (expression.type) {
      case 'EQUALS':
        return eq(this.getField(expression.field!), expression.value);

      case 'NOT_EQUALS':
        return ne(this.getField(expression.field!), expression.value);

      case 'GREATER_THAN':
        return gt(this.getField(expression.field!), expression.value);

      case 'GREATER_THAN_OR_EQUALS':
        return gte(this.getField(expression.field!), expression.value);

      case 'LESS_THAN':
        return lt(this.getField(expression.field!), expression.value);

      case 'LESS_THAN_OR_EQUALS':
        return lte(this.getField(expression.field!), expression.value);

      case 'IS_NULL':
        return isNull(this.getField(expression.field!));

      case 'NOT_NULL':
        return isNotNull(this.getField(expression.field!));

      case 'AND':
        return and(this.translate(expression.left!), this.translate(expression.right!));

      case 'OR':
        return or(this.translate(expression.left!), this.translate(expression.right!));

      case 'NOT':
        return not(this.translate(expression.operand!));

      default:
        throw new Error(`Unsupported query expression type: ${expression.type}`);
    }
  }

  private static getField(fieldPath: string): any {
    // Handle nested field access like 'insurance.expiryDate'
    const parts = fieldPath.split('.');

    if (parts.length === 1) {
      return vendors[parts[0]];
    }

    // For JSON fields
    if (parts[0] === 'insurance') {
      return sql`${vendors.insurance}->>'${parts[1]}'`;
    }

    if (parts[0] === 'contactInfo') {
      return sql`${vendors.contactInfo}->>'${parts[1]}'`;
    }

    throw new Error(`Unsupported field path: ${fieldPath}`);
  }
}

// Repository with specification support
export interface IVendorRepository {
  findBySpecification(
    specification: Specification<Vendor>,
    organizationId: string,
  ): Promise<Vendor[]>;
}

@Injectable()
export class VendorRepository implements IVendorRepository {
  constructor(
    @Inject('DATABASE_CONNECTION')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findBySpecification(
    specification: Specification<Vendor>,
    organizationId: string,
  ): Promise<Vendor[]> {
    const queryExpression = specification.toQueryExpression();
    const whereCondition = DrizzleQueryTranslator.translate(queryExpression);

    const results = await this.db
      .select()
      .from(vendors)
      .where(and(eq(vendors.organizationId, organizationId), whereCondition));

    return results.map((row) => this.mapToDomainEntity(row));
  }
}
```

## Complex Business Rules

### Lease Operating Statement Specifications

```typescript
export class DraftLosSpecification extends Specification<LeaseOperatingStatement> {
  isSatisfiedBy(los: LeaseOperatingStatement): boolean {
    return los.getStatus().isDraft();
  }

  toQueryExpression(): QueryExpression {
    return {
      type: 'EQUALS',
      field: 'status',
      value: LosStatus.DRAFT,
    };
  }
}

export class LosWithExpensesSpecification extends Specification<LeaseOperatingStatement> {
  isSatisfiedBy(los: LeaseOperatingStatement): boolean {
    return los.getTotalExpenses().getAmount() > 0;
  }

  toQueryExpression(): QueryExpression {
    return {
      type: 'GREATER_THAN',
      field: 'totalExpenses',
      value: 0,
    };
  }
}

export class LosForMonthSpecification extends Specification<LeaseOperatingStatement> {
  constructor(private readonly month: StatementMonth) {
    super();
  }

  isSatisfiedBy(los: LeaseOperatingStatement): boolean {
    return los.getStatementMonth().equals(this.month);
  }

  toQueryExpression(): QueryExpression {
    return {
      type: 'EQUALS',
      field: 'statementMonth',
      value: this.month.toString(),
    };
  }
}

export class FinalizableLosSpecification extends Specification<LeaseOperatingStatement> {
  isSatisfiedBy(los: LeaseOperatingStatement): boolean {
    return (
      los.getStatus().isDraft() &&
      los.getTotalExpenses().getAmount() > 0 &&
      los.hasAllRequiredData()
    );
  }

  toQueryExpression(): QueryExpression {
    return {
      type: 'AND',
      left: {
        type: 'EQUALS',
        field: 'status',
        value: LosStatus.DRAFT,
      },
      right: {
        type: 'GREATER_THAN',
        field: 'totalExpenses',
        value: 0,
      },
    };
  }
}

// Usage in LOS service
@Injectable()
export class LosSpecificationService {
  constructor(private readonly losRepository: ILosRepository) {}

  async findFinalizableLos(organizationId: string): Promise<LeaseOperatingStatement[]> {
    const finalizableSpec = new FinalizableLosSpecification();

    return await this.losRepository.findBySpecification(finalizableSpec, organizationId);
  }

  async findDraftLosWithExpensesForMonth(
    organizationId: string,
    month: StatementMonth,
  ): Promise<LeaseOperatingStatement[]> {
    const specification = new DraftLosSpecification()
      .and(new LosWithExpensesSpecification())
      .and(new LosForMonthSpecification(month));

    return await this.losRepository.findBySpecification(specification, organizationId);
  }
}
```

## Specification Factory

### Dynamic Specification Building

```typescript
export class VendorSpecificationFactory {
  static createActiveWithValidInsurance(): Specification<Vendor> {
    return new ActiveVendorSpecification().and(new ValidInsuranceSpecification());
  }

  static createHighRisk(): Specification<Vendor> {
    return new InsuranceExpiringSpecification(30)
      .or(new MinimumInsuranceCoverageSpecification(1000000).not())
      .or(new ValidInsuranceSpecification().not());
  }

  static createForActivation(): Specification<Vendor> {
    return new ValidInsuranceSpecification()
      .and(new HasValidEmailSpecification())
      .and(new MinimumInsuranceCoverageSpecification(500000));
  }

  static createFromFilters(filters: VendorFilters): Specification<Vendor> {
    let spec: Specification<Vendor> = new TrueSpecification<Vendor>();

    if (filters.status) {
      spec = spec.and(new VendorStatusSpecification(filters.status));
    }

    if (filters.minInsuranceCoverage) {
      spec = spec.and(new MinimumInsuranceCoverageSpecification(filters.minInsuranceCoverage));
    }

    if (filters.insuranceExpiringInDays) {
      spec = spec.and(new InsuranceExpiringSpecification(filters.insuranceExpiringInDays));
    }

    if (filters.hasEmail) {
      spec = spec.and(new HasValidEmailSpecification());
    }

    return spec;
  }
}

// Always true specification for building
export class TrueSpecification<T> extends Specification<T> {
  isSatisfiedBy(candidate: T): boolean {
    return true;
  }

  toQueryExpression(): QueryExpression {
    return {
      type: 'EQUALS',
      field: '1',
      value: 1,
    };
  }
}

// Usage
export class VendorController {
  @Get()
  async getVendors(@Query() filters: VendorFiltersDto): Promise<VendorDto[]> {
    const specification = VendorSpecificationFactory.createFromFilters(filters);

    const vendors = await this.vendorRepository.findBySpecification(
      specification,
      filters.organizationId,
    );

    return vendors.map((v) => VendorDtoMapper.toDto(v));
  }
}
```

## Testing Specifications

### Unit Testing Specifications

```typescript
describe('VendorSpecifications', () => {
  let activeVendor: Vendor;
  let inactiveVendor: Vendor;
  let vendorWithExpiredInsurance: Vendor;

  beforeEach(() => {
    activeVendor = createTestVendor({
      status: VendorStatus.ACTIVE,
      insurance: createValidInsurance(),
    });

    inactiveVendor = createTestVendor({
      status: VendorStatus.INACTIVE,
      insurance: createValidInsurance(),
    });

    vendorWithExpiredInsurance = createTestVendor({
      status: VendorStatus.ACTIVE,
      insurance: createExpiredInsurance(),
    });
  });

  describe('ActiveVendorSpecification', () => {
    it('should return true for active vendors', () => {
      const spec = new ActiveVendorSpecification();

      expect(spec.isSatisfiedBy(activeVendor)).toBe(true);
      expect(spec.isSatisfiedBy(inactiveVendor)).toBe(false);
    });
  });

  describe('ValidInsuranceSpecification', () => {
    it('should return true for vendors with valid insurance', () => {
      const spec = new ValidInsuranceSpecification();

      expect(spec.isSatisfiedBy(activeVendor)).toBe(true);
      expect(spec.isSatisfiedBy(vendorWithExpiredInsurance)).toBe(false);
    });
  });

  describe('Composite specifications', () => {
    it('should combine specifications with AND', () => {
      const spec = new ActiveVendorSpecification().and(new ValidInsuranceSpecification());

      expect(spec.isSatisfiedBy(activeVendor)).toBe(true);
      expect(spec.isSatisfiedBy(inactiveVendor)).toBe(false);
      expect(spec.isSatisfiedBy(vendorWithExpiredInsurance)).toBe(false);
    });

    it('should combine specifications with OR', () => {
      const spec = new ActiveVendorSpecification().or(new ValidInsuranceSpecification());

      expect(spec.isSatisfiedBy(activeVendor)).toBe(true);
      expect(spec.isSatisfiedBy(inactiveVendor)).toBe(true); // Has valid insurance
      expect(spec.isSatisfiedBy(vendorWithExpiredInsurance)).toBe(true); // Is active
    });

    it('should negate specifications with NOT', () => {
      const spec = new ActiveVendorSpecification().not();

      expect(spec.isSatisfiedBy(activeVendor)).toBe(false);
      expect(spec.isSatisfiedBy(inactiveVendor)).toBe(true);
    });
  });
});
```

### Integration Testing with Repository

```typescript
describe('VendorRepository with Specifications', () => {
  let repository: VendorRepository;
  let testDb: Database;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    repository = new VendorRepository(testDb);
  });

  beforeEach(async () => {
    await seedTestVendors(testDb);
  });

  it('should find vendors by specification', async () => {
    const specification = new ActiveVendorSpecification().and(new ValidInsuranceSpecification());

    const vendors = await repository.findBySpecification(specification, 'test-org-id');

    expect(vendors.length).toBeGreaterThan(0);
    vendors.forEach((vendor) => {
      expect(vendor.getStatus().isActive()).toBe(true);
      expect(vendor.getInsurance()?.isValid()).toBe(true);
    });
  });

  it('should translate complex specifications to queries', async () => {
    const specification = new InsuranceExpiringSpecification(30).or(
      new MinimumInsuranceCoverageSpecification(1000000).not(),
    );

    const vendors = await repository.findBySpecification(specification, 'test-org-id');

    // Verify results match the specification
    vendors.forEach((vendor) => {
      const expiringSpec = new InsuranceExpiringSpecification(30);
      const coverageSpec = new MinimumInsuranceCoverageSpecification(1000000);

      const matchesExpiring = expiringSpec.isSatisfiedBy(vendor);
      const matchesCoverage = !coverageSpec.isSatisfiedBy(vendor);

      expect(matchesExpiring || matchesCoverage).toBe(true);
    });
  });
});
```

## Best Practices

### 1. Single Responsibility

```typescript
// Good: Each specification has one responsibility
export class ActiveVendorSpecification extends Specification<Vendor> {
  isSatisfiedBy(vendor: Vendor): boolean {
    return vendor.getStatus().isActive();
  }
}

export class ValidInsuranceSpecification extends Specification<Vendor> {
  isSatisfiedBy(vendor: Vendor): boolean {
    return vendor.getInsurance()?.isValid() ?? false;
  }
}

// Avoid: Multiple responsibilities in one specification
export class ActiveVendorWithValidInsuranceSpecification extends Specification<Vendor> {
  isSatisfiedBy(vendor: Vendor): boolean {
    return (vendor.getStatus().isActive() && vendor.getInsurance()?.isValid()) ?? false;
  }
}
```

### 2. Immutable Specifications

```typescript
// Good: Specifications are immutable
export class MinimumInsuranceCoverageSpecification extends Specification<Vendor> {
  constructor(private readonly minAmount: number) {
    super();
  }

  isSatisfiedBy(vendor: Vendor): boolean {
    return vendor.getInsurance()?.getCoverageAmount().getAmount() >= this.minAmount;
  }
}

// Avoid: Mutable specifications
export class MinimumInsuranceCoverageSpecification extends Specification<Vendor> {
  private minAmount: number;

  setMinAmount(amount: number): void {
    this.minAmount = amount; // Mutable state
  }
}
```

### 3. Clear Naming

```typescript
// Good: Names clearly express business intent
export class VendorEligibleForPaymentSpecification extends Specification<Vendor> {}
export class InsuranceExpiringWithinDaysSpecification extends Specification<Vendor> {}
export class HighRiskVendorSpecification extends Specification<Vendor> {}

// Avoid: Technical or unclear names
export class VendorFilterSpecification extends Specification<Vendor> {}
export class DateCheckSpecification extends Specification<Vendor> {}
export class ComplexRuleSpecification extends Specification<Vendor> {}
```

The Specification pattern in our oil & gas management system allows us to
express complex business rules as reusable, testable objects that can be
combined and efficiently translated to database queries, keeping our domain
logic clean and maintainable.
