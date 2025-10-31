# Sprint 6 - Historical Data & Trends

**Phase:** Phase 2 (Post-MVP Foundation)
**Goal:** Enable operators to analyze production trends, identify patterns, and forecast well performance

**Sprint Duration:** 1 week
**Estimated Hours:** 32 hours
**Start Date:** Post-Sprint 5

---

## Sprint Objectives

### Primary Goal

Implement time-series data aggregation and visualization to provide operators with production trend analysis, historical comparisons, and performance forecasting capabilities.

### Success Metrics

- [ ] Daily/weekly/monthly production summaries calculated for all wells
- [ ] Trend charts render with 500+ data points without performance degradation
- [ ] Historical data accessible for up to 24 months (configurable retention)
- [ ] Mobile app displays trend mini-charts on well detail screen
- [ ] Web dashboard shows well performance trends with forecast overlay

---

## User Stories

### US-1001: Aggregate Production Data into Time Series

**As a** data aggregation service
**I want** to calculate daily/weekly/monthly production summaries
**So that** trends can be visualized without querying millions of raw field entries

**Acceptance Criteria:**

- [ ] Daily aggregates created at 23:59 CT for each well
- [ ] Weekly aggregates created every Monday at 00:00 CT
- [ ] Monthly aggregates created on 1st of month at 00:00 CT
- [ ] Aggregates calculate: sum, avg, min, max, stddev for each numeric field
- [ ] Aggregates handle wells with multiple entries per day (average them)
- [ ] Backfill job can calculate aggregates for historical data
- [ ] No duplicate aggregates if job runs multiple times

**Technical Implementation:**

- **Domain Layer:**
  - `TimeSeriesAggregate` entity with factory methods: `createDaily()`, `createWeekly()`, `createMonthly()`
  - Value objects: `AggregationWindow`, `TimeSeriesMetrics`
  - Business logic: `isComplete()` (has minimum entries), `canMerge(other)`

- **Application Layer:**
  - `AggregateProductionDataCommand` - Triggered by scheduler
  - `GetTimeSeriesQuery` - Retrieve aggregates for visualization
  - `BackfillAggregatesCommand` - Populate historical data

- **Infrastructure Layer:**
  - `TimeSeriesRepository` - CRUD for aggregates
  - `AggregationScheduler` - Scheduled job using node-cron
  - Database indexes on (tenant_id, well_id, aggregation_period, timestamp)

- **Presentation Layer:**
  - No direct API endpoint (internal use via queries)

**Patterns Used:**

- [x] Hexagonal Architecture
- [x] Domain-Driven Design
- [x] CQRS Pattern
- [x] Repository Pattern
- [x] Scheduler Pattern

**Testing:**

- [ ] Unit tests for aggregation logic (edge cases: DST, month boundaries)
- [ ] Integration tests with sample data
- [ ] E2E test for scheduled job execution
- [ ] Performance test: aggregate 10K wells < 30 seconds

**Estimation:** 6 hours

---

### US-1002: Calculate Production Trends (Daily/Weekly/Monthly)

**As a** analytics engine
**I want** to analyze production trends with statistical calculations
**So that** operators can identify anomalies and performance degradation

**Acceptance Criteria:**

- [ ] Trend line calculated using linear regression (recent vs previous period)
- [ ] Anomaly detection using Z-score (values > 2σ flagged as outliers)
- [ ] Forecast next 7 days using exponential smoothing (ETS)
- [ ] Trend direction (up/flat/down) determined from regression slope
- [ ] Confidence intervals calculated for forecast (95% CI)
- [ ] Handle missing data (gaps in time series) gracefully
- [ ] Recalculate trends incrementally as new data arrives

**Technical Implementation:**

- **Domain Layer:**
  - `ProductionTrend` entity with: direction, slope, r-squared, forecast
  - Value objects: `ForecastPoint`, `ConfidenceInterval`, `AnomalyThreshold`
  - Business logic: `identify anomalies()`, `calculateForecast()`, `getTrendDirection()`

- **Application Layer:**
  - `CalculateTrendCommand` - Compute trends from aggregates
  - `GetTrendQuery` - Retrieve trend for well
  - `GetAnomaliesQuery` - List recent anomalies

- **Infrastructure Layer:**
  - `TrendRepository` - Persist calculated trends
  - Statistical library: `simple-statistics` npm package for linear regression, Z-score, exponential smoothing
  - Cache trends (TTL: 6 hours) to avoid recalculation

- **Presentation Layer:**
  - Query handlers return `TrendDTO` with visualization-ready data

**Patterns Used:**

- [x] Hexagonal Architecture
- [x] Domain-Driven Design
- [x] CQRS Pattern
- [x] Repository Pattern
- [x] Caching Pattern

**Testing:**

- [ ] Unit tests for trend calculations with known datasets
- [ ] Unit tests for anomaly detection (known outliers)
- [ ] Unit tests for forecasting accuracy (test set validation)
- [ ] Integration tests with database
- [ ] E2E test for complete trend pipeline

**Estimation:** 8 hours

---

### US-1003: Mobile: Trend Mini-Chart on Well Detail Screen

**As a** mobile operator
**I want** to see a small production trend chart (last 30 days) on the well detail screen
**So that** I can quickly assess well health without navigating to a separate analytics view

**Acceptance Criteria:**

- [ ] Mini-chart displays oil rate trend (last 30 days) as line chart
- [ ] Y-axis shows production range (min/max)
- [ ] X-axis shows date labels (every 7 days)
- [ ] Tap chart to open full trend modal
- [ ] Chart updates when syncing new field data
- [ ] Shows "No data available" if < 3 data points
- [ ] Renders in < 500ms (smooth scrolling)

**Technical Implementation:**

- **Frontend (React Native):**
  - Component: `ProductionTrendChart.tsx` using `react-native-svg` + custom drawing
  - Alternative: `react-native-chart-kit` library for faster development
  - Query hook: `useTrendData(wellId)` fetches aggregates
  - Responsive width (full screen - 32px padding)

- **Backend Changes:**
  - Add endpoint: `GET /trends/:wellId?period=30d` returning aggregates

- **Presentation Layer:**
  - DTO: `ProductionTrendDTO` with array of `{ date, value }`
  - No auth required on trend endpoint (read-only, filtered by tenant)

**Patterns Used:**

- [x] React Hooks
- [x] Component Composition
- [x] Data Fetching (React Query)
- [x] Responsive Design

**Testing:**

- [ ] Unit tests for chart data transformation
- [ ] Component tests for rendering with various data sizes
- [ ] E2E test: open well detail, verify chart renders
- [ ] Performance test: render chart with 500 data points

**Estimation:** 5 hours

---

### US-1004: Web Dashboard: Production Trend Chart

**As a** web dashboard user
**I want** to see production trends for all my wells on a filterable dashboard
**So that** I can compare well performance and identify fleet-wide patterns

**Acceptance Criteria:**

- [ ] Dashboard displays 2x2 grid of well trend cards (responsive)
- [ ] Each card shows: well name, last 30 days trend, current status
- [ ] Color coding: green (trending up), yellow (flat), red (trending down)
- [ ] Click card to expand to full analytics view
- [ ] Filter by: well status (active/inactive), well type, producing property
- [ ] Export trend data as CSV
- [ ] Load time < 2 seconds for 50 wells

**Technical Implementation:**

- **Frontend (React/Next.js):**
  - Page: `app/(dashboard)/analytics/trends.tsx`
  - Components: `TrendCard.tsx`, `TrendGrid.tsx`, `TrendFilters.tsx`
  - Charts: Use Recharts library with ResponsiveContainer
  - State: React Query for data fetching + caching

- **Backend Changes:**
  - Endpoint: `GET /trends?limit=50&offset=0&filters={}` returning paginated trends
  - Query handler: `GetTrendsPageQuery` with tenant filtering

- **Presentation Layer:**
  - DTO: `TrendPageDTO` with paginated results
  - Response example:

    ```json
    {
      "data": [
        {
          "wellId": "uuid",
          "wellName": "API #1234",
          "direction": "up",
          "slope": 0.85,
          "forecast": [{ "date": "2025-11-01", "value": 145 }],
          "anomalies": [{ "date": "2025-10-28", "value": 5, "reason": "Pump down" }]
        }
      ],
      "total": 125,
      "page": 1,
      "limit": 50
    }
    ```

**Patterns Used:**

- [x] Hexagonal Architecture
- [x] Component Composition
- [x] Data Fetching (React Query)
- [x] Responsive Design
- [x] Pagination Pattern

**Testing:**

- [ ] Unit tests for filter logic
- [ ] Component tests for TrendCard with various data
- [ ] E2E test: filter wells, verify results update
- [ ] Performance test: load dashboard with 100 wells

**Estimation:** 8 hours

---

### US-1005: Forecast Production with Confidence Intervals

**As a** production analyst
**I want** to see a 7-day production forecast with confidence intervals
**So that** I can plan maintenance and predict cash flow

**Acceptance Criteria:**

- [ ] Forecast uses exponential smoothing (ETS) algorithm
- [ ] 95% confidence interval displayed as shaded area around forecast line
- [ ] Forecast point includes: date, predicted value, lower bound, upper bound
- [ ] Forecast shows on web dashboard and mobile
- [ ] Toggle to show/hide historical data vs forecast
- [ ] Update forecast daily with new field data

**Technical Implementation:**

- **Domain Layer:**
  - `ForecastModel` entity with: historical data, forecast points, confidence level
  - Value objects: `ForecastPoint`, `ConfidenceInterval`
  - Business logic: `generateForecast(days: number)`, `getConfidenceBounds()`

- **Application Layer:**
  - `GenerateForecastCommand` - Create 7-day forecast
  - `GetForecastQuery` - Retrieve forecast for visualization

- **Infrastructure Layer:**
  - Library: `statsmodels` (Python) or `simple-statistics` (JS)
  - Store forecasts with TTL (recalculate if > 24 hours old)

- **Presentation Layer:**
  - DTO: `ForecastDTO` with array of `ForecastPointDTO`

**Patterns Used:**

- [x] Hexagonal Architecture
- [x] Domain-Driven Design
- [x] CQRS Pattern
- [x] Caching Pattern

**Testing:**

- [ ] Unit tests for forecast accuracy (MAE, RMSE)
- [ ] Unit tests for confidence interval calculation
- [ ] Integration tests with historical data
- [ ] E2E test: verify forecast displays on dashboard

**Estimation:** 5 hours

---

## Technical Tasks

### Backend

- [ ] Create `TimeSeriesAggregate` entity and repository
- [ ] Implement aggregation scheduler (node-cron)
- [ ] Create `ProductionTrend` entity with statistical calculations
- [ ] Add `simple-statistics` package for regression/anomaly detection
- [ ] Create trend calculation service
- [ ] Add trend API endpoints (GET /trends)
- [ ] Backfill historical aggregates
- [ ] Add caching layer (Redis) for trend calculations

### Frontend - Web

- [ ] Create TrendCard component
- [ ] Create TrendGrid component with responsive layout
- [ ] Create TrendFilters component (well type, status, property)
- [ ] Implement Recharts line charts
- [ ] Add forecast visualization (line + confidence interval shade)
- [ ] Add "Export as CSV" button
- [ ] Create analytics trends page

### Frontend - Mobile

- [ ] Create ProductionTrendChart component (SVG or chart library)
- [ ] Add trend chart to well detail screen
- [ ] Create trend modal for expanded view
- [ ] Add refresh logic for trend data on sync

### Database

- [ ] Create `time_series_aggregates` table (tenant_db)

  ```sql
  CREATE TABLE time_series_aggregates (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    well_id UUID NOT NULL REFERENCES wells(id),
    aggregation_period ENUM ('daily', 'weekly', 'monthly'),
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    field_name VARCHAR(255),
    sum_value DECIMAL,
    avg_value DECIMAL,
    min_value DECIMAL,
    max_value DECIMAL,
    stddev_value DECIMAL,
    count_entries INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, well_id, aggregation_period, period_start, field_name)
  );
  ```

- [ ] Create `production_trends` table (tenant_db)

  ```sql
  CREATE TABLE production_trends (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    well_id UUID NOT NULL,
    trend_date TIMESTAMP,
    direction ENUM ('up', 'flat', 'down'),
    slope DECIMAL,
    r_squared DECIMAL,
    forecast_json JSONB,
    calculated_at TIMESTAMP,
    UNIQUE(tenant_id, well_id, trend_date)
  );
  ```

- [ ] Add indexes: `(tenant_id, well_id, aggregation_period, period_start)`

### DevOps

- [ ] Add node-cron scheduler to API
- [ ] Configure aggregation job timing (daily 23:59, weekly Monday, monthly 1st)
- [ ] Add Redis cache configuration
- [ ] Set up monitoring for scheduler health

---

## Dependencies

### Blockers

- [ ] Sprint 5 must complete data ingestion (need historical field entries)

### External Dependencies

- [ ] `simple-statistics` npm package (statistical calculations)
- [ ] `node-cron` npm package (scheduler)
- [ ] Redis cache service (already in infrastructure)

---

## Definition of Done

### Code Quality

- [ ] Follows patterns from `docs/patterns/`
- [ ] TypeScript strict mode (no `any`)
- [ ] Lint passes
- [ ] Type check passes
- [ ] Build succeeds

### Testing

- [ ] Unit tests >80% coverage (domain, application layers)
- [ ] Integration tests for repositories
- [ ] E2E tests for trend API endpoints and UI
- [ ] Performance tests: <2 second response time for trend queries

### Security

- [ ] Authorization: Trend data filtered by tenant
- [ ] Input validation on filters
- [ ] No secrets in code
- [ ] Read-only operations (no sensitive data exposure)

### Documentation

- [ ] API documented (Swagger)
- [ ] Trend calculation algorithm documented (JSDoc)
- [ ] Mobile component props documented

### Review

- [ ] PR created and reviewed
- [ ] CI/CD passing
- [ ] Demo-ready with sample data

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

- **Planned Story Points:** 32 hours
- **Completed Story Points:** [X]
- **Velocity:** [X points]
- **Code Coverage:** [X%]
- **Build Success Rate:** [X%]
- **Critical Bugs:** [X]
- **Trend Calculation Performance:** < 100ms per well
- **Chart Render Performance:** < 500ms for 500 data points

---

## Next Sprint Preview

**Sprint 7: Web Dashboard & KPI Cards**

- Implement comprehensive dashboard with production KPIs
- Add well status map visualization
- Real-time alert notifications on dashboard
- Equipment utilization metrics

**Estimated Duration:** 1 week (40 hours)
