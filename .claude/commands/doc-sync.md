# Code-to-Documentation Sync Helper

Keep documentation in sync with code changes automatically.

Identifies documentation that needs updating when code changes.

## What This Command Does

1. **Detect Code Changes**
   - New entities, methods, or features added
   - Methods renamed or signatures changed
   - Business rules modified
   - Patterns applied

2. **Find Relevant Documentation**
   - Pattern docs that reference the changed code
   - Sprint docs that describe the feature
   - README files in domain modules
   - API documentation

3. **Suggest Documentation Updates**
   - What sections need updating
   - What new content to add
   - Outdated examples to fix

4. **Generate Documentation**
   - Auto-generate method documentation
   - Create sequence diagrams
   - Update pattern examples

## Usage

```bash
/doc-sync estimate.entity.ts
/doc-sync apps/api/src/domain/estimate/
/doc-sync --check  # Check for outdated docs
```

## Example Output

````text
📚 Documentation Sync Analysis: estimate.entity.ts

Code Changes Detected:
  ✓ New method: markAsConverted()
  ✓ New property: convertedToProjectId
  ✓ Modified method: accept() (added digitalSignature parameter)

════════════════════════════════════════════════════════════════

DOCUMENTATION TO UPDATE

1. Pattern Documentation

   File: docs/patterns/35-State-Machine-Pattern.md
   Section: "Invoice Status Transitions" (line 145)

   Current (outdated):
     ```
     SENT → ACCEPTED
     SENT → REJECTED
     ```

   Update to:
     ```
     SENT → ACCEPTED → CONVERTED_TO_PROJECT (new!)
     SENT → REJECTED
     SENT → EXPIRED
     ```

   Also add:
     - Explanation of CONVERTED state
     - When conversion happens (after acceptance)
     - ConvertedToProjectId tracking

────────────────────────────────────────────────────────────────

2. Domain README

   File: apps/api/src/domain/estimate/README.md
   Section: "Public Methods" (create if doesn't exist)

   Add documentation for new method:
     ```markdown
     ### markAsConverted(projectId: string): Estimate

     Marks an accepted estimate as converted to a project.

     **Preconditions:**
     - Estimate must be in ACCEPTED status
     - Cannot convert an estimate twice

     **Business Rules:**
     - Sets `convertedToProjectId` to track the created project
     - Sets `convertedAt` timestamp
     - Estimate remains ACCEPTED (status doesn't change)
     - Immutability: Returns new instance

     **Events Published:**
     - EstimateConvertedEvent

     **Example:**
     ```typescript
     const estimate = await estimateRepo.findById(id);
     const project = await projectFactory.createFromEstimate(estimate);
     const converted = estimate.markAsConverted(project.id);
     await estimateRepo.save(converted);
     ```

     **See Also:**
     - ProjectFactory.createFromEstimate()
     - CreateProjectFromEstimateHandler
     ```

────────────────────────────────────────────────────────────────

3. Sprint Documentation

   File: docs/sprints/sprint-09A-estimates-proposals.md
   Section: "Implementation Status"

   Add:
     ```markdown
     ## Implementation Status

     ### Completed Features
     - ✅ Estimate entity with business rules
     - ✅ Estimate → Project conversion
     - ✅ Digital signature support
     - ✅ State machine (DRAFT → SENT → ACCEPTED/REJECTED)

     ### Methods Implemented
     - `Estimate.create()` - Create new estimate
     - `Estimate.send()` - Send to client
     - `Estimate.accept()` - Client acceptance with digital signature
     - `Estimate.reject()` - Client rejection
     - `Estimate.markAsConverted()` - Track project conversion

     ### Next Steps
     - [ ] Implement PDF generation
     - [ ] Add client portal authentication
     - [ ] Create estimate templates
     ```

────────────────────────────────────────────────────────────────

4. API Documentation (OpenAPI)

   File: apps/api/src/presentation/estimate/estimate.controller.ts

   Add OpenAPI decorators:
     ```typescript
     @Post(':id/accept')
     @ApiOperation({ summary: 'Accept an estimate (client action)' })
     @ApiParam({ name: 'id', description: 'Estimate ID' })
     @ApiBody({ type: AcceptEstimateDto })
     @ApiResponse({ status: 200, description: 'Estimate accepted', type: EstimateResponseDto })
     @ApiResponse({ status: 403, description: 'Estimate not in SENT status' })
     @ApiResponse({ status: 404, description: 'Estimate not found' })
     async acceptEstimate(
       @Param('id') id: string,
       @Body() dto: AcceptEstimateDto,
     ): Promise<EstimateResponseDto> {
       // ...
     }
     ```

────────────────────────────────────────────────────────────────

5. Sequence Diagram (Auto-Generated)

   Create: docs/diagrams/estimate-acceptance-flow.md

   ```mermaid
   sequenceDiagram
       actor Client
       participant Portal as Client Portal
       participant API as Estimate API
       participant Domain as Estimate Entity
       participant Events as Event Bus
       participant Handlers as Event Handlers

       Client->>Portal: Click "Accept Estimate"
       Portal->>API: POST /estimates/{id}/accept
       API->>Domain: estimate.accept(signature, date)
       Domain->>Domain: Validate (must be SENT)
       Domain->>Domain: Update status to ACCEPTED
       Domain->>Events: Publish EstimateAcceptedEvent
       Events->>Handlers: Notify all subscribers

       par Email Notification
           Handlers->>Client: Send acceptance confirmation
       and Project Creation
           Handlers->>Domain: ProjectFactory.createFromEstimate()
           Domain->>Domain: project.create()
           Domain->>Events: Publish ProjectCreatedEvent
       and Metrics Update
           Handlers->>Domain: UpdateOrganizationHealth()
       end

       API-->>Portal: 200 OK (EstimateResponseDto)
       Portal-->>Client: Show success message
````

════════════════════════════════════════════════════════════════

SUMMARY

Files to Update: 5

- docs/patterns/35-State-Machine-Pattern.md
- apps/api/src/domain/estimate/README.md (create)
- docs/sprints/sprint-09A-estimates-proposals.md
- apps/api/src/presentation/estimate/estimate.controller.ts
- docs/diagrams/estimate-acceptance-flow.md (create)

Auto-Generated Content Available:
✓ Method documentation (JSDoc format)
✓ Sequence diagram (Mermaid)
✓ OpenAPI decorators
✓ Example code snippets

Estimated Effort: 30 minutes

Next Steps:

1. Review auto-generated content
2. Apply updates to documentation files
3. Verify diagrams render correctly
4. Commit docs with code changes (same PR)

````

## Documentation Templates

### Domain Entity README Template

```markdown
# {Entity Name}

**Domain:** {Domain Area}
**Aggregate Root:** {Yes/No}
**Status:** {Implemented/In Progress/Planned}

## Overview

{1-2 sentence description of what this entity represents}

## Business Rules

- {Rule 1}
- {Rule 2}
- {Rule 3}

## Public Methods

### create(data: Create{Entity}Data): {Entity}

{Description}

**Preconditions:**
- {Precondition 1}

**Business Rules:**
- {Rule 1}

**Events Published:**
- {EventName}

**Example:**
```typescript
{code example}
````

### {methodName}(): {ReturnType}

{Repeat for each public method}

## State Transitions

```
{Initial State} → {State 2} → {Final State}
```

## Events

### {EventName}

**When:** {Trigger condition}
**Payload:** {Payload structure}
**Subscribers:** {List of handlers}

## Value Objects

- `{ValueObject}`: {Description}

## Repository Interface

See: `apps/api/src/domain/repositories/{entity}.repository.interface.ts`

## Related Entities

- `{RelatedEntity1}`: {Relationship}
- `{RelatedEntity2}`: {Relationship}

## Pattern References

- **{Pattern Name}** (docs/patterns/{number}-{pattern-name}.md)

## Testing

- Unit tests: `apps/api/src/domain/{entity}/__tests__/{entity}.entity.spec.ts`
- Integration tests: TBD
- Coverage: {percentage}%

````

### Pattern Example Template

When code uses a pattern, add example to pattern doc:

```markdown
## Real-World Example: {Feature Name}

**File:** `{file path}`
**Context:** {Brief description}

```typescript
{relevant code snippet}
````

**Why this pattern?**

- {Reason 1}
- {Reason 2}

**Benefits achieved:**

- {Benefit 1}
- {Benefit 2}

**Lessons learned:**

- {Lesson 1}

````

## Automated Checks

Run to find outdated documentation:

```bash
# Check for methods not documented
/doc-sync --check-coverage

# Output:
📚 Documentation Coverage Report

Undocumented Methods:
  - Estimate.markAsConverted() (no README entry)
  - Estimate.calculateWeightedRate() (no README entry)

Pattern References Missing:
  - Factory Pattern used in ProjectFactory (not in Factory pattern doc)

Outdated Examples:
  - docs/patterns/05-CQRS-Pattern.md line 234
    References CreateInvoiceHandler (renamed to GenerateInvoiceHandler)

Documentation Coverage: 73% (22/30 public methods documented)
Target: 90%
````

## After Documentation Sync

1. **Review generated content** for accuracy
2. **Add context** that code alone can't convey
3. **Include "why" not just "what"** - explain business reasons
4. **Add diagrams** for complex workflows
5. **Keep examples up-to-date** - test them
6. **Commit docs with code** - same PR
7. **Schedule regular doc reviews** - monthly

Best Practice: Documentation is not an afterthought. Write it as you code!
