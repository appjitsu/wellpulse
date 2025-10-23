# Security Patterns for API and Web Applications

## Overview

Security is not an afterthought - it's a foundational aspect of the WellPulse application that must be integrated into every layer of the architecture. This guide provides comprehensive security patterns for both the NestJS backend (API) and Next.js frontend (Web) applications.

### Purpose

- **Protect User Data** - Ensure confidentiality, integrity, and availability of sensitive information
- **Prevent Common Attacks** - XSS, CSRF, SQL injection, authentication bypass
- **Ensure Compliance** - SOC 2, GDPR, data retention requirements
- **Build Trust** - Demonstrate security best practices to clients
- **Enable Auditing** - Track all security-relevant actions

### When to Apply Security Patterns

**Always**. Security patterns must be applied from day one and continuously maintained throughout the application lifecycle. Every feature, every endpoint, every component must consider security implications.

### Relationship to Other Patterns

Security patterns integrate with:

- **Hexagonal Architecture** - Security concerns in infrastructure layer
- **CQRS** - Authorization checks in command handlers
- **Repository Pattern** - Parameterized queries prevent SQL injection
- **DTO Pattern** - Input validation at boundaries
- **Domain Events** - Audit logging through event handlers
- **Observer Pattern** - Security event notifications
- **Soft Delete Pattern** - Data retention for compliance

---

## Backend Security Patterns (NestJS)

### 1. Authentication & Authorization

#### 1.1 Password Hashing Pattern

**Problem**: Storing passwords in plain text or using weak hashing algorithms puts user credentials at risk.

**Solution**: Use bcrypt with cost factor 12 to hash passwords before storage.

**Implementation**:

```typescript
// apps/api/src/domain/user/hashed-password.vo.ts
import * as bcrypt from 'bcrypt';

/**
 * HashedPassword Value Object
 * Encapsulates password hashing and verification logic
 */
export class HashedPassword {
  private readonly hash: string;
  private static readonly SALT_ROUNDS = 12;

  private constructor(hash: string) {
    this.hash = hash;
  }

  /**
   * Create HashedPassword from plain text
   * Validates password strength before hashing
   */
  static async fromPlainText(password: string): Promise<HashedPassword> {
    // Validate password strength
    this.validateStrength(password);

    // Hash with bcrypt (cost 12)
    const hash = await bcrypt.hash(password, HashedPassword.SALT_ROUNDS);
    return new HashedPassword(hash);
  }

  /**
   * Create HashedPassword from existing hash
   * Used when loading from database
   */
  static fromHash(hash: string): HashedPassword {
    if (!hash) {
      throw new Error('Hash cannot be empty');
    }
    return new HashedPassword(hash);
  }

  /**
   * Verify plain text password against hash
   */
  async verify(plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, this.hash);
  }

  /**
   * Validate password strength requirements
   */
  private static validateStrength(password: string): void {
    if (password.length < 8) {
      throw new WeakPasswordException('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      throw new WeakPasswordException('Password must contain an uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      throw new WeakPasswordException('Password must contain a lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      throw new WeakPasswordException('Password must contain a number');
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      throw new WeakPasswordException('Password must contain a special character');
    }
  }

  getHash(): string {
    return this.hash;
  }
}

// Custom exception
export class WeakPasswordException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WeakPasswordException';
  }
}
```

**Password Strength Requirements**:

- Minimum 8 characters
- At least 1 uppercase letter (A-Z)
- At least 1 lowercase letter (a-z)
- At least 1 number (0-9)
- At least 1 special character (!@#$%^&\*)

**Optional Enhancements**:

- Check against leaked password databases (HaveIBeenPwned API)
- Prevent common passwords ("password123", "qwerty")
- Prevent passwords containing username/email

---

#### 1.2 JWT Token Pattern (Access + Refresh)

**Problem**: Long-lived tokens increase security risk. If compromised, attacker has prolonged access.

**Solution**: Use short-lived access tokens (15 min) + long-lived refresh tokens (7 days).

**Access Token Implementation**:

```typescript
// apps/api/src/application/auth/services/jwt.service.ts
import { Injectable } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '@/domain/user/user.entity';

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtService {
  constructor(
    private readonly jwtService: NestJwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Sign access token (short-lived)
   */
  signAccessToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.id.value,
      email: user.email.value,
      role: user.role,
      type: 'access',
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '15m', // Short-lived
    });
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): JwtPayload {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Verify token type
      if (payload.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
```

**Refresh Token Implementation**:

```typescript
// apps/api/src/domain/auth/refresh-token.entity.ts
import * as crypto from 'crypto';
import { AggregateRoot } from '@/domain/shared/aggregate-root';
import { RefreshTokenId } from './refresh-token-id.vo';
import { UserId } from '@/domain/user/user-id.vo';
import { RefreshTokenRevokedEvent } from './events/refresh-token-revoked.event';

/**
 * RefreshToken Aggregate Root
 * Long-lived token stored in database for token rotation
 */
export class RefreshToken extends AggregateRoot {
  private constructor(
    public readonly id: RefreshTokenId,
    public readonly userId: UserId,
    public readonly token: string,
    public readonly expiresAt: Date,
    public revokedAt: Date | null,
    public readonly createdAt: Date,
  ) {
    super();
  }

  /**
   * Create new refresh token
   * Generates cryptographically secure random token
   */
  static create(userId: UserId): RefreshToken {
    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    return new RefreshToken(RefreshTokenId.create(), userId, token, expiresAt, null, new Date());
  }

  /**
   * Check if token is valid (not expired, not revoked)
   */
  isValid(): boolean {
    return !this.revokedAt && this.expiresAt > new Date();
  }

  /**
   * Revoke token (e.g., on logout)
   */
  revoke(): void {
    this.revokedAt = new Date();
    this.addDomainEvent(new RefreshTokenRevokedEvent(this.id, this.userId));
  }

  /**
   * Check if token is expired
   */
  isExpired(): boolean {
    return this.expiresAt <= new Date();
  }
}
```

**Controller Implementation**:

```typescript
// apps/api/src/presentation/auth/auth.controller.ts
import { Controller, Post, Body, Res, Req, UseGuards } from '@nestjs/common';
import { Response, Request } from 'express';
import { CommandBus } from '@nestjs/cqrs';
import { LoginCommand } from '@/application/auth/commands/login.command';
import { RefreshAccessTokenCommand } from '@/application/auth/commands/refresh-access-token.command';
import { LogoutCommand } from '@/application/auth/commands/logout.command';
import { JwtAuthGuard } from '@/shared/guards/jwt-auth.guard';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { LoginDto, LoginResponseDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  /**
   * Login endpoint
   * Returns access token in response body
   * Sets refresh token in httpOnly cookie
   */
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.commandBus.execute(new LoginCommand(dto.email, dto.password));

    // Set refresh token in httpOnly cookie
    this.setRefreshTokenCookie(response, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  /**
   * Refresh access token endpoint
   * Reads refresh token from cookie
   * Returns new access token
   */
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ accessToken: string }> {
    const refreshToken = request.cookies['refreshToken'];

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const result = await this.commandBus.execute(new RefreshAccessTokenCommand(refreshToken));

    // Rotate refresh token (optional but recommended)
    if (result.newRefreshToken) {
      this.setRefreshTokenCookie(response, result.newRefreshToken);
    }

    return {
      accessToken: result.accessToken,
    };
  }

  /**
   * Logout endpoint
   * Revokes refresh token
   * Clears cookie
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() user: any,
  ): Promise<{ message: string }> {
    const refreshToken = request.cookies['refreshToken'];

    if (refreshToken) {
      await this.commandBus.execute(new LogoutCommand(user.userId, refreshToken));
    }

    // Clear refresh token cookie
    response.clearCookie('refreshToken');

    return { message: 'Logged out successfully' };
  }

  /**
   * Helper: Set refresh token in httpOnly cookie
   */
  private setRefreshTokenCookie(response: Response, token: string): void {
    response.cookie('refreshToken', token, {
      httpOnly: true, // Prevents JavaScript access (XSS protection)
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict', // CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/', // Cookie available for all routes
    });
  }
}
```

**Key Security Features**:

1. **Access tokens are short-lived (15 min)** - Limits damage if compromised
2. **Refresh tokens in httpOnly cookies** - Frontend JavaScript cannot access
3. **Refresh tokens stored in database** - Can be revoked server-side
4. **SameSite=strict cookie** - CSRF protection
5. **Secure flag in production** - HTTPS only

---

#### 1.3 JWT Strategy and Guard Pattern

**Problem**: Need to validate JWT tokens on protected endpoints.

**Solution**: Use Passport JWT strategy with NestJS guards.

**JWT Strategy**:

```typescript
// apps/api/src/infrastructure/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * Validate JWT payload
   * Called automatically by Passport after token verification
   * Return value is attached to request.user
   */
  async validate(payload: JwtPayload) {
    // Additional validation can be added here
    // e.g., check if user still exists, is not disabled, etc.

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
```

**JWT Auth Guard**:

```typescript
// apps/api/src/infrastructure/auth/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

/**
 * JWT Authentication Guard
 * Protects routes by requiring valid JWT access token
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * Check if route is marked as public
   */
  canActivate(context: ExecutionContext) {
    // Check for @Public() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * Handle authentication errors
   */
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}
```

**Public Decorator** (for public endpoints):

```typescript
// apps/api/src/shared/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

/**
 * Marks endpoint as public (skip JWT authentication)
 */
export const Public = () => SetMetadata('isPublic', true);
```

**Usage**:

```typescript
@Controller('users')
@UseGuards(JwtAuthGuard) // Apply guard to entire controller
export class UserController {
  @Get('profile')
  getProfile(@CurrentUser() user: any) {
    // Protected route - requires JWT
    return user;
  }

  @Get('public-info')
  @Public() // Skip authentication for this route
  getPublicInfo() {
    return { message: 'This is public' };
  }
}
```

---

#### 1.4 RBAC with CASL Pattern

**Problem**: Need fine-grained authorization beyond simple role checks.

**Solution**: Use CASL for attribute-based access control.

**Abilities Factory**:

```typescript
// apps/api/src/authorization/abilities.factory.ts
import { Injectable } from '@nestjs/common';
import {
  AbilityBuilder,
  Ability,
  AbilityClass,
  ExtractSubjectType,
  InferSubjects,
} from '@casl/ability';
import { User } from '@/domain/user/user.entity';
import { TimeEntry } from '@/domain/time-entry/time-entry.entity';
import { Project } from '@/domain/project/project.entity';
import { Invoice } from '@/domain/invoice/invoice.entity';
import { Client } from '@/domain/client/client.entity';

/**
 * Define actions
 */
export enum Action {
  Manage = 'manage', // Wildcard for any action
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
  Approve = 'approve',
  Submit = 'submit',
  Export = 'export',
}

/**
 * Define subjects (entities)
 */
export type Subjects =
  | InferSubjects<typeof User | typeof TimeEntry | typeof Project | typeof Invoice | typeof Client>
  | 'all';

/**
 * Ability type
 */
export type AppAbility = Ability<[Action, Subjects]>;

@Injectable()
export class AbilityFactory {
  createForUser(user: User) {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      Ability as AbilityClass<AppAbility>,
    );

    // Admin - can do anything
    if (user.role === 'admin') {
      can(Action.Manage, 'all');
      return build();
    }

    // Manager - can manage projects, clients, invoices, and approve time entries
    if (user.role === 'manager') {
      can(Action.Read, 'all'); // Read everything
      can(Action.Manage, Project);
      can(Action.Manage, Client);
      can(Action.Manage, Invoice);
      can(Action.Approve, TimeEntry);
      can(Action.Export, TimeEntry);

      // Cannot delete users
      cannot(Action.Delete, User);

      return build();
    }

    // Consultant - can only manage own time entries
    if (user.role === 'consultant') {
      can(Action.Read, Project);
      can(Action.Read, Client);

      // Own time entries only
      can(Action.Create, TimeEntry);
      can(Action.Read, TimeEntry, { userId: user.id.value });
      can(Action.Update, TimeEntry, {
        userId: user.id.value,
        status: 'draft', // Can only update draft entries
      });
      can(Action.Submit, TimeEntry, { userId: user.id.value });

      // Cannot approve or delete time entries
      cannot(Action.Approve, TimeEntry);
      cannot(Action.Delete, TimeEntry);

      return build();
    }

    // Default: no permissions
    return build();
  }
}
```

**Permissions Guard**:

```typescript
// apps/api/src/shared/guards/permissions.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AbilityFactory, Action } from '@/authorization/abilities.factory';
import { UserRepository } from '@/domain/repositories/user.repository';

/**
 * Guard to check CASL permissions
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private abilityFactory: AbilityFactory,
    private userRepository: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required permissions from decorator
    const requiredPermissions = this.reflector.get<[Action, any, any?]>(
      'permissions',
      context.getHandler(),
    );

    if (!requiredPermissions) {
      return true; // No permissions required
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId; // From JWT

    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    // Load full user entity
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new ForbiddenException('User not found');
    }

    // Create ability for user
    const ability = this.abilityFactory.createForUser(user);

    const [action, subject, conditions] = requiredPermissions;

    // Load entity if checking entity-specific permissions
    let entity = subject;
    if (typeof subject === 'function' && request.params.id) {
      entity = await this.loadEntity(subject.name, request.params.id);
    }

    // Check permission
    const canPerformAction = conditions
      ? ability.can(action, entity, conditions)
      : ability.can(action, entity);

    if (!canPerformAction) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }

  /**
   * Load entity from repository
   */
  private async loadEntity(entityType: string, id: string): Promise<any> {
    // This would dynamically load based on entity type
    // Implementation depends on your repository structure
    switch (entityType) {
      case 'TimeEntry':
        return this.timeEntryRepository.findById(id);
      case 'Project':
        return this.projectRepository.findById(id);
      // ... other entity types
      default:
        return null;
    }
  }
}
```

**Permissions Decorator**:

```typescript
// apps/api/src/shared/decorators/permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { Action } from '@/authorization/abilities.factory';

/**
 * Decorator to require specific permissions
 */
export const RequirePermissions = (action: Action, subject: any, conditions?: any) =>
  SetMetadata('permissions', [action, subject, conditions]);
```

**Usage**:

```typescript
@Controller('time-entries')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TimeEntryController {
  @Post()
  @RequirePermissions(Action.Create, TimeEntry)
  async create(@Body() dto: CreateTimeEntryDto) {
    // Only users with 'create' permission on TimeEntry can execute
  }

  @Patch(':id')
  @RequirePermissions(Action.Update, TimeEntry)
  async update(@Param('id') id: string, @Body() dto: UpdateTimeEntryDto) {
    // Checks if user can update THIS specific time entry
    // (e.g., only own entries, only draft status)
  }

  @Post(':id/approve')
  @RequirePermissions(Action.Approve, TimeEntry)
  async approve(@Param('id') id: string) {
    // Only managers/admins can approve
  }
}
```

---

### 2. Input Validation & Sanitization

#### 2.1 DTO Validation Pattern

**Problem**: User input can contain malicious data or invalid formats.

**Solution**: Use class-validator and class-transformer for automatic validation.

**Implementation**:

```typescript
// apps/api/src/presentation/user/dto/create-user.dto.ts
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsPhoneNumber,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }) => value.toLowerCase().trim()) // Sanitize
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(100, { message: 'Password must not exceed 100 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain uppercase, lowercase, number, and special character',
  })
  password: string;

  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  @Transform(({ value }) => value.trim()) // Remove leading/trailing spaces
  name: string;

  @IsOptional()
  @IsPhoneNumber('US', { message: 'Invalid phone number format' })
  phoneNumber?: string;
}
```

**Global Validation Pipe**:

```typescript
// apps/api/src/main.ts
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw error if extra properties
      transform: true, // Automatically transform to DTO class
      transformOptions: {
        enableImplicitConversion: true, // Auto-convert types
      },
    }),
  );

  await app.listen(3000);
}
```

**Custom Validators**:

```typescript
// apps/api/src/shared/validators/is-api-number.validator.ts
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Custom validator for API numbers (oil & gas well identifiers)
 */
@ValidatorConstraint({ async: false })
export class IsApiNumberConstraint implements ValidatorConstraintInterface {
  validate(apiNumber: any) {
    // API number format: XX-XXX-XXXXX (14 digits with hyphens)
    return typeof apiNumber === 'string' && /^\d{2}-\d{3}-\d{5}$/.test(apiNumber);
  }

  defaultMessage() {
    return 'API number must be in format XX-XXX-XXXXX';
  }
}

export function IsApiNumber(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsApiNumberConstraint,
    });
  };
}

// Usage
export class CreateWellDto {
  @IsApiNumber()
  apiNumber: string;
}
```

---

#### 2.2 SQL Injection Prevention Pattern

**Problem**: String concatenation in queries allows SQL injection attacks.

**Solution**: Always use parameterized queries. Drizzle ORM does this automatically.

```typescript
// ✅ CORRECT - Parameterized (Drizzle auto-parameterizes)
import { eq, and, like } from 'drizzle-orm';
import { db } from '@/infrastructure/database/connection';
import { users } from '@/infrastructure/database/schema/user.schema';

export class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    // Drizzle automatically parameterizes
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email)) // Safe - parameterized
      .limit(1);

    return result[0] ? this.toDomain(result[0]) : null;
  }

  async searchByName(searchTerm: string): Promise<User[]> {
    // Safe - parameterized
    const results = await db
      .select()
      .from(users)
      .where(like(users.name, `%${searchTerm}%`)); // Drizzle escapes

    return results.map(r => this.toDomain(r));
  }
}

// ❌ NEVER DO THIS - Raw SQL with concatenation
async findByEmailUnsafe(email: string): Promise<User | null> {
  // DANGEROUS - SQL injection vulnerability
  const result = await db.execute(
    `SELECT * FROM users WHERE email = '${email}'` // NEVER DO THIS
  );
  return result[0];
}

// ⚠️ IF YOU MUST USE RAW SQL - Use parameters
async findByEmailRaw(email: string): Promise<User | null> {
  // Acceptable - uses parameters
  const result = await db.execute(
    'SELECT * FROM users WHERE email = $1',
    [email] // Parameterized
  );
  return result[0];
}
```

---

#### 2.3 XSS Prevention Pattern (Backend)

**Problem**: User-generated content can contain malicious scripts.

**Solution**: Sanitize output, set security headers, validate input.

**Security Headers with Helmet**:

```typescript
// apps/api/src/main.ts
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Adjust based on needs
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      noSniff: true, // X-Content-Type-Options: nosniff
      xssFilter: true, // X-XSS-Protection: 1; mode=block
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  await app.listen(3000);
}
```

**Sanitize HTML in DTOs**:

```typescript
import { IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import * as sanitizeHtml from 'sanitize-html';

export class CreateCommentDto {
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) =>
    sanitizeHtml(value, {
      allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p'],
      allowedAttributes: {
        a: ['href'],
      },
    }),
  )
  content: string;
}
```

---

### 3. CSRF Protection

#### 3.1 SameSite Cookie Pattern

**Problem**: Cross-site request forgery allows attackers to perform actions on behalf of authenticated users.

**Solution**: Use SameSite cookies for automatic CSRF protection.

```typescript
// apps/api/src/presentation/auth/auth.controller.ts
private setRefreshTokenCookie(response: Response, token: string): void {
  response.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict', // CSRF protection - only send cookie for same-site requests
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}
```

**SameSite Options**:

- `strict` - Most secure, cookie only sent for same-site requests (recommended)
- `lax` - Cookie sent for top-level navigation (GET requests)
- `none` - Cookie sent for all requests (requires `secure: true`)

---

#### 3.2 CSRF Token Pattern (Alternative)

**Problem**: Some scenarios require additional CSRF protection beyond SameSite cookies.

**Solution**: Use CSRF tokens for state-changing operations.

```typescript
// apps/api/src/main.ts
import * as csurf from 'csurf';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CSRF protection (if not using SameSite strict)
  app.use(
    csurf({
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      },
    }),
  );

  await app.listen(3000);
}
```

**CSRF Guard**:

```typescript
// apps/api/src/shared/guards/csrf.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Skip for GET, HEAD, OPTIONS
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    // Verify CSRF token
    const csrfToken = request.headers['x-csrf-token'];
    const expectedToken = request.csrfToken();

    if (csrfToken !== expectedToken) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }
}
```

---

### 4. Rate Limiting & Brute Force Prevention

#### 4.1 Throttler Pattern

**Problem**: Brute force attacks can compromise accounts.

**Solution**: Implement rate limiting on sensitive endpoints.

```typescript
// apps/api/src/main.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60, // Time window in seconds
      limit: 10, // Max requests per ttl
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // Apply globally
    },
  ],
})
export class AppModule {}
```

**Custom Rate Limits per Endpoint**:

```typescript
// apps/api/src/presentation/auth/auth.controller.ts
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  @Post('login')
  @Throttle(5, 60) // 5 attempts per minute
  async login(@Body() dto: LoginDto) {
    // Login logic
  }

  @Post('register')
  @Throttle(3, 60) // 3 attempts per minute
  async register(@Body() dto: RegisterDto) {
    // Registration logic
  }

  @Post('password-reset/request')
  @Throttle(3, 900) // 3 attempts per 15 minutes
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    // Password reset logic
  }
}
```

**Distributed Rate Limiting with Redis**:

```typescript
// apps/api/src/infrastructure/throttler/redis-throttler.service.ts
import { Injectable } from '@nestjs/common';
import { ThrottlerStorageService } from '@nestjs/throttler';
import { Redis } from 'ioredis';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorageService {
  constructor(private readonly redis: Redis) {}

  async increment(key: string, ttl: number): Promise<number> {
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, ttl);
    }

    return count;
  }
}

// Register in module
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      useClass: RedisThrottlerStorage,
    }),
  ],
})
export class AppModule {}
```

---

#### 4.2 Account Lockout Pattern

**Problem**: Multiple failed login attempts indicate brute force attack.

**Solution**: Lock account after threshold of failed attempts.

```typescript
// apps/api/src/domain/user/user.entity.ts
export class User extends AggregateRoot {
  private failedLoginAttempts: number = 0;
  private lockedUntil: Date | null = null;
  private static readonly MAX_FAILED_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION_MINUTES = 15;

  /**
   * Verify password and handle failed attempts
   */
  async verifyPassword(plainPassword: string): Promise<boolean> {
    // Check if account is locked
    if (this.isLocked()) {
      throw new AccountLockedException(`Account locked until ${this.lockedUntil.toISOString()}`);
    }

    const isValid = await this.passwordHash.verify(plainPassword);

    if (!isValid) {
      this.handleFailedLogin();
      return false;
    }

    // Reset failed attempts on successful login
    this.failedLoginAttempts = 0;
    this.lockedUntil = null;

    return true;
  }

  /**
   * Handle failed login attempt
   */
  private handleFailedLogin(): void {
    this.failedLoginAttempts++;

    // Lock account after max attempts
    if (this.failedLoginAttempts >= User.MAX_FAILED_ATTEMPTS) {
      this.lockAccount();
      this.addDomainEvent(new UserAccountLockedEvent(this.id));
    }
  }

  /**
   * Lock account for specified duration
   */
  private lockAccount(): void {
    this.lockedUntil = new Date();
    this.lockedUntil.setMinutes(this.lockedUntil.getMinutes() + User.LOCKOUT_DURATION_MINUTES);
  }

  /**
   * Check if account is currently locked
   */
  isLocked(): boolean {
    return this.lockedUntil !== null && this.lockedUntil > new Date();
  }

  /**
   * Manually unlock account (admin action)
   */
  unlock(adminId: UserId): void {
    this.lockedUntil = null;
    this.failedLoginAttempts = 0;
    this.addDomainEvent(new UserAccountUnlockedEvent(this.id, adminId));
  }
}

// Custom exception
export class AccountLockedException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountLockedException';
  }
}
```

---

### 5. Audit Logging Pattern

#### 5.1 Audit Log Entity

**Problem**: Need immutable record of all security-relevant actions for compliance.

**Solution**: Create audit log entries for all mutations.

```typescript
// apps/api/src/domain/audit-log/audit-log.entity.ts
import { AggregateRoot } from '@/domain/shared/aggregate-root';
import { AuditLogId } from './audit-log-id.vo';
import { UserId } from '@/domain/user/user-id.vo';

export class AuditLog extends AggregateRoot {
  private constructor(
    public readonly id: AuditLogId,
    public readonly userId: UserId | null,
    public readonly action: string,
    public readonly entityType: string | null,
    public readonly entityId: string | null,
    public readonly changes: Record<string, any> | null,
    public readonly ipAddress: string | null,
    public readonly userAgent: string | null,
    public readonly timestamp: Date,
  ) {
    super();
  }

  /**
   * Create audit log entry
   */
  static create(params: {
    userId?: UserId;
    action: string;
    entityType?: string;
    entityId?: string;
    changes?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): AuditLog {
    return new AuditLog(
      AuditLogId.create(),
      params.userId ?? null,
      params.action,
      params.entityType ?? null,
      params.entityId ?? null,
      params.changes ?? null,
      params.ipAddress ?? null,
      params.userAgent ?? null,
      new Date(),
    );
  }
}
```

---

#### 5.2 Audit Log Interceptor

**Problem**: Manually logging every action is error-prone.

**Solution**: Use interceptor to automatically log all mutations.

```typescript
// apps/api/src/shared/interceptors/audit-log.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { AuditLogService } from '@/application/audit-log/audit-log.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const method = request.method;
    const controller = context.getClass().name;
    const handler = context.getHandler().name;
    const action = `${controller}.${handler}`;

    // Only log mutations (POST, PATCH, DELETE, PUT)
    if (!['POST', 'PATCH', 'DELETE', 'PUT'].includes(method)) {
      return next.handle();
    }

    // Extract entity info
    const entityType = this.reflector.get<string>('entityType', context.getHandler());
    const entityId = request.params.id;

    return next.handle().pipe(
      tap((response) => {
        // Log successful action
        this.auditLogService.log({
          userId: user?.userId,
          action,
          entityType,
          entityId,
          changes: {
            method,
            body: this.sanitizeBody(request.body),
            response: this.sanitizeResponse(response),
          },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });
      }),
      catchError((error) => {
        // Log failed action
        this.auditLogService.log({
          userId: user?.userId,
          action,
          entityType,
          entityId,
          changes: {
            method,
            body: this.sanitizeBody(request.body),
            error: error.message,
          },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });

        throw error;
      }),
    );
  }

  /**
   * Remove sensitive data from body
   */
  private sanitizeBody(body: any): any {
    if (!body) return null;

    const sanitized = { ...body };

    // Remove sensitive fields
    delete sanitized.password;
    delete sanitized.passwordConfirm;
    delete sanitized.token;
    delete sanitized.refreshToken;

    return sanitized;
  }

  /**
   * Remove sensitive data from response
   */
  private sanitizeResponse(response: any): any {
    if (!response) return null;

    const sanitized = { ...response };

    // Remove sensitive fields
    delete sanitized.passwordHash;
    delete sanitized.refreshToken;

    return sanitized;
  }
}
```

**Entity Type Decorator**:

```typescript
// apps/api/src/shared/decorators/entity-type.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const EntityType = (type: string) => SetMetadata('entityType', type);
```

**Usage**:

```typescript
@Controller('users')
@UseInterceptors(AuditLogInterceptor)
export class UserController {
  @Patch(':id')
  @EntityType('User')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    // Automatically logged to audit trail
  }
}
```

---

### 6. Secret Management Pattern

#### 6.1 Environment Variables

**Problem**: Hardcoding secrets in code exposes them in version control.

**Solution**: Use environment variables with validation.

```typescript
// apps/api/src/infrastructure/config/env.validation.ts
import { plainToClass } from 'class-transformer';
import { IsString, IsNumber, IsEnum, validateSync, MinLength } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  PORT: number;

  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  CORS_ORIGIN: string;

  @IsString()
  @MinLength(32)
  ENCRYPTION_KEY: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
```

**ConfigModule Setup**:

```typescript
// apps/api/src/app.module.ts
import { ConfigModule } from '@nestjs/config';
import { validate } from '@/infrastructure/config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate, // Validates env vars on startup
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
  ],
})
export class AppModule {}
```

**.env.example**:

```bash
# Application
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/wellpulse

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-token-secret-min-32-chars

# CORS
CORS_ORIGIN=http://localhost:3000

# Encryption
ENCRYPTION_KEY=your-encryption-key-min-32-chars

# External Services
QUICKBOOKS_CLIENT_ID=
QUICKBOOKS_CLIENT_SECRET=
STRIPE_SECRET_KEY=
```

**Generate Secure Secrets**:

```bash
# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

#### 6.2 Secrets Manager Pattern (Production)

**Problem**: Environment variables in production can be compromised.

**Solution**: Use secrets manager (AWS Secrets Manager, Vault).

```typescript
// apps/api/src/infrastructure/secrets/secrets.service.ts
import { Injectable } from '@nestjs/common';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

@Injectable()
export class SecretsService {
  private client: SecretsManagerClient;
  private cache: Map<string, { value: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.client = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  /**
   * Get secret from AWS Secrets Manager
   * Caches result for 5 minutes
   */
  async getSecret(secretName: string): Promise<any> {
    // Check cache
    const cached = this.cache.get(secretName);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.value;
    }

    // Fetch from Secrets Manager
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await this.client.send(command);

    const secret = JSON.parse(response.SecretString);

    // Cache result
    this.cache.set(secretName, { value: secret, timestamp: Date.now() });

    return secret;
  }

  /**
   * Clear cache (for secret rotation)
   */
  clearCache(): void {
    this.cache.clear();
  }
}
```

**Usage**:

```typescript
@Injectable()
export class JwtService {
  constructor(
    private readonly secretsService: SecretsService,
    private readonly configService: ConfigService,
  ) {}

  async signAccessToken(user: User): Promise<string> {
    let secret: string;

    if (process.env.NODE_ENV === 'production') {
      // Use Secrets Manager in production
      const secrets = await this.secretsService.getSecret('wellpulse/jwt');
      secret = secrets.JWT_SECRET;
    } else {
      // Use environment variable in development
      secret = this.configService.get<string>('JWT_SECRET');
    }

    return this.jwtService.sign(payload, { secret, expiresIn: '15m' });
  }
}
```

---

### 7. Error Handling Pattern

#### 7.1 Secure Error Messages

**Problem**: Detailed error messages expose implementation details to attackers.

**Solution**: Generic error messages to users, detailed logs for developers.

```typescript
// apps/api/src/shared/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // Detailed error for logging
    this.logger.error({
      message: exception instanceof Error ? exception.message : 'Unknown error',
      stack: exception instanceof Error ? exception.stack : undefined,
      path: request.url,
      method: request.method,
      user: request.user?.userId,
      timestamp: new Date().toISOString(),
    });

    // Generic error response for client
    const errorResponse = this.getErrorResponse(exception, status);

    response.status(status).json(errorResponse);
  }

  private getErrorResponse(exception: unknown, status: number): any {
    // In production, never expose stack traces or internal details
    if (process.env.NODE_ENV === 'production') {
      if (exception instanceof HttpException) {
        const response = exception.getResponse();

        // Return only safe error info
        return {
          statusCode: status,
          message:
            typeof response === 'string'
              ? response
              : (response as any).message || 'An error occurred',
          timestamp: new Date().toISOString(),
        };
      }

      // Generic error for non-HTTP exceptions
      return {
        statusCode: status,
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
      };
    }

    // In development, include more details
    if (exception instanceof HttpException) {
      return {
        statusCode: status,
        message: exception.message,
        error: exception.getResponse(),
        timestamp: new Date().toISOString(),
      };
    }

    return {
      statusCode: status,
      message: exception instanceof Error ? exception.message : 'Unknown error',
      stack: exception instanceof Error ? exception.stack : undefined,
      timestamp: new Date().toISOString(),
    };
  }
}
```

**Register Filter**:

```typescript
// apps/api/src/main.ts
import { HttpExceptionFilter } from '@/shared/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(3000);
}
```

**Custom Security Exceptions**:

```typescript
// apps/api/src/shared/exceptions/security.exceptions.ts
import { HttpException, HttpStatus } from '@nestjs/common';

export class AccountLockedException extends HttpException {
  constructor(message: string = 'Account is locked') {
    super(message, HttpStatus.FORBIDDEN);
  }
}

export class WeakPasswordException extends HttpException {
  constructor(message: string = 'Password does not meet requirements') {
    super(message, HttpStatus.BAD_REQUEST);
  }
}

export class InvalidTokenException extends HttpException {
  constructor(message: string = 'Invalid or expired token') {
    super(message, HttpStatus.UNAUTHORIZED);
  }
}

export class InsufficientPermissionsException extends HttpException {
  constructor(message: string = 'Insufficient permissions') {
    super(message, HttpStatus.FORBIDDEN);
  }
}
```

---

## Frontend Security Patterns (Next.js)

### 1. Token Storage Pattern

#### 1.1 In-Memory Access Token Pattern

**Problem**: Storing tokens in localStorage exposes them to XSS attacks.

**Solution**: Store access tokens in memory only.

```typescript
// apps/web/lib/api/client.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// In-memory token storage (NOT localStorage!)
let accessToken: string | null = null;

/**
 * Set access token in memory
 */
export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

/**
 * Get current access token
 */
export const getAccessToken = (): string | null => {
  return accessToken;
};

/**
 * Clear access token
 */
export const clearAccessToken = (): void => {
  accessToken = null;
};

// Create axios instance
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send httpOnly cookies
});

/**
 * Request interceptor: Add Authorization header
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  },
);

export default apiClient;
```

**Why In-Memory is Secure**:

- Not accessible via JavaScript from other tabs/windows
- Cleared on page refresh (requires re-authentication)
- Not vulnerable to XSS attacks reading localStorage
- Cannot be stolen by malicious scripts

---

#### 1.2 Automatic Token Refresh Pattern

**Problem**: Access tokens expire quickly (15 min). Need seamless refresh.

**Solution**: Intercept 401 responses and automatically refresh token.

```typescript
// apps/web/lib/api/client.ts (continued)
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

/**
 * Process queued requests after token refresh
 */
const processQueue = (error: Error | null, token: string | null = null): void => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

/**
 * Response interceptor: Handle 401 by refreshing token
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't retry if it's the refresh endpoint itself
      if (originalRequest.url?.includes('/auth/refresh')) {
        clearAccessToken();

        // Redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }

        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request to retry after refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to refresh the token (uses httpOnly cookie)
        const response = await axios.post<{ accessToken: string }>(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/auth/refresh`,
          {},
          {
            withCredentials: true, // Send refresh token cookie
          },
        );

        const newAccessToken = response.data.accessToken;
        setAccessToken(newAccessToken);

        // Update the original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        // Process queued requests
        processQueue(null, newAccessToken);

        // Retry the original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear token and reject all queued requests
        processQueue(refreshError as Error, null);
        clearAccessToken();

        // Redirect to login page
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
```

**Key Features**:

1. **Automatic retry** - Failed requests are retried with new token
2. **Request queueing** - Multiple simultaneous 401s refresh only once
3. **Graceful degradation** - Redirects to login if refresh fails
4. **Prevents infinite loops** - Doesn't retry refresh endpoint itself

---

### 2. XSS Prevention Pattern (Frontend)

#### 2.1 React Auto-Escaping

**Problem**: User-generated content can contain malicious scripts.

**Solution**: Leverage React's automatic escaping.

```tsx
// ✅ SAFE - React auto-escapes
export function UserProfile({ user }: { user: User }) {
  return (
    <div>
      <h1>{user.name}</h1> {/* Auto-escaped */}
      <p>{user.bio}</p> {/* Auto-escaped */}
      <a href={user.website}>{user.website}</a> {/* Auto-escaped */}
    </div>
  );
}

// ❌ DANGEROUS - Never use dangerouslySetInnerHTML with user input
export function UnsafeComponent({ userHtml }: { userHtml: string }) {
  return (
    <div dangerouslySetInnerHTML={{ __html: userHtml }} />
    // ⚠️ XSS vulnerability if userHtml contains <script> tags
  );
}
```

---

#### 2.2 DOMPurify Sanitization Pattern

**Problem**: Sometimes need to render user HTML (rich text editors).

**Solution**: Sanitize HTML with DOMPurify before rendering.

```tsx
// apps/web/components/rich-text-display.tsx
import DOMPurify from 'isomorphic-dompurify';

interface RichTextDisplayProps {
  html: string;
}

export function RichTextDisplay({ html }: RichTextDisplayProps) {
  // Sanitize HTML before rendering
  const sanitizedHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'b',
      'i',
      'em',
      'strong',
      'a',
      'p',
      'br',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
    ],
    ALLOWED_ATTR: ['href', 'title', 'target'],
    ALLOW_DATA_ATTR: false, // Prevent data-* attributes
  });

  return <div className="rich-text-content" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
}
```

**DOMPurify Configuration**:

- **ALLOWED_TAGS** - Whitelist of safe HTML tags
- **ALLOWED_ATTR** - Whitelist of safe attributes
- **ALLOW_DATA_ATTR** - Disable data attributes (can contain JS)
- **FORBID_TAGS** - Blacklist dangerous tags (script, iframe, object)
- **FORBID_ATTR** - Blacklist dangerous attributes (onclick, onerror)

---

#### 2.3 Content Security Policy (CSP)

**Problem**: Need defense-in-depth against XSS.

**Solution**: Set CSP headers in Next.js config.

```javascript
// apps/web/next.config.js
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL};
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
`;

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: ContentSecurityPolicy.replace(/\s{2,}/g, ' ').trim(),
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
```

---

### 3. CSRF Protection Pattern (Frontend)

#### 3.1 SameSite Cookie Reliance

**Problem**: Need CSRF protection for state-changing requests.

**Solution**: Backend uses SameSite=strict cookies (automatic protection).

```typescript
// apps/web/lib/api/client.ts
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true, // Send SameSite cookies
});

// No additional CSRF token needed!
// SameSite=strict prevents cross-site cookie sending
```

---

#### 3.2 CSRF Token Pattern (Alternative)

**Problem**: Some scenarios require explicit CSRF tokens.

**Solution**: Include CSRF token in request headers.

```typescript
// apps/web/lib/api/client.ts
let csrfToken: string | null = null;

/**
 * Fetch CSRF token from backend
 */
export const fetchCsrfToken = async (): Promise<void> => {
  const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/auth/csrf-token`, {
    withCredentials: true,
  });
  csrfToken = response.data.csrfToken;
};

/**
 * Request interceptor: Add CSRF token
 */
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Add CSRF token for state-changing requests
  if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(config.method?.toUpperCase() || '')) {
    if (csrfToken && config.headers) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }

  // Add access token
  const token = getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Initialize CSRF token on app load
fetchCsrfToken();
```

---

### 4. Secure Communication Pattern

#### 4.1 HTTPS Only Pattern

**Problem**: HTTP traffic can be intercepted (man-in-the-middle).

**Solution**: Enforce HTTPS in production.

```typescript
// apps/web/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Enforce HTTPS in production
  if (
    process.env.NODE_ENV === 'production' &&
    request.headers.get('x-forwarded-proto') !== 'https'
  ) {
    return NextResponse.redirect(
      `https://${request.headers.get('host')}${request.nextUrl.pathname}`,
      301,
    );
  }

  return NextResponse.next();
}
```

---

#### 4.2 API Base URL Configuration

**Problem**: Hardcoding API URLs makes environment switching difficult.

**Solution**: Use environment variables for API URLs.

```typescript
// apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

// apps/web/.env.production
NEXT_PUBLIC_API_URL=https://api.wellpulse.com/api/v1
```

```typescript
// apps/web/lib/api/client.ts
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  withCredentials: true,
});
```

**Security Notes**:

- Use `NEXT_PUBLIC_*` prefix only for public URLs
- Never expose secrets in `NEXT_PUBLIC_*` variables
- Server-side secrets go in `.env` (without `NEXT_PUBLIC_`)

---

### 5. Input Validation Pattern (Frontend)

#### 5.1 Client-Side Validation

**Problem**: Need immediate feedback for user experience.

**Solution**: Validate on client-side, but ALWAYS validate on backend too.

```tsx
// apps/web/components/forms/login-form.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    // Client-side validation passed
    // Backend will validate again (CRITICAL!)
    await authRepository.login(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} type="email" placeholder="Email" />
      {errors.email && <span className="error">{errors.email.message}</span>}

      <input {...register('password')} type="password" placeholder="Password" />
      {errors.password && <span className="error">{errors.password.message}</span>}

      <button type="submit">Login</button>
    </form>
  );
}
```

**Why Validate on Both Sides?**

- **Client-side** - Better UX, immediate feedback
- **Backend** - Security boundary, prevents bypass

**Never trust client-side validation alone!** Attackers can bypass it.

---

#### 5.2 Schema Validation Pattern

**Problem**: Need consistent validation across forms.

**Solution**: Define reusable validation schemas.

```typescript
// apps/web/lib/validation/auth.schemas.ts
import * as z from 'zod';

export const emailSchema = z.string().email('Invalid email address').min(1, 'Email is required');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'), // Don't validate strength on login
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(2, 'Name must be at least 2 characters'),
});
```

---

### 6. Error Handling Pattern (Frontend)

#### 6.1 Generic Error Messages

**Problem**: Detailed error messages expose implementation details.

**Solution**: Show generic errors to users, log details for developers.

```typescript
// apps/web/lib/api/error-handler.ts
import { AxiosError } from 'axios';
import { toast } from 'sonner';

export function handleApiError(error: unknown): void {
  if (error instanceof AxiosError) {
    // Log detailed error for developers
    console.error('API Error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    // Show generic error to users
    const userMessage = getUserFriendlyMessage(error);
    toast.error(userMessage);
  } else {
    console.error('Unknown error:', error);
    toast.error('An unexpected error occurred. Please try again.');
  }
}

function getUserFriendlyMessage(error: AxiosError): string {
  const status = error.response?.status;

  switch (status) {
    case 400:
      return 'Invalid request. Please check your input.';
    case 401:
      return 'Authentication required. Please log in.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 429:
      return 'Too many requests. Please try again later.';
    case 500:
      return 'Server error. Please try again later.';
    default:
      return 'An error occurred. Please try again.';
  }
}
```

**Usage**:

```typescript
// apps/web/components/forms/login-form.tsx
import { handleApiError } from '@/lib/api/error-handler';

const onSubmit = async (data: LoginFormData) => {
  try {
    await authRepository.login(data);
  } catch (error) {
    handleApiError(error); // Generic error shown to user
  }
};
```

---

### 7. Route Protection Pattern

#### 7.1 Auth Guard Component

**Problem**: Need to protect authenticated routes.

**Solution**: Create reusable AuthGuard component.

```tsx
// apps/web/components/auth/auth-guard.tsx
'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900" />
      </div>
    );
  }

  // Show nothing if not authenticated (redirecting)
  if (!isAuthenticated) {
    return null;
  }

  // Render protected content
  return <>{children}</>;
}
```

**Usage**:

```tsx
// apps/web/app/(dashboard)/layout.tsx
import { AuthGuard } from '@/components/auth/auth-guard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="dashboard-layout">{children}</div>
    </AuthGuard>
  );
}
```

---

#### 7.2 Permission-Based Rendering

**Problem**: Need to conditionally render UI based on user permissions.

**Solution**: Create permission check hooks.

```tsx
// apps/web/hooks/use-can.ts
import { useAuth } from '@/lib/auth/auth-context';
import { Action, Subject } from '@/types/permissions.types';

export function useCan() {
  const { user } = useAuth();

  const can = (action: Action, subject: Subject): boolean => {
    if (!user) return false;

    // Admin can do anything
    if (user.role === 'admin') return true;

    // Manager permissions
    if (user.role === 'manager') {
      if (action === 'delete' && subject === 'User') return false;
      return true;
    }

    // Consultant permissions
    if (user.role === 'consultant') {
      if (subject === 'TimeEntry') {
        return ['create', 'read', 'update', 'submit'].includes(action);
      }
      if (subject === 'Project' || subject === 'Client') {
        return action === 'read';
      }
      return false;
    }

    return false;
  };

  return { can };
}
```

**Usage**:

```tsx
// apps/web/components/time-entry/time-entry-actions.tsx
import { useCan } from '@/hooks/use-can';

export function TimeEntryActions({ timeEntry }: { timeEntry: TimeEntry }) {
  const { can } = useCan();

  return (
    <div>
      {can('update', 'TimeEntry') && <button onClick={() => handleEdit(timeEntry)}>Edit</button>}

      {can('delete', 'TimeEntry') && (
        <button onClick={() => handleDelete(timeEntry)}>Delete</button>
      )}

      {can('approve', 'TimeEntry') && (
        <button onClick={() => handleApprove(timeEntry)}>Approve</button>
      )}
    </div>
  );
}
```

---

## Implementation Checklist

### Backend Security Checklist

**Authentication**:

- [ ] Passwords hashed with bcrypt (cost 12)
- [ ] Password strength validation enforced
- [ ] JWT access tokens short-lived (15 min)
- [ ] Refresh tokens long-lived (7 days), stored in database
- [ ] Refresh tokens in httpOnly cookies
- [ ] JwtAuthGuard applied to protected routes
- [ ] Public decorator for public endpoints

**Authorization**:

- [ ] CASL AbilityFactory implemented
- [ ] PermissionsGuard applied to protected routes
- [ ] Fine-grained permissions defined for each role
- [ ] Entity-level permission checks

**Input Validation**:

- [ ] Global ValidationPipe configured
- [ ] class-validator decorators on all DTOs
- [ ] Input sanitization with Transform decorator
- [ ] Custom validators for domain-specific validation

**SQL Injection Prevention**:

- [ ] Drizzle ORM used for all queries
- [ ] No raw SQL string concatenation
- [ ] Parameters used if raw SQL is necessary

**XSS Prevention**:

- [ ] Helmet security headers configured
- [ ] CSP policy defined
- [ ] Output sanitization for user content

**CSRF Protection**:

- [ ] SameSite=strict cookies configured
- [ ] CSRF tokens for sensitive operations (if needed)

**Rate Limiting**:

- [ ] ThrottlerModule configured globally
- [ ] Custom rate limits on sensitive endpoints (login, password reset)
- [ ] Account lockout after failed attempts

**Audit Logging**:

- [ ] AuditLog entity created
- [ ] AuditLogInterceptor applied to mutations
- [ ] Sensitive data excluded from logs
- [ ] Logs immutable and timestamped

**Secret Management**:

- [ ] Environment variables validated on startup
- [ ] No secrets in version control
- [ ] .env.example provided
- [ ] Secrets Manager for production (AWS/Vault)

**Error Handling**:

- [ ] HttpExceptionFilter configured
- [ ] Generic error messages to users
- [ ] Detailed error logging
- [ ] No stack traces in production

**CORS**:

- [ ] CORS restricted to frontend origin
- [ ] credentials: true for cookies

**HTTPS**:

- [ ] HTTPS enforced in production
- [ ] Secure cookies in production

### Frontend Security Checklist

**Token Storage**:

- [ ] Access tokens in memory (NOT localStorage)
- [ ] Refresh tokens in httpOnly cookies
- [ ] Automatic token refresh on 401

**XSS Prevention**:

- [ ] React auto-escaping leveraged
- [ ] DOMPurify for user HTML
- [ ] No dangerouslySetInnerHTML without sanitization
- [ ] CSP headers configured

**CSRF Protection**:

- [ ] withCredentials: true for API calls
- [ ] SameSite cookies from backend
- [ ] CSRF tokens if needed

**Input Validation**:

- [ ] Client-side validation with react-hook-form + Zod
- [ ] Backend validation always enforced
- [ ] Reusable validation schemas

**Error Handling**:

- [ ] Generic error messages to users
- [ ] Detailed errors logged to console (dev only)
- [ ] Error boundaries for React errors

**Route Protection**:

- [ ] AuthGuard for protected routes
- [ ] Permission-based rendering
- [ ] Redirect to login if unauthenticated

**Secure Communication**:

- [ ] HTTPS enforced in production
- [ ] API base URL from environment variables
- [ ] No secrets in NEXT*PUBLIC*\* variables

---

## Security Anti-Patterns

### Backend Anti-Patterns

| ❌ Anti-Pattern                        | ✅ Correct Approach                   |
| -------------------------------------- | ------------------------------------- |
| Storing passwords in plain text        | Hash with bcrypt (cost 12)            |
| Long-lived access tokens (24h+)        | Short-lived (15 min) + refresh tokens |
| Storing refresh tokens in localStorage | httpOnly cookies                      |
| Hardcoding JWT secrets                 | Environment variables                 |
| String concatenation in SQL            | Parameterized queries (Drizzle)       |
| Exposing stack traces in production    | Generic error messages                |
| No rate limiting on login              | ThrottlerGuard on auth endpoints      |
| No audit logging                       | AuditLogInterceptor                   |
| Generic authorization (isAdmin?)       | CASL with fine-grained permissions    |
| Skipping input validation              | class-validator on all DTOs           |

### Frontend Anti-Patterns

| ❌ Anti-Pattern                 | ✅ Correct Approach             |
| ------------------------------- | ------------------------------- |
| Storing tokens in localStorage  | In-memory + httpOnly cookies    |
| Trusting client-side validation | Always validate on backend      |
| Using dangerouslySetInnerHTML   | React auto-escaping + DOMPurify |
| Showing detailed error messages | Generic errors + logging        |
| No route protection             | AuthGuard component             |
| Hardcoding API URLs             | Environment variables           |
| No CSP headers                  | Configure in next.config.js     |
| No HTTPS in production          | Enforce HTTPS redirect          |

---

## Testing Security Patterns

### Backend Security Tests

**1. Authentication Tests**:

```typescript
// apps/api/src/application/auth/commands/__tests__/login.handler.spec.ts
describe('LoginHandler', () => {
  it('should hash password before storing', async () => {
    const plainPassword = 'Test123!';
    const hashedPassword = await HashedPassword.fromPlainText(plainPassword);

    expect(hashedPassword.getHash()).not.toBe(plainPassword);
    expect(hashedPassword.getHash()).toMatch(/^\$2[aby]\$/); // bcrypt format
  });

  it('should enforce password strength', async () => {
    await expect(HashedPassword.fromPlainText('weak')).rejects.toThrow(
      'Password must be at least 8 characters',
    );
  });

  it('should lock account after 5 failed attempts', async () => {
    const user = User.create({
      /* ... */
    });

    // Simulate 5 failed login attempts
    for (let i = 0; i < 5; i++) {
      await user.verifyPassword('wrongpassword');
    }

    await expect(user.verifyPassword('wrongpassword')).rejects.toThrow(AccountLockedException);
  });

  it('should return short-lived access token', async () => {
    const token = jwtService.signAccessToken(user);
    const decoded = jwtService.verifyAccessToken(token);

    const expiry = decoded.exp! * 1000; // Convert to milliseconds
    const now = Date.now();
    const expiryDuration = expiry - now;

    expect(expiryDuration).toBeLessThanOrEqual(15 * 60 * 1000); // 15 minutes
  });
});
```

**2. Authorization Tests**:

```typescript
// apps/api/src/authorization/__tests__/abilities.factory.spec.ts
describe('AbilityFactory', () => {
  it('should allow admin to manage all', () => {
    const admin = User.create({ role: 'admin' });
    const ability = abilityFactory.createForUser(admin);

    expect(ability.can('manage', 'all')).toBe(true);
    expect(ability.can('delete', 'User')).toBe(true);
  });

  it('should prevent consultant from approving time entries', () => {
    const consultant = User.create({ role: 'consultant' });
    const ability = abilityFactory.createForUser(consultant);

    expect(ability.can('approve', 'TimeEntry')).toBe(false);
  });

  it('should allow consultant to update own draft time entries only', () => {
    const consultant = User.create({ role: 'consultant', id: 'user-123' });
    const ability = abilityFactory.createForUser(consultant);

    const ownDraftEntry = { userId: 'user-123', status: 'draft' };
    const ownSubmittedEntry = { userId: 'user-123', status: 'submitted' };
    const otherEntry = { userId: 'user-456', status: 'draft' };

    expect(ability.can('update', 'TimeEntry', ownDraftEntry)).toBe(true);
    expect(ability.can('update', 'TimeEntry', ownSubmittedEntry)).toBe(false);
    expect(ability.can('update', 'TimeEntry', otherEntry)).toBe(false);
  });
});
```

**3. Input Validation Tests**:

```typescript
// apps/api/src/presentation/user/__tests__/create-user.dto.spec.ts
describe('CreateUserDto', () => {
  it('should validate email format', async () => {
    const dto = new CreateUserDto();
    dto.email = 'invalid-email';
    dto.password = 'Test123!';
    dto.name = 'John Doe';

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('email');
  });

  it('should sanitize email', () => {
    const dto = plainToClass(CreateUserDto, {
      email: '  TEST@EXAMPLE.COM  ',
      password: 'Test123!',
      name: 'John Doe',
    });

    expect(dto.email).toBe('test@example.com');
  });

  it('should reject weak passwords', async () => {
    const dto = new CreateUserDto();
    dto.email = 'test@example.com';
    dto.password = 'weak';
    dto.name = 'John Doe';

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });
});
```

**4. SQL Injection Tests**:

```typescript
// apps/api/src/infrastructure/database/repositories/__tests__/user.repository.spec.ts
describe('UserRepository', () => {
  it('should prevent SQL injection in findByEmail', async () => {
    const maliciousEmail = "'; DROP TABLE users; --";

    // Should not throw error or execute SQL injection
    const result = await userRepository.findByEmail(maliciousEmail);

    expect(result).toBeNull();

    // Verify users table still exists
    const users = await userRepository.findAll();
    expect(users).toBeDefined();
  });
});
```

### Frontend Security Tests

**1. Token Storage Tests**:

```typescript
// apps/web/lib/api/__tests__/client.spec.ts
describe('API Client', () => {
  it('should store access token in memory only', () => {
    setAccessToken('test-token');

    // Verify NOT in localStorage
    expect(localStorage.getItem('accessToken')).toBeNull();

    // Verify in memory
    expect(getAccessToken()).toBe('test-token');
  });

  it('should clear token on 401 refresh failure', async () => {
    setAccessToken('expired-token');

    // Mock failed refresh
    mock.onPost('/auth/refresh').reply(401);

    try {
      await apiClient.get('/protected');
    } catch (error) {
      // Token should be cleared
      expect(getAccessToken()).toBeNull();
    }
  });
});
```

**2. XSS Prevention Tests**:

```typescript
// apps/web/components/__tests__/rich-text-display.spec.tsx
describe('RichTextDisplay', () => {
  it('should sanitize malicious HTML', () => {
    const maliciousHtml = '<script>alert("XSS")</script><p>Safe content</p>';

    render(<RichTextDisplay html={maliciousHtml} />);

    // Script tag should be removed
    expect(screen.queryByText('alert("XSS")')).not.toBeInTheDocument();

    // Safe content should remain
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });
});
```

---

## Security Scanning Tools

### Backend Tools

**1. Dependency Scanning**:

```bash
# Check for vulnerable dependencies
pnpm audit

# Auto-fix vulnerabilities
pnpm audit fix
```

**2. Static Analysis**:

```bash
# ESLint with security plugin
pnpm add -D eslint-plugin-security

# .eslintrc.js
module.exports = {
  plugins: ['security'],
  extends: ['plugin:security/recommended'],
};
```

**3. Secret Scanning**:

```bash
# Install trufflehog
brew install trufflesecurity/trufflehog/trufflehog

# Scan repository
trufflehog git file://. --only-verified
```

### Frontend Tools

**1. Dependency Scanning**:

```bash
pnpm audit
```

**2. Content Security Policy Testing**:

```bash
# Install CSP validator
pnpm add -D csp-validator

# Test CSP
csp-validator next.config.js
```

---

## References

### Security Resources

**OWASP**:

- [OWASP Top 10](https://owasp.org/www-project-top-ten/) - Most critical security risks
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/) - Security best practices
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/) - API-specific risks

**NestJS Security**:

- [NestJS Security](https://docs.nestjs.com/security/authentication) - Official security docs
- [NestJS Passport](https://docs.nestjs.com/recipes/passport) - Authentication strategies
- [NestJS Helmet](https://docs.nestjs.com/security/helmet) - Security headers

**Next.js Security**:

- [Next.js Security Headers](https://nextjs.org/docs/advanced-features/security-headers)
- [Next.js Authentication](https://nextjs.org/docs/authentication)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

**JWT**:

- [JWT.io](https://jwt.io/) - JWT debugger
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725) - RFC 8725

**Bcrypt**:

- [Bcrypt Documentation](https://www.npmjs.com/package/bcrypt)
- [Password Hashing Competition](https://password-hashing.net/)

**CASL**:

- [CASL Documentation](https://casl.js.org/v6/en/)
- [CASL NestJS Integration](https://casl.js.org/v6/en/package/casl-nestjs)

### Related Pattern Documents

- [01-RBAC-CASL-Pattern.md](./01-RBAC-CASL-Pattern.md) - Detailed CASL implementation
- [03-Hexagonal-Architecture.md](./03-Hexagonal-Architecture.md) - Security in infrastructure layer
- [06-Repository-Pattern.md](./06-Repository-Pattern.md) - SQL injection prevention
- [07-DTO-Pattern.md](./07-DTO-Pattern.md) - Input validation
- [19-Soft-Delete-Implementation-Guide.md](./19-Soft-Delete-Implementation-Guide.md) - Data retention

### Related Guides

- [Security Best Practices Guide](../guides/security-guide.md) - Quick reference
- [Testing Guide](../guides/testing-guide.md) - Security testing strategies
- [Development Tools](../guides/development-tools.md) - Security linting setup

---

## Summary

**Security is a layered approach**. No single pattern provides complete protection. Implement all patterns for defense-in-depth:

**Backend Security Layers**:

1. Authentication (bcrypt + JWT + refresh tokens)
2. Authorization (CASL RBAC)
3. Input validation (class-validator)
4. SQL injection prevention (Drizzle ORM)
5. XSS prevention (Helmet, sanitization)
6. CSRF protection (SameSite cookies)
7. Rate limiting (ThrottlerGuard)
8. Audit logging (AuditLogInterceptor)
9. Secret management (environment variables)
10. Error handling (generic messages)

**Frontend Security Layers**:

1. Token storage (in-memory + httpOnly cookies)
2. Automatic token refresh (401 interceptor)
3. XSS prevention (React escaping + DOMPurify)
4. CSRF protection (SameSite cookies)
5. Input validation (react-hook-form + Zod)
6. Error handling (generic messages)
7. Route protection (AuthGuard)
8. HTTPS enforcement (production)

**Remember**: Security is not a feature, it's a requirement. Every line of code must consider security implications.

---

**Version**: 1.0
**Last Updated**: October 6, 2025
**Author**: WellPulse Development Team
