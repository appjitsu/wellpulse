# API Feature Specification (apps/api)

**Version**: 1.0
**Last Updated**: October 23, 2025
**Tech Stack**: NestJS, Drizzle ORM, PostgreSQL (per-tenant), Hexagonal Architecture

---

## Overview

The WellPulse API is the main **tenant-facing NestJS REST API** that powers all client operations. It handles production data management, field data entry sync, predictive maintenance, ESG compliance tracking, and integrations with the ML service.

**Key Architecture Principles:**

- Database-per-tenant (each client has dedicated PostgreSQL database)
- Hexagonal architecture (Domain → Application → Infrastructure → Presentation)
- Multi-tenancy via subdomain routing (`tenant.wellpulse.io`)
- Offline-first sync support for Electron/Mobile apps
- Event sourcing for field data changes (audit trail + conflict resolution)

---

## Core Modules & Features

### 1. Authentication & Authorization

**Endpoints:**

- `POST /auth/register` - User registration (invite-only, admin creates accounts)
- `POST /auth/login` - Email/password login (returns JWT + httpOnly cookie)
- `POST /auth/logout` - Invalidate session
- `POST /auth/refresh` - Refresh access token
- `POST /auth/forgot-password` - Password reset email
- `POST /auth/reset-password` - Complete password reset
- `GET /auth/me` - Get current user profile

**Features:**

- JWT-based authentication (access + refresh tokens)
- Role-Based Access Control (RBAC):
  - **Admin**: Full access to all tenant data
  - **Manager**: View all data, manage wells and equipment
  - **Field Operator**: Field data entry only (Electron/Mobile)
  - **Viewer**: Read-only access (office staff)
- httpOnly cookies for web clients (XSS protection)
- Bearer tokens for Electron/Mobile apps
- MFA support (TOTP) for admins
- Session management (Redis or in-memory cache in bootstrap phase)

**Domain Entities:**

- User (aggregate root)
- Session (value object)
- Role (enum)
- Permission (value object)

---

### 2. Well Management

**Endpoints:**

- `GET /wells` - List all wells for tenant (paginated, filterable)
- `GET /wells/:id` - Get single well details
- `POST /wells` - Create new well
- `PATCH /wells/:id` - Update well details
- `DELETE /wells/:id` - Soft delete well
- `GET /wells/:id/production` - Get production history for well
- `GET /wells/:id/equipment` - Get equipment assigned to well
- `GET /wells/:id/activities` - Get field activity log for well

**Features:**

- Well metadata: API number, name, location (lat/long), lease, operator, status
- Well status tracking: Active, Inactive, Plugged & Abandoned, Drilling
- Production allocation (wells can share equipment/batteries)
- Geolocation for map interface
- Activity history (audit log of all changes)
- Search & filtering: By name, API number, lease, status, location

**Domain Entities:**

- Well (aggregate root)
- WellLocation (value object - lat/long)
- WellStatus (enum)
- APINumber (value object - validation for format)
- Production Allocation rules

**Integration Points:**

- Map interface (lat/long for visualization)
- Equipment assignments
- Production data linkage

---

### 3. Production Data Management

**Endpoints:**

- `GET /production` - Get production data (paginated, filterable by date/well)
- `GET /production/:id` - Get single production record
- `POST /production` - Create production record (manual entry)
- `POST /production/batch` - Bulk import production data
- `PATCH /production/:id` - Update production record
- `DELETE /production/:id` - Soft delete production record
- `GET /production/export` - Export production data (CSV, Excel)
- `GET /production/summary` - Aggregated production metrics

**Features:**

- Daily production tracking: Oil (bbl), Gas (mcf), Water (bbl)
- Production by well or battery
- Run time tracking (hours/day equipment operated)
- Pressure readings (tubing, casing, line)
- Temperature readings
- Production anomaly detection (via ML service)
- Import from CSV/Excel (data consolidation from legacy systems)
- Time-series data optimization (efficient queries for charts)
- Data validation rules (reasonable ranges, required fields)

**Domain Entities:**

- ProductionRecord (aggregate root)
- FluidVolumes (value object - oil/gas/water)
- PressureReadings (value object)
- ProductionDate (value object with validation)

**Business Rules:**

- Cannot enter future production data
- Production volumes must be non-negative
- Daily totals must reconcile across wells/batteries
- Data must pass validation before ML analysis

---

### 4. Equipment Management

**Endpoints:**

- `GET /equipment` - List all equipment for tenant
- `GET /equipment/:id` - Get single equipment details
- `POST /equipment` - Create new equipment record
- `PATCH /equipment/:id` - Update equipment details
- `DELETE /equipment/:id` - Soft delete equipment
- `GET /equipment/:id/maintenance-history` - Get maintenance records
- `GET /equipment/:id/predictions` - Get ML predictions for equipment health
- `POST /equipment/:id/maintenance` - Log maintenance activity
- `GET /equipment/due-maintenance` - Get equipment due for maintenance

**Features:**

- Equipment types: Pump jack, compressor, separator, tank battery, meter
- Equipment metadata: Serial number, manufacturer, install date, location
- Equipment status: Operational, Maintenance, Failed, Decommissioned
- Maintenance history tracking
- Equipment-to-well assignments
- Sensor integration (if available): vibration, temperature, pressure
- Predictive maintenance alerts (from ML service)
- Maintenance scheduling and tracking

**Domain Entities:**

- Equipment (aggregate root)
- EquipmentType (enum)
- EquipmentStatus (enum)
- MaintenanceRecord (entity)
- MaintenancePrediction (value object from ML service)

**Integration Points:**

- ML service for predictive maintenance
- Field data entry apps (maintenance logging)
- Alerts/notifications for maintenance due

---

### 5. Field Data Entry & Sync

**Endpoints:**

- `POST /field-data/sync` - Batch sync from Electron/Mobile apps
- `GET /field-data/conflicts` - Get unresolved conflicts
- `POST /field-data/conflicts/:id/resolve` - Resolve data conflict
- `GET /field-data/sync-status/:deviceId` - Get sync status for device
- `POST /field-data/events` - Append field event (alternative to batch sync)

**Features:**

- Offline-first batch sync support
- Event sourcing for field data changes
- Conflict resolution strategies:
  - Newest wins (sensor readings)
  - Highest value (production volumes - regulatory requirement)
  - Manual review (safety-critical data like equipment inspections)
  - Merge (notes/comments)
  - Keep both (photos)
- Device tracking (which device submitted which data)
- Sync retry logic with exponential backoff
- Conflict dashboard for manual review

**Domain Entities:**

- FieldDataEvent (aggregate root)
- SyncBatch (entity)
- DataConflict (entity)
- ConflictResolution (value object)
- DeviceInfo (value object)

**Business Rules:**

- Events are immutable (append-only)
- Conflicts flagged automatically based on data type
- Safety-critical data always requires manual review
- Sync batches processed transactionally (all or nothing)

**Pattern Usage:**

- Event Sourcing Pattern
- Offline Batch Sync Pattern
- Conflict Resolution Pattern
- SAGA Pattern (for multi-step sync operations)

---

### 6. ESG Compliance & Emissions Tracking

**Endpoints:**

- `GET /emissions` - Get emissions data (paginated, filterable)
- `GET /emissions/summary` - Aggregated emissions by period
- `POST /emissions/calculate` - Calculate emissions from production data
- `GET /emissions/reports` - List compliance reports
- `POST /emissions/reports` - Generate compliance report (PDF)
- `GET /emissions/export` - Export emissions data (CSV, Excel)
- `GET /emissions/thresholds` - Get regulatory thresholds
- `GET /emissions/alerts` - Get emissions alerts (approaching limits)

**Features:**

- Automated emissions calculations from production data
- CO2, CH4 (methane), VOC tracking
- Regulatory compliance tracking (EPA, state regulations)
- Emissions intensity metrics (emissions per barrel produced)
- Threshold monitoring and alerts
- Compliance report generation (PDF format)
- Export data for external audits
- Historical trend analysis

**Domain Entities:**

- EmissionsRecord (aggregate root)
- EmissionType (enum - CO2, CH4, VOC)
- ComplianceReport (aggregate root)
- RegulatoryThreshold (value object)
- EmissionsCalculation (entity with business logic)

**Business Rules:**

- Calculations based on EPA emission factors
- Alert when approaching 80% of regulatory thresholds
- Reports must be immutable once generated
- Data retention: 7 years (regulatory requirement)

**Integration Points:**

- Production data (source for calculations)
- PDF generation service
- Email notifications for alerts

---

### 7. Predictive Maintenance & ML Integration

**Endpoints:**

- `POST /ml/predict` - Request ML prediction (equipment failure, production optimization)
- `GET /ml/predictions` - Get recent predictions
- `GET /ml/predictions/:id` - Get single prediction details
- `POST /ml/train` - Trigger ML model retraining (admin only)
- `GET /ml/models` - List available ML models
- `GET /ml/accuracy` - Get model accuracy metrics

**Features:**

- Integration with Python ML service (internal API call)
- Predictive maintenance for equipment
- Production optimization recommendations
- Anomaly detection in production data
- Decline curve analysis (production forecasting)
- Model performance tracking
- Prediction confidence scores
- Alert generation from predictions

**Domain Entities:**

- MLPrediction (aggregate root)
- PredictionType (enum)
- ModelVersion (value object)
- PredictionConfidence (value object)

**ML Use Cases:**

1. **Equipment failure prediction**: Analyze sensor data, run time, maintenance history
2. **Production optimization**: Identify wells underperforming vs. expected decline curve
3. **Anomaly detection**: Flag unusual production patterns for investigation
4. **Decline curve analysis**: Forecast future production for planning

**Integration Points:**

- Python ML service (`services/ml`)
- Background job queue (Bull/BullMQ)
- Notification service (alerts for predictions)

---

### 8. Analytics & Dashboards

**Endpoints:**

- `GET /analytics/production-summary` - Production KPIs (total oil/gas/water by period)
- `GET /analytics/well-performance` - Well-by-well performance metrics
- `GET /analytics/equipment-health` - Equipment health summary
- `GET /analytics/emissions-summary` - Emissions KPIs
- `GET /analytics/financial-summary` - Revenue/cost metrics (basic)
- `GET /analytics/custom-reports` - List custom reports
- `POST /analytics/custom-reports` - Create custom report

**Features:**

- Pre-built dashboard queries optimized for performance
- Time-series aggregations (daily, weekly, monthly, quarterly, annual)
- Well performance comparisons
- Production trends and forecasts
- Equipment uptime tracking
- Cost per barrel calculations
- Custom report builder (save common queries)

**Domain Entities:**

- DashboardMetric (value object)
- CustomReport (aggregate root)
- TimeSeriesData (value object)

**Performance Optimizations:**

- Materialized views for complex aggregations
- Caching for frequently accessed metrics
- Pagination for large datasets
- Background jobs for heavy report generation

---

### 9. User & Tenant Management

**Endpoints:**

- `GET /users` - List users in tenant (admin only)
- `GET /users/:id` - Get user details
- `POST /users` - Create new user (admin only)
- `PATCH /users/:id` - Update user details
- `DELETE /users/:id` - Soft delete user (admin only)
- `PATCH /users/:id/role` - Change user role (admin only)
- `POST /users/:id/reset-password` - Admin-initiated password reset
- `GET /tenant/settings` - Get tenant configuration
- `PATCH /tenant/settings` - Update tenant settings (admin only)

**Features:**

- User CRUD for tenant admins
- Role assignment and management
- Tenant-level settings:
  - Company name, logo
  - Time zone, units (imperial/metric)
  - Email notification preferences
  - Feature flags
- Audit logging for all user actions
- User invitation workflow (email with signup link)

**Domain Entities:**

- TenantSettings (aggregate root)
- UserInvitation (entity)
- AuditLog (entity - immutable)

---

### 10. File Storage & Document Management

**Endpoints:**

- `POST /files/upload` - Upload file (equipment photos, inspection documents)
- `GET /files/:id` - Get file metadata
- `GET /files/:id/download` - Download file
- `DELETE /files/:id` - Soft delete file
- `GET /files` - List files (paginated, filterable by type/entity)
- `POST /files/:id/tags` - Add tags to file

**Features:**

- File upload to Azure Blob Storage (or AWS S3 if client prefers)
- Supported file types: Images (JPG, PNG), PDFs, Excel/CSV, Videos
- File association: Link files to wells, equipment, maintenance records
- File metadata: Upload date, uploaded by, file size, tags
- Thumbnail generation for images
- Virus scanning for uploaded files
- Signed URLs for secure downloads (SAS tokens)

**Domain Entities:**

- File (aggregate root)
- FileType (enum)
- FileMetadata (value object)
- StorageProvider (enum - Azure/AWS)

**Integration Points:**

- Azure Blob Storage (default)
- AWS S3 (optional, client choice)
- Strategy Pattern for pluggable storage providers

---

### 11. Notifications & Alerts

**Endpoints:**

- `GET /notifications` - Get user notifications
- `PATCH /notifications/:id/read` - Mark notification as read
- `DELETE /notifications/:id` - Dismiss notification
- `GET /alerts` - Get system alerts (equipment failures, emissions, etc.)
- `POST /alerts/:id/acknowledge` - Acknowledge alert
- `GET /notification-preferences` - Get user notification settings
- `PATCH /notification-preferences` - Update notification settings

**Features:**

- Real-time alerts for:
  - Equipment predicted failures
  - Emissions approaching regulatory limits
  - Production anomalies
  - Maintenance due
- Email notifications (via Nodemailer)
- In-app notifications (badge counts)
- SMS notifications (optional, Twilio integration)
- User notification preferences (email, SMS, in-app)
- Alert severity levels: Info, Warning, Critical
- Alert escalation (if not acknowledged within X hours)

**Domain Entities:**

- Notification (aggregate root)
- Alert (aggregate root)
- NotificationPreference (value object)
- AlertSeverity (enum)

**Integration Points:**

- Email service (Nodemailer)
- SMS service (Twilio - optional)
- WebSocket for real-time in-app notifications (future)

---

### 12. Integrations & External APIs

**Endpoints:**

- `GET /integrations` - List configured integrations
- `POST /integrations/:type/connect` - Connect external service
- `DELETE /integrations/:type/disconnect` - Disconnect external service
- `POST /integrations/:type/sync` - Trigger manual sync
- `GET /integrations/:type/status` - Get integration health status

**Features:**

- Legacy system integrations (Anti-Corruption Layer pattern)
- Import from Excel/CSV (data consolidation)
- Export to common formats (CSV, Excel, JSON)
- SCADA system integration (if client has sensors)
- Third-party API connections:
  - Weather data (for correlation analysis)
  - Commodity prices (oil/gas market data)
  - Regulatory databases (emissions factors)
- Webhook support for external systems
- API rate limiting and throttling

**Domain Entities:**

- Integration (aggregate root)
- IntegrationType (enum)
- IntegrationCredential (value object - encrypted)
- SyncStatus (value object)

**Pattern Usage:**

- Anti-Corruption Layer Pattern
- Adapter Pattern
- Circuit Breaker Pattern (for unreliable external services)

---

### 13. Background Jobs & Scheduled Tasks

**Implementation:**

- Bull/BullMQ with Redis (or in-memory queue in bootstrap phase)

**Jobs:**

1. **Daily Production Rollup** (midnight) - Aggregate daily production metrics
2. **ML Prediction Refresh** (hourly) - Run predictive models on latest data
3. **Emissions Calculation** (daily) - Calculate emissions from production data
4. **Maintenance Alerts** (daily) - Check equipment due for maintenance
5. **Report Generation** (on-demand) - Generate PDF reports
6. **Data Export** (on-demand) - Export large datasets
7. **Field Data Sync Processing** (real-time) - Process offline sync batches
8. **Email Notifications** (real-time) - Send alert emails
9. **Backup Verification** (weekly) - Verify database backups completed
10. **Cleanup Old Sessions** (daily) - Remove expired JWT refresh tokens

**Queue Configuration:**

- Separate queues for priority levels (high, medium, low)
- Retry logic with exponential backoff
- Dead letter queue for failed jobs
- Job progress tracking
- Admin UI for queue monitoring (Bull Board)

---

## API Design Standards

### RESTful Conventions

- `GET` - Retrieve resources
- `POST` - Create resources
- `PATCH` - Partial update (preferred over PUT)
- `DELETE` - Soft delete (sets `deletedAt` timestamp)

### Response Formats

**Success Response (200, 201):**

```json
{
  "data": {
    /* resource or array of resources */
  },
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

**Error Response (400, 401, 403, 404, 500):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Well name is required",
    "details": [{ "field": "name", "message": "Name is required" }]
  }
}
```

### Pagination

- Default limit: 20
- Max limit: 100
- Query params: `?page=1&limit=20`
- Cursor-based pagination for time-series data (production records)

### Filtering

- Query params: `?status=active&lease=Smith-Ranch`
- Supported operators: `eq`, `gt`, `lt`, `gte`, `lte`, `like`, `in`
- Example: `?status=in:active,drilling&createdAt=gte:2025-01-01`

### Sorting

- Query param: `?sort=-createdAt,name` (- prefix for descending)
- Multiple fields supported

### Field Selection (Sparse Fieldsets)

- Query param: `?fields=id,name,status` (reduce payload size)

---

## Security & Validation

### Input Validation

- DTO validation with `class-validator`
- Whitelist approach (strip unknown properties)
- Sanitize inputs (prevent SQL injection, XSS)

### Authorization

- Role-based access control (RBAC)
- Tenant isolation (all queries scoped to tenant)
- Resource-level permissions (e.g., field operators can only edit their own entries)

### Rate Limiting

- Per-tenant rate limits: 1000 requests/hour
- Per-user rate limits: 100 requests/minute
- Burst allowance for batch operations

### Audit Logging

- Log all mutations (create, update, delete)
- Track user, timestamp, IP address, changed fields
- Immutable audit log table

### Data Encryption

- Encryption at rest (PostgreSQL native encryption)
- Encryption in transit (TLS 1.2+)
- Sensitive fields encrypted (database connection strings, API keys)

---

## Performance Targets

- **API response time (p95)**: < 200ms
- **Batch sync processing**: < 5 seconds for 1000 records
- **ML prediction latency**: < 2 seconds
- **Dashboard queries**: < 500ms
- **File upload**: Support up to 100MB files
- **Concurrent users per tenant**: 50+

---

## Testing Requirements

- **Unit tests**: ≥80% coverage (domain, application layers)
- **Integration tests**: All API endpoints
- **E2E tests**: Critical user flows (auth, field data sync, production entry)
- **Load tests**: 500 requests/second sustained
- **Security tests**: OWASP Top 10 vulnerability scanning

---

## Deployment & Operations

### Environment Variables

- `DATABASE_URL_MASTER` - Master database connection
- `JWT_SECRET` - JWT signing key
- `JWT_REFRESH_SECRET` - JWT refresh token signing key
- `REDIS_URL` - Redis connection (optional in bootstrap)
- `AZURE_STORAGE_CONNECTION_STRING` - Blob storage
- `ML_SERVICE_URL` - Internal ML service URL
- `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASSWORD` - SMTP config
- `LOG_LEVEL` - Logging verbosity (debug, info, warn, error)

### Health Checks

- `GET /health` - Basic health check
- `GET /health/db` - Database connectivity check
- `GET /health/redis` - Redis connectivity check (if enabled)
- `GET /health/storage` - Blob storage connectivity check
- `GET /health/ml` - ML service connectivity check

### Monitoring

- Application Insights integration (Azure)
- Structured logging (JSON format)
- Performance metrics (response times, throughput)
- Error tracking and alerting
- Database query performance monitoring

---

## Related Documentation

- [Database-Per-Tenant Multi-Tenancy Pattern](../patterns/69-Database-Per-Tenant-Multi-Tenancy-Pattern.md)
- [Offline Batch Sync Pattern](../patterns/70-Offline-Batch-Sync-Pattern.md)
- [Conflict Resolution Pattern](../patterns/71-Conflict-Resolution-Pattern.md)
- [Hexagonal Architecture Guide](../patterns/01-Hexagonal-Architecture-and-DDD-Fundamentals.md)
- [CQRS Pattern](../patterns/03-CQRS-Command-Query-Responsibility-Segregation.md)
- [Event Sourcing Pattern](../patterns/06-Event-Sourcing-Pattern.md)

---

**Next Steps:**

1. Review API specification with stakeholders
2. Create OpenAPI (Swagger) documentation
3. Set up database schema (Drizzle ORM)
4. Implement authentication module (highest priority)
5. Build well management module (core functionality)
