# Security Audit Assistant

Automated security scanning for RBAC, PII, input validation, and common vulnerabilities.

Analyzes code for security issues and provides remediation guidance.

## What This Command Checks

1. **RBAC (Role-Based Access Control)**
   - Missing @RequirePermissions guards
   - Incorrect permission checks
   - Permission enum usage
   - Organization isolation enforcement

2. **Input Validation**
   - Missing validation decorators
   - SQL injection risks (even with ORM)
   - XSS vulnerabilities
   - Command injection
   - Path traversal

3. **PII (Personally Identifiable Information)**
   - PII logged to console/files
   - PII in error messages
   - Missing data redaction
   - GDPR compliance issues

4. **Authentication & Authorization**
   - Missing authentication guards
   - Weak token validation
   - Session management issues
   - Password handling

5. **Data Exposure**
   - Sensitive fields in responses
   - Missing soft delete checks
   - Direct object reference vulnerabilities

## Usage

```bash
/sec-audit estimate.controller.ts
/sec-audit apps/api/src/presentation/
/sec-audit apps/api/  # Full backend audit
```

## Example Output

```text
🔒 Security Audit: estimate.controller.ts

════════════════════════════════════════════════════════════════

🚨 CRITICAL: Missing RBAC Guard

Location: Line 45
Severity: CRITICAL
Risk: Unauthorized access to sensitive data

Code:
  @Post()
  async createEstimate(@Body() dto: CreateEstimateDto) {
    return this.commandBus.execute(new CreateEstimateCommand(dto));
  }

Problem:
  - No @RequirePermissions decorator
  - Any authenticated user can create estimates
  - Could create estimates for other organizations
  - No role checking (admin vs consultant)

✅ Fix: Add RBAC guard

@Post()
@RequirePermissions(Permission.CREATE_ESTIMATE)  // Add this!
async createEstimate(
  @Body() dto: CreateEstimateDto,
  @CurrentUser() user: UserContext,
) {
  // Also validate organization access
  return this.commandBus.execute(
    new CreateEstimateCommand({
      ...dto,
      organizationId: user.organizationId, // Force user's org
      createdBy: user.userId,
    })
  );
}

Required Permission:
  - Add CREATE_ESTIMATE to permissions.enum.ts
  - Assign to Admin and Manager roles
  - Update RBAC seed data

Files to modify:
  1. apps/api/src/application/auth/abilities/permissions.enum.ts
  2. apps/api/src/shared/constants/canned-roles.constants.ts
  3. apps/api/drizzle/add-estimate-permissions.sql

════════════════════════════════════════════════════════════════

⚠️ MEDIUM: PII Exposure in Logs

Location: Line 67
Severity: MEDIUM
Risk: GDPR violation, data leak

Code:
  this.logger.log(`User ${user.email} created estimate ${estimate.id}`);

Problem:
  - Email address is PII
  - Logged to console/files
  - Could be scraped by attackers
  - Violates GDPR (data minimization)
  - Not necessary for debugging

✅ Fix: Use user ID instead

// Before (❌ logs PII)
this.logger.log(`User ${user.email} created estimate ${estimate.id}`);

// After (✅ no PII)
this.logger.log(`User ${user.userId} created estimate ${estimate.id}`, {
  userId: user.userId,
  estimateId: estimate.id,
  action: 'create_estimate',
});

Best Practice:
  - Never log: email, name, phone, address, SSN, payment info
  - Always log: userIds, organizationIds, resource IDs
  - Use structured logging (JSON) for easy parsing
  - Implement log redaction for sensitive fields

════════════════════════════════════════════════════════════════

⚠️ MEDIUM: Missing Input Validation

Location: Line 23-28
Severity: MEDIUM
Risk: SQL injection, data corruption

DTO:
  export class CreateEstimateDto {
    clientId: string;
    lineItems: EstimateLineItemDto[];
    notes: string;
  }

Problem:
  - No validation decorators
  - clientId not validated (could be SQL injection)
  - notes not sanitized (could be XSS)
  - lineItems not validated (could be empty array)

✅ Fix: Add class-validator decorators

import { IsString, IsUUID, IsArray, ValidateNested, IsOptional, MaxLength, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEstimateDto {
  @IsUUID()
  clientId: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Estimate must have at least one line item' })
  @ValidateNested({ each: true })
  @Type(() => EstimateLineItemDto)
  lineItems: EstimateLineItemDto[];

  @IsString()
  @IsOptional()
  @MaxLength(5000, { message: 'Notes cannot exceed 5000 characters' })
  notes?: string;
}

Validation Rules:
  - UUIDs: @IsUUID()
  - Enums: @IsEnum(EstimateStatus)
  - Numbers: @IsNumber(), @Min(), @Max()
  - Dates: @IsDate() or @IsISO8601()
  - Strings: @IsString(), @MaxLength()
  - Arrays: @IsArray(), @ArrayMinSize(), @ArrayMaxSize()

════════════════════════════════════════════════════════════════

💡 LOW: Soft Delete Not Checked

Location: Line 89
Severity: LOW
Risk: Deleted data exposure

Code:
  async getEstimate(@Param('id') id: string) {
    return this.queryBus.execute(new GetEstimateByIdQuery(id));
  }

Problem:
  - Query might return soft-deleted estimates
  - User could access deleted data via direct ID
  - Breaks "delete" contract with user

✅ Fix: Check deletedAt in query handler

// In GetEstimateByIdHandler
async execute(query: GetEstimateByIdQuery): Promise<Estimate> {
  const estimate = await this.estimateRepository.findById(query.id);

  if (!estimate) {
    throw new NotFoundException('Estimate not found');
  }

  // Check soft delete
  if (estimate.deletedAt) {
    throw new NotFoundException('Estimate not found'); // Don't reveal it was deleted
  }

  // Check organization access
  if (estimate.organizationId !== query.organizationId) {
    throw new ForbiddenException(); // No access
  }

  return estimate;
}

Better: Filter at repository level
  - Add WHERE deletedAt IS NULL to all queries
  - Only soft-deleted queries explicitly include deletedAt

════════════════════════════════════════════════════════════════

📊 SUMMARY

Critical Issues: 1 (Missing RBAC)
Medium Issues: 2 (PII logging, input validation)
Low Issues: 1 (Soft delete)

OWASP Top 10 Risks:
  ✓ A01: Broken Access Control (found 1 issue)
  ✓ A03: Injection (found 1 issue)
  ? A02: Cryptographic Failures (not checked)
  ? A04: Insecure Design (not checked)

Compliance:
  ⚠️ GDPR: PII exposure in logs
  ✓ SOC 2: RBAC enforcement needed
  ✓ PCI DSS: N/A (no payment data in this file)

Required Actions:
  1. Add @RequirePermissions guard (CRITICAL)
  2. Remove PII from logs
  3. Add input validation decorators
  4. Implement soft delete checks
  5. Write security tests
  6. Update documentation

Estimated Effort: 2-3 hours
```

## Security Checklist

Use for every new endpoint/feature:

**Authentication & Authorization:**

- [ ] @RequirePermissions guard applied
- [ ] Correct permission(s) specified
- [ ] Organization isolation enforced
- [ ] Soft delete checked

**Input Validation:**

- [ ] All DTO fields have validation decorators
- [ ] File uploads validated (type, size)
- [ ] Enums validated with @IsEnum()
- [ ] UUIDs validated with @IsUUID()

**Data Protection:**

- [ ] No PII in logs (use userIds, not emails)
- [ ] Sensitive fields excluded from responses
- [ ] Passwords hashed (bcrypt, not MD5/SHA1)
- [ ] Tokens stored securely (httpOnly cookies)

**Common Vulnerabilities:**

- [ ] No SQL injection (use parameterized queries)
- [ ] No XSS (sanitize user input)
- [ ] No path traversal (validate file paths)
- [ ] No command injection (avoid exec/spawn)
- [ ] Rate limiting applied

## Common Security Patterns

### ✅ Good: Permission-Based Access Control

```typescript
@Controller('estimates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EstimateController {
  @Post()
  @RequirePermissions(Permission.CREATE_ESTIMATE)
  async create(@Body() dto: CreateEstimateDto, @CurrentUser() user: UserContext) {
    // organizationId enforced at handler level
    return this.commandBus.execute(
      new CreateEstimateCommand({
        ...dto,
        organizationId: user.organizationId,
      }),
    );
  }

  @Patch(':id')
  @RequirePermissions(Permission.UPDATE_ESTIMATE)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEstimateDto,
    @CurrentUser() user: UserContext,
  ) {
    // Verify estimate belongs to user's organization
    return this.commandBus.execute(
      new UpdateEstimateCommand({
        id,
        ...dto,
        organizationId: user.organizationId,
        updatedBy: user.userId,
      }),
    );
  }
}
```

### ✅ Good: Input Validation

```typescript
export class CreateEstimateDto {
  @IsUUID()
  clientId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EstimateLineItemDto)
  lineItems: EstimateLineItemDto[];

  @IsNumber()
  @Min(0)
  @Max(99999999.99)
  taxRate: number;

  @IsString()
  @MaxLength(5000)
  @IsOptional()
  notes?: string;

  @IsDate()
  @Type(() => Date)
  validUntil: Date;
}
```

### ✅ Good: PII Redaction

```typescript
// Custom logger that auto-redacts PII
export class SecureLogger {
  private readonly piiFields = ['email', 'phone', 'ssn', 'creditCard'];

  log(message: string, context?: Record<string, any>) {
    const redacted = this.redactPII(context);
    this.logger.log(message, redacted);
  }

  private redactPII(obj: any): any {
    if (!obj) return obj;

    const redacted = { ...obj };
    for (const field of this.piiFields) {
      if (redacted[field]) {
        redacted[field] = '[REDACTED]';
      }
    }
    return redacted;
  }
}
```

## After Security Audit

1. **Prioritize by severity** (critical → high → medium → low)
2. **Fix critical issues immediately** (RBAC, injection)
3. **Add security tests**:
   ```typescript
   it('should reject request without permission', async () => {
     const response = await request(app.getHttpServer())
       .post('/estimates')
       .set('Authorization', `Bearer ${consultantToken}`)
       .send(dto)
       .expect(403);
   });
   ```
4. **Document security decisions**
5. **Run automated security scan** (npm audit, Snyk)
6. **Review OWASP Top 10** checklist
7. **Schedule regular security audits**
