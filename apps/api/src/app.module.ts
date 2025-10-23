import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './presentation/health/health.module';
import { TenantsModule } from './presentation/tenants/tenants.module';

@Module({
  imports: [
    // Configuration module (loads .env files)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Health check module
    HealthModule,

    // Tenants module (admin portal)
    TenantsModule,
  ],
})
export class AppModule {}
