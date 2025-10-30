# Sprint 4: MVP Implementation Summary

**Status**: In Progress
**Target**: Production-ready MVP with Azure integrations
**Timeline**: 2-3 weeks (focused execution)
**Last Updated**: October 29, 2025

---

## Executive Summary

This document outlines the focused MVP implementation for Sprint 4, prioritizing **critical features for production launch** with Azure integration. We're building the minimum viable enterprise feature set while maintaining code quality and scalability.

**Key Decision**: Focus on **Phase 1 (Nominal Ranges & Alerts)** + **Azure Entra ID** + **Basic Dashboard** as MVP. Advanced reporting, custom RBAC, and analytics can be phased post-launch.

---

## MVP Scope (What We're Building)

### ✅ Phase 1: Nominal Ranges & Alert System (CRITICAL)

**Business Value**: Differentiates WellPulse from spreadsheets. Proactive anomaly detection reduces downtime and prevents equipment failure.

**Technical Components**:

#### 1.1 Database Schema
**Master DB** (applies globally):
- `nominal_range_templates` - Default ranges for all tenants
- Seeded with industry-standard Permian Basin values

**Tenant DB** (per-organization):
- `org_nominal_ranges` - Organization-level overrides
- `well_nominal_ranges` - Well-specific custom ranges
- `alert_preferences` - User/org notification settings
- `alerts` - Alert history and audit trail

#### 1.2 Domain Layer (DDD)
```typescript
// NominalRange entity with validation logic
class NominalRange {
  validate(value: number): { isValid: boolean; violation?: NominalRangeViolation }
}

// Alert entity for tracking violations
class Alert {
  severity: 'info' | 'warning' | 'critical';
  acknowledge(userId: string): void;
}
```

#### 1.3 Application Layer (CQRS)
**Commands**:
- `UpdateOrgNominalRangesCommand` - Managers set org-wide ranges
- `SetWellNominalRangeCommand` - Override for specific well
- `UpdateAlertPreferencesCommand` - Configure notification channels
- `AcknowledgeAlertCommand` - Mark alert as reviewed

**Queries**:
- `GetEffectiveNominalRangesQuery` - Returns well-specific > org > default cascade
- `GetAlertHistoryQuery` - Paginated alert feed with filters
- `GetAlertPreferencesQuery` - User's notification settings

**Services**:
- `FieldEntryValidationService` - Validates field data against ranges
- `AlertNotificationService` - Sends email/SMS notifications

#### 1.4 Presentation Layer (API)
```typescript
// REST endpoints
GET    /api/nominal-ranges/org              # Get org-level ranges
PUT    /api/nominal-ranges/org              # Update org-level ranges
GET    /api/nominal-ranges/well/:wellId     # Get well-specific ranges
PUT    /api/nominal-ranges/well/:wellId/:fieldName  # Override well range
DELETE /api/nominal-ranges/well/:wellId/:fieldName  # Reset to org default

GET    /api/alerts/preferences               # Get user's alert preferences
PUT    /api/alerts/preferences               # Update alert preferences
GET    /api/alerts/history                   # Get alert history (paginated)
POST   /api/alerts/:alertId/acknowledge      # Acknowledge alert
```

#### 1.5 Mobile Integration
- **Visual Indicators**: Red background for critical, amber for warning
- **Real-time Validation**: Call API on field blur to check value
- **Offline Support**: Cache nominal ranges locally, validate on sync
- **User Feedback**: Toast notification if out-of-range value detected

#### 1.6 Web Portal (Settings UI)
- **Nominal Range Settings Page**: Table editor for org-wide ranges
- **Well-Specific Overrides**: Per-well range customization with reason field
- **Alert Preferences**: Toggle email/SMS per user
- **Alert History**: Filterable table with acknowledge action

#### 1.7 Notification System
- **Email**: Nodemailer → Azure Communication Services (future)
- **SMS**: Twilio (initial) → Azure Communication Services (future)
- **Push**: Firebase Cloud Messaging (future)
- **Channels**: Configurable per user (email, SMS, push)

---

### ✅ Phase 2: Azure Entra ID Integration (ENTERPRISE)

**Business Value**: Enterprise customers require SSO. Reduces onboarding friction and improves security posture.

**Technical Components**:

#### 2.1 Azure AD Multi-Tenant Application
```bash
# App registration settings
- Sign-in audience: AzureADMultipleOrgs
- Redirect URIs: https://*.wellpulse.io/auth/callback
- App Roles: wellpulse.admin, wellpulse.manager, wellpulse.consultant, wellpulse.operator
```

#### 2.2 Backend Integration
```typescript
// Passport strategy for Azure AD
@Injectable()
export class AzureADStrategy extends PassportStrategy(BearerStrategy, 'azure-ad') {
  async validate(payload: any) {
    // 1. Validate tenant against whitelist
    // 2. Extract Azure AD roles
    // 3. Map to WellPulse roles
    // 4. Find or create user
    // 5. Generate JWT token
  }
}
```

#### 2.3 Database Schema Updates
```sql
-- Master DB
ALTER TABLE tenants ADD COLUMN azure_tenant_id VARCHAR UNIQUE;
ALTER TABLE tenants ADD COLUMN sso_enabled BOOLEAN DEFAULT FALSE;

-- Tenant DB
ALTER TABLE users ADD COLUMN azure_object_id VARCHAR UNIQUE;
ALTER TABLE users ADD COLUMN sso_provider VARCHAR; -- 'azure-ad', 'credentials'
```

#### 2.4 Admin Consent Flow
```
1. Org admin provides Azure AD Tenant ID
2. WellPulse registers tenant in database
3. Admin grants consent:
   https://login.microsoftonline.com/{tenant_id}/adminconsent
4. Users can now sign in via Azure AD
5. Roles sync from Azure AD App Roles
```

#### 2.5 Role Mapping
```typescript
const AZURE_ROLE_MAP = {
  'wellpulse.admin': 'admin',
  'wellpulse.manager': 'manager',
  'wellpulse.consultant': 'consultant',
  'wellpulse.operator': 'operator',
};
```

---

### ✅ Phase 3: Basic Dashboard (MVP KPIs)

**Business Value**: First thing operators see. Must prove value immediately.

**Technical Components**:

#### 3.1 Dashboard KPIs (Read-Only for MVP)
```typescript
interface DashboardKPIs {
  totalProduction: {
    boepd: number;           // Barrels of Oil Equivalent Per Day
    change: number;          // % change vs. previous period
    trend: 'up' | 'down' | 'stable';
  };
  activeWells: {
    count: number;           // Wells with status = 'operating'
    total: number;           // Total wells in org
    uptime: number;          // % uptime
  };
  alerts: {
    unacknowledged: number;  // Count of unacknowledged alerts
    critical: number;        // Count of critical alerts
    warning: number;         // Count of warning alerts
  };
  waterCut: {
    average: number;         // Avg water cut % across all wells
    trend: 'increasing' | 'decreasing' | 'stable';
  };
}
```

#### 3.2 Production Trend Chart
```typescript
// Line chart showing oil, gas, water production over 30 days
interface ProductionTrend {
  date: string;
  oil: number;    // bbl
  gas: number;    // mcf
  water: number;  // bbl
}
```

#### 3.3 Alert Feed
```typescript
// Real-time alert list (top 10 most recent)
interface AlertFeed {
  id: string;
  wellName: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  createdAt: Date;
  acknowledged: boolean;
}
```

#### 3.4 Backend Aggregation
```typescript
// Query handler calculates from field_entries
export class GetDashboardKPIsQueryHandler {
  async execute(query: GetDashboardKPIsQuery): Promise<DashboardKPIs> {
    // 1. Get field entries for last 24 hours
    // 2. Aggregate production volumes
    // 3. Calculate BOEPD (oil + (gas / 6))
    // 4. Count active wells
    // 5. Query alert counts
    // 6. Calculate water cut average
  }
}
```

---

### ✅ Phase 4: Production Infrastructure (CRITICAL)

**Business Value**: Can't launch without health checks, monitoring, and error tracking.

**Technical Components**:

#### 4.1 Health Check Endpoint
```typescript
@Controller('api/health')
export class HealthController {
  @Get()
  async check() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      version: process.env.APP_VERSION,
    };
  }
}
```

#### 4.2 Application Insights Integration
```typescript
// Winston → Azure Application Insights
import { ApplicationInsights } from '@azure/monitor-opentelemetry';

ApplicationInsights.setup()
  .setAutoCollectRequests(true)
  .setAutoCollectPerformance(true)
  .setAutoCollectExceptions(true)
  .setAutoCollectDependencies(true);
```

#### 4.3 Structured Logging
```typescript
// Winston logger with context
logger.info('Field entry created', {
  tenantId,
  wellId,
  userId,
  entryId,
  productionVolume,
  timestamp: new Date(),
});
```

#### 4.4 Error Tracking
```typescript
// Centralized error handler
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // 1. Log to Application Insights
    // 2. Send user-friendly error response
    // 3. Trigger alert if critical
  }
}
```

#### 4.5 Performance Monitoring
```typescript
// Custom metrics
trackMetric('api.response_time', duration, { endpoint, method });
trackMetric('database.query_time', queryDuration, { table, operation });
trackEvent('field_entry.created', { tenantId, wellId });
```

---

## MVP Exclusions (Post-Launch Features)

These are valuable but not blocking for MVP launch:

### ❌ Advanced Reporting Suite (20+ reports)
- **Why**: Can start with 3-5 core reports via manual export
- **When**: Sprint 5
- **Workaround**: Excel export from dashboard

### ❌ Custom Role Creation
- **Why**: Fixed roles (admin, manager, consultant, operator) sufficient for initial customers
- **When**: Sprint 5 (based on customer demand)
- **Workaround**: Use built-in roles

### ❌ Automated Report Scheduling
- **Why**: Users can manually generate reports on demand
- **When**: Sprint 6
- **Workaround**: Manual download from Reports page

### ❌ Predictive Analytics & ML
- **Why**: Requires 90+ days of production data for training
- **When**: Sprint 7 (after data collection)
- **Workaround**: Nominal range alerts provide basic anomaly detection

### ❌ SCADA Integration
- **Why**: Requires custom connectors per SCADA vendor
- **When**: Sprint 8+ (enterprise tier feature)
- **Workaround**: Manual field data entry

---

## Database Migration Strategy

### Master DB Migrations
```sql
-- 0002_nominal_range_templates.sql
CREATE TABLE nominal_range_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name VARCHAR(100) NOT NULL,
  well_type VARCHAR(50),  -- NULL = all types
  min_value DECIMAL(10,2),
  max_value DECIMAL(10,2),
  unit VARCHAR(20) NOT NULL,
  severity VARCHAR(20) DEFAULT 'warning',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed default ranges
INSERT INTO nominal_range_templates (field_name, well_type, min_value, max_value, unit, severity) VALUES
  ('productionVolume', NULL, 1, 500, 'bbl/day', 'warning'),
  ('gasVolume', NULL, 10, 5000, 'mcf/day', 'warning'),
  ('waterCut', NULL, 0, 50, '%', 'warning'),
  ('waterCut', NULL, 50, 100, '%', 'critical'),
  ('bsw', NULL, 0, 1, '%', 'info'),
  ('bsw', NULL, 1, 8, '%', 'warning'),
  ('bsw', NULL, 8, 100, '%', 'critical'),
  ('pressure', NULL, 50, 3000, 'psi', 'warning'),
  ('temperature', NULL, 60, 250, '°F', 'warning'),
  ('casingPressure', NULL, 0, 50, 'psi', 'warning'),
  ('casingPressure', NULL, 50, 9999, 'psi', 'critical'),
  ('gor', NULL, 500, 6000, 'cf/bbl', 'info'),
  ('gor', NULL, 6000, 50000, 'cf/bbl', 'warning'),
  ('pumpRuntime', 'beam-pump', 20, 24, 'hours', 'warning'),
  ('strokesPerMinute', 'beam-pump', 8, 20, 'spm', 'warning'),
  ('motorAmps', 'pcp', 20, 100, 'amps', 'warning'),
  ('motorAmps', 'submersible', 20, 150, 'amps', 'warning'),
  ('motorTemp', 'pcp', 100, 250, '°F', 'warning'),
  ('motorTemp', 'submersible', 100, 250, '°F', 'warning'),
  ('gasInjectionVolume', 'gas-lift', 50, 500, 'mcf', 'warning');
```

### Tenant DB Migrations
```sql
-- 0001_nominal_ranges_and_alerts.sql
CREATE TABLE org_nominal_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  well_type VARCHAR(50),
  min_value DECIMAL(10,2),
  max_value DECIMAL(10,2),
  unit VARCHAR(20) NOT NULL,
  severity VARCHAR(20) DEFAULT 'warning',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE well_nominal_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  well_id UUID NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
  field_name VARCHAR(100) NOT NULL,
  min_value DECIMAL(10,2),
  max_value DECIMAL(10,2),
  unit VARCHAR(20) NOT NULL,
  severity VARCHAR(20) DEFAULT 'warning',
  reason TEXT,  -- Why this well has custom ranges
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID REFERENCES users(id),  -- NULL = org-wide default
  alert_type VARCHAR(50) NOT NULL,  -- 'nominal_range_violation', 'well_down', etc.
  enabled BOOLEAN DEFAULT TRUE,
  channels JSONB DEFAULT '{"email": true, "sms": false, "push": false}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  well_id UUID REFERENCES wells(id),
  field_entry_id UUID REFERENCES field_entries(id),
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  field_name VARCHAR(100),
  actual_value DECIMAL(10,2),
  expected_min DECIMAL(10,2),
  expected_max DECIMAL(10,2),
  message TEXT NOT NULL,
  acknowledged_at TIMESTAMP,
  acknowledged_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_org_nominal_ranges_tenant ON org_nominal_ranges(tenant_id);
CREATE INDEX idx_well_nominal_ranges_well ON well_nominal_ranges(well_id);
CREATE INDEX idx_alert_preferences_user ON alert_preferences(user_id);
CREATE INDEX idx_alerts_tenant ON alerts(tenant_id);
CREATE INDEX idx_alerts_well ON alerts(well_id);
CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX idx_alerts_acknowledged ON alerts(acknowledged_at) WHERE acknowledged_at IS NULL;
```

---

## Implementation Checklist

### Phase 1: Nominal Ranges & Alerts (Week 1)
- [x] Quick Wins complete (keyboard nav + test data button)
- [ ] Database migrations (master + tenant)
- [ ] Seed data for default nominal ranges
- [ ] Domain entities (NominalRange, Alert)
- [ ] Value objects (NominalRangeViolation)
- [ ] Repository interfaces
- [ ] Drizzle schemas
- [ ] Repository implementations
- [ ] CQRS commands (create, update, delete ranges)
- [ ] CQRS queries (get ranges, get alerts)
- [ ] Validation service (check field values)
- [ ] Alert notification service (email/SMS)
- [ ] API controllers (nominal ranges + alerts)
- [ ] DTOs and validation
- [ ] Mobile: Visual indicators
- [ ] Mobile: Real-time validation
- [ ] Web: Nominal range settings page
- [ ] Web: Alert preferences page
- [ ] Web: Alert history page
- [ ] Unit tests (≥80% coverage)
- [ ] E2E tests (critical paths)

### Phase 2: Azure Entra ID (Week 2)
- [ ] Azure AD app registration
- [ ] App roles configuration
- [ ] Passport Azure AD strategy
- [ ] Database schema updates (azure_tenant_id, azure_object_id)
- [ ] Tenant onboarding flow
- [ ] Admin consent redirect
- [ ] Role mapping logic
- [ ] JWT generation with Azure claims
- [ ] Web: SSO login UI
- [ ] Admin: Tenant SSO configuration page
- [ ] Documentation: Azure setup guide
- [ ] E2E tests (SSO flow)

### Phase 3: Basic Dashboard (Week 2)
- [ ] Dashboard KPI query handler
- [ ] Production aggregation logic
- [ ] BOEPD calculation
- [ ] Alert count queries
- [ ] Web: Dashboard page
- [ ] Web: KPI cards
- [ ] Web: Production trend chart (Recharts)
- [ ] Web: Alert feed component
- [ ] Caching strategy (React Query)
- [ ] Auto-refresh (30-second polling)

### Phase 4: Production Infrastructure (Week 3)
- [ ] Health check endpoint
- [ ] Application Insights setup
- [ ] Structured logging (Winston)
- [ ] Error tracking middleware
- [ ] Performance metrics
- [ ] API documentation (Swagger)
- [ ] Deployment scripts (Azure Container Apps)
- [ ] Environment configuration (prod vs staging)
- [ ] Secrets management (Azure Key Vault)
- [ ] Database backup verification
- [ ] Load testing (Artillery)
- [ ] Security audit

---

## Success Metrics

### Nominal Ranges & Alerts
- ✅ Zero false negatives (all out-of-range values flagged)
- ✅ <5% false positives
- ✅ <1 minute alert delivery time
- ✅ 100% of configured users receive alerts

### Azure Entra ID
- ✅ SSO login completes in <3 seconds
- ✅ 100% role sync accuracy
- ✅ Support 100+ concurrent SSO authentications

### Dashboard
- ✅ Dashboard loads in <2 seconds
- ✅ All KPIs accurate within 0.1%
- ✅ Real-time updates every 30 seconds

### Production Readiness
- ✅ 99.9% uptime (Azure SLA)
- ✅ <100ms P50 API response time
- ✅ <500ms P95 API response time
- ✅ ≥80% test coverage
- ✅ Zero critical security vulnerabilities

---

## Next Steps After MVP Launch

**Sprint 5: Advanced Features**
- Advanced reporting suite (10+ report types)
- Automated report scheduling
- Export configuration (import/export settings)

**Sprint 6: Analytics & Intelligence**
- Decline curve analysis
- Predictive maintenance (ML)
- Production forecasting
- Well health scoring

**Sprint 7: Enterprise Tier**
- Custom role creation
- SCADA integration
- Land management
- Regulatory compliance automation

---

## Questions & Decisions

### Resolved
- ✅ **SMS Provider**: Twilio (initial), migrate to Azure Communication Services later
- ✅ **Alert Channels**: Email + SMS (push notifications post-launch)
- ✅ **Dashboard Refresh**: 30-second polling (WebSockets post-launch)
- ✅ **Role Strategy**: Fixed roles for MVP, custom roles in Sprint 5

### Open
- ⏸️ **Commodity Pricing**: Manual entry or API integration? (Deferred to Sprint 5)
- ⏸️ **Report Branding**: White-label templates? (Deferred to enterprise tier)
- ⏸️ **Data Retention**: 2 years default, configurable per tenant? (Need decision)
- ⏸️ **Offline Nominal Ranges**: Cache locally or require online validation? (Need decision)

---

**Status**: Ready to begin implementation
**Estimated Completion**: 2-3 weeks
**Risk Level**: Medium (tight timeline, but clear scope)
