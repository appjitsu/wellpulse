# Test Coverage Strategy Planner

Generate comprehensive test strategy with effort estimates and coverage targets.

Analyzes code complexity and suggests optimal test approach to reach 80%+ coverage.

## What This Command Does

1. **Analyze Code Complexity**
   - Count public methods and their cyclomatic complexity
   - Identify business rules and edge cases
   - Detect error handling paths
   - Find integration points (database, external APIs)

2. **Generate Test Plan**
   - Unit tests (entities, value objects, pure functions)
   - Integration tests (repositories, services with dependencies)
   - E2E tests (controllers, full request/response flow)
   - Test count estimates with time allocation

3. **Prioritize Test Cases**
   - Critical paths (authentication, payments, data loss scenarios)
   - Happy paths (standard user flows)
   - Edge cases (null values, boundary conditions, concurrent access)
   - Error paths (validation failures, external service errors)

4. **Estimate Effort**
   - Time per test type based on complexity
   - Total time to reach target coverage
   - Suggest test implementation order

## Usage

```bash
/test-strategy estimate.entity.ts
/test-strategy apps/api/src/application/estimate/
/test-strategy apps/web/components/estimate/estimate-form.tsx
```

## Analysis Output Example

```text
📊 Test Strategy: estimate.entity.ts (658 lines)

Code Analysis:
  - Public methods: 15
  - Business rules: 8 (status transitions, calculations, validations)
  - Integration points: 0 (pure domain entity)
  - Cyclomatic complexity: Medium (avg 3.2 per method)

Current Coverage: 0% → Target: 85%

═══════════════════════════════════════════════════════════════

UNIT TESTS (Required)
─────────────────────────────────────────────────────────────

Critical Business Logic (12 tests, ~30 minutes):

  ✓ Estimate.create()
    - Creates DRAFT estimate with valid data
    - Throws error if no line items
    - Calculates correct subtotal and total
    - Initializes audit fields

  ✓ addLineItem()
    - Adds line item to DRAFT estimate
    - Recalculates totals correctly
    - Throws error for non-DRAFT estimates
    - Returns new immutable instance

  ✓ removeLineItem()
    - Removes line item by ID
    - Recalculates totals
    - Throws error if last line item
    - Immutability preserved

  ✓ send()
    - Transitions DRAFT → SENT
    - Sets issue date and valid until
    - Throws if no line items
    - Throws if already sent

  ✓ accept()
    - Transitions SENT → ACCEPTED
    - Records client acceptance metadata
    - Publishes EstimateAcceptedEvent
    - Cannot accept DRAFT or REJECTED

  ✓ reject()
    - Transitions SENT → REJECTED
    - Records rejection reason
    - Cannot be accepted after rejection

  ✓ markAsConverted()
    - Sets convertedToProjectId
    - Sets convertedAt timestamp
    - Throws if not ACCEPTED
    - Throws if already converted

State Transitions (8 tests, ~20 minutes):

  ✓ DRAFT → SENT (valid)
  ✓ SENT → ACCEPTED (valid)
  ✓ SENT → REJECTED (valid)
  ✓ SENT → EXPIRED (valid, auto-check)
  ✓ DRAFT → ACCEPTED (invalid, throws)
  ✓ REJECTED → ACCEPTED (invalid, throws)
  ✓ EXPIRED → ACCEPTED (invalid, throws)
  ✓ ACCEPTED → SENT (invalid, throws)

Edge Cases (10 tests, ~25 minutes):

  ✓ Decimal precision (2 decimal places)
  ✓ Large totals ($9,999,999,999.99)
  ✓ Zero-value line items
  ✓ Negative amounts (should throw)
  ✓ Null/undefined handling
  ✓ Empty strings in text fields
  ✓ Future dates for validUntil
  ✓ Past dates for validUntil (should throw)
  ✓ Concurrent modifications (immutability test)
  ✓ Very long description (1000+ chars)

Immutability & Value Objects (5 tests, ~15 minutes):

  ✓ All methods return new instance
  ✓ Original instance unchanged after method call
  ✓ Deep equality checks
  ✓ Value object access (rates, dates)
  ✓ Freeze check (Object.isFrozen)

═══════════════════════════════════════════════════════════════

INTEGRATION TESTS (if repository exists)
─────────────────────────────────────────────────────────────

Repository Operations (6 tests, ~30 minutes):

  ✓ Save estimate with line items
  ✓ Load estimate by ID with line items
  ✓ Update estimate
  ✓ Soft delete (deletedAt set)
  ✓ Query by status
  ✓ Query by organization + client

Domain Events (4 tests, ~20 minutes):

  ✓ EstimateCreated event published
  ✓ EstimateSent event published
  ✓ EstimateAccepted event published
  ✓ EstimateRejected event published

═══════════════════════════════════════════════════════════════

SUMMARY
─────────────────────────────────────────────────────────────

Total Tests: 45 tests
Estimated Time: 140 minutes (2h 20m)
Expected Coverage: 85-90%

Test File to Create:
  apps/api/src/domain/estimate/__tests__/estimate.entity.spec.ts

Implementation Order:
  1. Happy path tests (DRAFT → SENT → ACCEPTED) - 30 min
  2. State transition matrix - 20 min
  3. Business rule validations - 30 min
  4. Edge cases and error handling - 25 min
  5. Immutability tests - 15 min
  6. Repository integration tests - 30 min
  7. Domain event tests - 20 min

Reference Existing Tests (copy patterns):
  ⭐⭐⭐⭐⭐ apps/api/src/domain/invoice/__tests__/invoice.entity.spec.ts (very similar!)
  ⭐⭐⭐⭐ apps/api/src/domain/project/__tests__/project.entity.spec.ts
```

## Test Templates

### Unit Test Template (Domain Entity)

```typescript
describe('Estimate Entity', () => {
  describe('create', () => {
    it('should create a DRAFT estimate with valid data', () => {
      // Arrange
      const data = {
        organizationId: 'org-123',
        clientId: 'client-456',
        lineItems: [{ description: 'Item 1', amount: 100 }],
        createdBy: 'user-789',
      };

      // Act
      const estimate = Estimate.create(data);

      // Assert
      expect(estimate.status).toBe(EstimateStatus.DRAFT);
      expect(estimate.total).toBe(100);
      expect(estimate.lineItems).toHaveLength(1);
    });

    it('should throw error if no line items', () => {
      // Arrange
      const data = { /* ... */, lineItems: [] };

      // Act & Assert
      expect(() => Estimate.create(data)).toThrow(
        'Estimate must have at least one line item'
      );
    });
  });

  describe('state transitions', () => {
    it('should transition from DRAFT to SENT', () => {
      // Arrange
      const estimate = Estimate.create({ /* ... */ });

      // Act
      const sent = estimate.send(new Date(), new Date(), 'user-123');

      // Assert
      expect(sent.status).toBe(EstimateStatus.SENT);
      expect(estimate.status).toBe(EstimateStatus.DRAFT); // Original unchanged
    });
  });
});
```

### Integration Test Template (Repository)

```typescript
describe('DrizzleEstimateRepository', () => {
  let repository: DrizzleEstimateRepository;
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    repository = new DrizzleEstimateRepository(testDb.connection);
  });

  afterAll(async () => {
    await testDb.teardown();
  });

  describe('save', () => {
    it('should save estimate with line items', async () => {
      // Arrange
      const estimate = Estimate.create({
        /* ... */
      });

      // Act
      await repository.save(estimate);

      // Assert
      const loaded = await repository.findById(estimate.id);
      expect(loaded).toBeDefined();
      expect(loaded.lineItems).toHaveLength(1);
    });
  });
});
```

## Coverage Goals by Layer

**Domain Layer**: 85-95% (highest priority)

- Entities: 90%+
- Value Objects: 95%+
- Domain Services: 85%+

**Application Layer**: 80-90%

- Command Handlers: 85%+
- Query Handlers: 80%+

**Infrastructure Layer**: 70-80%

- Repositories: 75%+
- External Services: 70%+

**Presentation Layer**: 70-80%

- Controllers: 75%+ (E2E tests count)
- DTOs: Low priority (simple transformations)

## After Running This Command

1. Create test file in appropriate `__tests__/` directory
2. Copy similar test file as template (e.g., invoice.entity.spec.ts)
3. Implement tests in suggested order (happy path first)
4. Run tests frequently: `pnpm --filter=api test estimate.entity.spec.ts --watch`
5. Check coverage: `pnpm --filter=api test:cov`
6. Iterate until target coverage reached
7. Run full test suite: `pnpm test`
8. Commit tests with implementation (not as separate PR)
