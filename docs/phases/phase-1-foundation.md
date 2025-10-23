# Phase 1: Foundation & Core Platform

**Duration**: 8 weeks (Sprints 1-4)
**Goal**: Multi-tenant SaaS platform with wells management and interactive map
**Status**: 📋 Planning

---

## Overview

Phase 1 establishes the foundational infrastructure for WellPulse and delivers the first user-facing features: tenant signup, authentication, well registry, and interactive map visualization.

**At the end of Phase 1, operators can:**

1. Sign up for WellPulse (tenant provisioning automatic)
2. Log in to their dedicated subdomain (acme.wellpulse.app)
3. Create wells with API numbers, GPS coordinates, and metadata
4. View wells on an interactive map with clustering and heat maps
5. Manage their team (invite users, assign roles)

---

## Architecture Foundation

### Multi-Tenancy

**Database-Per-Tenant Pattern:**

```
┌──────────────────────────────────────┐
│     Master Database                  │
│     wellpulse_master                 │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ Tenants Table                  │  │
│  │ - id, slug, subdomain          │  │
│  │ - database_url, database_name  │  │
│  │ - subscription_tier, status    │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
         ↓ References
┌────────────────┐  ┌────────────────┐
│ acme_wellpulse │  │ permian_wellpulse│
│                │  │                 │
│ - users        │  │ - users         │
│ - wells        │  │ - wells         │
│ - production   │  │ - production    │
└────────────────┘  └────────────────┘
```

**Subdomain Routing:**

```
acme.wellpulse.app → Tenant: ACME Oil & Gas → DB: acme_wellpulse
permian.wellpulse.app → Tenant: Permian Ops → DB: permian_wellpulse
```

### Hexagonal Architecture

```
┌─────────────────────────────────────────────────┐
│           Presentation Layer                    │
│  (Controllers, DTOs, Guards, Middleware)       │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│          Application Layer                      │
│  (Commands, Queries, Use Cases, Handlers)      │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│            Domain Layer                         │
│  (Entities, Value Objects, Business Rules)     │
└────────────────┬────────────────────────────────┘
                 ↑
┌─────────────────────────────────────────────────┐
│        Infrastructure Layer                     │
│  (Repositories, Database, External Services)   │
└─────────────────────────────────────────────────┘
```

---

## Sprint Breakdown

### Sprint 1: Foundation (Weeks 1-2)

**Objective**: Scaffold monorepo, create master database, implement tenant provisioning

#### Tasks

**Week 1: Monorepo Scaffolding**

1. **Initialize Monorepo** (Day 1)

   ```bash
   # Already done - Turborepo + pnpm configured
   pnpm install
   ```

2. **Scaffold NestJS API** (Day 1-2)
   - Install NestJS CLI, create `apps/api`
   - Configure TypeScript, Drizzle ORM
   - Set up module structure (domain, application, infrastructure, presentation)
   - Health check endpoint: `GET /health`

3. **Scaffold Next.js Web** (Day 2)
   - Install Next.js 15, create `apps/web`
   - Configure Tailwind CSS 4, Shadcn UI
   - Set up App Router structure
   - Basic layout with navigation

4. **Scaffold Next.js Admin** (Day 2)
   - Similar to Web app
   - Admin-specific layout

5. **Scaffold Electron, Mobile, ML** (Day 3)
   - Basic project structure (won't build features yet)
   - Electron: package.json, main process skeleton
   - Mobile: Expo init with TypeScript
   - ML: Python venv, requirements.txt, FastAPI hello world

6. **Create Shared Packages** (Day 3)

   ```
   packages/
   ├── typescript-config/   # Shared tsconfig
   ├── eslint-config/       # Shared ESLint rules
   └── database/            # Shared types (Tenant, User, etc.)
   ```

**Week 2: Master Database & Provisioning**

7. **Master Database Schema** (Day 4)
   - Create `tenants`, `admin_users`, `billing_subscriptions`, `usage_metrics` tables
   - Drizzle schema definitions
   - Generate and apply migrations

   ```bash
   cd apps/api
   pnpm drizzle-kit generate:pg
   pnpm drizzle-kit push:pg
   ```

8. **Tenant Provisioning Service** (Day 4-5)
   - `TenantProvisioningService.provisionTenant()`
   - Steps:
     1. Generate slug from tenant name
     2. Create PostgreSQL database
     3. Run tenant schema migrations (empty for now)
     4. Insert tenant record in master DB
   - Error handling (database exists, connection failures)

9. **Subdomain Routing Middleware** (Day 5)
   - `TenantContextMiddleware`
   - Extract subdomain from `Host` header
   - Look up tenant in master DB
   - Attach `req.tenantId` to request context
   - Return 404 if tenant not found/inactive

10. **Docker Compose Environment** (Day 5)
    - PostgreSQL 16 (master + tenants)
    - Redis 7 (caching)
    - Mailpit (email testing)
    - Azurite (Azure Blob Storage emulator for local development)

    ```bash
    docker compose up -d
    ```

**Deliverable**:

- Monorepo with all apps scaffolded
- Master database operational
- API call: `POST /admin/tenants` → new database created automatically
- Subdomain routing extracts tenant context from URL

**Testing**:

```bash
# Create test tenant
curl -X POST http://localhost:3001/admin/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ACME Oil & Gas",
    "contactEmail": "admin@acme.com",
    "subscriptionTier": "STARTER"
  }'

# Verify database created
psql -U postgres -h localhost -c '\l' | grep acme
# Should see: acme-oil-gas_wellpulse

# Test subdomain routing
curl -H "Host: acme.wellpulse.app" http://localhost:3001/health
# Should return: { "status": "ok", "tenantId": "..." }
```

---

### Sprint 2: Authentication (Weeks 3-4)

**Objective**: User registration, login, password reset, RBAC

#### Features

**User Registration**

- Email + password signup
- Email verification (6-digit code)
- Automatic first user becomes Admin
- Additional users require Admin approval (pending state)

**Login/Logout**

- Email + password authentication
- JWT access token (15-minute expiry)
- Refresh token (7-day expiry, httpOnly cookie)
- Token rotation on refresh

**Password Reset**

- Forgot password flow (email with reset link)
- Reset token expires in 1 hour
- Password strength requirements (8+ chars, uppercase, lowercase, number)

**Role-Based Access Control (RBAC)**

- 3 roles: **Admin**, **Manager**, **Operator**
- Stored in `tenant_users` table with `role` column
- Permissions:
  - **Admin**: Full access (user management, billing, wells, production)
  - **Manager**: Read/write wells, production; read-only users
  - **Operator**: Read/write production; read-only wells

#### Database Schema (Tenant DB)

```typescript
// apps/api/src/infrastructure/database/schema/tenant/users.schema.ts
export const tenantUsers = pgTable('tenant_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('OPERATOR'),
  // "ADMIN" | "MANAGER" | "OPERATOR"

  status: varchar('status', { length: 50 }).notNull().default('PENDING'),
  // "PENDING" | "ACTIVE" | "SUSPENDED"

  emailVerified: boolean('email_verified').default(false),
  emailVerificationCode: varchar('email_verification_code', { length: 10 }),
  passwordResetToken: varchar('password_reset_token', { length: 100 }),
  passwordResetExpires: timestamp('password_reset_expires'),

  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

#### API Endpoints

```typescript
// Authentication
POST   /auth/register                    # Register new user
POST   /auth/verify-email                # Verify email with code
POST   /auth/login                       # Login (returns access token + refresh cookie)
POST   /auth/logout                      # Logout (invalidate refresh token)
POST   /auth/refresh                     # Refresh access token
POST   /auth/forgot-password             # Send password reset email
POST   /auth/reset-password              # Reset password with token

// User Management (Admin only)
GET    /users                            # List users (pagination, filters)
GET    /users/:id                        # Get user by ID
PATCH  /users/:id                        # Update user (name, role, status)
DELETE /users/:id                        # Delete user (soft delete)
POST   /users/:id/activate               # Activate pending user
```

#### Frontend Pages

**Web App (`apps/web`):**

```
app/
├── (auth)/
│   ├── login/page.tsx                   # Login form
│   ├── register/page.tsx                # Registration form
│   ├── verify-email/page.tsx            # Email verification
│   ├── forgot-password/page.tsx         # Forgot password
│   └── reset-password/page.tsx          # Reset password
└── (dashboard)/
    ├── layout.tsx                       # Dashboard layout (requires auth)
    ├── page.tsx                         # Dashboard home
    └── settings/
        └── team/page.tsx                # User management (Admin only)
```

**Key Components:**

- `LoginForm` - Email/password with validation
- `RegisterForm` - Multi-step (credentials → email verification)
- `UserTable` - List users with role badges, activate/suspend actions
- `AuthGuard` - Redirect to login if not authenticated
- `RoleGuard` - Show/hide UI based on user role

#### Security Measures

1. **Password Hashing**: bcrypt with 12 rounds
2. **JWT**: RS256 (asymmetric keys), short expiry (15 min)
3. **Refresh Token**: httpOnly cookie, secure, sameSite=strict
4. **Rate Limiting**: 5 login attempts per 15 min per IP
5. **CSRF Protection**: Double-submit cookie pattern
6. **Email Verification**: Required before full access
7. **Password Requirements**: 8+ chars, mixed case, number

**Deliverable**:

- Users can register at `acme.wellpulse.app/register`
- Email verification sent via Mailpit
- Login returns JWT + refresh token
- Dashboard redirects to login if unauthenticated
- Admin can manage team members

**Testing**:

```bash
# Register user
curl -X POST http://acme.localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "operator@acme.com",
    "password": "Secure123!",
    "name": "John Doe"
  }'

# Verify email (check Mailpit at localhost:8025 for code)
curl -X POST http://acme.localhost:3001/auth/verify-email \
  -d '{"email": "operator@acme.com", "code": "123456"}'

# Login
curl -X POST http://acme.localhost:3001/auth/login \
  -c cookies.txt \  # Save cookies
  -d '{"email": "operator@acme.com", "password": "Secure123!"}'

# Access protected route
curl -b cookies.txt http://acme.localhost:3001/users
```

---

### Sprint 3: Wells Domain (Weeks 5-6)

**Objective**: Well registry with CRUD operations

#### Domain Model

**Well Entity (Domain Layer):**

```typescript
// apps/api/src/domain/wells/well.entity.ts
export class Well {
  private constructor(
    public readonly id: string,
    private _name: string,
    private _apiNumber: ApiNumber, // Value Object
    private _location: Location, // Value Object
    private _status: WellStatus,
    private _lease: string,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(params: CreateWellParams, id?: string): Well {
    // Business rule: API number must be unique
    // Business rule: Location must have valid lat/lon
    return new Well(
      id ?? uuid(),
      params.name,
      ApiNumber.create(params.apiNumber),
      Location.create(params.latitude, params.longitude),
      params.status ?? 'ACTIVE',
      params.lease,
      new Date(),
      new Date(),
    );
  }

  // Getters
  get name(): string {
    return this._name;
  }
  get apiNumber(): string {
    return this._apiNumber.value;
  }
  get location(): { latitude: number; longitude: number } {
    return this._location.toJSON();
  }
  get status(): WellStatus {
    return this._status;
  }

  // Business logic methods
  activate(): void {
    if (this._status === 'PLUGGED') {
      throw new Error('Cannot activate plugged well');
    }
    this._status = 'ACTIVE';
    this._updatedAt = new Date();
  }

  deactivate(): void {
    this._status = 'INACTIVE';
    this._updatedAt = new Date();
  }

  updateLocation(latitude: number, longitude: number): void {
    this._location = Location.create(latitude, longitude);
    this._updatedAt = new Date();
  }
}
```

**Value Objects:**

```typescript
// apps/api/src/domain/wells/value-objects/api-number.vo.ts
export class ApiNumber {
  private constructor(private readonly _value: string) {}

  static create(value: string): ApiNumber {
    // Business rule: API number format validation
    // Example: 42-165-12345 (Texas RRC format)
    const regex = /^\d{2}-\d{3}-\d{5}$/;
    if (!regex.test(value)) {
      throw new Error(`Invalid API number format: ${value}`);
    }
    return new ApiNumber(value);
  }

  get value(): string {
    return this._value;
  }
}

// apps/api/src/domain/wells/value-objects/location.vo.ts
export class Location {
  private constructor(
    private readonly _latitude: number,
    private readonly _longitude: number,
  ) {}

  static create(latitude: number, longitude: number): Location {
    // Business rule: Lat/lon must be valid
    if (latitude < -90 || latitude > 90) {
      throw new Error(`Invalid latitude: ${latitude}`);
    }
    if (longitude < -180 || longitude > 180) {
      throw new Error(`Invalid longitude: ${longitude}`);
    }
    return new Location(latitude, longitude);
  }

  get latitude(): number {
    return this._latitude;
  }
  get longitude(): number {
    return this._longitude;
  }

  toJSON() {
    return { latitude: this._latitude, longitude: this._longitude };
  }

  distanceTo(other: Location): number {
    // Haversine formula (distance in miles)
    // ...
  }
}
```

#### Database Schema

```typescript
// apps/api/src/infrastructure/database/schema/tenant/wells.schema.ts
export const wells = pgTable('wells', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  apiNumber: varchar('api_number', { length: 50 }).notNull().unique(),

  // Location
  latitude: decimal('latitude', { precision: 10, scale: 7 }).notNull(),
  longitude: decimal('longitude', { precision: 10, scale: 7 }).notNull(),

  // Details
  status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
  // "ACTIVE" | "INACTIVE" | "PLUGGED"
  lease: varchar('lease', { length: 255 }),
  field: varchar('field', { length: 255 }),
  operator: varchar('operator', { length: 255 }),
  spudDate: date('spud_date'),
  completionDate: date('completion_date'),

  // Metadata
  metadata: jsonb('metadata'), // Custom fields

  // Audit
  createdBy: uuid('created_by').references(() => tenantUsers.id),
  updatedBy: uuid('updated_by').references(() => tenantUsers.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
  deletedBy: uuid('deleted_by').references(() => tenantUsers.id),
});
```

#### CQRS Commands & Queries

**Commands:**

```typescript
// apps/api/src/application/wells/commands/create-well.command.ts
export class CreateWellCommand {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly name: string,
    public readonly apiNumber: string,
    public readonly latitude: number,
    public readonly longitude: number,
    public readonly lease?: string,
  ) {}
}

// Handler
@CommandHandler(CreateWellCommand)
export class CreateWellHandler {
  constructor(private readonly wellRepository: IWellRepository) {}

  async execute(command: CreateWellCommand): Promise<string> {
    // 1. Check if API number already exists
    const existing = await this.wellRepository.findByApiNumber(command.tenantId, command.apiNumber);
    if (existing) {
      throw new ConflictException('API number already exists');
    }

    // 2. Create domain entity
    const well = Well.create({
      name: command.name,
      apiNumber: command.apiNumber,
      latitude: command.latitude,
      longitude: command.longitude,
      lease: command.lease,
      status: 'ACTIVE',
    });

    // 3. Save to repository
    await this.wellRepository.save(command.tenantId, well);

    return well.id;
  }
}
```

**Queries:**

```typescript
// apps/api/src/application/wells/queries/get-wells.query.ts
export class GetWellsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly filters?: {
      status?: WellStatus;
      lease?: string;
      search?: string; // Search by name or API number
      limit?: number;
      offset?: number;
    },
  ) {}
}

// Handler
@QueryHandler(GetWellsQuery)
export class GetWellsHandler {
  constructor(private readonly wellRepository: IWellRepository) {}

  async execute(query: GetWellsQuery): Promise<{ wells: Well[]; total: number }> {
    const wells = await this.wellRepository.findAll(query.tenantId, query.filters);

    const total = await this.wellRepository.count(query.tenantId, query.filters);

    return { wells, total };
  }
}
```

#### API Endpoints

```typescript
// apps/api/src/presentation/wells/wells.controller.ts
@Controller('wells')
@UseGuards(JwtAuthGuard, TenantGuard)
export class WellsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async createWell(
    @Req() req: Request,
    @Body() dto: CreateWellDto,
  ): Promise<CreateWellResponseDto> {
    const wellId = await this.commandBus.execute(
      new CreateWellCommand(
        req.tenantId,
        req.user.id,
        dto.name,
        dto.apiNumber,
        dto.latitude,
        dto.longitude,
        dto.lease,
      ),
    );

    return { id: wellId };
  }

  @Get()
  async getWells(
    @Req() req: Request,
    @Query() query: GetWellsQueryDto,
  ): Promise<GetWellsResponseDto> {
    const result = await this.queryBus.execute(new GetWellsQuery(req.tenantId, query));

    return {
      wells: result.wells.map(WellMapper.toDto),
      total: result.total,
    };
  }

  @Get(':id')
  async getWellById(@Req() req: Request, @Param('id') id: string): Promise<WellDto> {
    const well = await this.queryBus.execute(new GetWellByIdQuery(req.tenantId, id));

    if (!well) {
      throw new NotFoundException('Well not found');
    }

    return WellMapper.toDto(well);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  async updateWell(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateWellDto,
  ): Promise<void> {
    await this.commandBus.execute(new UpdateWellCommand(req.tenantId, req.user.id, id, dto));
  }

  @Delete(':id')
  @Roles('ADMIN')
  async deleteWell(@Req() req: Request, @Param('id') id: string): Promise<void> {
    await this.commandBus.execute(new DeleteWellCommand(req.tenantId, req.user.id, id));
  }
}
```

#### Frontend UI

**Wells List Page:**

```typescript
// apps/web/app/(dashboard)/wells/page.tsx
export default function WellsPage() {
  const { data, isLoading } = useWells({ limit: 50 });

  return (
    <div>
      <Header>
        <h1>Wells</h1>
        <Button onClick={() => router.push('/wells/new')}>
          Add Well
        </Button>
      </Header>

      <WellsTable wells={data?.wells} />
    </div>
  );
}
```

**Create Well Form:**

```typescript
// apps/web/components/wells/create-well-form.tsx
export function CreateWellForm() {
  const form = useForm<CreateWellInput>({
    resolver: zodResolver(createWellSchema),
  });

  const { mutate, isLoading } = useCreateWell();

  const onSubmit = (data: CreateWellInput) => {
    mutate(data, {
      onSuccess: () => {
        toast.success('Well created successfully');
        router.push('/wells');
      },
    });
  };

  return (
    <Form {...form}>
      <FormField name="name" label="Well Name" />
      <FormField name="apiNumber" label="API Number" />
      <FormField name="latitude" label="Latitude" type="number" />
      <FormField name="longitude" label="Longitude" type="number" />
      <FormField name="lease" label="Lease" />
      <FormField name="status" label="Status" type="select" />

      <Button type="submit" loading={isLoading}>
        Create Well
      </Button>
    </Form>
  );
}
```

**Deliverable**:

- API endpoints for well CRUD
- Web UI: wells list, create form, edit form
- Domain logic: API number validation, location validation
- Soft delete (wells are never hard-deleted)

**Testing**:

```bash
# Create well
curl -X POST http://acme.localhost:3001/wells \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Smith Ranch #3",
    "apiNumber": "42-165-12345",
    "latitude": 31.7619,
    "longitude": -102.3421,
    "lease": "Smith Ranch"
  }'

# Get wells
curl http://acme.localhost:3001/wells \
  -H "Authorization: Bearer $TOKEN"

# Update well
curl -X PATCH http://acme.localhost:3001/wells/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status": "INACTIVE"}'
```

---

### Sprint 4: Map Interface (Weeks 7-8)

**Objective**: Interactive map with well visualization

#### Map Features

1. **Basic Map**
   - Mapbox GL JS or Leaflet
   - Permian Basin centered by default
   - Zoom controls, pan, full-screen mode

2. **Well Markers**
   - Plot wells as markers (lat/lon from database)
   - Color-coded by status:
     - 🟢 Green: ACTIVE
     - 🟡 Yellow: INACTIVE
     - 🔴 Red: PLUGGED

3. **Clustering**
   - Group nearby wells when zoomed out
   - Show well count in cluster
   - Expand on click

4. **Popup on Click**
   - Well name, API number, status
   - Lease, spud date
   - Quick actions: View details, Edit

5. **Heat Map (Optional)**
   - Production heat map (wells with higher production = hotter color)
   - Toggle heat map on/off

6. **Search & Filters**
   - Search by well name or API number
   - Filter by status, lease
   - Filtered wells highlighted on map

#### Technical Implementation

**Map Component:**

```typescript
// apps/web/components/map/well-map.tsx
'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

export function WellMap({ wells }: { wells: Well[] }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-102.3421, 31.7619], // Permian Basin
      zoom: 9,
    });

    // Add wells as markers
    wells.forEach((well) => {
      const marker = new mapboxgl.Marker({
        color: getMarkerColor(well.status),
      })
        .setLngLat([well.longitude, well.latitude])
        .setPopup(
          new mapboxgl.Popup().setHTML(`
            <div>
              <h3>${well.name}</h3>
              <p>API: ${well.apiNumber}</p>
              <p>Status: ${well.status}</p>
            </div>
          `),
        )
        .addTo(map.current);
    });

    return () => {
      map.current?.remove();
    };
  }, [wells]);

  return <div ref={mapContainer} className="h-full w-full" />;
}

function getMarkerColor(status: WellStatus): string {
  switch (status) {
    case 'ACTIVE': return '#10b981';    // green
    case 'INACTIVE': return '#f59e0b';  // yellow
    case 'PLUGGED': return '#ef4444';   // red
  }
}
```

**Clustering (Mapbox):**

```typescript
// Add clustering
map.current.addSource('wells', {
  type: 'geojson',
  data: {
    type: 'FeatureCollection',
    features: wells.map((well) => ({
      type: 'Feature',
      properties: { ...well },
      geometry: {
        type: 'Point',
        coordinates: [well.longitude, well.latitude],
      },
    })),
  },
  cluster: true,
  clusterMaxZoom: 14,
  clusterRadius: 50,
});

// Render clusters
map.current.addLayer({
  id: 'clusters',
  type: 'circle',
  source: 'wells',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': '#11b4da',
    'circle-radius': ['step', ['get', 'point_count'], 20, 10, 30, 50, 40],
  },
});

// Render cluster count
map.current.addLayer({
  id: 'cluster-count',
  type: 'symbol',
  source: 'wells',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': '{point_count_abbreviated}',
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
    'text-size': 12,
  },
});
```

**Map Page:**

```typescript
// apps/web/app/(dashboard)/map/page.tsx
export default function MapPage() {
  const { data: wells } = useWells();

  return (
    <div className="h-screen flex flex-col">
      <Header />

      <div className="flex-1 relative">
        {/* Sidebar with filters */}
        <div className="absolute left-4 top-4 z-10 w-80 bg-white rounded-lg shadow-lg p-4">
          <h2>Filters</h2>
          <WellFilters />
          <WellsList wells={wells} compact />
        </div>

        {/* Map */}
        <WellMap wells={wells || []} />
      </div>
    </div>
  );
}
```

**Deliverable**:

- Interactive map showing all tenant wells
- Color-coded markers by status
- Clustering for performance (1000+ wells)
- Click well → popup with details
- Search and filter wells on map

**Performance**:

- Map loads < 2 seconds with 100 wells
- Clustering handles 10,000+ wells
- Smooth panning and zooming

**Testing**:

```bash
# Seed 100 test wells
pnpm --filter=api run db:seed:wells --count=100

# Visit map page
open http://acme.localhost:3000/map

# Test:
# - Wells render on map
# - Click well → popup appears
# - Search by name → map centers on well
# - Filter by status → only matching wells shown
# - Zoom out → wells cluster
```

---

## Phase 1 Completion Criteria

### Functional Requirements

- [ ] 10 test tenants created successfully
- [ ] Each tenant has dedicated subdomain and database
- [ ] 20 users registered across tenants (email verification working)
- [ ] JWT authentication working (login, logout, refresh)
- [ ] RBAC enforced (Admins can manage users, Operators cannot)
- [ ] 100 wells created across tenants
- [ ] Wells displayed on interactive map
- [ ] Map clustering works with 1000+ wells

### Non-Functional Requirements

- [ ] API latency p95 < 200ms
- [ ] Map loads < 2 seconds (100 wells)
- [ ] Zero security vulnerabilities (npm audit, Snyk scan)
- [ ] 80%+ test coverage on API
- [ ] TypeScript strict mode (no `any`)
- [ ] All quality checks pass (lint, format, type-check, tests, build)

### Documentation

- [ ] API endpoints documented (Swagger/OpenAPI)
- [ ] Frontend components documented (Storybook optional)
- [ ] README updated with setup instructions
- [ ] Sprint retrospectives completed

### Deployment

- [ ] Docker Compose environment stable
- [ ] CI/CD pipeline green (GitHub Actions)
- [ ] Staging environment deployed (Railway or Azure)
- [ ] Demo video recorded (5-minute walkthrough)

---

## Risk Management

| Risk                                    | Impact | Mitigation                                         |
| --------------------------------------- | ------ | -------------------------------------------------- |
| **Tenant provisioning fails**           | High   | Retry logic, manual fallback, detailed error logs  |
| **Subdomain routing breaks**            | High   | Fallback to `/tenant/:slug` path-based routing     |
| **Email delivery fails (Mailpit)**      | Medium | Resend integration ready, fallback to console logs |
| **Map performance (1000+ wells)**       | Medium | Clustering, pagination, server-side filtering      |
| **Sprint velocity lower than expected** | High   | Prioritize ruthlessly (map can be simplified)      |

---

## Next Phase Preview

**Phase 2: Field Operations & Offline Sync (Weeks 9-16)**

Once Phase 1 is complete, Phase 2 will add:

- Production data tracking (daily oil/gas/water volumes)
- Equipment management (inventory, maintenance logging)
- Electron desktop app (offline production entry)
- React Native mobile app (GPS-tagged photos)
- Batch sync service (offline → cloud when online)
- Conflict resolution (handle simultaneous edits)

This enables field operators to enter data without internet and sync later.

---

**Phase 1 is the foundation. Let's build it right! 🏗️**
