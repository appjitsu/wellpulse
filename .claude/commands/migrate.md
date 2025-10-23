# Database Migration Intelligence

Create and apply an intelligent database migration with dependency analysis and optimization:

**IMPORTANT**: This command helps plan migrations. Always ask the user to run `pnpm --filter=api db:push` per global instructions.

1. **Analyze Context:**
   - Understand the schema changes needed
   - Read ALL existing schemas in `apps/api/src/infrastructure/database/schema/`
   - Build dependency graph (foreign keys, relationships)
   - Check for naming conflicts or duplicate enums

2. **Optimize Schema Design:**
   - **Foreign Keys**: Choose correct cascade strategy
     - `CASCADE`: Parent deletion removes children (org → projects)
     - `RESTRICT`: Prevent deletion if children exist (client → invoices)
     - `SET NULL`: Rarely used, prefer soft delete
   - **Indexes**: Add for:
     - All foreign keys (JOIN performance)
     - Frequently queried columns (status, dates)
     - Composite indexes for multi-column queries (organizationId + status)
     - Use CONCURRENTLY for large tables
   - **Decimal Precision**:
     - Money: `DECIMAL(12, 2)` - $9,999,999,999.99
     - Percentages: `DECIMAL(5, 2)` - 999.99%
     - Hours: `DECIMAL(8, 2)` - 999,999.99 hours
   - **Audit Fields** (required for all tables):

     ```typescript
     createdAt: timestamp('created_at').notNull().defaultNow(),
     updatedAt: timestamp('updated_at').notNull().defaultNow(),
     createdBy: text('created_by').notNull().references(() => usersTable.id),
     updatedBy: text('updated_by').notNull().references(() => usersTable.id),
     deletedAt: timestamp('deleted_at'),
     deletedBy: text('deleted_by').references(() => usersTable.id)
     ```

3. **Update Drizzle Schema:**
   - Modify/create schema file in `apps/api/src/infrastructure/database/schema/`
   - Export from `schema/index.ts`
   - Follow naming conventions: `{entity}Table`, `{entity}StatusEnum`
   - Add JSDoc comments explaining business rules

4. **Generate Migration SQL:**
   - Create migration file: `apps/api/drizzle/XXXX_{description}.sql`
   - Include up and down migrations
   - Add data migrations if needed (backfill, transform)
   - Handle enum additions safely (cannot remove enum values)

5. **Validate Migration:**
   - Check for:
     - Missing NOT NULL defaults (will fail on existing data)
     - Circular dependencies (foreign keys)
     - Index naming conflicts
     - Enum value ordering issues
     - Performance impact on large tables
   - Estimate migration time for production

6. **Review Changes:**
   - Show schema diff with before/after
   - Explain impact on existing data
   - Warn about breaking changes
   - Suggest rollback strategy

7. **Next Steps:**
   - Ask user to run: `pnpm --filter=api db:push` for development
   - For production: `pnpm --filter=api db:generate` then review SQL before `db:migrate`
   - Update repository interface: `apps/api/src/domain/repositories/{entity}.repository.interface.ts`
   - Implement repository: `apps/api/src/infrastructure/database/repositories/drizzle-{entity}.repository.ts`
   - Register in `repositories.module.ts`
   - Update seed data if needed: `apps/api/src/infrastructure/database/seed.ts`
   - Update DTOs and type definitions
   - Run tests: `pnpm --filter=api test`

8. **Document:**
   - Add migration notes if complex (data transformations, multi-step process)
   - Update relevant domain READMEs
   - Note any manual steps required (cache clearing, reindexing)
   - Document performance implications

## Example Output

For: `/migrate "add estimates table with line items"`

```text
📊 Migration Analysis

Dependencies Found:
  ✓ organizations table exists
  ✓ clients table exists
  ✓ users table exists (for audit fields)

Similar Patterns Detected:
  📋 invoices.schema.ts (85% similar)
  📋 projects.schema.ts (60% similar)

Recommended Approach:
  1. Create estimate_status enum (DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED)
  2. Create estimates table with foreign keys to organizations, clients
  3. Create estimate_line_items table with foreign key to estimates
  4. Add indexes: org_id, client_id, status, composite (org_id + status)

Schema files to create/modify:
  - apps/api/src/infrastructure/database/schema/estimates.schema.ts
  - apps/api/src/infrastructure/database/schema/estimate-line-items.schema.ts
  - apps/api/src/infrastructure/database/schema/index.ts (export)

Estimated migration time: <1 second (new tables, no data)
```
