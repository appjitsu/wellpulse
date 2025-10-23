# API Contract Validator

Validate API contracts between frontend and backend to prevent breaking changes.

Ensures DTOs, types, and API responses stay in sync across the monorepo.

## What This Command Checks

1. **DTO ↔ Frontend Type Compatibility**
   - Backend DTOs match frontend TypeScript types
   - Required fields are consistent
   - Data types match (string, number, Date, etc.)
   - Enum values are identical

2. **Breaking Changes Detection**
   - Removed fields that frontend uses
   - Renamed fields without migration path
   - Changed field types (string → number)
   - New required fields without defaults

3. **Response Shape Validation**
   - Paginated responses follow standard structure
   - Error responses consistent
   - Status codes match frontend expectations

4. **API Endpoint Documentation**
   - All endpoints have corresponding frontend hooks
   - Deprecated endpoints flagged for removal

## Usage

```bash
/api-validate estimate.controller.ts
/api-validate apps/api/src/presentation/estimate/
/api-validate  # Full API validation
```

## Example Output

```text
🔍 API Contract Validation

Backend Controller: apps/api/src/presentation/estimate/estimate.controller.ts
Frontend Types: apps/web/types/estimate.types.ts
Frontend Hooks: apps/web/hooks/use-estimates.ts

════════════════════════════════════════════════════════════════

✅ COMPATIBLE: GetEstimatesResponse

Backend DTO (estimate-response.dto.ts):
  export class EstimateResponseDto {
    id: string;
    estimateNumber: string;
    clientId: string;
    status: EstimateStatus;
    total: number;
    createdAt: Date;
  }

Frontend Type (estimate.types.ts):
  export interface Estimate {
    id: string;
    estimateNumber: string;
    clientId: string;
    status: EstimateStatus;
    total: number;
    createdAt: Date;
  }

Match: 100% ✓

════════════════════════════════════════════════════════════════

🚨 BREAKING CHANGE DETECTED #1

Endpoint: POST /estimates/:id/accept
Backend DTO: AcceptEstimateDto

Field Removed:
  - clientSignature: string

Backend (CURRENT):
  export class AcceptEstimateDto {
    acceptedBy: string;
    acceptedAt: Date;
    // clientSignature removed!
  }

Frontend Still Expects:
  interface AcceptEstimateRequest {
    acceptedBy: string;
    acceptedAt: Date;
    clientSignature: string; // ❌ Will fail!
  }

Impact:
  - Frontend will send clientSignature
  - Backend will ignore it (no error, but data lost)
  - Acceptance flow may break

✅ Resolution Options:

Option 1: Add field back to backend (if still needed)
  @IsString()
  @IsOptional()
  clientSignature?: string;

Option 2: Remove from frontend (if deprecated)
  // In apps/web/types/estimate.types.ts
  export interface AcceptEstimateRequest {
    acceptedBy: string;
    acceptedAt: Date;
    // Remove: clientSignature
  }

  // Update form component to remove signature field
  // Update use-accept-estimate.ts hook

Option 3: Add migration (gradual transition)
  // Backend accepts both old and new format
  @IsString()
  @IsOptional()
  clientSignature?: string; // deprecated, use digitalSignature

  @IsString()
  @IsOptional()
  digitalSignature?: string; // new field

  // Frontend sends both during transition
  // Remove old field in next sprint

════════════════════════════════════════════════════════════════

⚠️ TYPE MISMATCH #2

Field: validUntil
Backend: Date (object)
Frontend: string (serialized)

Backend Response:
  {
    validUntil: Date // JavaScript Date object
  }

Frontend Type:
  interface Estimate {
    validUntil: string // ❌ Expects ISO string
  }

Problem:
  - Dates are serialized to strings in JSON
  - Frontend receives "2025-10-20T12:00:00Z"
  - TypeScript thinks it's a Date object (type lie)

✅ Fix: Use API response types

// Create separate API response type
export type ApiEstimate = Omit<Estimate, 'validUntil' | 'createdAt' | 'updatedAt'> & {
  validUntil: string;
  createdAt: string;
  updatedAt: string;
};

// Repository maps to proper Date objects
private mapToEntity(apiEstimate: ApiEstimate): Estimate {
  return {
    ...apiEstimate,
    validUntil: new Date(apiEstimate.validUntil),
    createdAt: new Date(apiEstimate.createdAt),
    updatedAt: new Date(apiEstimate.updatedAt),
  };
}

Reference: apps/web/lib/repositories/project.repository.ts (already follows this pattern!)

════════════════════════════════════════════════════════════════

📊 SUMMARY

Compatible Endpoints: 8
Breaking Changes: 1
Type Mismatches: 1
Missing Frontend Types: 0

Affected Files:
  Backend:
    - apps/api/src/presentation/estimate/dto/accept-estimate.dto.ts

  Frontend:
    - apps/web/types/estimate.types.ts
    - apps/web/hooks/use-accept-estimate.ts
    - apps/web/components/estimate/accept-estimate-dialog.tsx

Recommended Actions:
  1. Fix breaking change (decide on Option 1, 2, or 3)
  2. Fix type mismatch (use ApiEstimate pattern)
  3. Update frontend tests
  4. Test end-to-end flow
  5. Update API documentation
```

## Validation Checklist

When creating new endpoints:

**Backend (NestJS Controller):**

- [ ] DTO created with validation decorators
- [ ] Response DTO for successful responses
- [ ] Error responses use standard format
- [ ] OpenAPI decorators added (@ApiResponse)
- [ ] RBAC guard applied (@RequirePermissions)

**Frontend (React Hook):**

- [ ] TypeScript type matches backend DTO
- [ ] Separate API type for date serialization
- [ ] Repository method created
- [ ] React Query hook created
- [ ] Error handling implemented
- [ ] Loading states handled

**Testing:**

- [ ] Backend E2E test for endpoint
- [ ] Frontend MSW mock for API call
- [ ] Integration test with real API

## Date Serialization Pattern

Always use this pattern for dates:

```typescript
// ❌ BAD: Frontend type claims Date but receives string
interface Estimate {
  createdAt: Date; // Lies! Actually receives string from JSON
}

// ✅ GOOD: Separate types for API vs domain
type ApiEstimate = Omit<Estimate, 'createdAt'> & {
  createdAt: string; // Honest about JSON serialization
};

interface Estimate {
  createdAt: Date; // Actual Date object in app
}

// Repository handles mapping
class EstimateRepository {
  async getById(id: string): Promise<Estimate> {
    const response = await apiClient.get<ApiEstimate>(`/estimates/${id}`);
    return this.mapToEntity(response.data);
  }

  private mapToEntity(api: ApiEstimate): Estimate {
    return {
      ...api,
      createdAt: new Date(api.createdAt),
    };
  }
}
```

## Common API Patterns

### Paginated Responses

```typescript
// Backend
export class PaginatedEstimatesResponseDto {
  items: EstimateResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}

// Frontend (matches backend)
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type PaginatedEstimates = PaginatedResponse<Estimate>;
```

### Error Responses

```typescript
// Backend standard format
{
  statusCode: 400,
  message: 'Validation failed',
  errors: [
    { field: 'email', message: 'Invalid email format' }
  ]
}

// Frontend type
interface ApiError {
  statusCode: number;
  message: string;
  errors?: Array<{ field: string; message: string }>;
}
```

## After Validation

If breaking changes found:

1. **Assess impact**: How many frontend files affected?
2. **Choose strategy**:
   - Add field back if needed
   - Update frontend if backend correct
   - Add migration path if complex change
3. **Update both layers** in same commit
4. **Test end-to-end**
5. **Update documentation**
6. **Consider versioning** for public APIs

If no issues:

- Document contract in API docs
- Add integration test to prevent future breaks
