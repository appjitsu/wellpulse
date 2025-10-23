# Architectural Consistency Guardian

Validate hexagonal architecture compliance and detect layer boundary violations.

Analyzes files to ensure they follow the codebase's hexagonal architecture principles:

**Presentation → Application → Domain ← Infrastructure**

## What This Command Checks

1. **Layer Boundary Violations**
   - Controllers should NOT import Repositories directly
   - Domain should NOT import Infrastructure
   - Presentation should NOT import Infrastructure (except DTOs)
   - All layers can import Domain

2. **CQRS Separation**
   - Commands should modify state, Queries should only read
   - Handlers should be in Application layer
   - Commands/Queries should not contain business logic

3. **Dependency Direction**
   - All dependencies point inward toward Domain
   - Infrastructure depends on Domain interfaces
   - Application uses Domain entities and repositories via interfaces

4. **Pattern Compliance**
   - Repository pattern usage (no direct DB access in domain)
   - DTO pattern (presentation layer boundaries)
   - Value Objects used correctly in domain
   - Domain events published for side effects

## Usage

```bash
/arch-check path/to/file.ts
/arch-check apps/api/src/presentation/estimate/
/arch-check apps/api/src/  # Check entire backend
```

## Analysis Process

1. **Read File(s)**: Load target file(s) and analyze imports
2. **Identify Layer**: Determine which architectural layer (based on path)
3. **Check Imports**: Validate all import statements against layer rules
4. **Detect Anti-Patterns**: Look for common violations
5. **Suggest Fixes**: Provide specific refactoring guidance

## Example Output

```text
🏛️ Architecture Analysis: estimate.controller.ts

Layer: Presentation
✓ Correct layer placement

Import Analysis:
  ✓ @nestjs/common (framework - allowed)
  ✓ ../application/commands (Application layer - allowed)
  ✓ ../application/queries (Application layer - allowed)
  ✓ ../../domain/estimate/estimate.entity (Domain - allowed for DTOs)
  ❌ ../../infrastructure/database/repositories/drizzle-estimate.repository

🚫 VIOLATION DETECTED

Issue: Controller directly imports Infrastructure layer
Line 12: import { DrizzleEstimateRepository } from '../../infrastructure/...'

Why this breaks architecture:
  - Presentation should communicate via Application layer (CQRS)
  - Controllers should use CommandBus/QueryBus, not repositories
  - Direct repository access bypasses business logic and validation

✅ Suggested Fix:

Remove direct repository import. Instead, send commands/queries:

// Before (❌ violates layer boundary)
constructor(private estimateRepo: DrizzleEstimateRepository) {}

async getEstimate(id: string) {
  return this.estimateRepo.findById(id);
}

// After (✅ follows hexagonal architecture)
constructor(
  private queryBus: QueryBus,
  private commandBus: CommandBus
) {}

async getEstimate(id: string) {
  return this.queryBus.execute(new GetEstimateByIdQuery(id));
}

Files to create/modify:
  1. Create GetEstimateByIdQuery: apps/api/src/application/estimate/queries/
  2. Create GetEstimateByIdHandler: apps/api/src/application/estimate/queries/
  3. Update controller to use QueryBus
  4. Register handler in estimate.module.ts

Reference: docs/patterns/05-CQRS-Pattern.md
```

## Common Violations & Fixes

### ❌ Violation 1: Controller → Repository

```typescript
// BAD: Controller directly uses repository
@Controller('estimates')
export class EstimateController {
  constructor(private estimateRepo: IEstimateRepository) {}
}
```

**Fix**: Use CommandBus/QueryBus

```typescript
// GOOD: Controller uses CQRS
@Controller('estimates')
export class EstimateController {
  constructor(private queryBus: QueryBus) {}

  @Get(':id')
  async getEstimate(@Param('id') id: string) {
    return this.queryBus.execute(new GetEstimateByIdQuery(id));
  }
}
```

### ❌ Violation 2: Domain → Infrastructure

```typescript
// BAD: Domain entity imports infrastructure
import { DatabaseConnection } from '../../infrastructure/database';

export class Estimate {
  save() {
    DatabaseConnection.execute(...); // ❌
  }
}
```

**Fix**: Use Repository Pattern

```typescript
// GOOD: Domain defines interface, infrastructure implements
export interface IEstimateRepository {
  save(estimate: Estimate): Promise<void>;
}

// Domain entity stays pure
export class Estimate {
  // No infrastructure dependencies
  // Just business logic
}

// Infrastructure implements the interface
export class DrizzleEstimateRepository implements IEstimateRepository {
  async save(estimate: Estimate): Promise<void> {
    // Database-specific code here
  }
}
```

### ❌ Violation 3: Business Logic in Controller

```typescript
// BAD: Business logic in presentation layer
@Post()
async createEstimate(@Body() dto: CreateEstimateDto) {
  if (dto.lineItems.length === 0) {
    throw new BadRequestException('Estimate must have line items');
  }
  const total = dto.lineItems.reduce((sum, item) => sum + item.amount, 0);
  // ... more business logic
}
```

**Fix**: Move to Domain/Application

```typescript
// GOOD: Controller delegates to command handler
@Post()
async createEstimate(@Body() dto: CreateEstimateDto) {
  return this.commandBus.execute(new CreateEstimateCommand(dto));
}

// Business logic in domain entity
export class Estimate {
  static create(data: CreateEstimateData): Estimate {
    if (data.lineItems.length === 0) {
      throw new DomainException('Estimate must have line items');
    }
    const total = this.calculateTotal(data.lineItems);
    return new Estimate({ ...data, total });
  }
}
```

## CQRS Checklist

When analyzing CQRS implementations:

**Commands** (modify state):

- ✓ Located in `application/{entity}/commands/`
- ✓ Named with imperative verbs: CreateEstimate, SendEstimate, ApproveEstimate
- ✓ Return void or entity ID (not full entity)
- ✓ Publish domain events for side effects

**Queries** (read-only):

- ✓ Located in `application/{entity}/queries/`
- ✓ Named with "Get" or "Find": GetEstimate, GetEstimateList
- ✓ Never modify state
- ✓ Return DTOs, not domain entities directly

**Handlers**:

- ✓ Use repositories via interfaces
- ✓ Orchestrate domain entities
- ✓ Handle transactions
- ✓ Emit events

## Pattern References

This command enforces patterns from:

- **Hexagonal Architecture** (docs/patterns/01-Hexagonal-Architecture.md)
- **CQRS Pattern** (docs/patterns/05-CQRS-Pattern.md)
- **Repository Pattern** (docs/patterns/06-Repository-Pattern.md)
- **Domain-Driven Design** (docs/patterns/02-Domain-Driven-Design.md)

## After Analysis

If violations found:

1. Review suggested fixes carefully
2. Refactor code to follow layer boundaries
3. Run `/arch-check` again to verify
4. Update tests to reflect new structure
5. Run `/quality` to ensure no regressions
