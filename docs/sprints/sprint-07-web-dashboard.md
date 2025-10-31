# Sprint 7 - Web Dashboard & KPI Cards

**Phase:** Phase 2 (Post-MVP Foundation)
**Goal:** Implement a production operations center dashboard enabling operators to monitor fleet health in real-time

**Sprint Duration:** 1 week
**Estimated Hours:** 40 hours
**Start Date:** Post-Sprint 6

---

## Sprint Objectives

### Primary Goal

Build a comprehensive web dashboard that serves as the central monitoring hub for oil & gas operators, displaying KPIs, well status, alerts, and enabling quick operational decision-making.

### Success Metrics

- [ ] Dashboard loads with 50 wells in < 2 seconds
- [ ] Real-time alert notifications appear within 3 seconds of trigger
- [ ] All KPI cards update automatically every 60 seconds
- [ ] Well status map renders with 100+ well markers without lag
- [ ] Mobile-responsive design works on tablet (1024px width)
- [ ] Accessibility: WCAG 2.1 AA compliance (keyboard navigation, screen readers)

---

## User Stories

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
- [ ] Each card shows value, trend direction (up/down/flat), and comparison to previous day
- [ ] Cards arranged in 2x3 grid (responsive to 1x6 on mobile)
- [ ] Click card to drill-down to detailed view

**Technical Implementation:**

- **Frontend (React/Next.js):**
  - Component: `KPICards.tsx` with 6 card components
  - Component: `KPICard.tsx` reusable card (title, value, trend, sparkline)
  - Icons: Use `lucide-react` for trend arrows and status indicators
  - Colors: Green (up), Red (down), Gray (flat), using CSS variables

- **Backend Changes:**
  - Endpoint: `GET /dashboard/kpis` returning aggregated metrics
  - Query handler: `GetDashboardKPIsQuery` with heavy caching

- **Presentation Layer:**
  - DTO: `DashboardKPIsDTO`

  ```json
  {
    "totalOilProduction24h": 45230,
    "totalOilProductionTrend": "up",
    "totalOilProductionChange": 1.2,
    "totalGasProduction24h": 123456,
    "totalGasProductionTrend": "down",
    "totalGasProductionChange": -2.5,
    "activeWellsCount": 87,
    "activeWellsPercentage": 92.5,
    "fleetRevenue24h": 123456.78,
    "unacknowledgedAlerts": { "critical": 3, "warning": 12, "info": 5 },
    "fleetDowntimePercent": 8.2,
    "fleetDowntimeTrend": "up"
  }
  ```

**Patterns Used:**

- [x] Component Composition
- [x] Responsive Design
- [x] Caching Pattern (Redis at 1-minute TTL)
- [x] React Hooks (useMemo for trend calculation)

**Testing:**

- [ ] Unit tests for KPI calculation logic
- [ ] Component tests for KPICard rendering
- [ ] E2E test: verify KPIs load and auto-refresh
- [ ] Accessibility test: keyboard navigation, ARIA labels

**Estimation:** 6 hours

---

### US-1102: Real-Time Alert Badge on Dashboard

**As a** operator
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
  - Endpoint: `GET /alerts/dashboard` for initial load
  - Endpoint: `POST /alerts/:id/acknowledge` (already exists)

- **Infrastructure Layer:**
  - Use Socket.IO or ws library for WebSocket
  - Message queue: Use Redis Pub/Sub for alert broadcasting
  - Alert service publishes to Redis on creation
  - WebSocket listeners pull from Redis and push to clients

**Patterns Used:**

- [x] React Context API
- [x] WebSocket Communication
- [x] Pub/Sub Pattern (Redis)
- [x] Real-Time Synchronization

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
  - State: React Query for well location data

- **Backend Changes:**
  - Endpoint: `GET /wells/map?filters={}` returning well location + status
  - DTO includes: `{ id, name, latitude, longitude, status, production, api }`
  - Query uses indexed geospatial queries if available

- **Infrastructure Layer:**
  - Mapbox API key stored in env variables
  - Cache well location data (TTL: 1 hour, rarely changes)

**Patterns Used:**

- [x] Component Composition
- [x] Geospatial Visualization
- [x] Marker Clustering (for many markers)
- [x] Responsive Design

**Testing:**

- [ ] Unit tests for marker color logic
- [ ] Component tests for map rendering with markers
- [ ] E2E test: zoom/pan map, click marker, verify modal
- [ ] Performance test: render 200 markers without lag

**Estimation:** 10 hours

---

### US-1104: Dashboard Auto-Refresh and Real-Time Updates

**As a** operator
**I want** dashboard data to auto-refresh every 60 seconds
**So that** I always see current production status without manual refresh

**Acceptance Criteria:**

- [ ] Dashboard auto-refreshes all data every 60 seconds
- [ ] Auto-refresh interval configurable (30s, 60s, 120s)
- [ ] "Last updated: 2 minutes ago" indicator at bottom of dashboard
- [ ] Pause auto-refresh on user interaction, resume after 5 minutes idle
- [ ] New alerts update in real-time via WebSocket (not waiting for 60s interval)
- [ ] Only refetch data that changed (incremental updates, not full reload)
- [ ] Smooth transitions when data updates (no flickering)

**Technical Implementation:**

- **Frontend (React/Next.js):**
  - Hook: `useDashboardRefresh()` manages 60s interval
  - State: `lastUpdated` timestamp
  - React Query: Set `refetchInterval: 60000` on queries
  - Pause on user interaction: Use `useIdle()` hook from `react-use`
  - Smooth updates: Use React Transition for CSS animations

- **Backend Changes:**
  - Implement `ETag` headers on dashboard endpoints for conditional requests
  - Return `304 Not Modified` if data unchanged
  - Reduces bandwidth and parsing time

- **Presentation Layer:**
  - All queries must support ETag validation

**Patterns Used:**

- [x] React Hooks (useInterval, useIdle)
- [x] HTTP Caching (ETag)
- [x] Conditional Requests
- [x] Real-Time Synchronization

**Testing:**

- [ ] Unit tests for refresh timer logic
- [ ] Component tests for last-updated indicator
- [ ] E2E test: verify refresh occurs at 60s, data updates
- [ ] Network test: verify ETag caching works

**Estimation:** 5 hours

---

### US-1105: Well Detail Modal from Dashboard

**As a** operator
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
  - State: React Query for well details data

- **Backend Changes:**
  - Endpoint: `GET /wells/:wellId/dashboard-detail` (combines multiple queries)
  - DTO: `WellDashboardDetailDTO` with all required data

**Patterns Used:**

- [x] Component Composition
- [x] Modal Pattern
- [x] Tab Navigation
- [x] Data Aggregation (combining multiple sources)

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
  - Alternative: `react-to-print` for better formatting
  - CSV: Use `papaparse` library

- **Backend Changes:**
  - Endpoint: `POST /dashboard/export` (server-side generation, more reliable)
  - Response: File stream

- **Presentation Layer:**
  - Service: `DashboardExportService` generates PDF/CSV

**Patterns Used:**

- [x] Export Pattern
- [x] Document Generation (PDF)
- [x] Templating Pattern

**Testing:**

- [ ] Unit tests for CSV generation
- [ ] E2E test: click export, verify file downloads
- [ ] Verify PDF content matches dashboard

**Estimation:** 5 hours

---

## Technical Tasks

### Backend

- [ ] Create dashboard KPI query handler and repository
- [ ] Implement alert badge API endpoint
- [ ] Create WebSocket connection handler
- [ ] Set up Redis Pub/Sub for alert broadcasting
- [ ] Implement well location/map endpoint
- [ ] Add ETag support to all dashboard endpoints
- [ ] Create dashboard export service

### Frontend - Web

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

### Database

- [ ] Add indexes for geospatial queries (if using PostGIS)

  ```sql
  CREATE INDEX idx_wells_location ON wells USING GIST(geog);
  ```

- [ ] Add view for dashboard KPIs (aggregates multiple tables)

  ```sql
  CREATE VIEW dashboard_kpis AS
  SELECT 
    t.id as tenant_id,
    SUM(f.oil_volume) as total_oil_24h,
    SUM(f.gas_volume) as total_gas_24h,
    COUNT(DISTINCT w.id) as active_wells_count
  FROM tenants t
  LEFT JOIN organizations o ON o.tenant_id = t.id
  LEFT JOIN wells w ON w.org_id = o.id
  LEFT JOIN field_entries f ON f.well_id = w.id 
    AND f.created_at > NOW() - INTERVAL '24 hours'
  GROUP BY t.id;
  ```

### DevOps

- [ ] Configure WebSocket server in API (Socket.IO or ws)
- [ ] Set up Redis for Pub/Sub messaging
- [ ] Configure CORS for WebSocket connections
- [ ] Add health check for WebSocket connections
- [ ] Monitor WebSocket connection count

---

## Dependencies

### Blockers

- [ ] Sprint 6 must complete (trend data required for modal)
- [ ] Commodity price API configured (for revenue KPI)

### External Dependencies

- [ ] Mapbox API key or Google Maps API key
- [ ] Socket.IO or ws npm package
- [ ] html2canvas, jspdf libraries for export

---

## Definition of Done

### Code Quality

- [ ] TypeScript strict mode (no `any`)
- [ ] Lint passes
- [ ] Type check passes
- [ ] Build succeeds
- [ ] Code follows hexagonal architecture patterns

### Testing

- [ ] Unit tests >80% coverage
- [ ] Integration tests for API endpoints
- [ ] E2E tests for dashboard flows
- [ ] WebSocket tests (mock server)
- [ ] Performance tests: dashboard < 2 seconds load

### Security

- [ ] Authorization: Dashboard data filtered by tenant
- [ ] WebSocket authentication: JWT validation
- [ ] Input validation on all filters
- [ ] HTTPS required for WebSocket (WSS)

### Documentation

- [ ] API endpoints documented (Swagger)
- [ ] Component props documented (JSDoc)
- [ ] WebSocket message format documented
- [ ] Deployment guide for WebSocket setup

### Review

- [ ] PR reviewed and approved
- [ ] CI/CD passing
- [ ] Demo-ready with sample data
- [ ] Load tested with multiple concurrent users

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

- **Planned Story Points:** 40 hours
- **Completed Story Points:** [X]
- **Velocity:** [X points]
- **Code Coverage:** [X%]
- **Dashboard Load Time:** < 2 seconds
- **WebSocket Connection Count:** [X]
- **Alert Notification Latency:** < 3 seconds
- **Map Render Time (100 markers):** < 1 second

---

## Next Sprint Preview

**Sprint 8: Export & Compliance Reporting**

- Implement RRC Form 1 generation
- Automated production accounting (AFE tracking)
- Compliance report scheduling
- COPAS standards compliance

**Estimated Duration:** 1 week (28 hours)
