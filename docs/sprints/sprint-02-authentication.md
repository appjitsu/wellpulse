# Sprint 2: Authentication & Authorization

**Duration**: 2 weeks (Weeks 3-4 of Phase 1)
**Status**: 📋 Planning
**Goal**: Complete user authentication system with registration, login, password reset, and RBAC

---

## Objectives

By the end of Sprint 2, we will have:

1. ✅ User registration with email verification
2. ✅ Login/logout with JWT authentication (httpOnly cookies)
3. ✅ Password reset flow (forgot password)
4. ✅ Refresh token rotation for session management
5. ✅ Role-Based Access Control (RBAC) with 3 roles: Admin, Manager, Operator
6. ✅ User management UI (Admin only)
7. ✅ Auth middleware and guards protecting API routes
8. ✅ Frontend authentication state management

**Deliverable**: Users can sign up at `{tenant}.wellpulse.app/register`, verify their email, log in, and access their dashboard with role-based permissions.

---

## Architecture Overview

### Authentication Flow

```
┌─────────────────────────────────────────────────────────┐
│                   Registration Flow                     │
└─────────────────────────────────────────────────────────┘
User → Register Form → API validates → Save user (PENDING)
         ↓
   Send verification email → User clicks link → Email verified
         ↓
   Status: PENDING → ACTIVE (if first user, auto-approve as ADMIN)

┌─────────────────────────────────────────────────────────┐
│                      Login Flow                         │
└─────────────────────────────────────────────────────────┘
User → Login Form → API validates credentials → Generate JWT
         ↓
   Access Token (15 min expiry, in response body)
   Refresh Token (7 days, httpOnly cookie)
         ↓
   Frontend stores access token in memory
   Subsequent requests include: Authorization: Bearer {accessToken}

┌─────────────────────────────────────────────────────────┐
│                   Token Refresh Flow                    │
└─────────────────────────────────────────────────────────┘
Access token expires → Frontend calls /auth/refresh
         ↓
   API validates refresh token (from cookie)
         ↓
   Generate new access token + new refresh token (rotation)
         ↓
   Return new access token, set new refresh token cookie
```

### Security Architecture

**Password Security:**

- bcrypt hashing with 12 rounds
- Minimum requirements: 8+ characters, uppercase, lowercase, number, special char
- Password reset tokens expire in 1 hour
- Rate limiting on login attempts (5 per 15 min per IP)

**Token Security:**

- JWT with RS256 (asymmetric keys)
- Access token: 15-minute expiry, stored in memory (not localStorage)
- Refresh token: 7-day expiry, httpOnly cookie, secure, sameSite=strict
- Refresh token rotation (new token on every refresh)

**RBAC Model:**

```typescript
enum UserRole {
  ADMIN = 'ADMIN', // Full access - user management, billing, all features
  MANAGER = 'MANAGER', // Read/write wells, production; read-only users
  OPERATOR = 'OPERATOR', // Read/write production data; read-only wells
}

const ROLE_PERMISSIONS = {
  ADMIN: ['*'], // All permissions
  MANAGER: ['wells:read', 'wells:write', 'production:read', 'production:write', 'users:read'],
  OPERATOR: ['wells:read', 'production:read', 'production:write'],
};
```

---

## Tasks

### Week 1: User Registration & Email Verification

#### Task 1.1: Tenant User Database Schema (Day 1)

**File**: `apps/api/src/infrastructure/database/schema/tenant/users.schema.ts`

```typescript
import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const tenantUsers = pgTable('tenant_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('OPERATOR'),
  // "ADMIN" | "MANAGER" | "OPERATOR"

  status: varchar('status', { length: 50 }).notNull().default('PENDING'),
  // "PENDING" | "ACTIVE" | "SUSPENDED"

  // Email verification
  emailVerified: boolean('email_verified').default(false),
  emailVerificationCode: varchar('email_verification_code', { length: 10 }),
  emailVerificationExpires: timestamp('email_verification_expires'),

  // Password reset
  passwordResetToken: varchar('password_reset_token', { length: 100 }),
  passwordResetExpires: timestamp('password_reset_expires'),

  // Session management
  lastLoginAt: timestamp('last_login_at'),
  refreshToken: text('refresh_token'), // Hashed refresh token

  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// Indexes for performance
export const tenantUsersEmailIndex = index('tenant_users_email_idx').on(tenantUsers.email);
```

**Run migration:**

```bash
cd apps/api
pnpm drizzle-kit generate:pg
pnpm drizzle-kit push:pg
```

---

#### Task 1.2: Domain Layer - User Entity (Day 1-2)

**File**: `apps/api/src/domain/users/user.entity.ts`

```typescript
import * as bcrypt from 'bcryptjs';
import { Email } from './value-objects/email.vo';

export type UserRole = 'ADMIN' | 'MANAGER' | 'OPERATOR';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';

export interface CreateUserParams {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

export class User {
  private constructor(
    public readonly id: string,
    private _email: Email,
    private _passwordHash: string,
    private _name: string,
    private _role: UserRole,
    private _status: UserStatus,
    private _emailVerified: boolean,
    private _emailVerificationCode: string | null,
    private _emailVerificationExpires: Date | null,
    private _passwordResetToken: string | null,
    private _passwordResetExpires: Date | null,
    private _lastLoginAt: Date | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static async create(params: CreateUserParams, id?: string): Promise<User> {
    const email = Email.create(params.email);
    const passwordHash = await bcrypt.hash(params.password, 12);

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    return new User(
      id ?? crypto.randomUUID(),
      email,
      passwordHash,
      params.name,
      params.role ?? 'OPERATOR',
      'PENDING',
      false,
      verificationCode,
      verificationExpires,
      null,
      null,
      null,
      new Date(),
      new Date(),
    );
  }

  // Getters
  get email(): string {
    return this._email.value;
  }
  get passwordHash(): string {
    return this._passwordHash;
  }
  get name(): string {
    return this._name;
  }
  get role(): UserRole {
    return this._role;
  }
  get status(): UserStatus {
    return this._status;
  }
  get emailVerified(): boolean {
    return this._emailVerified;
  }
  get emailVerificationCode(): string | null {
    return this._emailVerificationCode;
  }
  get emailVerificationExpires(): Date | null {
    return this._emailVerificationExpires;
  }
  get passwordResetToken(): string | null {
    return this._passwordResetToken;
  }
  get passwordResetExpires(): Date | null {
    return this._passwordResetExpires;
  }
  get lastLoginAt(): Date | null {
    return this._lastLoginAt;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Business logic methods
  async verifyPassword(plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, this._passwordHash);
  }

  verifyEmail(code: string): void {
    if (!this._emailVerificationCode) {
      throw new Error('No verification code set');
    }

    if (this._emailVerificationExpires && new Date() > this._emailVerificationExpires) {
      throw new Error('Verification code expired');
    }

    if (code !== this._emailVerificationCode) {
      throw new Error('Invalid verification code');
    }

    this._emailVerified = true;
    this._emailVerificationCode = null;
    this._emailVerificationExpires = null;
    this._status = 'ACTIVE';
    this._updatedAt = new Date();
  }

  generatePasswordResetToken(): string {
    const token = crypto.randomUUID();
    this._passwordResetToken = token;
    this._passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    this._updatedAt = new Date();
    return token;
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!this._passwordResetToken || this._passwordResetToken !== token) {
      throw new Error('Invalid reset token');
    }

    if (this._passwordResetExpires && new Date() > this._passwordResetExpires) {
      throw new Error('Reset token expired');
    }

    this._passwordHash = await bcrypt.hash(newPassword, 12);
    this._passwordResetToken = null;
    this._passwordResetExpires = null;
    this._updatedAt = new Date();
  }

  activate(): void {
    if (this._status === 'ACTIVE') return;
    this._status = 'ACTIVE';
    this._updatedAt = new Date();
  }

  suspend(): void {
    this._status = 'SUSPENDED';
    this._updatedAt = new Date();
  }

  updateLastLogin(): void {
    this._lastLoginAt = new Date();
    this._updatedAt = new Date();
  }

  changeRole(newRole: UserRole): void {
    this._role = newRole;
    this._updatedAt = new Date();
  }
}
```

**File**: `apps/api/src/domain/users/value-objects/email.vo.ts`

```typescript
export class Email {
  private constructor(private readonly _value: string) {}

  static create(value: string): Email {
    const trimmed = value.trim().toLowerCase();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      throw new Error(`Invalid email format: ${value}`);
    }

    return new Email(trimmed);
  }

  get value(): string {
    return this._value;
  }

  equals(other: Email): boolean {
    return this._value === other._value;
  }
}
```

---

#### Task 1.3: Repository Layer (Day 2)

**File**: `apps/api/src/domain/repositories/user.repository.interface.ts`

```typescript
import { User } from '../users/user.entity';

export interface IUserRepository {
  save(tenantId: string, user: User): Promise<void>;
  findById(tenantId: string, userId: string): Promise<User | null>;
  findByEmail(tenantId: string, email: string): Promise<User | null>;
  findAll(
    tenantId: string,
    filters?: {
      role?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<User[]>;
  count(tenantId: string, filters?: { role?: string; status?: string }): Promise<number>;
  update(tenantId: string, user: User): Promise<void>;
  delete(tenantId: string, userId: string): Promise<void>;
  existsByEmail(tenantId: string, email: string): Promise<boolean>;
}
```

**File**: `apps/api/src/infrastructure/database/repositories/user.repository.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { TenantDatabaseService } from '../services/tenant-database.service';
import { tenantUsers } from '../schema/tenant/users.schema';
import { IUserRepository } from '@/domain/repositories/user.repository.interface';
import { User } from '@/domain/users/user.entity';
import { UserMapper } from './mappers/user.mapper';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly tenantDbService: TenantDatabaseService) {}

  async save(tenantId: string, user: User): Promise<void> {
    const db = await this.tenantDbService.getTenantDatabase(tenantId);
    const data = UserMapper.toPersistence(user);

    await db.insert(tenantUsers).values(data);
  }

  async findById(tenantId: string, userId: string): Promise<User | null> {
    const db = await this.tenantDbService.getTenantDatabase(tenantId);

    const results = await db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.id, userId), eq(tenantUsers.deletedAt, null)))
      .limit(1);

    return results[0] ? UserMapper.toDomain(results[0]) : null;
  }

  async findByEmail(tenantId: string, email: string): Promise<User | null> {
    const db = await this.tenantDbService.getTenantDatabase(tenantId);

    const results = await db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.email, email), eq(tenantUsers.deletedAt, null)))
      .limit(1);

    return results[0] ? UserMapper.toDomain(results[0]) : null;
  }

  async findAll(
    tenantId: string,
    filters?: {
      role?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<User[]> {
    const db = await this.tenantDbService.getTenantDatabase(tenantId);

    let query = db.select().from(tenantUsers).where(eq(tenantUsers.deletedAt, null));

    if (filters?.role) {
      query = query.where(eq(tenantUsers.role, filters.role));
    }

    if (filters?.status) {
      query = query.where(eq(tenantUsers.status, filters.status));
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    const results = await query;
    return results.map(UserMapper.toDomain);
  }

  async count(tenantId: string, filters?: { role?: string; status?: string }): Promise<number> {
    const db = await this.tenantDbService.getTenantDatabase(tenantId);

    let query = db.select({ count: sql<number>`COUNT(*)` }).from(tenantUsers);

    const results = await query;
    return results[0]?.count ?? 0;
  }

  async update(tenantId: string, user: User): Promise<void> {
    const db = await this.tenantDbService.getTenantDatabase(tenantId);
    const data = UserMapper.toPersistence(user);

    await db.update(tenantUsers).set(data).where(eq(tenantUsers.id, user.id));
  }

  async delete(tenantId: string, userId: string): Promise<void> {
    const db = await this.tenantDbService.getTenantDatabase(tenantId);

    await db.update(tenantUsers).set({ deletedAt: new Date() }).where(eq(tenantUsers.id, userId));
  }

  async existsByEmail(tenantId: string, email: string): Promise<boolean> {
    const user = await this.findByEmail(tenantId, email);
    return user !== null;
  }
}
```

---

#### Task 1.4: Application Layer - CQRS Commands (Day 2-3)

**File**: `apps/api/src/application/auth/commands/register-user.command.ts`

```typescript
export class RegisterUserCommand {
  constructor(
    public readonly tenantId: string,
    public readonly email: string,
    public readonly password: string,
    public readonly name: string,
  ) {}
}

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly emailService: EmailService,
  ) {}

  async execute(
    command: RegisterUserCommand,
  ): Promise<{ userId: string; requiresVerification: boolean }> {
    // 1. Check if email already exists
    const existingUser = await this.userRepository.findByEmail(command.tenantId, command.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // 2. Check if this is the first user (auto-admin)
    const userCount = await this.userRepository.count(command.tenantId);
    const isFirstUser = userCount === 0;

    // 3. Create user
    const user = await User.create({
      email: command.email,
      password: command.password,
      name: command.name,
      role: isFirstUser ? 'ADMIN' : 'OPERATOR',
    });

    // If first user, auto-verify and activate
    if (isFirstUser) {
      user.verifyEmail(user.emailVerificationCode!);
    }

    // 4. Save to repository
    await this.userRepository.save(command.tenantId, user);

    // 5. Send verification email (if not first user)
    if (!isFirstUser && user.emailVerificationCode) {
      await this.emailService.sendVerificationEmail(
        command.email,
        user.emailVerificationCode,
        command.tenantId,
      );
    }

    return {
      userId: user.id,
      requiresVerification: !isFirstUser,
    };
  }
}
```

**File**: `apps/api/src/application/auth/commands/verify-email.command.ts`

```typescript
export class VerifyEmailCommand {
  constructor(
    public readonly tenantId: string,
    public readonly email: string,
    public readonly code: string,
  ) {}
}

@CommandHandler(VerifyEmailCommand)
export class VerifyEmailHandler {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(command: VerifyEmailCommand): Promise<void> {
    const user = await this.userRepository.findByEmail(command.tenantId, command.email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      return; // Already verified
    }

    user.verifyEmail(command.code);

    await this.userRepository.update(command.tenantId, user);
  }
}
```

---

### Week 2: Login, JWT, and User Management

#### Task 2.1: Login & JWT Authentication (Day 4-5)

**File**: `apps/api/src/application/auth/commands/login.command.ts`

```typescript
export class LoginCommand {
  constructor(
    public readonly tenantId: string,
    public readonly email: string,
    public readonly password: string,
  ) {}
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

@CommandHandler(LoginCommand)
export class LoginHandler {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    // 1. Find user
    const user = await this.userRepository.findByEmail(command.tenantId, command.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2. Check if suspended
    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account suspended');
    }

    // 3. Verify password
    const isPasswordValid = await user.verifyPassword(command.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 4. Check email verification
    if (!user.emailVerified) {
      throw new UnauthorizedException('Email not verified');
    }

    // 5. Generate tokens
    const accessToken = this.generateAccessToken(user, command.tenantId);
    const refreshToken = this.generateRefreshToken(user);

    // 6. Update last login
    user.updateLastLogin();
    await this.userRepository.update(command.tenantId, user);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  private generateAccessToken(user: User, tenantId: string): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId,
    };

    return this.jwtService.sign(payload, {
      expiresIn: '15m', // Short-lived
    });
  }

  private generateRefreshToken(user: User): string {
    const payload = {
      sub: user.id,
      type: 'refresh',
    };

    return this.jwtService.sign(payload, {
      expiresIn: '7d', // Long-lived
    });
  }
}
```

**File**: `apps/api/src/application/auth/commands/refresh-token.command.ts`

```typescript
export class RefreshTokenCommand {
  constructor(
    public readonly tenantId: string,
    public readonly refreshToken: string,
  ) {}
}

@CommandHandler(RefreshTokenCommand)
export class RefreshTokenHandler {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(
    command: RefreshTokenCommand,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // 1. Verify refresh token
    let payload: any;
    try {
      payload = this.jwtService.verify(command.refreshToken);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // 2. Get user
    const user = await this.userRepository.findById(command.tenantId, payload.sub);

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    // 3. Generate new tokens (rotation)
    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role, tenantId: command.tenantId },
      { expiresIn: '15m' },
    );

    const newRefreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: '7d' },
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }
}
```

---

#### Task 2.2: Password Reset Flow (Day 5)

**File**: `apps/api/src/application/auth/commands/forgot-password.command.ts`

```typescript
export class ForgotPasswordCommand {
  constructor(
    public readonly tenantId: string,
    public readonly email: string,
  ) {}
}

@CommandHandler(ForgotPasswordCommand)
export class ForgotPasswordHandler {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly emailService: EmailService,
  ) {}

  async execute(command: ForgotPasswordCommand): Promise<void> {
    const user = await this.userRepository.findByEmail(command.tenantId, command.email);

    // Silent fail if user not found (security best practice)
    if (!user) {
      return;
    }

    const resetToken = user.generatePasswordResetToken();
    await this.userRepository.update(command.tenantId, user);

    await this.emailService.sendPasswordResetEmail(command.email, resetToken, command.tenantId);
  }
}
```

**File**: `apps/api/src/application/auth/commands/reset-password.command.ts`

```typescript
export class ResetPasswordCommand {
  constructor(
    public readonly tenantId: string,
    public readonly token: string,
    public readonly newPassword: string,
  ) {}
}

@CommandHandler(ResetPasswordCommand)
export class ResetPasswordHandler {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    // Find user by reset token (requires adding query method)
    const users = await this.userRepository.findAll(command.tenantId);
    const user = users.find((u) => u.passwordResetToken === command.token);

    if (!user) {
      throw new NotFoundException('Invalid or expired reset token');
    }

    await user.resetPassword(command.token, command.newPassword);

    await this.userRepository.update(command.tenantId, user);
  }
}
```

---

#### Task 2.3: Presentation Layer - Auth Controller (Day 6)

**File**: `apps/api/src/presentation/auth/auth.controller.ts`

```typescript
import { Controller, Post, Body, Res, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Response, Request } from 'express';
import { Public } from '../decorators/public.decorator';
import { TenantContext } from '../decorators/tenant-context.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  @Public()
  @Post('register')
  async register(
    @TenantContext() tenantId: string,
    @Body() dto: RegisterDto,
  ): Promise<RegisterResponseDto> {
    const result = await this.commandBus.execute(
      new RegisterUserCommand(tenantId, dto.email, dto.password, dto.name),
    );

    return {
      userId: result.userId,
      message: result.requiresVerification
        ? 'Registration successful. Please check your email to verify your account.'
        : 'Registration successful. You can now log in.',
    };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @TenantContext() tenantId: string,
    @Body() dto: VerifyEmailDto,
  ): Promise<{ message: string }> {
    await this.commandBus.execute(new VerifyEmailCommand(tenantId, dto.email, dto.code));

    return { message: 'Email verified successfully. You can now log in.' };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @TenantContext() tenantId: string,
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.commandBus.execute(
      new LoginCommand(tenantId, dto.email, dto.password),
    );

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @TenantContext() tenantId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const refreshToken = req.cookies['refreshToken'];

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const result = await this.commandBus.execute(new RefreshTokenCommand(tenantId, refreshToken));

    // Set new refresh token cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response): Promise<{ message: string }> {
    res.clearCookie('refreshToken');
    return { message: 'Logged out successfully' };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @TenantContext() tenantId: string,
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.commandBus.execute(new ForgotPasswordCommand(tenantId, dto.email));

    return {
      message: 'If an account exists with that email, a password reset link has been sent.',
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @TenantContext() tenantId: string,
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.commandBus.execute(new ResetPasswordCommand(tenantId, dto.token, dto.newPassword));

    return { message: 'Password reset successful. You can now log in with your new password.' };
  }
}
```

---

#### Task 2.4: RBAC Guards & Decorators (Day 6-7)

**File**: `apps/api/src/presentation/guards/jwt-auth.guard.ts`

```typescript
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}
```

**File**: `apps/api/src/presentation/guards/roles.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
```

**File**: `apps/api/src/presentation/decorators/roles.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

**File**: `apps/api/src/presentation/decorators/public.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

---

#### Task 2.5: Frontend Authentication (Day 7-8)

**File**: `apps/web/lib/api/auth.api.ts`

```typescript
import { apiClient } from './client';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export const authApi = {
  register: (data: RegisterRequest) => apiClient.post('/auth/register', data),

  verifyEmail: (email: string, code: string) =>
    apiClient.post('/auth/verify-email', { email, code }),

  login: (data: LoginRequest) => apiClient.post<LoginResponse>('/auth/login', data),

  logout: () => apiClient.post('/auth/logout'),

  refresh: () => apiClient.post<{ accessToken: string }>('/auth/refresh'),

  forgotPassword: (email: string) => apiClient.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    apiClient.post('/auth/reset-password', { token, newPassword }),
};
```

**File**: `apps/web/hooks/use-auth.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '@/lib/api/auth.api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setAccessToken: (token: string) => void;
  refreshToken: () => Promise<void>;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        const response = await authApi.login({ email, password });
        set({
          user: response.user,
          accessToken: response.accessToken,
          isAuthenticated: true,
        });
      },

      logout: async () => {
        await authApi.logout();
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
        });
      },

      setAccessToken: (token: string) => {
        set({ accessToken: token });
      },

      refreshToken: async () => {
        try {
          const response = await authApi.refresh();
          set({ accessToken: response.accessToken });
        } catch (error) {
          // Refresh failed, log out
          get().logout();
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        // Don't persist accessToken (security)
      }),
    },
  ),
);
```

**File**: `apps/web/app/(auth)/login/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password);
      toast.success('Logged in successfully');
      router.push('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-6 rounded-lg border p-8">
        <h1 className="text-2xl font-bold">Log in to WellPulse</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label>Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label>Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full" loading={isLoading}>
            Log in
          </Button>
        </form>

        <div className="text-center text-sm">
          Don't have an account?{' '}
          <a href="/register" className="text-blue-600 hover:underline">
            Sign up
          </a>
        </div>
      </div>
    </div>
  );
}
```

---

#### Task 2.6: User Management UI (Day 8-9)

**File**: `apps/web/app/(dashboard)/settings/team/page.tsx`

```typescript
'use client';

import { useUsers } from '@/hooks/use-users';
import { UsersTable } from '@/components/users/users-table';
import { Button } from '@/components/ui/button';
import { Roles } from '@/components/auth/roles';

export default function TeamPage() {
  const { data, isLoading } = useUsers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Team Members</h1>

        <Roles allowedRoles={['ADMIN']}>
          <Button>Invite User</Button>
        </Roles>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <UsersTable users={data?.users || []} />
      )}
    </div>
  );
}
```

---

#### Task 2.7: Rate Limiting (Day 9)

**File**: `apps/api/src/infrastructure/guards/rate-limit.guard.ts`

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  TooManyRequestsException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Redis } from 'ioredis';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly redis: Redis,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip;
    const path = request.path;

    // Rate limit: 5 login attempts per 15 minutes per IP
    if (path === '/auth/login') {
      const key = `rate-limit:login:${ip}`;
      const attempts = await this.redis.incr(key);

      if (attempts === 1) {
        await this.redis.expire(key, 15 * 60); // 15 minutes
      }

      if (attempts > 5) {
        throw new TooManyRequestsException('Too many login attempts. Please try again later.');
      }
    }

    return true;
  }
}
```

---

#### Task 2.8: Email Service Implementation (Day 10)

**File**: `apps/api/src/infrastructure/services/email.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransporter({
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get('SMTP_PORT'),
      secure: this.configService.get('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
  }

  async sendVerificationEmail(email: string, code: string, tenantSlug: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.configService.get('EMAIL_FROM'),
      to: email,
      subject: 'Verify your WellPulse account',
      html: `
        <h1>Welcome to WellPulse!</h1>
        <p>Your verification code is:</p>
        <h2 style="font-size: 32px; letter-spacing: 5px;">${code}</h2>
        <p>This code will expire in 24 hours.</p>
        <p>Or click the link below to verify:</p>
        <a href="https://${tenantSlug}.wellpulse.app/verify-email?email=${encodeURIComponent(email)}&code=${code}">
          Verify Email
        </a>
      `,
    });
  }

  async sendPasswordResetEmail(email: string, token: string, tenantSlug: string): Promise<void> {
    const resetUrl = `https://${tenantSlug}.wellpulse.app/reset-password?token=${token}`;

    await this.transporter.sendMail({
      from: this.configService.get('EMAIL_FROM'),
      to: email,
      subject: 'Reset your WellPulse password',
      html: `
        <h1>Password Reset Request</h1>
        <p>You requested to reset your password. Click the link below to continue:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });
  }
}
```

---

## Testing Strategy

### Unit Tests

```bash
# User entity tests
apps/api/src/domain/users/user.entity.spec.ts
- Create user with valid params
- Verify email with correct code
- Reject expired verification code
- Password hashing and verification
- Generate password reset token
- Reset password with valid token

# Repository tests
apps/api/src/infrastructure/database/repositories/user.repository.spec.ts
- Save new user
- Find user by email
- Find user by ID
- Check email uniqueness
- Soft delete user

# Command handler tests
apps/api/src/application/auth/commands/*.spec.ts
- Register user successfully
- Reject duplicate email
- First user becomes Admin
- Login with valid credentials
- Reject invalid password
- Refresh token rotation
```

### Integration Tests

```bash
# Auth flow E2E tests
apps/api/test/auth/auth.e2e-spec.ts

describe('Authentication', () => {
  it('should register a user and send verification email', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: 'Secure123!',
        name: 'Test User',
      })
      .expect(201);

    expect(response.body.userId).toBeDefined();
  });

  it('should verify email with correct code', async () => {
    // ... test implementation
  });

  it('should login with verified credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Secure123!',
      })
      .expect(200);

    expect(response.body.accessToken).toBeDefined();
    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('should refresh access token with valid refresh token', async () => {
    // ... test implementation
  });

  it('should enforce role-based access control', async () => {
    // Operator tries to access admin route → 403
  });
});
```

---

## Success Criteria

Sprint 2 is complete when:

### Functional

- [ ] Users can register at `{tenant}.wellpulse.app/register`
- [ ] Email verification code sent (check Mailpit at localhost:8025)
- [ ] Users can verify email and activate account
- [ ] First user automatically becomes Admin
- [ ] Users can log in with email/password
- [ ] JWT access token returned, refresh token set as httpOnly cookie
- [ ] Access token expires after 15 minutes
- [ ] Refresh token endpoint generates new tokens
- [ ] Password reset flow works (forgot password → email → reset)
- [ ] RBAC enforced on API endpoints (Admin only routes reject Operators)
- [ ] Admin can view team members
- [ ] Rate limiting prevents brute force login attacks

### Technical

- [ ] ≥80% test coverage on auth module
- [ ] All quality checks pass (lint, format, type-check, tests, build)
- [ ] Zero authentication vulnerabilities (security audit)
- [ ] API latency p95 < 200ms
- [ ] No `any` types in TypeScript

### Documentation

- [ ] API endpoints documented
- [ ] Auth flow diagrams updated
- [ ] Sprint retrospective completed

---

## Dependencies

**Requires Sprint 1 completion:**

- Master database and tenant provisioning
- Subdomain routing middleware
- Tenant database schema migration capability

**Blocks Sprint 3:**

- Sprint 3 (Wells Domain) requires authenticated users to create/manage wells

---

## Risks & Mitigation

| Risk                         | Impact | Mitigation                                     |
| ---------------------------- | ------ | ---------------------------------------------- |
| **Email delivery fails**     | Medium | Use Mailpit for dev, add Resend for production |
| **JWT security issues**      | High   | Use RS256, short expiry, httpOnly cookies      |
| **Password reset abuse**     | Medium | Rate limiting, token expiry, silent fail       |
| **First user admin exploit** | Low    | Validate tenant has no users before granting   |

---

## Next Sprint Preview

**Sprint 3: Wells Domain (Weeks 5-6)**

Once Sprint 2 is complete, Sprint 3 will add:

- Well entity (domain layer with value objects)
- Well CRUD API endpoints
- Well registry UI (list, create, edit)
- RBAC on well operations (Admin/Manager can edit, Operator read-only)

This enables authenticated users to create and manage their first oil & gas domain entity.

---

**Sprint 2 starts now! 🚀**
