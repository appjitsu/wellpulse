# Sprint 3: Wells Domain - Well Registry & CRUD Operations

**Duration**: 2 weeks (Week 5-6)
**Status**: ✅ Complete
**Goal**: Implement comprehensive well registry with Domain-Driven Design, CQRS, and full CRUD operations

---

## Objectives

By the end of Sprint 3, we will have:

1. ✅ Well entity with business rules (Domain Layer)
2. ✅ Value Objects for API number and GPS location validation
3. ✅ CQRS commands and queries for well operations
4. ✅ RESTful API endpoints with proper RBAC enforcement
5. ✅ Frontend UI for well management (list, create, edit, delete)
6. ✅ Comprehensive test coverage (≥80%)
7. ✅ Database schema with proper indexes and constraints

**Deliverable**: A fully functional well registry where operators can create, view, update, and delete wells with proper validation and security.

---

## Architecture Overview

### Domain-Driven Design (DDD)

```
┌─────────────────────────────────────────────────┐
│               Well Aggregate                    │
├─────────────────────────────────────────────────┤
│  Well Entity (Root)                             │
│  ├── id: string                                 │
│  ├── name: string                               │
│  ├── apiNumber: ApiNumber (Value Object)       │
│  ├── location: Location (Value Object)         │
│  ├── status: WellStatus                         │
│  ├── lease: string                              │
│  ├── operator: string                           │
│  └── metadata: Record<string, any>             │
│                                                  │
│  Business Rules:                                │
│  ✓ API number must be unique per tenant         │
│  ✓ API number must match format: XX-XXX-XXXXX  │
│  ✓ Location must have valid lat/lon             │
│  ✓ Cannot activate plugged well                 │
│  ✓ Soft delete only (audit trail required)     │
└─────────────────────────────────────────────────┘
```

### Value Objects

**1. ApiNumber Value Object**

```typescript
// Validates Texas Railroad Commission API number format
// Format: 42-165-12345 (District-County-Sequence)
```

**2. Location Value Object**

```typescript
// Validates GPS coordinates
// Latitude: -90 to 90
// Longitude: -180 to 180
// Includes Haversine distance calculation
```

---

## Database Schema

### Wells Table (Tenant Database)

```sql
CREATE TABLE wells (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core Fields
  name VARCHAR(255) NOT NULL,
  api_number VARCHAR(50) NOT NULL UNIQUE,

  -- Location (PostGIS Point would be better for production)
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,

  -- Details
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    -- 'ACTIVE' | 'INACTIVE' | 'PLUGGED'
  lease VARCHAR(255),
  field VARCHAR(255),
  operator VARCHAR(255),

  -- Dates
  spud_date DATE,
  completion_date DATE,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit Trail
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP,
  deleted_by UUID REFERENCES users(id)
);

-- Indexes for Performance
CREATE INDEX idx_wells_api_number ON wells(api_number);
CREATE INDEX idx_wells_status ON wells(status);
CREATE INDEX idx_wells_lease ON wells(lease);
CREATE INDEX idx_wells_location ON wells(latitude, longitude);
CREATE INDEX idx_wells_deleted_at ON wells(deleted_at);
CREATE INDEX idx_wells_created_at ON wells(created_at DESC);

-- Composite Index for Common Query Pattern
CREATE INDEX idx_wells_status_deleted ON wells(status, deleted_at);
```

---

## Tasks

### Week 1: Domain & Infrastructure

#### Task 1.1: Domain Layer - Well Entity (Day 1)

**File**: `apps/api/src/domain/wells/well.entity.ts`

**Responsibilities**:

- Encapsulate well business rules
- Private setters, public getters
- Factory method for creation
- Business logic methods (activate, deactivate, updateLocation)

**Key Methods**:

```typescript
class Well {
  static create(params: CreateWellParams, id?: string): Well;
  activate(): void;
  deactivate(): void;
  plug(): void;
  updateLocation(lat: number, lon: number): void;
  updateName(name: string): void;
  toJSON(): WellJSON;
}
```

**Business Rules**:

1. Cannot activate plugged well
2. API number cannot be changed after creation
3. Location must be valid GPS coordinates
4. Name cannot be empty

**Tests**: `well.entity.spec.ts` (15+ test cases)

---

#### Task 1.2: Value Objects (Day 1)

**File 1**: `apps/api/src/domain/wells/value-objects/api-number.vo.ts`

```typescript
export class ApiNumber {
  private constructor(private readonly _value: string) {}

  static create(value: string): ApiNumber {
    // Texas RRC API format: 42-165-12345
    const regex = /^\d{2}-\d{3}-\d{5}$/;
    if (!regex.test(value)) {
      throw new DomainException(`Invalid API number format: ${value}`);
    }
    return new ApiNumber(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: ApiNumber): boolean {
    return this._value === other._value;
  }
}
```

**File 2**: `apps/api/src/domain/wells/value-objects/location.vo.ts`

```typescript
export class Location {
  private constructor(
    private readonly _latitude: number,
    private readonly _longitude: number,
  ) {}

  static create(latitude: number, longitude: number): Location {
    if (latitude < -90 || latitude > 90) {
      throw new DomainException(`Invalid latitude: ${latitude}`);
    }
    if (longitude < -180 || longitude > 180) {
      throw new DomainException(`Invalid longitude: ${longitude}`);
    }
    return new Location(latitude, longitude);
  }

  get latitude(): number {
    return this._latitude;
  }

  get longitude(): number {
    return this._longitude;
  }

  /**
   * Calculate distance to another location using Haversine formula
   * @returns Distance in miles
   */
  distanceTo(other: Location): number {
    const R = 3958.8; // Earth radius in miles
    const dLat = this.toRadians(other.latitude - this.latitude);
    const dLon = this.toRadians(other.longitude - this.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(this.latitude)) *
        Math.cos(this.toRadians(other.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toJSON() {
    return {
      latitude: this._latitude,
      longitude: this._longitude,
    };
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}
```

**Tests**: `api-number.vo.spec.ts`, `location.vo.spec.ts`

---

#### Task 1.3: Repository Interface (Day 1)

**File**: `apps/api/src/domain/repositories/well.repository.interface.ts`

```typescript
export interface IWellRepository {
  // Queries
  findById(tenantId: string, wellId: string): Promise<Well | null>;
  findByApiNumber(tenantId: string, apiNumber: string): Promise<Well | null>;
  findAll(tenantId: string, filters?: WellFilters): Promise<Well[]>;
  count(tenantId: string, filters?: Omit<WellFilters, 'limit' | 'offset'>): Promise<number>;

  // Commands
  save(tenantId: string, well: Well): Promise<void>;
  update(tenantId: string, well: Well): Promise<void>;
  delete(tenantId: string, wellId: string, deletedBy: string): Promise<void>;
}

export interface WellFilters {
  status?: WellStatus;
  lease?: string;
  field?: string;
  operator?: string;
  search?: string; // Search by name or API number
  limit?: number;
  offset?: number;
}
```

---

#### Task 1.4: Database Schema & Migration (Day 2)

**File**: `apps/api/src/infrastructure/database/schema/tenant/wells.schema.ts`

```typescript
import { pgTable, varchar, uuid, timestamp, decimal, date, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const wells = pgTable('wells', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  apiNumber: varchar('api_number', { length: 50 }).notNull().unique(),

  // Location
  latitude: decimal('latitude', { precision: 10, scale: 7 }).notNull(),
  longitude: decimal('longitude', { precision: 10, scale: 7 }).notNull(),

  // Details
  status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
  lease: varchar('lease', { length: 255 }),
  field: varchar('field', { length: 255 }),
  operator: varchar('operator', { length: 255 }),

  // Dates
  spudDate: date('spud_date'),
  completionDate: date('completion_date'),

  // Metadata
  metadata: jsonb('metadata').default({}),

  // Audit
  createdBy: uuid('created_by').references(() => users.id),
  updatedBy: uuid('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
  deletedBy: uuid('deleted_by').references(() => users.id),
});
```

**Migration Steps**:

```bash
# Generate migration
cd apps/api
pnpm drizzle-kit generate

# User will run: pnpm db:push (per global instructions)
```

---

#### Task 1.5: Repository Implementation (Day 2-3)

**File**: `apps/api/src/infrastructure/database/repositories/well.repository.ts`

**Key Responsibilities**:

- Map between domain entities and database rows
- Use TenantDatabaseService for connection pooling
- Implement soft delete (set deletedAt, never actually delete)
- Optimize queries with proper indexes

**Mapper**: `apps/api/src/infrastructure/database/repositories/mappers/well.mapper.ts`

```typescript
export class WellMapper {
  static toDomain(raw: WellRow): Well {
    return Well.create(
      {
        name: raw.name,
        apiNumber: raw.apiNumber,
        latitude: parseFloat(raw.latitude),
        longitude: parseFloat(raw.longitude),
        status: raw.status as WellStatus,
        lease: raw.lease ?? undefined,
        field: raw.field ?? undefined,
        operator: raw.operator ?? undefined,
        spudDate: raw.spudDate ? new Date(raw.spudDate) : undefined,
        completionDate: raw.completionDate ? new Date(raw.completionDate) : undefined,
        metadata: raw.metadata as Record<string, any>,
      },
      raw.id,
    );
  }

  static toPersistence(well: Well): WellPersistence {
    return {
      id: well.id,
      name: well.name,
      apiNumber: well.apiNumber,
      latitude: well.location.latitude.toString(),
      longitude: well.location.longitude.toString(),
      status: well.status,
      lease: well.lease ?? null,
      // ... other fields
    };
  }
}
```

**Tests**: `well.repository.spec.ts` (mock TenantDatabaseService)

---

### Week 2: Application & Presentation

#### Task 2.1: CQRS Commands (Day 3-4)

**Command 1**: `apps/api/src/application/wells/commands/create-well.command.ts`

```typescript
export class CreateWellCommand {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly data: {
      name: string;
      apiNumber: string;
      latitude: number;
      longitude: number;
      lease?: string;
      field?: string;
      operator?: string;
      spudDate?: string;
      completionDate?: string;
    },
  ) {}
}

@CommandHandler(CreateWellCommand)
export class CreateWellHandler implements ICommandHandler<CreateWellCommand> {
  constructor(private readonly wellRepository: IWellRepository) {}

  async execute(command: CreateWellCommand): Promise<string> {
    // 1. Check if API number already exists
    const existing = await this.wellRepository.findByApiNumber(
      command.tenantId,
      command.data.apiNumber,
    );
    if (existing) {
      throw new ConflictException('Well with this API number already exists');
    }

    // 2. Create domain entity (validates business rules)
    const well = Well.create({
      name: command.data.name,
      apiNumber: command.data.apiNumber,
      latitude: command.data.latitude,
      longitude: command.data.longitude,
      lease: command.data.lease,
      field: command.data.field,
      operator: command.data.operator,
      status: 'ACTIVE',
    });

    // 3. Save to repository
    await this.wellRepository.save(command.tenantId, well);

    return well.id;
  }
}
```

**Command 2**: `update-well.command.ts`
**Command 3**: `delete-well.command.ts`
**Command 4**: `activate-well.command.ts`
**Command 5**: `deactivate-well.command.ts`

**Tests**: `*.command.spec.ts` for each command

---

#### Task 2.2: CQRS Queries (Day 4)

**Query 1**: `apps/api/src/application/wells/queries/get-wells.query.ts`

```typescript
export class GetWellsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly filters?: {
      status?: WellStatus;
      lease?: string;
      field?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ) {}
}

@QueryHandler(GetWellsQuery)
export class GetWellsHandler implements IQueryHandler<GetWellsQuery> {
  constructor(private readonly wellRepository: IWellRepository) {}

  async execute(query: GetWellsQuery): Promise<GetWellsResult> {
    const wells = await this.wellRepository.findAll(query.tenantId, query.filters);
    const total = await this.wellRepository.count(query.tenantId, {
      status: query.filters?.status,
      lease: query.filters?.lease,
      field: query.filters?.field,
      search: query.filters?.search,
    });

    return {
      wells: wells.map((well) => this.toDto(well)),
      total,
    };
  }

  private toDto(well: Well): WellDto {
    return {
      id: well.id,
      name: well.name,
      apiNumber: well.apiNumber,
      latitude: well.location.latitude,
      longitude: well.location.longitude,
      status: well.status,
      lease: well.lease,
      field: well.field,
      operator: well.operator,
      createdAt: well.createdAt.toISOString(),
      updatedAt: well.updatedAt.toISOString(),
    };
  }
}
```

**Query 2**: `get-well-by-id.query.ts`
**Query 3**: `get-well-by-api-number.query.ts`

---

#### Task 2.3: REST API Controller (Day 5)

**File**: `apps/api/src/presentation/wells/wells.controller.ts`

```typescript
@Controller('wells')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Wells')
export class WellsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a new well' })
  @ApiResponse({ status: 201, type: CreateWellResponseDto })
  async createWell(
    @TenantId() tenantId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateWellDto,
  ): Promise<CreateWellResponseDto> {
    const wellId = await this.commandBus.execute(new CreateWellCommand(tenantId, user.userId, dto));

    return { id: wellId, message: 'Well created successfully' };
  }

  @Get()
  @ApiOperation({ summary: 'Get all wells' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'lease', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getWells(
    @TenantId() tenantId: string,
    @Query() query: GetWellsQueryDto,
  ): Promise<GetWellsResponseDto> {
    return this.queryBus.execute(new GetWellsQuery(tenantId, query));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get well by ID' })
  async getWellById(@TenantId() tenantId: string, @Param('id') id: string): Promise<WellDto> {
    const well = await this.queryBus.execute(new GetWellByIdQuery(tenantId, id));

    if (!well) {
      throw new NotFoundException('Well not found');
    }

    return well;
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update well' })
  async updateWell(
    @TenantId() tenantId: string,
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateWellDto,
  ): Promise<{ message: string }> {
    await this.commandBus.execute(new UpdateWellCommand(tenantId, user.userId, id, dto));

    return { message: 'Well updated successfully' };
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete well (soft delete)' })
  async deleteWell(
    @TenantId() tenantId: string,
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    await this.commandBus.execute(new DeleteWellCommand(tenantId, user.userId, id));

    return { message: 'Well deleted successfully' };
  }
}
```

**DTOs**:

- `create-well.dto.ts` (with class-validator decorators)
- `update-well.dto.ts`
- `get-wells-query.dto.ts`
- `well.dto.ts` (response)

**Module**: `apps/api/src/presentation/wells/wells.module.ts`

---

#### Task 2.4: Frontend API Client (Day 5)

**File**: `apps/web/lib/api/wells.api.ts`

```typescript
import { apiClient } from './client';

export interface Well {
  id: string;
  name: string;
  apiNumber: string;
  latitude: number;
  longitude: number;
  status: 'ACTIVE' | 'INACTIVE' | 'PLUGGED';
  lease?: string;
  field?: string;
  operator?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetWellsParams {
  status?: string;
  lease?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export const wellsApi = {
  getWells: async (params?: GetWellsParams) => {
    const response = await apiClient.get<{ wells: Well[]; total: number }>('/wells', {
      params,
    });
    return response.data;
  },

  getWellById: async (id: string) => {
    const response = await apiClient.get<Well>(`/wells/${id}`);
    return response.data;
  },

  createWell: async (data: CreateWellInput) => {
    const response = await apiClient.post<{ id: string }>('/wells', data);
    return response.data;
  },

  updateWell: async (id: string, data: UpdateWellInput) => {
    const response = await apiClient.patch(`/wells/${id}`, data);
    return response.data;
  },

  deleteWell: async (id: string) => {
    const response = await apiClient.delete(`/wells/${id}`);
    return response.data;
  },
};
```

---

#### Task 2.5: React Query Hooks (Day 6)

**File**: `apps/web/hooks/use-wells.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wellsApi, type GetWellsParams } from '../lib/api/wells.api';

export function useWells(params?: GetWellsParams) {
  return useQuery({
    queryKey: ['wells', params],
    queryFn: () => wellsApi.getWells(params),
  });
}

export function useWell(id: string) {
  return useQuery({
    queryKey: ['wells', id],
    queryFn: () => wellsApi.getWellById(id),
    enabled: !!id,
  });
}

export function useCreateWell() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: wellsApi.createWell,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wells'] });
    },
  });
}

export function useUpdateWell() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWellInput }) =>
      wellsApi.updateWell(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['wells'] });
      queryClient.invalidateQueries({ queryKey: ['wells', variables.id] });
    },
  });
}

export function useDeleteWell() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: wellsApi.deleteWell,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wells'] });
    },
  });
}
```

---

#### Task 2.6: Frontend Components (Day 6-7)

**Component 1**: `apps/web/components/wells/wells-table.tsx`

```typescript
'use client';

import { useWells, useDeleteWell } from '@/hooks/use-wells';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function WellsTable() {
  const { data, isLoading } = useWells();
  const deleteWell = useDeleteWell();

  if (isLoading) return <div>Loading...</div>;

  return (
    <table className="w-full">
      <thead>
        <tr>
          <th>Name</th>
          <th>API Number</th>
          <th>Status</th>
          <th>Lease</th>
          <th>Location</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {data?.wells.map((well) => (
          <tr key={well.id}>
            <td>{well.name}</td>
            <td>{well.apiNumber}</td>
            <td>
              <Badge variant={getStatusColor(well.status)}>
                {well.status}
              </Badge>
            </td>
            <td>{well.lease}</td>
            <td>
              {well.latitude.toFixed(4)}, {well.longitude.toFixed(4)}
            </td>
            <td>
              <Button onClick={() => router.push(`/wells/${well.id}`)}>
                View
              </Button>
              <Button onClick={() => router.push(`/wells/${well.id}/edit`)}>
                Edit
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteWell.mutate(well.id)}
              >
                Delete
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**Component 2**: `apps/web/components/wells/create-well-form.tsx`

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateWell } from '@/hooks/use-wells';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const createWellSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  apiNumber: z.string().regex(/^\d{2}-\d{3}-\d{5}$/, 'Invalid API number format'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  lease: z.string().optional(),
  field: z.string().optional(),
  operator: z.string().optional(),
});

export function CreateWellForm() {
  const form = useForm({
    resolver: zodResolver(createWellSchema),
  });

  const createWell = useCreateWell();

  const onSubmit = (data: z.infer<typeof createWellSchema>) => {
    createWell.mutate(data, {
      onSuccess: () => {
        toast.success('Well created successfully');
        router.push('/wells');
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Well Name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Smith Ranch #3" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="apiNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>API Number</FormLabel>
              <FormControl>
                <Input {...field} placeholder="42-165-12345" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="latitude"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Latitude</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    step="0.0000001"
                    placeholder="31.7619"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="longitude"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Longitude</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    step="0.0000001"
                    placeholder="-102.3421"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" disabled={createWell.isPending}>
          {createWell.isPending ? 'Creating...' : 'Create Well'}
        </Button>
      </form>
    </Form>
  );
}
```

---

#### Task 2.7: Frontend Pages (Day 7)

**Page 1**: `apps/web/app/(dashboard)/wells/page.tsx`

```typescript
'use client';

import { useWells } from '@/hooks/use-wells';
import { WellsTable } from '@/components/wells/wells-table';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function WellsPage() {
  const router = useRouter();
  const { data, isLoading } = useWells();

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Wells</h1>
          <p className="text-gray-600">Manage your well inventory</p>
        </div>
        <Button onClick={() => router.push('/wells/new')}>
          Add Well
        </Button>
      </div>

      {isLoading ? (
        <div>Loading wells...</div>
      ) : (
        <>
          <WellsTable wells={data?.wells || []} />
          <div className="text-sm text-gray-600">
            Showing {data?.wells.length} of {data?.total} wells
          </div>
        </>
      )}
    </div>
  );
}
```

**Page 2**: `apps/web/app/(dashboard)/wells/new/page.tsx`

```typescript
import { CreateWellForm } from '@/components/wells/create-well-form';

export default function CreateWellPage() {
  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Create New Well</h1>
      <CreateWellForm />
    </div>
  );
}
```

**Page 3**: `apps/web/app/(dashboard)/wells/[id]/page.tsx` (View well details)
**Page 4**: `apps/web/app/(dashboard)/wells/[id]/edit/page.tsx` (Edit well)

---

## Testing Strategy

### Unit Tests (≥80% Coverage)

**Domain Layer**:

- `well.entity.spec.ts` - 15+ test cases
  - Creation with valid data
  - Validation errors (invalid API number, invalid location)
  - Business rules (cannot activate plugged well, etc.)
  - State transitions (activate, deactivate, plug)

- `api-number.vo.spec.ts` - 10+ test cases
  - Valid format
  - Invalid formats
  - Equality checks

- `location.vo.spec.ts` - 10+ test cases
  - Valid coordinates
  - Invalid latitude/longitude
  - Distance calculation (Haversine)

**Application Layer**:

- `create-well.command.spec.ts`
- `update-well.command.spec.ts`
- `delete-well.command.spec.ts`
- `get-wells.query.spec.ts`
- `get-well-by-id.query.spec.ts`

**Infrastructure Layer**:

- `well.repository.spec.ts` - Mock TenantDatabaseService

**Presentation Layer**:

- `wells.controller.spec.ts` - Mock CommandBus and QueryBus

### E2E Tests

**File**: `apps/api/test/wells/wells.e2e-spec.ts`

```typescript
describe('Wells (e2e)', () => {
  let app: INestApplication;
  let testTenant: Tenant;
  let testUser: User;
  let accessToken: string;

  beforeAll(async () => {
    // Setup test environment
  });

  it('should create a new well', async () => {
    const response = await request(app.getHttpServer())
      .post('/wells')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Tenant-Subdomain', testTenant.subdomain)
      .send({
        name: 'Test Well #1',
        apiNumber: '42-165-00001',
        latitude: 31.7619,
        longitude: -102.3421,
        lease: 'Test Lease',
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
  });

  it('should reject duplicate API number', async () => {
    await request(app.getHttpServer())
      .post('/wells')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Tenant-Subdomain', testTenant.subdomain)
      .send({
        name: 'Duplicate Well',
        apiNumber: '42-165-00001', // Same as above
        latitude: 31.7619,
        longitude: -102.3421,
      })
      .expect(409); // Conflict
  });

  it('should get wells with pagination', async () => {
    const response = await request(app.getHttpServer())
      .get('/wells?limit=10&offset=0')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Tenant-Subdomain', testTenant.subdomain)
      .expect(200);

    expect(response.body).toHaveProperty('wells');
    expect(response.body).toHaveProperty('total');
  });

  it('should update well', async () => {
    const wellId = 'test-well-id';
    await request(app.getHttpServer())
      .patch(`/wells/${wellId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Tenant-Subdomain', testTenant.subdomain)
      .send({
        name: 'Updated Well Name',
      })
      .expect(200);
  });

  it('should enforce RBAC (Operator cannot create well)', async () => {
    // Login as Operator
    const operatorToken = 'operator-token';

    await request(app.getHttpServer())
      .post('/wells')
      .set('Authorization', `Bearer ${operatorToken}`)
      .set('X-Tenant-Subdomain', testTenant.subdomain)
      .send({
        name: 'Unauthorized Well',
        apiNumber: '42-165-99999',
        latitude: 31.7619,
        longitude: -102.3421,
      })
      .expect(403); // Forbidden
  });
});
```

---

## Quality Checks

Before marking Sprint 3 complete, run:

```bash
pnpm format       # Prettier
pnpm lint         # ESLint (0 errors)
pnpm type-check   # TypeScript (must pass)
pnpm test         # ≥80% coverage
pnpm build        # Must succeed
```

Or use the `/quality-fast` command to run all checks in parallel.

---

## Success Criteria

Sprint 3 is complete when:

### Backend

- [x] Well entity with business rules implemented
- [x] ApiNumber and Location value objects with validation
- [x] All CQRS commands and queries implemented
- [x] RESTful API with Swagger documentation
- [x] RBAC enforced (Admin/Manager can create, Operator read-only)
- [x] Unit tests: ≥80% coverage (693 passing tests)
- [x] E2E tests: Full CRUD workflow tested (37 comprehensive scenarios)

### Frontend

- [x] Wells list page with table
- [x] Create well form with validation
- [x] Edit well form
- [x] View well details page
- [x] Delete confirmation dialog
- [x] React Query integration with optimistic updates

### Database

- [x] Wells table created with indexes
- [x] Soft delete implemented
- [x] Audit trail (createdBy, updatedBy, deletedBy)

### Quality

- [x] All quality checks passing
- [x] Zero TypeScript errors
- [x] API latency p95 < 200ms
- [x] No security vulnerabilities

---

## Patterns Used

| Pattern                    | Location                         | Purpose                                |
| -------------------------- | -------------------------------- | -------------------------------------- |
| **Hexagonal Architecture** | Overall structure                | Layer separation, dependency inversion |
| **Domain-Driven Design**   | `domain/wells/`                  | Business logic in domain layer         |
| **Value Objects**          | `value-objects/`                 | Immutable, self-validating types       |
| **CQRS**                   | `application/wells/`             | Separate reads and writes              |
| **Repository Pattern**     | `repositories/`                  | Data access abstraction                |
| **Mapper Pattern**         | `mappers/`                       | Domain ↔ Persistence translation      |
| **Soft Delete**            | `deleted_at` column              | Audit trail, never hard delete         |
| **Optimistic Locking**     | `updated_at` comparison (future) | Prevent concurrent update conflicts    |

---

## Blockers & Risks

| Risk                                | Impact | Mitigation                                |
| ----------------------------------- | ------ | ----------------------------------------- |
| API number format varies by state   | Medium | Make regex configurable per tenant        |
| Location validation (international) | Low    | GPS validation works globally             |
| Duplicate API numbers               | High   | Unique constraint + proper error handling |
| Soft delete complicates queries     | Medium | Always filter `WHERE deleted_at IS NULL`  |

---

## Next Sprint Preview

**Sprint 4: Map Interface (Weeks 7-8)**

Once Sprint 3 is complete, Sprint 4 will implement:

- Interactive map with Mapbox GL JS
- Plot wells as markers (color-coded by status)
- Clustering for performance (10,000+ wells)
- Click well → popup with details
- Search and filter wells on map
- Heat map visualization (optional)

This will provide a visual interface for operators to see all their wells geographically.

---

**Sprint 3 starts now! Let's build the wells domain! 🛢️**
