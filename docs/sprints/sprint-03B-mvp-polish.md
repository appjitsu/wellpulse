# Sprint 3-B: MVP Polish & Production Readiness

**Duration**: 1 week (Week 6.5)
**Status**: 🔄 In Progress
**Goal**: Polish existing features, complete critical gaps, and achieve production-ready MVP quality before Sprint 4

---

## Objectives

By the end of Sprint 3-B, we will have:

1. ✅ All admin portal CRUD operations fully implemented (not TODOs)
2. ✅ Comprehensive error handling and user-friendly messages
3. ✅ Production-ready logging infrastructure (no console.log)
4. ✅ Complete E2E test coverage for admin portal
5. ✅ Performance optimizations for cross-tenant queries
6. ✅ Security hardening (audit logs, validation, CSRF protection)
7. ✅ Clean codebase (no warnings, proper types, documentation)

**Deliverable**: A sellable MVP with professional polish that operators would trust with their data.

---

## Current Gaps Analysis

### 🔴 Critical (Blocking MVP)

| Gap                                   | Impact                                  | Location                                                    | Effort |
| ------------------------------------- | --------------------------------------- | ----------------------------------------------------------- | ------ |
| Admin user CRUD stubs (TODO)          | Cannot manage users                     | `apps/api/src/presentation/admin/admin-users.controller.ts` | 4h     |
| No audit logging for admin actions    | Compliance risk                         | Throughout admin module                                     | 3h     |
| console.log instead of proper logging | Production blocker                      | Multiple files                                              | 2h     |
| Cross-tenant query performance        | Admin portal unusable with many tenants | `get-all-users.handler.ts`                                  | 3h     |
| No error boundaries in admin UI       | Poor UX on errors                       | Admin frontend                                              | 2h     |

### 🟡 Important (Quality Issues)

| Gap                             | Impact                    | Location                                  | Effort |
| ------------------------------- | ------------------------- | ----------------------------------------- | ------ |
| Hardcoded stats in admin portal | Misleading data           | `apps/admin/app/dashboard/page.tsx`       | 2h     |
| Missing E2E tests for admin     | Regression risk           | `apps/api/test/admin/`                    | 4h     |
| TanStack Table compiler warning | Potential bugs            | `apps/admin/components/ui/data-table.tsx` | 1h     |
| No pagination on admin tables   | Poor UX with many records | Admin users/tenants pages                 | 2h     |
| Missing input validation        | Security risk             | All admin forms                           | 3h     |

### 🟢 Nice to Have (Polish)

| Gap                     | Impact               | Location       | Effort |
| ----------------------- | -------------------- | -------------- | ------ |
| No toast notifications  | Poor UX feedback     | Admin UI       | 1h     |
| No loading skeletons    | Janky UX             | All pages      | 2h     |
| No empty states         | Confusing UX         | All tables     | 1h     |
| No confirmation dialogs | Accidental deletions | Delete actions | 1h     |

---

## Tasks

### Week 1: Critical Gaps

#### Task 1.1: Complete Admin User CRUD Operations (4h) 🔴

**File**: `apps/api/src/presentation/admin/admin-users.controller.ts`

**Current State**:

```typescript
async createUser(@Body() _dto: {...}): Promise<{ id: string; message: string }> {
  // TODO: Implement CreateUserCommand
  return { id: 'new-user-id', message: 'User created successfully' };
}
```

**Required Implementation**:

1. **Create Command & Handler**:
   - `apps/api/src/application/admin/commands/create-user/create-user.command.ts`
   - `apps/api/src/application/admin/commands/create-user/create-user.handler.ts`
   - Hash password with bcrypt
   - Validate email uniqueness within tenant
   - Create user in tenant's database
   - Send welcome email

2. **Update Command & Handler**:
   - `apps/api/src/application/admin/commands/update-user/update-user.command.ts`
   - `apps/api/src/application/admin/commands/update-user/update-user.handler.ts`
   - Update user details (name, role, status)
   - Validate role changes (cannot remove last admin)
   - Audit log the change

3. **Delete Command & Handler**:
   - `apps/api/src/application/admin/commands/delete-user/delete-user.command.ts`
   - `apps/api/src/application/admin/commands/delete-user/delete-user.handler.ts`
   - Soft delete (set deletedAt)
   - Cannot delete self
   - Cannot delete last admin
   - Audit log the deletion

4. **Password Reset Command & Handler**:
   - `apps/api/src/application/admin/commands/send-password-reset/send-password-reset.command.ts`
   - `apps/api/src/application/admin/commands/send-password-reset/send-password-reset.handler.ts`
   - Generate reset token
   - Send reset email
   - Token expires in 1 hour

**Tests**: `*.command.spec.ts` for each command

**Acceptance Criteria**:

- ✅ Can create user with valid data
- ✅ Rejects duplicate email
- ✅ Can update user details
- ✅ Cannot update deleted user
- ✅ Can delete user (soft delete)
- ✅ Cannot delete self or last admin
- ✅ Password reset email sent successfully

---

#### Task 1.2: Add Audit Logging for Admin Actions (3h) 🔴

**Pattern**: Observer Pattern + Domain Events

**File**: `apps/api/src/infrastructure/audit/admin-audit.service.ts`

```typescript
export interface AdminAuditLog {
  id: string;
  adminUserId: string;
  adminEmail: string;
  action:
    | 'CREATE_USER'
    | 'UPDATE_USER'
    | 'DELETE_USER'
    | 'RESET_PASSWORD'
    | 'CREATE_TENANT'
    | 'UPDATE_TENANT'
    | 'DELETE_TENANT'
    | 'SUSPEND_TENANT';
  targetType: 'USER' | 'TENANT';
  targetId: string;
  tenantId?: string;
  metadata: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

export class AdminAuditService {
  async log(entry: Omit<AdminAuditLog, 'id' | 'timestamp'>): Promise<void> {
    // Store in master database admin_audit_logs table
  }

  async getAuditTrail(filters: AuditFilters): Promise<AdminAuditLog[]> {
    // Query audit logs with pagination
  }
}
```

**Database Schema**: `apps/api/src/infrastructure/database/schema/master/admin-audit-logs.schema.ts`

**Usage in Commands**:

```typescript
@CommandHandler(DeleteUserCommand)
export class DeleteUserHandler {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly auditService: AdminAuditService,
  ) {}

  async execute(command: DeleteUserCommand): Promise<void> {
    await this.userRepository.delete(command.tenantId, command.userId);

    await this.auditService.log({
      adminUserId: command.adminUserId,
      adminEmail: command.adminEmail,
      action: 'DELETE_USER',
      targetType: 'USER',
      targetId: command.userId,
      tenantId: command.tenantId,
      metadata: { reason: command.reason },
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
    });
  }
}
```

**Admin UI**: Add "Audit Trail" page to view all admin actions

**Acceptance Criteria**:

- ✅ All admin actions logged to audit table
- ✅ Logs include IP address, user agent, timestamp
- ✅ Logs queryable with filters (admin, action type, date range)
- ✅ Logs immutable (append-only)

---

#### Task 1.3: Replace console.log with Proper Logging (2h) 🔴

**Pattern**: Logging Infrastructure Pattern

**File**: `apps/api/src/infrastructure/logging/logger.service.ts`

```typescript
import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { createLogger, format, transports } from 'winston';

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json()),
    transports: [
      new transports.Console(),
      new transports.File({ filename: 'logs/error.log', level: 'error' }),
      new transports.File({ filename: 'logs/combined.log' }),
    ],
  });

  log(message: string, context?: string) {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { trace, context });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
  }
}
```

**Replace All console.log**:

```bash
# Find all console.log usage
grep -r "console.log" apps/api/src --exclude-dir=node_modules

# Replace with logger
- console.log('Failed to fetch users for tenant', error);
+ this.logger.error(`Failed to fetch users for tenant ${tenantId}`, error, 'GetAllUsersHandler');
```

**Files to Update**:

- `apps/api/src/application/admin/queries/get-all-users/get-all-users.handler.ts` (line 191)
- All command handlers
- All controllers
- TenantDatabaseService

**Acceptance Criteria**:

- ✅ Zero console.log in production code
- ✅ All errors logged with context
- ✅ Logs structured (JSON format)
- ✅ Log levels configurable via env var

---

#### Task 1.4: Optimize Cross-Tenant Queries (3h) 🔴

**Problem**: `getUsersAcrossAllTenants()` queries each tenant database sequentially, fetches ALL users, then paginates in memory. This doesn't scale.

**Current Performance**:

- 10 tenants × 100ms per query = 1000ms
- 100 tenants × 100ms per query = 10,000ms (10 seconds!)

**Solution 1**: Add caching for tenant list (Quick Win - 2h)

```typescript
@Injectable()
export class TenantCacheService {
  private cache = new Map<string, { tenants: Tenant[]; expiresAt: number }>();

  async getActiveTenants(): Promise<Tenant[]> {
    const cached = this.cache.get('active-tenants');
    if (cached && Date.now() < cached.expiresAt) {
      return cached.tenants;
    }

    const { tenants } = await this.tenantRepository.findAll({
      page: 1,
      limit: 1000,
      status: 'ACTIVE',
    });

    this.cache.set('active-tenants', {
      tenants,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    });

    return tenants;
  }

  invalidate() {
    this.cache.clear();
  }
}
```

**Solution 2**: Add database-level aggregation (Better - 3h)

Create a read model that aggregates users across tenants:

```sql
-- Master database view
CREATE MATERIALIZED VIEW admin_users_aggregate AS
SELECT
  u.id,
  u.email,
  u.name,
  u.role,
  u.status,
  u.email_verified,
  u.last_login_at,
  u.created_at,
  t.id as tenant_id,
  t.name as tenant_name
FROM tenants t
CROSS JOIN LATERAL (
  SELECT * FROM dblink(
    format('host=%s port=%s dbname=%s user=%s password=%s',
      t.database_host, t.database_port, t.database_name,
      t.database_user, t.database_password
    ),
    'SELECT id, email, name, role, status, email_verified, last_login_at, created_at FROM users WHERE deleted_at IS NULL'
  ) AS u(id uuid, email text, name text, role text, status text, email_verified boolean, last_login_at timestamp, created_at timestamp)
);

CREATE INDEX idx_admin_users_aggregate_email ON admin_users_aggregate(email);
CREATE INDEX idx_admin_users_aggregate_tenant_id ON admin_users_aggregate(tenant_id);
CREATE INDEX idx_admin_users_aggregate_role ON admin_users_aggregate(role);

-- Refresh every 5 minutes via cron job
```

**Implementation Choice**: Start with Solution 1 (caching), migrate to Solution 2 if needed.

**Acceptance Criteria**:

- ✅ Admin users page loads in <2s with 100 tenants
- ✅ Tenant list cached for 5 minutes
- ✅ Cache invalidated on tenant create/delete
- ✅ No memory leaks

---

#### Task 1.5: Add Error Boundaries to Admin UI (2h) 🔴

**File**: `apps/admin/components/error-boundary.tsx`

```typescript
'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error boundary caught error:', error, errorInfo);
    // TODO: Log to error tracking service (Sentry, etc.)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8">
          <AlertTriangle className="h-16 w-16 text-red-600 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-gray-600 mb-4">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <Button onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Usage**: Wrap each page in error boundary

```typescript
// apps/admin/app/layout.tsx
import { ErrorBoundary } from '@/components/error-boundary';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

**Acceptance Criteria**:

- ✅ Errors caught and displayed gracefully
- ✅ User can recover from errors
- ✅ Errors logged to console (production: Sentry)
- ✅ No white screen of death

---

### Week 1: Important Quality Issues

#### Task 2.1: Fix Hardcoded Admin Dashboard Stats (2h) 🟡

**File**: `apps/admin/app/dashboard/page.tsx`

**Current State**: Mock data everywhere

```typescript
<div className="text-2xl font-bold">12</div> {/* Total Tenants - MOCK */}
<div className="text-2xl font-bold">147</div> {/* Total Users - MOCK */}
<div className="text-2xl font-bold">98.2%</div> {/* Uptime - MOCK */}
```

**Required Implementation**:

1. **Backend Queries**:
   - `GetAdminDashboardStatsQuery` - Aggregate stats across all tenants
   - Query master database for tenant count
   - Query each tenant database for user count (use cached tenant list)
   - Query uptime monitoring service or calculate from health checks

2. **API Endpoint**:
   - `GET /admin/dashboard/stats`
   - Returns: `{ totalTenants, totalUsers, activeUsers, uptime, revenue }`

3. **Frontend Hook**:
   - `useAdminDashboardStats()` - React Query hook
   - Refresh every 30 seconds

**Acceptance Criteria**:

- ✅ All stats pulled from real data
- ✅ Stats update in real-time
- ✅ Loading states shown
- ✅ Error handling with fallback

---

#### Task 2.2: Add E2E Tests for Admin Portal (4h) 🟡

**File**: `apps/api/test/admin/admin-users.e2e-spec.ts`

```typescript
describe('Admin Users (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let testTenant: Tenant;

  beforeAll(async () => {
    // Setup test environment
    // Create SUPER_ADMIN user
    // Provision test tenant
  });

  describe('GET /admin/users', () => {
    it('should get all users across all tenants', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('total');
      expect(response.body.users.length).toBeGreaterThan(0);
    });

    it('should filter users by tenant', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/users?tenantId=${testTenant.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.users.every((u) => u.tenantId === testTenant.id)).toBe(true);
    });

    it('should reject non-admin access', async () => {
      const regularUserToken = 'regular-user-token';

      await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('POST /admin/users', () => {
    it('should create user', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'newuser@test.com',
          password: 'Test123!@#',
          firstName: 'New',
          lastName: 'User',
          tenantId: testTenant.id,
          role: 'OPERATOR',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
    });

    it('should reject duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'newuser@test.com', // Already exists
          password: 'Test123!@#',
          firstName: 'Duplicate',
          lastName: 'User',
          tenantId: testTenant.id,
          role: 'OPERATOR',
        })
        .expect(409);
    });
  });

  describe('PATCH /admin/users/:id', () => {
    it('should update user', async () => {
      const userId = 'test-user-id';

      await request(app.getHttpServer())
        .patch(`/admin/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Updated',
          role: 'MANAGER',
        })
        .expect(200);
    });
  });

  describe('DELETE /admin/users/:id', () => {
    it('should delete user', async () => {
      const userId = 'test-user-id';

      await request(app.getHttpServer())
        .delete(`/admin/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should prevent deleting last admin', async () => {
      const lastAdminId = 'last-admin-id';

      await request(app.getHttpServer())
        .delete(`/admin/users/${lastAdminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('POST /admin/users/:id/reset-password', () => {
    it('should send password reset email', async () => {
      const userId = 'test-user-id';

      await request(app.getHttpServer())
        .post(`/admin/users/${userId}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // TODO: Verify email was sent (mock email service)
    });
  });
});
```

**Acceptance Criteria**:

- ✅ All admin endpoints covered
- ✅ RBAC enforcement tested
- ✅ Error cases tested
- ✅ All tests passing

---

#### Task 2.3: Fix TanStack Table Compiler Warning (1h) 🟡

**File**: `apps/admin/components/ui/data-table.tsx`

**Warning**:

```
Compilation Skipped: Use of incompatible library
TanStack Table's `useReactTable()` API returns functions that cannot be memoized safely
```

**Solution**: Disable React Compiler for this file (React Compiler is experimental)

```typescript
// apps/admin/components/ui/data-table.tsx
'use client';

// @ts-expect-error - React Compiler incompatible with TanStack Table
/* eslint-disable react-compiler/react-compiler */

import * as React from 'react';
import { useReactTable /* ... */ } from '@tanstack/react-table';

// ... rest of file
```

**Alternative Solution**: Wait for React Compiler stable release or TanStack Table v9

**Acceptance Criteria**:

- ✅ No compiler warnings
- ✅ Table still works correctly
- ✅ ESLint passes

---

#### Task 2.4: Add Pagination to Admin Tables (2h) 🟡

**Files**:

- `apps/admin/app/dashboard/users/page.tsx`
- `apps/admin/app/dashboard/tenants/page.tsx`

**Current State**: Fetches all records (limit: 100)

**Required**:

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, limit, selectedTenantId],
    queryFn: () => adminApi.getAllUsers({
      page,
      limit,
      tenantId: selectedTenantId === 'all' ? undefined : selectedTenantId,
    }),
  });

  const totalPages = Math.ceil((data?.total || 0) / limit);

  return (
    <div>
      {/* Table */}
      <DataTable data={data?.users || []} columns={columns} />

      {/* Pagination Controls */}
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-muted-foreground">
          Showing {(page - 1) * limit + 1} to {Math.min(page * limit, data?.total || 0)} of {data?.total || 0} results
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <div className="text-sm">
            Page {page} of {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**Acceptance Criteria**:

- ✅ Tables paginated (10 per page)
- ✅ Previous/Next buttons work
- ✅ Page indicator shows current page
- ✅ Works with filtering

---

#### Task 2.5: Add Input Validation to Admin Forms (3h) 🟡

**Files**:

- `apps/admin/components/users/user-dialog.tsx`
- `apps/admin/components/tenants/tenant-dialog.tsx`

**Current State**: Basic validation, no error messages

**Required**: Zod schemas with comprehensive validation

```typescript
import { z } from 'zod';

const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters'),
  tenantId: z.string().uuid('Invalid tenant ID'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATOR'], {
    errorMap: () => ({ message: 'Invalid role' }),
  }),
});

type CreateUserInput = z.infer<typeof createUserSchema>;

export function UserDialog({ ... }) {
  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
  });

  // ... rest
}
```

**Backend Validation**: Add DTOs with class-validator

```typescript
// apps/api/src/presentation/admin/dto/create-user.dto.ts
import { IsEmail, IsString, IsUUID, IsEnum, MinLength, Matches } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain uppercase, lowercase, number, and special character',
  })
  password: string;

  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @IsUUID()
  tenantId: string;

  @IsEnum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATOR'])
  role: string;
}
```

**Acceptance Criteria**:

- ✅ All inputs validated on frontend
- ✅ All inputs validated on backend
- ✅ Error messages shown to user
- ✅ Cannot submit invalid data

---

### Week 1: Nice to Have Polish

#### Task 3.1: Add Toast Notifications (1h) 🟢

**Install**: `pnpm add sonner`

**File**: `apps/admin/components/providers.tsx`

```typescript
'use client';

import { Toaster } from 'sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="top-right" richColors />
    </>
  );
}
```

**Usage**:

```typescript
import { toast } from 'sonner';

const handleCreateUser = async (data: CreateUserInput) => {
  try {
    await createUser(data);
    toast.success('User created successfully');
    router.push('/dashboard/users');
  } catch (error) {
    toast.error('Failed to create user: ' + error.message);
  }
};
```

---

#### Task 3.2: Add Loading Skeletons (2h) 🟢

**File**: `apps/admin/components/ui/skeleton.tsx`

```typescript
export function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-12 w-full" />
        </div>
      ))}
    </div>
  );
}
```

**Usage**:

```typescript
{isLoading ? (
  <TableSkeleton rows={10} />
) : (
  <DataTable data={data?.users || []} columns={columns} />
)}
```

---

#### Task 3.3: Add Empty States (1h) 🟢

**File**: `apps/admin/components/ui/empty-state.tsx`

```typescript
import { AlertCircle } from 'lucide-react';
import { Button } from './button';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-gray-600 mb-4">{description}</p>
      {action && (
        <Button onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  );
}
```

---

#### Task 3.4: Add Confirmation Dialogs (1h) 🟢

**File**: `apps/admin/components/ui/confirm-dialog.tsx`

```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Usage**:

```typescript
const [confirmOpen, setConfirmOpen] = useState(false);
const [userToDelete, setUserToDelete] = useState<string | null>(null);

const handleDeleteClick = (userId: string) => {
  setUserToDelete(userId);
  setConfirmOpen(true);
};

const handleConfirmDelete = () => {
  if (userToDelete) {
    deleteUser(userToDelete);
  }
  setConfirmOpen(false);
  setUserToDelete(null);
};

return (
  <>
    <Button onClick={() => handleDeleteClick(user.id)}>Delete</Button>
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title="Delete User"
      description="Are you sure you want to delete this user? This action cannot be undone."
      onConfirm={handleConfirmDelete}
    />
  </>
);
```

---

## Quality Checks

Before marking Sprint 3-B complete, run:

```bash
pnpm format       # Prettier
pnpm lint         # ESLint (0 errors, 0 warnings)
pnpm type-check   # TypeScript (must pass)
pnpm test         # ≥80% coverage
pnpm build        # Must succeed
```

Or use the `/quality-fast` command.

---

## Success Criteria

Sprint 3-B is complete when:

### Admin Portal

- [x] All CRUD operations implemented (no TODOs)
- [x] Audit logging for all admin actions
- [x] Real-time stats (no hardcoded data)
- [x] Pagination on all tables
- [x] Input validation on all forms
- [x] Error boundaries prevent crashes
- [x] Toast notifications for feedback
- [x] Loading skeletons during fetch
- [x] Empty states for zero data
- [x] Confirmation dialogs before delete

### Backend

- [x] Winston logging (no console.log)
- [x] All commands/queries implemented
- [x] Audit trail queryable via API
- [x] Cross-tenant query performance <2s
- [x] E2E tests for admin portal
- [x] Unit test coverage ≥80%

### Code Quality

- [x] Zero ESLint errors
- [x] Zero ESLint warnings
- [x] Zero TypeScript errors
- [x] No `any` types
- [x] All patterns followed
- [x] API documented (Swagger)

### Performance

- [x] Admin users page <2s with 100 tenants
- [x] Tenant list cached
- [x] No N+1 queries
- [x] Database indexes optimized

### Security

- [x] Audit logs immutable
- [x] Input validation frontend + backend
- [x] Cannot delete self or last admin
- [x] Password complexity enforced

---

## Patterns Used

| Pattern                    | Location                 | Purpose                              |
| -------------------------- | ------------------------ | ------------------------------------ |
| **CQRS**                   | Admin commands/queries   | Separate reads/writes                |
| **Observer Pattern**       | Audit logging            | Decouple logging from business logic |
| **Repository Pattern**     | User/Tenant repositories | Data access abstraction              |
| **DTO Pattern**            | API DTOs                 | Input validation, type safety        |
| **Error Boundary Pattern** | Admin UI                 | Graceful error handling              |
| **Cache Pattern**          | Tenant caching           | Performance optimization             |

---

## Metrics

- **Planned Story Points**: 25
- **Estimated Hours**: 32h
- **Target Completion**: End of Week 6.5
- **Code Coverage Goal**: ≥80%
- **Performance Goal**: All pages <2s
- **Zero Known Bugs**

---

## Next Steps

Once Sprint 3-B is complete, we'll be ready for:

**Sprint 4: Map Interface (Weeks 7-8)**

- Interactive Mapbox map
- Plot wells with markers
- Clustering for performance
- Click well → popup details

**Why Polish Matters**: A sellable MVP requires professional quality. Operators managing millions of dollars in production won't trust a platform that feels unfinished. This sprint ensures WellPulse looks and feels like enterprise software from day one.

---

**Sprint 3-B starts now! Let's polish to perfection! ✨**
