# Application Insights Monitoring & Structured Logging

Comprehensive Azure Application Insights integration for production monitoring and Winston-based structured logging.

## Overview

The WellPulse API now includes:
- **Azure Application Insights**: Production telemetry (metrics, events, exceptions, dependencies)
- **Winston Logger**: Structured JSON logging with Application Insights transport
- **HTTP Metrics Interceptor**: Automatic tracking of all HTTP requests
- **Custom Metrics Service**: Business-specific KPIs (alerts, violations, sync operations)
- **Graceful Degradation**: Works locally without Application Insights configured

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      NestJS Application                      │
├─────────────────────────────────────────────────────────────┤
│  Winston Logger (structured logging)                        │
│    ├── Console Transport (local dev)                        │
│    └── Application Insights Transport (production)          │
├─────────────────────────────────────────────────────────────┤
│  HTTP Metrics Interceptor (automatic request tracking)      │
│    ├── Prometheus Metrics                                   │
│    └── Application Insights Metrics                         │
├─────────────────────────────────────────────────────────────┤
│  Application Insights Service                               │
│    ├── Custom Events (business events)                      │
│    ├── Custom Metrics (KPIs)                                │
│    ├── Exception Tracking (errors with context)             │
│    └── Dependency Tracking (DB, Redis, ML Service)          │
├─────────────────────────────────────────────────────────────┤
│  Metrics Service (business-specific metrics)                │
│    ├── Alert Tracking                                       │
│    ├── Sync Operations                                      │
│    ├── Auth Events                                          │
│    └── ML Predictions                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
                 Azure Application Insights
```

## Configuration

### Environment Variables

Add to `.env` or `.env.production`:

```bash
# Azure Application Insights
APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=xxx;IngestionEndpoint=https://xxx.applicationinsights.azure.com/

# Logging Level
LOG_LEVEL=info  # error, warn, info, debug

# Enable detailed logging (verbose)
ENABLE_DETAILED_LOGGING=false
```

Get your connection string from:
**Azure Portal → Application Insights → Properties → Connection String**

### TypeScript Configuration

Ensure `tsconfig.json` has:

```json
{
  "compilerOptions": {
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  }
}
```

## Usage Examples

### 1. Using Winston Logger in Services

```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MyService {
  private readonly logger = new Logger(MyService.name);

  async doSomething() {
    // Info log
    this.logger.log('Processing started', { userId: '123', tenantId: 'acme' });

    // Warning log
    this.logger.warn('Slow operation detected', { duration: 5000 });

    // Error log with stack trace
    try {
      // ... operation
    } catch (error) {
      this.logger.error('Operation failed', error.stack, {
        userId: '123',
        context: 'doSomething',
      });
    }

    // Debug log (only shown when LOG_LEVEL=debug)
    this.logger.debug('Debug info', { data: someData });
  }
}
```

### 2. Using Application Insights Service

```typescript
import { Injectable } from '@nestjs/common';
import { ApplicationInsightsService } from '../infrastructure/monitoring/application-insights.service';

@Injectable()
export class AlertService {
  constructor(
    private readonly appInsights: ApplicationInsightsService,
  ) {}

  async createAlert(tenantId: string, wellId: string, severity: string) {
    const startTime = Date.now();

    try {
      // ... create alert logic

      // Track custom event
      this.appInsights.trackEvent('AlertCreated', {
        tenantId,
        wellId,
        severity,
        timestamp: new Date().toISOString(),
      });

      // Track metric
      const duration = Date.now() - startTime;
      this.appInsights.trackMetric('AlertCreationDuration', duration, {
        tenantId,
        severity,
      });
    } catch (error) {
      // Track exception
      this.appInsights.trackException(error, {
        tenantId,
        wellId,
        operation: 'createAlert',
      });
      throw error;
    }
  }
}
```

### 3. Using Metrics Service (Business KPIs)

```typescript
import { Injectable } from '@nestjs/common';
import { MetricsService } from '../infrastructure/monitoring/metrics.service';

@Injectable()
export class FieldEntryService {
  constructor(private readonly metrics: MetricsService) {}

  async createEntry(tenantId: string, data: any) {
    // Track alert created
    this.metrics.trackAlertCreated(tenantId, 'HIGH', 'production-anomaly');

    // Track nominal range violation
    this.metrics.trackNominalRangeViolation(
      tenantId,
      'well-123',
      'oilProduction',
    );

    // Track database query performance
    const startTime = Date.now();
    await this.repository.save(data);
    const duration = Date.now() - startTime;
    this.metrics.trackDatabaseQuery(tenantId, 'INSERT', duration);
  }

  async syncOfflineData(
    tenantId: string,
    userId: string,
    entries: any[],
  ) {
    try {
      // ... sync logic

      this.metrics.trackSyncOperation(
        tenantId,
        userId,
        entries.length,
        true, // success
      );
    } catch (error) {
      this.metrics.trackSyncOperation(
        tenantId,
        userId,
        entries.length,
        false, // failure
      );
      throw error;
    }
  }
}
```

### 4. Tracking External Dependencies

```typescript
import { Injectable } from '@nestjs/common';
import { ApplicationInsightsService } from '../infrastructure/monitoring/application-insights.service';

@Injectable()
export class MLService {
  constructor(
    private readonly appInsights: ApplicationInsightsService,
  ) {}

  async getPrediction(data: any) {
    const startTime = Date.now();

    try {
      const response = await axios.post(
        'http://ml-service:8000/predict',
        data,
      );
      const duration = Date.now() - startTime;

      // Track successful dependency
      this.appInsights.trackDependency(
        'ML-Service',
        'POST /predict',
        duration,
        true, // success
        { model: 'predictive-maintenance' },
      );

      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Track failed dependency
      this.appInsights.trackDependency(
        'ML-Service',
        'POST /predict',
        duration,
        false, // failure
        { model: 'predictive-maintenance', error: error.message },
      );

      throw error;
    }
  }
}
```

### 5. Tracking Authentication Events

```typescript
import { Injectable } from '@nestjs/common';
import { MetricsService } from '../infrastructure/monitoring/metrics.service';

@Injectable()
export class AuthService {
  constructor(private readonly metrics: MetricsService) {}

  async login(tenantId: string, email: string, password: string) {
    try {
      const user = await this.validateCredentials(email, password);

      // Track successful login
      this.metrics.trackAuthEvent('login', tenantId, true);

      return user;
    } catch (error) {
      // Track failed login
      this.metrics.trackAuthEvent('login', tenantId, false);
      throw error;
    }
  }

  async refreshToken(tenantId: string) {
    this.metrics.trackAuthEvent('token-refresh', tenantId, true);
  }

  async logout(tenantId: string) {
    this.metrics.trackAuthEvent('logout', tenantId, true);
  }
}
```

## HTTP Metrics (Automatic)

The `HttpMetricsInterceptor` automatically tracks:

- **Request Count**: Total requests per endpoint
- **Request Duration**: Response time per endpoint
- **Status Codes**: 2xx, 4xx, 5xx tracking
- **Slow Requests**: Automatic warnings for requests >1s, errors for >5s
- **Error Events**: Client errors (4xx) and server errors (5xx)

All HTTP metrics are sent to both:
- **Prometheus** (`/metrics` endpoint)
- **Application Insights** (Azure portal)

## Monitoring in Azure Portal

### View Metrics

**Application Insights → Metrics**

Custom metrics available:
- `ApiRequestDuration` (ms)
- `alertsCreated` (count)
- `nominalRangeViolations` (count)
- `syncOperations` (count)
- `mlPredictions` (count)
- `fileUploads` (count)
- `authEvents` (count)

### View Events

**Application Insights → Events → Custom Events**

Custom events tracked:
- `AlertCreated`
- `SlowRequest` (>1s)
- `ServerError` (5xx)
- `ClientError` (4xx)

### View Logs

**Application Insights → Logs**

Query examples:

```kusto
// All logs in last 24 hours
traces
| where timestamp > ago(24h)
| project timestamp, message, severityLevel, customDimensions

// Error logs only
traces
| where severityLevel >= 3
| project timestamp, message, customDimensions

// Slow requests
customEvents
| where name == "SlowRequest"
| project timestamp, customDimensions.route, customDimensions.duration
| order by todouble(customDimensions.duration) desc

// Alert creation by tenant
customEvents
| where name == "AlertCreated"
| summarize count() by tostring(customDimensions.tenantId), tostring(customDimensions.severity)
```

### View Exceptions

**Application Insights → Failures → Exceptions**

All exceptions tracked with:
- Stack trace
- Tenant context
- User context
- Request details

## Production Deployment

### Azure Container Apps

Application Insights auto-configures when deployed to Azure Container Apps.

Set environment variable:
```bash
az containerapp update \
  --name wellpulse-api \
  --resource-group wellpulse-prod \
  --set-env-vars APPLICATIONINSIGHTS_CONNECTION_STRING=<connection-string>
```

### Docker

```dockerfile
ENV APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=xxx
ENV LOG_LEVEL=info
```

### Kubernetes

```yaml
env:
  - name: APPLICATIONINSIGHTS_CONNECTION_STRING
    valueFrom:
      secretKeyRef:
        name: app-insights-secret
        key: connection-string
  - name: LOG_LEVEL
    value: "info"
```

## Local Development

When running locally without Application Insights:
- Logs go to console (colorized, human-readable)
- Metrics are logged to console (not sent to Azure)
- Application continues to work normally

To test with Application Insights locally:
1. Create an Application Insights resource in Azure
2. Copy connection string
3. Add to `.env.local`:
   ```
   APPLICATIONINSIGHTS_CONNECTION_STRING=<your-connection-string>
   ```

## Performance Considerations

- **Minimal Overhead**: Telemetry is async and non-blocking
- **Automatic Batching**: Application Insights SDK batches telemetry
- **Graceful Failures**: If Application Insights is unavailable, app continues
- **Sampling**: Configure sampling in Azure Portal for high-traffic apps

## Troubleshooting

### Telemetry not appearing in Azure

1. Check connection string is correct
2. Allow 2-3 minutes for telemetry to appear
3. Check `Live Metrics Stream` for real-time data
4. Verify `LOG_LEVEL` is not too restrictive

### TypeScript compilation errors

Ensure `tsconfig.json` has:
```json
{
  "compilerOptions": {
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true
  }
}
```

### High telemetry volume

Configure sampling in Azure Portal:
**Application Insights → Usage and estimated costs → Sampling**

Recommended: 10-50% sampling for production

## Best Practices

1. **Always include tenant context** in custom properties
2. **Use correlation IDs** for request tracing (automatic)
3. **Track business metrics** (alerts, violations, sync) not just technical metrics
4. **Log errors with stack traces** for debugging
5. **Track external dependencies** (ML service, external APIs)
6. **Set appropriate log levels** (info for production, debug for development)
7. **Monitor costs** - Application Insights pricing is based on data volume

## Files Created/Modified

### New Files
- `/src/infrastructure/monitoring/application-insights.service.ts` - Core Application Insights service
- `/src/infrastructure/monitoring/winston-logger.config.ts` - Winston logger with AI transport
- `/src/infrastructure/monitoring/metrics.service.ts` - Business metrics tracking
- `/src/infrastructure/monitoring/README.md` - This documentation

### Modified Files
- `/src/infrastructure/monitoring/http-metrics.interceptor.ts` - Enhanced with Application Insights
- `/src/infrastructure/monitoring/monitoring.module.ts` - Added new services
- `/src/main.ts` - Initialize Application Insights, Winston logger, correlation IDs
- `/src/tsconfig.json` - Added `esModuleInterop`
- `/.env.example` - Added Application Insights configuration

## Dependencies Added

```json
{
  "applicationinsights": "^3.12.0",
  "winston": "^3.18.3",
  "winston-transport": "^4.9.0"
}
```

## Next Steps

1. **Create Application Insights resource** in Azure Portal
2. **Copy connection string** and add to production environment variables
3. **Test locally** (optional) by adding connection string to `.env.local`
4. **Create custom dashboards** in Azure Portal for your KPIs
5. **Set up alerts** for critical metrics (error rates, slow requests)
6. **Configure sampling** if telemetry volume is high

## Support

For questions or issues:
- Azure Application Insights Docs: https://docs.microsoft.com/azure/azure-monitor/app/app-insights-overview
- Winston Docs: https://github.com/winstonjs/winston
- WellPulse Team: #engineering channel
