# Database Performance Optimization Pattern

**Pattern Number:** 53
**Category:** Performance & Infrastructure
**Last Updated:** October 10, 2025

---

## Overview

Systematic approach to optimizing database performance for production workloads through strategic indexing, connection pool tuning, and query optimization.

**Key Principle:** Database performance optimization is not a one-time task but an iterative process driven by load testing and production metrics.

---

## Problem Statement

Applications often suffer from poor database performance under load due to:

1. **Missing Indexes**: Sequential scans on foreign keys and frequently queried columns
2. **Inadequate Connection Pooling**: Default connection limits insufficient for concurrent load
3. **Unoptimized Queries**: N+1 queries, missing JOINs, or inefficient filtering
4. **Lack of Monitoring**: No visibility into slow queries or bottlenecks

**Symptoms:**

- High P95/P99 response times under load
- Database CPU spikes during peak usage
- Connection pool exhaustion errors
- Timeout errors on database operations

---

## Solution

### 1. Strategic Index Management

**Define indexes in schema files** (not separate SQL scripts):

```typescript
// apps/api/src/infrastructure/database/schema/users.schema.ts
import { pgTable, text, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const usersTable = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').references(() => organizationsTable.id),
    isActive: boolean('is_active').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
    // ... other fields
  },
  (table) => ({
    // Foreign key index - essential for JOINs
    organizationIdIdx: index('users_organization_id_idx').on(table.organizationId),

    // Composite partial index - optimizes complex queries
    orgActiveIdx: index('users_org_active_idx')
      .on(table.organizationId, table.isActive)
      .where(sql`${table.deletedAt} IS NULL`),

    // Soft delete index - fast filtering
    deletedAtIdx: index('users_deleted_at_idx').on(table.deletedAt),
  }),
);
```

**Index Types to Consider:**

| Index Type            | Use Case                   | Example                    |
| --------------------- | -------------------------- | -------------------------- |
| **Foreign Key Index** | JOINs, lookups             | `users.organization_id`    |
| **Partial Index**     | Queries with WHERE clauses | `WHERE deleted_at IS NULL` |
| **Composite Index**   | Multi-column queries       | `(org_id, is_active)`      |
| **DESC Index**        | Time-series queries        | `created_at DESC`          |

### 2. Connection Pool Optimization

**Calculate optimal pool size** based on concurrent load:

```typescript
// apps/api/src/infrastructure/database/db.ts
export const queryClient = postgres(connectionString, {
  max: 25, // 2:1 ratio: 50 concurrent users → 25 connections
  idle_timeout: 30, // Close idle connections after 30s
  connect_timeout: 10, // Fail fast on connection issues
  max_lifetime: 1800, // 30 min max connection age (prevents leaks)
  prepare: true, // Use prepared statements (reduces parsing)
});
```

**Sizing Formula:**

```
Pool Size = (Peak Concurrent Requests × 0.5) + Buffer
Example: (50 × 0.5) + 5 = 30 connections
```

### 3. Query Optimization Patterns

**Prevent N+1 Queries** with proper eager loading:

```typescript
// ❌ BAD: N+1 query problem
const users = await this.db.select().from(usersTable);
for (const user of users) {
  // Separate query for each user!
  const org = await this.db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, user.organizationId));
}

// ✅ GOOD: Single query with JOIN
const usersWithOrgs = await this.db
  .select()
  .from(usersTable)
  .leftJoin(organizationsTable, eq(usersTable.organizationId, organizationsTable.id));
```

---

## Implementation Checklist

### Phase 1: Analysis

- [ ] Run load tests to establish baseline metrics
- [ ] Identify slow queries using `EXPLAIN ANALYZE`
- [ ] Check for missing indexes on foreign keys
- [ ] Review connection pool utilization

### Phase 2: Indexing

- [ ] Add indexes to schema files (not separate SQL)
- [ ] Index all foreign keys
- [ ] Add composite indexes for common query patterns
- [ ] Use partial indexes for filtered queries
- [ ] Apply indexes: `pnpm --filter=api db:push` (dev)

### Phase 3: Connection Pool

- [ ] Calculate optimal pool size based on load
- [ ] Configure timeouts and lifetime limits
- [ ] Enable prepared statements
- [ ] Monitor pool metrics in production

### Phase 4: Validation

- [ ] Re-run load tests
- [ ] Verify P95/P99 metrics improved
- [ ] Check database CPU/memory usage
- [ ] Monitor index usage: `pg_stat_user_indexes`

---

## Performance Metrics

**Target Benchmarks:**

| Metric                        | Target    | Production Ready |
| ----------------------------- | --------- | ---------------- |
| **P95 Response Time**         | < 2,000ms | < 500ms          |
| **P99 Response Time**         | < 5,000ms | < 1,000ms        |
| **Error Rate**                | < 1%      | < 0.1%           |
| **DB Connection Utilization** | < 80%     | < 70%            |

---

## Index Management Best Practices

### ✅ DO

1. **Define indexes in schema files** - Single source of truth
2. **Index all foreign keys** - Essential for JOINs
3. **Use composite indexes** - For multi-column queries
4. **Add partial indexes** - For filtered queries (WHERE clauses)
5. **Monitor index usage** - Remove unused indexes
6. **Use IF NOT EXISTS** - Safe production deployments

### ❌ DON'T

1. **Don't create indexes in separate SQL files** - Hard to track
2. **Don't over-index** - Each index has write overhead
3. **Don't index low-cardinality columns** - Unless partial index
4. **Don't forget DESC** - Time-series queries need it
5. **Don't skip load testing** - Production will expose issues

---

## Drizzle-Specific Patterns

### Partial Indexes (WHERE clause)

```typescript
// Requires sql`` helper
import { sql } from 'drizzle-orm';

index('active_users_idx')
  .on(table.isActive)
  .where(sql`${table.deletedAt} IS NULL`);
```

### DESC Indexes (Time-series)

```typescript
// Requires sql`` helper
index('created_at_idx').on(sql`${table.createdAt} DESC`);
```

### Composite Indexes

```typescript
// Simple multi-column index
index('org_status_idx').on(table.organizationId, table.status);
```

---

## Deployment Strategy

### Development Environment

**Use `db:push`** for instant schema changes:

```bash
pnpm --filter=api db:push
```

- ✅ Fast iteration
- ✅ No migration files
- ✅ Perfect for prototyping

### Production Environment

**Option 1: SQL Script (Recommended for hotfixes)**

```bash
psql -d production -f scripts/performance-indexes.sql
```

- ✅ Safe, idempotent (IF NOT EXISTS)
- ✅ No migration system dependency
- ✅ Fast deployment

**Option 2: Migration System**

```bash
pnpm --filter=api db:generate  # Generate migration
pnpm --filter=api db:migrate   # Apply to production
```

- ✅ Full audit trail
- ✅ Rollback capability
- ⚠️ Requires clean migration journal

---

## Monitoring & Maintenance

### Index Health Queries

```sql
-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Find unused indexes
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE '%_pkey';

-- Check index sizes
SELECT
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Connection Pool Monitoring

```typescript
// Log pool stats periodically
setInterval(() => {
  const stats = queryClient.options;
  console.log({
    maxConnections: stats.max,
    activeConnections: queryClient.totalCount,
    idleConnections: queryClient.idleCount,
    waitingClients: queryClient.waitingCount,
  });
}, 60000); // Every minute
```

---

## Real-World Example: WellPulse PSA

**Challenge:** P95 response time of 5,272ms under 50 concurrent users

**Optimizations Applied:**

1. **Added 9 indexes** to schema files:
   - Foreign keys: `users.organization_id`, `user_roles.user_id`, `audit_logs.user_id`
   - Composite: `users(organization_id, is_active)` with partial filter
   - Time-series: `audit_logs.created_at DESC`

2. **Tuned connection pool**:
   - Increased from 10 → 25 connections
   - Enabled prepared statements
   - Added timeout configurations

3. **Fixed audit log race condition**:
   - Added retry logic with exponential backoff
   - Handled FK constraint violations gracefully

**Results:**

- **11.7x performance improvement** (P95: 5,272ms → 450ms)
- **100% error reduction** (81 errors → 0)
- **Production ready** (all thresholds met)

---

## Related Patterns

- **Pattern 41**: Database Constraint Race Condition Pattern
- **Pattern 06**: Repository Pattern (data access abstraction)
- **Pattern 09**: Unit of Work Pattern (transaction management)

---

## References

- [PostgreSQL Index Documentation](https://www.postgresql.org/docs/current/indexes.html)
- [Drizzle ORM Indexes](https://orm.drizzle.team/docs/indexes-constraints)
- [Connection Pooling Best Practices](https://wiki.postgresql.org/wiki/Number_Of_Database_Connections)

---

## Summary

Database performance optimization requires a systematic approach:

1. **Measure first** - Establish baseline with load testing
2. **Index strategically** - Foreign keys, composite indexes, partial indexes
3. **Tune connection pool** - Size for peak load with proper timeouts
4. **Monitor continuously** - Track index usage and query performance
5. **Define in schema** - Keep indexes in TypeScript for source control

**Key Insight:** The fastest query is the one that uses an index-only scan. Every foreign key should have an index, and every common query pattern should be analyzed for potential composite indexes.
