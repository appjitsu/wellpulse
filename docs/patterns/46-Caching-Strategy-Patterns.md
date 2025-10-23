# Pattern 46: Caching Strategy Patterns

**Version**: 1.0
**Last Updated**: October 8, 2025
**Category**: Performance & Optimization

---

## Table of Contents

1. [Overview](#overview)
2. [When to Use Caching](#when-to-use-caching)
3. [Cache Providers](#cache-providers)
4. [Caching Patterns](#caching-patterns)
5. [Cache Invalidation Strategies](#cache-invalidation-strategies)
6. [TTL and Eviction Policies](#ttl-and-eviction-policies)
7. [Multi-Level Caching](#multi-level-caching)
8. [Cache Warming](#cache-warming)
9. [NestJS Implementation](#nestjs-implementation)
10. [Frontend Caching with React Query](#frontend-caching-with-react-query)
11. [Monitoring and Metrics](#monitoring-and-metrics)
12. [Best Practices](#best-practices)
13. [Anti-Patterns](#anti-patterns)
14. [Related Patterns](#related-patterns)
15. [References](#references)

---

## Overview

Caching is a performance optimization technique that stores frequently accessed data in fast storage to reduce latency and database load. In WellPulse, caching is critical for:

- **User lookups** - Reduce repeated database queries
- **Organization data** - Cache tenant context and settings
- **Project lists** - Cache project hierarchies and metadata
- **Time entry aggregations** - Cache expensive calculations
- **Permissions** - Cache RBAC policy evaluations
- **API responses** - Reduce backend processing for repeated requests

**Key Benefits**:

- ⚡ Reduced response times (10-100x faster)
- 📉 Lower database load (fewer queries)
- 💰 Reduced infrastructure costs
- 🔄 Better scalability (handle more concurrent users)

---

## When to Use Caching

### Good Candidates for Caching

✅ **Read-heavy data** - Read/write ratio > 10:1

- User profiles
- Organization settings
- Project metadata
- Client information

✅ **Expensive computations**

- Project profitability calculations
- Time entry aggregations
- Report generation
- Invoice totals

✅ **Slow external API calls**

- QuickBooks integration data
- Third-party service responses
- Geocoding results

✅ **Static or slowly changing data**

- Dropdown options
- Reference data (states, countries)
- System configuration

### Poor Candidates for Caching

❌ **Highly volatile data**

- Real-time time tracking updates
- Live chat messages
- Stock prices

❌ **User-specific sensitive data**

- Payment details
- Personal financial data
- Authentication tokens (use httpOnly cookies instead)

❌ **Data with strict consistency requirements**

- Bank account balances
- Inventory counts
- Legal compliance data

---

## Cache Providers

### In-Memory Cache (Node.js)

**Use Case**: Single-instance applications, local development

```typescript
// apps/api/src/infrastructure/cache/memory-cache.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class MemoryCacheService {
  private cache = new Map<string, { value: any; expiresAt: number }>();

  set(key: string, value: any, ttl: number): void {
    const expiresAt = Date.now() + ttl * 1000;
    this.cache.set(key, { value, expiresAt });
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired entries periodically
  private cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }, 60000); // Every minute
}
```

**Pros**:

- ✅ Fastest access (no network latency)
- ✅ Simple to implement
- ✅ No external dependencies

**Cons**:

- ❌ Data lost on restart
- ❌ Doesn't scale across multiple instances
- ❌ Limited by server memory

---

### Redis Cache (Distributed)

**Use Case**: Production applications, multi-instance deployments

```typescript
// apps/api/src/infrastructure/cache/redis-cache.service.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.client.setex(key, ttl, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async deletePattern(pattern: string): Promise<void> {
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
```

**Pros**:

- ✅ Scales horizontally (distributed)
- ✅ Persistent (survives restarts)
- ✅ Advanced features (pub/sub, transactions)
- ✅ Battle-tested in production

**Cons**:

- ❌ Network latency (slower than in-memory)
- ❌ Additional infrastructure cost
- ❌ More complex setup

---

## Caching Patterns

### 1. Cache-Aside (Lazy Loading)

**Strategy**: Application checks cache first, then loads from database if miss.

```typescript
// apps/api/src/application/user/queries/get-user-by-id.handler.ts
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { GetUserByIdQuery } from './get-user-by-id.query';
import { RedisCacheService } from '@/infrastructure/cache/redis-cache.service';
import { UserRepository } from '@/domain/repositories/user.repository.interface';

@QueryHandler(GetUserByIdQuery)
export class GetUserByIdHandler implements IQueryHandler<GetUserByIdQuery> {
  constructor(
    private readonly cache: RedisCacheService,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(query: GetUserByIdQuery) {
    const { userId } = query;
    const cacheKey = `user:${userId}`;

    // 1. Check cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. Cache miss - load from database
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // 3. Store in cache for next time (TTL: 1 hour)
    await this.cache.set(cacheKey, user, 3600);

    return user;
  }
}
```

**Best For**: Read-heavy data, user profiles, organization settings

---

### 2. Write-Through Cache

**Strategy**: Write to cache and database simultaneously.

```typescript
// apps/api/src/application/user/commands/update-user.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateUserCommand } from './update-user.command';

@CommandHandler(UpdateUserCommand)
export class UpdateUserHandler implements ICommandHandler<UpdateUserCommand> {
  constructor(
    private readonly cache: RedisCacheService,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(command: UpdateUserCommand) {
    const { userId, data } = command;

    // 1. Update database
    const user = await this.userRepository.update(userId, data);

    // 2. Update cache immediately
    const cacheKey = `user:${userId}`;
    await this.cache.set(cacheKey, user, 3600);

    return user;
  }
}
```

**Best For**: Data that must be immediately consistent, frequently read after write

---

### 3. Write-Behind (Write-Back) Cache

**Strategy**: Write to cache immediately, asynchronously write to database.

```typescript
// apps/api/src/application/analytics/commands/track-event.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@CommandHandler(TrackEventCommand)
export class TrackEventHandler implements ICommandHandler<TrackEventCommand> {
  constructor(
    private readonly cache: RedisCacheService,
    @InjectQueue('analytics') private analyticsQueue: Queue,
  ) {}

  async execute(command: TrackEventCommand) {
    const { userId, eventType, metadata } = command;
    const cacheKey = `analytics:${userId}:${eventType}`;

    // 1. Increment counter in cache (fast)
    await this.cache.client.incr(cacheKey);

    // 2. Queue database write (asynchronous)
    await this.analyticsQueue.add('persist-event', {
      userId,
      eventType,
      metadata,
      timestamp: new Date(),
    });

    return { success: true };
  }
}
```

**Best For**: High-throughput writes, analytics, logging

---

### 4. Read-Through Cache

**Strategy**: Cache acts as intermediary, loading from database automatically on miss.

```typescript
// apps/api/src/infrastructure/cache/cache-proxy.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class CacheProxyService {
  constructor(private readonly cache: RedisCacheService) {}

  async getOrLoad<T>(
    key: string,
    loader: () => Promise<T>,
    ttl: number,
  ): Promise<T> {
    // Check cache
    const cached = await this.cache.get<T>(key);
    if (cached) return cached;

    // Cache miss - load from source
    const value = await loader();

    // Store in cache
    await this.cache.set(key, value, ttl);

    return value;
  }
}

// Usage in query handler
async execute(query: GetProjectQuery) {
  return this.cacheProxy.getOrLoad(
    `project:${query.projectId}`,
    () => this.projectRepository.findById(query.projectId),
    3600,
  );
}
```

**Best For**: Simplifying cache logic, consistent caching behavior

---

## Cache Invalidation Strategies

> "There are only two hard things in Computer Science: cache invalidation and naming things." - Phil Karlton

### 1. Time-Based Expiration (TTL)

```typescript
// Different TTLs for different data types
const CACHE_TTL = {
  USER_PROFILE: 3600, // 1 hour
  ORGANIZATION: 7200, // 2 hours
  PROJECT: 1800, // 30 minutes
  TIME_ENTRY: 300, // 5 minutes
  STATIC_DATA: 86400, // 24 hours
  COMPUTED_REPORT: 600, // 10 minutes
} as const;

await this.cache.set(`user:${userId}`, user, CACHE_TTL.USER_PROFILE);
```

**Pros**: Simple, automatic cleanup
**Cons**: Data may be stale before expiration

---

### 2. Event-Based Invalidation

```typescript
// apps/api/src/application/user/events/user-updated.handler.ts
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { UserUpdatedEvent } from '@/domain/user/user.events';

@EventsHandler(UserUpdatedEvent)
export class UserUpdatedHandler implements IEventHandler<UserUpdatedEvent> {
  constructor(private readonly cache: RedisCacheService) {}

  async handle(event: UserUpdatedEvent) {
    const { userId } = event;

    // Invalidate user cache
    await this.cache.delete(`user:${userId}`);

    // Invalidate related caches
    await this.cache.deletePattern(`user:${userId}:*`);
    await this.cache.deletePattern(`organization:*:members`);
  }
}
```

**Pros**: Data always fresh, precise control
**Cons**: Complex to implement, risk of missing invalidations

---

### 3. Tag-Based Invalidation

```typescript
// apps/api/src/infrastructure/cache/tagged-cache.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class TaggedCacheService {
  constructor(private readonly cache: RedisCacheService) {}

  async set(key: string, value: any, ttl: number, tags: string[]): Promise<void> {
    // Store value
    await this.cache.set(key, value, ttl);

    // Store key in tag sets
    for (const tag of tags) {
      await this.cache.client.sadd(`tag:${tag}`, key);
    }
  }

  async invalidateTag(tag: string): Promise<void> {
    // Get all keys with this tag
    const keys = await this.cache.client.smembers(`tag:${tag}`);

    // Delete all keys
    if (keys.length > 0) {
      await this.cache.client.del(...keys);
    }

    // Delete tag set
    await this.cache.client.del(`tag:${tag}`);
  }
}

// Usage
await taggedCache.set(`project:${projectId}`, project, 3600, [
  'project',
  `org:${orgId}`,
  `client:${clientId}`,
]);

// Invalidate all caches for an organization
await taggedCache.invalidateTag(`org:${orgId}`);
```

**Pros**: Flexible, group invalidation
**Cons**: More complex, additional storage

---

### 4. Version-Based Invalidation

```typescript
// apps/api/src/infrastructure/cache/versioned-cache.service.ts
@Injectable()
export class VersionedCacheService {
  constructor(private readonly cache: RedisCacheService) {}

  async set(key: string, value: any, ttl: number): Promise<void> {
    const version = await this.getVersion(key);
    const versionedKey = `${key}:v${version}`;
    await this.cache.set(versionedKey, value, ttl);
  }

  async get<T>(key: string): Promise<T | null> {
    const version = await this.getVersion(key);
    const versionedKey = `${key}:v${version}`;
    return this.cache.get<T>(versionedKey);
  }

  async invalidate(key: string): Promise<void> {
    // Increment version (old version becomes invalid)
    await this.cache.client.incr(`${key}:version`);
  }

  private async getVersion(key: string): Promise<number> {
    const version = await this.cache.client.get(`${key}:version`);
    return version ? parseInt(version) : 1;
  }
}
```

**Pros**: No need to delete old data, atomic updates
**Cons**: Old versions consume memory until TTL expires

---

## TTL and Eviction Policies

### TTL Recommendations by Data Type

| Data Type             | TTL              | Rationale                                       |
| --------------------- | ---------------- | ----------------------------------------------- |
| User Profile          | 1 hour           | Changes infrequently, important for performance |
| Organization Settings | 2 hours          | Rarely changes, critical for multi-tenancy      |
| Project List          | 30 minutes       | Moderate change frequency                       |
| Time Entries          | 5 minutes        | Changes frequently during workday               |
| Static Reference Data | 24 hours         | Almost never changes                            |
| Computed Reports      | 10 minutes       | Expensive to generate, acceptable staleness     |
| Permission Checks     | 15 minutes       | Balance security with performance               |
| Session Data          | Session lifetime | Tied to user session                            |

### Redis Eviction Policies

```typescript
// Configure in Redis
// redis.conf or docker-compose.yml

// Recommended for WellPulse (LRU for all keys with TTL)
maxmemory-policy: allkeys-lru

// Alternative policies:
// - volatile-lru: Evict least recently used keys with TTL
// - allkeys-lfu: Evict least frequently used keys
// - volatile-ttl: Evict keys with shortest TTL first
```

**LRU (Least Recently Used)**: Best for general caching
**LFU (Least Frequently Used)**: Best for skewed access patterns
**TTL**: Best for time-sensitive data

---

## Multi-Level Caching

Combine in-memory and Redis for optimal performance.

```typescript
// apps/api/src/infrastructure/cache/multi-level-cache.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class MultiLevelCacheService {
  constructor(
    private readonly l1Cache: MemoryCacheService, // Fast, local
    private readonly l2Cache: RedisCacheService, // Distributed
  ) {}

  async get<T>(key: string): Promise<T | null> {
    // Check L1 (in-memory) first
    const l1Value = this.l1Cache.get<T>(key);
    if (l1Value) return l1Value;

    // L1 miss - check L2 (Redis)
    const l2Value = await this.l2Cache.get<T>(key);
    if (l2Value) {
      // Promote to L1 for faster future access
      this.l1Cache.set(key, l2Value, 300); // 5 min L1 TTL
      return l2Value;
    }

    // Complete miss
    return null;
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    // Write to both levels
    this.l1Cache.set(key, value, Math.min(ttl, 300)); // Max 5 min L1
    await this.l2Cache.set(key, value, ttl);
  }

  async delete(key: string): Promise<void> {
    // Invalidate both levels
    this.l1Cache.delete(key);
    await this.l2Cache.delete(key);
  }
}
```

**Benefits**:

- ⚡ Ultra-fast L1 hits (no network)
- 🔄 Shared L2 across instances
- 📊 ~90% hit rate on L1, ~95% on L2

---

## Cache Warming

Pre-populate cache with frequently accessed data.

```typescript
// apps/api/src/infrastructure/cache/cache-warmer.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CacheWarmerService implements OnModuleInit {
  constructor(
    private readonly cache: RedisCacheService,
    private readonly organizationRepository: OrganizationRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async onModuleInit() {
    // Warm cache on startup
    await this.warmCache();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async warmCache() {
    console.log('Warming cache...');

    // Warm organization data (most accessed)
    const organizations = await this.organizationRepository.findAll();
    for (const org of organizations) {
      await this.cache.set(`org:${org.id}`, org, 7200);
    }

    // Warm active users (logged in within 24 hours)
    const activeUsers = await this.userRepository.findActive();
    for (const user of activeUsers) {
      await this.cache.set(`user:${user.id}`, user, 3600);
    }

    console.log(`Cache warmed: ${organizations.length} orgs, ${activeUsers.length} users`);
  }
}
```

**When to Use**:

- Application startup
- Off-peak hours (nightly)
- After cache flush
- Before expected traffic spike

---

## NestJS Implementation

### Cache Module Setup

```typescript
// apps/api/src/infrastructure/cache/cache.module.ts
import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { RedisCacheService } from './redis-cache.service';
import { MemoryCacheService } from './memory-cache.service';
import { MultiLevelCacheService } from './multi-level-cache.service';
import { TaggedCacheService } from './tagged-cache.service';
import { CacheWarmerService } from './cache-warmer.service';

@Global()
@Module({
  imports: [
    NestCacheModule.register({
      isGlobal: true,
      store: redisStore,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      ttl: 600, // Default 10 minutes
    }),
  ],
  providers: [
    RedisCacheService,
    MemoryCacheService,
    MultiLevelCacheService,
    TaggedCacheService,
    CacheWarmerService,
  ],
  exports: [RedisCacheService, MemoryCacheService, MultiLevelCacheService, TaggedCacheService],
})
export class CacheModule {}
```

### Cache Interceptor

```typescript
// apps/api/src/shared/interceptors/cache.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisCacheService } from '@/infrastructure/cache/redis-cache.service';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    private readonly cache: RedisCacheService,
    private readonly ttl: number = 300,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const cacheKey = this.getCacheKey(request);

    // Check cache
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return of(cached);
    }

    // Execute handler and cache result
    return next.handle().pipe(
      tap(async (response) => {
        await this.cache.set(cacheKey, response, this.ttl);
      }),
    );
  }

  private getCacheKey(request: any): string {
    const { method, url, user } = request;
    const userId = user?.userId || 'anonymous';
    return `http:${method}:${url}:${userId}`;
  }
}

// Usage in controller
@Get(':id')
@UseInterceptors(new CacheInterceptor(300)) // 5 min cache
async findOne(@Param('id') id: string) {
  return this.queryBus.execute(new GetProjectQuery(id));
}
```

---

## Frontend Caching with React Query

React Query provides automatic caching for API requests.

```typescript
// apps/web/hooks/use-projects.ts
import { useQuery } from '@tanstack/react-query';
import { projectRepository } from '@/lib/repositories/project.repository';

export const useProjects = (organizationId: string) => {
  return useQuery({
    queryKey: ['projects', organizationId],
    queryFn: () => projectRepository.findByOrganization(organizationId),
    staleTime: 5 * 60 * 1000, // 5 minutes (data considered fresh)
    cacheTime: 10 * 60 * 1000, // 10 minutes (keep in cache)
    refetchOnWindowFocus: true, // Refetch when tab gains focus
    refetchOnReconnect: true, // Refetch on network reconnect
  });
};

// Invalidate cache after mutation
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: projectRepository.create,
    onSuccess: (newProject) => {
      // Invalidate project list cache
      queryClient.invalidateQueries(['projects']);

      // Optimistically add to cache
      queryClient.setQueryData(['projects', newProject.organizationId], (old: Project[] = []) => [
        ...old,
        newProject,
      ]);
    },
  });
};
```

**React Query Cache Configuration**:

- `staleTime`: How long data is considered fresh (no refetch)
- `cacheTime`: How long unused data stays in cache
- `refetchOnWindowFocus`: Auto-refresh when user returns to tab
- `refetchOnReconnect`: Auto-refresh when network reconnects

---

## Monitoring and Metrics

### Cache Performance Metrics

```typescript
// apps/api/src/infrastructure/cache/monitored-cache.service.ts
import { Injectable } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';

@Injectable()
export class MonitoredCacheService {
  private hitCounter = new Counter({
    name: 'cache_hits_total',
    help: 'Total cache hits',
    labelNames: ['cache_type', 'key_prefix'],
  });

  private missCounter = new Counter({
    name: 'cache_misses_total',
    help: 'Total cache misses',
    labelNames: ['cache_type', 'key_prefix'],
  });

  private latencyHistogram = new Histogram({
    name: 'cache_operation_duration_seconds',
    help: 'Cache operation latency',
    labelNames: ['operation', 'cache_type'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
  });

  constructor(private readonly cache: RedisCacheService) {}

  async get<T>(key: string): Promise<T | null> {
    const start = Date.now();
    const keyPrefix = key.split(':')[0];

    try {
      const value = await this.cache.get<T>(key);

      if (value) {
        this.hitCounter.inc({ cache_type: 'redis', key_prefix: keyPrefix });
      } else {
        this.missCounter.inc({ cache_type: 'redis', key_prefix: keyPrefix });
      }

      return value;
    } finally {
      const duration = (Date.now() - start) / 1000;
      this.latencyHistogram.observe({ operation: 'get', cache_type: 'redis' }, duration);
    }
  }

  async getHitRate(keyPrefix?: string): Promise<number> {
    const hits = await this.hitCounter.get();
    const misses = await this.missCounter.get();

    const totalHits = this.sumMetric(hits, keyPrefix);
    const totalMisses = this.sumMetric(misses, keyPrefix);

    if (totalHits + totalMisses === 0) return 0;
    return totalHits / (totalHits + totalMisses);
  }

  private sumMetric(metric: any, prefix?: string): number {
    return metric.values
      .filter((v: any) => !prefix || v.labels.key_prefix === prefix)
      .reduce((sum: number, v: any) => sum + v.value, 0);
  }
}
```

### Key Metrics to Track

| Metric            | Target                            | Action if Below Target                           |
| ----------------- | --------------------------------- | ------------------------------------------------ |
| **Hit Rate**      | >80%                              | Increase TTL, warm cache, fix invalidation bugs  |
| **P95 Latency**   | <10ms (in-memory)<br><5ms (Redis) | Check network, optimize serialization            |
| **Memory Usage**  | <80% max memory                   | Reduce TTL, increase max memory, eviction policy |
| **Eviction Rate** | <5% of total ops                  | Increase cache size, reduce dataset              |

---

## Best Practices

### ✅ DO

1. **Use appropriate TTLs** - Balance freshness vs performance

   ```typescript
   const TTL = {
     CRITICAL: 60, // 1 minute
     NORMAL: 300, // 5 minutes
     LONG: 3600, // 1 hour
   };
   ```

2. **Implement cache-aside for reads** - Simple, effective pattern

   ```typescript
   const value = (await cache.get(key)) || (await loadFromDB(key));
   ```

3. **Invalidate on writes** - Keep data consistent

   ```typescript
   await repository.update(id, data);
   await cache.delete(`entity:${id}`);
   ```

4. **Use structured cache keys** - Namespace by entity type

   ```typescript
   `user:${userId}:profile``org:${orgId}:settings``project:${projectId}:members`;
   ```

5. **Monitor cache performance** - Track hit rate, latency, memory

   ```typescript
   const hitRate = await monitoredCache.getHitRate('user');
   console.log(`User cache hit rate: ${hitRate * 100}%`);
   ```

6. **Serialize consistently** - Use JSON for simple data

   ```typescript
   await cache.set(key, JSON.stringify(value));
   const value = JSON.parse(await cache.get(key));
   ```

7. **Handle cache failures gracefully** - Don't crash on cache errors

   ```typescript
   try {
     return await cache.get(key);
   } catch (error) {
     logger.error('Cache error', error);
     return loadFromDB(key); // Fallback to database
   }
   ```

8. **Use multi-level caching** - L1 (in-memory) + L2 (Redis)
   ```typescript
   const value = l1.get(key) || (await l2.get(key)) || (await loadFromDB(key));
   ```

---

### ❌ DON'T

1. **Don't cache everything** - Only cache frequently accessed data

   ```typescript
   // ❌ Bad: Caching one-time use data
   await cache.set(`report:${reportId}`, report, 3600);

   // ✅ Good: Only cache if accessed multiple times
   if (await cache.exists(`report:${reportId}:access-count`)) {
     await cache.set(`report:${reportId}`, report, 3600);
   }
   ```

2. **Don't use unbounded cache keys** - Avoid memory leaks

   ```typescript
   // ❌ Bad: Unbounded keys
   await cache.set(`search:${query}`, results);

   // ✅ Good: Hash long keys, limit with TTL
   const keyHash = hashFn(query);
   await cache.set(`search:${keyHash}`, results, 300);
   ```

3. **Don't ignore cache stampede** - Multiple requests for same key

   ```typescript
   // ❌ Bad: All requests hit DB on cache miss
   const value = (await cache.get(key)) || (await expensiveQuery());

   // ✅ Good: Use locking to prevent stampede
   const value = await cacheProxy.getOrLoad(key, expensiveQuery, 300);
   ```

4. **Don't cache sensitive data** - Risk of data leakage

   ```typescript
   // ❌ Bad: Caching passwords, tokens
   await cache.set(`user:${userId}:password`, hashedPassword);

   // ✅ Good: Never cache credentials
   // Store in database only, use short-lived tokens
   ```

5. **Don't forget to version cached data** - Schema changes break cache

   ```typescript
   // ❌ Bad: No versioning
   await cache.set(`user:${userId}`, user);

   // ✅ Good: Include schema version
   await cache.set(`user:v2:${userId}`, user);
   ```

6. **Don't use cache as primary storage** - Cache can be cleared

   ```typescript
   // ❌ Bad: Only storing in cache
   await cache.set(key, value);

   // ✅ Good: Database is source of truth
   await repository.save(value);
   await cache.set(key, value);
   ```

---

## Anti-Patterns

### 1. Cache Stampede

**Problem**: Many requests fetch same missing key simultaneously.

```typescript
// ❌ Anti-pattern
async getUser(userId: string) {
  const cached = await cache.get(`user:${userId}`);
  if (cached) return cached;

  // 100 concurrent requests all hit this line at once
  const user = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
  await cache.set(`user:${userId}`, user, 3600);
  return user;
}

// ✅ Solution: Request coalescing
import { AsyncLocalStorage } from 'async_hooks';

private inflightRequests = new Map<string, Promise<any>>();

async getUser(userId: string) {
  const cacheKey = `user:${userId}`;

  // Check cache
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  // Check if request is already in-flight
  if (this.inflightRequests.has(cacheKey)) {
    return this.inflightRequests.get(cacheKey);
  }

  // Start new request
  const promise = this.loadUser(userId).finally(() => {
    this.inflightRequests.delete(cacheKey);
  });

  this.inflightRequests.set(cacheKey, promise);
  return promise;
}
```

---

### 2. Stale Data Syndrome

**Problem**: Cache invalidation missed, serving stale data indefinitely.

```typescript
// ❌ Anti-pattern: Forgot to invalidate
async updateUser(userId: string, data: UpdateUserDto) {
  await this.userRepository.update(userId, data);
  // ❌ Forgot to invalidate cache!
  return { success: true };
}

// ✅ Solution: Event-driven invalidation
async updateUser(userId: string, data: UpdateUserDto) {
  const user = await this.userRepository.update(userId, data);

  // Invalidate cache
  await this.cache.delete(`user:${userId}`);

  // Publish event for other caches
  await this.eventBus.publish(new UserUpdatedEvent(userId));

  return user;
}
```

---

### 3. Cache Key Collision

**Problem**: Different data shares same cache key.

```typescript
// ❌ Anti-pattern: Ambiguous keys
await cache.set('project', project1); // Which project?
await cache.set(`data:${id}`, data); // What type of data?

// ✅ Solution: Structured, namespaced keys
await cache.set(`project:${projectId}`, project);
await cache.set(`user:${userId}:profile`, profile);
await cache.set(`org:${orgId}:members:${memberId}`, member);
```

---

### 4. Over-caching

**Problem**: Caching infrequently accessed data wastes memory.

```typescript
// ❌ Anti-pattern: Cache everything
async findAll() {
  const projects = await this.projectRepository.findAll(); // 10,000 projects
  for (const project of projects) {
    await cache.set(`project:${project.id}`, project, 3600); // Most never accessed
  }
  return projects;
}

// ✅ Solution: Cache on demand (cache-aside)
async findById(id: string) {
  const cached = await cache.get(`project:${id}`);
  if (cached) return cached;

  const project = await this.projectRepository.findById(id);
  await cache.set(`project:${id}`, project, 3600);
  return project;
}
```

---

## Related Patterns

- **Pattern 05: CQRS Pattern** - Cache queries separately from commands
- **Pattern 06: Repository Pattern** - Integrate caching into repository layer
- **Pattern 13: Circuit Breaker Pattern** - Handle cache service failures
- **Pattern 45: Background Job Patterns** - Use write-behind caching with job queues
- **Pattern 41: REST API Best Practices** - HTTP caching headers (ETag, Cache-Control)

---

## References

### Documentation

- [Redis Documentation](https://redis.io/docs/)
- [NestJS Caching](https://docs.nestjs.com/techniques/caching)
- [React Query Caching](https://tanstack.com/query/latest/docs/react/guides/caching)
- [cache-manager](https://github.com/node-cache-manager/node-cache-manager)

### Books & Articles

- **"Caching at Scale"** - Scaling caching strategies for high-traffic applications
- **"Redis in Action"** - Comprehensive guide to Redis patterns
- **"Web Scalability for Startup Engineers"** - Practical caching strategies

### Tools

- **Redis** - In-memory data store
- **Memcached** - Alternative distributed cache
- **Dragonfly** - Modern Redis alternative (faster, more memory-efficient)
- **RedisInsight** - Redis GUI for debugging cache data

---

## Summary

**Caching Strategy Patterns** provide performance optimization through intelligent data storage:

✅ **Use cache-aside for reads** - Check cache first, load from DB on miss
✅ **Use write-through for consistency** - Update cache and DB simultaneously
✅ **Invalidate on writes** - Event-driven cache invalidation
✅ **Monitor cache metrics** - Track hit rate, latency, memory usage
✅ **Use multi-level caching** - Combine in-memory (L1) and Redis (L2)
✅ **Set appropriate TTLs** - Balance freshness vs performance
✅ **Handle failures gracefully** - Always fall back to database

**Remember**: Caching is an optimization, not a requirement. Start simple (cache-aside), measure performance, then optimize based on metrics.

---

**Next Steps**:

1. Set up Redis for distributed caching
2. Implement cache-aside pattern in repositories
3. Add event-driven cache invalidation
4. Monitor cache hit rates and optimize TTLs
5. Consider multi-level caching for critical paths
