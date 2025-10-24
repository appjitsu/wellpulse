import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { HealthModule } from './presentation/health/health.module';
import { TenantsModule } from './presentation/tenants/tenants.module';
import { AuthModule } from './presentation/auth/auth.module';
import { UsersModule } from './presentation/users/users.module';
import { WellsModule } from './presentation/wells/wells.module';
import { TenantResolverMiddleware } from './infrastructure/middleware/tenant-resolver.middleware';

@Module({
  imports: [
    // Configuration module (loads .env files)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting - global configuration
    // Default: 10 requests per second per IP
    // Auth endpoints have custom overrides (see auth.controller.ts)
    ThrottlerModule.forRoot([
      {
        ttl: 1000, // Time window in milliseconds (1 second)
        limit: 10, // Max requests in time window
      },
    ]),

    // Health check module
    HealthModule,

    // Tenants module (admin portal + provides TenantRepository for middleware)
    TenantsModule,

    // Auth module (authentication and user management)
    AuthModule,

    // Users module (user management for admins)
    UsersModule,

    // Wells module (EXAMPLE - demonstrates tenant-scoped routing)
    WellsModule,
  ],
  providers: [
    // Apply throttler guard globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply tenant resolver to all routes except:
    // - /health (health checks don't need tenant context)
    // - /tenants (admin portal - manages tenants, not tenant-scoped)
    // Auth endpoints DO require tenant context (via subdomain or X-Tenant-Subdomain header)
    consumer
      .apply(TenantResolverMiddleware)
      .exclude(
        { path: '/health', method: RequestMethod.ALL },
        { path: '/health/(.*)', method: RequestMethod.ALL },
        { path: '/tenants', method: RequestMethod.ALL },
        { path: '/tenants/(.*)', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
