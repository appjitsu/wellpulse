# Custom Metrics Dashboard Pattern

## Context

Many SaaS platforms use dedicated monitoring tools like Grafana, Datadog, or New Relic for visualizing application metrics. While powerful, these tools can be expensive, especially when running on cloud platforms like Azure where egress costs and service fees add up quickly.

**Problem**: Running Grafana on Azure Container Apps with persistent storage and public access can cost $50-150/month for small deployments, which is significant for a bootstrapped startup.

**Solution**: Build a custom metrics dashboard in the admin portal that reads directly from Prometheus metrics endpoint, providing real-time visibility without external tooling costs.

---

## Applicability

Use this pattern when:

- ✅ You need basic metrics visualization (gauges, counters, histograms)
- ✅ Real-time data (10-60 second refresh) is sufficient
- ✅ You want to minimize cloud infrastructure costs
- ✅ Your admin team is small (< 10 people)
- ✅ You already expose Prometheus metrics at `/metrics` endpoint
- ✅ Custom branding and integration with your admin portal is valuable

**Don't use this pattern when**:

- ❌ You need advanced visualizations (heatmaps, complex queries, PromQL)
- ❌ You require historical data retention beyond a few hours
- ❌ You need alerting and notification rules
- ❌ Multiple teams need different dashboard views with RBAC
- ❌ You're already paying for APM tools (might as well use their dashboards)

---

## Solution Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin Portal (Next.js)                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Metrics Dashboard Page (/metrics)                    │  │
│  │  - Auto-refresh every 10 seconds                      │  │
│  │  - Parses Prometheus text format                      │  │
│  │  - Displays cards with color-coded status             │  │
│  └───────────────────────┬───────────────────────────────┘  │
└────────────────────────────┼───────────────────────────────┘
                             │ HTTP GET /metrics
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  WellPulse API (NestJS)                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  PrometheusModule (@willsoto/nestjs-prometheus)       │  │
│  │  - Exposes /metrics endpoint                          │  │
│  │  - Default Node.js metrics (CPU, memory, GC)          │  │
│  │  - Custom gauges via ConnectionPoolMetricsService     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

1. **Prometheus Metrics Endpoint** (`/metrics`)
   - Exposes metrics in Prometheus text format
   - Automatically collects Node.js process metrics
   - Custom metrics updated every 10 seconds by background service

2. **Metrics Dashboard Page** (`apps/admin/app/(dashboard)/metrics/page.tsx`)
   - Client-side React component with `useEffect` polling
   - Parses Prometheus text format using regex
   - Displays data in shadcn/ui cards, badges, and tabs
   - Color-coded status indicators (healthy/warning/critical)

3. **Connection Pool Metrics Service** (`ConnectionPoolMetricsService`)
   - Background service that runs every 10 seconds
   - Collects pool metrics from all tenant connections
   - Updates Prometheus gauges

---

## Implementation

### Backend: Prometheus Metrics Endpoint

**File**: `apps/api/src/infrastructure/monitoring/monitoring.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { ConnectionPoolMetricsService } from './connection-pool-metrics.service';

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
        config: { prefix: 'wellpulse_' },
      },
      path: '/metrics',
      global: true,
    }),
  ],
  providers: [
    ConnectionPoolMetricsService,
    // Other custom metric providers...
  ],
  exports: [ConnectionPoolMetricsService, PrometheusModule],
})
export class MonitoringModule {}
```

**Exclude `/metrics` from tenant middleware**:

```typescript
// apps/api/src/app.module.ts
configure(consumer: MiddlewareConsumer) {
  consumer
    .apply(TenantResolverMiddleware)
    .exclude(
      { path: '/health', method: RequestMethod.ALL },
      { path: '/metrics', method: RequestMethod.ALL }, // NEW - No tenant context needed
      { path: '/tenants', method: RequestMethod.ALL },
    )
    .forRoutes('*');
}
```

### Custom Metrics Collection

**File**: `apps/api/src/infrastructure/monitoring/connection-pool-metrics.service.ts`

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Gauge, register } from 'prom-client';
import { TenantDatabaseService } from '../database/tenant-database.service';

@Injectable()
export class ConnectionPoolMetricsService implements OnModuleInit {
  private readonly logger = new Logger(ConnectionPoolMetricsService.name);
  private readonly poolSizeGauge: Gauge<string>;
  private readonly poolIdleGauge: Gauge<string>;
  private readonly poolWaitingGauge: Gauge<string>;

  constructor(private readonly tenantDatabaseService: TenantDatabaseService) {
    // Create gauges with prom-client's default registry
    this.poolSizeGauge = new Gauge({
      name: 'tenant_connection_pool_size',
      help: 'Total connections in pool (active + idle)',
      labelNames: ['tenant_id', 'database_name'],
      registers: [register], // Automatically exposed by PrometheusModule
    });

    this.poolIdleGauge = new Gauge({
      name: 'tenant_connection_pool_idle',
      help: 'Idle connections in pool',
      labelNames: ['tenant_id', 'database_name'],
      registers: [register],
    });

    this.poolWaitingGauge = new Gauge({
      name: 'tenant_connection_pool_waiting',
      help: 'Clients waiting for connection',
      labelNames: ['tenant_id', 'database_name'],
      registers: [register],
    });
  }

  onModuleInit(): void {
    this.collectMetrics();
    setInterval(() => void this.collectMetrics(), 10000); // Every 10 seconds
  }

  private collectMetrics(): void {
    const connections = this.tenantDatabaseService.getAllConnections();

    for (const [tenantId, connection] of connections) {
      const { pool } = connection;
      const databaseName = pool.options.database || `${tenantId}_wellpulse`;

      this.poolSizeGauge.set({ tenant_id: tenantId, database_name: databaseName }, pool.totalCount);

      this.poolIdleGauge.set({ tenant_id: tenantId, database_name: databaseName }, pool.idleCount);

      this.poolWaitingGauge.set(
        { tenant_id: tenantId, database_name: databaseName },
        pool.waitingCount,
      );
    }
  }
}
```

**Key Insight**: Use `prom-client`'s global `register` singleton instead of injecting `Registry` via dependency injection. The `@willsoto/nestjs-prometheus` package automatically exposes this registry at `/metrics`.

### Frontend: Custom Dashboard

**File**: `apps/admin/app/(dashboard)/metrics/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ParsedMetrics {
  connectionPools: Array<{
    tenantId: string;
    databaseName: string;
    totalConnections: number;
    idleConnections: number;
    waitingClients: number;
  }>;
  httpMetrics: { totalRequests: number; avgLatency: number };
  systemMetrics: { cpuUsage: number; memoryUsed: number; memoryTotal: number };
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<ParsedMetrics | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchMetrics = async () => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/metrics`,
    );
    const metricsText = await response.text();
    const parsed = parsePrometheusMetrics(metricsText);
    setMetrics(parsed);
  };

  useEffect(() => {
    fetchMetrics();
    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, 10000); // 10 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const parsePrometheusMetrics = (text: string): ParsedMetrics => {
    // Parse Prometheus text format using regex
    // Extract: tenant_connection_pool_size{tenant_id="...",database_name="..."} 10
    // ... (see full implementation in metrics page)
  };

  return (
    <div>
      <h1>System Metrics</h1>
      <Tabs defaultValue="pools">
        <TabsList>
          <TabsTrigger value="pools">Connection Pools</TabsTrigger>
          <TabsTrigger value="http">HTTP Metrics</TabsTrigger>
          <TabsTrigger value="system">System Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="pools">
          {metrics?.connectionPools.map((pool) => {
            const utilizationPercent = Math.round(
              ((pool.totalConnections - pool.idleConnections) / pool.totalConnections) * 100,
            );
            const status =
              pool.waitingClients > 0
                ? 'critical'
                : utilizationPercent > 80
                ? 'warning'
                : 'healthy';

            return (
              <Card key={`${pool.tenantId}:${pool.databaseName}`}>
                <CardHeader>
                  <CardTitle>{pool.tenantId}</CardTitle>
                  <Badge variant={status === 'critical' ? 'destructive' : 'default'}>
                    {status.toUpperCase()}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div>Total: {pool.totalConnections}</div>
                  <div>Active: {pool.totalConnections - pool.idleConnections}</div>
                  <div>Idle: {pool.idleConnections}</div>
                  {pool.waitingClients > 0 && <div>Waiting: {pool.waitingClients}</div>}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## Status Indicators and Alerts

### Color-Coded Status Logic

```typescript
const status =
  pool.waitingClients > 0
    ? 'critical' // Red badge - clients are being blocked
    : utilizationPercent > 80
      ? 'warning' // Yellow badge - high utilization
      : 'healthy'; // Green badge - normal operation
```

**Thresholds**:

- **Healthy** (Green): < 80% pool utilization, no waiting clients
- **Warning** (Yellow): ≥ 80% pool utilization, but no waiting clients yet
- **Critical** (Red): Any clients waiting for connections (pool exhausted)

---

## Cost Savings Analysis

### Traditional Grafana Setup on Azure

```
Azure Container Apps (Grafana):
- 1 vCPU, 2GB RAM: $30/month
- Azure PostgreSQL (metrics storage): $50/month
- Egress (data transfer): $10/month
- Backup/disaster recovery: $10/month
---------------------------------------------
Total: $100/month = $1,200/year
```

### Custom Dashboard in Admin Portal

```
Next.js Admin App (already running):
- No additional compute cost
- No additional storage cost
- No egress fees (metrics endpoint is internal)
- Development time: 4 hours (~$200 one-time)
---------------------------------------------
Total: $0/month ongoing, $200 one-time
```

**Break-even point**: 2 months

**5-year savings**: $6,000 - $200 = **$5,800**

---

## Trade-offs

### Advantages ✅

1. **Cost Savings**: Zero ongoing infrastructure costs
2. **Simplicity**: No external tool setup, login management, or configuration
3. **Integration**: Built into existing admin portal with same authentication
4. **Customization**: Full control over UI/UX, can add business-specific metrics
5. **Performance**: No external network calls, metrics endpoint is co-located

### Disadvantages ❌

1. **No Historical Data**: Only shows current state (Grafana can store weeks/months)
2. **Limited Visualizations**: Basic cards/tables vs. Grafana's rich chart library
3. **No Alerting**: Must manually check dashboard (Grafana has alerting rules)
4. **Manual Refresh**: Polling-based (Grafana has push subscriptions)
5. **Development Time**: Must build and maintain custom parsing/display logic

---

## When to Upgrade to Grafana

As your platform grows, consider switching to Grafana when:

1. **Team Size**: > 10 people need access to metrics with different permissions
2. **Data Retention**: Business needs historical trend analysis (> 1 week)
3. **Alerting**: Need automated alerts/notifications (PagerDuty, Slack, email)
4. **Complex Queries**: Need PromQL for aggregations, rate calculations, percentiles
5. **Multiple Data Sources**: Combining metrics from multiple systems (Postgres, Redis, external APIs)
6. **SLA Reporting**: Generating monthly uptime/performance reports for customers

---

## Evolution Path

### Phase 1: Custom Dashboard (Current) - Months 1-12

- Basic connection pool metrics
- HTTP request counts
- System resource usage
- Manual refresh every 10 seconds

### Phase 2: Enhanced Dashboard - Months 13-24

- Add time-series charts using recharts or chart.js
- Store last 24 hours in Redis with TTL
- Add CSV export for ad-hoc analysis
- Email alerts when pool utilization > 90%

### Phase 3: Grafana Migration - Year 2+

- Deploy Grafana when team > 10 people
- Migrate custom dashboards to Grafana JSON
- Keep custom dashboard for lightweight access
- Use Grafana for advanced analysis, custom dashboard for quick checks

---

## Related Patterns

- **[Database-Per-Tenant Multi-Tenancy Pattern](./69-Database-Per-Tenant-Multi-Tenancy-Pattern.md)** - Why connection pool metrics are critical for multi-tenant systems
- **[Health Check Pattern](./13-Health-Check-Pattern.md)** - Complementary monitoring for uptime
- **Observer Pattern** - Background metrics collection service

---

## Testing Strategy

### Unit Tests

```typescript
describe('parsePrometheusMetrics', () => {
  it('should parse connection pool metrics correctly', () => {
    const input = `
# HELP tenant_connection_pool_size Total connections
# TYPE tenant_connection_pool_size gauge
tenant_connection_pool_size{tenant_id="acme",database_name="acme_wellpulse"} 10
tenant_connection_pool_idle{tenant_id="acme",database_name="acme_wellpulse"} 3
tenant_connection_pool_waiting{tenant_id="acme",database_name="acme_wellpulse"} 0
    `;

    const result = parsePrometheusMetrics(input);

    expect(result.connectionPools).toEqual([
      {
        tenantId: 'acme',
        databaseName: 'acme_wellpulse',
        totalConnections: 10,
        idleConnections: 3,
        waitingClients: 0,
      },
    ]);
  });
});
```

### E2E Tests

```typescript
test('metrics dashboard displays connection pool data', async ({ page }) => {
  // Navigate to metrics page
  await page.goto('/metrics');

  // Wait for metrics to load
  await page.waitForSelector('[data-testid="connection-pool-card"]');

  // Verify pool metrics are displayed
  const poolCard = page.locator('[data-testid="connection-pool-card"]').first();
  await expect(poolCard).toContainText('Total Connections');
  await expect(poolCard).toContainText('Active');
  await expect(poolCard).toContainText('Idle');

  // Verify status badge is present
  await expect(poolCard.locator('[data-testid="status-badge"]')).toBeVisible();
});
```

---

## Key Insights

★ **Insight ─────────────────────────────────────**

1. **Cost-Driven Architecture**: Sometimes the best solution is the simplest one. Before adding external tools, evaluate if you can build a basic version in-house. The custom dashboard saved $1,200/year with 4 hours of development.

2. **Prometheus Text Format Parsing**: Prometheus metrics use a simple text format that's easy to parse with regex. No need for specialized client libraries or SDKs. Example:

   ```
   metric_name{label1="value1",label2="value2"} 42
   ```

3. **Global Registry Pattern**: When using `@willsoto/nestjs-prometheus`, don't inject `Registry` via DI. Instead, import `register` from `prom-client` and pass it directly to metric constructors:
   ```typescript
   import { Gauge, register } from 'prom-client';
   new Gauge({ name: 'my_metric', registers: [register] });
   ```
   This works because PrometheusModule automatically exposes the global registry at `/metrics`.

─────────────────────────────────────────────────

---

## References

- [Prometheus Exposition Formats](https://prometheus.io/docs/instrumenting/exposition_formats/)
- [prom-client (Node.js Prometheus Client)](https://github.com/siimon/prom-client)
- [@willsoto/nestjs-prometheus](https://github.com/willsoto/nestjs-prometheus)
- [PostgreSQL Connection Pooling Best Practices](https://node-postgres.com/features/pooling)
