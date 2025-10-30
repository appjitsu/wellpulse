import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { HealthModule } from './presentation/health/health.module';
import { TenantsModule } from './presentation/tenants/tenants.module';
import { AuthModule } from './presentation/auth/auth.module';
import { UsersModule } from './presentation/users/users.module';
import { WellsModule } from './presentation/wells/wells.module';
import { MetricsModule } from './presentation/metrics/metrics.module';
import { AdminModule } from './presentation/admin/admin.module';
import { FieldDataModule } from './presentation/field-data/field-data.module';
import { SyncModule } from './presentation/sync/sync.module';
import { ProductionModule } from './presentation/production/production.module';
import { DashboardModule } from './presentation/dashboard/dashboard.module';
import { NominalRangesModule } from './presentation/nominal-ranges/nominal-ranges.module';
import { AlertsModule } from './presentation/alerts/alerts.module';
import { TenantResolverMiddleware } from './infrastructure/middleware/tenant-resolver.middleware';
import { RedisThrottlerStorage } from './infrastructure/throttle/redis-throttler-storage';
import { DatabaseModule } from './infrastructure/database/database.module';
import { MonitoringModule } from './infrastructure/monitoring/monitoring.module';
import { GlobalExceptionFilter } from './infrastructure/filters/global-exception.filter';
import { FeatureFlagsModule } from './application/feature-flags/feature-flags.module';
import { EventsModule } from './infrastructure/events/events.module';
import { JwtBlacklistGuard } from './presentation/guards/jwt-blacklist.guard';

@Module({
  imports: [
    // Configuration module (loads .env files)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Database module (provides TenantDatabaseService globally)
    DatabaseModule,

    // Events module (domain events and audit logging)
    EventsModule,

    // Rate limiting - Redis-backed distributed storage
    // Default: 10 requests per second per IP
    // Auth endpoints have custom overrides (see auth.controller.ts)
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: 1000, // Time window in milliseconds (1 second)
            limit: 10, // Max requests in time window
          },
        ],
        storage: new RedisThrottlerStorage(configService),
      }),
    }),

    // Health check module
    HealthModule,

    // Metrics module (Prometheus metrics endpoint)
    MetricsModule,

    // Tenants module (admin portal + provides TenantRepository for middleware)
    TenantsModule,

    // Auth module (authentication and user management)
    AuthModule,

    // Users module (user management for admins)
    UsersModule,

    // Wells module (EXAMPLE - demonstrates tenant-scoped routing)
    WellsModule,

    // Field data module (production, inspection, maintenance entries)
    FieldDataModule,

    // Sync module (offline data synchronization for Electron/mobile apps)
    SyncModule,

    // Production module (production analytics and reporting)
    ProductionModule,

    // Dashboard module (dashboard analytics endpoints)
    DashboardModule,

    // Nominal Ranges module (Sprint 4 MVP - anomaly detection)
    NominalRangesModule,

    // Alerts module (Sprint 4 MVP - alert notifications)
    AlertsModule,

    // Admin module (admin portal - cross-tenant user/tenant management)
    AdminModule,

    // Feature Flags module (tier-based feature access control)
    FeatureFlagsModule,

    // Monitoring module (Prometheus metrics) - MUST be last so interceptor can access providers
    MonitoringModule,
  ],
  providers: [
    // Apply throttler guard globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Apply JWT blacklist guard globally (checks for revoked tokens)
    {
      provide: APP_GUARD,
      useClass: JwtBlacklistGuard,
    },
    // Apply global exception filter for standardized error handling
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // Note: HTTP metrics interceptor is registered in MonitoringModule
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply tenant resolver to all routes except:
    // - /health (health checks don't need tenant context)
    // - /metrics (Prometheus metrics endpoint - global monitoring)
    // - /tenants (admin portal - manages tenants, not tenant-scoped)
    // - /admin/* (admin portal - cross-tenant management)
    // Auth endpoints DO require tenant context (via subdomain or X-Tenant-Subdomain header)
    consumer
      .apply(TenantResolverMiddleware)
      .exclude(
        { path: '/health', method: RequestMethod.ALL },
        { path: '/health/(.*)', method: RequestMethod.ALL },
        { path: '/metrics', method: RequestMethod.ALL },
        { path: '/tenants', method: RequestMethod.ALL },
        { path: '/tenants/(.*)', method: RequestMethod.ALL },
        { path: '/admin', method: RequestMethod.ALL },
        { path: '/admin/(.*)', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
