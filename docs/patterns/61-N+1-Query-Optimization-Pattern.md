# Pattern 61: N+1 Query Optimization Pattern

**Category**: Performance Optimization
**Related Patterns**: Repository Pattern (#3), Performance Monitoring (#47)
**Status**: Active

## Problem

When fetching aggregate data for multiple entities (e.g., revenue for multiple projects), the naive approach causes N+1 queries:

```typescript
// ❌ BAD: N+1 Query Anti-Pattern
const projects = await projectRepository.findAll({ organizationId });

for (const project of projects) {
  // This runs a separate query for EACH project
  const revenue = await invoiceRepository.getTotalRevenueByProject(project.id);
  const cost = await timeEntryRepository.getTotalCostByProject(project.id);
}
// If there are 100 projects, this makes 201 queries (1 + 100 + 100)
```

**Symptoms**:

- Slow dashboard loads
- Performance degrading linearly with data growth
- High database connection count
- Query logs showing repeated similar queries

## Solution

Use **batch query methods** with SQL `GROUP BY` to fetch aggregated data for all entities in a single query:

```typescript
// ✅ GOOD: Batch Query Pattern
const projects = await projectRepository.findAll({ organizationId });
const projectIds = projects.map((p) => p.id);

// Fetch ALL revenue and cost data in parallel with just 2 queries
const [revenueByProject, costByProject] = await Promise.all([
  invoiceRepository.getTotalRevenueByProjects(organizationId, projectIds),
  timeEntryRepository.getTotalCostByProjects(organizationId, projectIds),
]);

// O(1) lookup from Map
for (const project of projects) {
  const revenue = revenueByProject.get(project.id) || 0;
  const cost = costByProject.get(project.id);
}
// Only 3 queries total (1 + 1 + 1), regardless of project count
```

## Implementation Steps

### Step 1: Add Batch Query Method to Repository Interface

```typescript
// Domain layer: apps/api/src/domain/repositories/invoice.repository.interface.ts

export interface IInvoiceRepository {
  // Existing per-entity method
  getTotalRevenueByProject(
    projectId: string,
    organizationId: string,
    filters?: { status?: string[] },
  ): Promise<InvoiceRevenueAggregation>;

  // ✅ NEW: Batch method
  getTotalRevenueByProjects(
    organizationId: string,
    projectIds?: string[], // Optional filter
    filters?: { status?: string[] },
  ): Promise<Map<string, number>>; // Map for O(1) lookup
}
```

### Step 2: Implement with SQL GROUP BY

```typescript
// Infrastructure layer: apps/api/src/infrastructure/database/repositories/drizzle-invoice.repository.ts

async getTotalRevenueByProjects(
  organizationId: string,
  projectIds?: string[],
  filters?: { status?: string[] }
): Promise<Map<string, number>> {
  const conditions = [
    eq(invoicesTable.organizationId, organizationId),
    isNull(invoicesTable.deletedAt),
  ];

  if (projectIds && projectIds.length > 0) {
    conditions.push(inArray(timeEntriesTable.projectId, projectIds));
  }
  if (filters?.status) {
    conditions.push(inArray(invoicesTable.status, filters.status));
  }

  // ✅ GROUP BY project_id aggregates all data in single query
  const results = await this.db
    .select({
      projectId: timeEntriesTable.projectId,
      total: sql<string>`COALESCE(SUM(DISTINCT ${invoicesTable.total}), 0)`,
    })
    .from(invoicesTable)
    .innerJoin(invoiceLineItemsTable, eq(invoiceLineItemsTable.invoiceId, invoicesTable.id))
    .innerJoin(timeEntriesTable, eq(invoiceLineItemsTable.timeEntryId, timeEntriesTable.id))
    .where(and(...conditions))
    .groupBy(timeEntriesTable.projectId);  // ✅ GROUP BY

  // Convert to Map for O(1) lookup
  const revenueByProject = new Map<string, number>();
  for (const row of results) {
    if (!row.projectId) continue;  // Skip null project IDs
    revenueByProject.set(row.projectId, parseFloat(row.total || '0'));
  }

  return revenueByProject;
}
```

### Step 3: Use in Application Layer

```typescript
// Application layer: apps/api/src/application/ai/commands/send-chat-message.handler.ts

private async getTopClients(...) {
  // Fetch all projects
  const projects = await this.projectRepository.findAll({ organizationId });
  const projectIds = projects.data.map(p => p.id);

  // ✅ Batch fetch in parallel (2 queries total)
  const [revenueByProject, costByProject] = await Promise.all([
    this.invoiceRepository.getTotalRevenueByProjects(organizationId, projectIds,
      { status: ['SENT', 'PAID', 'OVERDUE'] }),
    this.timeEntryRepository.getTotalCostByProjects(organizationId, projectIds, {}),
  ]);

  // Aggregate by client with O(1) lookups
  const clientMetrics = new Map();
  for (const project of projects.data) {
    const revenue = revenueByProject.get(project.id) || 0;  // O(1)
    const hours = costByProject.get(project.id)?.totalHours || 0;  // O(1)

    // Aggregate by client...
  }
}
```

## Key Principles

### 1. Return Map for O(1) Lookup

```typescript
// ❌ BAD: Returning array requires O(N) search
async getTotalRevenueByProjects(): Promise<Array<{ projectId: string; total: number }>>

// ✅ GOOD: Map provides O(1) lookup
async getTotalRevenueByProjects(): Promise<Map<string, number>>
```

### 2. Use Promise.all for Parallelization

```typescript
// ❌ BAD: Sequential (slow)
const revenue = await getTotalRevenueByProjects(...);
const cost = await getTotalCostByProjects(...);

// ✅ GOOD: Parallel (fast)
const [revenue, cost] = await Promise.all([
  getTotalRevenueByProjects(...),
  getTotalCostByProjects(...),
]);
```

### 3. Handle Null Foreign Keys

```typescript
for (const row of results) {
  // ✅ Skip null project IDs to avoid Map type errors
  if (!row.projectId) continue;

  revenueByProject.set(row.projectId, parseFloat(row.total));
}
```

## Performance Impact

**Before Optimization** (N+1 queries):

- 100 projects = **201 queries** (1 for projects + 100 for revenue + 100 for hours)
- ~2 seconds for 100 projects
- Linear degradation: 1000 projects = 2001 queries (~20 seconds)

**After Optimization** (batch queries):

- 100 projects = **3 queries** (1 for projects + 1 for revenue + 1 for hours)
- ~200ms for 100 projects
- Constant time: 1000 projects = still 3 queries (~300ms)

**Improvement**: **67x fewer queries**, **10x faster** response time

## When to Use

Apply this pattern when:

- ✅ Fetching aggregate data (SUM, COUNT, AVG) for multiple entities
- ✅ Building dashboards or analytics
- ✅ Generating reports with grouped data
- ✅ Loading list views with calculated fields

Do NOT use when:

- ❌ Fetching data for a single entity (use per-entity method)
- ❌ Simple list queries without aggregation
- ❌ Data is already denormalized

## Testing Considerations

```typescript
describe('getTotalRevenueByProjects', () => {
  it('should return revenue grouped by project', async () => {
    // Create test data
    const project1 = await createTestProject();
    const project2 = await createTestProject();
    await createTestInvoice(project1.id, 1000);
    await createTestInvoice(project2.id, 2000);

    // Execute batch query
    const result = await invoiceRepository.getTotalRevenueByProjects(organizationId, [
      project1.id,
      project2.id,
    ]);

    // Verify results
    expect(result.get(project1.id)).toBe(1000);
    expect(result.get(project2.id)).toBe(2000);
  });

  it('should handle projects with no invoices', async () => {
    const project = await createTestProject();

    const result = await invoiceRepository.getTotalRevenueByProjects(organizationId, [project.id]);

    // Should return 0 or undefined, not throw
    expect(result.get(project.id)).toBeUndefined();
  });
});
```

## Real-World Example

**Sprint 8C: AI Chat Analytics** (`apps/api/src/application/ai/commands/send-chat-message.handler.ts:917-973`)

```typescript
// Tool: getTopClients - Rank clients by revenue/hours
private async getTopClients(...) {
  const projects = await this.projectRepository.findAll({ organizationId });

  // BEFORE: 2N queries (N projects × 2 repositories)
  // AFTER: 2 queries (1 per repository)
  const [revenueByProject, costByProject] = await Promise.all([
    this.invoiceRepository.getTotalRevenueByProjects(organizationId, projectIds),
    this.timeEntryRepository.getTotalCostByProjects(organizationId, projectIds),
  ]);

  // Group by client with O(1) lookups
  for (const project of projects.data) {
    const revenue = revenueByProject.get(project.id) || 0;
    const hours = costByProject.get(project.id)?.totalHours || 0;
    // ...aggregate by client
  }
}
```

## Related Documentation

- **Pattern #3**: Repository Pattern (defines interface/implementation separation)
- **Pattern #47**: Monitoring & Observability (track query performance)
- **Pattern #53**: Database Performance Optimization (general DB optimization strategies)

## ADR

**Decision**: Use batch query methods with SQL GROUP BY for analytics

**Rationale**:

1. Eliminates N+1 query anti-pattern
2. Maintains repository abstraction
3. Domain layer stays database-agnostic
4. Easy to test and mock

**Alternatives Considered**:

- **DataLoader pattern**: Too complex for current needs
- **Eager loading with JOINs**: Doesn't work well with aggregations
- **Caching**: Doesn't solve root cause, adds complexity

## Checklist

When implementing batch queries:

- [ ] Add batch method to domain repository interface
- [ ] Implement with SQL GROUP BY in infrastructure layer
- [ ] Return Map<key, value> for O(1) lookups
- [ ] Handle null foreign keys
- [ ] Use Promise.all for parallel execution
- [ ] Add tests for batch method
- [ ] Update application layer to use batch queries
- [ ] Verify performance improvement with monitoring
- [ ] Document in code with comments explaining optimization

---

**Pattern applied**: Sprint 8C CRM Implementation
**Files modified**:

- `apps/api/src/domain/repositories/invoice.repository.interface.ts`
- `apps/api/src/domain/repositories/time-entry.repository.interface.ts`
- `apps/api/src/infrastructure/database/repositories/drizzle-invoice.repository.ts`
- `apps/api/src/infrastructure/database/repositories/drizzle-time-entry.repository.ts`
- `apps/api/src/application/ai/commands/send-chat-message.handler.ts`
