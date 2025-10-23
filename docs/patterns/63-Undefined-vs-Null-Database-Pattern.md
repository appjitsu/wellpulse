# Pattern 63: Undefined vs Null in Database Operations

## Problem

JavaScript/TypeScript distinguishes between `undefined` and `null`, but PostgreSQL (and most SQL databases) only recognize `NULL`. When using Drizzle ORM or any database layer, passing `undefined` values causes runtime errors:

```
❌ UNDEFINED_VALUE: Undefined values are not allowed
```

This commonly occurs with:

- Optional parameters in domain entity factory methods
- Partial updates where some fields should remain unchanged
- Audit logging with optional metadata fields

## Anti-Pattern: Relying on Optional Parameter Defaults

❌ **Don't do this:**

```typescript
// Domain entity factory method
class AuditLog {
  static create(
    id: string,
    action: string,
    userId?: string | null,
    organizationId?: string | null,
    entityType?: string | null,
    entityId?: string | null,
    changes?: Record<string, any> | null,
    oldData?: Record<string, any> | null,
    newData?: Record<string, any> | null,
    metadata?: Record<string, any> | null,
    ipAddress?: string | null, // ⚠️ Optional
    userAgent?: string | null, // ⚠️ Optional
  ): AuditLog {
    return new AuditLog({
      id,
      userId,
      organizationId,
      action,
      entityType,
      entityId,
      changes,
      oldData,
      newData,
      metadata,
      ipAddress, // undefined if not passed! 💥
      userAgent, // undefined if not passed! 💥
      createdAt: new Date(),
    });
  }
}

// Usage - missing last two parameters
const auditLog = AuditLog.create(
  randomUUID(),
  'USER_IMPERSONATION_STARTED',
  superAdminId,
  null,
  'user',
  targetUserId,
  null,
  null,
  null,
  { targetUserId, superAdminId },
  // ❌ ipAddress and userAgent are undefined!
);

await repository.save(auditLog); // 💥 UNDEFINED_VALUE error
```

**Why it fails:**

- TypeScript optional parameters (`param?: Type`) default to `undefined` when omitted
- PostgreSQL rejects `undefined` values, requiring explicit `NULL`
- Drizzle ORM doesn't auto-convert `undefined` → `null`

## Solution 1: Explicit Null Parameters

✅ **Do this:**

```typescript
// Always explicitly pass null for nullable database columns
const auditLog = AuditLog.create(
  randomUUID(),
  'USER_IMPERSONATION_STARTED',
  superAdminId,
  null,
  'user',
  targetUserId,
  null,
  null,
  null,
  { targetUserId, superAdminId },
  null, // ✅ Explicit null for ipAddress
  null, // ✅ Explicit null for userAgent
);

await repository.save(auditLog); // ✅ Works!
```

## Solution 2: Options Object Pattern

For domain entities with many optional parameters, use an options object:

```typescript
interface AuditLogOptions {
  id: string;
  action: string;
  userId?: string | null;
  organizationId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  changes?: Record<string, any> | null;
  oldData?: Record<string, any> | null;
  newData?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

class AuditLog {
  static create(options: AuditLogOptions): AuditLog {
    return new AuditLog({
      ...options,
      // ✅ Normalize undefined → null
      userId: options.userId ?? null,
      organizationId: options.organizationId ?? null,
      entityType: options.entityType ?? null,
      entityId: options.entityId ?? null,
      changes: options.changes ?? null,
      oldData: options.oldData ?? null,
      newData: options.newData ?? null,
      metadata: options.metadata ?? null,
      ipAddress: options.ipAddress ?? null,
      userAgent: options.userAgent ?? null,
      createdAt: new Date(),
    });
  }
}

// Usage - cleaner and safer
const auditLog = AuditLog.create({
  id: randomUUID(),
  action: 'USER_IMPERSONATION_STARTED',
  userId: superAdminId,
  organizationId: null,
  entityType: 'user',
  entityId: targetUserId,
  metadata: { targetUserId, superAdminId },
  // ipAddress and userAgent automatically become null
});
```

## Solution 3: Repository-Level Null Coercion

Add null coercion at the repository layer as a safety net:

```typescript
export class DrizzleAuditLogRepository implements IAuditLogRepository {
  async save(auditLog: AuditLog): Promise<void> {
    await this.db.insert(schema.auditLogsTable).values({
      id: auditLog.id,
      userId: auditLog.userId ?? null, // ✅ Coerce undefined → null
      organizationId: auditLog.organizationId ?? null,
      action: auditLog.action,
      entityType: auditLog.entityType ?? null,
      entityId: auditLog.entityId ?? null,
      changes: auditLog.changes ?? null,
      oldData: auditLog.oldData ?? null,
      newData: auditLog.newData ?? null,
      metadata: auditLog.metadata ?? null,
      ipAddress: auditLog.ipAddress ?? null, // ✅ Safety net
      userAgent: auditLog.userAgent ?? null, // ✅ Safety net
      createdAt: auditLog.createdAt,
    });
  }
}
```

## Key Principles

### 1. **Understand JavaScript vs SQL Semantics**

JavaScript/TypeScript:

- `undefined` = "value not provided"
- `null` = "explicitly no value"

SQL/PostgreSQL:

- `NULL` = "no value" (only option)
- No concept of `undefined`

### 2. **Nullish Coalescing Operator**

Use `??` to provide defaults:

```typescript
value ?? null; // ✅ Use null as default
value || null; // ❌ Converts 0, '', false to null!
value ? value : null; // ❌ Verbose
```

### 3. **Factory Method Best Practices**

When designing domain entity factories:

✅ **Options object for >5 parameters:**

```typescript
static create(options: EntityOptions): Entity
```

✅ **Required parameters first, optional last:**

```typescript
static create(id: string, name: string, metadata?: Record<string, any>)
```

✅ **Explicit null normalization:**

```typescript
ipAddress: options.ipAddress ?? null;
```

### 4. **Type System Alignment**

Make TypeScript types match database schema:

```typescript
// ✅ Aligned with database
interface AuditLogProps {
  ipAddress: string | null; // Not undefined!
  userAgent: string | null; // Not undefined!
}

// ❌ Misaligned
interface AuditLogProps {
  ipAddress?: string; // Could be undefined
  userAgent?: string; // Could be undefined
}
```

## Complete Implementation

### Domain Entity with Options Pattern

```typescript
export interface AuditLogProps {
  id: string;
  userId: string | null;
  organizationId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  changes: Record<string, any> | null;
  oldData: Record<string, any> | null;
  newData: Record<string, any> | null;
  metadata: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export class AuditLog {
  private props: AuditLogProps;

  private constructor(props: AuditLogProps) {
    this.props = props;
  }

  static create(options: {
    id: string;
    action: string;
    userId?: string | null;
    organizationId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    changes?: Record<string, any> | null;
    oldData?: Record<string, any> | null;
    newData?: Record<string, any> | null;
    metadata?: Record<string, any> | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): AuditLog {
    if (!options.action || options.action.trim().length === 0) {
      throw new Error('Action cannot be empty');
    }

    return new AuditLog({
      id: options.id,
      userId: options.userId ?? null,
      organizationId: options.organizationId ?? null,
      action: options.action.trim(),
      entityType: options.entityType ?? null,
      entityId: options.entityId ?? null,
      changes: options.changes ?? null,
      oldData: options.oldData ?? null,
      newData: options.newData ?? null,
      metadata: options.metadata ?? null,
      ipAddress: options.ipAddress ?? null,
      userAgent: options.userAgent ?? null,
      createdAt: new Date(),
    });
  }

  // Getters
  get ipAddress(): string | null {
    return this.props.ipAddress;
  }
  get userAgent(): string | null {
    return this.props.userAgent;
  }
  // ... other getters
}
```

### Repository with Null Coercion

```typescript
export class DrizzleAuditLogRepository implements IAuditLogRepository {
  async save(auditLog: AuditLog): Promise<void> {
    const values = {
      id: auditLog.id,
      userId: auditLog.userId ?? null,
      organizationId: auditLog.organizationId ?? null,
      action: auditLog.action,
      entityType: auditLog.entityType ?? null,
      entityId: auditLog.entityId ?? null,
      changes: auditLog.changes ?? null,
      oldData: auditLog.oldData ?? null,
      newData: auditLog.newData ?? null,
      metadata: auditLog.metadata ?? null,
      ipAddress: auditLog.ipAddress ?? null,
      userAgent: auditLog.userAgent ?? null,
      createdAt: auditLog.createdAt,
    };

    await this.db.insert(schema.auditLogsTable).values(values);
  }
}
```

### Database Schema

```typescript
export const auditLogsTable = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  organizationId: text('organization_id'),
  action: text('action').notNull(),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  changes: jsonb('changes'),
  oldData: jsonb('old_data'),
  newData: jsonb('new_data'),
  metadata: jsonb('metadata'),
  ipAddress: text('ip_address'), // Nullable
  userAgent: text('user_agent'), // Nullable
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

## Testing

### Unit Test for Null Handling

```typescript
describe('AuditLog.create', () => {
  it('should convert undefined to null for optional fields', () => {
    const auditLog = AuditLog.create({
      id: 'test-id',
      action: 'TEST_ACTION',
      userId: 'user-123',
      // ipAddress and userAgent not provided
    });

    expect(auditLog.ipAddress).toBeNull(); // ✅ null, not undefined
    expect(auditLog.userAgent).toBeNull(); // ✅ null, not undefined
  });

  it('should accept explicit null values', () => {
    const auditLog = AuditLog.create({
      id: 'test-id',
      action: 'TEST_ACTION',
      userId: 'user-123',
      ipAddress: null,
      userAgent: null,
    });

    expect(auditLog.ipAddress).toBeNull();
    expect(auditLog.userAgent).toBeNull();
  });

  it('should accept explicit values', () => {
    const auditLog = AuditLog.create({
      id: 'test-id',
      action: 'TEST_ACTION',
      userId: 'user-123',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    });

    expect(auditLog.ipAddress).toBe('192.168.1.1');
    expect(auditLog.userAgent).toBe('Mozilla/5.0');
  });
});
```

### Integration Test for Database Insert

```typescript
describe('DrizzleAuditLogRepository', () => {
  it('should save audit log with null values', async () => {
    const repository = new DrizzleAuditLogRepository(db);

    const auditLog = AuditLog.create({
      id: randomUUID(),
      action: 'TEST_ACTION',
      userId: 'user-123',
      // ipAddress and userAgent not provided
    });

    // Should not throw UNDEFINED_VALUE error
    await expect(repository.save(auditLog)).resolves.not.toThrow();

    // Verify database record
    const [saved] = await db
      .select()
      .from(schema.auditLogsTable)
      .where(eq(schema.auditLogsTable.id, auditLog.id));

    expect(saved.ipAddress).toBeNull();
    expect(saved.userAgent).toBeNull();
  });
});
```

## When to Use

✅ **Always use explicit null handling when:**

- Working with Drizzle ORM or any database layer
- Dealing with nullable database columns
- Domain entities have optional fields that map to nullable columns
- Receiving data from external APIs that may omit fields

❌ **May skip for:**

- Pure TypeScript logic with no database interaction
- Internal data structures that never persist
- Temporary variables

## Common Pitfalls

### 1. **Forgetting Optional Parameters**

```typescript
// ❌ Easy to miss last parameters
AuditLog.create(id, action, userId, null, 'user', entityId, null, null, null, metadata);
// Missing ipAddress and userAgent!

// ✅ Options object makes omissions visible
AuditLog.create({
  id,
  action,
  userId,
  entityType: 'user',
  entityId,
  metadata,
});
```

### 2. **Using || Instead of ??**

```typescript
const value = 0;
value || null; // ❌ Returns null (0 is falsy!)
value ?? null; // ✅ Returns 0
```

### 3. **Partial Type Mismatch**

```typescript
// ❌ Partial makes all fields optional (undefined possible)
type UpdateAuditLog = Partial<AuditLogProps>;

// ✅ Use Pick for specific nullable fields
type UpdateAuditLog = Pick<AuditLogProps, 'metadata'> & {
  ipAddress?: string | null;
  userAgent?: string | null;
};
```

## Related Patterns

- **Pattern 2:** Value Objects - Often need null handling
- **Pattern 6:** Repository Pattern - Where null coercion happens
- **Pattern 7:** DTO Pattern - Null handling during data transfer
- **Pattern 41:** Database Constraint Race Condition - Related database reliability pattern

## Real-World Example: User Impersonation Audit

**Scenario:** Super admin impersonates a user for troubleshooting

**Before fix:**

```typescript
const auditLog = AuditLog.create(
  randomUUID(),
  'USER_IMPERSONATION_STARTED',
  superAdminId,
  null,
  'user',
  targetUserId,
  null,
  null,
  null,
  { targetUserId, superAdminId },
);

await repository.save(auditLog);
// 💥 UNDEFINED_VALUE: Undefined values are not allowed
```

**After fix:**

```typescript
const auditLog = AuditLog.create(
  randomUUID(),
  'USER_IMPERSONATION_STARTED',
  superAdminId,
  null,
  'user',
  targetUserId,
  null,
  null,
  null,
  { targetUserId, superAdminId },
  null, // ipAddress explicitly null
  null, // userAgent explicitly null
);

await repository.save(auditLog);
// ✅ Success! Audit log saved
```

## Performance Considerations

**Null coercion overhead:** Negligible (simple ?? operator)
**Memory impact:** None (`null` and `undefined` are both primitive values)
**Database impact:** None (NULL is standard SQL)

## References

- PostgreSQL NULL Handling: https://www.postgresql.org/docs/current/functions-comparison.html
- TypeScript Nullable Types: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#null-and-undefined
- Nullish Coalescing (??): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing
- Drizzle ORM: https://orm.drizzle.team/docs/overview
