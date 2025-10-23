import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './presentation/health/health.module';
import { TenantsModule } from './presentation/tenants/tenants.module';
import { WellsModule } from './presentation/wells/wells.module';
import { TenantResolverMiddleware } from './infrastructure/middleware/tenant-resolver.middleware';

@Module({
  imports: [
    // Configuration module (loads .env files)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Health check module
    HealthModule,

    // Tenants module (admin portal + provides TenantRepository for middleware)
    TenantsModule,

    // Wells module (EXAMPLE - demonstrates tenant-scoped routing)
    WellsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply tenant resolver to all routes except:
    // - /health (health checks don't need tenant context)
    // - /tenants (admin portal - manages tenants, not tenant-scoped)
    consumer
      .apply(TenantResolverMiddleware)
      .exclude('/health', '/health/(.*)', '/tenants', '/tenants/(.*)')
      .forRoutes('*');
  }
}
