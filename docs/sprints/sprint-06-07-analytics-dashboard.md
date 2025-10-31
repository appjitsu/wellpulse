# Sprint 6-7 - Historical Analytics & Production Dashboard (Combined)

**Phase:** Phase 2 (Post-MVP Foundation)
**Goal:** Implement comprehensive production analytics, real-time monitoring dashboard, and performance testing infrastructure

**Sprint Duration:** 2 weeks
**Estimated Hours:** 84 hours (Sprint 6: 32h + Sprint 7: 40h + Testing: 12h)
**Start Date:** Post-Sprint 5

---

## Sprint Objectives

### Primary Goals

1. **Historical Analytics** - Enable operators to analyze production trends, identify patterns, and forecast well performance using time-series aggregation
2. **Real-Time Dashboard** - Build a production operations center dashboard serving as the central monitoring hub with KPIs, well status, and alerts
3. **Performance Testing** - Validate system performance under realistic production loads using continuous simulation data

### Success Metrics

**Analytics:**
- [ ] Daily/weekly/monthly production summaries calculated for all wells
- [ ] Trend charts render with 500+ data points without performance degradation
- [ ] Historical data accessible for up to 24 months (configurable retention)
- [ ] 7-day production forecast with 95% confidence intervals

**Dashboard:**
- [ ] Dashboard loads with 50 wells in < 2 seconds
- [ ] Real-time alert notifications appear within 3 seconds of trigger
- [ ] All KPI cards update automatically every 60 seconds
- [ ] Well status map renders with 100+ well markers without lag
- [ ] Mobile-responsive design works on tablet (1024px width)
- [ ] Accessibility: WCAG 2.1 AA compliance

**Performance & Testing:**
- [ ] Load testing validates 100 concurrent users with < 3s response time
- [ ] Prometheus metrics track all critical system performance indicators
- [ ] Real-time dashboard shows simulation activity and system health
- [ ] Database query performance analyzed under continuous load
- [ ] Memory profiling confirms no leaks during 24-hour simulation runs

---

## Part 1: Historical Analytics & Trends

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

**Patterns Used:** Hexagonal Architecture, DDD, CQRS, Repository, Scheduler

**Testing:**
- [ ] Unit tests for aggregation logic (edge cases: DST, month boundaries)
- [ ] Integration tests with sample data
- [ ] E2E test for scheduled job execution
- [ ] Performance test: aggregate 10K wells < 30 seconds

**Estimation:** 6 hours

---

### US-1002: Calculate Production Trends (Daily/Weekly/Monthly)

**As an** analytics engine
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
  - Business logic: `identifyAnomalies()`, `calculateForecast()`, `getTrendDirection()`

- **Application Layer:**
  - `CalculateTrendCommand` - Compute trends from aggregates
  - `GetTrendQuery` - Retrieve trend for well
  - `GetAnomaliesQuery` - List recent anomalies

- **Infrastructure Layer:**
  - `TrendRepository` - Persist calculated trends
  - Statistical library: `simple-statistics` npm package
  - Cache trends (TTL: 6 hours) to avoid recalculation

**Patterns Used:** Hexagonal Architecture, DDD, CQRS, Repository, Caching

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
  - Alternative: `react-native-chart-kit` library
  - Query hook: `useTrendData(wellId)` fetches aggregates
  - Responsive width (full screen - 32px padding)

- **Backend Changes:**
  - Add endpoint: `GET /trends/:wellId?period=30d` returning aggregates

**Patterns Used:** React Hooks, Component Composition, Data Fetching (React Query), Responsive Design

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

**Patterns Used:** Hexagonal Architecture, Component Composition, Data Fetching, Responsive Design, Pagination

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
  - Library: `simple-statistics` (JS)
  - Store forecasts with TTL (recalculate if > 24 hours old)

**Patterns Used:** Hexagonal Architecture, DDD, CQRS, Caching

**Testing:**
- [ ] Unit tests for forecast accuracy (MAE, RMSE)
- [ ] Unit tests for confidence interval calculation
- [ ] Integration tests with historical data
- [ ] E2E test: verify forecast displays on dashboard

**Estimation:** 5 hours

---

## Part 2: Real-Time Production Dashboard

### US-1101: Dashboard KPI Cards (Production Summary)

**As a** fleet manager
**I want** to see production KPIs at a glance (total oil/gas, active wells count, revenue)
**So that** I can quickly assess fleet performance and spot anomalies

**Acceptance Criteria:**

- [ ] KPI card 1: "Total Oil Production" (last 24 hours, unit: BOPD, trend arrow)
- [ ] KPI card 2: "Total Gas Production" (last 24 hours, unit: MCFD, trend arrow)
- [ ] KPI card 3: "Active Wells" (count, % of total, status color)
- [ ] KPI card 4: "Fleet Revenue" (last 24 hours, based on commodity prices)
- [ ] KPI card 5: "Unacknowledged Alerts" (count, color by severity)
- [ ] KPI card 6: "Downtime" (fleet-wide, %, trending)
- [ ] Each card shows value, trend direction, and comparison to previous day
- [ ] Cards arranged in 2x3 grid (responsive to 1x6 on mobile)
- [ ] Click card to drill-down to detailed view

**Technical Implementation:**

- **Frontend (React/Next.js):**
  - Component: `KPICards.tsx` with 6 card components
  - Component: `KPICard.tsx` reusable card (title, value, trend, sparkline)
  - Icons: Use `lucide-react` for trend arrows
  - Colors: Green (up), Red (down), Gray (flat)

- **Backend Changes:**
  - Endpoint: `GET /dashboard/kpis` returning aggregated metrics
  - Query handler: `GetDashboardKPIsQuery` with heavy caching

**Patterns Used:** Component Composition, Responsive Design, Caching (Redis 1-min TTL), React Hooks

**Testing:**
- [ ] Unit tests for KPI calculation logic
- [ ] Component tests for KPICard rendering
- [ ] E2E test: verify KPIs load and auto-refresh
- [ ] Accessibility test: keyboard navigation, ARIA labels

**Estimation:** 6 hours

---

### US-1102: Real-Time Alert Badge on Dashboard

**As an** operator
**I want** to see unacknowledged alerts prominently on the dashboard
**So that** I can immediately see critical issues requiring attention

**Acceptance Criteria:**

- [ ] Alert badge displays total unacknowledged count (e.g., "12")
- [ ] Badge color: Red (critical), Orange (warning), Blue (info)
- [ ] Badge appears on: dashboard nav bar, KPI card, and sidebar
- [ ] Clicking badge opens alert drawer (slide-in from right)
- [ ] New alerts cause badge to pulse/flash
- [ ] Badge updates via WebSocket in real-time (< 1 second)
- [ ] "Mark all as read" button in drawer
- [ ] Filter alerts by: severity, well, date range

**Technical Implementation:**

- **Frontend (React/Next.js):**
  - Context: `AlertContext.tsx` manages alert state globally
  - Hook: `useAlerts()` for accessing alert data and subscription
  - Component: `AlertBadge.tsx` displays count with animation
  - Component: `AlertDrawer.tsx` for list and acknowledgement
  - WebSocket hook: `useAlertWebSocket()` subscribes to server events

- **Backend Changes:**
  - WebSocket endpoint: `/ws/alerts?token=JWT_TOKEN`
  - Message format: `{ type: 'alert_created', alert: AlertDTO }`

- **Infrastructure Layer:**
  - Use Socket.IO or ws library for WebSocket
  - Redis Pub/Sub for alert broadcasting

**Patterns Used:** React Context API, WebSocket Communication, Pub/Sub Pattern, Real-Time Sync

**Testing:**
- [ ] Unit tests for alert context reducer
- [ ] Component tests for badge animations
- [ ] E2E test: create alert via API, verify badge updates via WebSocket
- [ ] Load test: 100 simultaneous WebSocket connections

**Estimation:** 8 hours

---

### US-1103: Well Status Map Visualization

**As a** production manager
**I want** to see all wells on a geographic map with color-coded status
**So that** I can quickly identify which wells need attention based on location

**Acceptance Criteria:**

- [ ] Map displays well locations as markers (Mapbox or Google Maps)
- [ ] Marker color: Green (normal), Yellow (warning), Red (critical/down)
- [ ] Marker size: Larger for higher-producing wells
- [ ] Hover marker: Shows well name, API number, current production, status
- [ ] Click marker: Opens well detail modal
- [ ] Filter map by: well status, well type, property boundary
- [ ] Show/hide well labels on map
- [ ] Zoom and pan controls
- [ ] Mobile-responsive (stacked view if viewport < 768px)
- [ ] Initial zoom: Fit all wells on map with padding

**Technical Implementation:**

- **Frontend (React/Next.js):**
  - Library: `react-map-gl` (Mapbox) or `react-google-maps-api`
  - Component: `WellStatusMap.tsx` main map container
  - Component: `WellMarker.tsx` individual marker with popup
  - Component: `MapControls.tsx` for filters and legend

- **Backend Changes:**
  - Endpoint: `GET /wells/map?filters={}` returning well location + status
  - DTO includes: `{ id, name, latitude, longitude, status, production, api }`

**Patterns Used:** Component Composition, Geospatial Visualization, Marker Clustering, Responsive Design

**Testing:**
- [ ] Unit tests for marker color logic
- [ ] Component tests for map rendering with markers
- [ ] E2E test: zoom/pan map, click marker, verify modal
- [ ] Performance test: render 200 markers without lag

**Estimation:** 10 hours

---

### US-1104: Dashboard Auto-Refresh and Real-Time Updates

**As an** operator
**I want** dashboard data to auto-refresh every 60 seconds
**So that** I always see current production status without manual refresh

**Acceptance Criteria:**

- [ ] Dashboard auto-refreshes all data every 60 seconds
- [ ] Auto-refresh interval configurable (30s, 60s, 120s)
- [ ] "Last updated: 2 minutes ago" indicator at bottom of dashboard
- [ ] Pause auto-refresh on user interaction, resume after 5 minutes idle
- [ ] New alerts update in real-time via WebSocket (not waiting for 60s)
- [ ] Only refetch data that changed (incremental updates)
- [ ] Smooth transitions when data updates (no flickering)

**Technical Implementation:**

- **Frontend (React/Next.js):**
  - Hook: `useDashboardRefresh()` manages 60s interval
  - React Query: Set `refetchInterval: 60000` on queries
  - Pause on interaction: Use `useIdle()` hook from `react-use`
  - Smooth updates: Use React Transition for CSS animations

- **Backend Changes:**
  - Implement `ETag` headers on dashboard endpoints
  - Return `304 Not Modified` if data unchanged

**Patterns Used:** React Hooks (useInterval, useIdle), HTTP Caching (ETag), Conditional Requests

**Testing:**
- [ ] Unit tests for refresh timer logic
- [ ] Component tests for last-updated indicator
- [ ] E2E test: verify refresh occurs at 60s
- [ ] Network test: verify ETag caching works

**Estimation:** 5 hours

---

### US-1105: Well Detail Modal from Dashboard

**As an** operator
**I want** to click a well on the map/table and see full well details in a modal
**So that** I can investigate well performance without navigating away

**Acceptance Criteria:**

- [ ] Modal displays: well name, API, type, status, production metrics
- [ ] Modal shows last 5 alerts related to well
- [ ] Modal shows production trend chart (30 days)
- [ ] Modal shows next scheduled action (maintenance, review)
- [ ] "Edit" button opens well configuration page
- [ ] "View Full Report" button navigates to well analytics
- [ ] Close button or press Escape to close modal
- [ ] Modal is mobile-responsive (full-screen on mobile)

**Technical Implementation:**

- **Frontend (React/Next.js):**
  - Component: `WellDetailModal.tsx` with tabs
  - Tabs: Overview, Alerts, Trends, Maintenance, Forecast
  - Uses existing components: TrendChart, AlertList, MaintenanceSchedule

- **Backend Changes:**
  - Endpoint: `GET /wells/:wellId/dashboard-detail` (combines multiple queries)

**Patterns Used:** Component Composition, Modal Pattern, Tab Navigation, Data Aggregation

**Testing:**
- [ ] Component tests for modal rendering
- [ ] E2E test: click well, verify modal opens, close modal
- [ ] Accessibility test: keyboard navigation, focus management

**Estimation:** 6 hours

---

### US-1106: Dashboard Export (PDF/CSV)

**As a** manager
**I want** to export the current dashboard view as PDF or CSV
**So that** I can share production reports with stakeholders

**Acceptance Criteria:**

- [ ] "Export" button in dashboard header
- [ ] Export options: PDF (dashboard snapshot), CSV (KPI data)
- [ ] PDF includes: KPI cards, map screenshot, current alerts
- [ ] PDF includes company logo and export timestamp
- [ ] CSV includes: all KPI values, timestamps, well-level breakdown
- [ ] Export takes < 5 seconds
- [ ] File names: `dashboard_export_YYYY-MM-DD.pdf`

**Technical Implementation:**

- **Frontend (React/Next.js):**
  - Library: `html2canvas` + `jspdf` for PDF export
  - CSV: Use `papaparse` library

- **Backend Changes:**
  - Endpoint: `POST /dashboard/export` (server-side generation)
  - Service: `DashboardExportService` generates PDF/CSV

**Patterns Used:** Export Pattern, Document Generation (PDF), Templating

**Testing:**
- [ ] Unit tests for CSV generation
- [ ] E2E test: click export, verify file downloads
- [ ] Verify PDF content matches dashboard

**Estimation:** 5 hours

---

## Part 3: Performance Testing & Monitoring

### US-1107: Load Testing with Continuous Simulation

**As a** DevOps engineer
**I want** to perform load testing using continuous production simulation data
**So that** I can validate system performance under realistic production loads

**Acceptance Criteria:**

- [ ] Load test simulates 100 concurrent users accessing dashboard
- [ ] Simulates field data entry from 50 active wells every 30 seconds
- [ ] Tests API response times under load (95th percentile < 3 seconds)
- [ ] Tests database query performance with millions of records
- [ ] Generates realistic production data patterns (varying oil/gas rates)
- [ ] Runs for minimum 1 hour to identify performance degradation
- [ ] Reports generated showing: throughput, latency, error rate, resource usage

**Technical Implementation:**

- **Testing Tools:**
  - Artillery or k6 for HTTP load testing
  - Script: `scripts/load-testing/continuous-simulation.yml`
  - Metrics: Response time (p50, p95, p99), error rate, requests/sec

- **Simulation Script:**
  - Uses existing `scripts/simulate-production-data.ts` as base
  - Extends to support concurrent users and realistic timing
  - Generates correlated data (wells in same field have similar rates)

- **Infrastructure:**
  - Run against staging environment (scaled down version of production)
  - Monitor CPU, memory, disk I/O, network during test
  - Database connection pool sizing validation

**Patterns Used:** Load Testing Pattern, Performance Benchmarking, Continuous Simulation

**Testing:**
- [ ] Validate test script generates expected request volume
- [ ] Verify simulation data matches production data patterns
- [ ] Confirm metrics are collected correctly

**Estimation:** 4 hours

---

### US-1108: Prometheus Metrics for Performance Tracking

**As a** DevOps engineer
**I want** Prometheus metrics for all critical system components
**So that** I can track performance trends and identify bottlenecks

**Acceptance Criteria:**

- [ ] API metrics: Request rate, response time (histogram), error rate
- [ ] Database metrics: Query execution time, connection pool usage, slow queries
- [ ] Background job metrics: Job execution time, success/failure rate, queue depth
- [ ] Cache metrics: Redis hit/miss rate, memory usage, eviction count
- [ ] WebSocket metrics: Active connections, message rate, disconnect rate
- [ ] Custom business metrics: Wells processed/hour, aggregations completed, forecasts generated
- [ ] Metrics exposed at `/metrics` endpoint in Prometheus format
- [ ] Grafana dashboard created for visualization

**Technical Implementation:**

- **Instrumentation:**
  - Library: `prom-client` npm package
  - Middleware: Auto-instrument Express routes
  - Custom metrics in domain services

- **Metrics Examples:**
  ```typescript
  // Request duration histogram
  http_request_duration_seconds{method="GET",route="/dashboard/kpis",status="200"}

  // Database query duration
  db_query_duration_seconds{operation="SELECT",table="field_entries"}

  // Background job duration
  job_duration_seconds{job="aggregate_production_data",status="success"}

  // Business metrics
  wells_processed_total{operation="sync"}
  forecasts_generated_total{period="daily"}
  ```

- **Infrastructure:**
  - Prometheus server scrapes `/metrics` endpoint every 15s
  - Metrics retained for 30 days
  - Alerts configured for critical thresholds

**Patterns Used:** Observability Pattern, Metrics Collection, Monitoring

**Testing:**
- [ ] Verify metrics are exposed correctly
- [ ] Validate metric values are accurate
- [ ] Test Prometheus scraping

**Estimation:** 3 hours

---

### US-1109: Real-Time Performance Dashboard

**As a** DevOps engineer
**I want** a real-time dashboard showing simulation activity and system health
**So that** I can monitor performance during load tests and production

**Acceptance Criteria:**

- [ ] Dashboard shows live metrics: requests/sec, active users, response times
- [ ] Displays database performance: queries/sec, slow query count, connection pool
- [ ] Shows background job status: jobs queued, processing, completed, failed
- [ ] Visualizes cache performance: hit rate, memory usage
- [ ] Real-time alerts for threshold violations (e.g., response time > 3s)
- [ ] Auto-refreshes every 5 seconds
- [ ] Historical view: last 1 hour, 6 hours, 24 hours
- [ ] Export metrics as CSV for analysis

**Technical Implementation:**

- **Frontend:**
  - Grafana dashboard or custom React dashboard
  - Queries Prometheus for metrics
  - Components: `MetricCard.tsx`, `MetricChart.tsx`, `AlertPanel.tsx`

- **Backend:**
  - Prometheus data source
  - PromQL queries for aggregations
  - Optional: WebSocket stream for sub-second updates

- **Infrastructure:**
  - Grafana server or custom dashboard at `/monitoring`
  - Alert manager for threshold violations

**Patterns Used:** Real-Time Monitoring, Dashboard Pattern, Alerting

**Testing:**
- [ ] Verify dashboard loads and displays metrics
- [ ] Test real-time updates
- [ ] Validate alert thresholds

**Estimation:** 3 hours

---

### US-1110: Database Query Performance Analysis

**As a** database administrator
**I want** to analyze query performance under continuous load
**So that** I can identify slow queries and optimize database schema

**Acceptance Criteria:**

- [ ] Enable PostgreSQL query logging (log queries > 100ms)
- [ ] Analyze slow query log to identify bottlenecks
- [ ] Generate query execution plans for slow queries
- [ ] Identify missing indexes using pg_stat_statements
- [ ] Test impact of indexes on query performance
- [ ] Measure query performance before and after optimization
- [ ] Document optimization recommendations

**Technical Implementation:**

- **Analysis Tools:**
  - PostgreSQL extensions: `pg_stat_statements`, `auto_explain`
  - Analysis script: `scripts/analyze-db-performance.ts`
  - Query: `SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 50;`

- **Optimization Process:**
  1. Enable query logging: `log_min_duration_statement = 100`
  2. Run load test to generate load
  3. Analyze slow query log
  4. Generate execution plans: `EXPLAIN ANALYZE`
  5. Add indexes based on analysis
  6. Re-run load test to validate improvement

- **Infrastructure:**
  - Database monitoring tools: pgBadger for log analysis
  - Index recommendations: pg_index_advisor

**Patterns Used:** Performance Analysis, Query Optimization, Database Tuning

**Testing:**
- [ ] Verify slow queries are logged correctly
- [ ] Validate execution plans show index usage
- [ ] Measure query time improvement

**Estimation:** 3 hours

---

### US-1111: Memory Profiling During Extended Runs

**As a** DevOps engineer
**I want** to monitor memory usage during 24-hour simulation runs
**So that** I can identify memory leaks and ensure system stability

**Acceptance Criteria:**

- [ ] Track memory usage (heap, RSS) over 24 hours
- [ ] Identify memory leaks (continuously increasing memory without release)
- [ ] Profile memory usage by component (API, background jobs, cache)
- [ ] Generate heap snapshots at regular intervals
- [ ] Compare heap snapshots to identify leak sources
- [ ] Document memory usage patterns (baseline, peak, average)
- [ ] Verify memory usage stays within acceptable limits (< 2GB per process)

**Technical Implementation:**

- **Profiling Tools:**
  - Node.js: `v8-profiler-next` for heap snapshots
  - Chrome DevTools: Analyze heap snapshots
  - Script: `scripts/memory-profiling.ts`

- **Profiling Process:**
  1. Start simulation with profiling enabled
  2. Capture heap snapshot every 30 minutes
  3. Monitor memory metrics via Prometheus
  4. After 24 hours, analyze snapshots
  5. Identify objects not garbage collected
  6. Fix leaks and re-test

- **Monitoring:**
  - Prometheus metrics: `process_resident_memory_bytes`, `process_heap_bytes`
  - Alerts for memory > threshold (e.g., > 1.5GB)

**Patterns Used:** Memory Profiling, Leak Detection, Resource Monitoring

**Testing:**
- [ ] Verify heap snapshots are captured
- [ ] Validate memory metrics are tracked
- [ ] Confirm no memory leaks in controlled test

**Estimation:** 3 hours

---

## Technical Tasks

### Backend

**Analytics & Trends:**
- [ ] Create `TimeSeriesAggregate` entity and repository
- [ ] Implement aggregation scheduler (node-cron)
- [ ] Create `ProductionTrend` entity with statistical calculations
- [ ] Add `simple-statistics` package for regression/anomaly detection
- [ ] Create trend calculation service
- [ ] Add trend API endpoints (GET /trends)
- [ ] Backfill historical aggregates
- [ ] Add caching layer (Redis) for trend calculations

**Dashboard:**
- [ ] Create dashboard KPI query handler and repository
- [ ] Implement alert badge API endpoint
- [ ] Create WebSocket connection handler
- [ ] Set up Redis Pub/Sub for alert broadcasting
- [ ] Implement well location/map endpoint
- [ ] Add ETag support to all dashboard endpoints
- [ ] Create dashboard export service

**Performance & Monitoring:**
- [ ] Add Prometheus metrics instrumentation
- [ ] Implement `/metrics` endpoint
- [ ] Add query logging configuration
- [ ] Create performance analysis scripts
- [ ] Add memory profiling utilities

### Frontend - Web

**Analytics:**
- [ ] Create TrendCard component
- [ ] Create TrendGrid component with responsive layout
- [ ] Create TrendFilters component
- [ ] Implement Recharts line charts
- [ ] Add forecast visualization with confidence intervals
- [ ] Add "Export as CSV" button
- [ ] Create analytics trends page

**Dashboard:**
- [ ] Create KPICards component (6 cards with sparklines)
- [ ] Create AlertBadge component with animation
- [ ] Create AlertDrawer component for alert list
- [ ] Integrate WebSocket for real-time alerts
- [ ] Set up MapBox or Google Maps integration
- [ ] Create WellStatusMap component with markers
- [ ] Create WellDetailModal component (multi-tab)
- [ ] Create dashboard page layout
- [ ] Implement auto-refresh with React Query
- [ ] Add export functionality (PDF/CSV)

**Monitoring:**
- [ ] Create performance dashboard (Grafana or custom)
- [ ] Create MetricCard component
- [ ] Create MetricChart component
- [ ] Add real-time metric updates

### Frontend - Mobile

- [ ] Create ProductionTrendChart component
- [ ] Add trend chart to well detail screen
- [ ] Create trend modal for expanded view
- [ ] Add refresh logic for trend data on sync

### Database

**Schema:**
- [ ] Create `time_series_aggregates` table (tenant_db)
  ```sql
  CREATE TABLE time_series_aggregates (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    well_id UUID NOT NULL,
    aggregation_period VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
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
    direction VARCHAR(10), -- 'up', 'flat', 'down'
    slope DECIMAL,
    r_squared DECIMAL,
    forecast_json JSONB,
    calculated_at TIMESTAMP,
    UNIQUE(tenant_id, well_id, trend_date)
  );
  ```

- [ ] Add indexes for performance
  ```sql
  CREATE INDEX idx_aggregates_lookup ON time_series_aggregates(tenant_id, well_id, aggregation_period, period_start);
  CREATE INDEX idx_trends_lookup ON production_trends(tenant_id, well_id, trend_date);
  ```

- [ ] Create dashboard KPIs view
  ```sql
  CREATE VIEW dashboard_kpis AS
  SELECT
    t.id as tenant_id,
    SUM(CASE WHEN f.production_data->>'oilVolume' IS NOT NULL
        THEN (f.production_data->>'oilVolume')::decimal ELSE 0 END) as total_oil_24h,
    SUM(CASE WHEN f.production_data->>'gasVolume' IS NOT NULL
        THEN (f.production_data->>'gasVolume')::decimal ELSE 0 END) as total_gas_24h,
    COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'ACTIVE') as active_wells_count
  FROM tenants t
  LEFT JOIN wells w ON w.tenant_id = t.id AND w.deleted_at IS NULL
  LEFT JOIN field_entries f ON f.well_id = w.id
    AND f.entry_type = 'PRODUCTION'
    AND f.recorded_at > NOW() - INTERVAL '24 hours'
    AND f.deleted_at IS NULL
  GROUP BY t.id;
  ```

**Performance:**
- [ ] Enable pg_stat_statements extension
- [ ] Configure query logging
- [ ] Add geospatial indexes (if using PostGIS)

### DevOps

**Application:**
- [ ] Configure node-cron scheduler in API
- [ ] Set aggregation job timing (daily 23:59, weekly Monday, monthly 1st)
- [ ] Add Redis cache configuration
- [ ] Configure WebSocket server (Socket.IO or ws)
- [ ] Set up Redis Pub/Sub messaging
- [ ] Configure CORS for WebSocket connections

**Monitoring:**
- [ ] Deploy Prometheus server
- [ ] Configure Prometheus scrape targets
- [ ] Deploy Grafana server
- [ ] Create Grafana dashboards
- [ ] Configure alerting rules
- [ ] Set up health checks for WebSocket

**Load Testing:**
- [ ] Create Artillery/k6 load test configurations
- [ ] Set up staging environment for testing
- [ ] Schedule regular load test runs
- [ ] Configure performance baseline metrics

---

## Dependencies

### Blockers

- [ ] Sprint 5 must complete data ingestion (need historical field entries)
- [ ] Commodity price API configured (for revenue KPI)

### External Dependencies

**NPM Packages:**
- [ ] `simple-statistics` - Statistical calculations
- [ ] `node-cron` - Scheduler
- [ ] `socket.io` or `ws` - WebSocket
- [ ] `html2canvas`, `jspdf` - PDF export
- [ ] `prom-client` - Prometheus metrics
- [ ] `artillery` or `k6` - Load testing

**Services:**
- [ ] Redis cache service (already in infrastructure)
- [ ] Mapbox API key or Google Maps API key
- [ ] Prometheus server
- [ ] Grafana server

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
- [ ] E2E tests for dashboard flows
- [ ] WebSocket tests (mock server)
- [ ] Performance tests: <2 second response time
- [ ] Load tests: 100 concurrent users handled
- [ ] Memory profiling: No leaks detected

### Security

- [ ] Authorization: All data filtered by tenant
- [ ] WebSocket authentication: JWT validation
- [ ] Input validation on all filters
- [ ] HTTPS required for WebSocket (WSS)
- [ ] No secrets in code
- [ ] Read-only operations (no sensitive data exposure)

### Documentation

- [ ] API endpoints documented (Swagger)
- [ ] Trend calculation algorithm documented (JSDoc)
- [ ] Component props documented
- [ ] WebSocket message format documented
- [ ] Deployment guide for WebSocket setup
- [ ] Load testing guide
- [ ] Performance monitoring guide

### Review

- [ ] PR created and reviewed
- [ ] CI/CD passing
- [ ] Demo-ready with sample data
- [ ] Load tested with multiple concurrent users
- [ ] Performance metrics meet targets

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

**Development:**
- **Planned Story Points:** 84 hours
- **Completed Story Points:** [X]
- **Velocity:** [X points]
- **Code Coverage:** [X%]
- **Build Success Rate:** [X%]
- **Critical Bugs:** [X]

**Performance:**
- **Dashboard Load Time:** < 2 seconds ✓
- **Trend Calculation Performance:** < 100ms per well ✓
- **Chart Render Performance:** < 500ms for 500 data points ✓
- **WebSocket Connection Count:** [X]
- **Alert Notification Latency:** < 3 seconds ✓
- **Map Render Time (100 markers):** < 1 second ✓

**Load Testing:**
- **Concurrent Users Supported:** 100+ ✓
- **95th Percentile Response Time:** < 3 seconds ✓
- **Requests Per Second:** [X]
- **Error Rate:** < 1% ✓
- **Memory Usage:** < 2GB per process ✓

---

## Next Sprint Preview

**Sprint 8: Export & Compliance Reporting**

- Implement RRC Form 1 generation
- Automated production accounting (AFE tracking)
- Compliance report scheduling
- COPAS standards compliance

**Estimated Duration:** 1 week (28 hours)
