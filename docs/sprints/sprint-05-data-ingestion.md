# Sprint 5 - Data Ingestion Layer

**Phase:** MVP Foundation
**Goal:** Enable operators to get production data into WellPulse without manual entry on every field
**Estimated Time:** 40 hours (5 days)
**Critical for Beta:** YES - This is the #1 friction point for operators

---

## Context

Your current MVP has perfect alerting and nominal ranges, but data entry is the bottleneck. Operators won't manually enter 20 fields daily for 50+ wells. You need at least one automated data source.

**Why this matters for your beta pitch:**

- Operator pain: "I currently export to Excel, send to office, they enter to accounting system" (manual 2-3x)
- Your value: "Upload your Prophet/Enveyo export once per day, alerts + data in dashboard"
- Adoption blocker: If they still have to manually enter oil rate + water + pressure, they won't use it

**Operator data flow reality:**

1. SCADA/historian logs production hourly (they have this)
2. They export to CSV/Excel daily/weekly (Prophet, Enveyo, manual spreadsheet)
3. Someone (office staff) manually enters to accounting system (error-prone)
4. Your MVP: Automate step 2→3 (CSV upload handles it)

**Not MVP (do later):**

- Real-time SCADA connection (complex, each operator has different historian)
- Advanced ETL (handles today, match historical records, etc.)
- Direct historian API (too many variants)

---

## Sprint Objectives

### Primary Goal

Build a robust CSV import pipeline where operators upload production data files, system validates/transforms/imports, and reports results.

### Success Metrics

- [ ] Upload & parse 100-row CSV in <2 seconds
- [ ] Validate 10,000 rows in <30 seconds
- [ ] Handle duplicates gracefully (same well/date = conflict)
- [ ] Generate detailed import report (X accepted, Y failed, Z skipped)
- [ ] Support 5+ common operator export formats (Prophet, Enveyo, Excel, etc.)
- [ ] Batch process overnight without rate limiting
- [ ] Operators can retry failed imports

---

## User Stories

### US-501: CSV Upload & Parse

**As a** small oil operator  
**I want** to upload a CSV file with wells' production data  
**So that** I don't manually enter 50+ wells × 15 fields daily

**Acceptance Criteria:**

- [ ] Mobile app: File picker button opens device file browser
- [ ] Web dashboard: Drag-drop zone or "Select File" button
- [ ] Support files up to 100MB (realistic for 1 year of data, 50 wells)
- [ ] Parse CSV with configurable column mapping
  - "Which column is Oil Rate?"
  - "Which column is Water Cut?"
  - Remember mapping for next upload
- [ ] Auto-detect common Permian formats
  - Prophet: PROD_OIL_RATE, PROD_GAS_RATE, etc.
  - Enveyo: Oil (BBL), Gas (MCF), Water (BBL)
  - Manual Excel: Oil, Gas, Water, BSW, Pressure, Temp
- [ ] Show preview before upload: "Found 450 rows, 12 wells, ready?"
- [ ] Handle edge cases:
  - Empty cells → use null/default
  - Text in number fields → validation error on that row
  - Dates in different formats → normalize
  - Extra whitespace → trim
  - Multiple sheets (Excel) → ask user which sheet
- [ ] Performance: Parse 1000-row file in <5 seconds
- [ ] Memory efficient: Stream parse, don't load entire file

**Technical Implementation:**

**Frontend (Mobile & Web):**

- File picker: `react-native-document-picker` (mobile), native file input (web)
- CSV parsing: `papaparse` library (fast, handles edge cases)
- Column mapping UI:
  - Show CSV column headers
  - Let operator drag-drop to standard fields
  - Show first 3 rows of preview data
  - "Save this mapping" checkbox (remember for future uploads)

**Backend API:**

- Endpoint: `POST /imports/validate` - Parse & validate, return preview
  - Request: multipart/form-data {file, columnMapping JSON}
  - Response: {preview: [first 5 rows], stats: {total, valid, errors}, mapping: {saved: true}}
- Endpoint: `POST /imports` - Actually upload after preview approved
  - Request: {importId from validate, approve: true}
  - Response: {importId, status: "queued"}

**Backend Processing:**

- Use `papaparse` in streaming mode (don't load entire file)
- Column mapping: Map user's "Oil" → standard field "oil_rate_bopd"
- Row-by-row validation (see US-503)
- Early return if too many errors (e.g., "first 10 rows all invalid")

**Database:**

- Table: `csv_imports` - Track upload metadata

  ```sql
  CREATE TABLE csv_imports (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    file_name VARCHAR NOT NULL,
    file_size_bytes INT,
    status ENUM('queued', 'processing', 'completed', 'failed'),
    total_rows INT,
    rows_processed INT,
    rows_failed INT,
    column_mapping JSONB,  -- Save for next upload
    error_summary TEXT,
    created_at TIMESTAMP,
    completed_at TIMESTAMP
  );
  ```

**Patterns Used:**

- [ ] Strategy Pattern - Different CSV format parsers
- [ ] Fluent Builder - Build validation rules
- [ ] Repository Pattern - ImportRepository for tracking

**Testing:**

- [ ] Unit: CSV parser with 10 real operator export formats
- [ ] Unit: Column mapping with fuzzy matching
- [ ] Unit: Edge cases (empty cells, text in numbers, date formats)
- [ ] Integration: Full upload flow mobile → backend → database
- [ ] E2E: Upload file, verify data appears in dashboard
- [ ] Load: Parse 1000-row file, verify <5s

**Estimation:** 10 hours

---

### US-502: Column Mapping & Format Detection

**As a** operator with custom column names  
**I want** the system to intelligently map my CSV columns to standard fields  
**So that** I don't have to remember your exact field names

**Acceptance Criteria:**

- [ ] Auto-detect common variations:
  - "oil_rate_bopd" OR "bopd" OR "barrels" OR "oil" → `oil_rate_bopd`
  - "gascond" OR "gas_rate" OR "mcf" → `gas_rate_mcf`
  - "water_cut" OR "water_pct" OR "water %" → `water_cut_pct`
- [ ] Fuzzy matching (Levenshtein distance): Typos like "oill_rate" still detected
- [ ] Predict well type from data shape:
  - If has "stroke_rate" → beam-pump
  - If has "motor_amps" → submersible or PCP
  - If has "gas_injection_volume" → gas-lift
- [ ] User override: Show detected mapping, let operator correct it
- [ ] Save mapping per org: "This is how I always export" → remember next time
- [ ] Show mapping confidence: "oil_rate_bopd - high confidence (98%)"
- [ ] Warn on missing required fields:
  - "Your file is missing Temperature. This is required for rate-of-decline alerts. Continue anyway?"
  - Don't hard-fail, but warn
- [ ] Preview mapped data: Show first 5 rows with mapped field names

**Technical Implementation:**

**Domain Layer:**

```typescript
// src/domain/csv/column-mapping.entity.ts
export class ColumnMapping {
  static fromDetection(
    csvHeaders: string[],
    wellType: WellType
  ): ColumnMapping {
    // Auto-detect, return mapping with confidence scores
  }

  isConfident(): boolean {
    // All fields >80% confidence?
  }

  getMissingRequiredFields(wellType: WellType): string[] {
    // What required fields aren't mapped?
  }
}
```

**Application Layer:**

- `DetectFormatCommand` - Analyze headers, return suggested mapping
- `SaveColumnMappingCommand` - Persist mapping for org
- `GetSavedMappingQuery` - Fetch org's previous mapping

**Infrastructure:**

- `ColumnMappingRepository` - Store per-tenant, per-org
- Fuzzy matching: `fuse.js` library (npm package)
- Format patterns: Data structure of known formats

  ```typescript
  const PROPHET_FORMAT = {
    patterns: ['PROD_OIL_RATE', 'PRODUCTION_DATE', 'WELL_ID'],
    oil_rate: /^(PROD_OIL_RATE|oil_rate)$/i,
    gas_rate: /^(PROD_GAS_RATE|gas_rate)$/i,
    // ...
  }
  ```

**Common Permian Formats:**

1. Prophet (most common): `PRODUCTION_DATE`, `WELL_ID`, `PROD_OIL_RATE`, `PROD_GAS_RATE`, `PROD_WATER_RATE`, `PRESSURE`, `TEMPERATURE`
2. Enveyo: `Date`, `Well Name`, `Oil (BBL)`, `Gas (MCF)`, `Water (BBL)`, `BSW (%)`
3. Manual Excel: `Date`, `Well`, `Oil`, `Gas`, `Water`, `BSW`
4. Permian export CSV: `well_number`, `oil_bopd`, `gas_mcf`, `water_bbl`, `bsw_pct`

**Testing:**

- [ ] Unit: Fuzzy matching on 50+ real operator column names
- [ ] Unit: Format detection on 10 known formats
- [ ] Unit: Missing required fields detection
- [ ] Integration: Save/load mapping persistence
- [ ] E2E: Upload Prophet file, auto-map, user verifies

**Estimation:** 6 hours

---

### US-503: Data Validation & Sanitization

**As a** platform maintainer  
**I want** invalid production data rejected before it enters the database  
**So that** alerts and analytics are based on clean data

**Acceptance Criteria:**

- [ ] Type validation:
  - oil_rate must be numeric
  - date must be valid date format
  - well_id must exist
- [ ] Range validation:
  - 0 ≤ oil_rate ≤ 50,000 bopd (Permian max)
  - 0 ≤ water_cut ≤ 100%
  - 0 ≤ bsw ≤ 100%
  - -50 ≤ temperature ≤ 350°F
  - 0 ≤ pressure ≤ 5,000 psi
- [ ] Well-type-specific validation:
  - Beam-pump must have: stroke_rate, pump_runtime
  - PCP must have: motor_amps, motor_rpm
  - Submersible must have: motor_amps, discharge_pressure
- [ ] Detect impossible combinations:
  - "99% BSW AND 1000 bopd for 2-year-old well" → warning (unusual but not error)
  - "Pressure 5000 psi AND temperature 150F" → warning (check cooling)
- [ ] Sanitization:
  - Trim whitespace from all strings
  - Normalize decimals: "1,234.56" → 1234.56
  - Convert "N/A", "none", "-" to null
  - Normalize dates: "10/29/2025" or "2025-10-29" both work
- [ ] Error reporting:
  - "Row 42: oil_rate value '5000x' is not numeric"
  - "Row 156: well_id 'UNKNOWN-WELL' does not exist in your org"
  - "Row 203: date format unrecognized, expected YYYY-MM-DD or MM/DD/YYYY"
  - Include context: What value was attempted, what was expected
- [ ] Fail strategy: Skip invalid rows, continue with valid ones
- [ ] Summary report:
  - "450 rows processed: 447 valid, 3 validation errors"
  - List which rows failed and why

**Technical Implementation:**

**Domain Layer:**

```typescript
// src/domain/csv/validators/production-data.validator.ts
export class ProductionDataValidator {
  validate(row: RawCsvRow, wellType: WellType): ValidationResult {
    const errors: ValidationError[] = [];
    const sanitized: SanitizedRow = {};

    // Type-specific validators
    this.validateOilRate(row.oil_rate, errors, sanitized);
    this.validateBsw(row.bsw, errors, sanitized);
    this.validateDate(row.date, errors, sanitized);
    // ... more fields

    return { isValid: errors.length === 0, errors, sanitized };
  }

  private validateOilRate(value: string, errors: [], sanitized: {}) {
    if (!value) {
      errors.push({ field: 'oil_rate', error: 'Required field missing' });
      return;
    }
    const numeric = parseFloat(value.replace(/,/g, ''));
    if (isNaN(numeric)) {
      errors.push({ field: 'oil_rate', error: `'${value}' is not numeric` });
      return;
    }
    if (numeric < 0) {
      errors.push({ field: 'oil_rate', error: `Cannot be negative (got ${numeric})` });
      return;
    }
    if (numeric > 50000) {
      errors.push({ field: 'oil_rate', error: `${numeric} bopd exceeds Permian maximum` });
      return;
    }
    sanitized.oil_rate = numeric;
  }
}
```

**Application Layer:**

- `ValidateImportCommand` - Validate all rows
- `SanitizeRowCommand` - Clean individual row

**Validators to build:**

1. `NumericValidator` - Parse, check range
2. `DateValidator` - Multiple format support
3. `EnumValidator` - Predefined values (status, well_type)
4. `WellReferenceValidator` - Check well_id exists
5. `WellTypeRequiredFieldsValidator` - Check required by type
6. `CrossFieldValidator` - Check impossible combinations

**Cross-Field Rules:**

```typescript
const CROSS_FIELD_RULES = [
  {
    check: (row) => row.bsw > 50 && row.oil_rate > 500,
    warning: "High BSW with high production rate - verify data"
  },
  {
    check: (row) => row.well_type === 'stripper' && row.oil_rate > 1000,
    warning: "Unusually high production for stripper well"
  },
  // ...
]
```

**Testing:**

- [ ] Unit: Each validator with boundary values
- [ ] Unit: Sanitization (decimals, dates, whitespace)
- [ ] Unit: Cross-field rules
- [ ] Integration: Validate real operator data (Prophet, Enveyo exports)
- [ ] Integration: Invalid data generates correct error messages
- [ ] E2E: Upload file with 5% invalid rows, verify 95% imported, get error report

**Estimation:** 8 hours

---

### US-504: Conflict Detection & Duplicate Handling

**As a** operator who sometimes uploads the same data twice  
**I want** the system to detect duplicates and not create duplicate entries  
**So that** my historical data stays clean

**Acceptance Criteria:**

- [ ] Detect exact duplicates: Same well + same date + same values = skip silently
- [ ] Detect partial duplicates: Same well + same date, different values = flag as conflict
- [ ] Ask user strategy for conflicts:
  - "Skip (keep existing)" - new upload ignored
  - "Overwrite (use new data)" - new values replace old
  - "Merge (intelligently)" - use new data if better (e.g., new row has temperature, old didn't)
- [ ] Generate conflict report before import:
  - "Row 15 conflicts with existing 2025-10-28 entry for Well-A (currently has oil_rate=150, you're uploading 155)"
  - Show user their options
- [ ] Audit trail: Record which import "won" and when
- [ ] Don't import until user resolves conflicts (no silent overwrites)

**Technical Implementation:**

**Domain Layer:**

```typescript
// src/domain/csv/conflict.entity.ts
export class ProductionEntryConflict {
  existing: ProductionEntry;
  incoming: ProductionEntry;
  differences: FieldDifference[]; // Which fields differ?

  static createFromComparison(
    existing: ProductionEntry,
    incoming: ProductionEntry
  ): ProductionEntryConflict | null {
    if (this.isIdentical(existing, incoming)) return null; // No conflict

    return new ProductionEntryConflict({
      existing,
      incoming,
      differences: this.findDifferences(existing, incoming)
    });
  }

  suggestMerge(): MergedProductionEntry {
    // If existing has temperature but incoming doesn't, keep existing temp
    // If incoming has higher precision, use incoming
    // Smart merge logic
  }
}
```

**Application Layer:**

- `DetectDuplicatesQuery` - Find conflicts before import

  ```typescript
  async execute(
    tenantId: UUID,
    importData: ProductionEntry[]
  ): Promise<ProductionEntryConflict[]> {
    // Query database: SELECT * WHERE well_id IN (...) AND date IN (...)
    // Compare with incoming data
    // Return conflicts
  }
  ```

- `ResolveConflictCommand` - Apply strategy (skip/overwrite/merge)

**Database Query:**

```sql
SELECT * FROM production_entries 
WHERE tenant_id = ? 
  AND well_id = ANY(?)
  AND entry_date = ANY(?)
ORDER BY created_at DESC;
```

Index needed: `(tenant_id, well_id, entry_date)` for fast lookup

**Testing:**

- [ ] Unit: Duplicate detection (exact, partial)
- [ ] Unit: Merge logic (prioritize fields intelligently)
- [ ] Integration: Upload same file twice, verify conflict detection
- [ ] Integration: Apply strategy, verify result (overwrite vs skip vs merge)
- [ ] E2E: User resolves conflicts, verifies audit trail

**Estimation:** 6 hours

---

### US-505: Batch Import & Background Processing

**As a** operator with hundreds of wells  
**I want** to upload large files and process in background  
**So that** the UI doesn't freeze

**Acceptance Criteria:**

- [ ] Async processing: Return importId immediately, process in background
- [ ] Real-time progress: "Processing... 120/450 rows complete"
- [ ] Job queue: Handle multiple concurrent uploads (don't block on single file)
- [ ] Status tracking page: Shows imports in progress, completed, failed
- [ ] Completion notification:
  - Email: "Import complete: 448 rows imported, 2 errors (see report)"
  - Push notification: "Your production data import completed"
- [ ] Error report download: CSV of failed rows with reasons
- [ ] Retry capability: "Retry failed rows from Import #47"
- [ ] Performance: Process 10,000-row file in <60 seconds
- [ ] No rate limiting for authenticated users

**Technical Implementation:**

**Backend Architecture:**

- Job queue: `BullMQ` + Redis
- Job definition:

  ```typescript
  interface CsvImportJob {
    importId: UUID;
    tenantId: UUID;
    fileUrl: string; // Upload to temp S3/Azure, get URL
    columnMapping: ColumnMapping;
    conflictStrategy: 'skip' | 'overwrite' | 'merge';
  }
  ```

- Workers: 2-4 concurrent (configurable)
- Retry: 3 retries with exponential backoff (1s, 2s, 4s)

**Job Processing Flow:**

```
1. POST /imports (validate, queue job) → return importId
2. BullMQ worker picks up job
3. Fetch file from temp storage
4. Parse & validate rows
5. Detect conflicts
6. Apply conflict strategy
7. Create ProductionEntry records (transaction)
8. Generate error report
9. Send notification email
10. Update csv_imports status to 'completed'
```

**Database Schema:**

```sql
CREATE TABLE csv_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES orgs(id),
  file_name VARCHAR NOT NULL,
  file_size_bytes INT,
  status ENUM('queued', 'processing', 'completed', 'failed') DEFAULT 'queued',
  total_rows INT,
  rows_processed INT DEFAULT 0,
  rows_failed INT DEFAULT 0,
  rows_skipped INT DEFAULT 0,
  column_mapping JSONB,
  conflict_strategy ENUM('skip', 'overwrite', 'merge'),
  error_summary TEXT,
  created_at TIMESTAMP DEFAULT now(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  INDEX idx_tenant_created (tenant_id, created_at DESC)
);

CREATE TABLE csv_import_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES csv_imports(id) ON DELETE CASCADE,
  row_number INT NOT NULL,
  well_id VARCHAR,
  entry_date DATE,
  error_message TEXT NOT NULL,
  raw_row JSONB,
  created_at TIMESTAMP DEFAULT now(),
  INDEX idx_import (import_id)
);
```

**API Endpoints:**

```typescript
// POST /imports/validate - Validate and preview
POST /imports/validate
{
  "columnMapping": { "oil": "oil_rate", "gas": "gas_rate" }
}
Response:
{
  "preview": [
    { "well_id": "WELL-1", "date": "2025-10-29", "oil_rate": 150, ... },
    { "well_id": "WELL-2", "date": "2025-10-29", "oil_rate": 200, ... }
  ],
  "stats": { "total": 450, "valid": 448, "errors": 2 },
  "conflicts": [
    { "well_id": "WELL-1", "date": "2025-10-28", "existing_oil_rate": 155, "incoming_oil_rate": 150 }
  ]
}

// POST /imports - Actually queue for processing
POST /imports
{
  "columnMapping": { ... },
  "conflictStrategy": "overwrite"
}
Response:
{
  "importId": "uuid-12345",
  "status": "queued",
  "estimatedSeconds": 45
}

// GET /imports/:id - Check status
GET /imports/uuid-12345
Response:
{
  "importId": "uuid-12345",
  "status": "processing",
  "rowsProcessed": 120,
  "totalRows": 450,
  "percentComplete": 26.7,
  "estimatedSecondsRemaining": 33
}

// GET /imports/:id/errors - Get error details
GET /imports/uuid-12345/errors?limit=50&offset=0
Response:
{
  "errors": [
    { "rowNumber": 42, "wellId": "WELL-X", "error": "oil_rate value '5000x' is not numeric" },
    { "rowNumber": 156, "wellId": "UNKNOWN", "error": "well_id 'UNKNOWN' does not exist" }
  ],
  "total": 2,
  "downloadUrl": "/imports/uuid-12345/errors/download"
}

// POST /imports/:id/retry - Retry failed rows
POST /imports/uuid-12345/retry
Response:
{
  "newImportId": "uuid-67890",
  "status": "queued"
}
```

**Notifications:**

```html
<!-- Email template -->
<h2>Production Data Import Complete</h2>
<p>Your import <strong>#47</strong> has finished processing.</p>
<p>
  <strong>Results:</strong>
  <ul>
    <li>✅ 448 rows imported successfully</li>
    <li>⚠️ 2 rows failed validation</li>
  </ul>
</p>
<p><a href="{errorReportLink}">Download error details</a></p>
<p><a href="{retryLink}">Retry failed rows</a></p>
```

**Patterns Used:**

- [ ] Command Pattern - CsvImportJob encapsulates work
- [ ] Observer Pattern - Notify on completion
- [ ] Retry Pattern - Exponential backoff
- [ ] Async/Await - Non-blocking processing

**Testing:**

- [ ] Unit: Job creation, queuing
- [ ] Integration: Full import with database transaction
- [ ] Load: Queue 10 concurrent imports, verify all complete
- [ ] Performance: 10K rows in <60s
- [ ] Error: Job failure, verify retry mechanism
- [ ] Error: Simulate Redis outage, verify graceful handling

**Estimation:** 12 hours

---

### US-506: Web UI for Import Management

**As a** operator  
**I want** a web dashboard to upload files and track import history  
**So that** I can manage and rerun imports

**Acceptance Criteria:**

- [ ] Upload section:
  - Drag-drop zone for CSV files
  - "Select File" button
  - File size indicator
  - "Upload" button (disabled until file selected)
- [ ] Import history table:
  - Columns: Date, File Name, Rows, Status, Actions
  - Status badges: "Processing" (animated loader), "Complete" (✓), "Failed" (✗)
  - Sorting: By date, by status, by file name
  - Pagination: Show 20 per page
- [ ] Row actions:
  - "View Errors" → modal showing failed rows with reasons
  - "Download Error Report" → CSV file
  - "Retry Failed" → queue new import with just failed rows
  - "View Conflicts" → show conflicts that were resolved
- [ ] Real-time updates:
  - Import status updates without page refresh
  - Progress bar for in-flight imports
  - Notification toast on completion
- [ ] Search: Find old imports by date range or file name
- [ ] Disable file deletion (data is already imported)

**Technical Implementation:**

**Frontend (React):**

- Drag-drop: `react-dropzone` library
- Table: `react-table` or similar
- Real-time updates: React Query with polling or WebSocket
- Modal: Show error details with copy-to-clipboard

```typescript
// components/ImportUpload.tsx
export const ImportUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiClient.post('/imports/validate', formData);
    }
  });

  return (
    <div>
      <DropZone onDrop={(files) => setFile(files[0])} />
      <Button 
        onClick={() => uploadMutation.mutate(file)}
        disabled={!file}
      >
        Upload
      </Button>
    </div>
  );
};

// components/ImportHistory.tsx
export const ImportHistory: React.FC = () => {
  const { data: imports } = useQuery({
    queryKey: ['imports'],
    queryFn: () => apiClient.get('/imports?limit=50'),
    refetchInterval: 5000 // Poll every 5s
  });

  return (
    <Table>
      <thead>
        <tr>
          <th>Date</th>
          <th>File Name</th>
          <th>Rows</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {imports.map(imp => (
          <tr key={imp.id}>
            <td>{formatDate(imp.createdAt)}</td>
            <td>{imp.fileName}</td>
            <td>{imp.totalRows}</td>
            <td>
              {imp.status === 'processing' && <LoadingSpinner />}
              {imp.status === 'completed' && <CheckIcon color="green" />}
            </td>
            <td>
              <Button onClick={() => viewErrors(imp.id)}>View Errors</Button>
              <Button onClick={() => downloadErrors(imp.id)}>Download</Button>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};
```

**API Endpoints (from US-505, plus additions):**

- `GET /imports?limit=50&offset=0` - List imports
- `GET /imports/:id/errors` - Error details
- `GET /imports/:id/errors/download` - Download CSV
- `POST /imports/:id/retry` - Retry failed rows

**Testing:**

- [ ] Unit: File upload form validation
- [ ] Integration: Upload file, track in history
- [ ] E2E: Upload file, monitor progress, view errors, download report

**Estimation:** 8 hours

---

## Technical Tasks

### Backend

- [ ] Set up BullMQ + Redis connection
- [ ] Create CsvImportJob type and handlers
- [ ] Build CSV parsing/validation pipeline
- [ ] Implement column mapping service with fuzzy matching
- [ ] Implement duplicate detection logic
- [ ] Create csv_imports and csv_import_errors tables
- [ ] Build import API endpoints
- [ ] Add email notifications (use existing Azure Communication Services)
- [ ] Add comprehensive error reporting
- [ ] Implement retry mechanism
- [ ] Performance test: 10K rows in <60s

### Frontend (Mobile)

- [ ] Add file picker (DocumentPicker)
- [ ] Build column mapping UI
- [ ] Add upload progress indicator
- [ ] Add CSV preview screen
- [ ] Store last used column mapping

### Frontend (Web)

- [ ] Build import upload section (drag-drop + file picker)
- [ ] Build import history table
- [ ] Add status tracking with real-time updates
- [ ] Build error detail modal
- [ ] Add error report download
- [ ] Add retry functionality

### Database

- [ ] Create csv_imports table
- [ ] Create csv_import_errors table
- [ ] Add index: (tenant_id, well_id, entry_date)
- [ ] Write migrations

### DevOps

- [ ] Redis setup (development)
- [ ] Redis setup (production: Azure Cache or Upstash)
- [ ] BullMQ UI for job monitoring (optional)
- [ ] Environment configuration

---

## Definition of Done

### Code Quality

- [ ] Follows CQRS pattern consistently
- [ ] TypeScript strict mode
- [ ] No hardcoded limits (configurable via env)
- [ ] Comprehensive error messages
- [ ] Input validation on all API endpoints

### Testing

- [ ] Unit tests for validators (80%+ coverage)
- [ ] Unit tests for duplicate detection
- [ ] Integration tests for full import flow
- [ ] E2E test from mobile upload to dashboard display
- [ ] Load test: 10K rows
- [ ] All tests passing

### Security

- [ ] File size limit enforced (100MB)
- [ ] File type validation (CSV only)
- [ ] Sanitize file names
- [ ] Tenant isolation verified
- [ ] No sensitive data in error logs

### Documentation

- [ ] Swagger API docs
- [ ] CSV format guide (required columns, formats, examples)
- [ ] Column mapping guide (Prophet, Enveyo, Excel)
- [ ] How-to guide for operators
- [ ] Troubleshooting guide (common errors)

### Performance

- [ ] Parse 1000 rows <5s
- [ ] Process 10K rows <60s
- [ ] Concurrent imports don't block each other
- [ ] Memory efficient (streaming, not loading full file)

---

## Dependencies

### External Packages

- `bullmq` - Job queue
- `papaparse` - CSV parsing
- `fuse.js` - Fuzzy matching
- Redis - Job storage

### Infrastructure

- Redis (dev: local, prod: Azure Cache or Upstash)
- Azure Communication Services (already have)

### Blockers

- [ ] Redis deployment plan

---

## Common Operator Export Formats (Support These)

1. **Prophet** (Most common in Permian)
   - Columns: PRODUCTION_DATE, WELL_ID, PROD_OIL_RATE, PROD_GAS_RATE, PROD_WATER_RATE, PRESSURE, TEMPERATURE
   - Example: `2025-10-29,WELL-A-001,150,2500,45,1200,95`

2. **Enveyo** (Revenue accounting system)
   - Columns: Date, Well Name, Oil (BBL), Gas (MCF), Water (BBL), BSW (%)
   - Example: `10/29/2025,WELL-A-001,150,2500,45,15`

3. **Manual Excel** (Small operators)
   - Columns: Date, Well, Oil, Gas, Water, BSW, Pressure, Temperature
   - Flexible format, need fuzzy matching

4. **Permian standard CSV**
   - Columns: well_number, oil_bopd, gas_mcf, water_bbl, bsw_pct, pressure_psi, temp_f
   - Already normalized

---

## What NOT in Sprint 5

- SCADA integration (Phase 2)
- Real-time historian connection (Phase 2)
- Advanced ETL/data transformation (Phase 2)
- Third-party API for data (Phase 2)
- Mobile app UI for import (keep it simple for MVP, web is primary)

---

## Success Criteria for Beta

**Operators can now:**

- [ ] Upload daily production CSV export (Prophet/Enveyo/Excel)
- [ ] System validates and imports automatically
- [ ] See data in dashboard within 60 seconds
- [ ] Get email notification on completion
- [ ] Retry if something failed
- [ ] Track import history on web

**Metrics:**

- [ ] First beta operator successfully imports 90%+ of historical data
- [ ] Zero data loss/duplication
- [ ] <60s import time for typical files (100-500 rows)
- [ ] <2s parsing time

---

**This sprint unblocks beta by solving the #1 operator friction: getting data into the system without manual entry.**
