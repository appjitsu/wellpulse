# Sprint 4: Comprehensive Audit Logging System

**Priority**: CRITICAL (Enterprise Compliance Requirement)
**Estimated Effort**: 1 week (Phase 4F)
**Patterns**: Observer Pattern, Decorator Pattern, Interceptor Pattern

---

## 1. Requirements

### 1.1 Functional Requirements

**Audit Logging Scope**:
- ✅ **User Actions**: All CRUD operations (create, read, update, delete)
- ✅ **Authentication Events**: Login, logout, failed login attempts, password changes
- ✅ **Authorization Events**: Permission denied, role changes, RBAC modifications
- ✅ **System Actions**: Background jobs, scheduled tasks, automated processes
- ✅ **Configuration Changes**: Settings updates, nominal range modifications, alert preferences
- ✅ **Data Export**: Report generation, data downloads, API exports
- ✅ **Administrative Actions**: User management, tenant provisioning, role assignments

**Access Control**:
- **Org Admins** (web portal): View only their tenant's audit logs
- **Super Admins** (admin portal): View audit logs across ALL tenants
- **Managers/Consultants/Operators**: NO access to audit logs

**UI Features**:
- Real-time log streaming (last 100 entries)
- Advanced filtering (by user, action type, resource, date range, severity)
- Full-text search across all log fields
- Sortable columns (timestamp, user, action, resource)
- Export to CSV/Excel
- Detailed log entry view (JSON diff for before/after state)

### 1.2 Non-Functional Requirements

**Performance**:
- <500ms query response time for filtered results (up to 100,000 logs)
- <2s for complex searches with multiple filters
- Real-time streaming via WebSocket with <1s latency

**Scalability**:
- Support 1M+ audit log entries per tenant
- Handle 1000+ concurrent audit writes without blocking

**Retention**:
- Keep all audit logs for 7 years (regulatory compliance)
- Implement automatic archival to cold storage after 1 year

**Security**:
- Audit logs are immutable (cannot be edited or deleted by anyone)
- Encrypt sensitive data in logs (passwords, API keys, PII)
- Alert on suspicious patterns (mass deletions, privilege escalation attempts)

---

## 2. Database Schema

### 2.1 Tenant-Level Audit Log

```sql
-- Tenant DB (each tenant has their own audit_log table)
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL, -- Redundant but useful for partitioning

  -- Actor (who did the action)
  user_id UUID REFERENCES users(id), -- NULL if system action
  user_email VARCHAR, -- Denormalized for faster queries
  user_name VARCHAR, -- Denormalized
  actor_type VARCHAR NOT NULL, -- 'user', 'system', 'api_key', 'cron_job'

  -- Action details
  action_type VARCHAR NOT NULL, -- 'create', 'read', 'update', 'delete', 'login', 'logout', 'export', etc.
  resource_type VARCHAR NOT NULL, -- 'well', 'field_entry', 'user', 'role', 'nominal_range', etc.
  resource_id UUID, -- ID of the affected resource (if applicable)
  resource_name VARCHAR, -- Denormalized name (e.g., well name, user email)

  -- Request context
  http_method VARCHAR, -- 'GET', 'POST', 'PUT', 'DELETE'
  endpoint VARCHAR, -- '/api/wells/:id'
  ip_address INET, -- Client IP address
  user_agent TEXT, -- Browser/app info
  request_id UUID, -- For tracing across microservices

  -- Data changes (for update/delete operations)
  old_value JSONB, -- Previous state
  new_value JSONB, -- New state
  diff JSONB, -- Computed diff for quick visualization

  -- Metadata
  status VARCHAR NOT NULL, -- 'success', 'failed', 'partial'
  error_message TEXT, -- If status = 'failed'
  severity VARCHAR NOT NULL DEFAULT 'info', -- 'info', 'warning', 'critical'
  tags TEXT[], -- Searchable tags: ['security', 'compliance', 'data_export']

  -- Performance metrics
  duration_ms INTEGER, -- How long the operation took

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Compliance flags
  requires_attention BOOLEAN DEFAULT FALSE, -- Flagged for manual review
  reviewed_by UUID REFERENCES users(id), -- Super admin who reviewed
  reviewed_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_audit_log_tenant_id ON audit_log(tenant_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_action_type ON audit_log(action_type);
CREATE INDEX idx_audit_log_resource_type ON audit_log(resource_type);
CREATE INDEX idx_audit_log_resource_id ON audit_log(resource_id);
CREATE INDEX idx_audit_log_severity_critical ON audit_log(severity) WHERE severity = 'critical';
CREATE INDEX idx_audit_log_requires_attention ON audit_log(requires_attention) WHERE requires_attention = TRUE;
CREATE INDEX idx_audit_log_search ON audit_log USING gin(to_tsvector('english',
  coalesce(user_email, '') || ' ' ||
  coalesce(resource_name, '') || ' ' ||
  coalesce(action_type, '') || ' ' ||
  coalesce(error_message, '')
)); -- Full-text search index

-- Partition by month for performance (100M+ logs)
CREATE TABLE audit_log_2025_10 PARTITION OF audit_log
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE audit_log_2025_11 PARTITION OF audit_log
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
-- ... create partitions programmatically

-- Trigger to prevent modifications (immutability)
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
    RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();
```

### 2.2 Master DB (Super Admin Cross-Tenant View)

```sql
-- Master DB (for super admin to query across all tenants)
CREATE TABLE audit_log_index (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  tenant_name VARCHAR NOT NULL, -- Denormalized
  created_at TIMESTAMP NOT NULL,
  action_type VARCHAR NOT NULL,
  resource_type VARCHAR NOT NULL,
  user_email VARCHAR,
  severity VARCHAR NOT NULL,
  requires_attention BOOLEAN DEFAULT FALSE
);

-- Super admins query this lightweight index, then fetch details from tenant DB
CREATE INDEX idx_audit_log_index_tenant_id ON audit_log_index(tenant_id);
CREATE INDEX idx_audit_log_index_created_at ON audit_log_index(created_at DESC);
CREATE INDEX idx_audit_log_index_severity ON audit_log_index(severity);
CREATE INDEX idx_audit_log_index_attention ON audit_log_index(requires_attention) WHERE requires_attention = TRUE;
```

---

## 3. Backend Implementation

### 3.1 Domain Layer

```typescript
// apps/api/src/domain/audit/audit-log-entry.entity.ts
export interface AuditLogEntry {
  id: string;
  tenantId: string;

  // Actor
  userId?: string;
  userEmail?: string;
  userName?: string;
  actorType: 'user' | 'system' | 'api_key' | 'cron_job';

  // Action
  actionType: 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout' | 'export' | string;
  resourceType: string; // 'well', 'field_entry', 'user', etc.
  resourceId?: string;
  resourceName?: string;

  // Request context
  httpMethod?: string;
  endpoint?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;

  // Data changes
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  diff?: Record<string, any>;

  // Metadata
  status: 'success' | 'failed' | 'partial';
  errorMessage?: string;
  severity: 'info' | 'warning' | 'critical';
  tags?: string[];

  // Performance
  durationMs?: number;

  // Timestamps
  createdAt: Date;

  // Compliance
  requiresAttention?: boolean;
  reviewedBy?: string;
  reviewedAt?: Date;
}

export class AuditLogEntryFactory {
  static createFromRequest(
    tenantId: string,
    user: any,
    request: any,
    action: string,
    resource: { type: string; id?: string; name?: string },
    data?: { old?: any; new?: any }
  ): AuditLogEntry {
    return {
      id: uuidv4(),
      tenantId,
      userId: user?.id,
      userEmail: user?.email,
      userName: user?.name,
      actorType: user ? 'user' : 'system',
      actionType: action,
      resourceType: resource.type,
      resourceId: resource.id,
      resourceName: resource.name,
      httpMethod: request.method,
      endpoint: request.url,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.id,
      oldValue: data?.old,
      newValue: data?.new,
      diff: this.computeDiff(data?.old, data?.new),
      status: 'success',
      severity: this.determineSeverity(action, resource.type),
      tags: this.generateTags(action, resource.type),
      createdAt: new Date(),
    };
  }

  private static computeDiff(oldVal: any, newVal: any): Record<string, any> | undefined {
    if (!oldVal || !newVal) return undefined;

    const diff: Record<string, any> = {};

    for (const key in newVal) {
      if (oldVal[key] !== newVal[key]) {
        diff[key] = {
          from: oldVal[key],
          to: newVal[key],
        };
      }
    }

    return Object.keys(diff).length > 0 ? diff : undefined;
  }

  private static determineSeverity(action: string, resourceType: string): 'info' | 'warning' | 'critical' {
    if (action === 'delete' && ['user', 'well', 'organization'].includes(resourceType)) {
      return 'critical';
    }
    if (action === 'update' && ['role', 'permission', 'nominal_range'].includes(resourceType)) {
      return 'warning';
    }
    return 'info';
  }

  private static generateTags(action: string, resourceType: string): string[] {
    const tags: string[] = [];

    if (['user', 'role', 'permission'].includes(resourceType)) {
      tags.push('security');
    }
    if (['nominal_range', 'alert_preference'].includes(resourceType)) {
      tags.push('compliance');
    }
    if (action === 'export') {
      tags.push('data_export');
    }
    if (action === 'delete') {
      tags.push('destructive');
    }

    return tags;
  }
}
```

### 3.2 Application Layer

```typescript
// apps/api/src/application/audit/commands/create-audit-log-entry.command.ts
export class CreateAuditLogEntryCommand {
  tenantId: string;
  userId?: string;
  actionType: string;
  resourceType: string;
  resourceId?: string;
  oldValue?: any;
  newValue?: any;
  status: 'success' | 'failed' | 'partial';
  errorMessage?: string;
  httpMethod?: string;
  endpoint?: string;
  ipAddress?: string;
  userAgent?: string;
  durationMs?: number;
}

@CommandHandler(CreateAuditLogEntryCommand)
export class CreateAuditLogEntryHandler {
  constructor(
    private readonly auditLogRepo: AuditLogRepository,
    private readonly auditLogIndexRepo: AuditLogIndexRepository, // For super admin cross-tenant index
  ) {}

  async execute(command: CreateAuditLogEntryCommand): Promise<void> {
    // 1. Create audit log entry in tenant DB
    const entry = AuditLogEntryFactory.createFromRequest(
      command.tenantId,
      { id: command.userId },
      { method: command.httpMethod, url: command.endpoint, ip: command.ipAddress, headers: { 'user-agent': command.userAgent } },
      command.actionType,
      { type: command.resourceType, id: command.resourceId },
      { old: command.oldValue, new: command.newValue }
    );

    await this.auditLogRepo.create(command.tenantId, entry);

    // 2. Create lightweight index entry in master DB (for super admin)
    await this.auditLogIndexRepo.create({
      id: entry.id,
      tenantId: command.tenantId,
      tenantName: '', // TODO: Fetch from tenants table
      createdAt: entry.createdAt,
      actionType: entry.actionType,
      resourceType: entry.resourceType,
      userEmail: entry.userEmail,
      severity: entry.severity,
      requiresAttention: entry.requiresAttention || false,
    });

    // 3. Check for suspicious patterns (e.g., mass deletions)
    if (entry.severity === 'critical' || entry.tags?.includes('security')) {
      await this.checkForAnomalies(command.tenantId, entry);
    }
  }

  private async checkForAnomalies(tenantId: string, entry: AuditLogEntry): Promise<void> {
    // Example: Detect if user deleted >10 resources in last hour
    const recentDeletions = await this.auditLogRepo.countRecentActions(
      tenantId,
      entry.userId!,
      'delete',
      60 // minutes
    );

    if (recentDeletions > 10) {
      // Flag for manual review
      await this.auditLogRepo.flagForReview(tenantId, entry.id, 'Mass deletion detected');

      // Send alert to super admins
      // TODO: Implement alert notification
    }
  }
}

// apps/api/src/application/audit/queries/get-audit-logs.query.ts
export class GetAuditLogsQuery {
  tenantId: string;
  filters?: {
    userId?: string;
    actionType?: string[];
    resourceType?: string[];
    severity?: string[];
    startDate?: Date;
    endDate?: Date;
    searchTerm?: string;
    requiresAttention?: boolean;
  };
  pagination?: {
    page: number;
    limit: number;
  };
  sort?: {
    field: string;
    order: 'ASC' | 'DESC';
  };
}

@QueryHandler(GetAuditLogsQuery)
export class GetAuditLogsHandler {
  constructor(private readonly auditLogRepo: AuditLogRepository) {}

  async execute(query: GetAuditLogsQuery): Promise<{ logs: AuditLogEntry[]; total: number }> {
    const { logs, total } = await this.auditLogRepo.findWithFilters(
      query.tenantId,
      query.filters,
      query.pagination,
      query.sort
    );

    return { logs, total };
  }
}

// apps/api/src/application/audit/queries/get-cross-tenant-audit-logs.query.ts (for super admins)
export class GetCrossTenantAuditLogsQuery {
  tenantId?: string; // Optional: filter by specific tenant
  filters?: {
    severity?: string[];
    requiresAttention?: boolean;
    startDate?: Date;
    endDate?: Date;
  };
  pagination?: { page: number; limit: number };
}

@QueryHandler(GetCrossTenantAuditLogsQuery)
export class GetCrossTenantAuditLogsHandler {
  constructor(
    private readonly auditLogIndexRepo: AuditLogIndexRepository,
    private readonly tenantDbService: TenantDatabaseService,
  ) {}

  async execute(query: GetCrossTenantAuditLogsQuery): Promise<{ logs: any[]; total: number }> {
    // 1. Query lightweight index from master DB
    const { indices, total } = await this.auditLogIndexRepo.findWithFilters(
      query.tenantId,
      query.filters,
      query.pagination
    );

    // 2. Fetch full details from each tenant DB (in parallel)
    const logPromises = indices.map(async (index) => {
      const fullLog = await this.tenantDbService.query(
        index.tenantId,
        'SELECT * FROM audit_log WHERE id = $1',
        [index.id]
      );
      return {
        ...fullLog[0],
        tenantName: index.tenantName, // Include tenant name for super admin view
      };
    });

    const logs = await Promise.all(logPromises);

    return { logs, total };
  }
}
```

### 3.3 Infrastructure Layer

```typescript
// apps/api/src/infrastructure/audit/audit-log.repository.ts
@Injectable()
export class AuditLogRepository {
  constructor(private readonly tenantDbService: TenantDatabaseService) {}

  async create(tenantId: string, entry: AuditLogEntry): Promise<void> {
    const query = `
      INSERT INTO audit_log (
        id, tenant_id, user_id, user_email, user_name, actor_type,
        action_type, resource_type, resource_id, resource_name,
        http_method, endpoint, ip_address, user_agent, request_id,
        old_value, new_value, diff,
        status, error_message, severity, tags,
        duration_ms, created_at, requires_attention
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18,
        $19, $20, $21, $22,
        $23, $24, $25
      )
    `;

    await this.tenantDbService.query(tenantId, query, [
      entry.id, entry.tenantId, entry.userId, entry.userEmail, entry.userName, entry.actorType,
      entry.actionType, entry.resourceType, entry.resourceId, entry.resourceName,
      entry.httpMethod, entry.endpoint, entry.ipAddress, entry.userAgent, entry.requestId,
      JSON.stringify(entry.oldValue), JSON.stringify(entry.newValue), JSON.stringify(entry.diff),
      entry.status, entry.errorMessage, entry.severity, entry.tags,
      entry.durationMs, entry.createdAt, entry.requiresAttention || false,
    ]);
  }

  async findWithFilters(
    tenantId: string,
    filters?: any,
    pagination?: any,
    sort?: any
  ): Promise<{ logs: AuditLogEntry[]; total: number }> {
    let query = 'SELECT * FROM audit_log WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let paramIndex = 2;

    // Apply filters
    if (filters?.userId) {
      query += ` AND user_id = $${paramIndex}`;
      params.push(filters.userId);
      paramIndex++;
    }

    if (filters?.actionType?.length) {
      query += ` AND action_type = ANY($${paramIndex})`;
      params.push(filters.actionType);
      paramIndex++;
    }

    if (filters?.resourceType?.length) {
      query += ` AND resource_type = ANY($${paramIndex})`;
      params.push(filters.resourceType);
      paramIndex++;
    }

    if (filters?.severity?.length) {
      query += ` AND severity = ANY($${paramIndex})`;
      params.push(filters.severity);
      paramIndex++;
    }

    if (filters?.startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters?.endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    if (filters?.searchTerm) {
      query += ` AND to_tsvector('english',
        coalesce(user_email, '') || ' ' ||
        coalesce(resource_name, '') || ' ' ||
        coalesce(action_type, '') || ' ' ||
        coalesce(error_message, '')
      ) @@ plainto_tsquery('english', $${paramIndex})`;
      params.push(filters.searchTerm);
      paramIndex++;
    }

    if (filters?.requiresAttention !== undefined) {
      query += ` AND requires_attention = $${paramIndex}`;
      params.push(filters.requiresAttention);
      paramIndex++;
    }

    // Count total (before pagination)
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await this.tenantDbService.query(tenantId, countQuery, params);
    const total = parseInt(countResult[0].count);

    // Apply sorting
    const sortField = sort?.field || 'created_at';
    const sortOrder = sort?.order || 'DESC';
    query += ` ORDER BY ${sortField} ${sortOrder}`;

    // Apply pagination
    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(pagination.limit, offset);
    }

    const logs = await this.tenantDbService.query(tenantId, query, params);

    return { logs: logs.map(this.mapToEntity), total };
  }

  async countRecentActions(
    tenantId: string,
    userId: string,
    actionType: string,
    minutesAgo: number
  ): Promise<number> {
    const query = `
      SELECT COUNT(*) FROM audit_log
      WHERE tenant_id = $1
        AND user_id = $2
        AND action_type = $3
        AND created_at >= NOW() - INTERVAL '${minutesAgo} minutes'
    `;

    const result = await this.tenantDbService.query(tenantId, query, [tenantId, userId, actionType]);
    return parseInt(result[0].count);
  }

  async flagForReview(tenantId: string, logId: string, reason: string): Promise<void> {
    // Add to error_message field since we can't modify requires_attention directly
    // (audit logs are immutable after creation)
    // Instead, create a separate "review_flags" table
    const query = `
      INSERT INTO audit_review_flags (audit_log_id, reason, created_at)
      VALUES ($1, $2, NOW())
    `;
    await this.tenantDbService.query(tenantId, query, [logId, reason]);
  }

  private mapToEntity(row: any): AuditLogEntry {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      userEmail: row.user_email,
      userName: row.user_name,
      actorType: row.actor_type,
      actionType: row.action_type,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      resourceName: row.resource_name,
      httpMethod: row.http_method,
      endpoint: row.endpoint,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      requestId: row.request_id,
      oldValue: row.old_value,
      newValue: row.new_value,
      diff: row.diff,
      status: row.status,
      errorMessage: row.error_message,
      severity: row.severity,
      tags: row.tags,
      durationMs: row.duration_ms,
      createdAt: row.created_at,
      requiresAttention: row.requires_attention,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
    };
  }
}
```

### 3.4 Presentation Layer (Interceptor for Auto-Logging)

```typescript
// apps/api/src/presentation/interceptors/audit-logging.interceptor.ts
@Injectable()
export class AuditLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const handler = context.getHandler();

    // Check if this endpoint should be audited (use decorator)
    const shouldAudit = this.reflector.get<boolean>('audit', handler);
    if (!shouldAudit) {
      return next.handle();
    }

    // Get audit metadata from decorator
    const auditMetadata = this.reflector.get<AuditMetadata>('auditMetadata', handler);

    const startTime = Date.now();
    const tenantId = request.tenantId; // From @TenantContext()
    const user = request.user; // From JWT

    return next.handle().pipe(
      tap({
        next: (data) => {
          // Log successful operation
          const durationMs = Date.now() - startTime;

          this.commandBus.execute(
            new CreateAuditLogEntryCommand({
              tenantId,
              userId: user?.id,
              actionType: auditMetadata.action || this.inferActionType(request.method),
              resourceType: auditMetadata.resourceType,
              resourceId: data?.id || request.params.id,
              oldValue: auditMetadata.oldValue, // Set by controller before calling service
              newValue: data,
              status: 'success',
              httpMethod: request.method,
              endpoint: request.url,
              ipAddress: request.ip,
              userAgent: request.headers['user-agent'],
              durationMs,
            })
          );
        },
        error: (error) => {
          // Log failed operation
          const durationMs = Date.now() - startTime;

          this.commandBus.execute(
            new CreateAuditLogEntryCommand({
              tenantId,
              userId: user?.id,
              actionType: auditMetadata.action || this.inferActionType(request.method),
              resourceType: auditMetadata.resourceType,
              resourceId: request.params.id,
              status: 'failed',
              errorMessage: error.message,
              httpMethod: request.method,
              endpoint: request.url,
              ipAddress: request.ip,
              userAgent: request.headers['user-agent'],
              durationMs,
            })
          );
        },
      })
    );
  }

  private inferActionType(httpMethod: string): string {
    const methodMap: Record<string, string> = {
      POST: 'create',
      GET: 'read',
      PUT: 'update',
      PATCH: 'update',
      DELETE: 'delete',
    };
    return methodMap[httpMethod] || 'unknown';
  }
}

// Decorator for marking endpoints to be audited
export const Audit = (resourceType: string, action?: string) =>
  SetMetadata('audit', true) &&
  SetMetadata('auditMetadata', { resourceType, action });

// Usage in controller:
@Controller('api/wells')
export class WellsController {
  @Post()
  @Audit('well', 'create') // This endpoint will be auto-logged
  async createWell(@Body() dto: CreateWellDto) {
    return this.wellService.create(dto);
  }

  @Put(':id')
  @Audit('well', 'update')
  async updateWell(@Param('id') id: string, @Body() dto: UpdateWellDto) {
    // Fetch old value for audit log
    const oldWell = await this.wellService.findById(id);

    // Update well
    const newWell = await this.wellService.update(id, dto);

    // Set old value in request context for interceptor
    // (alternatively, emit domain event with old/new values)
    return newWell;
  }

  @Delete(':id')
  @Audit('well', 'delete')
  async deleteWell(@Param('id') id: string) {
    const oldWell = await this.wellService.findById(id);
    await this.wellService.delete(id);
    return { success: true, deleted: oldWell };
  }
}
```

### 3.5 Controllers

```typescript
// apps/api/src/presentation/audit/audit.controller.ts
@Controller('api/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {

  @Get('logs')
  @Roles('admin') // Only org admins
  async getAuditLogs(
    @TenantContext() tenantId: string,
    @Query() query: GetAuditLogsDto
  ) {
    const result = await this.queryBus.execute(
      new GetAuditLogsQuery({
        tenantId,
        filters: {
          userId: query.userId,
          actionType: query.actionType?.split(','),
          resourceType: query.resourceType?.split(','),
          severity: query.severity?.split(','),
          startDate: query.startDate ? new Date(query.startDate) : undefined,
          endDate: query.endDate ? new Date(query.endDate) : undefined,
          searchTerm: query.search,
          requiresAttention: query.requiresAttention,
        },
        pagination: {
          page: query.page || 1,
          limit: query.limit || 50,
        },
        sort: {
          field: query.sortBy || 'created_at',
          order: query.sortOrder || 'DESC',
        },
      })
    );

    return result;
  }

  @Get('logs/:id')
  @Roles('admin')
  async getAuditLogById(
    @TenantContext() tenantId: string,
    @Param('id') id: string
  ) {
    const log = await this.auditLogRepo.findById(tenantId, id);
    if (!log) {
      throw new NotFoundException('Audit log not found');
    }
    return log;
  }

  @Get('logs/export')
  @Roles('admin')
  async exportAuditLogs(
    @TenantContext() tenantId: string,
    @Query() query: GetAuditLogsDto,
    @Res() res: Response
  ) {
    // Export to CSV
    const { logs } = await this.queryBus.execute(
      new GetAuditLogsQuery({
        tenantId,
        filters: { /* ... */ },
        pagination: { page: 1, limit: 10000 }, // Max export limit
      })
    );

    const csv = this.convertToCSV(logs);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${Date.now()}.csv`);
    res.send(csv);
  }

  @Get('stats')
  @Roles('admin')
  async getAuditStats(@TenantContext() tenantId: string) {
    // Dashboard stats for audit log page
    return {
      totalLogs: await this.auditLogRepo.count(tenantId),
      todayLogs: await this.auditLogRepo.countToday(tenantId),
      criticalAlerts: await this.auditLogRepo.countBySeverity(tenantId, 'critical'),
      requiresAttention: await this.auditLogRepo.countRequiresAttention(tenantId),
    };
  }
}

// apps/admin/app/api/audit/route.ts (Super Admin - Admin Portal)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const tenantId = searchParams.get('tenantId'); // Optional: filter by tenant

  const result = await queryBus.execute(
    new GetCrossTenantAuditLogsQuery({
      tenantId: tenantId || undefined,
      filters: {
        severity: searchParams.get('severity')?.split(','),
        requiresAttention: searchParams.get('requiresAttention') === 'true',
        startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
        endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
      },
      pagination: {
        page: parseInt(searchParams.get('page') || '1'),
        limit: parseInt(searchParams.get('limit') || '50'),
      },
    })
  );

  return NextResponse.json(result);
}
```

---

## 4. Frontend Implementation

### 4.1 Web Portal (Org Admins)

```typescript
// apps/web/app/(dashboard)/audit/page.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Download, AlertTriangle, Info, AlertOctagon } from 'lucide-react';

export default function AuditLogPage() {
  const [filters, setFilters] = useState({
    search: '',
    actionType: 'all',
    resourceType: 'all',
    severity: 'all',
    startDate: null,
    endDate: null,
  });
  const [page, setPage] = useState(1);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs', filters, page],
    queryFn: () => api.getAuditLogs({ ...filters, page, limit: 50 }),
  });

  const { data: stats } = useQuery({
    queryKey: ['audit-stats'],
    queryFn: () => api.getAuditStats(),
    refetchInterval: 60000, // Refresh every minute
  });

  const handleExport = async () => {
    const blob = await api.exportAuditLogs(filters);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <Button onClick={handleExport} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export to CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
            <Info className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalLogs?.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Activity</CardTitle>
            <Info className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.todayLogs?.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
            <AlertOctagon className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.criticalAlerts}</div>
            <p className="text-xs text-muted-foreground">Requires immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Flagged for Review</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats?.requiresAttention}</div>
            <p className="text-xs text-muted-foreground">Manual review needed</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Input
              placeholder="Search..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />

            <Select value={filters.actionType} onValueChange={(val) => setFilters({ ...filters, actionType: val })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="export">Export</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.resourceType} onValueChange={(val) => setFilters({ ...filters, resourceType: val })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                <SelectItem value="well">Wells</SelectItem>
                <SelectItem value="field_entry">Field Entries</SelectItem>
                <SelectItem value="user">Users</SelectItem>
                <SelectItem value="role">Roles</SelectItem>
                <SelectItem value="nominal_range">Nominal Ranges</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.severity} onValueChange={(val) => setFilters({ ...filters, severity: val })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>

            <DateRangePicker
              value={{ start: filters.startDate, end: filters.endDate }}
              onChange={(range) => setFilters({ ...filters, startDate: range.start, endDate: range.end })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs?.logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{log.userName || 'System'}</p>
                      <p className="text-sm text-muted-foreground">{log.userEmail}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.actionType}</Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{log.resourceType}</p>
                      <p className="text-sm text-muted-foreground">{log.resourceName}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        log.severity === 'critical' ? 'destructive' :
                        log.severity === 'warning' ? 'warning' :
                        'default'
                      }
                    >
                      {log.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={log.status === 'success' ? 'success' : 'destructive'}>
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/audit/${log.id}`)}
                    >
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {((page - 1) * 50) + 1} to {Math.min(page * 50, logs?.total || 0)} of {logs?.total} results
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * 50 >= (logs?.total || 0)}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 4.2 Admin Portal (Super Admins - Cross-Tenant View)

```typescript
// apps/admin/app/dashboard/audit/page.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Badge, Select } from '@/components/ui';

export default function SuperAdminAuditPage() {
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [filters, setFilters] = useState({ severity: 'all', requiresAttention: false });

  const { data: logs } = useQuery({
    queryKey: ['cross-tenant-audit-logs', selectedTenant, filters],
    queryFn: () => api.getCrossTenantAuditLogs({ tenantId: selectedTenant, filters }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Cross-Tenant Audit Logs</h1>

      {/* Tenant Selector */}
      <Select
        placeholder="All Tenants"
        value={selectedTenant}
        onValueChange={setSelectedTenant}
      >
        <SelectItem value={null}>All Tenants</SelectItem>
        {/* Load tenants from API */}
      </Select>

      {/* Same table as org admin view, but with "Tenant" column added */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tenant</TableHead>
            <TableHead>Timestamp</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Resource</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs?.logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell>
                <Badge variant="outline">{log.tenantName}</Badge>
              </TableCell>
              {/* ... rest same as org admin view ... */}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

---

## 5. Implementation Timeline

**Phase 4F: Audit Logging** (1 week)

**Day 1-2: Backend Foundation**
- [ ] Create database schema (tenant + master)
- [ ] Implement domain entities
- [ ] Create repositories
- [ ] Add database indexes

**Day 3-4: Auto-Logging Infrastructure**
- [ ] Implement AuditLoggingInterceptor
- [ ] Create @Audit decorator
- [ ] Add audit logging to all controllers
- [ ] Implement anomaly detection

**Day 5-6: Query & Frontend**
- [ ] Implement query handlers (tenant + cross-tenant)
- [ ] Create web portal audit page (org admins)
- [ ] Create admin portal audit page (super admins)
- [ ] Add export to CSV functionality

**Day 7: Testing & Polish**
- [ ] Write unit tests (≥90% coverage)
- [ ] Write integration tests
- [ ] Performance testing (query with 100K+ logs)
- [ ] Security testing (verify tenant isolation)

---

## 6. Success Metrics

- [ ] 100% of sensitive operations are audited
- [ ] <500ms query response time for filtered audit logs
- [ ] Audit logs are immutable (cannot be modified/deleted)
- [ ] Super admins can view cross-tenant logs in <2s
- [ ] Export 10,000 logs to CSV in <5s
- [ ] Anomaly detection catches suspicious patterns (e.g., mass deletions)

---

## Conclusion

This comprehensive audit logging system provides:
- ✅ Full compliance with SOC 2, ISO 27001, HIPAA requirements
- ✅ Tenant-level isolation with super admin cross-tenant visibility
- ✅ Immutable logs with full before/after state tracking
- ✅ Real-time anomaly detection for security threats
- ✅ Advanced filtering, search, and export capabilities
- ✅ Auto-logging via interceptor (minimal code changes)

**Estimated Effort**: 5-7 days for complete implementation including testing.
