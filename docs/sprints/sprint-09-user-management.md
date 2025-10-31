# Sprint 9 - User Management & Team Collaboration

**Phase:** Phase 2 (Post-MVP Foundation)
**Goal:** Implement comprehensive team collaboration features enabling multiple users with role-based permissions to work together on a shared platform

**Sprint Duration:** 1 week
**Estimated Hours:** 24 hours
**Start Date:** Post-Sprint 8

---

## Sprint Objectives

### Primary Goal

Enable organizations to manage team members with granular role-based access control (RBAC), audit user activities, and support collaborative workflows across roles.

### Success Metrics

- [ ] User invitation workflow works end-to-end (email + link)
- [ ] Role-based access control enforced on all API endpoints
- [ ] Activity audit trail captures 100% of user mutations
- [ ] Tenant admin can view all team members and their activities
- [ ] < 3 second latency for permission checks on API endpoints

---

## User Stories

### US-1301: Team Member Invitation & Onboarding

**As a** tenant admin
**I want** to invite team members and assign them roles
**So that** my team can collaborate on the platform

**Acceptance Criteria:**

- [ ] Admin page to manage team members with invite functionality
- [ ] Send invite via email with unique signup link (7-day expiration)
- [ ] Invite email customizable with company branding
- [ ] Assign role during invitation (Viewer, Consultant, Manager, Admin)
- [ ] Display pending invitations with expiration countdown
- [ ] Resend invitation to same email (invalidates previous link)
- [ ] Team member page shows: name, role, email, last login, created date
- [ ] Bulk invite via CSV file (email list with roles)
- [ ] Remove team member (revokes access immediately)

**Technical Implementation:**

- **Domain Layer:**
  - `TeamInvitation` entity with: email, role, token, expiration
  - `TeamMember` entity with: user, role, organization, joined date
  - Value objects: `Role`, `InvitationToken`
  - Business logic: `isExpired()`, `generateToken()`, `assignRole()`

- **Application Layer:**
  - Command: `InviteTeamMemberCommand`
  - Command: `AssignRoleToTeamMemberCommand`
  - Command: `RemoveTeamMemberCommand`
  - Query: `GetTeamMembersQuery`
  - Service: `TeamInvitationService` generates token + sends email

- **Infrastructure Layer:**
  - Repository: Store invitations and team memberships
  - Email template: Invitation email with branding
  - Token generation: Cryptographically secure random token

- **Presentation Layer:**
  - Endpoints: CRUD for team members
  - Admin page: Team management dashboard

**Patterns Used:**

- [x] Hexagonal Architecture
- [x] Domain-Driven Design
- [x] CQRS Pattern
- [x] Repository Pattern
- [x] Token-Based Authentication Pattern

**Testing:**

- [ ] Unit tests for token generation and expiration
- [ ] Unit tests for role assignment logic
- [ ] Integration tests for invitation creation + email sending
- [ ] E2E test: send invitation, accept link, verify team member added
- [ ] E2E test: remove team member, verify access revoked

**Estimation:** 5 hours

---

### US-1302: Role-Based Access Control (RBAC) Enforcement

**As a** security engineer
**I want** all API endpoints protected by RBAC rules
**So that** users can only access resources their role permits

**Acceptance Criteria:**

- [ ] Roles defined: Admin, Manager, Consultant, Viewer
- [ ] Permission matrix defined (see below)
- [ ] Every API endpoint checks user role
- [ ] Permission denied returns 403 Forbidden with clear message
- [ ] RBAC checks use CASL library for declarative rules
- [ ] Admin can create custom roles (future: sprint 14)
- [ ] Permissions inherit through organization hierarchy

**Permission Matrix:**

| Feature | Admin | Manager | Consultant | Viewer |
|---------|-------|---------|------------|--------|
| View dashboard | ✓ | ✓ | ✓ | ✓ |
| Create field entry | ✓ | ✓ | ✓ | ✗ |
| Edit field entry | ✓ | ✓ | ✓ (own) | ✗ |
| View all field entries | ✓ | ✓ | ✗ | ✗ |
| View well data | ✓ | ✓ | ✓ | ✓ |
| Create well | ✓ | ✓ | ✗ | ✗ |
| Edit well | ✓ | ✓ | ✗ | ✗ |
| Delete well | ✓ | ✗ | ✗ | ✗ |
| Update nominal ranges | ✓ | ✓ | ✗ | ✗ |
| Generate reports | ✓ | ✓ | ✓ | ✓ |
| Schedule reports | ✓ | ✓ | ✗ | ✗ |
| Manage team members | ✓ | ✗ | ✗ | ✗ |
| Configure alerts | ✓ | ✓ | ✗ | ✗ |
| Manage integrations | ✓ | ✗ | ✗ | ✗ |

**Technical Implementation:**

- **Domain Layer:**
  - `Role` value object with permissions array
  - `Permission` value object: resource + action (e.g., "well:read", "field_entry:write")
  - Business logic: `can(user, action, resource)`

- **Application Layer:**
  - RBAC middleware using CASL library: `@UseGuards(CaslGuard)`
  - Decorator: `@Permissions('well:read', 'well:write')`
  - Policy class: Define permission rules declaratively

- **Infrastructure Layer:**
  - CASL factory: Create ability instance from user role
  - Policy repository: Store custom role definitions

- **Presentation Layer:**
  - Guards on all controller methods
  - Consistent 403 error responses

**Patterns Used:**

- [x] Authorization Guard Pattern
- [x] Policy-Based Access Control Pattern
- [x] Declarative Authorization (CASL)

**Testing:**

- [ ] Unit tests for permission matrix
- [ ] Unit tests for role-based access
- [ ] E2E tests: admin access, manager access, consultant access
- [ ] E2E test: viewer denied write access (403)
- [ ] Integration test: verify all endpoints protected

**Estimation:** 6 hours

---

### US-1303: Activity Audit Trail

**As a** tenant admin
**I want** to view an audit trail of all user activities (create, update, delete)
**So that** I can track changes and maintain compliance

**Acceptance Criteria:**

- [ ] Audit entry captured for every mutation (create/update/delete)
- [ ] Audit entry includes: user, action, resource, timestamp, before/after values
- [ ] Searchable by: user, resource type, date range, action
- [ ] Paginated list (1000 entries per page)
- [ ] Filterable audit trail in admin UI
- [ ] Immutable audit log (cannot be modified after creation)
- [ ] Export audit log as CSV (all entries matching filters)
- [ ] Retention: 7 years (regulatory requirement for O&G)
- [ ] Field entries in audit trail show: well name, API, field name, old value, new value

**Technical Implementation:**

- **Domain Layer:**
  - `AuditEntry` entity with: actor, action, resource, timestamp, changes
  - Value objects: `AuditAction` (CREATE, UPDATE, DELETE), `AuditChange`
  - Business logic: `getChangeDescription()`

- **Application Layer:**
  - Service: `AuditService` creates entries after mutations
  - Query: `GetAuditTrailQuery` with filters and pagination
  - Integration point: Intercept all command handlers to log mutations

- **Infrastructure Layer:**
  - Repository: Store audit entries (immutable, append-only table)
  - Event listener: Subscribe to domain events, create audit entries
  - Database: `audit_log` table with proper indexing

- **Presentation Layer:**
  - API endpoint: `GET /audit-trail?filters={}` paginated
  - Admin UI: Audit log viewer with filtering

**Patterns Used:**

- [x] Event Sourcing Pattern
- [x] Immutable Log Pattern
- [x] Observer Pattern (audit service listens to mutations)

**Testing:**

- [ ] Unit tests for audit entry creation
- [ ] Integration tests: verify entry created on each mutation
- [ ] E2E test: perform CRUD operations, verify audit trail
- [ ] Immutability test: attempt to modify audit entry (should fail)

**Estimation:** 5 hours

---

### US-1304: User Activity Dashboard (Admin View)

**As a** tenant admin
**I want** to see a dashboard showing user activities (last login, actions performed)
**So that** I can monitor team usage and identify inactive users

**Acceptance Criteria:**

- [ ] Dashboard shows: team member, last login, actions last 7 days
- [ ] Charts: daily active users (last 30 days), actions by type (pie chart)
- [ ] Identify inactive users (no login in 30 days)
- [ ] Timeline view of recent actions (last 50 actions across team)
- [ ] Drill down to user's full audit trail

**Technical Implementation:**

- **Frontend (React/Next.js):**
  - Component: `UserActivityDashboard.tsx`
  - Charts: Use Recharts for visualizations
  - Data: React Query for fetching activity summaries

- **Backend Changes:**
  - Endpoint: `GET /admin/user-activity/summary` aggregated stats
  - Endpoint: `GET /admin/user-activity/timeline` recent actions

- **Presentation Layer:**
  - Query handler: `GetUserActivitySummaryQuery` with aggregations

**Patterns Used:**

- [x] Dashboard Pattern
- [x] Aggregation Pattern

**Testing:**

- [ ] Component tests for dashboard rendering
- [ ] E2E test: verify activity data displays correctly

**Estimation:** 3 hours

---

### US-1305: Session Management & Logout

**As a** platform user
**I want** to logout and see my active sessions
**So that** I can manage my account security

**Acceptance Criteria:**

- [ ] Logout button in user menu (desktop + mobile)
- [ ] "Manage sessions" page shows active sessions (device, location, login time)
- [ ] Can terminate other sessions (force logout)
- [ ] Session timeout: 1 hour of inactivity (configurable)
- [ ] Remember device option (optional, increases interval to 30 days)
- [ ] Clear all sessions button
- [ ] Activity log: see logout events

**Technical Implementation:**

- **Backend Changes:**
  - Session table: Track active sessions with JWT tokens + expiration
  - Endpoint: `GET /auth/sessions` list active sessions
  - Endpoint: `DELETE /auth/sessions/:id` terminate session
  - Middleware: Check token expiration and inactivity timeout

- **Frontend (React/Next.js):**
  - Component: `SessionManagement.tsx`
  - Button: Logout in user menu

**Patterns Used:**

- [x] Session Management Pattern
- [x] Token-Based Authentication Pattern

**Testing:**

- [ ] E2E test: logout, verify token invalidated
- [ ] E2E test: view sessions, terminate session
- [ ] E2E test: session timeout after inactivity

**Estimation:** 3 hours

---

## Technical Tasks

### Backend

- [ ] Create TeamInvitation entity and repository
- [ ] Create TeamMember entity and repository
- [ ] Implement invitation email template
- [ ] Create RBAC guards using CASL library
- [ ] Define permission matrix and roles
- [ ] Create AuditEntry entity and repository
- [ ] Implement audit logging interceptor
- [ ] Create session management endpoints
- [ ] Add role assignment logic
- [ ] Create bulk invite from CSV

### Frontend - Web

- [ ] Create team management admin page
- [ ] Create user activity dashboard
- [ ] Create session management page
- [ ] Create invitation form (single + bulk)
- [ ] Create team member table
- [ ] Create activity audit log viewer
- [ ] Add role dropdown selector

### Database

- [ ] Create `team_invitations` table (tenant_db)

  ```sql
  CREATE TABLE team_invitations (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50),
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, email, token)
  );
  ```

- [ ] Create `audit_log` table (tenant_db)

  ```sql
  CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    actor_id UUID,
    actor_email VARCHAR(255),
    action VARCHAR(50),
    resource_type VARCHAR(100),
    resource_id UUID,
    changes JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_created (tenant_id, created_at),
    INDEX idx_resource (tenant_id, resource_type, resource_id)
  );
  ```

- [ ] Create `sessions` table (master_db)

  ```sql
  CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    token_hash VARCHAR(255),
    device_info JSONB,
    ip_address VARCHAR(50),
    last_activity TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    UNIQUE(user_id, token_hash)
  );
  ```

- [ ] Create `roles` table (tenant_db) if not exists

  ```sql
  CREATE TABLE roles (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(100),
    permissions TEXT[],
    is_system_role BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  ```

### DevOps

- [ ] Configure email template system (invitation emails)
- [ ] Add audit log retention policy (7-year retention)
- [ ] Configure session management (Redis for session store)
- [ ] Set up session timeout configuration

---

## Dependencies

### Blockers

- [ ] Sprint 4 authentication must be complete
- [ ] Sprint 8 must complete (for RBAC rules on reports)

### External Dependencies

- [ ] `@casl/ability` npm package (RBAC library)
- [ ] `@casl/prisma` npm package (CASL + Prisma integration)
- [ ] `passport-jwt` (already installed)

---

## Definition of Done

### Code Quality

- [ ] TypeScript strict mode (no `any`)
- [ ] Lint passes
- [ ] Type check passes
- [ ] Build succeeds

### Testing

- [ ] Unit tests >80% coverage (permissions, roles)
- [ ] Integration tests for invitation workflow
- [ ] E2E tests for team member management
- [ ] E2E tests for audit trail creation
- [ ] Security tests: RBAC enforced on all endpoints

### Security

- [ ] Invitation tokens are cryptographically secure
- [ ] Audit log is immutable (append-only)
- [ ] Audit log includes sensitive operations only
- [ ] Session tokens properly invalidated on logout
- [ ] No sensitive data in audit log

### Documentation

- [ ] API endpoints documented (Swagger)
- [ ] Permission matrix documented
- [ ] Role descriptions documented
- [ ] RBAC implementation guide documented

### Review

- [ ] PR reviewed and approved (security review)
- [ ] CI/CD passing
- [ ] Demo-ready with sample team data
- [ ] Security officer review (if applicable)

---

## Sprint Retrospective Template

### What Went Well

- [Item 1]
- [Item 2]

### What to Improve

- [Item 1]
- [Item 2]

### Action Items for Next Sprint

- [ ] [Action 1]
- [ ] [Action 2]

---

## Metrics

- **Planned Story Points:** 24 hours
- **Completed Story Points:** [X]
- **Velocity:** [X points]
- **Code Coverage:** [X%]
- **Permission Check Latency:** < 10ms
- **Invitation Email Delivery Rate:** > 99%
- **Audit Log Accuracy:** 100%

---

## Next Sprint Preview

**Sprint 10: Offline Sync & Resilience**

- Offline capability for mobile app
- Conflict resolution strategies
- Bidirectional sync with retry logic
- Connection quality detection

**Estimated Duration:** 1 week (32 hours)
