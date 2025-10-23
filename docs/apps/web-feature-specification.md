# Web Client Dashboard Feature Specification (apps/web)

**Version**: 1.0
**Last Updated**: October 23, 2025
**Tech Stack**: Next.js 15 (App Router), React 19, Tailwind CSS 4, Shadcn UI, React Query, Zustand

---

## Overview

The WellPulse Web Dashboard is the **client-facing application** for oil & gas operators to monitor wells, track production, manage equipment, view predictive maintenance alerts, and generate ESG compliance reports. Accessed via subdomain routing (`acmeoil.wellpulse.io`), each tenant gets a branded dashboard with their data.

**Key Features:**
- Interactive map interface showing all wells with real-time status
- Production data visualization (charts, trends, forecasts)
- Equipment health monitoring with predictive alerts
- ESG compliance dashboards and reporting
- User management for tenant admins
- Mobile-responsive design (works on tablets in the field)

---

## Application Structure

### Pages (Next.js App Router)

```
app/
├── (auth)/
│   ├── login/page.tsx
│   ├── forgot-password/page.tsx
│   ├── reset-password/page.tsx
│   └── layout.tsx (public layout)
│
├── (dashboard)/
│   ├── page.tsx (Dashboard home)
│   ├── layout.tsx (authenticated layout with nav)
│   │
│   ├── wells/
│   │   ├── page.tsx (Wells list + map)
│   │   ├── [id]/page.tsx (Single well details)
│   │   ├── [id]/edit/page.tsx (Edit well)
│   │   └── new/page.tsx (Create well)
│   │
│   ├── production/
│   │   ├── page.tsx (Production data table)
│   │   ├── charts/page.tsx (Production charts)
│   │   ├── import/page.tsx (Bulk import from CSV/Excel)
│   │   ├── [id]/page.tsx (Single production record)
│   │   └── [id]/edit/page.tsx (Edit production record)
│   │
│   ├── equipment/
│   │   ├── page.tsx (Equipment list)
│   │   ├── [id]/page.tsx (Equipment details + maintenance history)
│   │   ├── [id]/edit/page.tsx (Edit equipment)
│   │   ├── new/page.tsx (Create equipment)
│   │   └── maintenance/page.tsx (Maintenance schedule)
│   │
│   ├── emissions/
│   │   ├── page.tsx (Emissions dashboard)
│   │   ├── reports/page.tsx (Compliance reports list)
│   │   ├── reports/[id]/page.tsx (View report)
│   │   └── reports/new/page.tsx (Generate new report)
│   │
│   ├── analytics/
│   │   ├── page.tsx (Analytics dashboard)
│   │   ├── production/page.tsx (Production analytics)
│   │   ├── wells/page.tsx (Well performance)
│   │   └── custom/page.tsx (Custom reports)
│   │
│   ├── alerts/
│   │   ├── page.tsx (Alerts list)
│   │   └── [id]/page.tsx (Alert details)
│   │
│   ├── settings/
│   │   ├── profile/page.tsx (User profile)
│   │   ├── notifications/page.tsx (Notification preferences)
│   │   ├── tenant/page.tsx (Tenant settings - admin only)
│   │   └── users/page.tsx (User management - admin only)
│   │
│   └── help/
│       ├── page.tsx (Help center)
│       └── documentation/page.tsx (User documentation)
│
└── api/ (Next.js API routes - proxy to NestJS API)
    └── proxy/[...path]/route.ts (Optional: BFF pattern)
```

---

## Core Features by Page

### 1. Login & Authentication

**Page**: `/login`

**Features:**
- Email/password login form
- "Remember me" checkbox
- Password visibility toggle
- "Forgot password?" link
- Error handling with user-friendly messages
- Redirect to dashboard after successful login
- MFA code input (if user has MFA enabled)

**Components:**
- `LoginForm` - Email/password inputs with validation
- `MFACodeInput` - 6-digit code input
- `AuthErrorBanner` - Display authentication errors

**State Management:**
- Zustand store for auth state (user, token, loading)
- React Query mutation for login API call
- Persist auth state in httpOnly cookie (managed by API)

---

### 2. Dashboard Home

**Page**: `/`

**Features:**
- High-level KPI cards:
  - Total active wells
  - Today's oil/gas production
  - Equipment requiring maintenance
  - Active alerts/warnings
- Recent activity feed (latest field entries, production updates)
- Quick actions (Add production, Log maintenance, View alerts)
- Production trend chart (last 30 days)
- Equipment health summary (pie chart: Operational/Maintenance/Failed)
- Upcoming maintenance tasks

**Components:**
- `KPICard` - Reusable metric card with icon, value, trend indicator
- `ActivityFeed` - Timeline of recent actions
- `ProductionTrendChart` - Line chart (Recharts or Chart.js)
- `EquipmentHealthPieChart` - Equipment status breakdown
- `MaintenanceCalendar` - Upcoming maintenance tasks

**Data Fetching:**
- React Query: `useQuery` for dashboard summary (`GET /analytics/production-summary`)
- Auto-refresh every 60 seconds (production data updates)

---

### 3. Wells List & Map Interface

**Page**: `/wells`

**Features:**
- **Map View (default)**:
  - Interactive map showing all wells as markers (Mapbox or Google Maps)
  - Marker colors indicate well status (green=active, yellow=maintenance, red=failed)
  - Click marker to see well popup (name, API number, last production, status)
  - Click "View Details" in popup to navigate to well detail page
  - Zoom controls, search location, filter by status
  - Cluster markers when zoomed out (performance optimization)
- **List View (toggle)**:
  - Sortable/filterable table of all wells
  - Columns: Name, API Number, Lease, Status, Last Production, Location, Actions
  - Search by well name or API number
  - Filter by status, lease, date range
  - Pagination (20 wells per page)
  - Click row to view well details
- **Actions**:
  - "Add New Well" button (navigates to `/wells/new`)
  - Bulk actions: Export to CSV, Bulk status update (admin only)

**Components:**
- `WellsMap` - Interactive map with well markers
- `WellMarker` - Custom map marker with status color
- `WellPopup` - Popup card showing well summary
- `WellsTable` - Sortable data table
- `WellsFilters` - Filter panel (status, lease, date range)
- `WellsSearchBar` - Search by name/API number

**Data Fetching:**
- React Query: `useQuery` for wells list (`GET /wells`)
- Infinite scroll for list view (virtual scrolling for 500+ wells)
- Map markers loaded in viewport (performance optimization)

**State Management:**
- Zustand: Map view state (zoom level, center coordinates, filters)
- URL query params for filters (shareable filtered views)

---

### 4. Single Well Details

**Page**: `/wells/[id]`

**Features:**
- **Well Information Card**:
  - Name, API number, lease, operator, status
  - Location (lat/long) with mini map
  - Install date, last production date
  - Edit button (navigates to `/wells/[id]/edit`)
- **Production Tab**:
  - Production history table (last 90 days)
  - Production trend chart (oil/gas/water over time)
  - Export production data button
- **Equipment Tab**:
  - List of equipment assigned to this well
  - Equipment status indicators
  - Click equipment to view equipment details
- **Activity Log Tab**:
  - Audit log of all changes to well
  - Field data entries logged here
  - Filter by date range, activity type
- **Actions**:
  - Add Production Record button
  - Log Field Activity button
  - Edit Well button (admin only)
  - Delete Well button (admin only, soft delete)

**Components:**
- `WellInfoCard` - Well metadata display
- `ProductionHistoryTable` - Production records table
- `ProductionTrendChart` - Line chart
- `EquipmentList` - Assigned equipment
- `ActivityLogTimeline` - Chronological activity feed
- `WellActionMenu` - Dropdown with actions

**Data Fetching:**
- React Query: `useQuery` for well details (`GET /wells/:id`)
- React Query: `useQuery` for production history (`GET /wells/:id/production`)
- React Query: `useQuery` for equipment (`GET /wells/:id/equipment`)
- React Query: `useQuery` for activity log (`GET /wells/:id/activities`)

---

### 5. Production Data Management

**Page**: `/production`

**Features:**
- **Production Data Table**:
  - Columns: Date, Well, Oil (bbl), Gas (mcf), Water (bbl), Runtime (hrs), Actions
  - Sortable by any column
  - Filter by date range, well, anomaly flag
  - Search by well name
  - Pagination (50 records per page)
- **Quick Add Form**:
  - Inline form at top of page for quick entry
  - Fields: Date, Well (dropdown), Oil, Gas, Water, Runtime
  - Submit button adds record and refreshes table
- **Bulk Import**:
  - "Import from CSV/Excel" button → navigates to `/production/import`
  - Drag-and-drop file upload
  - Preview imported data before saving
  - Validation errors highlighted
- **Export**:
  - "Export to CSV" button
  - "Export to Excel" button
  - Date range filter applied to export
- **Anomaly Indicators**:
  - Flag icon for anomalies detected by ML
  - Tooltip shows anomaly reason (e.g., "Oil production 40% below expected")

**Components:**
- `ProductionDataTable` - Sortable/filterable table
- `QuickProductionForm` - Inline add form
- `ProductionFilters` - Date range, well, anomaly filters
- `AnomalyBadge` - Icon with tooltip
- `ProductionImportWizard` - Multi-step import flow

**Data Fetching:**
- React Query: `useQuery` for production data (`GET /production`)
- React Query: `useMutation` for creating production records (`POST /production`)
- React Query: `useMutation` for bulk import (`POST /production/batch`)

---

### 6. Production Charts & Analytics

**Page**: `/production/charts`

**Features:**
- **Time-series Charts**:
  - Oil production over time (line chart)
  - Gas production over time (line chart)
  - Water production over time (line chart)
  - Combined chart (oil/gas/water stacked)
- **Date Range Selector**:
  - Quick filters: Last 7 days, Last 30 days, Last 90 days, Year to date, Custom range
- **Well Comparison**:
  - Select multiple wells to compare on same chart
  - Color-coded lines per well
- **Aggregation Options**:
  - Daily, Weekly, Monthly aggregation
- **Export Chart**:
  - Download as PNG button
  - Export chart data as CSV

**Components:**
- `ProductionLineChart` - Recharts line chart
- `DateRangePicker` - Date range selector
- `WellMultiSelect` - Multi-select dropdown for well comparison
- `ChartExportButton` - Export chart as PNG

**Data Fetching:**
- React Query: `useQuery` for production time-series (`GET /production?aggregation=daily`)
- Query params for date range and wells filter

---

### 7. Equipment Management

**Page**: `/equipment`

**Features:**
- **Equipment List**:
  - Cards or table view (toggle)
  - Equipment type icon, name, status badge
  - Assigned well, maintenance status
  - Click card to view equipment details
- **Filters**:
  - Equipment type (pump jack, compressor, separator, etc.)
  - Status (operational, maintenance, failed)
  - Assigned well
  - Maintenance due (show only equipment requiring maintenance)
- **Predictive Maintenance Alerts**:
  - Badge/banner for equipment with ML predictions of failure
  - Sort by "Risk Score" (highest risk first)
- **Actions**:
  - "Add New Equipment" button
  - "Schedule Maintenance" button

**Components:**
- `EquipmentCard` - Equipment summary card
- `EquipmentTable` - Table view (alternative to cards)
- `EquipmentFilters` - Filter panel
- `PredictiveAlertBadge` - ML prediction indicator
- `EquipmentStatusBadge` - Status indicator (color-coded)

**Data Fetching:**
- React Query: `useQuery` for equipment list (`GET /equipment`)
- React Query: `useQuery` for maintenance predictions (`GET /equipment/:id/predictions`)

---

### 8. Equipment Details & Maintenance

**Page**: `/equipment/[id]`

**Features:**
- **Equipment Information Card**:
  - Name, type, serial number, manufacturer
  - Install date, assigned well
  - Current status
  - Edit button
- **Maintenance History**:
  - Timeline of past maintenance activities
  - Date, type (preventive/corrective), technician, notes, cost
  - Add Maintenance Record button
- **Predictive Maintenance**:
  - ML prediction card (if available)
  - Risk score (0-100, color-coded)
  - Recommended action (e.g., "Replace bearing within 7 days")
  - Confidence level
  - Predicted failure date
- **Sensor Data (if available)**:
  - Real-time sensor readings (vibration, temperature, pressure)
  - Sensor trend charts (last 24 hours)
- **Actions**:
  - Log Maintenance button
  - Replace Equipment button
  - Decommission Equipment button (admin only)

**Components:**
- `EquipmentInfoCard` - Equipment metadata
- `MaintenanceHistoryTimeline` - Past maintenance records
- `PredictiveMaintenanceCard` - ML prediction display
- `SensorDataPanel` - Real-time sensor readings (if available)
- `MaintenanceForm` - Log maintenance activity

**Data Fetching:**
- React Query: `useQuery` for equipment details (`GET /equipment/:id`)
- React Query: `useQuery` for maintenance history (`GET /equipment/:id/maintenance-history`)
- React Query: `useQuery` for ML predictions (`GET /equipment/:id/predictions`)
- React Query: `useMutation` for logging maintenance (`POST /equipment/:id/maintenance`)

---

### 9. ESG Compliance Dashboard

**Page**: `/emissions`

**Features:**
- **KPI Cards**:
  - Total CO2 emissions (current period)
  - Total CH4 emissions (current period)
  - VOC emissions (current period)
  - Emissions intensity (CO2 per barrel)
- **Regulatory Threshold Indicators**:
  - Progress bars showing % of regulatory limit
  - Color-coded: Green (<50%), Yellow (50-80%), Red (>80%)
  - Alert banner if approaching limits
- **Emissions Trend Chart**:
  - Time-series chart (CO2, CH4, VOC over time)
  - Date range selector
- **Emissions by Well**:
  - Bar chart showing emissions per well
  - Identify high-emission wells
- **Compliance Reports**:
  - List of generated reports (PDF)
  - Download report button
  - Generate new report button (navigates to `/emissions/reports/new`)
- **Actions**:
  - Generate Compliance Report button
  - Export Emissions Data button (CSV)
  - Configure Thresholds button (admin only)

**Components:**
- `EmissionsKPICard` - Metric card with trend
- `RegulatoryThresholdBar` - Progress bar with color coding
- `EmissionsTrendChart` - Line chart
- `EmissionsByWellChart` - Bar chart
- `ComplianceReportsList` - Table of reports

**Data Fetching:**
- React Query: `useQuery` for emissions summary (`GET /emissions/summary`)
- React Query: `useQuery` for compliance reports (`GET /emissions/reports`)
- React Query: `useMutation` for generating report (`POST /emissions/reports`)

---

### 10. Generate Compliance Report

**Page**: `/emissions/reports/new`

**Features:**
- **Report Configuration Form**:
  - Report type dropdown (EPA, State, Custom)
  - Date range picker (start date, end date)
  - Wells to include (multi-select or "All wells")
  - Report format (PDF, CSV)
  - Optional: Include appendices (sensor data, calculations)
- **Preview Button**:
  - Generate preview of report (shows summary before final generation)
- **Generate Button**:
  - Creates PDF report (background job)
  - Shows progress indicator
  - Redirects to report view page when complete
- **Template Selection**:
  - EPA template
  - State-specific templates (Texas RRC, New Mexico OCD)
  - Custom template

**Components:**
- `ReportConfigForm` - Report configuration inputs
- `WellMultiSelect` - Select wells to include
- `ReportPreview` - Preview report summary
- `ReportGenerationProgress` - Progress indicator

**Data Fetching:**
- React Query: `useMutation` for generating report (`POST /emissions/reports`)
- Polling or WebSocket for generation progress

---

### 11. Analytics Dashboard

**Page**: `/analytics`

**Features:**
- **Customizable Dashboard**:
  - Drag-and-drop widget layout
  - Save custom layouts per user
- **Available Widgets**:
  - Production summary (oil/gas/water totals)
  - Well performance leaderboard (top/bottom performers)
  - Equipment health pie chart
  - Emissions summary
  - Revenue estimator (production * commodity prices)
  - Recent alerts
  - Maintenance calendar
- **Time Period Selector**:
  - Today, Week, Month, Quarter, Year, Custom
- **Export Dashboard**:
  - Export entire dashboard as PDF report

**Components:**
- `DraggableDashboard` - Drag-and-drop layout (react-grid-layout)
- `WidgetLibrary` - Available widgets to add
- `ProductionSummaryWidget` - Production KPIs
- `WellPerformanceWidget` - Leaderboard
- `EquipmentHealthWidget` - Pie chart
- `EmissionsSummaryWidget` - Emissions KPIs

**State Management:**
- Zustand: Dashboard layout state (widget positions, sizes)
- LocalStorage: Persist layout per user

**Data Fetching:**
- React Query: `useQuery` for each widget's data
- Stale-while-revalidate caching strategy

---

### 12. Alerts & Notifications

**Page**: `/alerts`

**Features:**
- **Alerts List**:
  - Sortable by severity, date, type
  - Filter by severity (info, warning, critical), status (new, acknowledged, resolved)
  - Badge count for unread alerts
- **Alert Types**:
  - Equipment failure prediction
  - Emissions threshold warning
  - Production anomaly detected
  - Maintenance overdue
  - Field data sync conflict
- **Alert Details**:
  - Click alert to expand details
  - Severity indicator (icon + color)
  - Description and recommended action
  - Related resource (well, equipment) with link
  - Acknowledge button (marks alert as read)
  - Dismiss button (removes from list)
- **Notification Bell**:
  - Header icon with badge count
  - Dropdown showing recent alerts (last 5)
  - "View All Alerts" link

**Components:**
- `AlertsList` - Sortable/filterable alerts table
- `AlertCard` - Alert details card
- `AlertSeverityBadge` - Severity indicator
- `NotificationBell` - Header bell icon with dropdown
- `AlertActions` - Acknowledge/dismiss buttons

**Data Fetching:**
- React Query: `useQuery` for alerts (`GET /alerts`)
- React Query: `useMutation` for acknowledging alerts (`POST /alerts/:id/acknowledge`)
- Real-time updates via polling (every 30 seconds)

---

### 13. User Settings

**Page**: `/settings/profile`

**Features:**
- **Profile Information**:
  - Name, email (read-only), phone number
  - Profile photo upload
  - Time zone selection
  - Language preference (English, Spanish - future)
- **Change Password**:
  - Current password, new password, confirm password
  - Password strength indicator
- **MFA Configuration**:
  - Enable/disable MFA toggle
  - QR code for TOTP setup (Google Authenticator, Authy)
  - Backup codes generation
- **Save Button**:
  - Updates profile information
  - Success/error toast notifications

**Components:**
- `ProfileForm` - Profile information inputs
- `ChangePasswordForm` - Password change inputs
- `MFASetup` - MFA configuration panel
- `ProfilePhotoUpload` - Image upload with preview

**Data Fetching:**
- React Query: `useQuery` for current user (`GET /auth/me`)
- React Query: `useMutation` for updating profile (`PATCH /users/:id`)

---

### 14. Notification Preferences

**Page**: `/settings/notifications`

**Features:**
- **Email Notifications**:
  - Toggle for each notification type:
    - Equipment failure predictions
    - Emissions threshold warnings
    - Production anomalies
    - Maintenance reminders
    - Weekly production summary
  - Frequency options (immediate, daily digest, weekly digest)
- **SMS Notifications** (optional, if Twilio enabled):
  - Toggle SMS for critical alerts only
  - Phone number input
- **In-App Notifications**:
  - Toggle for desktop notifications (browser permission required)
  - Sound toggle
- **Save Button**:
  - Updates notification preferences
  - Success toast

**Components:**
- `NotificationPreferencesForm` - Toggle switches for each type
- `NotificationFrequencySelect` - Dropdown (immediate, daily, weekly)
- `SMSSetup` - Phone number input for SMS

**Data Fetching:**
- React Query: `useQuery` for current preferences (`GET /notification-preferences`)
- React Query: `useMutation` for updating preferences (`PATCH /notification-preferences`)

---

### 15. Tenant Settings (Admin Only)

**Page**: `/settings/tenant`

**Features:**
- **Company Information**:
  - Company name
  - Company logo upload (displayed in header)
  - Industry/sector
- **Regional Settings**:
  - Default time zone
  - Default unit system (imperial/metric)
  - Default currency (USD)
- **Feature Flags** (admin only):
  - Enable/disable ML predictions
  - Enable/disable ESG compliance module
  - Enable/disable SMS notifications
- **Integrations**:
  - List of connected integrations (SCADA, weather data, etc.)
  - Connect/disconnect buttons
- **Save Button**:
  - Updates tenant settings
  - Success toast

**Components:**
- `TenantSettingsForm` - Tenant configuration inputs
- `CompanyLogoUpload` - Logo upload with preview
- `FeatureFlagsPanel` - Toggle switches for features
- `IntegrationsList` - Connected integrations

**Data Fetching:**
- React Query: `useQuery` for tenant settings (`GET /tenant/settings`)
- React Query: `useMutation` for updating settings (`PATCH /tenant/settings`)

---

### 16. User Management (Admin Only)

**Page**: `/settings/users`

**Features:**
- **Users List**:
  - Table: Name, Email, Role, Status, Last Login, Actions
  - Search by name or email
  - Filter by role, status
- **Add User Button**:
  - Opens modal with user creation form
  - Fields: Name, email, role (dropdown)
  - Sends invitation email with signup link
- **User Actions**:
  - Edit role (dropdown in table row)
  - Reset password (sends reset email)
  - Deactivate user (soft delete)
  - Reactivate user
- **Roles**:
  - Admin, Manager, Field Operator, Viewer

**Components:**
- `UsersTable` - Users list with actions
- `AddUserModal` - User creation modal
- `EditUserRoleDropdown` - Inline role editor
- `UserActionsMenu` - Dropdown menu for actions

**Data Fetching:**
- React Query: `useQuery` for users list (`GET /users`)
- React Query: `useMutation` for creating user (`POST /users`)
- React Query: `useMutation` for updating role (`PATCH /users/:id/role`)
- React Query: `useMutation` for deactivating user (`DELETE /users/:id`)

---

## Shared Components Library

### Navigation
- `AppHeader` - Top navigation bar with logo, user menu, notifications bell
- `Sidebar` - Left sidebar navigation menu
- `Breadcrumbs` - Page breadcrumbs for navigation context

### Data Display
- `DataTable` - Reusable sortable/filterable table (TanStack Table)
- `KPICard` - Metric card with icon, value, trend indicator
- `StatusBadge` - Color-coded status indicator
- `Chart` - Wrapper for Recharts (line, bar, pie charts)
- `EmptyState` - Placeholder for empty lists
- `Skeleton` - Loading skeleton for data fetching

### Forms
- `Input` - Text input with validation
- `Select` - Dropdown select
- `MultiSelect` - Multi-select dropdown
- `DatePicker` - Date selector
- `DateRangePicker` - Date range selector
- `FileUpload` - Drag-and-drop file upload
- `FormField` - Wrapper with label, error message

### Feedback
- `Toast` - Success/error toast notifications (Sonner)
- `AlertDialog` - Confirmation dialog
- `Modal` - Reusable modal wrapper
- `LoadingSpinner` - Loading indicator

### Layout
- `Container` - Max-width container
- `Card` - Content card wrapper
- `Tabs` - Tabbed interface
- `Accordion` - Collapsible sections

---

## State Management

### React Query (Data Fetching)
- All API calls via React Query
- Caching strategy: Stale-while-revalidate
- Cache time: 5 minutes (configurable per query)
- Automatic retry on failure (3 attempts, exponential backoff)
- Optimistic updates for mutations
- Prefetching for anticipated navigation (e.g., prefetch well details on hover)

### Zustand (Client State)
- Auth state (user, token, loading, logout)
- Map view state (zoom, center, filters)
- Dashboard layout state (widget positions)
- Theme preference (light/dark mode)
- Notification preferences (cached)

### URL Query Params (Shareable State)
- Filters (e.g., `/wells?status=active&lease=Smith-Ranch`)
- Pagination (e.g., `/production?page=2&limit=50`)
- Sorting (e.g., `/equipment?sort=-installDate`)
- Date ranges (e.g., `/analytics?start=2025-01-01&end=2025-12-31`)

---

## Design System

### Theming
- Light mode (default)
- Dark mode (user preference)
- High contrast mode (accessibility)

### Colors
- Primary: Blue (#0066CC) - Actions, links
- Success: Green (#00AA44) - Operational status, positive metrics
- Warning: Yellow (#FFAA00) - Warnings, maintenance due
- Error: Red (#DD2244) - Critical alerts, failures
- Neutral: Grays (#F5F5F5 to #111111) - Text, backgrounds

### Typography
- Font family: Inter (Google Fonts)
- Headings: Font weights 600-700
- Body: Font weight 400
- Small text: Font weight 400, smaller size

### Spacing
- Tailwind CSS spacing scale (4px increments)
- Consistent padding/margin throughout

### Responsive Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

---

## Performance Optimizations

### Code Splitting
- Route-based code splitting (Next.js automatic)
- Component lazy loading for heavy components (charts, maps)

### Image Optimization
- Next.js Image component for automatic optimization
- WebP format with fallbacks
- Lazy loading for images below the fold

### Caching
- React Query caching for API responses
- Service Worker for offline support (future)
- CDN caching for static assets (via Azure Front Door)

### Virtual Scrolling
- Virtual scrolling for large lists (wells, production records)
- TanStack Virtual or react-window

### Map Performance
- Marker clustering for 100+ wells
- Load markers in viewport only
- Debounced map move events

---

## Accessibility (WCAG 2.1 AA)

- Semantic HTML elements
- ARIA labels for interactive elements
- Keyboard navigation support (focus indicators, tab order)
- Screen reader friendly (alt text, labels)
- Color contrast ratios ≥ 4.5:1
- Focus management (modals, dropdowns)
- Skip links for navigation

---

## Testing Strategy

- **Unit tests**: Component logic (Vitest + React Testing Library)
- **Integration tests**: User flows (Playwright)
- **E2E tests**: Critical paths (login, production entry, alerts)
- **Visual regression tests**: Storybook + Chromatic (future)
- **Accessibility tests**: axe-core integration

---

## Deployment

### Environment Variables
- `NEXT_PUBLIC_API_URL` - API base URL
- `NEXT_PUBLIC_MAPBOX_TOKEN` - Mapbox access token (if using Mapbox)
- `NEXT_PUBLIC_TENANT_SLUG` - Tenant subdomain (for multi-tenant routing)

### Build & Deploy
- Next.js production build: `pnpm build`
- Static asset optimization enabled
- Deploy to Azure Container Apps
- CDN caching via Azure Front Door

---

## Related Documentation

- [API Feature Specification](./api-feature-specification.md)
- [Admin Portal Specification](./admin-portal-specification.md)
- [Design System Guide](../guides/design-system.md) (future)

---

**Next Steps:**
1. Review UI/UX with stakeholders
2. Create wireframes/mockups (Figma)
3. Set up Next.js project structure
4. Build Shadcn UI component library
5. Implement authentication pages (highest priority)
