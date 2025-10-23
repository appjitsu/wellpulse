# Pattern 47: Monitoring & Observability Patterns

**Version**: 1.0
**Last Updated**: October 8, 2025
**Category**: Operations & Reliability

---

## Table of Contents

1. [Overview](#overview)
2. [Three Pillars of Observability](#three-pillars-of-observability)
3. [Logging](#logging)
4. [Metrics](#metrics)
5. [Distributed Tracing](#distributed-tracing)
6. [Structured Logging](#structured-logging)
7. [Application Performance Monitoring (APM)](#application-performance-monitoring-apm)
8. [Health Checks](#health-checks)
9. [Alerting](#alerting)
10. [Error Tracking](#error-tracking)
11. [NestJS Implementation](#nestjs-implementation)
12. [Frontend Monitoring](#frontend-monitoring)
13. [Dashboard Setup](#dashboard-setup)
14. [Best Practices](#best-practices)
15. [Anti-Patterns](#anti-patterns)
16. [Related Patterns](#related-patterns)
17. [References](#references)

---

## Overview

**Observability** is the ability to understand the internal state of your system by examining its outputs. In WellPulse, observability is critical for:

- **Debugging production issues** - Understand what went wrong
- **Performance optimization** - Identify bottlenecks
- **Business insights** - Track user behavior and revenue
- **SLA compliance** - Ensure uptime and response time targets
- **Security monitoring** - Detect anomalies and attacks

**Monitoring vs Observability**:

- **Monitoring**: Known problems, predefined dashboards, alerts
- **Observability**: Unknown problems, ad-hoc queries, exploration

---

## Three Pillars of Observability

### 1. Logs

**What**: Timestamped records of discrete events.

**Use Cases**:

- Debugging errors and exceptions
- Audit trails (who did what, when)
- Security events (login attempts, permission denials)

**Example**:

```
[2025-10-08T10:30:45.123Z] INFO: User login successful { userId: "abc123", email: "john@acme.com", ip: "192.168.1.1" }
[2025-10-08T10:30:47.456Z] ERROR: Failed to create project { userId: "abc123", error: "Insufficient permissions" }
```

---

### 2. Metrics

**What**: Numerical measurements over time.

**Use Cases**:

- System health (CPU, memory, disk)
- Application performance (request rate, latency, error rate)
- Business KPIs (active users, revenue, conversion rate)

**Example**:

```
http_requests_total{method="GET", path="/api/projects", status="200"} 1523
http_request_duration_seconds{method="GET", path="/api/projects"} 0.045
active_users_count 247
```

---

### 3. Traces

**What**: End-to-end journey of a request through the system.

**Use Cases**:

- Performance profiling (which service is slow?)
- Dependency mapping (how do services interact?)
- Root cause analysis (where did the error originate?)

**Example**:

```
Trace ID: abc123def456
├─ HTTP GET /api/projects (120ms)
│  ├─ JwtAuthGuard.canActivate (5ms)
│  ├─ TenantGuard.canActivate (3ms)
│  ├─ QueryBus.execute (110ms)
│  │  ├─ GetProjectsHandler.execute (108ms)
│  │  │  ├─ Cache.get (2ms) - miss
│  │  │  ├─ Repository.findAll (95ms)
│  │  │  │  └─ PostgreSQL query (92ms)
│  │  │  └─ Cache.set (3ms)
│  └─ Response serialization (2ms)
```

---

## Logging

### Log Levels

Use appropriate log levels to control verbosity:

| Level     | When to Use                                     | Examples                                               |
| --------- | ----------------------------------------------- | ------------------------------------------------------ |
| **ERROR** | Unexpected errors requiring immediate attention | Database connection failed, payment processing failed  |
| **WARN**  | Potentially harmful situations                  | Deprecated API usage, slow query (>1s)                 |
| **INFO**  | Important business events                       | User registered, invoice created, password reset       |
| **DEBUG** | Detailed diagnostic information                 | Query parameters, function entry/exit, variable values |
| **TRACE** | Very fine-grained information                   | HTTP request/response bodies, loop iterations          |

### Winston Logger Setup

```typescript
// apps/api/src/infrastructure/logging/logger.service.ts
import { Injectable } from '@nestjs/common';
import * as winston from 'winston';

@Injectable()
export class LoggerService {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      transports: [
        // Console output
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              return `[${timestamp}] ${level}: ${message} ${
                Object.keys(meta).length ? JSON.stringify(meta) : ''
              }`;
            }),
          ),
        }),

        // File output
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 5242880,
          maxFiles: 5,
        }),
      ],
    });
  }

  error(message: string, trace?: string, context?: Record<string, any>) {
    this.logger.error(message, { trace, ...context });
  }

  warn(message: string, context?: Record<string, any>) {
    this.logger.warn(message, context);
  }

  info(message: string, context?: Record<string, any>) {
    this.logger.info(message, context);
  }

  debug(message: string, context?: Record<string, any>) {
    this.logger.debug(message, context);
  }

  trace(message: string, context?: Record<string, any>) {
    this.logger.log('trace', message, context);
  }
}
```

### Logging Best Practices

```typescript
// ✅ Good: Structured logging with context
logger.info('User registered', {
  userId: user.id,
  email: user.email,
  organizationId: user.organizationId,
  registrationMethod: 'email',
  timestamp: new Date().toISOString(),
});

// ❌ Bad: Unstructured logging
logger.info(`User ${user.email} registered`);

// ✅ Good: Include correlation IDs for request tracing
logger.error('Payment processing failed', {
  correlationId: request.id,
  userId: user.id,
  amount: payment.amount,
  error: error.message,
  stack: error.stack,
});

// ❌ Bad: Missing context
logger.error('Payment failed');
```

---

## Metrics

### Prometheus Metrics

```typescript
// apps/api/src/infrastructure/metrics/metrics.service.ts
import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  private registry: Registry;

  // HTTP Metrics
  private httpRequestsTotal: Counter;
  private httpRequestDuration: Histogram;
  private httpRequestSize: Histogram;
  private httpResponseSize: Histogram;

  // Application Metrics
  private activeUsers: Gauge;
  private databaseConnections: Gauge;
  private cacheHitRate: Gauge;

  // Business Metrics
  private timeEntriesCreated: Counter;
  private invoicesGenerated: Counter;
  private projectsCreated: Counter;

  constructor() {
    this.registry = new Registry();

    // HTTP Metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request latency in seconds',
      labelNames: ['method', 'path', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.httpRequestSize = new Histogram({
      name: 'http_request_size_bytes',
      help: 'HTTP request size in bytes',
      labelNames: ['method', 'path'],
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [this.registry],
    });

    this.httpResponseSize = new Histogram({
      name: 'http_response_size_bytes',
      help: 'HTTP response size in bytes',
      labelNames: ['method', 'path'],
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [this.registry],
    });

    // Application Metrics
    this.activeUsers = new Gauge({
      name: 'active_users_count',
      help: 'Number of active users',
      registers: [this.registry],
    });

    this.databaseConnections = new Gauge({
      name: 'database_connections_active',
      help: 'Active database connections',
      registers: [this.registry],
    });

    this.cacheHitRate = new Gauge({
      name: 'cache_hit_rate',
      help: 'Cache hit rate (0-1)',
      labelNames: ['cache_type'],
      registers: [this.registry],
    });

    // Business Metrics
    this.timeEntriesCreated = new Counter({
      name: 'time_entries_created_total',
      help: 'Total time entries created',
      labelNames: ['organization_id'],
      registers: [this.registry],
    });

    this.invoicesGenerated = new Counter({
      name: 'invoices_generated_total',
      help: 'Total invoices generated',
      labelNames: ['organization_id'],
      registers: [this.registry],
    });

    this.projectsCreated = new Counter({
      name: 'projects_created_total',
      help: 'Total projects created',
      labelNames: ['organization_id'],
      registers: [this.registry],
    });
  }

  // HTTP Metrics Methods
  recordHttpRequest(method: string, path: string, status: number, duration: number) {
    this.httpRequestsTotal.inc({ method, path, status });
    this.httpRequestDuration.observe({ method, path, status }, duration);
  }

  recordHttpRequestSize(method: string, path: string, size: number) {
    this.httpRequestSize.observe({ method, path }, size);
  }

  recordHttpResponseSize(method: string, path: string, size: number) {
    this.httpResponseSize.observe({ method, path }, size);
  }

  // Application Metrics Methods
  setActiveUsers(count: number) {
    this.activeUsers.set(count);
  }

  setDatabaseConnections(count: number) {
    this.databaseConnections.set(count);
  }

  setCacheHitRate(type: string, rate: number) {
    this.cacheHitRate.set({ cache_type: type }, rate);
  }

  // Business Metrics Methods
  incrementTimeEntriesCreated(organizationId: string) {
    this.timeEntriesCreated.inc({ organization_id: organizationId });
  }

  incrementInvoicesGenerated(organizationId: string) {
    this.invoicesGenerated.inc({ organization_id: organizationId });
  }

  incrementProjectsCreated(organizationId: string) {
    this.projectsCreated.inc({ organization_id: organizationId });
  }

  // Expose metrics for Prometheus scraping
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
```

### Metrics Controller

```typescript
// apps/api/src/presentation/metrics/metrics.controller.ts
import { Controller, Get } from '@nestjs/common';
import { MetricsService } from '@/infrastructure/metrics/metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}
```

### Metrics Interceptor

```typescript
// apps/api/src/shared/interceptors/metrics.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from '@/infrastructure/metrics/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: (response) => {
          const duration = (Date.now() - start) / 1000;
          const status = context.switchToHttp().getResponse().statusCode;

          this.metrics.recordHttpRequest(method, url, status, duration);

          if (request.headers['content-length']) {
            this.metrics.recordHttpRequestSize(
              method,
              url,
              parseInt(request.headers['content-length']),
            );
          }

          if (response) {
            const responseSize = JSON.stringify(response).length;
            this.metrics.recordHttpResponseSize(method, url, responseSize);
          }
        },
        error: (error) => {
          const duration = (Date.now() - start) / 1000;
          this.metrics.recordHttpRequest(method, url, error.status || 500, duration);
        },
      }),
    );
  }
}
```

---

## Distributed Tracing

### OpenTelemetry Setup

```typescript
// apps/api/src/infrastructure/tracing/tracing.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

@Injectable()
export class TracingService implements OnModuleInit {
  private sdk: NodeSDK;

  onModuleInit() {
    const jaegerExporter = new JaegerExporter({
      endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
    });

    this.sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'wellpulse-api',
        [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version,
        environment: process.env.NODE_ENV || 'development',
      }),
      traceExporter: jaegerExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': {
            ignoreIncomingPaths: ['/health', '/metrics'],
          },
          '@opentelemetry/instrumentation-pg': {},
          '@opentelemetry/instrumentation-redis': {},
        }),
      ],
    });

    this.sdk.start();
    console.log('OpenTelemetry tracing initialized');
  }
}
```

### Custom Spans

```typescript
// apps/api/src/application/project/queries/get-project-profitability.handler.ts
import { trace, SpanStatusCode } from '@opentelemetry/api';

@QueryHandler(GetProjectProfitabilityQuery)
export class GetProjectProfitabilityHandler {
  private tracer = trace.getTracer('wellpulse-api');

  async execute(query: GetProjectProfitabilityQuery) {
    const span = this.tracer.startSpan('GetProjectProfitability');

    try {
      span.setAttribute('project.id', query.projectId);

      // Fetch project data
      const projectSpan = this.tracer.startSpan('fetch-project', { parent: span });
      const project = await this.projectRepository.findById(query.projectId);
      projectSpan.end();

      // Fetch time entries
      const timeSpan = this.tracer.startSpan('fetch-time-entries', { parent: span });
      const timeEntries = await this.timeEntryRepository.findByProject(query.projectId);
      timeSpan.end();

      // Calculate profitability
      const calcSpan = this.tracer.startSpan('calculate-profitability', { parent: span });
      const profitability = this.calculateProfitability(project, timeEntries);
      calcSpan.end();

      span.setStatus({ code: SpanStatusCode.OK });
      span.setAttribute('profitability.margin', profitability.margin);

      return profitability;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }
}
```

---

## Structured Logging

### Request Context

```typescript
// apps/api/src/shared/middleware/request-context.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';

export interface RequestContext {
  requestId: string;
  userId?: string;
  organizationId?: string;
  ip: string;
  userAgent: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const context: RequestContext = {
      requestId: (req.headers['x-request-id'] as string) || uuidv4(),
      userId: req.user?.userId,
      organizationId: req.user?.organizationId,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || 'unknown',
    };

    requestContext.run(context, () => {
      next();
    });
  }
}

// Enhanced logger using request context
@Injectable()
export class ContextualLoggerService {
  constructor(private readonly logger: LoggerService) {}

  private getContext(): Record<string, any> {
    const ctx = requestContext.getStore();
    return ctx
      ? {
          requestId: ctx.requestId,
          userId: ctx.userId,
          organizationId: ctx.organizationId,
          ip: ctx.ip,
        }
      : {};
  }

  info(message: string, meta?: Record<string, any>) {
    this.logger.info(message, { ...this.getContext(), ...meta });
  }

  error(message: string, trace?: string, meta?: Record<string, any>) {
    this.logger.error(message, trace, { ...this.getContext(), ...meta });
  }

  warn(message: string, meta?: Record<string, any>) {
    this.logger.warn(message, { ...this.getContext(), ...meta });
  }

  debug(message: string, meta?: Record<string, any>) {
    this.logger.debug(message, { ...this.getContext(), ...meta });
  }
}
```

---

## Application Performance Monitoring (APM)

### Sentry Integration

```typescript
// apps/api/src/infrastructure/apm/sentry.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

@Injectable()
export class SentryService implements OnModuleInit {
  onModuleInit() {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: `wellpulse-api@${process.env.npm_package_version}`,

      // Tracing
      tracesSampleRate: 0.1, // 10% of transactions

      // Profiling
      profilesSampleRate: 0.1, // 10% of transactions
      integrations: [new ProfilingIntegration()],

      // Error filtering
      beforeSend(event, hint) {
        // Don't send 404 errors
        if (event.exception?.values?.[0]?.type === 'NotFoundException') {
          return null;
        }
        return event;
      },
    });
  }

  captureException(error: Error, context?: Record<string, any>) {
    Sentry.captureException(error, {
      extra: context,
    });
  }

  captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
    Sentry.captureMessage(message, level);
  }

  setUser(userId: string, email: string, organizationId?: string) {
    Sentry.setUser({ id: userId, email, organizationId });
  }

  addBreadcrumb(message: string, category: string, data?: Record<string, any>) {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
  }
}
```

### Global Exception Filter with APM

```typescript
// apps/api/src/shared/filters/all-exceptions.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { SentryService } from '@/infrastructure/apm/sentry.service';
import { ContextualLoggerService } from '@/infrastructure/logging/contextual-logger.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly sentry: SentryService,
    private readonly logger: ContextualLoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException ? exception.message : 'Internal server error';

    // Log error
    this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : '', {
      path: request.url,
      method: request.method,
      statusCode: status,
      message,
    });

    // Send to Sentry (only 5xx errors)
    if (status >= 500 && exception instanceof Error) {
      this.sentry.captureException(exception, {
        path: request.url,
        method: request.method,
        userId: request.user?.userId,
      });
    }

    // Return error response
    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
```

---

## Health Checks

```typescript
// apps/api/src/presentation/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { RedisCacheService } from '@/infrastructure/cache/redis-cache.service';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private cache: RedisCacheService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Database health
      () => this.db.pingCheck('database'),

      // Memory health (heap should be < 300MB)
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),

      // Memory RSS (should be < 500MB)
      () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024),

      // Disk health (should have > 10% free space)
      () =>
        this.disk.checkStorage('disk', {
          path: '/',
          thresholdPercent: 0.9,
        }),

      // Redis health
      async () => {
        const isHealthy = await this.cache.exists('health-check');
        return {
          redis: {
            status: isHealthy ? 'up' : 'down',
          },
        };
      },
    ]);
  }
}
```

---

## Alerting

### Alert Rules (Prometheus)

```yaml
# prometheus-alerts.yml
groups:
  - name: wellpulse_api_alerts
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[5m]))
            /
            sum(rate(http_requests_total[5m]))
          ) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: 'High error rate detected'
          description: 'Error rate is {{ $value | humanizePercentage }} (threshold: 5%)'

      # High latency
      - alert: HighLatency
        expr: |
          histogram_quantile(0.95,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
          ) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High API latency detected'
          description: 'P95 latency is {{ $value }}s (threshold: 1s)'

      # Database connection pool exhausted
      - alert: DatabaseConnectionPoolExhausted
        expr: database_connections_active > 80
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: 'Database connection pool nearly exhausted'
          description: '{{ $value }} active connections (max: 100)'

      # Low cache hit rate
      - alert: LowCacheHitRate
        expr: cache_hit_rate < 0.7
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: 'Cache hit rate is low'
          description: 'Hit rate is {{ $value | humanizePercentage }} (threshold: 70%)'

      # High memory usage
      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes > 500000000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High memory usage'
          description: 'Memory usage is {{ $value | humanize }}B (threshold: 500MB)'
```

---

## Error Tracking

### Error Categorization

```typescript
// apps/api/src/domain/shared/exceptions/base.exception.ts
export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  NOT_FOUND = 'not_found',
  CONFLICT = 'conflict',
  RATE_LIMIT = 'rate_limit',
  EXTERNAL_SERVICE = 'external_service',
  DATABASE = 'database',
  INTERNAL = 'internal',
}

export abstract class BaseException extends Error {
  abstract readonly category: ErrorCategory;
  abstract readonly statusCode: number;

  constructor(
    message: string,
    public readonly context?: Record<string, any>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Example: Authentication error
export class InvalidCredentialsException extends BaseException {
  readonly category = ErrorCategory.AUTHENTICATION;
  readonly statusCode = 401;

  constructor(email: string) {
    super('Invalid credentials', { email });
  }
}

// Example: External service error
export class QuickBooksIntegrationException extends BaseException {
  readonly category = ErrorCategory.EXTERNAL_SERVICE;
  readonly statusCode = 502;

  constructor(operation: string, error: Error) {
    super(`QuickBooks integration failed: ${operation}`, {
      operation,
      originalError: error.message,
    });
  }
}
```

---

## NestJS Implementation

### Complete Observability Module

```typescript
// apps/api/src/infrastructure/observability/observability.module.ts
import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { LoggerService } from '../logging/logger.service';
import { ContextualLoggerService } from '../logging/contextual-logger.service';
import { MetricsService } from '../metrics/metrics.service';
import { TracingService } from '../tracing/tracing.service';
import { SentryService } from '../apm/sentry.service';
import { MetricsInterceptor } from '@/shared/interceptors/metrics.interceptor';
import { AllExceptionsFilter } from '@/shared/filters/all-exceptions.filter';
import { HealthController } from '@/presentation/health/health.controller';
import { MetricsController } from '@/presentation/metrics/metrics.controller';

@Global()
@Module({
  imports: [TerminusModule],
  controllers: [HealthController, MetricsController],
  providers: [
    LoggerService,
    ContextualLoggerService,
    MetricsService,
    TracingService,
    SentryService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
  exports: [LoggerService, ContextualLoggerService, MetricsService, TracingService, SentryService],
})
export class ObservabilityModule {}
```

---

## Frontend Monitoring

### Sentry for React

```typescript
// apps/web/lib/monitoring/sentry.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: `wellpulse-web@${process.env.npm_package_version}`,

  // Tracing
  tracesSampleRate: 0.1,

  // Session replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Performance monitoring
  beforeSend(event, hint) {
    // Filter out known errors
    if (event.exception?.values?.[0]?.type === 'ChunkLoadError') {
      return null; // User navigated away during chunk load
    }
    return event;
  },
});
```

### Error Boundary

```typescript
// apps/web/components/error-boundary.tsx
'use client';

import React from 'react';
import * as Sentry from '@sentry/nextjs';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="text-gray-600 mb-4">
              We've been notified and are working on a fix.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Performance Monitoring

```typescript
// apps/web/lib/monitoring/performance.ts
import { onCLS, onFID, onFCP, onLCP, onTTFB } from 'web-vitals';

export function reportWebVitals() {
  onCLS((metric) => {
    console.log('CLS:', metric.value);
    // Send to analytics
  });

  onFID((metric) => {
    console.log('FID:', metric.value);
  });

  onFCP((metric) => {
    console.log('FCP:', metric.value);
  });

  onLCP((metric) => {
    console.log('LCP:', metric.value);
  });

  onTTFB((metric) => {
    console.log('TTFB:', metric.value);
  });
}
```

---

## Dashboard Setup

### Grafana Dashboard (JSON)

```json
{
  "dashboard": {
    "title": "WellPulse API Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m])) by (status)"
          }
        ]
      },
      {
        "title": "P95 Latency",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, path))"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m]))"
          }
        ]
      },
      {
        "title": "Active Users",
        "targets": [
          {
            "expr": "active_users_count"
          }
        ]
      },
      {
        "title": "Cache Hit Rate",
        "targets": [
          {
            "expr": "cache_hit_rate"
          }
        ]
      },
      {
        "title": "Database Connections",
        "targets": [
          {
            "expr": "database_connections_active"
          }
        ]
      }
    ]
  }
}
```

---

## Best Practices

### ✅ DO

1. **Use structured logging** - Always log with context

   ```typescript
   logger.info('User action', { userId, action, resource });
   ```

2. **Include correlation IDs** - Track requests across services

   ```typescript
   const requestId = req.headers['x-request-id'] || uuidv4();
   ```

3. **Monitor the golden signals** - Latency, traffic, errors, saturation

   ```typescript
   // Latency: http_request_duration_seconds
   // Traffic: http_requests_total
   // Errors: http_requests_total{status=~"5.."}
   // Saturation: database_connections_active
   ```

4. **Set up alerts proactively** - Don't wait for users to report issues

   ```yaml
   - alert: HighErrorRate
     expr: error_rate > 0.05
     for: 5m
   ```

5. **Use log levels appropriately** - ERROR = requires action, INFO = business events

   ```typescript
   logger.error('Payment failed', { userId, amount, error });
   logger.info('Invoice created', { userId, invoiceId });
   ```

6. **Trace expensive operations** - Use custom spans for profiling

   ```typescript
   const span = tracer.startSpan('calculate-profitability');
   // ... expensive operation
   span.end();
   ```

7. **Monitor business metrics** - Not just technical metrics
   ```typescript
   metrics.incrementInvoicesGenerated(orgId);
   metrics.recordRevenueGenerated(amount);
   ```

---

### ❌ DON'T

1. **Don't log sensitive data** - Never log passwords, tokens, PII

   ```typescript
   // ❌ Bad
   logger.info('User login', { email, password });

   // ✅ Good
   logger.info('User login', { email });
   ```

2. **Don't over-alert** - Too many alerts = alert fatigue

   ```typescript
   // ❌ Bad: Alert on every 404
   // ✅ Good: Alert on high 5xx error rate
   ```

3. **Don't ignore log levels in production** - Set to INFO or WARN

   ```typescript
   // ❌ Bad: LOG_LEVEL=debug in production
   // ✅ Good: LOG_LEVEL=info in production
   ```

4. **Don't forget to aggregate logs** - Use centralized logging
   ```typescript
   // ✅ Good: Send to Elasticsearch, Datadog, CloudWatch
   ```

---

## Anti-Patterns

### 1. Console.log in Production

```typescript
// ❌ Anti-pattern
console.log('User created:', user);

// ✅ Solution
logger.info('User created', { userId: user.id, email: user.email });
```

### 2. Logging Inside Loops

```typescript
// ❌ Anti-pattern
for (const project of projects) {
  logger.info('Processing project', { projectId: project.id });
  // ...
}

// ✅ Solution
logger.info('Processing projects', { count: projects.length });
for (const project of projects) {
  // ...
}
logger.info('Projects processed', { count: projects.length });
```

### 3. Missing Error Context

```typescript
// ❌ Anti-pattern
catch (error) {
  logger.error(error.message);
}

// ✅ Solution
catch (error) {
  logger.error('Failed to create invoice', error.stack, {
    userId,
    projectId,
    amount,
  });
}
```

---

## Related Patterns

- **Pattern 13: Circuit Breaker Pattern** - Monitor external service failures
- **Pattern 45: Background Job Patterns** - Track job metrics and failures
- **Pattern 46: Caching Strategy Patterns** - Monitor cache hit rates
- **Pattern 41: REST API Best Practices** - HTTP status code monitoring

---

## References

### Documentation

- [Winston Logger](https://github.com/winstonjs/winston)
- [Prometheus](https://prometheus.io/docs/)
- [OpenTelemetry](https://opentelemetry.io/docs/)
- [Sentry](https://docs.sentry.io/)
- [Grafana](https://grafana.com/docs/)
- [Jaeger](https://www.jaegertracing.io/docs/)

### Books & Articles

- **"Observability Engineering"** by Charity Majors - Modern observability practices
- **"Site Reliability Engineering"** by Google - SLIs, SLOs, error budgets
- **"The Art of Monitoring"** - Practical monitoring strategies

### Tools

- **Prometheus** - Metrics collection and alerting
- **Grafana** - Visualization and dashboards
- **Jaeger** - Distributed tracing
- **Sentry** - Error tracking and APM
- **Datadog** - All-in-one observability platform
- **New Relic** - APM and infrastructure monitoring

---

## Summary

**Monitoring & Observability Patterns** provide visibility into system health and user experience:

✅ **Log everything important** - Structured logging with context
✅ **Measure golden signals** - Latency, traffic, errors, saturation
✅ **Trace requests end-to-end** - Distributed tracing with OpenTelemetry
✅ **Alert on anomalies** - Proactive alerting based on thresholds
✅ **Track business metrics** - Not just technical metrics
✅ **Use APM tools** - Sentry, Datadog, New Relic for deep insights
✅ **Health checks** - Expose /health endpoint for monitoring

**Remember**: You can't fix what you can't see. Invest in observability early - it pays dividends when debugging production issues.

---

**Next Steps**:

1. Set up structured logging with Winston
2. Instrument code with Prometheus metrics
3. Add health check endpoints
4. Configure Sentry for error tracking
5. Create Grafana dashboards
6. Set up alerts for critical thresholds
