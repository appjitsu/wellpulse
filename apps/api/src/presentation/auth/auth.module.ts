/**
 * Auth Module
 *
 * Wires together authentication controller, command handlers, and services.
 *
 * Provides:
 * - Authentication endpoints (register, login, logout, refresh)
 * - Email verification
 * - Password reset
 *
 * Dependencies:
 * - EmailService (for verification and password reset emails)
 * - UserRepository (for user persistence)
 * - JwtService (for token generation)
 */

import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { EmailService } from '../../infrastructure/services/email.service';
import { UserRepository } from '../../infrastructure/database/repositories/user.repository';
import { TenantRepository } from '../../infrastructure/database/repositories/tenant.repository';
import { TenantDatabaseService } from '../../infrastructure/database/tenant-database.service';
import { RegisterUserHandler } from '../../application/auth/commands/register-user.command';
import { VerifyEmailHandler } from '../../application/auth/commands/verify-email.command';
import { LoginHandler } from '../../application/auth/commands/login.command';
import { RefreshTokenHandler } from '../../application/auth/commands/refresh-token.command';
import { ForgotPasswordHandler } from '../../application/auth/commands/forgot-password.command';
import { ResetPasswordHandler } from '../../application/auth/commands/reset-password.command';
import { LoginAzureAdHandler } from '../../application/auth/commands/login-azure-ad.command';
import { JwtStrategy } from '../../infrastructure/auth/strategies/jwt.strategy';
import { AzureAdStrategy } from '../../infrastructure/auth/strategies/azure-ad.strategy';
import { AzureAdRoleMapping } from '../../infrastructure/auth/azure-ad-role-mapping';
import { TokenBlacklistService } from '../../infrastructure/services/token-blacklist.service';

// Command handlers
const CommandHandlers = [
  RegisterUserHandler,
  VerifyEmailHandler,
  LoginHandler,
  RefreshTokenHandler,
  ForgotPasswordHandler,
  ResetPasswordHandler,
  LoginAzureAdHandler,
];

@Module({
  imports: [
    CqrsModule,
    PassportModule,
    // Rate limiting for auth endpoints
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 1 minute in milliseconds
        limit: 10, // 10 requests per minute (default)
      },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET is not configured');
        }
        return {
          secret,
          signOptions: {
            expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '7d',
          },
        } as JwtModuleOptions;
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    // Services
    EmailService,
    TenantDatabaseService,
    AzureAdRoleMapping,
    TokenBlacklistService,

    // Repositories
    UserRepository,
    {
      provide: 'IUserRepository',
      useExisting: UserRepository,
    },
    TenantRepository,
    {
      provide: 'ITenantRepository',
      useExisting: TenantRepository,
    },

    // Strategies
    JwtStrategy,
    AzureAdStrategy,

    // Command handlers
    ...CommandHandlers,
  ],
  exports: [
    UserRepository,
    'IUserRepository',
    JwtModule,
    EmailService,
    TokenBlacklistService,
  ],
})
export class AuthModule {}
