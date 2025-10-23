# Pattern 41: REST API Best Practices & Design Patterns

**Version**: 1.0
**Last Updated**: October 8, 2025
**Status**: Active

---

## Table of Contents

1. [Overview](#overview)
2. [URL Design & Resource Naming](#url-design--resource-naming)
3. [HTTP Methods & Status Codes](#http-methods--status-codes)
4. [Request & Response Patterns](#request--response-patterns)
5. [Versioning Strategies](#versioning-strategies)
6. [Error Handling](#error-handling)
7. [Security Patterns](#security-patterns)
8. [Performance Patterns](#performance-patterns)
9. [Documentation Standards](#documentation-standards)
10. [NestJS Implementation](#nestjs-implementation)
11. [Testing REST APIs](#testing-rest-apis)

---

## Overview

This document defines REST API design best practices for the WellPulse project, ensuring consistency, maintainability, and excellent developer experience across all endpoints.

### Core Principles

1. **Resource-Oriented**: APIs should model business resources, not operations
2. **Consistent**: Predictable patterns across all endpoints
3. **Self-Documenting**: Clear, descriptive URLs and responses
4. **Secure**: Authentication, authorization, input validation
5. **Versioned**: Backward compatibility and evolution

### RESTful Maturity Model

**Level 0 - The Swamp of POX**: Single endpoint, single HTTP method
**Level 1 - Resources**: Multiple URIs, single HTTP method
**Level 2 - HTTP Verbs**: Multiple URIs, multiple HTTP methods ✅ **Our Target**
**Level 3 - HATEOAS**: Hypermedia controls (optional for internal APIs)

---

## URL Design & Resource Naming

### 1. Base URL Structure

```
https://api.example.com/api/v1/{resource}
```

**WellPulse Standard**:

```
http://localhost:3001/api/v1/{resource}
```

### 2. Resource Naming Conventions

#### ✅ DO

```
GET    /api/v1/organizations              # Collection
GET    /api/v1/organizations/{id}         # Single resource
POST   /api/v1/organizations              # Create
PUT    /api/v1/organizations/{id}         # Full update
PATCH  /api/v1/organizations/{id}         # Partial update
DELETE /api/v1/organizations/{id}         # Delete
```

**Rules**:

- Use **plural nouns** for collections (`/users`, `/organizations`, `/projects`)
- Use **kebab-case** for multi-word resources (`/pending-users`, `/time-entries`)
- Nest sub-resources when there's a clear parent-child relationship
- Limit nesting to 2 levels for readability

#### ❌ DON'T

```
GET /api/v1/getOrganizations        # Verb in URL
GET /api/v1/organization            # Singular noun
GET /api/v1/Organizations           # PascalCase
GET /api/v1/org                     # Abbreviation
```

### 3. Sub-Resource Patterns

```
GET    /api/v1/organizations/{id}/users           # Nested collection
POST   /api/v1/organizations/{id}/users           # Add user to org
DELETE /api/v1/organizations/{id}/users/{userId}  # Remove user from org
```

**When to Nest**:

- ✅ When the sub-resource ALWAYS belongs to the parent
  - `/organizations/{id}/users` (users always belong to an org)
- ❌ When the sub-resource can exist independently
  - `/users/{id}/organizations` (users can belong to multiple orgs - use query params instead)

### 4. Action Endpoints (When Needed)

Sometimes resources need actions beyond CRUD:

```
POST /api/v1/organizations/{id}/transfer-ownership
POST /api/v1/organizations/{id}/whitelist-domain
POST /api/v1/pending-users/{id}/approve
POST /api/v1/pending-users/{id}/reject
POST /api/v1/invoices/{id}/send
POST /api/v1/projects/{id}/archive
```

**Rules**:

- Use POST for non-idempotent actions
- Use verb phrases after the resource ID
- Keep action names descriptive and business-focused

### 5. Query Parameters

```
GET /api/v1/users?role=ORG_OWNER&status=active&limit=20&offset=0
GET /api/v1/pending-users?status=PENDING&organizationId={id}
GET /api/v1/organizations/{id}/users?role=ADMIN&page=2&pageSize=25
```

**Standard Query Params**:

- **Filtering**: `?status=active&role=ADMIN`
- **Sorting**: `?sortBy=createdAt&order=desc`
- **Pagination**: `?page=2&pageSize=25` or `?limit=25&offset=50`
- **Search**: `?q=searchterm`
- **Field Selection**: `?fields=id,name,email` (sparse fieldsets)

---

## HTTP Methods & Status Codes

### 1. HTTP Method Semantics

| Method     | Purpose                 | Safe? | Idempotent? | Request Body? | Response Body? |
| ---------- | ----------------------- | ----- | ----------- | ------------- | -------------- |
| **GET**    | Retrieve resource(s)    | ✅    | ✅          | ❌            | ✅             |
| **POST**   | Create resource         | ❌    | ❌          | ✅            | ✅             |
| **PUT**    | Replace entire resource | ❌    | ✅          | ✅            | ✅             |
| **PATCH**  | Partial update          | ❌    | ❌          | ✅            | ✅             |
| **DELETE** | Remove resource         | ❌    | ✅          | ❌            | Optional       |

**Safe**: Does not modify server state
**Idempotent**: Multiple identical requests have the same effect as a single request

### 2. Status Code Usage

#### 2xx Success

```typescript
200 OK                    // GET, PUT, PATCH successful with body
201 Created               // POST successful, resource created
204 No Content            // DELETE successful, no response body
```

**Example**:

```typescript
@Post()
@HttpCode(HttpStatus.CREATED)
async create(@Body() dto: CreateOrganizationDto) {
  const organization = await this.commandBus.execute(new CreateOrganizationCommand(...));
  return organization; // Returns 201 with organization in body
}

@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT)
async delete(@Param('id') id: string) {
  await this.commandBus.execute(new DeleteOrganizationCommand(id));
  // Returns 204 with empty body
}
```

#### 3xx Redirection

```typescript
301 Moved Permanently     // Resource permanently moved
302 Found                 // Temporary redirect
304 Not Modified          // Cached resource still valid
```

#### 4xx Client Errors

```typescript
400 Bad Request          // Invalid input, validation failed
401 Unauthorized         // Missing or invalid authentication
403 Forbidden            // Authenticated but not authorized
404 Not Found            // Resource doesn't exist
405 Method Not Allowed   // HTTP method not supported for endpoint
409 Conflict             // Resource conflict (e.g., duplicate email)
422 Unprocessable Entity // Semantic errors (valid syntax, invalid logic)
429 Too Many Requests    // Rate limit exceeded
```

**Example Error Responses**:

```json
{
  "statusCode": 400,
  "message": ["email must be a valid email", "password is too short"],
  "error": "Bad Request"
}

{
  "statusCode": 409,
  "message": "Organization with domain 'acme.com' already exists",
  "error": "Conflict"
}

{
  "statusCode": 403,
  "message": "Only organization owner can transfer ownership",
  "error": "Forbidden"
}
```

#### 5xx Server Errors

```typescript
500 Internal Server Error  // Unexpected server error
501 Not Implemented        // Feature not yet available
503 Service Unavailable    // Temporary unavailability (maintenance, overload)
```

---

## Request & Response Patterns

### 1. Request Body Validation

**Use DTOs with class-validator**:

```typescript
export class CreateOrganizationDto {
  @ApiProperty({
    description: 'Organization name',
    example: 'Acme Corporation',
    minLength: 2,
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Name is required' })
  @IsString({ message: 'Name must be a string' })
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({
    description: 'Primary email domain',
    example: 'acme.com',
  })
  @IsNotEmpty({ message: 'Domain is required' })
  @IsString({ message: 'Domain must be a string' })
  @Matches(/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/, {
    message: 'Invalid domain format',
  })
  @Transform(({ value }) => value?.toLowerCase().trim())
  primaryDomain!: string;

  @ApiPropertyOptional({
    description: 'Organization settings',
  })
  @IsOptional()
  @IsObject({ message: 'Settings must be an object' })
  settings?: {
    timeApprovalRequired?: boolean;
    clientPortalEnabled?: boolean;
    defaultHourlyRate?: number;
  };
}
```

### 2. Response Body Standards

**Consistent Response Structure**:

```typescript
// Single Resource
{
  "id": "uuid",
  "name": "Acme Corporation",
  "slug": "acme-corporation",
  "primaryDomain": "acme.com",
  "ownerId": "uuid",
  "createdAt": "2025-10-08T10:00:00Z",
  "updatedAt": "2025-10-08T10:00:00Z"
}

// Collection
{
  "data": [
    { "id": "uuid", "name": "Org 1", ... },
    { "id": "uuid", "name": "Org 2", ... }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "pageSize": 25,
    "totalPages": 2
  }
}

// Operation Result
{
  "success": true,
  "message": "Ownership transferred successfully",
  "previousOwnerId": "uuid",
  "newOwnerId": "uuid"
}
```

**Response DTO Pattern**:

```typescript
export class OrganizationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  primaryDomain!: string;

  @ApiProperty()
  ownerId!: string;

  @ApiPropertyOptional()
  billing?: BillingInfoDto;

  @ApiPropertyOptional()
  settings?: OrganizationSettingsDto;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  deletedAt?: Date;
}
```

### 3. Timestamp Standards

**Always use ISO 8601 format**:

```json
{
  "createdAt": "2025-10-08T14:30:00.000Z",
  "updatedAt": "2025-10-08T15:45:00.000Z",
  "expiresAt": "2025-10-15T14:30:00.000Z"
}
```

**Never**:

```json
{
  "createdAt": "10/08/2025", // Ambiguous
  "createdAt": 1728393000000, // Unix timestamp (not human-readable)
  "createdAt": "2025-10-08 14:30" // Missing timezone
}
```

---

## Versioning Strategies

### 1. URL Path Versioning (WellPulse Standard)

```
/api/v1/organizations
/api/v2/organizations
```

**Pros**:

- ✅ Clear and visible
- ✅ Easy to route
- ✅ Works with all clients
- ✅ Cacheable

**Implementation**:

```typescript
@Controller('api/v1/organizations')
export class OrganizationController {
  // Version 1 implementation
}

@Controller('api/v2/organizations')
export class OrganizationV2Controller {
  // Version 2 implementation
}
```

### 2. Alternative Versioning Strategies

**Header Versioning**:

```
GET /api/organizations
Accept: application/vnd.company.v1+json
```

**Query Parameter Versioning**:

```
GET /api/organizations?version=1
```

**Media Type Versioning**:

```
Content-Type: application/vnd.company.organization.v1+json
```

### 3. Versioning Best Practices

1. **Version only when breaking changes occur**
   - ✅ Breaking: Removing fields, changing field types, changing URL structure
   - ❌ Non-breaking: Adding optional fields, adding new endpoints

2. **Maintain at least N-1 versions** (current + previous)

3. **Deprecation Policy**:
   ```typescript
   @ApiTags('organizations')
   @ApiDeprecated() // Mark deprecated endpoints
   @Controller('api/v1/organizations')
   export class OrganizationV1Controller {
     @Get()
     @ApiHeader({
       name: 'X-API-Warn',
       description: 'Deprecation warning',
       schema: {
         default: 'This API version will be removed on 2026-01-01. Please upgrade to v2.',
       },
     })
     async list() {
       // ...
     }
   }
   ```

---

## Error Handling

### 1. Standard Error Response Format

```typescript
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format",
      "value": "not-an-email"
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters",
      "value": "***"
    }
  ],
  "error": "Bad Request",
  "timestamp": "2025-10-08T14:30:00.000Z",
  "path": "/api/v1/auth/register"
}
```

### 2. Custom Exception Filter

```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException ? exception.message : 'Internal server error';

    response.status(status).json({
      statusCode: status,
      message,
      error: exception instanceof HttpException ? exception.name : 'Error',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
```

### 3. Domain-Specific Exceptions

```typescript
export class OrganizationNotFoundException extends NotFoundException {
  constructor(organizationId: string) {
    super(`Organization with ID '${organizationId}' not found`);
  }
}

export class DuplicateOrganizationDomainException extends ConflictException {
  constructor(domain: string) {
    super(`Organization with domain '${domain}' already exists`);
  }
}

export class UnauthorizedOrganizationAccessException extends ForbiddenException {
  constructor() {
    super('You do not have permission to access this organization');
  }
}
```

### 4. Validation Error Transformation

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    exceptionFactory: (errors) => {
      const formattedErrors = errors.map((error) => ({
        field: error.property,
        message: Object.values(error.constraints || {}).join(', '),
        value: error.value,
      }));

      return new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        errors: formattedErrors,
        error: 'Bad Request',
      });
    },
  }),
);
```

---

## Security Patterns

### 1. Authentication

```typescript
@Controller('api/v1/organizations')
@UseGuards(JwtAuthGuard) // Require authentication
@ApiBearerAuth('access-token') // Swagger documentation
export class OrganizationController {
  @Post()
  async create(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() user: CurrentUserData, // Extract authenticated user
  ) {
    // user.userId, user.email, user.role, user.organizationId available
  }
}
```

### 2. Authorization

```typescript
@Post(':id/transfer-ownership')
@UseGuards(JwtAuthGuard, TenantGuard)  // Multi-tenancy
async transferOwnership(
  @Param('id', ParseUUIDPipe) organizationId: string,
  @Body() dto: TransferOwnershipDto,
  @TenantContext() tenant: TenantContextData,
  @CurrentUser() user: CurrentUserData,
) {
  // Verify user is updating their own organization
  if (organizationId !== tenant.organizationId) {
    throw new ForbiddenException('Cannot transfer ownership of another organization');
  }

  // Only ORG_OWNER can transfer ownership
  if (user.role !== 'ORG_OWNER') {
    throw new ForbiddenException('Only organization owner can transfer ownership');
  }

  const command = new TransferOwnershipCommand(
    organizationId,
    user.userId,
    dto.newOwnerId,
  );

  await this.commandBus.execute(command);

  return {
    success: true,
    message: 'Ownership transferred successfully',
    previousOwnerId: user.userId,
    newOwnerId: dto.newOwnerId,
  };
}
```

### 3. Input Validation & Sanitization

```typescript
export class CreatePendingUserDto {
  @Transform(({ value }) => value?.toLowerCase().trim())
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @Transform(({ value }) => value?.trim())
  @IsString({ message: 'First name must be a string' })
  @MinLength(1, { message: 'First name must be at least 1 character' })
  @MaxLength(50, { message: 'First name must not exceed 50 characters' })
  firstName!: string;
}
```

### 4. Rate Limiting

```typescript
import { ThrottlerGuard } from '@nestjs/throttler';

@Controller('api/v1/auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    // Limited to configured requests per time window
  }
}
```

---

## Performance Patterns

### 1. Pagination

```typescript
export class PaginationDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize?: number = 25;
}

@Get()
async findAll(@Query() paginationDto: PaginationDto) {
  const skip = (paginationDto.page - 1) * paginationDto.pageSize;
  const organizations = await this.queryBus.execute(
    new GetOrganizationsQuery(skip, paginationDto.pageSize),
  );

  return {
    data: organizations,
    meta: {
      page: paginationDto.page,
      pageSize: paginationDto.pageSize,
      total: organizations.total,
      totalPages: Math.ceil(organizations.total / paginationDto.pageSize),
    },
  };
}
```

### 2. Field Selection (Sparse Fieldsets)

```
GET /api/v1/organizations?fields=id,name,slug
```

```typescript
@Get()
async findAll(@Query('fields') fields?: string) {
  const selectedFields = fields ? fields.split(',') : undefined;
  const organizations = await this.queryBus.execute(
    new GetOrganizationsQuery({ fields: selectedFields }),
  );
  return organizations;
}
```

### 3. Filtering & Sorting

```typescript
export class OrganizationQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['active', 'inactive', 'all'] })
  @IsOptional()
  @IsIn(['active', 'inactive', 'all'])
  status?: 'active' | 'inactive' | 'all';

  @ApiPropertyOptional({ enum: ['name', 'createdAt', 'updatedAt'] })
  @IsOptional()
  @IsIn(['name', 'createdAt', 'updatedAt'])
  sortBy?: 'name' | 'createdAt' | 'updatedAt' = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}
```

### 4. ETag & Conditional Requests

```typescript
@Get(':id')
async getById(
  @Param('id', ParseUUIDPipe) id: string,
  @Headers('if-none-match') ifNoneMatch?: string,
  @Res() res: Response,
) {
  const organization = await this.queryBus.execute(
    new GetOrganizationByIdQuery(id),
  );

  const etag = `"${organization.updatedAt.getTime()}"`;

  if (ifNoneMatch === etag) {
    return res.status(304).send(); // Not Modified
  }

  res.set('ETag', etag);
  res.set('Cache-Control', 'private, max-age=60');
  return res.json(organization);
}
```

---

## Documentation Standards

### 1. OpenAPI/Swagger Decorators

```typescript
@ApiTags('organizations')
@Controller('api/v1/organizations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class OrganizationController {
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new organization',
    description:
      'Manually create a new organization. Regular users auto-create organizations during registration.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Organization successfully created',
    type: OrganizationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Organization with this domain already exists',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  async create(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<OrganizationResponseDto> {
    // Implementation
  }
}
```

### 2. DTO Documentation

```typescript
export class CreateOrganizationDto {
  @ApiProperty({
    description: 'Organization name',
    example: 'Acme Corporation',
    minLength: 2,
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @ApiProperty({
    description: 'Primary email domain for the organization',
    example: 'acme.com',
    pattern: '^[a-z0-9]+([\\-\\.]{1}[a-z0-9]+)*\\.[a-z]{2,}$',
  })
  @IsNotEmpty({ message: 'Domain is required' })
  primaryDomain!: string;

  @ApiPropertyOptional({
    description: 'Organization settings',
    type: 'object',
    example: {
      timeApprovalRequired: true,
      clientPortalEnabled: false,
      defaultHourlyRate: 150,
    },
  })
  @IsOptional()
  settings?: OrganizationSettingsDto;
}
```

---

## NestJS Implementation

### 1. Controller Structure

```typescript
@ApiTags('organizations')
@Controller('api/v1/organizations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class OrganizationController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // Create - POST /api/v1/organizations
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateOrganizationDto, @CurrentUser() user: CurrentUserData) {
    // ...
  }

  // Read Collection - GET /api/v1/organizations
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() queryDto: OrganizationQueryDto) {
    // ...
  }

  // Read Single - GET /api/v1/organizations/:id
  @Get(':id')
  @UseGuards(TenantGuard)
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantContext() tenant: TenantContextData,
  ) {
    // ...
  }

  // Update - PUT /api/v1/organizations/:id
  @Put(':id')
  @UseGuards(TenantGuard)
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
    @TenantContext() tenant: TenantContextData,
    @CurrentUser() user: CurrentUserData,
  ) {
    // ...
  }

  // Delete - DELETE /api/v1/organizations/:id
  @Delete(':id')
  @UseGuards(TenantGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @TenantContext() tenant: TenantContextData) {
    // ...
  }

  // Action - POST /api/v1/organizations/:id/transfer-ownership
  @Post(':id/transfer-ownership')
  @UseGuards(TenantGuard)
  @HttpCode(HttpStatus.OK)
  async transferOwnership(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferOwnershipDto,
    @TenantContext() tenant: TenantContextData,
    @CurrentUser() user: CurrentUserData,
  ) {
    // ...
  }
}
```

### 2. Module Organization

```typescript
@Module({
  imports: [CqrsModule, RepositoriesModule],
  controllers: [OrganizationController],
  providers: [
    // Command handlers
    CreateOrganizationHandler,
    UpdateOrganizationHandler,
    DeleteOrganizationHandler,
    // Query handlers
    GetOrganizationByIdHandler,
    GetOrganizationsHandler,
  ],
})
export class OrganizationModule {}
```

---

## Testing REST APIs

### 1. Unit Tests (Controllers)

```typescript
describe('OrganizationController', () => {
  let controller: OrganizationController;
  let commandBus: CommandBus;
  let queryBus: QueryBus;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationController],
      providers: [
        { provide: CommandBus, useValue: { execute: jest.fn() } },
        { provide: QueryBus, useValue: { execute: jest.fn() } },
      ],
    }).compile();

    controller = module.get<OrganizationController>(OrganizationController);
    commandBus = module.get<CommandBus>(CommandBus);
    queryBus = module.get<QueryBus>(QueryBus);
  });

  it('should create organization with correct parameters', async () => {
    const dto: CreateOrganizationDto = {
      name: 'Acme Corporation',
      primaryDomain: 'acme.com',
    };
    const mockUser: CurrentUserData = {
      userId: 'uuid',
      email: 'owner@acme.com',
      role: 'ORG_OWNER',
      organizationId: 'org-uuid',
    };

    const mockOrganization = { id: 'uuid', ...dto };
    jest.spyOn(commandBus, 'execute').mockResolvedValue(mockOrganization);

    const result = await controller.create(dto, mockUser);

    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerEmail: mockUser.email,
        ownerUserId: mockUser.userId,
        name: dto.name,
      }),
    );
    expect(result).toEqual(mockOrganization);
  });
});
```

### 2. E2E Tests

```typescript
describe('Organization Management - E2E', () => {
  let app: INestApplication;
  let ownerToken: string;
  let ownerUserId: string;
  let organizationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Setup: Create user and login
    // ...
  });

  describe('POST /api/v1/organizations', () => {
    it('should create organization with valid data', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Test Organization',
          primaryDomain: 'testorg.com',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: 'Test Organization',
        slug: 'test-organization',
        primaryDomain: 'testorg.com',
      });

      organizationId = response.body.id;
    });

    it('should reject duplicate domain', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Duplicate Org',
          primaryDomain: 'testorg.com', // Already exists
        })
        .expect(409);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .send({
          name: 'Unauthorized Org',
          primaryDomain: 'unauth.com',
        })
        .expect(401);
    });
  });

  describe('GET /api/v1/organizations/:id', () => {
    it('should retrieve organization by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.id).toBe(organizationId);
    });

    it('should return 404 for non-existent organization', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/organizations/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
```

---

## Summary

### Quick Reference Checklist

#### ✅ URL Design

- [ ] Use plural nouns (`/users`, `/organizations`)
- [ ] Use kebab-case (`/pending-users`)
- [ ] Include version in path (`/api/v1/`)
- [ ] Limit nesting to 2 levels
- [ ] Use action verbs only when necessary

#### ✅ HTTP Methods

- [ ] GET for retrieval (safe, idempotent)
- [ ] POST for creation (non-idempotent)
- [ ] PUT for full replacement (idempotent)
- [ ] PATCH for partial updates
- [ ] DELETE for removal (idempotent)

#### ✅ Status Codes

- [ ] 200 OK for successful GET/PUT/PATCH
- [ ] 201 Created for successful POST
- [ ] 204 No Content for successful DELETE
- [ ] 400 Bad Request for validation errors
- [ ] 401 Unauthorized for missing/invalid auth
- [ ] 403 Forbidden for insufficient permissions
- [ ] 404 Not Found for missing resources
- [ ] 409 Conflict for duplicate resources
- [ ] 500 Internal Server Error for unexpected errors

#### ✅ Security

- [ ] Require authentication (`@UseGuards(JwtAuthGuard)`)
- [ ] Validate and sanitize all inputs
- [ ] Implement authorization checks
- [ ] Use HTTPS in production
- [ ] Implement rate limiting
- [ ] Return generic error messages (don't leak implementation details)

#### ✅ Documentation

- [ ] Use `@ApiTags` for endpoint grouping
- [ ] Add `@ApiOperation` with summary and description
- [ ] Document all `@ApiResponse` codes
- [ ] Use `@ApiProperty` on DTOs
- [ ] Include examples in documentation

#### ✅ Testing

- [ ] Unit test controllers (mock CommandBus/QueryBus)
- [ ] E2E test all endpoints
- [ ] Test authentication requirements
- [ ] Test authorization rules
- [ ] Test validation failures
- [ ] Test error handling

---

## Related Patterns

- **Pattern 03**: [Hexagonal Architecture](./03-Hexagonal-Architecture.md)
- **Pattern 05**: [CQRS Pattern](./05-CQRS-Pattern.md)
- **Pattern 07**: [DTO Pattern](./07-DTO-Pattern.md)
- **Pattern 39**: [Security Patterns Guide](./39-Security-Patterns-Guide.md)

---

## References

- [REST API Design Rulebook (O'Reilly)](https://www.oreilly.com/library/view/rest-api-design/9781449317904/)
- [Microsoft REST API Guidelines](https://github.com/microsoft/api-guidelines)
- [Google API Design Guide](https://cloud.google.com/apis/design)
- [HTTP Status Codes (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [NestJS Documentation](https://docs.nestjs.com/)
- [OpenAPI Specification](https://swagger.io/specification/)

---

**Last Updated**: October 8, 2025
**Version**: 1.0
**Status**: Active
