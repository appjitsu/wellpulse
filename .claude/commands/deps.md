# Dependency Graph Navigator

Visualize and analyze file dependencies across the monorepo.

Helps understand impact of changes and prevents circular dependencies.

## What This Command Shows

1. **Dependency Tree**
   - Files that import the target file ("used by")
   - Files that the target imports ("depends on")
   - Full dependency chain

2. **Impact Analysis**
   - How many files affected by a change
   - Ripple effect visualization
   - Test coverage needed

3. **Circular Dependencies**
   - Detection of import cycles
   - Suggestions to break cycles

4. **Layer Violations**
   - Cross-layer imports
   - Architecture boundary violations

## Usage

```bash
/deps estimate.entity.ts
/deps apps/api/src/domain/estimate/
/deps estimate.entity.ts --full  # Include transitive dependencies
```

## Example Output

```text
📦 Dependency Analysis: estimate.entity.ts

════════════════════════════════════════════════════════════════

USED BY (12 files depend on this entity):

Application Layer (6 files):
  ✓ apps/api/src/application/estimate/commands/create-estimate.handler.ts
  ✓ apps/api/src/application/estimate/commands/send-estimate.handler.ts
  ✓ apps/api/src/application/estimate/commands/accept-estimate.handler.ts
  ✓ apps/api/src/application/estimate/queries/get-estimate-by-id.handler.ts
  ✓ apps/api/src/application/estimate/queries/get-estimates.handler.ts
  ✓ apps/api/src/application/project/commands/create-project-from-estimate.handler.ts

Infrastructure Layer (2 files):
  ✓ apps/api/src/infrastructure/database/repositories/drizzle-estimate.repository.ts
  ✓ apps/api/src/infrastructure/pdf/estimate-pdf.service.ts

Presentation Layer (3 files):
  ✓ apps/api/src/presentation/estimate/estimate.controller.ts
  ✓ apps/api/src/presentation/estimate/dto/estimate-response.dto.ts
  ✓ apps/api/src/presentation/project/dto/create-project-from-estimate.dto.ts

Test Files (1 file):
  ✓ apps/api/src/domain/estimate/__tests__/estimate.entity.spec.ts

════════════════════════════════════════════════════════════════

DEPENDS ON (4 files):

Domain Layer:
  ✓ apps/api/src/domain/estimate/estimate-status.enum.ts
  ✓ apps/api/src/domain/estimate/estimate-line-item.entity.ts
  ✓ apps/api/src/domain/shared/money.vo.ts
  ✓ apps/api/src/domain/shared/base.entity.ts

External:
  ✓ class-validator (decorators)

════════════════════════════════════════════════════════════════

IMPACT ANALYSIS

Direct Impact: 12 files
Transitive Impact: 34 files (files that depend on the 12 direct dependencies)

Affected Layers:
  - Domain: 1 file (this file)
  - Application: 6 files
  - Infrastructure: 2 files
  - Presentation: 3 files

Test Coverage Required:
  - Unit tests: estimate.entity.spec.ts (existing)
  - Integration tests: 2 handler tests need update
  - E2E tests: estimate.controller E2E test

⚠️ HIGH IMPACT: Changing Estimate entity affects 12 files!

Recommended Approach:
  1. Make changes to estimate.entity.ts
  2. Update unit tests first
  3. Fix compilation errors in handlers (Application layer)
  4. Update repository mapping (Infrastructure layer)
  5. Update DTOs (Presentation layer)
  6. Run integration tests
  7. Run E2E tests
  8. Verify frontend still works

Estimated Effort: 4-6 hours (due to high impact)

════════════════════════════════════════════════════════════════

DEPENDENCY VISUALIZATION

estimate.entity.ts
├── Used by Application Layer
│   ├── create-estimate.handler.ts
│   │   ├── estimate.controller.ts (@Post)
│   │   └── estimate.e2e-spec.ts
│   ├── send-estimate.handler.ts
│   │   ├── estimate.controller.ts (@Post :id/send)
│   │   └── estimate.e2e-spec.ts
│   ├── accept-estimate.handler.ts
│   │   ├── estimate.controller.ts (@Post :id/accept)
│   │   └── client-portal.controller.ts
│   └── create-project-from-estimate.handler.ts
│       ├── project.controller.ts (@Post from-estimate)
│       └── apps/web/hooks/use-create-project-from-estimate.ts
│
├── Used by Infrastructure Layer
│   ├── drizzle-estimate.repository.ts
│   │   └── [Used by all handlers above]
│   └── estimate-pdf.service.ts
│       └── generate-pdf.handler.ts
│
└── Used by Presentation Layer
    ├── estimate.controller.ts (DTOs only)
    └── estimate-response.dto.ts
        └── apps/web/types/estimate.types.ts

════════════════════════════════════════════════════════════════

CIRCULAR DEPENDENCY CHECK

✅ No circular dependencies detected!

All imports follow proper layer hierarchy:
  Presentation → Application → Domain ← Infrastructure

No backwards imports found.

════════════════════════════════════════════════════════════════

CROSS-MONOREPO USAGE

Frontend files that use estimate data:

Direct API Calls:
  ✓ apps/web/lib/repositories/estimate.repository.ts
  ✓ apps/web/hooks/use-estimates.ts
  ✓ apps/web/hooks/use-estimate.ts
  ✓ apps/web/hooks/use-create-estimate.ts
  ✓ apps/web/hooks/use-send-estimate.ts

Components:
  ✓ apps/web/components/estimate/estimate-form.tsx
  ✓ apps/web/components/estimate/estimate-list.tsx
  ✓ apps/web/components/estimate/estimate-detail.tsx
  ✓ apps/web/components/estimate/accept-estimate-dialog.tsx

Pages:
  ✓ apps/web/app/(dashboard)/estimates/page.tsx
  ✓ apps/web/app/(dashboard)/estimates/[id]/page.tsx
  ✓ apps/web/app/(dashboard)/estimates/new/page.tsx

⚠️ Frontend Impact: 11 files will need testing after backend changes

Recommended:
  - Test estimate list page
  - Test estimate creation flow
  - Test estimate acceptance flow
  - Verify TypeScript types still match
```

## Use Cases

### Use Case 1: Before Refactoring

```bash
# Want to rename Estimate.send() to Estimate.sendToClient()
/deps estimate.entity.ts

# Output shows 6 handlers use send()
# Now you know: need to update 6 handlers + their tests
```

### Use Case 2: Detect Circular Dependencies

```bash
/deps --circular apps/api/src/

# Output:
🔴 Circular dependency detected!

estimate.entity.ts
  → imports estimate-line-item.entity.ts
    → imports estimate.entity.ts  ❌ CYCLE!

Fix: Remove import from estimate-line-item.entity.ts
```

### Use Case 3: Find Dead Code

```bash
/deps old-calculator.service.ts

# Output:
USED BY: 0 files

⚠️ Dead code detected!
This file is not imported anywhere. Safe to delete?

Check:
  - Git history (was it used before?)
  - Comments (is it planned for future use?)
  - Tests (does it have tests?)
```

### Use Case 4: Understand Feature Scope

```bash
/deps --feature estimate

# Shows ALL files related to estimates across layers
# Helps estimate effort for feature removal or refactoring
```

## Dependency Patterns

### ✅ Good: Unidirectional Dependencies

```
Presentation → Application → Domain ← Infrastructure

estimate.controller.ts (Presentation)
  → imports create-estimate.handler.ts (Application)
    → imports estimate.entity.ts (Domain)

drizzle-estimate.repository.ts (Infrastructure)
  → imports estimate.entity.ts (Domain)
```

### ❌ Bad: Circular Dependencies

```
estimate.entity.ts
  → imports estimate-validator.ts
    → imports estimate.entity.ts  ❌ CYCLE!
```

Fix: Extract interface or move validation

### ❌ Bad: Layer Violations

```
estimate.controller.ts (Presentation)
  → imports drizzle-estimate.repository.ts (Infrastructure)  ❌ VIOLATION!
```

Fix: Use CQRS (commands/queries) instead

## Advanced Analysis

### Transitive Dependencies

```bash
/deps estimate.entity.ts --transitive

# Shows:
# estimate.entity.ts (0)
#   → create-estimate.handler.ts (1)
#     → estimate.controller.ts (2)
#       → apps/web/hooks/use-create-estimate.ts (3)
#         → apps/web/components/estimate/estimate-form.tsx (4)
#
# 5 levels deep!
```

### Dependency Metrics

```bash
/deps --metrics apps/api/src/

# Output:
Most Depended On (top 10):
  1. base.entity.ts (45 files depend on it)
  2. user.entity.ts (32 files)
  3. organization.entity.ts (28 files)
  4. money.vo.ts (24 files)

Most Dependencies (top 10):
  1. create-project.handler.ts (depends on 18 files)
  2. invoice-pdf.service.ts (depends on 15 files)

Potential Issues:
  - base.entity.ts is heavily coupled (45 dependencies)
    Consider: Breaking into smaller abstractions
```

## After Dependency Analysis

1. **For Refactoring**: Update all dependent files in order (bottom-up)
2. **For Breaking Changes**: Assess impact, create migration plan
3. **For Circular Dependencies**: Refactor to break cycles
4. **For Dead Code**: Remove unused files
5. **For High Coupling**: Consider breaking into smaller modules
