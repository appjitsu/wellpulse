# Monitoring & Observability Guide

**Version**: 1.0
**Last Updated**: October 23, 2025
**Status**: Production-Ready

---

## Overview

This document defines comprehensive monitoring, logging, alerting, and observability strategies for WellPulse across all environments (local, staging, production). It covers Azure Application Insights, custom metrics, distributed tracing, and incident response.

### Observability Pillars

```
┌─────────────────────────────────────────────────────────┐
│            Three Pillars of Observability               │
├─────────────────────────────────────────────────────────┤
│  1. Metrics    - What is happening (numbers, trends)    │
│  2. Logs       - Why it happened (events, context)      │
│  3. Traces     - How it happened (request flow)         │
└─────────────────────────────────────────────────────────┘
```

---

## Architecture: Monitoring Stack

### Production (Azure)

```yaml
Application Insights:
  - API request/response metrics
  - Database query performance
  - Exception tracking
  - Custom business metrics

Log Analytics Workspace:
  - Centralized logging
  - Log queries (KQL)
  - Long-term retention (90 days)

Azure Monitor:
  - Alert rules
  - Action groups (email, SMS, PagerDuty)
  - Dashboards

Container App Logs:
  - Console logs (stdout/stderr)
  - Container health metrics
  - Replica scaling events
```

### Staging (Railway)

```yaml
Railway Logs:
  - Real-time console logs
  - Log filtering and search
  - Basic metrics (CPU, memory, network)

External Tools (Optional):
  - Sentry (error tracking)
  - Datadog (APM - if budget allows)
```

### Local Development

```yaml
Console Logs:
  - NestJS built-in logger
  - Next.js console output

Development Tools:
  - Drizzle Studio (database inspection)
  - Redis CLI (cache inspection)
  - Mailpit (email preview)
```

---

## Application Insights Integration

### NestJS API Setup

**Install Dependencies**:

```bash
pnpm add --filter=api applicationinsights
```

**Bootstrap Configuration** (`apps/api/src/main.ts`):

```typescript
import * as appInsights from 'applicationinsights';

async function bootstrap() {
  // Initialize Application Insights FIRST (before NestJS app)
  if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
    appInsights
      .setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
      .setAutoDependencyCorrelation(true)
      .setAutoCollectRequests(true)
      .setAutoCollectPerformance(true, true)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectConsole(true, true)
      .setUseDiskRetriesForTelemetry(false)
      .setSendLiveMetrics(true)
      .start();

    console.log('✅ Application Insights enabled');
  }

  const app = await NestFactory.create(AppModule);

  // ... rest of bootstrap
}
```

**Environment Variables**:

```bash
# Production (from Azure Key Vault)
APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=...;IngestionEndpoint=https://...

# Local/Staging (disable or use separate instance)
APPLICATIONINSIGHTS_CONNECTION_STRING=  # Empty = disabled
```

### Next.js Web/Admin Setup

**Install Dependencies**:

```bash
pnpm add --filter=web @microsoft/applicationinsights-web
```

**Client-Side Tracking** (`apps/web/app/layout.tsx`):

```typescript
'use client';

import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { useEffect } from 'react';

let appInsights: ApplicationInsights | null = null;

export function AppInsightsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_APPINSIGHTS_KEY) {
      appInsights = new ApplicationInsights({
        config: {
          instrumentationKey: process.env.NEXT_PUBLIC_APPINSIGHTS_KEY,
          enableAutoRouteTracking: true, // Track page views
          disableFetchTracking: false,   // Track API calls
          enableCorsCorrelation: true,   // Correlate with backend
          enableRequestHeaderTracking: true,
          enableResponseHeaderTracking: true,
        },
      });

      appInsights.loadAppInsights();
      appInsights.trackPageView(); // Initial page view
    }
  }, []);

  return <>{children}</>;
}
```

**Track Custom Events**:

```typescript
// Track button clicks
import { appInsights } from '@/lib/app-insights';

function WellCard({ well }: { well: Well }) {
  const handleViewWell = () => {
    appInsights?.trackEvent({
      name: 'well_viewed',
      properties: {
        wellId: well.id,
        wellName: well.name,
        source: 'dashboard',
      },
    });

    router.push(`/wells/${well.id}`);
  };

  return <button onClick={handleViewWell}>View Well</button>;
}
```

---

## Custom Metrics

### Backend Metrics (NestJS)

**Create Metrics Service**:

```typescript
// apps/api/src/infrastructure/monitoring/metrics.service.ts
import { Injectable } from '@nestjs/common';
import * as appInsights from 'applicationinsights';

@Injectable()
export class MetricsService {
  private client = appInsights.defaultClient;

  // Track API endpoint performance
  trackRequest(name: string, duration: number, success: boolean) {
    this.client?.trackRequest({
      name,
      duration,
      success,
      resultCode: success ? 200 : 500,
    });
  }

  // Track database query performance
  trackDatabaseQuery(query: string, duration: number, rowCount: number) {
    this.client?.trackDependency({
      dependencyTypeName: 'PostgreSQL',
      name: query,
      data: query,
      duration,
      success: true,
      resultCode: 200,
    });

    this.client?.trackMetric({
      name: 'database.query.rows_returned',
      value: rowCount,
    });
  }

  // Track business metrics
  trackProductionEntry(tenantId: string, wellId: string, oilVolume: number) {
    this.client?.trackEvent({
      name: 'production_entry_created',
      properties: { tenantId, wellId },
      measurements: { oilVolume },
    });

    this.client?.trackMetric({
      name: 'production.oil_volume',
      value: oilVolume,
    });
  }

  // Track offline sync
  trackOfflineSync(deviceType: 'ELECTRON' | 'MOBILE', eventCount: number, success: boolean) {
    this.client?.trackEvent({
      name: 'offline_sync_completed',
      properties: { deviceType, success: success.toString() },
      measurements: { eventCount },
    });
  }

  // Track ML predictions
  trackMLPrediction(modelName: string, latency: number, confidence: number) {
    this.client?.trackDependency({
      dependencyTypeName: 'ML Service',
      name: modelName,
      duration: latency,
      success: true,
    });

    this.client?.trackMetric({
      name: `ml.${modelName}.confidence`,
      value: confidence,
    });
  }
}
```

**Use in CQRS Handlers**:

```typescript
// apps/api/src/application/production/commands/create-production/create-production.handler.ts
import { MetricsService } from '@/infrastructure/monitoring/metrics.service';

@CommandHandler(CreateProductionCommand)
export class CreateProductionHandler {
  constructor(
    private readonly repository: IProductionRepository,
    private readonly metrics: MetricsService,
  ) {}

  async execute(command: CreateProductionCommand): Promise<void> {
    const startTime = Date.now();

    try {
      const productionData = ProductionData.create({
        wellId: command.wellId,
        productionDate: command.productionDate,
        oilVolume: command.oilVolume,
        // ...
      });

      await this.repository.save(command.tenantId, productionData);

      // Track business metric
      this.metrics.trackProductionEntry(command.tenantId, command.wellId, command.oilVolume);

      // Track request duration
      const duration = Date.now() - startTime;
      this.metrics.trackRequest('CreateProductionCommand', duration, true);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.trackRequest('CreateProductionCommand', duration, false);
      throw error;
    }
  }
}
```

### Frontend Metrics (Next.js)

**Track Page Performance**:

```typescript
// apps/web/hooks/usePagePerformance.ts
import { useEffect } from 'react';
import { appInsights } from '@/lib/app-insights';

export function usePagePerformance(pageName: string) {
  useEffect(() => {
    // Track page load time
    if (typeof window !== 'undefined' && window.performance) {
      const perfData = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      appInsights?.trackMetric({
        name: `page.${pageName}.load_time`,
        value: perfData.loadEventEnd - perfData.fetchStart,
      });

      appInsights?.trackMetric({
        name: `page.${pageName}.dom_interactive`,
        value: perfData.domInteractive - perfData.fetchStart,
      });
    }
  }, [pageName]);
}

// Usage in page component
export default function WellsPage() {
  usePagePerformance('wells_list');

  return <div>Wells List</div>;
}
```

**Track User Interactions**:

```typescript
// Track map interactions
const MapComponent = () => {
  const handleMarkerClick = (wellId: string) => {
    appInsights?.trackEvent({
      name: 'map_marker_clicked',
      properties: { wellId },
    });
  };

  const handleMapZoom = (zoomLevel: number) => {
    appInsights?.trackMetric({
      name: 'map.zoom_level',
      value: zoomLevel,
    });
  };

  return <Map onMarkerClick={handleMarkerClick} onZoomChange={handleMapZoom} />;
};
```

---

## Distributed Tracing

### Request Correlation

Application Insights automatically correlates requests across services using `traceparent` headers.

**Flow Example**:

```
1. User clicks "View Well" in Next.js Web
   → trackEvent('well_viewed', { wellId: '123' })
   → Correlation ID: abc-def-ghi

2. Next.js makes API request
   → GET /wells/123
   → Header: traceparent: 00-abc-def-ghi-01-01

3. NestJS API receives request
   → Application Insights links to same correlation ID
   → trackDependency('PostgreSQL', 'SELECT * FROM wells')

4. Database query executes
   → Query logged with same correlation ID

5. Response sent back to Next.js
   → Total trace: User click → API → Database → Response
```

**Viewing Traces in Azure Portal**:

```
Application Insights → Transaction search → Filter by Operation ID
→ See full end-to-end trace with timing breakdown
```

### Custom Correlation

For background jobs or async operations:

```typescript
// apps/api/src/infrastructure/jobs/field-data-sync.processor.ts
import * as appInsights from 'applicationinsights';

@Processor('field-data-sync')
export class FieldDataSyncProcessor {
  @Process()
  async handleSync(job: Job<SyncJobData>) {
    // Create operation ID for tracing
    const operationId = appInsights.defaultClient?.context.keys.operationId;

    appInsights.defaultClient?.trackEvent({
      name: 'sync_job_started',
      properties: {
        jobId: job.id.toString(),
        deviceType: job.data.deviceType,
        eventCount: job.data.events.length,
      },
    });

    try {
      // Process sync...

      appInsights.defaultClient?.trackEvent({
        name: 'sync_job_completed',
        properties: { jobId: job.id.toString() },
      });
    } catch (error) {
      appInsights.defaultClient?.trackException({
        exception: error as Error,
        properties: { jobId: job.id.toString() },
      });
      throw error;
    }
  }
}
```

---

## Logging Strategy

### Log Levels

| Level       | When to Use                       | Retention           |
| ----------- | --------------------------------- | ------------------- |
| **ERROR**   | Exceptions, failures              | 90 days             |
| **WARN**    | Recoverable issues, deprecations  | 30 days             |
| **INFO**    | Business events, state changes    | 30 days             |
| **DEBUG**   | Detailed flow for troubleshooting | 7 days (local only) |
| **VERBOSE** | Low-level details                 | Local only          |

### Structured Logging (NestJS)

**Custom Logger** (`apps/api/src/infrastructure/logging/app-logger.service.ts`):

```typescript
import { Injectable, LoggerService } from '@nestjs/common';
import * as appInsights from 'applicationinsights';

@Injectable()
export class AppLogger implements LoggerService {
  log(message: string, context?: string, metadata?: Record<string, any>) {
    console.log(`[INFO] [${context}] ${message}`, metadata || '');

    appInsights.defaultClient?.trackTrace({
      message,
      severity: 1, // Information
      properties: { context, ...metadata },
    });
  }

  error(message: string, trace?: string, context?: string, metadata?: Record<string, any>) {
    console.error(`[ERROR] [${context}] ${message}`, trace, metadata || '');

    appInsights.defaultClient?.trackException({
      exception: new Error(message),
      properties: { context, trace, ...metadata },
    });
  }

  warn(message: string, context?: string, metadata?: Record<string, any>) {
    console.warn(`[WARN] [${context}] ${message}`, metadata || '');

    appInsights.defaultClient?.trackTrace({
      message,
      severity: 2, // Warning
      properties: { context, ...metadata },
    });
  }

  debug(message: string, context?: string, metadata?: Record<string, any>) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] [${context}] ${message}`, metadata || '');
    }
  }
}
```

**Usage in Services**:

```typescript
@Injectable()
export class WellRepository {
  constructor(private readonly logger: AppLogger) {}

  async save(tenantId: string, well: Well): Promise<void> {
    this.logger.log('Saving well', 'WellRepository', {
      tenantId,
      wellId: well.id,
      wellName: well.name,
    });

    try {
      await this.db.insert(wellsTable).values({
        id: well.id,
        name: well.name,
        // ...
      });

      this.logger.log('Well saved successfully', 'WellRepository', {
        wellId: well.id,
      });
    } catch (error) {
      this.logger.error('Failed to save well', (error as Error).stack, 'WellRepository', {
        tenantId,
        wellId: well.id,
      });
      throw error;
    }
  }
}
```

### Log Queries (Azure KQL)

**Find all errors in last 24 hours**:

```kusto
traces
| where timestamp > ago(24h)
| where severityLevel >= 3  // Error or Critical
| project timestamp, message, severityLevel, customDimensions
| order by timestamp desc
```

**Find slow database queries**:

```kusto
dependencies
| where timestamp > ago(1h)
| where type == "PostgreSQL"
| where duration > 1000  // > 1 second
| project timestamp, name, duration, success
| order by duration desc
```

**Track production entries per tenant**:

```kusto
customEvents
| where timestamp > ago(7d)
| where name == "production_entry_created"
| summarize count() by tostring(customDimensions.tenantId)
| order by count_ desc
```

**Find sync failures**:

```kusto
customEvents
| where timestamp > ago(24h)
| where name == "offline_sync_completed"
| where tostring(customDimensions.success) == "false"
| project timestamp, customDimensions.deviceType, customDimensions.tenantId
```

---

## Alerting Rules

### Critical Alerts (PagerDuty + SMS)

**1. API Error Rate > 5%**

```kusto
// Alert rule
requests
| where timestamp > ago(5m)
| summarize
    totalRequests = count(),
    failedRequests = countif(success == false)
| extend errorRate = (failedRequests * 100.0) / totalRequests
| where errorRate > 5

// Action: PagerDuty incident + SMS to on-call engineer
```

**2. Database Connection Failures**

```kusto
dependencies
| where timestamp > ago(5m)
| where type == "PostgreSQL"
| where success == false
| summarize count() by target
| where count_ > 3

// Action: PagerDuty + email to DevOps team
```

**3. Container App Crash Loop**

```yaml
# Azure Monitor Alert Rule
Metric: Container restart count
Condition: > 3 restarts in 5 minutes
Action: PagerDuty + SMS
```

### Warning Alerts (Email Only)

**1. High API Latency**

```kusto
requests
| where timestamp > ago(10m)
| summarize p95Latency = percentile(duration, 95)
| where p95Latency > 500  // > 500ms

// Action: Email to DevOps team
```

**2. Slow Database Queries**

```kusto
dependencies
| where timestamp > ago(10m)
| where type == "PostgreSQL"
| where duration > 1000  // > 1 second
| summarize count()
| where count_ > 10

// Action: Email to backend team
```

**3. Redis Memory > 90%**

```yaml
# Azure Monitor Alert Rule
Metric: Redis memory percentage
Condition: > 90%
Action: Email + auto-scale to higher tier
```

### Info Alerts (Slack Notification)

**1. New Tenant Onboarded**

```typescript
// Send to Slack webhook when tenant created
this.logger.log('New tenant onboarded', 'TenantService', {
  tenantId: tenant.id,
  tenantName: tenant.name,
  region: tenant.region,
});

// Webhook sends to #tenant-onboarding Slack channel
```

**2. Large Offline Sync Completed**

```typescript
if (syncedEventCount > 100) {
  this.logger.log('Large sync completed', 'SyncService', {
    tenantId,
    eventCount: syncedEventCount,
    deviceType,
  });

  // Slack notification: "ACME Oil synced 250 events from Electron app"
}
```

---

## Dashboards

### Azure Monitor Dashboard (Production)

**Dashboard 1: System Health**

```yaml
Widgets:
  - API Request Rate (requests/minute)
  - API Error Rate (%)
  - API Latency (p50, p95, p99)
  - Database Query Performance
  - Container App CPU/Memory Usage
  - Redis Cache Hit Rate
  - Blob Storage IOPS

Time Range: Last 24 hours (default), configurable to 7 days
Refresh: Every 1 minute
```

**Dashboard 2: Business Metrics**

```yaml
Widgets:
  - Total Tenants (count)
  - Active Users (last 24 hours)
  - Production Entries Created (per day)
  - Wells Added (per day)
  - Offline Syncs Completed (per day)
  - ML Predictions Run (per day)
  - Photo Uploads (count, total size)

Time Range: Last 30 days
Refresh: Every 5 minutes
```

**Dashboard 3: Tenant Activity**

```yaml
Widgets:
  - Top 10 Tenants by API Usage
  - Top 10 Tenants by Storage Usage
  - New Tenants This Month
  - Churn Rate (tenants deactivated)
  - Average Wells per Tenant

Time Range: Last 30 days
Refresh: Every 15 minutes
```

### Application Insights Live Metrics

**Real-Time Monitoring** (for incident response):

```yaml
Live Metrics Stream:
  - Incoming requests/second (real-time)
  - Failed requests/second
  - Dependency calls/second
  - Exception rate
  - CPU/Memory usage
  - Active server instances

Use Case: During deployments or incidents, watch Live Metrics for immediate feedback
```

---

## Performance Monitoring

### Key Metrics to Track

| Metric                                 | Target | Alert Threshold |
| -------------------------------------- | ------ | --------------- |
| **API Response Time (p95)**            | <200ms | >500ms          |
| **API Response Time (p99)**            | <500ms | >1000ms         |
| **Database Query Time (p95)**          | <50ms  | >200ms          |
| **Map Load Time**                      | <2s    | >5s             |
| **Production Chart Render**            | <1s    | >3s             |
| **Offline Sync Duration (100 events)** | <10s   | >30s            |
| **ML Prediction Latency**              | <500ms | >2s             |

### Synthetic Monitoring (Uptime Checks)

**Azure Monitor Availability Tests**:

```yaml
Test 1: API Health Check
  URL: https://api.wellpulse.io/health
  Frequency: Every 5 minutes
  Locations: 5 global regions (US East, US West, Europe, Asia, Australia)
  Alert: If >2 locations fail

Test 2: Web App Availability
  URL: https://wellpulse.io
  Frequency: Every 5 minutes
  Expected Response: 200 OK, contains "WellPulse"

Test 3: Multi-Step Test (User Flow)
  1. GET https://wellpulse.io/login
  2. POST https://api.wellpulse.io/auth/login (credentials)
  3. GET https://api.wellpulse.io/wells (with JWT)
  Expected: All steps return 200 OK within 5 seconds total
```

---

## Incident Response

### Severity Levels

| Severity          | Description                               | Response Time | Escalation          |
| ----------------- | ----------------------------------------- | ------------- | ------------------- |
| **P0 (Critical)** | Complete outage, all users affected       | <15 minutes   | Immediate PagerDuty |
| **P1 (High)**     | Major feature broken, many users affected | <1 hour       | Email + Slack       |
| **P2 (Medium)**   | Minor feature broken, few users affected  | <4 hours      | Email               |
| **P3 (Low)**      | Cosmetic issue, no functional impact      | <24 hours     | Ticket queue        |

### Incident Response Playbook

#### P0: API Completely Down

**Symptoms**:

- Azure Monitor: API error rate 100%
- Uptime checks: All failing
- User reports: Cannot access platform

**Immediate Actions**:

```bash
# 1. Check Container App status
az containerapp show --resource-group wellpulse-prod --name wellpulse-api

# 2. Check recent deployments
az containerapp revision list --resource-group wellpulse-prod --name wellpulse-api

# 3. Rollback to previous revision if needed
az containerapp revision set-mode --resource-group wellpulse-prod \
  --name wellpulse-api \
  --mode single \
  --revision wellpulse-api--{previous-revision}

# 4. Check Application Insights for exceptions
# Azure Portal → Application Insights → Failures → Exceptions

# 5. Check database connectivity
# Azure Portal → PostgreSQL → Monitoring → Metrics
```

**Root Cause Analysis (Post-Incident)**:

- Document timeline
- Identify root cause
- Create action items to prevent recurrence
- Update runbook

#### P1: Database Performance Degradation

**Symptoms**:

- API latency p95 > 1 second
- Database query time alerts firing
- User reports: Slow page loads

**Immediate Actions**:

```bash
# 1. Check database metrics
az postgres flexible-server show \
  --resource-group wellpulse-prod \
  --name wellpulse-master-db

# 2. Identify slow queries
# Application Insights → Dependencies → Sort by duration

# 3. Check for missing indexes
# Connect to database, run EXPLAIN ANALYZE on slow queries

# 4. Temporary fix: Add missing index
CREATE INDEX CONCURRENTLY idx_wells_tenant_id ON wells(tenant_id);

# 5. If database CPU > 90%, scale up
az postgres flexible-server update \
  --resource-group wellpulse-prod \
  --name wellpulse-master-db \
  --sku-name Standard_D2s_v3  # Scale to 2 vCPU
```

#### P2: Offline Sync Failures

**Symptoms**:

- Sync failure rate > 10%
- User reports: Data not syncing from Electron/Mobile

**Immediate Actions**:

```typescript
// 1. Check Application Insights for sync errors
customEvents
| where timestamp > ago(1h)
| where name == "offline_sync_completed"
| where tostring(customDimensions.success) == "false"
| project timestamp, customDimensions

// 2. Identify common error patterns
// - Network timeouts?
// - Validation errors?
// - Conflict resolution failures?

// 3. Check if specific to device type
customEvents
| where name == "offline_sync_completed"
| where tostring(customDimensions.success) == "false"
| summarize count() by tostring(customDimensions.deviceType)

// 4. If widespread, check API /sync/batch endpoint health
// 5. If device-specific, check client app versions
```

---

## Cost Monitoring

### Azure Cost Management

**Budget Alerts**:

```yaml
Budget: $500/month (production baseline)
Alerts:
  - 50% spent ($250): Email to finance team
  - 80% spent ($400): Email + Slack notification
  - 100% spent ($500): Email + freeze non-critical resources
  - 120% spent ($600): PagerDuty alert
```

**Cost Breakdown Dashboard**:

```yaml
Widgets:
  - Cost by Service (pie chart)
  - Cost Trend (last 30 days)
  - Top 5 Most Expensive Resources
  - Cost per Tenant (if tracking tenant-specific resources)

Example Insights:
  - 'VPN Gateway costs $150/month but only 2 tenants use it'
  - 'Blob Storage costs increased 30% this month (200 GB → 260 GB)'
```

### Cost Optimization Triggers

```yaml
Trigger 1: Redis memory consistently <50%
  Action: Downgrade from C1 (1 GB) to C0 (250 MB)
  Savings: $50/month

Trigger 2: ML Service runs <10 times/day
  Action: Keep at min 0 replicas (scale to zero)
  Savings: ~$30/month

Trigger 3: Blob Storage >90% in Hot tier
  Action: Move 90-day-old photos to Cool tier
  Savings: 59% on storage costs

Trigger 4: Database CPU consistently <30%
  Action: Downgrade from B2s to B1ms
  Savings: $25/month
```

---

## Success Metrics

### Sprint 4 (End of Phase 1)

- [ ] Application Insights tracking all API requests
- [ ] Custom metrics for well creation, production entries
- [ ] Alert rules configured (error rate, latency)
- [ ] Azure Monitor dashboard created
- [ ] Log Analytics queries for common troubleshooting

### Sprint 8 (End of Phase 2)

- [ ] Offline sync success/failure tracking
- [ ] Distributed tracing across API + Mobile/Electron
- [ ] Performance baselines established
- [ ] Incident response playbook documented
- [ ] Cost monitoring dashboard active

### Sprint 10 (End of Phase 3 - Production Launch)

- [ ] All P0/P1 alerts tested and validated
- [ ] 30-day log retention configured
- [ ] Synthetic uptime checks from 5 regions
- [ ] Business metrics dashboard for executives
- [ ] On-call rotation and escalation policy defined

---

## Best Practices

### 1. **Alert Fatigue Prevention**

```yaml
# Bad: Too many alerts
alerts:
  - API latency > 100ms → Email  # Fires constantly
  - Any 404 error → PagerDuty    # Not critical

# Good: Actionable alerts only
alerts:
  - API p95 latency > 500ms for 5 minutes → Email
  - API error rate > 5% for 5 minutes → PagerDuty
  - Critical endpoint (e.g., /auth/login) error rate > 1% → PagerDuty
```

### 2. **Log Sensitive Data Redaction**

```typescript
// Bad: Logging sensitive data
this.logger.log('User logged in', { email: 'user@example.com', password: 'secret123' });

// Good: Redact sensitive fields
this.logger.log('User logged in', { email: 'user@example.com', userId: 'user-123' });
// Password should NEVER be logged
```

### 3. **Correlation IDs Everywhere**

```typescript
// Add correlation ID to all logs
this.logger.log('Processing sync', 'SyncService', {
  correlationId: request.correlationId,
  tenantId: request.tenantId,
  eventCount: request.events.length,
});

// Later, trace entire flow:
// Application Insights → Search by correlationId → See all logs/traces
```

### 4. **Metrics Over Logs for Volume**

```typescript
// Bad: Log every single request (high volume)
this.logger.log('Request received', { url: request.url });

// Good: Track metric (aggregate)
this.metrics.trackRequest(request.url, duration, success);

// Logs are for events, metrics are for measurements
```

### 5. **Dashboard for Each Team**

```yaml
Executive Dashboard:
  - Total tenants
  - Monthly recurring revenue (MRR)
  - Active users
  - Churn rate

Operations Dashboard:
  - API uptime
  - Error rate
  - Database performance
  - Cost vs. budget

Product Dashboard:
  - Feature usage (map views, production entries, etc.)
  - User engagement (DAU, WAU)
  - Mobile app adoption rate
  - Offline sync success rate
```

---

## Related Documentation

- [Azure Production Architecture](./azure-production-architecture.md)
- [Testing Strategy](../testing-strategy.md)
- [Security Best Practices](../patterns/39-Security-Patterns-Guide.md)
- [Pattern 47: Monitoring & Observability](../patterns/47-Monitoring-Observability-Patterns.md)

---

**Document Owner**: DevOps Team
**Review Schedule**: Monthly
**Next Review**: End of Sprint 4
