# Sprint 8 - Export & Compliance Reporting

**Phase:** Phase 2 (Post-MVP Foundation)
**Goal:** Enable operators to generate regulatory compliance reports (RRC, COPAS) and production accounting documentation

**Sprint Duration:** 1 week
**Estimated Hours:** 28 hours
**Start Date:** Post-Sprint 7

---

## Sprint Objectives

### Primary Goal

Implement compliance report generation aligned with Texas Railroad Commission (RRC) requirements and COPAS standards, enabling operators to meet regulatory obligations and conduct production accounting.

### Success Metrics

- [ ] RRC Form 1 (Oil Well Potential Test) generates and downloads as PDF
- [ ] RRC Form 2 (Gas Well Potential Test) generates and downloads as PDF
- [ ] Production accounting report generated with well-level detail
- [ ] Reports include all required fields per RRC specification
- [ ] Reports can be scheduled (daily/weekly/monthly email delivery)
- [ ] Audit trail captures all report generation events
- [ ] < 5 second generation time for 50-well monthly report

---

## User Stories

### US-1201: RRC Form 1 Generation (Oil Well Testing)

**As a** operator
**I want** to generate RRC Form 1 (Oil Well Potential Test report)
**So that** I can submit well test results to the Texas Railroad Commission

**Acceptance Criteria:**

- [ ] Form includes all required RRC fields:
  - Well identification (API, lease name, county)
  - Well bore data (depth, formation)
  - Test date, duration, conditions
  - Production rates (oil BOPD, gas MCFD, water BWPD)
  - Operating conditions (tubing pressure, casing pressure, temperature)
  - Choke size, flow line pressure
- [ ] Form populated from field entry data + well master data
- [ ] Calculations auto-calculated: GOR, water cut %, etc.
- [ ] Signature blocks for operator representative
- [ ] Generated as PDF with official RRC formatting
- [ ] Company logo and branding included
- [ ] Export as PDF for printing/digital submission

**Technical Implementation:**

- **Domain Layer:**
  - `RrcForm1` entity with validation: all required fields present and within valid ranges
  - Value objects: `WellIdentification`, `TestConditions`, `ProductionRates`
  - Business logic: `validate()`, `calculateGOR()`, `calculateWaterCut()`

- **Application Layer:**
  - Command: `GenerateRrcForm1Command` with well ID, test date range
  - Query: `GetRrcForm1DataQuery` gathers field entries + well data
  - Service: `RrcForm1GenerationService`

- **Infrastructure Layer:**
  - PDF library: `pdfkit` or `puppeteer` (headless browser rendering)
  - Template: RRC Form 1 layout as PDF template
  - Repository: Query field entries and well master data

- **Presentation Layer:**
  - Endpoint: `POST /reports/rrc-form-1` with `{ wellId, testStartDate, testEndDate }`
  - Returns: PDF file stream for download

**Patterns Used:**

- [x] Hexagonal Architecture
- [x] Domain-Driven Design
- [x] CQRS Pattern
- [x] Report Generation Pattern

**Testing:**

- [ ] Unit tests for RRC field validation
- [ ] Unit tests for calculations (GOR, water cut)
- [ ] Integration tests: query well data, generate form
- [ ] E2E test: API call generates PDF, verify content
- [ ] Compliance test: verify all RRC required fields included

**Estimation:** 7 hours

---

### US-1202: RRC Form 2 Generation (Gas Well Testing)

**As a** operator
**I want** to generate RRC Form 2 (Gas Well Potential Test report)
**So that** I can submit gas well test results to the Texas Railroad Commission

**Acceptance Criteria:**

- [ ] Form includes all required RRC gas well fields:
  - Well identification (API, lease name, county)
  - Well bore data (depth, formation)
  - Test date, duration, conditions
  - Production rates (gas MCFD, liquid rate, water rate)
  - Operating conditions (tubing pressure, casing pressure, temperature)
  - Choke size, flow line pressure, separator pressure/temperature
- [ ] Form populated from field entry data + well master data
- [ ] Calculations auto-calculated: liquid yield (BBL/MMCF), etc.
- [ ] Generated as PDF with official RRC formatting
- [ ] Company logo and branding included

**Technical Implementation:**

- **Domain Layer:**
  - `RrcForm2` entity similar to Form 1
  - Value objects: `GasProductionRates`, `SeparatorConditions`
  - Business logic: `calculateLiquidYield()`, `validate()`

- **Application Layer:**
  - Command: `GenerateRrcForm2Command`
  - Query: `GetRrcForm2DataQuery`
  - Service: `RrcForm2GenerationService`

- **Infrastructure Layer:**
  - PDF template for Form 2
  - Same PDF rendering library as Form 1

- **Presentation Layer:**
  - Endpoint: `POST /reports/rrc-form-2`
  - Returns: PDF file stream

**Patterns Used:**

- [x] Template Method Pattern (shared logic with Form 1)
- [x] CQRS Pattern
- [x] Report Generation Pattern

**Testing:**

- [ ] Unit tests for gas well field validation
- [ ] Integration tests for gas well data retrieval
- [ ] E2E test: API call generates Form 2 PDF
- [ ] Compliance test: compare to actual RRC Form 2 specification

**Estimation:** 6 hours

---

### US-1203: Production Accounting Report (AFE Tracking)

**As a** production accountant
**I want** to generate a production accounting report showing daily production vs. AFE projections
**So that** I can monitor well profitability and compare actual to forecasted performance

**Acceptance Criteria:**

- [ ] Report shows: well name, API, cumulative production (oil/gas), cumulative revenue
- [ ] Compares actual cumulative to AFE forecast
- [ ] Calculates variance ($ and %)
- [ ] Shows daily run rate trend vs AFE daily rate
- [ ] Includes all wells in selected property or organization
- [ ] Date range: monthly or custom date range
- [ ] Exportable as PDF and CSV
- [ ] Sortable by: variance %, well name, production volume

**Technical Implementation:**

- **Domain Layer:**
  - `ProductionAccountingEntry` entity with: actual cumulative, AFE projection, variance
  - Value objects: `CumulativeProduction`, `RevenueCalculation`
  - Business logic: `calculateVariance()`, `getTrendDirection()`

- **Application Layer:**
  - Command: `GenerateProductionAccountingReportCommand` with date range and filters
  - Query: `GetProductionAccountingDataQuery` aggregates field entries vs AFE data
  - Service: `ProductionAccountingService`

- **Infrastructure Layer:**
  - Repository: Query AFE data (linked to wells)
  - Aggregation: Sum production by well + period

- **Presentation Layer:**
  - Endpoint: `POST /reports/production-accounting` with filters
  - Returns: PDF or CSV based on format parameter

**Patterns Used:**

- [x] Report Generation Pattern
- [x] Aggregation Pattern
- [x] Comparison Pattern

**Testing:**

- [ ] Unit tests for variance calculations
- [ ] Integration tests with AFE and field entry data
- [ ] E2E test: generate report for multiple wells
- [ ] Data accuracy test: verify calculations match manual spot-checks

**Estimation:** 6 hours

---

### US-1204: Scheduled Report Distribution

**As a** manager
**I want** to schedule automatic report generation and email delivery
**So that** I receive compliance reports and production accounting updates on a regular schedule

**Acceptance Criteria:**

- [ ] Schedule options: Daily, Weekly (select day), Monthly (select date)
- [ ] Select report type(s): RRC Form 1, RRC Form 2, Production Accounting
- [ ] Select recipient email list
- [ ] Email includes: report PDF attachment, summary in email body
- [ ] Execution history: timestamp, success/failure, recipient list
- [ ] Enable/disable schedule without deleting history
- [ ] Test email button to verify configuration

**Technical Implementation:**

- **Domain Layer:**
  - `ReportSchedule` entity with: report type, frequency, recipient list, enabled flag
  - Value objects: `EmailRecipient`, `ScheduleFrequency`
  - Business logic: `isReadyToExecute()`, `getNextExecutionTime()`

- **Application Layer:**
  - Command: `CreateReportScheduleCommand`, `UpdateReportScheduleCommand`
  - Query: `GetReportSchedulesQuery`
  - Service: `ReportSchedulerService` (background job)

- **Infrastructure Layer:**
  - Scheduler: node-cron for background job execution
  - Email service: Azure Communication Services (already configured)
  - Repository: Store schedule definitions + execution history

- **Presentation Layer:**
  - Endpoints: CRUD operations on schedules
  - Admin page: Schedule management UI

**Patterns Used:**

- [x] Scheduler Pattern
- [x] CQRS Pattern
- [x] Repository Pattern
- [x] Background Job Pattern

**Testing:**

- [ ] Unit tests for schedule calculation (next execution time)
- [ ] Integration tests for report generation + email
- [ ] E2E test: create schedule, verify report sent

**Estimation:** 5 hours

---

### US-1205: COPAS Compliance Report

**As a** joint operator
**I want** to generate a COPAS-compliant production report
**So that** I can share standardized data with joint operating partners

**Acceptance Criteria:**

- [ ] Report format: COPAS Unit Operating Statement (UOS) compatible
- [ ] Includes: production volumes, revenue, expenses, net revenue
- [ ] Breaks down by working interest (partner share calculations)
- [ ] Includes allocation schedules (if applicable)
- [ ] Generated monthly
- [ ] Exportable as PDF and COPAS-standard CSV format
- [ ] Shows audit trail (last modified, by whom)

**Technical Implementation:**

- **Domain Layer:**
  - `CopasStatement` entity with: UOS format data, working interests
  - Value objects: `WorkingInterest`, `RevenueAllocation`, `ExpenseAllocation`
  - Business logic: `calculatePartnerShare()`, `validate()`

- **Application Layer:**
  - Command: `GenerateCopasStatementCommand` with month/year
  - Query: `GetCopasDataQuery` aggregates production + interest data
  - Service: `CopasStatementService`

- **Infrastructure Layer:**
  - Templates for COPAS UOS format
  - PDF rendering for COPAS format
  - Export to COPAS CSV standard

- **Presentation Layer:**
  - Endpoint: `POST /reports/copas-statement`
  - Returns: PDF or CSV

**Patterns Used:**

- [x] Report Generation Pattern
- [x] Domain-Driven Design (business logic for working interests)

**Testing:**

- [ ] Unit tests for working interest calculations
- [ ] Integration tests for multi-well, multi-partner scenarios
- [ ] Compliance test: verify format matches COPAS standard

**Estimation:** 4 hours

---

## Technical Tasks

### Backend

- [ ] Create RRC Form 1 domain entity and validation
- [ ] Create RRC Form 2 domain entity and validation
- [ ] Implement PDF rendering service (template-based)
- [ ] Create production accounting calculation service
- [ ] Create COPAS statement generation service
- [ ] Implement report scheduler (node-cron)
- [ ] Create email template service
- [ ] Add report endpoints (generate + download)
- [ ] Create execution history tracking

### Frontend - Web

- [ ] Create report generation page (form for date/filters)
- [ ] Create schedule management page
- [ ] Add report download links to dashboard
- [ ] Create report preview before generation
- [ ] Add test email button

### Database

- [ ] Create `report_schedules` table

  ```sql
  CREATE TABLE report_schedules (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    report_type VARCHAR(50),
    frequency VARCHAR(50),
    recipients TEXT[],
    enabled BOOLEAN DEFAULT true,
    last_executed_at TIMESTAMP,
    next_execution_at TIMESTAMP,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  ```

- [ ] Create `report_executions` table (audit trail)

  ```sql
  CREATE TABLE report_executions (
    id UUID PRIMARY KEY,
    schedule_id UUID,
    status VARCHAR(50),
    recipients TEXT[],
    error_message TEXT,
    executed_at TIMESTAMP,
    execution_time_ms INT
  );
  ```

- [ ] Create `afs` (Authorization for Expenditure) table if not exists

  ```sql
  CREATE TABLE afes (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    well_id UUID NOT NULL,
    afe_number VARCHAR(50),
    projected_volume_oil DECIMAL,
    projected_volume_gas DECIMAL,
    projected_revenue DECIMAL,
    approved_date DATE,
    completion_date DATE,
    UNIQUE(tenant_id, afe_number)
  );
  ```

### DevOps

- [ ] Configure PDF rendering service (may need headless browser)
- [ ] Set up SMTP relay for email sending (already have Azure Communication Services)
- [ ] Configure scheduler for report execution
- [ ] Add monitoring for report job execution
- [ ] Set up audit logging for report generation

---

## Dependencies

### Blockers

- [ ] Sprint 7 must be complete (dashboard UI for accessing reports)
- [ ] Commodity pricing API configured (for revenue calculations)

### External Dependencies

- [ ] `pdfkit` or `puppeteer` npm package for PDF generation
- [ ] RRC Form specifications (official templates)
- [ ] COPAS standards documentation
- [ ] Azure Communication Services (already configured)

---

## Definition of Done

### Code Quality

- [ ] TypeScript strict mode (no `any`)
- [ ] Lint passes
- [ ] Type check passes
- [ ] Build succeeds

### Testing

- [ ] Unit tests >80% coverage (calculations)
- [ ] Integration tests for report generation
- [ ] E2E tests for report download flow
- [ ] Compliance validation: RRC Form fields match specification
- [ ] Performance test: 50-well report < 5 seconds

### Security

- [ ] Authorization: User can only generate reports for their tenant
- [ ] Input validation on all filters/parameters
- [ ] Audit logging: All report generation events logged
- [ ] No sensitive data logged (redact if needed)

### Documentation

- [ ] API endpoints documented (Swagger)
- [ ] Report format documented (which fields map where)
- [ ] RRC compliance checklist documented
- [ ] COPAS format compliance documented

### Review

- [ ] PR reviewed and approved
- [ ] CI/CD passing
- [ ] Demo-ready with sample reports
- [ ] Compliance officer review (if applicable)

---

## Sprint Retrospective Template

### What Went Well

- [Item 1]
- [Item 2]

### What to Improve

- [Item 1]
- [Item 2]

### Action Items for Next Sprint

- [ ] [Action 1]
- [ ] [Action 2]

---

## Metrics

- **Planned Story Points:** 28 hours
- **Completed Story Points:** [X]
- **Velocity:** [X points]
- **Code Coverage:** [X%]
- **Report Generation Time:** < 5 seconds
- **Report Accuracy Rate:** 100%
- **RRC Compliance:** 100%
- **COPAS Compliance:** 100%

---

## Next Sprint Preview

**Sprint 9: User Management & Team Collaboration**

- Team member invitation and role assignment
- Activity audit trail
- Bulk operations (export, schedule reports)
- Permission inheritance for organization hierarchy

**Estimated Duration:** 1 week (24 hours)
