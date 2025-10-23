# WellPulse Testing Strategy

**Version**: 1.0
**Last Updated**: October 23, 2025
**Status**: Active

---

## Overview

This document defines the comprehensive testing strategy for WellPulse, covering unit tests, integration tests, end-to-end tests, and performance tests across all 6 applications.

### Testing Pyramid

```
                    ┌────────────┐
                    │    E2E     │  10% (User workflows)
                    │  (100 tests│
                    └────────────┘
                  ┌──────────────────┐
                  │   Integration    │  20% (API + DB integration)
                  │    (300 tests)   │
                  └──────────────────┘
              ┌────────────────────────────┐
              │        Unit Tests          │  70% (Business logic)
              │       (1000+ tests)        │
              └────────────────────────────┘
```

### Coverage Targets

| Layer | Target Coverage | Priority |
|-------|----------------|----------|
| **Domain Layer** | 100% | Critical - Contains all business rules |
| **Application Layer** | 95% | High - CQRS handlers and use cases |
| **Infrastructure Layer** | 80% | Medium - Repository implementations |
| **Presentation Layer** | 70% | Medium - Controllers and DTOs |
| **Frontend Components** | 80% | High - UI logic and user interactions |
| **Frontend Hooks** | 90% | High - Business logic and state management |
| **Overall Target** | 80%+ | Required for production deployment |

---

## Backend Testing (NestJS API)

### Unit Tests

**Location**: `apps/api/src/**/*.spec.ts`

**Test Focus**: Pure business logic without external dependencies

**Tools**:
- Jest 29+
- ts-jest (TypeScript support)
- @nestjs/testing (NestJS utilities)

#### Domain Layer Tests

**Purpose**: Verify business rules, invariants, and domain logic

**Example: Well Entity Tests**

```typescript
// apps/api/src/domain/wells/well.entity.spec.ts
import { Well } from './well.entity';
import { ApiNumber } from './value-objects/api-number.vo';
import { Location } from './value-objects/location.vo';

describe('Well Entity', () => {
  describe('create', () => {
    it('should create a well with valid data', () => {
      const well = Well.create({
        name: 'Test Well #1',
        apiNumber: '42-165-12345',
        latitude: 31.8457,
        longitude: -102.3676,
        status: 'ACTIVE',
        lease: 'Acme Lease',
      });

      expect(well.name).toBe('Test Well #1');
      expect(well.apiNumber).toBeInstanceOf(ApiNumber);
      expect(well.location).toBeInstanceOf(Location);
      expect(well.status).toBe('ACTIVE');
    });

    it('should throw error for invalid API number format', () => {
      expect(() =>
        Well.create({
          name: 'Test Well',
          apiNumber: 'INVALID', // Invalid format
          latitude: 31.8457,
          longitude: -102.3676,
        }),
      ).toThrow('Invalid API number format');
    });

    it('should throw error for latitude out of range', () => {
      expect(() =>
        Well.create({
          name: 'Test Well',
          apiNumber: '42-165-12345',
          latitude: 95.0, // Out of range [-90, 90]
          longitude: -102.3676,
        }),
      ).toThrow('Latitude must be between -90 and 90');
    });
  });

  describe('activate', () => {
    it('should activate an inactive well', () => {
      const well = Well.create({
        name: 'Test Well',
        apiNumber: '42-165-12345',
        latitude: 31.8457,
        longitude: -102.3676,
        status: 'INACTIVE',
      });

      well.activate();

      expect(well.status).toBe('ACTIVE');
    });

    it('should throw error when activating a plugged well', () => {
      const well = Well.create({
        name: 'Test Well',
        apiNumber: '42-165-12345',
        latitude: 31.8457,
        longitude: -102.3676,
        status: 'PLUGGED',
      });

      expect(() => well.activate()).toThrow('Cannot activate plugged well');
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two wells', () => {
      const well1 = Well.create({
        name: 'Well 1',
        apiNumber: '42-165-12345',
        latitude: 31.8457,
        longitude: -102.3676,
      });

      const well2 = Well.create({
        name: 'Well 2',
        apiNumber: '42-165-12346',
        latitude: 31.8567,  // ~0.75 miles north
        longitude: -102.3676,
      });

      const distance = well1.calculateDistanceTo(well2);

      expect(distance).toBeCloseTo(0.75, 1); // Within 0.1 miles
    });
  });
});
```

#### Application Layer Tests (CQRS)

**Purpose**: Verify command/query handlers orchestrate correctly

**Example: Create Well Command Handler Tests**

```typescript
// apps/api/src/application/wells/commands/create-well/create-well.handler.spec.ts
import { Test } from '@nestjs/testing';
import { CreateWellHandler } from './create-well.handler';
import { IWellRepository } from '../../../../domain/repositories/well.repository.interface';

describe('CreateWellHandler', () => {
  let handler: CreateWellHandler;
  let repository: jest.Mocked<IWellRepository>;

  beforeEach(async () => {
    // Create mock repository
    const mockRepository = {
      save: jest.fn(),
      findByApiNumber: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        CreateWellHandler,
        { provide: 'IWellRepository', useValue: mockRepository },
      ],
    }).compile();

    handler = module.get(CreateWellHandler);
    repository = module.get('IWellRepository');
  });

  it('should create a well when API number is unique', async () => {
    const command = {
      tenantId: 'acme',
      name: 'Test Well',
      apiNumber: '42-165-12345',
      latitude: 31.8457,
      longitude: -102.3676,
      userId: 'user-123',
    };

    repository.findByApiNumber.mockResolvedValue(null); // No existing well
    repository.save.mockResolvedValue(undefined);

    const result = await handler.execute(command);

    expect(result).toHaveProperty('wellId');
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Well',
        apiNumber: expect.any(Object),
      }),
    );
  });

  it('should throw error when API number already exists', async () => {
    const command = {
      tenantId: 'acme',
      name: 'Test Well',
      apiNumber: '42-165-12345',
      latitude: 31.8457,
      longitude: -102.3676,
      userId: 'user-123',
    };

    repository.findByApiNumber.mockResolvedValue({
      /* existing well */
    } as any);

    await expect(handler.execute(command)).rejects.toThrow(
      'Well with API number 42-165-12345 already exists',
    );
  });
});
```

#### Mocking Strategy

**Repository Mocks**: Always mock at interface level

```typescript
// Good: Mock interface
const mockRepository: jest.Mocked<IWellRepository> = {
  save: jest.fn(),
  findById: jest.fn(),
  findByApiNumber: jest.fn(),
  delete: jest.fn(),
};

// Bad: Mock concrete class (couples tests to implementation)
const mockRepository = new DrizzleWellRepository(/* ... */);
jest.spyOn(mockRepository, 'save');
```

**External Service Mocks**: Use test doubles

```typescript
// Mock Azure Blob Storage
const mockBlobService = {
  generateUploadUrl: jest.fn().mockResolvedValue({
    uploadUrl: 'https://test.blob.core.windows.net/...',
    blobName: 'test.jpg',
    expiresAt: new Date(),
  }),
};
```

---

### Integration Tests

**Location**: `apps/api/src/**/*.integration.spec.ts`

**Test Focus**: Interactions between layers (application → repository → database)

**Tools**:
- Jest
- Test database (PostgreSQL or in-memory)
- Testcontainers (optional, for real PostgreSQL)

#### Database Integration Tests

**Setup**: Use a dedicated test database

```typescript
// apps/api/test/setup.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

let pool: Pool;
let db: ReturnType<typeof drizzle>;

beforeAll(async () => {
  pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'wellpulse_test',
    user: 'postgres',
    password: 'postgres',
  });

  db = drizzle(pool);
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  // Truncate all tables before each test
  await db.execute('TRUNCATE wells CASCADE');
  await db.execute('TRUNCATE production_data CASCADE');
  await db.execute('TRUNCATE equipment CASCADE');
});
```

#### Repository Integration Tests

**Purpose**: Verify repository correctly interacts with database

```typescript
// apps/api/src/infrastructure/database/repositories/well.repository.integration.spec.ts
import { DrizzleWellRepository } from './well.repository';
import { Well } from '../../../domain/wells/well.entity';

describe('DrizzleWellRepository Integration', () => {
  let repository: DrizzleWellRepository;
  let tenantDb: any; // Drizzle instance

  beforeEach(async () => {
    // Initialize test database and repository
    repository = new DrizzleWellRepository(tenantDb);
  });

  describe('save', () => {
    it('should insert a new well into the database', async () => {
      const well = Well.create({
        name: 'Test Well',
        apiNumber: '42-165-12345',
        latitude: 31.8457,
        longitude: -102.3676,
      });

      await repository.save('tenant-123', well);

      // Verify in database
      const saved = await tenantDb
        .select()
        .from(wellsTable)
        .where(eq(wellsTable.id, well.id))
        .limit(1);

      expect(saved).toHaveLength(1);
      expect(saved[0].name).toBe('Test Well');
      expect(saved[0].apiNumber).toBe('42-165-12345');
    });

    it('should update existing well when ID matches', async () => {
      // First insert
      const well = Well.create({
        name: 'Original Name',
        apiNumber: '42-165-12345',
        latitude: 31.8457,
        longitude: -102.3676,
      });
      await repository.save('tenant-123', well);

      // Update
      well.updateName('Updated Name');
      await repository.save('tenant-123', well);

      // Verify update
      const updated = await tenantDb
        .select()
        .from(wellsTable)
        .where(eq(wellsTable.id, well.id))
        .limit(1);

      expect(updated[0].name).toBe('Updated Name');
    });
  });

  describe('findByApiNumber', () => {
    it('should return well when API number exists', async () => {
      // Seed database
      const well = Well.create({
        name: 'Test Well',
        apiNumber: '42-165-12345',
        latitude: 31.8457,
        longitude: -102.3676,
      });
      await repository.save('tenant-123', well);

      // Query
      const found = await repository.findByApiNumber(
        'tenant-123',
        '42-165-12345',
      );

      expect(found).toBeDefined();
      expect(found.name).toBe('Test Well');
    });

    it('should return null when API number does not exist', async () => {
      const found = await repository.findByApiNumber(
        'tenant-123',
        '99-999-99999',
      );

      expect(found).toBeNull();
    });

    it('should not return soft-deleted wells', async () => {
      const well = Well.create({
        name: 'Test Well',
        apiNumber: '42-165-12345',
        latitude: 31.8457,
        longitude: -102.3676,
      });
      await repository.save('tenant-123', well);
      await repository.delete('tenant-123', well.id, 'user-123');

      const found = await repository.findByApiNumber(
        'tenant-123',
        '42-165-12345',
      );

      expect(found).toBeNull();
    });
  });
});
```

#### API Endpoint Integration Tests

**Purpose**: Test full request → response flow (controller → handler → repository → database)

```typescript
// apps/api/test/wells/create-well.integration.spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('POST /wells (Integration)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    // Login to get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'Test123!' });

    authToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create a well with valid data', async () => {
    const response = await request(app.getHttpServer())
      .post('/wells')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Integration Test Well',
        apiNumber: '42-165-99999',
        latitude: 31.8457,
        longitude: -102.3676,
        status: 'ACTIVE',
        lease: 'Test Lease',
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('wellId');
  });

  it('should return 400 for invalid API number format', async () => {
    const response = await request(app.getHttpServer())
      .post('/wells')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Well',
        apiNumber: 'INVALID',
        latitude: 31.8457,
        longitude: -102.3676,
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Invalid API number format');
  });

  it('should return 401 without auth token', async () => {
    const response = await request(app.getHttpServer())
      .post('/wells')
      .send({
        name: 'Test Well',
        apiNumber: '42-165-12345',
        latitude: 31.8457,
        longitude: -102.3676,
      });

    expect(response.status).toBe(401);
  });
});
```

---

### End-to-End Tests (E2E)

**Location**: `apps/api/test/e2e/**/*.e2e-spec.ts`

**Test Focus**: Complete user workflows across multiple endpoints

**Tools**:
- Jest
- Supertest
- Test database

#### User Workflow Tests

**Example: Well Management Workflow**

```typescript
// apps/api/test/e2e/well-management.e2e-spec.ts
describe('Well Management Workflow (E2E)', () => {
  let app: INestApplication;
  let adminToken: string;
  let operatorToken: string;

  beforeAll(async () => {
    // Setup app and create test users
  });

  it('should complete full well lifecycle', async () => {
    // 1. Admin creates a well
    const createResponse = await request(app.getHttpServer())
      .post('/wells')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Test Well',
        apiNumber: '42-165-88888',
        latitude: 31.8457,
        longitude: -102.3676,
      });

    expect(createResponse.status).toBe(201);
    const wellId = createResponse.body.wellId;

    // 2. Operator views well list
    const listResponse = await request(app.getHttpServer())
      .get('/wells')
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.items).toContainEqual(
      expect.objectContaining({ id: wellId }),
    );

    // 3. Operator enters production data
    const productionResponse = await request(app.getHttpServer())
      .post(`/wells/${wellId}/production`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        productionDate: '2025-10-20',
        oilVolume: 42.5,
        gasVolume: 120.0,
        waterVolume: 8.2,
      });

    expect(productionResponse.status).toBe(201);

    // 4. Admin views production summary
    const summaryResponse = await request(app.getHttpServer())
      .get(`/wells/${wellId}/production/summary`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.totalOilVolume).toBe(42.5);

    // 5. Admin deactivates well
    const deactivateResponse = await request(app.getHttpServer())
      .patch(`/wells/${wellId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'INACTIVE' });

    expect(deactivateResponse.status).toBe(200);

    // 6. Verify well is inactive
    const getResponse = await request(app.getHttpServer())
      .get(`/wells/${wellId}`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(getResponse.body.status).toBe('INACTIVE');
  });
});
```

---

## Frontend Testing (Next.js Web)

### Component Tests

**Location**: `apps/web/**/*.test.tsx`

**Test Focus**: Component rendering, user interactions, state management

**Tools**:
- Jest
- React Testing Library
- MSW (Mock Service Worker) for API mocks

#### Component Test Example

```typescript
// apps/web/components/wells/WellCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { WellCard } from './WellCard';

describe('WellCard', () => {
  const mockWell = {
    id: 'well-123',
    name: 'Test Well #1',
    apiNumber: '42-165-12345',
    status: 'ACTIVE',
    latitude: 31.8457,
    longitude: -102.3676,
  };

  it('should render well information', () => {
    render(<WellCard well={mockWell} />);

    expect(screen.getByText('Test Well #1')).toBeInTheDocument();
    expect(screen.getByText('42-165-12345')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('should call onClick when card is clicked', () => {
    const handleClick = jest.fn();
    render(<WellCard well={mockWell} onClick={handleClick} />);

    fireEvent.click(screen.getByTestId('well-card'));

    expect(handleClick).toHaveBeenCalledWith(mockWell.id);
  });

  it('should display correct status badge color', () => {
    const { rerender } = render(<WellCard well={mockWell} />);

    expect(screen.getByTestId('status-badge')).toHaveClass('bg-green-500');

    rerender(<WellCard well={{ ...mockWell, status: 'INACTIVE' }} />);

    expect(screen.getByTestId('status-badge')).toHaveClass('bg-gray-500');
  });
});
```

#### Custom Hook Tests

```typescript
// apps/web/hooks/useWells.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useWells } from './useWells';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('http://localhost:3001/wells', (req, res, ctx) => {
    return res(
      ctx.json({
        items: [
          { id: 'well-1', name: 'Well 1', apiNumber: '42-165-12345' },
          { id: 'well-2', name: 'Well 2', apiNumber: '42-165-12346' },
        ],
        total: 2,
      }),
    );
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('useWells', () => {
  it('should fetch wells successfully', async () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useWells(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data.items).toHaveLength(2);
    expect(result.current.data.items[0].name).toBe('Well 1');
  });

  it('should handle API errors', async () => {
    server.use(
      rest.get('http://localhost:3001/wells', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ error: 'Server error' }));
      }),
    );

    const queryClient = new QueryClient();
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useWells(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });
});
```

### E2E Tests (Playwright)

**Location**: `apps/web/e2e/**/*.spec.ts`

**Test Focus**: Complete user workflows in real browser

**Tools**:
- Playwright

```typescript
// apps/web/e2e/well-management.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Well Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('http://localhost:3000/login');
    await page.fill('[name=email]', 'admin@example.com');
    await page.fill('[name=password]', 'Test123!');
    await page.click('button[type=submit]');
    await page.waitForURL('**/dashboard');
  });

  test('should create a new well', async ({ page }) => {
    // Navigate to wells page
    await page.click('text=Wells');
    await page.waitForURL('**/wells');

    // Click create button
    await page.click('button:has-text("Create Well")');

    // Fill form
    await page.fill('[name=name]', 'Playwright Test Well');
    await page.fill('[name=apiNumber]', '42-165-77777');
    await page.fill('[name=latitude]', '31.8457');
    await page.fill('[name=longitude]', '-102.3676');

    // Submit
    await page.click('button:has-text("Create")');

    // Verify success
    await expect(page.locator('text=Well created successfully')).toBeVisible();
    await expect(
      page.locator('text=Playwright Test Well'),
    ).toBeVisible();
  });

  test('should display well on map', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');

    // Wait for map to load
    await page.waitForSelector('[data-testid=map-container]');

    // Click on well marker
    await page.click('[data-marker-id=well-123]');

    // Verify popup appears
    await expect(page.locator('.mapbox-popup')).toBeVisible();
    await expect(page.locator('text=Test Well #1')).toBeVisible();
  });
});
```

---

## Test Data Management

### Fixture Factories

Use factories to create consistent test data:

```typescript
// apps/api/test/factories/well.factory.ts
import { Well } from '../../src/domain/wells/well.entity';

export class WellFactory {
  static create(overrides?: Partial<any>): Well {
    return Well.create({
      name: 'Test Well',
      apiNumber: '42-165-12345',
      latitude: 31.8457,
      longitude: -102.3676,
      status: 'ACTIVE',
      lease: 'Test Lease',
      ...overrides,
    });
  }

  static createMany(count: number, overrides?: Partial<any>): Well[] {
    return Array.from({ length: count }, (_, i) =>
      this.create({
        name: `Test Well ${i + 1}`,
        apiNumber: `42-165-${12345 + i}`,
        ...overrides,
      }),
    );
  }
}
```

### Database Seeding

**Seed Script**: `apps/api/test/seed.ts`

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { WellFactory } from './factories/well.factory';

export async function seedTestDatabase() {
  const db = drizzle(/* test db connection */);

  // Create test tenant
  await db.insert(tenantsTable).values({
    id: 'test-tenant',
    slug: 'test',
    name: 'Test Tenant',
  });

  // Create test users
  await db.insert(usersTable).values([
    {
      id: 'admin-user',
      email: 'admin@example.com',
      role: 'ADMIN',
    },
    {
      id: 'operator-user',
      email: 'operator@example.com',
      role: 'OPERATOR',
    },
  ]);

  // Create test wells
  const wells = WellFactory.createMany(10);
  for (const well of wells) {
    await db.insert(wellsTable).values({
      id: well.id,
      name: well.name,
      apiNumber: well.apiNumber.value,
      latitude: well.location.latitude,
      longitude: well.location.longitude,
      status: well.status,
    });
  }
}
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 10
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm test --coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  integration-tests:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: wellpulse_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm --filter=api test:integration

  e2e-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm --filter=web playwright install --with-deps
      - run: pnpm --filter=web test:e2e
```

---

## Performance Testing

### Load Tests (Artillery)

**Configuration**: `artillery.yml`

```yaml
config:
  target: 'http://localhost:3001'
  phases:
    - duration: 60
      arrivalRate: 10  # 10 users per second
      name: Warm up
    - duration: 120
      arrivalRate: 50  # 50 users per second
      name: Sustained load
    - duration: 60
      arrivalRate: 100 # 100 users per second (spike)
      name: Spike test

scenarios:
  - name: 'Well CRUD operations'
    flow:
      - post:
          url: '/auth/login'
          json:
            email: 'test@example.com'
            password: 'Test123!'
          capture:
            - json: '$.accessToken'
              as: 'authToken'

      - get:
          url: '/wells'
          headers:
            Authorization: 'Bearer {{ authToken }}'

      - post:
          url: '/wells'
          headers:
            Authorization: 'Bearer {{ authToken }}'
          json:
            name: 'Load Test Well'
            apiNumber: '42-165-{{ $randomString() }}'
            latitude: 31.8457
            longitude: -102.3676
```

### Performance Benchmarks

| Operation | Target | Notes |
|-----------|--------|-------|
| **API Response Time (p95)** | < 200ms | 95th percentile |
| **API Response Time (p99)** | < 500ms | 99th percentile |
| **Map Load (100 wells)** | < 2 seconds | Initial render |
| **Production Chart (90 days)** | < 1 second | Time series render |
| **Database Query** | < 50ms | Single table query |
| **Join Query (3 tables)** | < 100ms | Complex joins |

---

## Test Execution Order

### Local Development

```bash
# 1. Unit tests (fast, run frequently)
pnpm test

# 2. Integration tests (slower, run before commit)
pnpm test:integration

# 3. E2E tests (slowest, run before push)
pnpm test:e2e

# 4. All tests with coverage
pnpm test:all
```

### CI Pipeline

```
1. Lint & Type Check (fail fast)
   ↓
2. Unit Tests (parallel across apps)
   ↓
3. Integration Tests (requires PostgreSQL)
   ↓
4. E2E Tests (requires full stack)
   ↓
5. Performance Tests (optional, nightly)
```

---

## Coverage Reporting

### Code Coverage Tools

- **Backend**: Istanbul (via Jest)
- **Frontend**: Istanbul (via Jest)
- **Reporting**: Codecov or Coveralls

### Coverage Thresholds (package.json)

```json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      },
      "src/domain/**/*.ts": {
        "branches": 100,
        "functions": 100,
        "lines": 100,
        "statements": 100
      }
    }
  }
}
```

---

## Best Practices

### 1. **Test Naming Convention**

```typescript
// Good
describe('Well Entity', () => {
  describe('create', () => {
    it('should create a well with valid data', () => {});
    it('should throw error for invalid API number', () => {});
  });
});

// Bad
describe('Well', () => {
  it('test1', () => {});
  it('test2', () => {});
});
```

### 2. **Arrange-Act-Assert Pattern**

```typescript
it('should activate an inactive well', () => {
  // Arrange
  const well = Well.create({ status: 'INACTIVE', /* ... */ });

  // Act
  well.activate();

  // Assert
  expect(well.status).toBe('ACTIVE');
});
```

### 3. **Test One Thing**

```typescript
// Good: Tests one behavior
it('should throw error when activating plugged well', () => {
  const well = Well.create({ status: 'PLUGGED' });
  expect(() => well.activate()).toThrow();
});

// Bad: Tests multiple behaviors
it('should handle well activation', () => {
  const well1 = Well.create({ status: 'INACTIVE' });
  well1.activate();
  expect(well1.status).toBe('ACTIVE');

  const well2 = Well.create({ status: 'PLUGGED' });
  expect(() => well2.activate()).toThrow();
});
```

### 4. **Avoid Test Interdependence**

```typescript
// Bad: Tests depend on execution order
let wellId: string;

it('should create a well', () => {
  wellId = createWell().id; // Side effect
});

it('should get well by ID', () => {
  const well = getWell(wellId); // Depends on previous test
});

// Good: Each test is independent
it('should create a well', () => {
  const well = createWell();
  expect(well).toBeDefined();
});

it('should get well by ID', () => {
  const well = createWell(); // Fresh data
  const fetched = getWell(well.id);
  expect(fetched).toEqual(well);
});
```

### 5. **Use Descriptive Test Data**

```typescript
// Good
const well = Well.create({
  name: 'High Production Well',
  apiNumber: '42-165-12345',
});

// Bad
const well = Well.create({
  name: 'abc',
  apiNumber: '123',
});
```

---

## Success Criteria

### Phase 1 (End of Sprint 4)

- [ ] ≥80% code coverage (overall)
- [ ] 100% domain layer coverage
- [ ] All unit tests pass (<10 seconds)
- [ ] All integration tests pass (<60 seconds)
- [ ] E2E tests cover authentication and well creation

### Phase 2 (End of Sprint 8)

- [ ] E2E tests cover offline sync workflows
- [ ] Load tests demonstrate 100 req/sec capacity
- [ ] Mobile app tests run on iOS and Android emulators

### Phase 3 (End of Sprint 10)

- [ ] Full E2E coverage of all user workflows
- [ ] Performance tests meet all benchmarks
- [ ] Zero critical bugs in production

---

**Document Owner**: Engineering Team
**Review Schedule**: Every 2 sprints
**Next Review**: End of Sprint 2
