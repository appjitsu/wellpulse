# Pattern 48: API Gateway Pattern

**Version**: 1.0
**Last Updated**: October 8, 2025
**Category**: Architecture & Integration

---

## Table of Contents

1. [Overview](#overview)
2. [When to Use](#when-to-use)
3. [Core Responsibilities](#core-responsibilities)
4. [Architecture](#architecture)
5. [Request Routing](#request-routing)
6. [Authentication & Authorization](#authentication--authorization)
7. [Rate Limiting](#rate-limiting)
8. [Request/Response Transformation](#requestresponse-transformation)
9. [Load Balancing](#load-balancing)
10. [API Versioning](#api-versioning)
11. [Caching](#caching)
12. [Error Handling](#error-handling)
13. [Implementation Options](#implementation-options)
14. [Best Practices](#best-practices)
15. [Anti-Patterns](#anti-patterns)
16. [Related Patterns](#related-patterns)
17. [References](#references)

---

## Overview

**API Gateway Pattern** provides a single entry point for all client requests to backend services. It acts as a reverse proxy, routing requests to appropriate microservices and handling cross-cutting concerns.

In WellPulse's current monolithic architecture, an API Gateway may not be immediately necessary. However, as the application scales and potentially transitions to microservices, the gateway becomes critical for:

- **Unified API interface** - Single endpoint for frontend clients
- **Security enforcement** - Centralized authentication and authorization
- **Traffic management** - Rate limiting, throttling, circuit breaking
- **Protocol translation** - REST to gRPC, HTTP to WebSocket
- **API composition** - Aggregating data from multiple services

**Key Benefits**:

- 🔒 **Centralized security** - Single point for authentication/authorization
- 🚀 **Performance** - Caching, compression, load balancing
- 📊 **Observability** - Unified logging, metrics, tracing
- 🔄 **Flexibility** - Easy to add/remove backend services

---

## When to Use

### ✅ Use API Gateway When:

1. **Multiple backend services** - Microservices architecture
   - Time tracking service
   - Invoicing service
   - Project management service
   - QuickBooks integration service

2. **Different client types** - Web, mobile, third-party integrations
   - Web app needs full API
   - Mobile app needs lightweight responses
   - Partner integrations need specific data formats

3. **Cross-cutting concerns** - Authentication, logging, rate limiting
   - All requests need JWT validation
   - All endpoints need request logging
   - All public APIs need rate limiting

4. **Service aggregation** - Combine data from multiple services
   - Dashboard data from time tracking + projects + invoices
   - User profile from auth service + organization service

### ❌ Don't Use API Gateway When:

1. **Simple monolithic app** - Single backend service (WellPulse's current state)
2. **Internal-only services** - No external clients
3. **Minimal traffic** - Over-engineering for small scale
4. **Tight coupling required** - Services need direct communication

---

## Core Responsibilities

### 1. Request Routing

Route incoming requests to appropriate backend services based on path, headers, or content.

```typescript
// Example routing logic
const routes = {
  '/api/auth/*': 'http://auth-service:3001',
  '/api/projects/*': 'http://project-service:3002',
  '/api/time-entries/*': 'http://time-tracking-service:3003',
  '/api/invoices/*': 'http://invoicing-service:3004',
  '/api/integrations/quickbooks/*': 'http://quickbooks-service:3005',
};
```

### 2. Authentication & Authorization

Validate tokens, enforce permissions, inject user context.

```typescript
// Verify JWT token
const user = await verifyToken(request.headers.authorization);

// Check permissions
if (!user.hasPermission('projects:read')) {
  throw new ForbiddenException();
}

// Inject user context for downstream services
request.headers['X-User-Id'] = user.id;
request.headers['X-Organization-Id'] = user.organizationId;
```

### 3. Rate Limiting

Prevent abuse by limiting requests per client.

```typescript
// Rate limit: 100 requests per minute per API key
const rateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.headers['x-api-key'],
});
```

### 4. Request/Response Transformation

Adapt requests and responses for different clients.

```typescript
// Transform response for mobile clients
if (request.headers['user-agent'].includes('Mobile')) {
  return {
    ...response,
    data: simplifyDataForMobile(response.data),
  };
}
```

### 5. Aggregation

Combine data from multiple services into a single response.

```typescript
// Dashboard endpoint aggregates data from multiple services
async getDashboard(userId: string) {
  const [projects, timeEntries, invoices] = await Promise.all([
    projectService.getProjects(userId),
    timeService.getTimeEntries(userId),
    invoiceService.getInvoices(userId),
  ]);

  return { projects, timeEntries, invoices };
}
```

### 6. Caching

Cache responses to reduce backend load.

```typescript
// Cache project list for 5 minutes
const cacheKey = `projects:${userId}`;
const cached = await cache.get(cacheKey);
if (cached) return cached;

const projects = await projectService.getProjects(userId);
await cache.set(cacheKey, projects, 300);
return projects;
```

### 7. Logging & Monitoring

Centralized logging, metrics, and distributed tracing.

```typescript
// Log all requests
logger.info('API Gateway request', {
  method: request.method,
  path: request.path,
  userId: request.user?.id,
  duration: Date.now() - startTime,
});

// Record metrics
metrics.recordRequest(request.method, request.path, response.status);
```

---

## Architecture

### API Gateway Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Clients                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │ Web App │  │ Mobile  │  │ Partner │  │ Admin   │       │
│  │         │  │ App     │  │ API     │  │ Panel   │       │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘       │
└───────┼────────────┼────────────┼────────────┼─────────────┘
        │            │            │            │
        └────────────┴────────────┴────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │      API Gateway           │
        │                            │
        │  ┌──────────────────────┐ │
        │  │ Authentication       │ │
        │  │ Authorization        │ │
        │  │ Rate Limiting        │ │
        │  │ Request Routing      │ │
        │  │ Response Caching     │ │
        │  │ Logging & Metrics    │ │
        │  │ Error Handling       │ │
        │  └──────────────────────┘ │
        └────────────┬───────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌───────────────┐         ┌───────────────┐
│ Load Balancer │         │ Load Balancer │
└───────┬───────┘         └───────┬───────┘
        │                         │
   ┌────┴────┐               ┌────┴────┐
   ▼         ▼               ▼         ▼
┌─────┐   ┌─────┐       ┌─────┐   ┌─────┐
│Auth │   │Auth │       │Time │   │Time │
│Svc  │   │Svc  │       │Svc  │   │Svc  │
│(1)  │   │(2)  │       │(1)  │   │(2)  │
└─────┘   └─────┘       └─────┘   └─────┘

┌─────────────────────────────────────────────┐
│         Shared Infrastructure               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Database │  │  Redis   │  │  Queue   │ │
│  └──────────┘  └──────────┘  └──────────┘ │
└─────────────────────────────────────────────┘
```

---

## Request Routing

### Path-Based Routing

```typescript
// apps/gateway/src/routing/path-router.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

interface RouteConfig {
  path: string;
  service: string;
  methods?: string[];
  stripPrefix?: boolean;
}

@Injectable()
export class PathRouter {
  private routes: RouteConfig[] = [
    { path: '/api/v1/auth', service: 'http://auth-service:3001' },
    { path: '/api/v1/projects', service: 'http://project-service:3002' },
    { path: '/api/v1/time-entries', service: 'http://time-service:3003' },
    { path: '/api/v1/invoices', service: 'http://invoice-service:3004' },
  ];

  constructor(private readonly http: HttpService) {}

  async route(request: Request): Promise<Response> {
    const route = this.findRoute(request.path, request.method);
    if (!route) {
      throw new NotFoundException('Route not found');
    }

    const targetUrl = this.buildTargetUrl(route, request);

    // Forward request to backend service
    const response = await this.http.request({
      method: request.method,
      url: targetUrl,
      headers: this.forwardHeaders(request.headers),
      data: request.body,
    });

    return response.data;
  }

  private findRoute(path: string, method: string): RouteConfig | undefined {
    return this.routes.find((route) => {
      const pathMatches = path.startsWith(route.path);
      const methodMatches = !route.methods || route.methods.includes(method);
      return pathMatches && methodMatches;
    });
  }

  private buildTargetUrl(route: RouteConfig, request: Request): string {
    const path = route.stripPrefix ? request.path.replace(route.path, '') : request.path;
    return `${route.service}${path}${request.search || ''}`;
  }

  private forwardHeaders(headers: Headers): Record<string, string> {
    const forwarded: Record<string, string> = {};

    // Forward important headers
    const headersToForward = [
      'authorization',
      'content-type',
      'accept',
      'user-agent',
      'x-request-id',
    ];

    for (const header of headersToForward) {
      const value = headers.get(header);
      if (value) {
        forwarded[header] = value;
      }
    }

    return forwarded;
  }
}
```

### Header-Based Routing

```typescript
// Route based on API version header
const version = request.headers['x-api-version'];
const service = version === 'v2' ? 'http://projects-v2:3002' : 'http://projects-v1:3002';
```

### Canary Releases

```typescript
// Route 10% of traffic to new version
const routeToCanary = Math.random() < 0.1;
const service = routeToCanary ? 'http://projects-canary:3002' : 'http://projects-stable:3002';
```

---

## Authentication & Authorization

### JWT Validation

```typescript
// apps/gateway/src/auth/auth.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly jwt: JwtService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const token = this.extractToken(req.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Missing authorization token');
    }

    try {
      // Verify JWT
      const payload = await this.jwt.verifyAsync(token);

      // Inject user context into headers for downstream services
      req.headers['x-user-id'] = payload.userId;
      req.headers['x-organization-id'] = payload.organizationId;
      req.headers['x-user-email'] = payload.email;
      req.headers['x-user-role'] = payload.role;

      next();
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(authHeader?: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }
}
```

### Permission Checking

```typescript
// apps/gateway/src/auth/permission.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );

    if (!requiredPermissions) {
      return true; // No permissions required
    }

    const request = context.switchToHttp().getRequest();
    const userPermissions = request.headers['x-user-permissions']?.split(',') || [];

    return requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );
  }
}

// Usage
@Get('/projects')
@Permissions('projects:read')
async getProjects() {
  // ...
}
```

---

## Rate Limiting

### Token Bucket Algorithm

```typescript
// apps/gateway/src/rate-limiting/token-bucket.service.ts
import { Injectable } from '@nestjs/common';
import { RedisCacheService } from '@/infrastructure/cache/redis-cache.service';

interface BucketConfig {
  capacity: number; // Max tokens
  refillRate: number; // Tokens per second
}

@Injectable()
export class TokenBucketService {
  constructor(private readonly cache: RedisCacheService) {}

  async allowRequest(
    key: string,
    config: BucketConfig = { capacity: 100, refillRate: 10 },
  ): Promise<boolean> {
    const now = Date.now() / 1000; // seconds
    const bucketKey = `rate-limit:${key}`;

    // Get current bucket state
    const bucket = (await this.cache.get<{ tokens: number; lastRefill: number }>(bucketKey)) || {
      tokens: config.capacity,
      lastRefill: now,
    };

    // Refill tokens based on time elapsed
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = timePassed * config.refillRate;
    bucket.tokens = Math.min(config.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Check if we have tokens available
    if (bucket.tokens < 1) {
      await this.cache.set(bucketKey, bucket, 3600);
      return false; // Rate limit exceeded
    }

    // Consume one token
    bucket.tokens -= 1;
    await this.cache.set(bucketKey, bucket, 3600);
    return true; // Request allowed
  }

  async getRemainingTokens(key: string, config: BucketConfig): Promise<number> {
    const bucket = await this.cache.get<{ tokens: number }>(`rate-limit:${key}`);
    return bucket?.tokens || config.capacity;
  }
}
```

### Rate Limit Middleware

```typescript
// apps/gateway/src/rate-limiting/rate-limit.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { TokenBucketService } from './token-bucket.service';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  constructor(private readonly tokenBucket: TokenBucketService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const key = this.getRateLimitKey(req);
    const config = this.getRateLimitConfig(req);

    const allowed = await this.tokenBucket.allowRequest(key, config);

    if (!allowed) {
      const remaining = await this.tokenBucket.getRemainingTokens(key, config);
      res.status(429).json({
        statusCode: 429,
        message: 'Too many requests',
        retryAfter: Math.ceil((1 - remaining) / config.refillRate),
      });
      return;
    }

    next();
  }

  private getRateLimitKey(req: Request): string {
    // Rate limit by API key (if present) or IP address
    const apiKey = req.headers['x-api-key'];
    if (apiKey) {
      return `api-key:${apiKey}`;
    }
    return `ip:${req.ip}`;
  }

  private getRateLimitConfig(req: Request): BucketConfig {
    // Different limits for different endpoints
    if (req.path.startsWith('/api/v1/public')) {
      return { capacity: 100, refillRate: 10 }; // 100 requests, refill 10/sec
    }
    if (req.path.startsWith('/api/v1/auth')) {
      return { capacity: 20, refillRate: 2 }; // Stricter for auth endpoints
    }
    return { capacity: 1000, refillRate: 100 }; // Default for authenticated users
  }
}
```

---

## Request/Response Transformation

### Request Transformation

```typescript
// apps/gateway/src/transformation/request-transformer.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class RequestTransformer {
  transform(request: Request): Request {
    // Convert snake_case to camelCase for backend
    if (request.body) {
      request.body = this.transformKeys(request.body, this.toCamelCase);
    }

    // Add default pagination if missing
    if (request.method === 'GET' && !request.query.limit) {
      request.query.limit = '50';
      request.query.offset = '0';
    }

    // Normalize date formats
    if (request.body?.date) {
      request.body.date = new Date(request.body.date).toISOString();
    }

    return request;
  }

  private transformKeys(obj: any, transformer: (key: string) => string): any {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.transformKeys(item, transformer));
    }

    if (obj !== null && typeof obj === 'object') {
      return Object.keys(obj).reduce((result, key) => {
        const transformedKey = transformer(key);
        result[transformedKey] = this.transformKeys(obj[key], transformer);
        return result;
      }, {} as any);
    }

    return obj;
  }

  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }
}
```

### Response Transformation

```typescript
// apps/gateway/src/transformation/response-transformer.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class ResponseTransformer {
  transform(response: any, request: Request): any {
    // Convert camelCase to snake_case for mobile clients
    if (this.isMobileClient(request)) {
      response = this.transformKeys(response, this.toSnakeCase);
    }

    // Wrap response in standard envelope
    return {
      success: true,
      data: response,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.headers['x-request-id'],
      },
    };
  }

  private isMobileClient(request: Request): boolean {
    const userAgent = request.headers['user-agent'] || '';
    return /mobile|android|iphone|ipad/i.test(userAgent);
  }

  private transformKeys(obj: any, transformer: (key: string) => string): any {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.transformKeys(item, transformer));
    }

    if (obj !== null && typeof obj === 'object') {
      return Object.keys(obj).reduce((result, key) => {
        const transformedKey = transformer(key);
        result[transformedKey] = this.transformKeys(obj[key], transformer);
        return result;
      }, {} as any);
    }

    return obj;
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}
```

---

## Load Balancing

### Round-Robin Load Balancer

```typescript
// apps/gateway/src/load-balancing/round-robin.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class RoundRobinLoadBalancer {
  private counters = new Map<string, number>();

  getNextInstance(service: string, instances: string[]): string {
    const counter = this.counters.get(service) || 0;
    const instance = instances[counter % instances.length];

    this.counters.set(service, counter + 1);
    return instance;
  }
}

// Usage
const instances = [
  'http://project-service-1:3002',
  'http://project-service-2:3002',
  'http://project-service-3:3002',
];

const target = loadBalancer.getNextInstance('project-service', instances);
```

### Least Connections Load Balancer

```typescript
// apps/gateway/src/load-balancing/least-connections.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class LeastConnectionsLoadBalancer {
  private connections = new Map<string, number>();

  getNextInstance(instances: string[]): string {
    // Find instance with fewest active connections
    let minConnections = Infinity;
    let selectedInstance = instances[0];

    for (const instance of instances) {
      const connections = this.connections.get(instance) || 0;
      if (connections < minConnections) {
        minConnections = connections;
        selectedInstance = instance;
      }
    }

    // Increment connection count
    this.connections.set(selectedInstance, (this.connections.get(selectedInstance) || 0) + 1);

    return selectedInstance;
  }

  releaseConnection(instance: string) {
    const connections = this.connections.get(instance) || 0;
    this.connections.set(instance, Math.max(0, connections - 1));
  }
}
```

---

## API Versioning

### URL Path Versioning

```typescript
// /api/v1/projects -> Version 1
// /api/v2/projects -> Version 2

const routes = {
  '/api/v1/projects': 'http://projects-v1:3002',
  '/api/v2/projects': 'http://projects-v2:3002',
};
```

### Header Versioning

```typescript
// X-API-Version: 1
// X-API-Version: 2

const version = request.headers['x-api-version'] || '1';
const service = version === '2' ? 'http://projects-v2:3002' : 'http://projects-v1:3002';
```

### Content Negotiation

```typescript
// Accept: application/vnd.wellpulse.v2+json

const acceptHeader = request.headers.accept;
const version = acceptHeader.match(/v(\d+)/)?.[1] || '1';
```

---

## Caching

### Response Caching

```typescript
// apps/gateway/src/caching/response-cache.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { RedisCacheService } from '@/infrastructure/cache/redis-cache.service';

@Injectable()
export class ResponseCacheMiddleware implements NestMiddleware {
  constructor(private readonly cache: RedisCacheService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = this.getCacheKey(req);
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    // Intercept response to cache it
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      this.cache.set(cacheKey, body, this.getTTL(req.path));
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  }

  private getCacheKey(req: Request): string {
    const userId = req.headers['x-user-id'];
    const queryString = new URLSearchParams(req.query as any).toString();
    return `api-cache:${req.path}:${userId}:${queryString}`;
  }

  private getTTL(path: string): number {
    // Different TTLs for different endpoints
    if (path.includes('/projects')) return 300; // 5 minutes
    if (path.includes('/users')) return 600; // 10 minutes
    if (path.includes('/organizations')) return 1800; // 30 minutes
    return 60; // Default 1 minute
  }
}
```

---

## Error Handling

### Unified Error Response

```typescript
// apps/gateway/src/errors/error-handler.ts
import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';

@Catch()
export class GlobalErrorHandler implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = exception.status || 500;
    const message = exception.message || 'Internal server error';

    // Log error
    console.error('API Gateway error:', {
      path: request.path,
      method: request.method,
      status,
      message,
      stack: exception.stack,
    });

    // Return standardized error response
    response.status(status).json({
      success: false,
      error: {
        code: exception.code || 'INTERNAL_ERROR',
        message,
        details: exception.details,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.headers['x-request-id'],
        path: request.path,
      },
    });
  }
}
```

### Circuit Breaker Integration

```typescript
// apps/gateway/src/resilience/circuit-breaker.service.ts
import { Injectable } from '@nestjs/common';

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

@Injectable()
export class CircuitBreakerService {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;

  private readonly threshold = 5; // Open after 5 failures
  private readonly timeout = 60000; // Try again after 60s
  private readonly successThreshold = 2; // Close after 2 successes

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - (this.lastFailureTime || 0) > this.timeout) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (this.failureCount >= this.threshold) {
      this.state = CircuitState.OPEN;
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}
```

---

## Implementation Options

### 1. Custom NestJS Gateway

**Pros**:

- ✅ Full control over logic
- ✅ TypeScript type safety
- ✅ Seamless NestJS integration

**Cons**:

- ❌ More development effort
- ❌ Maintenance burden

```typescript
// apps/gateway/src/main.ts
import { NestFactory } from '@nestjs/core';
import { GatewayModule } from './gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule);
  await app.listen(3000);
}
bootstrap();
```

### 2. Kong Gateway

**Pros**:

- ✅ Production-ready
- ✅ Extensive plugin ecosystem
- ✅ Kubernetes-native

**Cons**:

- ❌ Additional infrastructure
- ❌ Learning curve

```yaml
# kong.yml
services:
  - name: project-service
    url: http://project-service:3002
    routes:
      - name: projects-route
        paths:
          - /api/v1/projects
    plugins:
      - name: jwt
      - name: rate-limiting
        config:
          minute: 100
```

### 3. AWS API Gateway

**Pros**:

- ✅ Fully managed
- ✅ Auto-scaling
- ✅ AWS ecosystem integration

**Cons**:

- ❌ Vendor lock-in
- ❌ Cost for high traffic

### 4. NGINX

**Pros**:

- ✅ Lightweight
- ✅ High performance
- ✅ Battle-tested

**Cons**:

- ❌ Limited programmability
- ❌ Requires Lua for complex logic

```nginx
# nginx.conf
http {
  upstream project_service {
    server project-service-1:3002;
    server project-service-2:3002;
  }

  server {
    location /api/v1/projects {
      proxy_pass http://project_service;
      proxy_set_header X-User-Id $http_x_user_id;
    }
  }
}
```

---

## Best Practices

### ✅ DO

1. **Implement health checks** - Gateway and downstream services

   ```typescript
   @Get('/health')
   async health() {
     return { status: 'ok', timestamp: new Date() };
   }
   ```

2. **Use circuit breakers** - Prevent cascading failures

   ```typescript
   await circuitBreaker.execute(() => projectService.getProjects());
   ```

3. **Add request timeouts** - Don't wait forever

   ```typescript
   const response = await axios.get(url, { timeout: 5000 });
   ```

4. **Log all requests** - Centralized observability

   ```typescript
   logger.info('Gateway request', { method, path, duration });
   ```

5. **Version your APIs** - Use /api/v1, /api/v2 prefixes

   ```typescript
   '/api/v1/projects' vs '/api/v2/projects'
   ```

6. **Cache aggressively** - Reduce backend load

   ```typescript
   if (method === 'GET') cache.set(key, response, ttl);
   ```

7. **Rate limit by client** - API key or IP address
   ```typescript
   const key = req.headers['x-api-key'] || req.ip;
   ```

---

### ❌ DON'T

1. **Don't add business logic** - Gateway should be thin

   ```typescript
   // ❌ Bad: Business logic in gateway
   if (project.budget > 100000) {
     /* ... */
   }

   // ✅ Good: Delegate to service
   await projectService.validateBudget(project);
   ```

2. **Don't store state** - Gateway should be stateless

   ```typescript
   // ❌ Bad: In-memory state
   this.sessions.set(userId, session);

   // ✅ Good: Store in Redis
   await cache.set(`session:${userId}`, session);
   ```

3. **Don't ignore errors** - Always handle gracefully

   ```typescript
   // ❌ Bad: Swallow errors
   try { await service.call(); } catch {}

   // ✅ Good: Handle and log
   try { await service.call(); }
   catch (error) { logger.error('Service error', error); throw; }
   ```

---

## Anti-Patterns

### 1. God Gateway

**Problem**: Gateway does too much (business logic, data transformations, complex aggregations).

```typescript
// ❌ Anti-pattern: Too much logic in gateway
async getDashboard() {
  const projects = await projectService.getAll();
  const filtered = projects.filter(p => p.status === 'active');
  const sorted = filtered.sort((a, b) => b.priority - a.priority);
  const enriched = sorted.map(p => ({ ...p, total: calculateTotal(p) }));
  return enriched;
}

// ✅ Solution: Delegate to services
async getDashboard() {
  return projectService.getDashboard(); // Service handles logic
}
```

### 2. Tight Coupling

**Problem**: Gateway knows too much about backend services.

```typescript
// ❌ Anti-pattern: Gateway knows service internals
const url = `${projectService}/internal/database/projects?table=projects`;

// ✅ Solution: Use service interfaces
const url = `${projectService}/api/projects`;
```

---

## Related Patterns

- **Pattern 13: Circuit Breaker Pattern** - Handle service failures
- **Pattern 46: Caching Strategy Patterns** - Cache responses at gateway
- **Pattern 47: Monitoring & Observability Patterns** - Gateway metrics
- **Pattern 41: REST API Best Practices** - API design for gateway

---

## References

### Documentation

- [Kong Gateway](https://docs.konghq.com/)
- [AWS API Gateway](https://aws.amazon.com/api-gateway/)
- [NGINX](https://nginx.org/en/docs/)
- [Envoy Proxy](https://www.envoyproxy.io/docs/)

### Books & Articles

- **"Building Microservices"** by Sam Newman - Gateway patterns
- **"Microservices Patterns"** by Chris Richardson - API Gateway pattern
- **"Release It!"** by Michael Nygard - Stability patterns (circuit breaker)

### Tools

- **Kong** - Open-source API Gateway
- **Tyk** - Open-source API Gateway
- **AWS API Gateway** - Managed service
- **Google Cloud API Gateway** - Managed service
- **Azure API Management** - Managed service

---

## Summary

**API Gateway Pattern** provides a unified entry point for client requests:

✅ **Single entry point** - All clients go through gateway
✅ **Cross-cutting concerns** - Auth, rate limiting, logging, caching
✅ **Service aggregation** - Combine data from multiple services
✅ **Protocol translation** - REST, gRPC, WebSocket
✅ **Load balancing** - Distribute traffic across instances
✅ **API versioning** - Support multiple API versions
✅ **Circuit breaking** - Prevent cascading failures

**Remember**: API Gateway is essential for microservices but may be over-engineering for simple monoliths. Start simple, add gateway when complexity justifies it.

---

**Next Steps**:

1. Evaluate if API Gateway is needed for your architecture
2. Choose implementation (custom, Kong, AWS, NGINX)
3. Implement authentication and rate limiting
4. Add health checks and circuit breakers
5. Set up monitoring and logging
6. Test failover and load balancing scenarios
