# Performance Profiler & Optimizer

Detect performance issues and suggest optimizations with impact estimates.

Analyzes code for common performance anti-patterns and provides concrete fixes.

## What This Command Checks

1. **N+1 Query Problems**
   - Loops that make database queries
   - Missing eager loading of relationships
   - Sequential queries that could be batched

2. **Missing Database Indexes**
   - Unindexed foreign keys
   - Frequently queried columns without indexes
   - Missing composite indexes for multi-column queries

3. **Inefficient Algorithms**
   - O(n²) operations that could be O(n)
   - Redundant computations in loops
   - Unnecessary array iterations

4. **Memory Issues**
   - Large result sets loaded into memory
   - Missing pagination
   - Inefficient data transformations

5. **Caching Opportunities**
   - Expensive calculations done repeatedly
   - Static data fetched on every request
   - Redis integration not utilized

## Usage

```bash
/perf-audit get-estimates.handler.ts
/perf-audit apps/api/src/application/estimate/queries/
/perf-audit apps/api/src/  # Full backend audit
```

## Example Output

```text
⚡ Performance Audit: get-estimates.handler.ts

════════════════════════════════════════════════════════════════

🔥 CRITICAL ISSUE #1: N+1 Query Problem

Location: Line 34-38
Severity: HIGH
Impact: 100 estimates = 201 queries instead of 1

Code:
  const estimates = await this.estimateRepository.find({ organizationId });

  for (const estimate of estimates) {
    const client = await this.clientRepository.findById(estimate.clientId);
    const lineItems = await this.lineItemRepository.findByEstimateId(estimate.id);
    estimate.client = client;
    estimate.lineItems = lineItems;
  }

Problem:
  - Main query fetches 100 estimates: 1 query
  - Loop runs 100x fetching clients: 100 queries
  - Loop runs 100x fetching line items: 100 queries
  - Total: 201 database round trips

Performance Impact:
  - Current: ~2,000ms for 100 estimates
  - After fix: ~50ms for 100 estimates
  - 40x faster! 🚀

✅ Solution: Use JOIN or eager loading

Option 1: Repository-level JOIN (RECOMMENDED)

// In drizzle-estimate.repository.ts
async find(params: EstimateQueryParams): Promise<Estimate[]> {
  const results = await this.db
    .select({
      // Estimate fields
      estimate: estimatesTable,
      // Client fields
      client: clientsTable,
      // Line items (aggregated)
      lineItems: sql<EstimateLineItem[]>`
        json_agg(
          json_build_object(
            'id', ${lineItemsTable.id},
            'description', ${lineItemsTable.description},
            'amount', ${lineItemsTable.amount}
          )
        )
      `.as('line_items'),
    })
    .from(estimatesTable)
    .leftJoin(clientsTable, eq(estimatesTable.clientId, clientsTable.id))
    .leftJoin(lineItemsTable, eq(lineItemsTable.estimateId, estimatesTable.id))
    .where(eq(estimatesTable.organizationId, params.organizationId))
    .groupBy(estimatesTable.id, clientsTable.id);

  return results.map(r => this.mapToEntity(r));
}

Result: 1 query instead of 201 (40x faster)

Option 2: DataLoader pattern (for GraphQL or complex cases)

// Create a DataLoader to batch client lookups
const clientLoader = new DataLoader(async (clientIds: string[]) => {
  return this.clientRepository.findByIds(clientIds);
});

// Use in loop
for (const estimate of estimates) {
  estimate.client = await clientLoader.load(estimate.clientId);
}

Result: 2 queries instead of 201 (20x faster)

════════════════════════════════════════════════════════════════

⚠️ MEDIUM ISSUE #2: Missing Index

Location: Database schema
Severity: MEDIUM
Impact: Slow queries when filtering by status and client

Missing Index:
  Table: estimates
  Columns: (organization_id, status, client_id)

Current query (slow):
  SELECT * FROM estimates
  WHERE organization_id = ? AND status = ? AND client_id = ?
  ORDER BY created_at DESC;

Query Plan:
  - Seq Scan on estimates (cost=0.00..1234.56 rows=100)
  - Filter: organization_id = ? AND status = ? AND client_id = ?
  - Planning Time: 0.5ms
  - Execution Time: 450ms (SLOW for 10,000 rows!)

✅ Solution: Add composite index

// In estimates.schema.ts
export const estimatesTable = pgTable('estimates', {
  // ... columns
}, (table) => ({
  // ... existing indexes

  // Add this index:
  orgStatusClientIdx: index('estimates_org_status_client_idx').on(
    table.organizationId,
    table.status,
    table.clientId
  ),
}));

After adding index:
  - Index Scan using estimates_org_status_client_idx
  - Execution Time: 2ms (225x faster!)

Remember to run: pnpm --filter=api db:push

════════════════════════════════════════════════════════════════

💡 OPTIMIZATION #3: Caching Opportunity

Location: Line 45-50
Severity: LOW
Impact: Save 500ms per request for static data

Code:
  async getEstimateTemplate(id: string): Promise<EstimateTemplate> {
    return this.templateRepository.findById(id);
  }

Problem:
  - Templates are static (rarely change)
  - Fetched from database on every request
  - Same template used 1000x/day = 1000 DB queries

✅ Solution: Add Redis caching

// Inject CacheService
constructor(
  private templateRepository: IEstimateTemplateRepository,
  private cacheService: CacheService,
) {}

async getEstimateTemplate(id: string): Promise<EstimateTemplate> {
  const cacheKey = `estimate-template:${id}`;

  // Try cache first
  const cached = await this.cacheService.get<EstimateTemplate>(cacheKey);
  if (cached) {
    return cached;
  }

  // Cache miss - fetch from DB
  const template = await this.templateRepository.findById(id);

  // Cache for 1 hour
  await this.cacheService.set(cacheKey, template, 3600);

  return template;
}

// Invalidate cache when template updated
async updateTemplate(id: string, data: UpdateTemplateData): Promise<void> {
  await this.templateRepository.update(id, data);
  await this.cacheService.delete(`estimate-template:${id}`);
}

Result:
  - First request: 500ms (DB query)
  - Next 999 requests: <5ms (Redis cache)
  - 100x faster for cached requests!

Note: CacheService already exists in apps/api/src/infrastructure/redis/

════════════════════════════════════════════════════════════════

📊 SUMMARY

Critical Issues: 1
Medium Issues: 1
Optimizations: 1

Estimated Performance Gain:
  - N+1 fix: 40x faster (2000ms → 50ms)
  - Index addition: 225x faster (450ms → 2ms)
  - Caching: 100x faster for cached data (500ms → 5ms)

Total effort: ~2 hours
  - N+1 fix: 45 minutes (modify repository)
  - Index addition: 15 minutes (schema + migration)
  - Caching: 60 minutes (implement + invalidation)

Next Steps:
  1. Fix N+1 query first (highest impact)
  2. Add missing index
  3. Implement caching
  4. Test with realistic data volumes
  5. Monitor query performance in production
```

## Performance Benchmarking

After applying fixes, measure improvement:

```typescript
// Add to handler for benchmarking
const start = Date.now();
const result = await this.execute(query);
const duration = Date.now() - start;

this.logger.log(`GetEstimates executed in ${duration}ms`);
if (duration > 1000) {
  this.logger.warn('Slow query detected!', { query, duration });
}
```

## Database Query Analysis

Check actual query plans:

```sql
-- Get slow queries from pg_stat_statements
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%estimates%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Analyze specific query plan
EXPLAIN ANALYZE
SELECT * FROM estimates
WHERE organization_id = 'org-123'
  AND status = 'SENT'
ORDER BY created_at DESC
LIMIT 20;
```

## Common Performance Patterns

### ✅ Good: Paginated Queries

```typescript
async getEstimates(params: GetEstimatesParams) {
  const { page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  const [items, total] = await Promise.all([
    this.estimateRepository.find({ ...params, limit, offset }),
    this.estimateRepository.count(params),
  ]);

  return { items, total, page, pageSize: limit };
}
```

### ❌ Bad: Loading All Records

```typescript
async getEstimates() {
  const allEstimates = await this.estimateRepository.findAll(); // Could be 100,000!
  return allEstimates; // Response size: 50MB+
}
```

### ✅ Good: Batch Operations

```typescript
async updateMultiple(ids: string[], data: UpdateData) {
  return this.db.update(estimatesTable)
    .set(data)
    .where(inArray(estimatesTable.id, ids));
}
```

### ❌ Bad: Loop Updates

```typescript
async updateMultiple(ids: string[], data: UpdateData) {
  for (const id of ids) {
    await this.db.update(estimatesTable)
      .set(data)
      .where(eq(estimatesTable.id, id)); // 100 queries instead of 1!
  }
}
```

## Redis Caching Best Practices

**What to cache:**

- Static reference data (templates, configurations)
- Expensive computations (reports, analytics)
- Frequently accessed data (user profiles, org settings)

**What NOT to cache:**

- Rapidly changing data (time entries, current status)
- User-specific data (unless short TTL)
- Large result sets (paginate instead)

**Cache invalidation:**

- Set TTL for all cached data
- Invalidate on updates
- Use cache keys with version numbers

## After Performance Audit

1. Prioritize fixes by impact (critical → medium → low)
2. Implement highest-impact fix first
3. Write performance test to prevent regression
4. Monitor query times in production
5. Document performance requirements
6. Add indexes to schema
7. Consider read replicas for heavy read workloads
