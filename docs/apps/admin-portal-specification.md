# WellPulse Admin Portal Specification

**Version**: 1.0
**Last Updated**: October 23, 2025
**Status**: 🏗️ Architecture Design

---

## Overview

The WellPulse Admin Portal is an internal-facing web application for WellPulse staff to manage all aspects of tenant onboarding, provisioning, monitoring, and support **without requiring direct access to Azure, AWS, or client infrastructure**.

**Key Principle**: The admin portal is the **single source of truth** and **command center** for WellPulse operations. Admins should never need to:
- Log into Azure Portal
- Connect to databases via `psql`
- SSH into servers
- Manually edit configuration files

Everything is done through the admin portal UI.

---

## Access & Security

### URL & Authentication

```
Production: https://admin.wellpulse.io
Staging: https://admin-staging.wellpulse.io

Authentication:
  - Email/password (WellPulse staff only)
  - Multi-factor authentication (TOTP via Google Authenticator)
  - IP whitelisting (only from WellPulse office network)
  - Session timeout: 30 minutes of inactivity
```

### Role-Based Access Control (RBAC)

| Role | Permissions | Use Case |
|------|-------------|----------|
| **Super Admin** | Full access (create/edit/delete tenants, manage billing, view all data) | Founders, CTO |
| **Operations Admin** | Tenant management, provisioning, monitoring | Operations team |
| **Support Admin** | View-only access to tenant data, can create support tickets | Customer support team |
| **Billing Admin** | View/edit billing, invoices, payment methods | Finance team |
| **Read-Only** | View-only access to everything | Investors, advisors |

---

## Tech Stack

```yaml
Frontend:
  - Next.js 15 (App Router)
  - React 19
  - Tailwind CSS 4
  - Shadcn UI
  - React Query
  - Zustand (state management)

Backend:
  - Shared NestJS API (same as main API)
  - Separate admin module with admin guards
  - Admin-only endpoints under /admin/*

Database:
  - Master PostgreSQL database (same as tenant registry)
  - Admin users table
  - Admin audit log table

Deployment:
  - Azure Container Apps (same as web app)
  - Subdomain: admin.wellpulse.io
```

---

## Core Features

### 1. Tenant Management Dashboard

**URL**: `https://admin.wellpulse.io/tenants`

**Overview Screen**:
```
┌─────────────────────────────────────────────────────────────────┐
│  WellPulse Admin Portal                          [Profile] [Logout]│
├─────────────────────────────────────────────────────────────────┤
│  📊 Dashboard  👥 Tenants  💰 Billing  📈 Analytics  ⚙️ Settings │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Tenant Overview                              [+ Create Tenant] │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 🔍 Search:  [________________]  Filter: [All] [Active]    │ │
│  │                                         [Trial] [Suspended] │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Tenant            Status    Tier    DB Location   Created  │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ 🟢 ACME Oil       ACTIVE    PRO     Azure        10/15/25  │ │
│  │ 🟢 Permian Prod   ACTIVE    ENT     AWS          10/10/25  │ │
│  │ 🟡 Texas Energy   TRIAL     START   On-Prem      10/20/25  │ │
│  │ 🔴 Old Operator   SUSPENDED PRO     Azure        09/01/25  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Stats:                                                         │
│  - Total Tenants: 42                                            │
│  - Active: 38  |  Trial: 3  |  Suspended: 1                   │
│  - This Month: +5 new tenants                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Click on tenant → Detail view**:

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Tenants                                              │
├─────────────────────────────────────────────────────────────────┤
│  ACME Oil & Gas                                    [Edit] [•••]  │
│  acmeoil.wellpulse.io                             🟢 ACTIVE      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📋 Details    🗄️ Database    👥 Users    📊 Usage    💰 Billing │
│                                                                 │
│  ═════════════════════════════════════════════════════════════ │
│  Details                                                        │
│  ═════════════════════════════════════════════════════════════ │
│                                                                 │
│  Tenant ID:        acmeoil-uuid-123                            │
│  Slug:             acmeoil                                      │
│  Company Name:     ACME Oil & Gas, Inc.                        │
│  Website:          https://acmeoil.wellpulse.io                │
│  Contact Email:    admin@acmeoil.com                           │
│  Phone:            (432) 555-0123                              │
│  Address:          123 Oil Field Rd, Midland, TX 79701         │
│                                                                 │
│  Tier:             Professional ($299/month)                    │
│  Status:           Active                                       │
│  Trial Ends:       N/A (paying customer)                       │
│  Created:          October 15, 2025                            │
│  Created By:       jason@wellpulse.io                          │
│                                                                 │
│  ═════════════════════════════════════════════════════════════ │
│  Database                                                       │
│  ═════════════════════════════════════════════════════════════ │
│                                                                 │
│  Provider:         Azure PostgreSQL Flexible Server            │
│  Region:           East US 2                                    │
│  Connection Type:  Private Link                                 │
│  Database URL:     postgresql://acmeoil_user:****@...          │
│  Schema Version:   v1.2.3 (latest)                             │
│                                                                 │
│  [Test Connection]  [Run Migrations]  [View Schema]            │
│                                                                 │
│  Last Migration:   October 22, 2025 (migration_015_add_esg)   │
│  Connection Status: ✓ Connected (latency: 12ms)               │
│                                                                 │
│  ═════════════════════════════════════════════════════════════ │
│  Users (5 total)                                                │
│  ═════════════════════════════════════════════════════════════ │
│                                                                 │
│  john.doe@acmeoil.com        Admin         Last login: Today   │
│  jane.smith@acmeoil.com      Manager       Last login: 2d ago  │
│  field.operator1@acmeoil.com Field Operator Last login: 1h ago │
│  field.operator2@acmeoil.com Field Operator Last login: 5h ago │
│  viewer@consultant.com       Viewer        Last login: Never   │
│                                                                 │
│  [+ Add User]  [Send Invitations]                              │
│                                                                 │
│  ═════════════════════════════════════════════════════════════ │
│  Usage Statistics (Last 30 Days)                                │
│  ═════════════════════════════════════════════════════════════ │
│                                                                 │
│  API Requests:     1,234,567 requests                          │
│  Data Synced:      45 GB                                        │
│  Storage Used:     12.3 GB (photos, PDFs)                      │
│  Active Wells:     47 wells                                     │
│  Field Data Entries: 3,456 entries                             │
│                                                                 │
│  ═════════════════════════════════════════════════════════════ │
│  Billing                                                        │
│  ═════════════════════════════════════════════════════════════ │
│                                                                 │
│  Current Plan:     Professional ($299/month)                    │
│  Billing Cycle:    Monthly (renews Nov 15)                     │
│  Payment Method:   Visa •••• 4242 (exp 12/26)                  │
│  Next Invoice:     $299.00 on November 15, 2025               │
│  Status:           ✓ Paid (current through Nov 15)            │
│                                                                 │
│  [View Invoice History]  [Update Payment Method]               │
│                                                                 │
│  ═════════════════════════════════════════════════════════════ │
│  Actions                                                        │
│  ═════════════════════════════════════════════════════════════ │
│                                                                 │
│  [Suspend Tenant]  [Upgrade Plan]  [Export Data]               │
│  [Send Notification]  [View Audit Log]                         │
└─────────────────────────────────────────────────────────────────┘
```

---

### 2. Tenant Provisioning Wizard

**URL**: `https://admin.wellpulse.io/tenants/new`

**Step 1: Company Information**

```
┌─────────────────────────────────────────────────────────────────┐
│  Create New Tenant                               Step 1 of 5     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Company Information                                            │
│                                                                 │
│  Company Name *                                                 │
│  [_________________________________________________________]   │
│                                                                 │
│  Subdomain * (will become {slug}.wellpulse.io)                 │
│  [___________________] .wellpulse.io                           │
│  ✓ Available   or   ✗ Already taken                           │
│                                                                 │
│  Primary Contact Email *                                        │
│  [_________________________________________________________]   │
│                                                                 │
│  Phone Number                                                   │
│  [_________________________________________________________]   │
│                                                                 │
│  Address                                                        │
│  [_________________________________________________________]   │
│  [_________________________________________________________]   │
│                                                                 │
│  Website                                                        │
│  [_________________________________________________________]   │
│                                                                 │
│                                  [Cancel]  [Next: Database →]  │
└─────────────────────────────────────────────────────────────────┘
```

**Step 2: Database Configuration**

```
┌─────────────────────────────────────────────────────────────────┐
│  Create New Tenant                               Step 2 of 5     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Database Configuration                                         │
│                                                                 │
│  Where will this tenant's database be hosted? *                │
│                                                                 │
│  ○ Azure PostgreSQL (Recommended)                              │
│    └─ We'll provision a new Azure database for the client     │
│                                                                 │
│  ○ AWS RDS PostgreSQL                                          │
│    └─ We'll provision a new AWS RDS instance                  │
│                                                                 │
│  ○ Client's Own Azure PostgreSQL                               │
│    └─ Client provides connection string                       │
│                                                                 │
│  ○ Client's Own AWS RDS PostgreSQL                             │
│    └─ Client provides connection string                       │
│                                                                 │
│  ○ On-Premises PostgreSQL (VPN Required)                       │
│    └─ Client provides connection string + VPN config          │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ If "Azure PostgreSQL" selected:                        │    │
│  │                                                         │    │
│  │ Azure Region:                                          │    │
│  │ [East US 2 ▼]                                          │    │
│  │                                                         │    │
│  │ Database SKU:                                          │    │
│  │ [Burstable B1ms (1 vCore, 2GB RAM) - $30/mo ▼]       │    │
│  │                                                         │    │
│  │ Storage:                                               │    │
│  │ [32 GB ▼]  (Auto-grow: ☑ Enabled)                     │    │
│  │                                                         │    │
│  │ High Availability:                                     │    │
│  │ ☐ Enable (adds ~$50/month)                            │    │
│  │                                                         │    │
│  │ Backup Retention:                                      │    │
│  │ [7 days ▼]                                             │    │
│  │                                                         │    │
│  │ Estimated Cost: $30/month                              │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ If "Client's Own" selected:                            │    │
│  │                                                         │    │
│  │ Database Connection String *                           │    │
│  │ [postgresql://user:pass@host:5432/dbname]             │    │
│  │                                                         │    │
│  │ [Test Connection]                                      │    │
│  │ ✓ Connection successful!                               │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│                              [← Back]  [Next: Plan Selection →] │
└─────────────────────────────────────────────────────────────────┘
```

**Step 3: Plan Selection**

```
┌─────────────────────────────────────────────────────────────────┐
│  Create New Tenant                               Step 3 of 5     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Subscription Plan                                              │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   STARTER    │  │ PROFESSIONAL │  │  ENTERPRISE  │         │
│  │              │  │              │  │              │         │
│  │   $99/mo     │  │   $299/mo    │  │   $999/mo    │         │
│  │              │  │              │  │              │         │
│  │ • 10 users   │  │ • 50 users   │  │ • Unlimited  │         │
│  │ • 50 wells   │  │ • 200 wells  │  │ • Unlimited  │         │
│  │ • 10 GB      │  │ • 50 GB      │  │ • Unlimited  │         │
│  │              │  │              │  │              │         │
│  │              │  │ • Predictive │  │ • Everything │         │
│  │              │  │   Maintenance│  │ • SSO        │         │
│  │              │  │ • ESG        │  │ • Priority   │         │
│  │              │  │              │  │   Support    │         │
│  │              │  │              │  │ • Dedicated  │         │
│  │              │  │              │  │   Account Mgr│         │
│  │              │  │              │  │              │         │
│  │  [Select]    │  │  [Select]    │  │  [Select]    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  Trial Period:  ☑ Enable 30-day free trial                     │
│                                                                 │
│                       [← Back]  [Next: Admin User →]           │
└─────────────────────────────────────────────────────────────────┘
```

**Step 4: Create Admin User**

```
┌─────────────────────────────────────────────────────────────────┐
│  Create New Tenant                               Step 4 of 5     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Initial Admin User                                             │
│                                                                 │
│  This user will have full admin access to the tenant account.  │
│                                                                 │
│  First Name *                                                   │
│  [_________________________________________________________]   │
│                                                                 │
│  Last Name *                                                    │
│  [_________________________________________________________]   │
│                                                                 │
│  Email *                                                        │
│  [_________________________________________________________]   │
│                                                                 │
│  Phone Number                                                   │
│  [_________________________________________________________]   │
│                                                                 │
│  Password Setup:                                                │
│  ○ Send magic link (user sets password on first login)        │
│  ● Auto-generate password (sent via email)                     │
│                                                                 │
│                                [← Back]  [Next: Review →]      │
└─────────────────────────────────────────────────────────────────┘
```

**Step 5: Review & Provision**

```
┌─────────────────────────────────────────────────────────────────┐
│  Create New Tenant                               Step 5 of 5     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Review & Provision                                             │
│                                                                 │
│  ═════════════════════════════════════════════════════════════ │
│  Company Information                                            │
│  ═════════════════════════════════════════════════════════════ │
│  Name:      ACME Oil & Gas, Inc.                               │
│  Subdomain: acmeoil.wellpulse.io                               │
│  Contact:   admin@acmeoil.com                                  │
│                                                                 │
│  ═════════════════════════════════════════════════════════════ │
│  Database Configuration                                         │
│  ═════════════════════════════════════════════════════════════ │
│  Provider:  Azure PostgreSQL Flexible Server                   │
│  Region:    East US 2                                           │
│  SKU:       Burstable B1ms (1 vCore, 2GB RAM)                  │
│  Cost:      $30/month                                           │
│                                                                 │
│  ═════════════════════════════════════════════════════════════ │
│  Subscription Plan                                              │
│  ═════════════════════════════════════════════════════════════ │
│  Plan:      Professional ($299/month)                           │
│  Trial:     30 days free (ends Nov 22, 2025)                   │
│                                                                 │
│  ═════════════════════════════════════════════════════════════ │
│  Admin User                                                     │
│  ═════════════════════════════════════════════════════════════ │
│  Name:      John Doe                                            │
│  Email:     john.doe@acmeoil.com                               │
│  Password:  Auto-generated (will be emailed)                   │
│                                                                 │
│  ═════════════════════════════════════════════════════════════ │
│  Provisioning Steps (automated)                                 │
│  ═════════════════════════════════════════════════════════════ │
│  1. Create tenant record in master database                    │
│  2. Provision Azure PostgreSQL database                        │
│  3. Run database migrations                                     │
│  4. Configure subdomain (acmeoil.wellpulse.io)                │
│  5. Create admin user account                                   │
│  6. Send welcome email with login instructions                 │
│                                                                 │
│  Estimated Time: 3-5 minutes                                    │
│                                                                 │
│                   [← Back]  [Provision Tenant]                 │
└─────────────────────────────────────────────────────────────────┘
```

**Provisioning Progress Screen**:

```
┌─────────────────────────────────────────────────────────────────┐
│  Provisioning Tenant: ACME Oil & Gas                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✓ Created tenant record in master database                    │
│  ⏳ Provisioning Azure PostgreSQL database... (2/5 min)        │
│  ○ Running database migrations                                  │
│  ○ Configuring subdomain                                        │
│  ○ Creating admin user                                          │
│  ○ Sending welcome email                                        │
│                                                                 │
│  ████████████████░░░░░░░░░░░░░░░░░░░░ 40%                     │
│                                                                 │
│  Current Step: Waiting for Azure to provision database...      │
│                                                                 │
│                                            [Cancel Provisioning] │
└─────────────────────────────────────────────────────────────────┘
```

**Success Screen**:

```
┌─────────────────────────────────────────────────────────────────┐
│  ✓ Tenant Provisioned Successfully!                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🎉 ACME Oil & Gas is ready to use WellPulse!                  │
│                                                                 │
│  Tenant URL:      https://acmeoil.wellpulse.io                 │
│  Admin Email:     john.doe@acmeoil.com                         │
│  Admin Password:  [Sent via email]                             │
│                                                                 │
│  Database:        acmeoil_prod (Azure East US 2)               │
│  Schema Version:  v1.2.3 (latest)                              │
│                                                                 │
│  Next Steps:                                                    │
│  1. Admin user has been emailed login instructions             │
│  2. Tenant is in 30-day trial period (ends Nov 22)            │
│  3. Collect payment method before trial expires                │
│                                                                 │
│                [View Tenant Details]  [Create Another Tenant]  │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3. Database Management

**URL**: `https://admin.wellpulse.io/database`

**Features**:

```
Database Management
═══════════════════════════════════════════════════════════════

Schema Migrations
─────────────────────────────────────────────────────────────
[Select Tenant: All Tenants ▼]

┌────────────────────────────────────────────────────────────┐
│ Migration History                                          │
├────────────────────────────────────────────────────────────┤
│ migration_015_add_esg_tracking       Applied: 38/42 tenants │
│ migration_014_add_equipment_photos   Applied: 42/42 tenants │
│ migration_013_add_notes_field        Applied: 42/42 tenants │
└────────────────────────────────────────────────────────────┘

Pending Migrations: 4 tenants need migration_015

[View Details]  [Run Migrations for All]  [Rollback Last]

Connection Health
─────────────────────────────────────────────────────────────
┌────────────────────────────────────────────────────────────┐
│ Tenant           Status      Latency   Last Checked         │
├────────────────────────────────────────────────────────────┤
│ ACME Oil         ✓ Online    12ms      2 min ago           │
│ Permian Prod     ✓ Online    45ms      2 min ago           │
│ Texas Energy     ✗ Offline   -         2 min ago (ERROR)   │
│ ...                                                         │
└────────────────────────────────────────────────────────────┘

[Test All Connections]  [Export Health Report]

Backup Management
─────────────────────────────────────────────────────────────
[Select Tenant: ACME Oil ▼]

Last Backup: October 23, 2025 2:00 AM (12 hours ago)
Next Backup: October 24, 2025 2:00 AM (12 hours from now)
Retention:   7 days

[Trigger Backup Now]  [Restore from Backup]  [Download Backup]
```

---

### 4. User Management (Cross-Tenant)

**URL**: `https://admin.wellpulse.io/users`

```
User Management
═══════════════════════════════════════════════════════════════

🔍 Search:  [________________]  Filter: [All] [Active] [Suspended]

┌────────────────────────────────────────────────────────────┐
│ User              Tenant         Role           Status     │
├────────────────────────────────────────────────────────────┤
│ john.doe@...      ACME Oil      Admin          Active     │
│ jane.smith@...    ACME Oil      Manager        Active     │
│ field.op@...      ACME Oil      Field Operator Active     │
│ admin@permian...  Permian Prod  Admin          Active     │
│ ...                                                         │
└────────────────────────────────────────────────────────────┘

Actions:
- [Reset Password]
- [Suspend User]
- [Change Role]
- [View Activity Log]
```

---

### 5. Billing & Invoicing

**URL**: `https://admin.wellpulse.io/billing`

```
Billing Overview
═══════════════════════════════════════════════════════════════

Monthly Recurring Revenue (MRR):  $12,558
Annual Run Rate (ARR):            $150,696

Revenue Breakdown
─────────────────────────────────────────────────────────────
Starter Plan:       12 tenants × $99   = $1,188
Professional Plan:  28 tenants × $299  = $8,372
Enterprise Plan:     2 tenants × $999  = $1,998
────────────────────────────────────────────────
Total MRR:                                $12,558

Upcoming Renewals (Next 7 Days)
─────────────────────────────────────────────────────────────
┌────────────────────────────────────────────────────────────┐
│ Tenant         Plan          Amount   Renewal Date  Status │
├────────────────────────────────────────────────────────────┤
│ ACME Oil       Professional  $299     Oct 25        ✓ Paid │
│ Texas Energy   Starter       $99      Oct 27        ⚠ Trial│
│ ...                                                         │
└────────────────────────────────────────────────────────────┘

[View Invoice History]  [Download Reports]
```

---

### 6. Analytics & Monitoring

**URL**: `https://admin.wellpulse.io/analytics`

```
Platform Analytics
═══════════════════════════════════════════════════════════════

System Health
─────────────────────────────────────────────────────────────
API Uptime:       99.97% (last 30 days)
Avg Response Time: 145ms
Error Rate:        0.03%
Active Tenants:    42

[Chart: API Response Time (Last 7 Days)]
[Chart: Error Rate Trends]

Usage Statistics (All Tenants, Last 30 Days)
─────────────────────────────────────────────────────────────
Total API Requests:     45.2M requests
Data Synced:            1.2 TB
Storage Used:           342 GB
Active Wells:           1,847 wells
Field Data Entries:     123,456 entries

Top Users by Activity
─────────────────────────────────────────────────────────────
1. ACME Oil        - 12.3M requests
2. Permian Prod    - 8.7M requests
3. Texas Energy    - 6.2M requests
...

[Export Full Report]  [Set Up Alerts]
```

---

### 7. Support Tickets

**URL**: `https://admin.wellpulse.io/support`

```
Support Tickets
═══════════════════════════════════════════════════════════════

[New Ticket]

┌────────────────────────────────────────────────────────────┐
│ Ticket    Tenant       Subject              Status  Age    │
├────────────────────────────────────────────────────────────┤
│ #1234     ACME Oil     Can't sync data      Open    2h     │
│ #1233     Texas Energy Database timeout     Open    1d     │
│ #1232     Permian Prod Feature request      Closed  3d     │
│ ...                                                         │
└────────────────────────────────────────────────────────────┘

[Filter: Open] [Priority: All] [Assigned to: Me]
```

---

## API Endpoints (Admin Module)

All admin endpoints require admin authentication token:

```typescript
// apps/api/src/presentation/admin/admin.controller.ts

@Controller('admin')
@UseGuards(AdminAuthGuard) // Requires admin role
export class AdminController {

  // Tenant Management
  @Get('tenants')
  async getAllTenants(): Promise<TenantDto[]> {}

  @Get('tenants/:tenantId')
  async getTenantById(@Param('tenantId') tenantId: string): Promise<TenantDetailDto> {}

  @Post('tenants')
  async createTenant(@Body() dto: CreateTenantDto): Promise<TenantDto> {
    // Triggers provisioning workflow:
    // 1. Create tenant record in master DB
    // 2. Provision database (Azure/AWS)
    // 3. Run migrations
    // 4. Configure subdomain
    // 5. Create admin user
    // 6. Send welcome email
  }

  @Patch('tenants/:tenantId')
  async updateTenant(@Param('tenantId') tenantId: string, @Body() dto: UpdateTenantDto): Promise<TenantDto> {}

  @Post('tenants/:tenantId/suspend')
  async suspendTenant(@Param('tenantId') tenantId: string): Promise<void> {}

  @Post('tenants/:tenantId/reactivate')
  async reactivateTenant(@Param('tenantId') tenantId: string): Promise<void> {}

  // Database Management
  @Post('database/test-connection')
  async testDatabaseConnection(@Body() dto: TestConnectionDto): Promise<ConnectionTestResult> {}

  @Post('database/migrations/run')
  async runMigrations(@Body() dto: RunMigrationsDto): Promise<MigrationResult> {
    // Runs migrations for specified tenants
    // Updates migration status in master DB
  }

  @Get('database/migrations/status')
  async getMigrationStatus(): Promise<MigrationStatusDto> {}

  @Post('database/backup/:tenantId')
  async triggerBackup(@Param('tenantId') tenantId: string): Promise<BackupResult> {}

  // User Management
  @Get('users')
  async getAllUsers(@Query() query: UserFilterDto): Promise<UserDto[]> {}

  @Post('users/:userId/reset-password')
  async resetUserPassword(@Param('userId') userId: string): Promise<void> {}

  @Post('users/:userId/suspend')
  async suspendUser(@Param('userId') userId: string): Promise<void> {}

  // Billing
  @Get('billing/overview')
  async getBillingOverview(): Promise<BillingOverviewDto> {}

  @Get('billing/invoices')
  async getInvoices(@Query() query: InvoiceFilterDto): Promise<InvoiceDto[]> {}

  // Analytics
  @Get('analytics/platform')
  async getPlatformAnalytics(@Query() query: AnalyticsFilterDto): Promise<PlatformAnalyticsDto> {}

  @Get('analytics/tenants')
  async getTenantAnalytics(): Promise<TenantAnalyticsDto[]> {}

  // Support
  @Get('support/tickets')
  async getSupportTickets(@Query() query: TicketFilterDto): Promise<SupportTicketDto[]> {}

  @Post('support/tickets')
  async createSupportTicket(@Body() dto: CreateTicketDto): Promise<SupportTicketDto> {}

  // Audit Logs
  @Get('audit-logs')
  async getAuditLogs(@Query() query: AuditLogFilterDto): Promise<AuditLogDto[]> {}
}
```

---

## Provisioning Workflow (Backend)

```typescript
// apps/api/src/application/admin/commands/create-tenant.handler.ts
@CommandHandler(CreateTenantCommand)
export class CreateTenantHandler implements ICommandHandler<CreateTenantCommand> {
  constructor(
    private readonly masterDb: MasterDatabaseService,
    private readonly azureService: AzureProvisioningService,
    private readonly migrationService: MigrationService,
    private readonly emailService: EmailService,
  ) {}

  async execute(command: CreateTenantCommand): Promise<TenantProvisioningResult> {
    const { companyInfo, databaseConfig, plan, adminUser } = command;

    // Step 1: Create tenant record in master database
    const tenant = await this.masterDb.tenants.create({
      id: uuidv4(),
      slug: companyInfo.slug,
      name: companyInfo.name,
      tier: plan.tier,
      status: 'PROVISIONING',
      // ... other fields
    });

    try {
      // Step 2: Provision database
      let databaseUrl: string;

      if (databaseConfig.provider === 'AZURE_MANAGED') {
        // Provision new Azure PostgreSQL Flexible Server
        const dbResult = await this.azureService.provisionPostgreSQL({
          resourceGroup: 'wellpulse-prod',
          serverName: `${companyInfo.slug}-db`,
          region: databaseConfig.region,
          sku: databaseConfig.sku,
          storage: databaseConfig.storage,
        });

        databaseUrl = dbResult.connectionString;

        // Wait for database to be ready (can take 3-5 minutes)
        await this.waitForDatabaseReady(databaseUrl);
      } else if (databaseConfig.provider === 'CLIENT_PROVIDED') {
        // Use client-provided connection string
        databaseUrl = databaseConfig.connectionString;

        // Test connection
        const isConnected = await this.testConnection(databaseUrl);
        if (!isConnected) {
          throw new Error('Failed to connect to client-provided database');
        }
      }

      // Update tenant with database URL
      await this.masterDb.tenants.update(tenant.id, { databaseUrl });

      // Step 3: Run database migrations
      await this.migrationService.runMigrations(tenant.id, databaseUrl);

      // Step 4: Configure subdomain (Azure Front Door routing)
      await this.azureService.configureSubdomain(`${companyInfo.slug}.wellpulse.io`);

      // Step 5: Create admin user
      const adminUserRecord = await this.masterDb.tenantUsers.create({
        id: uuidv4(),
        tenantId: tenant.id,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        role: 'ADMIN',
        passwordHash: await this.hashPassword(adminUser.autoGeneratedPassword),
      });

      // Step 6: Send welcome email
      await this.emailService.sendWelcomeEmail({
        to: adminUser.email,
        tenantUrl: `https://${companyInfo.slug}.wellpulse.io`,
        email: adminUser.email,
        password: adminUser.autoGeneratedPassword,
      });

      // Step 7: Update tenant status to ACTIVE
      await this.masterDb.tenants.update(tenant.id, { status: 'ACTIVE' });

      return {
        success: true,
        tenantId: tenant.id,
        tenantUrl: `https://${companyInfo.slug}.wellpulse.io`,
        databaseUrl,
        adminUserId: adminUserRecord.id,
      };
    } catch (error) {
      // Rollback: Mark tenant as failed, log error
      await this.masterDb.tenants.update(tenant.id, { status: 'PROVISIONING_FAILED' });
      throw error;
    }
  }

  private async waitForDatabaseReady(connectionString: string): Promise<void> {
    // Poll every 10 seconds for up to 5 minutes
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      const isReady = await this.testConnection(connectionString);
      if (isReady) return;
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10s
    }
    throw new Error('Database provisioning timed out');
  }

  private async testConnection(connectionString: string): Promise<boolean> {
    try {
      const pool = new Pool({ connectionString });
      await pool.query('SELECT 1');
      await pool.end();
      return true;
    } catch {
      return false;
    }
  }
}
```

---

## Audit Logging

Every admin action is logged:

```typescript
// apps/api/src/infrastructure/database/schema/master/admin-audit-logs.schema.ts
export const adminAuditLogsTable = pgTable('admin_audit_logs', {
  id: varchar('id', { length: 255 }).primaryKey(),
  adminUserId: varchar('admin_user_id', { length: 255 }).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
    // "CREATE_TENANT", "UPDATE_TENANT", "SUSPEND_TENANT", "RUN_MIGRATIONS", etc.
  resource: varchar('resource', { length: 100 }).notNull(),
    // "TENANT", "USER", "DATABASE", etc.
  resourceId: varchar('resource_id', { length: 255 }), // ID of affected resource
  details: jsonb('details'), // Additional context
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

**Example Audit Log**:

```json
{
  "id": "log-123",
  "adminUserId": "admin-456",
  "action": "CREATE_TENANT",
  "resource": "TENANT",
  "resourceId": "acmeoil-uuid",
  "details": {
    "tenantName": "ACME Oil & Gas",
    "slug": "acmeoil",
    "databaseProvider": "AZURE_MANAGED",
    "plan": "PROFESSIONAL"
  },
  "ipAddress": "203.0.113.45",
  "userAgent": "Mozilla/5.0...",
  "createdAt": "2025-10-23T14:30:00Z"
}
```

---

## Security Considerations

1. **Admin-only endpoints**: All admin routes require `AdminAuthGuard`
2. **MFA required**: Multi-factor authentication mandatory for admin accounts
3. **IP whitelisting**: Admin portal only accessible from WellPulse office network (optional)
4. **Audit logging**: Every admin action logged with IP, user agent, timestamp
5. **Role separation**: Super Admin vs Operations Admin vs Support Admin
6. **Database credentials**: Never displayed in plain text (always masked)
7. **Session timeout**: 30 minutes of inactivity logs out admin

---

## Deployment

```yaml
# Azure Container App: admin.wellpulse.io
Name: wellpulse-admin
Image: ghcr.io/yourusername/wellpulse-admin:latest
Ingress: Enabled, External, Port 3000
Custom Domain: admin.wellpulse.io
Environment Variables:
  - API_URL: https://api.wellpulse.io
  - NEXTAUTH_URL: https://admin.wellpulse.io
  - NEXTAUTH_SECRET: @Microsoft.KeyVault(SecretUri=...)
  - MASTER_DATABASE_URL: @Microsoft.KeyVault(SecretUri=...)
  - AZURE_SUBSCRIPTION_ID: @Microsoft.KeyVault(SecretUri=...)
  - AZURE_CREDENTIALS: @Microsoft.KeyVault(SecretUri=...) # For provisioning
```

---

## Summary

The **WellPulse Admin Portal** provides:

1. **Tenant Provisioning**: 5-step wizard to create new tenants (company info, database config, plan, admin user, review)
2. **Database Management**: Test connections, run migrations, trigger backups - all from UI
3. **User Management**: View all users across tenants, reset passwords, suspend accounts
4. **Billing & Invoicing**: MRR tracking, upcoming renewals, invoice history
5. **Analytics & Monitoring**: Platform health, usage statistics, error tracking
6. **Support Tickets**: Centralized support ticket management
7. **Audit Logging**: Complete trail of all admin actions

**Key Benefit**: WellPulse staff never need to log into Azure Portal, SSH into servers, or manually run database commands. Everything is automated through the admin portal.

---

**Related Documentation**:
- [Azure Production Architecture](../deployment/azure-production-architecture.md)
- [Database-Per-Tenant Multi-Tenancy Pattern](../patterns/69-Database-Per-Tenant-Multi-Tenancy-Pattern.md)
