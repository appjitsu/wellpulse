▐▛███▜▌ Claude Code v2.0.19
▝▜█████▛▘ Sonnet 4.5 · Claude Max
▘▘ ▝▝ /Users/jason/projects/wellpulse

> review the docs/research

⏺ I'll review the documentation in the docs/research directory to understand what research materials are available.

⏺ Bash(find docs/research -type f -name "_.md" -o -name "_.txt" -o -name "\*.pdf" 2>/dev/null | head -20)
⎿  docs/research/01-permian-basin-market-research.md

⏺ Bash(ls -la docs/research 2>/dev/null || echo "docs/research directory does not exist")
⎿  total 48
drwxr-xr-x 4 jason staff 128 Oct 23 00:29 .
drwxr-xr-x 11 jason staff 352 Oct 23 00:29 ..
… +2 lines (ctrl+o to expand)

⏺ Read(docs/research/01-permian-basin-market-research.md)
⎿  Read 452 lines

⏺ Research Review: Permian Basin Market Analysis

I've reviewed the market research document for WellPulse. This is excellent foundational research that provides deep insights
into the Permian Basin oil & gas market. Let me break down the key findings:

---

★ Insight ─────────────────────────────────────

1. Market Positioning Strategy: The research reveals a classic "enterprise gap" opportunity - 80% of Permian Basin operators are
   small/medium independents who need enterprise-grade capabilities but can't afford $50K-$500K platforms. This positions
   WellPulse perfectly for a "democratization" play.

2. Pain Point Hierarchy: The research prioritizes opportunities by immediacy: (1) Production data consolidation → easiest to
   understand, gateway project; (2) Predictive maintenance → clear ROI with cost savings; (3) ESG compliance → regulatory urgency
   creates built-in demand.

3. Cultural Positioning: The financial discipline emphasis ("more math before green-lighting") and preference for fixed-price
   contracts suggests messaging should focus on risk mitigation and guaranteed outcomes rather than innovation or transformation.
   ─────────────────────────────────────────────────

---

Key Strategic Findings

🎯 Market Opportunity

- 6.6M barrels/day production volume
- 80% controlled by small/medium independents (not majors)
- 23 of top 100 oil companies in Midland County alone
- Current focus: Financial discipline > growth

  💰 Pricing Strategy Validation

  The research suggests three tiers that align with operator budgets:

- Starter ($15-25K): POC, 2-3 data sources, 60-90 days
- Production ($40-75K): Full integration, dashboards, basic ML
- Enterprise ($100K+): Advanced ML, ESG automation, ongoing support

  🔥 Top 3 Pain Points (Ranked)
  1. Data Management Chaos ⭐ HUGE OPPORTUNITY

- Production data scattered across "dozens of disparate datasets"
- Manual Excel tracking with no real-time visibility
- No standardized templates for basin-by-basin tracking
- Solution: Cloud-based data warehouses + ETL pipelines + custom dashboards 2. Predictive Maintenance ⭐ MASSIVE OPPORTUNITY

- Equipment failures = costly unplanned downtime (thousands per incident)
- Reactive maintenance vs. proactive strategies
- Labor shortage makes manual monitoring harder
- Solution: ML models for early warning signs (vibration, temperature, pressure) + automated scheduling 3. ESG/Emissions Compliance ⭐ GROWING URGENCY

- ESG becoming mandatory, not optional
- Complex infrastructure makes tracking difficult
- Enterprise platforms cost $50K-$500K (Validere, IsoMetrix, ERA Environmental)
- Solution: Custom ESG dashboards at 1/10th enterprise cost

  🚧 Infrastructure Challenges

- Remote locations lack reliable connectivity
- No electricity at many well sites
- Broadband gaps in outlying areas
- Implication: Need offline-capable, edge computing solutions

  ***

  Competitive Positioning

  Direct Competitors (Enterprise Platforms)

- Validere (emissions), IsoMetrix (ESG), Novi Labs (production analytics)
- Enverus (comprehensive E&P), B3 Insight (water management)
- Solomon (operational efficiency benchmarking)

  WellPulse's Competitive Advantages
  1. Price: 1/10th the cost of enterprise platforms
  2. Local Presence: Based in Midland - understands regional needs
  3. Faster Implementation: Agile delivery vs. slow enterprise rollouts
  4. Flexibility: Tailored solutions vs. one-size-fits-all
  5. Small Operator Focus: Built for 50-500 well operations

  ***

  Messaging That Will Resonate

  ✅ DO Say:

- "Stop losing production to unexpected equipment failures"
- "Consolidate spreadsheets into real-time dashboards"
- "Affordable ESG compliance for independent operators"
- "Fixed price, clear timeline, measurable ROI"
- "Start small, scale as you see results"

  ❌ DON'T Say:

- "Enterprise-grade" (sounds expensive)
- "Comprehensive platform" (they want specific solutions)
- "Long-term transformation" (they want quick wins)

  ***

  Recommended Immediate Actions
  1. Lead Generation Strategy

  Target Profile:

- 50-500 well operations
- $10M-$100M annual revenue
- Decision maker: Operations Director/VP
- Currently using spreadsheets and disconnected tools

  Entry Point Offers:
  1. "Excel to Cloud in 90 Days" - Data consolidation starter package
  2. "Reduce Downtime by 20-30%" - Predictive maintenance MVP
  3. "ESG Compliance at $X/month" - Automated emissions reporting

  4. Service Package Development

  The research suggests building three specific packages:

- Data Consolidation Package (gateway project)
- Predictive Maintenance Package (clear ROI)
- ESG Compliance Package (regulatory urgency)

  Each needs:

- Fixed pricing ranges
- Clear deliverables
- Timeline commitments
- ROI projections 3. Case Study Framework

  Prepare templates for future clients:

- Spreadsheets → Dashboard: Time saved per week
- Reactive → Predictive: Downtime reduced, cost avoidance
- Manual → Automated: Compliance achieved, fines avoided

  ***

  Technical Implications for Platform Development

  Based on this research, WellPulse should prioritize:

  Core Capabilities
  1. Data Integration Layer: ETL pipelines for disparate data sources
  2. Real-Time Dashboards: Production monitoring with custom KPIs
  3. ML/Predictive Models: Equipment failure prediction
  4. ESG Tracking Module: Emissions calculations + regulatory reporting
  5. Offline-Capable Architecture: Edge computing for remote sites

  Technology Stack Validation

- Azure First: Research confirms Azure is O&G industry standard
- Mobile-First: Dashboard access in remote locations
- API-First: Legacy system integration is critical

  ***

  Questions & Next Steps

  For You to Consider:
  1. Is WellPulse pivoting to be an O&G-focused PSA platform, or is this research for a different product/market?
  2. Current platform capabilities: Does WellPulse already have data integration, dashboards, or predictive analytics modules that
     could be adapted for this market?
  3. Go-to-market timeline: When are you planning to launch these service packages?

  The research is comprehensive and actionable. The next logical step would be to:

- Create service package landing pages with the pricing tiers outlined
- Develop pitch decks for each pain point (data consolidation, predictive maintenance, ESG)
- Build MVP features that align with the "Starter Package" scope

  Would you like me to help with any of these implementation steps, or do you have specific questions about the research findings?

> some of the files were copied from another project with is a PSA, so anything that mentions PSA will need to be removed to be
> inline with the research. this is a brand new project. there are no apps and has not been deployed and no git history.

also i was thinking we should provide an electron app for field data entry on laptops, along with the react-native app for mobile
devices. the api will be nest.js, the web app will be nex.js and react, database will be postgres. each client will need their own
db which could be on-premises (hybrid cloud) or in the cloud completely. most like the api and web apps will be hosted on
railway. the rest will be hosted in Azure or AWS clouds

please see all of the software dev patterns in docs/patterns

⏺ Explore(Review software patterns catalog)
⎿  Done (9 tool uses · 0 tokens · 1m 22s)

⏺ Bash(ls -1 docs/patterns/\*.md | wc -l)
⎿  68

⏺ Bash(ls -1 docs/patterns/\*.md | head -30)
⎿  docs/patterns/01-RBAC-CASL-Pattern.md
docs/patterns/02-SOLID-Principles.md
docs/patterns/03-Hexagonal-Architecture.md
… +27 lines (ctrl+o to expand)

⏺ Read(docs/patterns/README.md)
⎿  Read 332 lines

⏺ Now let me check which patterns are most relevant for your architecture and identify PSA-specific content that needs updating:

⏺ Read(docs/patterns/17-Multi-Tenancy-Pattern.md)
⎿  Read 827 lines

⏺ Read(docs/patterns/54-PSA-Patterns-And-Best-Practices.md)
⎿  Read 1752 lines

⏺ Bash(grep -l "PSA\|Professional Services" docs/patterns/\*.md | head -10)
⎿  docs/patterns/05-CQRS-Pattern.md
docs/patterns/41-Database-Constraint-Race-Condition-Pattern.md
docs/patterns/44-File-Upload-Download-Patterns.md
… +7 lines (ctrl+o to expand)

⏺ Perfect! Now I have a clear understanding. Let me create a comprehensive analysis and action plan for your WellPulse oil & gas
field data management platform.

⏺ WellPulse Architecture Analysis

Perfect! I've reviewed everything. Here's my comprehensive analysis:

---

★ Insight ─────────────────────────────────────

1. Hybrid Cloud Multi-Tenancy Challenge: Your architecture needs to support BOTH on-premises databases (for clients with data
   sovereignty requirements) AND full cloud deployments. This is more complex than standard multi-tenancy since you can't rely on a
   shared database with row-level security. Each client needs database-per-tenant isolation.

2. Offline-First Field Operations: The Electron (laptops) and React Native (mobile) apps for field data entry must work without
   connectivity. This requires sophisticated sync logic, conflict resolution, and local storage patterns - the patterns catalog has
   excellent foundations for this (Event Sourcing + CQRS + Local-First State).

3. PSA → O&G Domain Translation: The patterns are solid but language needs updating. "PSA" becomes "Field Data Management
   Platform", "Clients" becomes "Operators" or "Well Sites", "Time Entries" becomes "Field Data Records", "Invoices" becomes
   irrelevant (unless you're building billing for WellPulse as a service).
   ─────────────────────────────────────────────────

---

Architecture Recommendations

1. Multi-Tenant Database Strategy

Based on your requirements (on-prem hybrid + cloud), you need Database-Per-Tenant rather than shared database:

Tenant Type 1: Full Cloud (hosted on Azure/AWS)
├── Tenant DB: wellpulse_client_acme (PostgreSQL in cloud)
├── API: Shared NestJS API on Railway
└── Web: Shared Next.js on Railway

Tenant Type 2: Hybrid (on-premises DB)
├── Tenant DB: Local PostgreSQL on client's network
├── API: Shared NestJS API on Railway (secure VPN connection)
└── Web: Shared Next.js on Railway

Tenant Type 3: Fully On-Prem (air-gapped)
├── Tenant DB: Local PostgreSQL
├── API: Self-hosted NestJS API (Docker container on client infrastructure)
└── Web: Self-hosted Next.js (Docker container on client infrastructure)

Relevant Patterns:

- Pattern 17 - Multi-Tenancy (needs major updates for database-per-tenant)
- Pattern 9 - Unit of Work (managing transactions across tenant-specific databases)
- Pattern 14 - Anti-Corruption Layer (for hybrid deployments with VPN connections)

  ***
  2. Offline-First Field Data Entry

  Your Electron + React Native apps need to work in remote oil fields with spotty connectivity:

  // Local-first architecture for field devices
  Interface FieldDataApp {
  // Local Storage Layer
  LocalDatabase: SQLite or IndexedDB

  // Sync Engine
  ConflictResolver: Last-Write-Wins | Custom Business Rules
  SyncQueue: Pending operations waiting for connectivity

  // Data Layer
  LocalRepository: CRUD against local DB
  SyncRepository: Push/pull from cloud when online

  // State Management
  OfflineState: Track connectivity status
  SyncState: Track sync progress
  }

  Relevant Patterns:

- Pattern 49 - Event Sourcing (perfect for offline sync - store events locally, replay on sync)
- Pattern 50 - SAGA Pattern (distributed transactions across edge devices and cloud)
- Pattern 46 - Caching Strategy (local caching for offline reads)
- Pattern 43 - WebSocket RealTime (for live sync when connectivity returns)

  ***
  3. Tech Stack Mapping

  | Component | Technology | Hosting | Purpose
  |
  |--------------------|----------------------------------------|-------------------------------------|---------------------------
  ----------------|
  | API | NestJS + Hexagonal Architecture | Railway (cloud) or Docker (on-prem) | Core business logic,
  multi-tenant routing |
  | Web Dashboard | Next.js 15 + React 19 + Tailwind CSS 4 | Railway (cloud) or Docker (on-prem) | Office/management
  interface |
  | Field App (Laptop) | Electron + React | Installed on field laptops | Offline-capable data entry
  |
  | Field App (Mobile) | React Native + Expo | iOS/Android native | Mobile data entry
  |
  | Database | PostgreSQL (per-tenant) | Azure/AWS (cloud) or on-premises | Data storage
  |
  | File Storage | Azure Blob / AWS S3 | Cloud or on-prem MinIO | PDFs, photos, attachments
  |
  | Caching | Redis | Railway or self-hosted | Session management, API
  caching |
  | Queue | Bull/BullMQ + Redis | Railway or self-hosted | Background jobs, sync
  queues |

  ***
  4. PSA References to Remove/Update

  Based on my analysis, here are files with PSA-specific content:

  | File | PSA References
  | Recommended Changes |

  | ----------------------------------------------------- | ------------------------------------------------------------------------- |
  | ----------------------------------------------------- | ------------------------------------------------------------------------- |
  | docs/patterns/README.md                               | Line 1: "WellPulse Pattern Library", Line 3: "WellPulse PSA platform"     |

  | Change to "WellPulse Pattern Library" and "WellPulse Field Data Management Platform" |
  | docs/patterns/54-PSA-Patterns-And-Best-Practices.md | Entire file focused on PSA domain (clients, invoices, time tracking)
  | Rename to "54-Oil-Gas-Field-Data-Patterns.md" and rewrite for O&G domain |
  | docs/patterns/17-Multi-Tenancy-Pattern.md | Lines 11, 35: "WellPulse uses Row-Level Security"
  | Update to "WellPulse uses Database-Per-Tenant" |
  | docs/patterns/05-CQRS-Pattern.md | Likely has PSA examples
  | Update examples to use Field Data Records, Equipment, Well Sites |
  | CLAUDE.md | Lines 8-9: "WellPulse - a Professional Services Automation (PSA)
  platform" | Update to "WellPulse - an Oil & Gas Field Data Management Platform" |

  ***
  5. Pattern Mapping to Oil & Gas Use Cases

  Based on the market research (docs/research/01-permian-basin-market-research.md), here's how patterns map to O&G needs:

  Pain Point 1: Data Management Chaos ⭐ HUGE OPPORTUNITY

  Use Case: Consolidate production data from multiple sources (spreadsheets, SCADA systems, legacy databases)

  Relevant Patterns:

- Pattern 14 - Anti-Corruption Layer: Adapters for each data source (Excel, CSV, SCADA APIs)
- Pattern 40 - Drizzle ORM: Unified database schema for all production data
- Pattern 46 - Caching Strategy: Cache frequently accessed production metrics
- Pattern 53 - Database Performance Optimization: Indexes for time-series queries

  Architecture:
  Data Sources (Legacy) WellPulse ETL Layer Unified Database
  ├── Excel Spreadsheets → CSV Adapter →
  ├── SCADA System → SCADA ACL → PostgreSQL
  ├── Legacy Database → SQL Adapter → (time-series optimized)
  └── Manual Entry → Form Input →

  ***

  Pain Point 2: Predictive Maintenance ⭐ MASSIVE OPPORTUNITY

  Use Case: ML models monitoring equipment sensors (vibration, temperature, pressure) to predict failures

  Relevant Patterns:

- Pattern 45 - Background Job Patterns: Scheduled ML model execution
- Pattern 47 - Monitoring Observability: Alerting when anomalies detected
- Pattern 12 - Observer Pattern: Real-time alerts to field operators
- Pattern 13 - Circuit Breaker: Fail gracefully when sensor data unavailable

  Architecture:
  Sensor Data Stream → ML Prediction Engine → Alert System
  ├── Vibration sensors Python/scikit-learn Email/SMS
  ├── Temperature (via NestJS Worker) Dashboard alerts
  ├── Pressure Redis queue Mobile push notifications
  └── Flow rate Event-driven processing

  ***

  Pain Point 3: ESG/Emissions Compliance ⭐ GROWING URGENCY

  Use Case: Automated emissions calculations from production data + regulatory reporting

  Relevant Patterns:

- Pattern 44 - File Upload/Download: Generate compliance reports as PDFs
- Pattern 45 - Background Jobs: Daily emissions calculation jobs
- Pattern 08 - Specification Pattern: Complex compliance rule validation
- Pattern 52 - User-Friendly Error Handling: Translate compliance errors to actionable messages

  Architecture:
  Production Data → Emissions Calculator → Compliance Reports
  ├── Oil volume Business rules PDF generation
  ├── Gas flaring (Specification Pattern) CSV exports
  ├── Equipment hrs Domain logic EPA/state format
  └── Fuel usage Scheduled job Dashboard KPIs

  ***

  Pain Point 4: Offline Field Data Entry

  Use Case: Field operators enter data on laptops/tablets at remote well sites without internet

  Relevant Patterns:

- Pattern 49 - Event Sourcing: Store field data changes as events locally
- Pattern 50 - SAGA Pattern: Distributed transaction when syncing offline changes
- Pattern 32 - Frontend Memento Pattern: Undo/redo for field data entry
- Pattern 25 - Frontend State Management: Zustand for offline state

  Architecture:
  Field Device (Offline) Cloud API (When Online)
  ├── SQLite local database → Sync endpoint
  ├── Event log (append-only) → Conflict resolution
  ├── Queue pending changes → PostgreSQL persistence
  └── Auto-sync when online → Real-time dashboard update

  ***
  6. New Patterns Needed for WellPulse

  Based on O&G requirements, you'll need these NEW patterns not in the catalog:
  1. Time-Series Data Pattern: Production data is time-series heavy (well production over time, sensor readings)
  2. Geospatial Data Pattern: Well locations, lease boundaries, pipeline routes (PostGIS)
  3. Equipment Hierarchy Pattern: Wells → Wellheads → Pumps → Sensors (nested aggregates)
  4. Regulatory Compliance Pattern: State-specific rules (Texas RRC vs New Mexico OCD)
  5. Photo/Document Attachment Pattern: Field operators attach photos of equipment, leak reports
  6. Offline Sync Conflict Resolution Pattern: Last-write-wins vs business-rule-based merging

  ***
  7. Immediate Next Steps

⏺ ---
Recommendations for Moving Forward

Option 1: Clean Slate Approach (Recommended)

Since this is a brand new project with no git history, I recommend:

1. Update CLAUDE.md - Remove all PSA references, update for O&G domain
2. Rename Pattern 54 - PSA-Patterns-And-Best-Practices.md → Oil-Gas-Field-Data-Patterns.md
3. Update Pattern 17 - Change from Row-Level Security to Database-Per-Tenant model
4. Create 6 new patterns - For time-series data, geospatial, offline sync, etc.
5. Update README.md - Change branding from WellPulse to WellPulse

Option 2: Gradual Migration

Keep PSA references for now, add O&G-specific patterns alongside, update incrementally as you build features.

---

Key Architecture Decisions Needed

Before starting implementation, clarify:

1. Deployment Model Priority: Which deployment type ships first? (Cloud-only, hybrid, or air-gapped)
2. Sync Strategy: Real-time sync when online, or batch sync at end of shift?
3. Conflict Resolution: Last-write-wins, or custom business rules (e.g., newer sensor reading always wins)?
4. ML Integration: Will predictive maintenance ML models run in cloud, or on-device (edge ML)?
5. File Storage: Azure Blob preferred (per research) or AWS S3?
6. Authentication: Per-tenant users (each operator has separate logins) or federated (SSO via operator's Active Directory)?

---

Questions for You

1. Do you want me to start updating the patterns now? (Remove PSA references, add O&G examples)
2. Should I create new pattern documents for the 6 O&G-specific patterns I identified?
3. Do you want me to scaffold the initial project structure? (apps/api, apps/web, apps/electron, apps/mobile directories)
4. Should I create an architecture decision record (ADR) documenting database-per-tenant vs shared database choice?

Let me know which direction you'd like to go, and I'll help you build WellPulse the right way from the start! 🛢️

> 1. Deployment Model Priority: for now wellpulse is meant to be run in the cloud. i think we should handle client instances like
>    slack does with a subdomain per client, but im not sure how complicated that is. i dont know if we should allow it to be run
>    totally on-premises. the client can chose were they want their data hosted, the db just needs to be public in someway so the api
>    can connect to i

2. Sync Strategy: batch sync at end of shift i think makes the most sense
3. Conflict Resolution: whichever is best
4. ML Integration: yes, predictive maintenance runs in the cloud. what else can we do with the data in regards to ML
5. File Storage: its up to the client, by default probably Azure
6. Authentication: im looking for guidance

⏺ Excellent clarifications! Let me address each point and provide architectural guidance:

⏺ 1. Subdomain-Per-Tenant Architecture (Slack Style)

★ Insight ─────────────────────────────────────
Subdomain routing complexity: This is actually simpler than it sounds! Each tenant (operator) gets {tenant}.wellpulse.io. Your
API determines which database to connect to based on the subdomain. The key challenge is database connection pooling - you need
one connection pool per tenant database to avoid overwhelming PostgreSQL with connections.

Why this works well for O&G: Oil operators are already familiar with this model (most SaaS tools they use work this way). It
also makes data sovereignty clear - "Your data is in acmeoil.wellpulse.io" gives operators confidence their data is isolated.
─────────────────────────────────────────────────

Architecture Design

// Tenant identification middleware
@Injectable()
export class TenantIdentificationMiddleware implements NestMiddleware {
async use(req: Request, res: Response, next: NextFunction) {
// Extract tenant from subdomain: acmeoil.wellpulse.io → "acmeoil"
const hostname = req.hostname; // e.g., "acmeoil.wellpulse.io"
const subdomain = hostname.split['.'](0);

      // Handle special cases
      if (['www', 'api', 'app'].includes(subdomain)) {
        throw new BadRequestException('Invalid tenant subdomain');
      }

      // Fetch tenant config from master DB (or cache)
      const tenant = await this.tenantConfigService.getTenantBySlug(subdomain);

      if (!tenant) {
        throw new NotFoundException(`Tenant '${subdomain}' not found`);
      }

      // Inject tenant context into request
      req['tenant'] = {
        id: tenant.id,
        slug: tenant.slug,
        databaseUrl: tenant.databaseUrl,
        region: tenant.region, // "azure-east-us" or "aws-west-2"
        features: tenant.features, // Feature flags per tenant
      };

      next();
    }

}

// Tenant database connection factory
@Injectable()
export class TenantDatabaseService {
private connectionPools: Map<string, NodePgDatabase> = new Map();

    async getTenantDatabase(tenantId: string): Promise<NodePgDatabase> {
      // Return existing pool if available
      if (this.connectionPools.has(tenantId)) {
        return this.connectionPools.get(tenantId);
      }

      // Fetch tenant config
      const tenant = await this.tenantConfigService.getTenantById(tenantId);

      // Create new connection pool
      const pool = new Pool({
        connectionString: tenant.databaseUrl,
        max: 20, // Max connections per tenant
        idleTimeoutMillis: 30000,
      });

      const db = drizzle(pool, { schema });

      // Cache the connection pool
      this.connectionPools.set(tenantId, db);

      return db;
    }

}

// Usage in repositories
@Injectable()
export class WellRepository {
constructor(private readonly tenantDbService: TenantDatabaseService) {}

    async findById(tenantId: string, wellId: string): Promise<Well | null> {
      const db = await this.tenantDbService.getTenantDatabase(tenantId);

      const results = await db
        .select()
        .from(wellsTable)
        .where(eq(wellsTable.id, wellId))
        .limit(1);

      return results[0] ? this.toDomain(results[0]) : null;
    }

}

Master Database for Tenant Registry

You'll need ONE master database that stores tenant metadata:

// Master database schema (shared across all tenants)
export const tenants = pgTable('tenants', {
id: varchar('id', { length: 255 }).primaryKey(),
slug: varchar('slug', { length: 100 }).notNull().unique(), // "acmeoil"
name: varchar('name', { length: 255 }).notNull(), // "ACME Oil & Gas"
databaseUrl: text('database_url').notNull(), // Connection string
region: varchar('region', { length: 50 }).notNull(), // "azure-east-us"
tier: varchar('tier', { length: 50 }).notNull().default('FREE'), // FREE, STARTER, PRO, ENTERPRISE
status: varchar('status', { length: 50 }).notNull().default('ACTIVE'), // ACTIVE, SUSPENDED, TRIAL
features: jsonb('features').notNull().default({}), // Feature flags
createdAt: timestamp('created_at').notNull().defaultNow(),
updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Tenant users (stored in master DB for authentication)
export const tenantUsers = pgTable('tenant_users', {
id: varchar('id', { length: 255 }).primaryKey(),
tenantId: varchar('tenant_id', { length: 255 }).notNull().references(() => tenants.id),
email: varchar('email', { length: 255 }).notNull(),
passwordHash: text('password_hash').notNull(),
role: varchar('role', { length: 50 }).notNull(), // ADMIN, MANAGER, FIELD_OPERATOR
createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Composite unique index
export const tenantUsersEmailTenantIndex = index('tenant_users_email_tenant_idx')
.on(tenantUsers.email, tenantUsers.tenantId);

Routing Configuration

// Next.js middleware for subdomain routing (apps/web/middleware.ts)
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
const hostname = request.headers.get('host') || '';
const subdomain = hostname.split['.'](0);

    // Marketing site: www.wellpulse.io or wellpulse.io
    if (subdomain === 'www' || hostname === 'wellpulse.io') {
      return NextResponse.rewrite(new URL('/marketing', request.url));
    }

    // App: acmeoil.wellpulse.io
    // Rewrite to /app but keep subdomain visible
    return NextResponse.rewrite(new URL(`/app${request.nextUrl.pathname}`, request.url));

}

export const config = {
matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

Railway Deployment

Railway handles wildcard subdomains easily:

# railway.json

{
"domains": [
"wellpulse.io", # Marketing site
"*.wellpulse.io" # Wildcard for tenant subdomains
]
}

Cost Implication: With Railway's Pro plan ($20/month), you get unlimited wildcard subdomains. Perfect for this architecture!

---

2. Batch Sync Strategy for Offline Field Apps

★ Insight ─────────────────────────────────────
End-of-shift batch sync: This is ideal for oil field operations because (1) field workers have a natural sync point (end of
shift), (2) batch operations are more efficient than real-time sync, (3) easier conflict resolution when you process all changes
together.

Event sourcing advantage: By storing field data changes as events locally, you get automatic audit trail + easy replay during
sync.
─────────────────────────────────────────────────

Offline Sync Architecture

// Electron/React Native local database
interface FieldDataEvent {
id: string;
type: 'WELL_READING_RECORDED' | 'EQUIPMENT_INSPECTED' | 'PRODUCTION_LOGGED';
payload: any;
timestamp: Date;
deviceId: string;
userId: string;
synced: boolean;
syncAttempts: number;
}

// Local event store (SQLite for Electron, AsyncStorage for React Native)
export class LocalEventStore {
private db: SQLiteDatabase;

    async appendEvent(event: FieldDataEvent): Promise<void> {
      await this.db.run(
        'INSERT INTO events (id, type, payload, timestamp, deviceId, userId, synced) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [event.id, event.type, JSON.stringify(event.payload), event.timestamp, event.deviceId, event.userId, false]
      );
    }

    async getUnsyncedEvents(): Promise<FieldDataEvent[]> {
      const rows = await this.db.all('SELECT * FROM events WHERE synced = false ORDER BY timestamp ASC');
      return rows.map(this.rowToEvent);
    }

    async markEventsSynced(eventIds: string[]): Promise<void> {
      const placeholders = eventIds.map(() => '?').join(',');
      await this.db.run(`UPDATE events SET synced = true WHERE id IN (${placeholders})`, eventIds);
    }

}

// Sync service (runs at end of shift)
export class FieldDataSyncService {
async syncToCloud(tenantId: string, apiUrl: string, authToken: string): Promise<SyncResult> {
// 1. Get all unsynced events
const events = await this.localStore.getUnsyncedEvents();

      if (events.length === 0) {
        return { success: true, syncedCount: 0, errors: [] };
      }

      // 2. Batch upload to cloud API
      try {
        const response = await fetch(`${apiUrl}/api/field-data/sync`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'X-Device-Id': this.deviceId,
          },
          body: JSON.stringify({
            tenantId,
            events,
            deviceInfo: {
              deviceId: this.deviceId,
              platform: 'electron', // or 'ios', 'android'
              appVersion: '1.0.0',
            },
          }),
        });

        const result = await response.json();

        // 3. Mark successfully synced events
        if (result.syncedEventIds) {
          await this.localStore.markEventsSynced(result.syncedEventIds);
        }

        // 4. Handle conflicts (if any)
        if (result.conflicts) {
          await this.handleConflicts(result.conflicts);
        }

        return {
          success: true,
          syncedCount: result.syncedEventIds.length,
          conflicts: result.conflicts || [],
          errors: result.errors || [],
        };
      } catch (error) {
        // Network error - events remain unsynced for next attempt
        console.error('Sync failed:', error);

        // Increment sync attempts
        await this.localStore.incrementSyncAttempts(events.map(e => e.id));

        return {
          success: false,
          syncedCount: 0,
          errors: [error.message],
        };
      }
    }

    // Auto-sync when connectivity detected
    async enableAutoSync(): Promise<void> {
      // Check connectivity every 5 minutes
      setInterval(async () => {
        const isOnline = await this.checkConnectivity();

        if (isOnline && !this.isSyncing) {
          await this.syncToCloud(this.tenantId, this.apiUrl, this.authToken);
        }
      }, 5 * 60 * 1000);
    }

}

// Cloud API endpoint for batch sync
@Controller('field-data')
export class FieldDataSyncController {
@Post('sync')
@UseGuards(JwtAuthGuard)
async syncFieldData(
@Body() dto: SyncFieldDataDto,
@CurrentUser() user: User,
): Promise<SyncResponseDto> {
const command = new SyncFieldDataCommand(
user.tenantId,
dto.events,
dto.deviceInfo,
user.id,
);

      return this.commandBus.execute(command);
    }

}

@CommandHandler(SyncFieldDataCommand)
export class SyncFieldDataHandler {
async execute(command: SyncFieldDataCommand): Promise<SyncResponseDto> {
const syncedEventIds: string[] = [];
const conflicts: Conflict[] = [];
const errors: string[] = [];

      // Get tenant database
      const db = await this.tenantDbService.getTenantDatabase(command.tenantId);

      // Process events in order
      for (const event of command.events) {
        try {
          // Check for conflicts (e.g., well reading already exists for same timestamp)
          const conflict = await this.detectConflict(db, event);

          if (conflict) {
            conflicts.push(conflict);
            continue; // Skip this event, will be resolved manually or auto-resolved
          }

          // Apply event to tenant database
          await this.applyEvent(db, event, command.userId);

          syncedEventIds.push(event.id);
        } catch (error) {
          errors.push(`Event ${event.id}: ${error.message}`);
        }
      }

      return {
        syncedEventIds,
        conflicts,
        errors,
      };
    }

}

Sync UI (End of Shift)

// Electron/React Native component
export function EndOfShiftSyncScreen() {
const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

    const handleSync = async () => {
      setSyncStatus('syncing');

      const result = await fieldDataSyncService.syncToCloud(
        tenantId,
        apiUrl,
        authToken,
      );

      if (result.success) {
        setSyncStatus('success');
      } else {
        setSyncStatus('error');
      }

      setSyncResult(result);
    };

    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">End of Shift Sync</h1>

        <div className="mb-6">
          <p className="text-gray-600">
            Sync your field data to the cloud. Make sure you have internet connectivity.
          </p>
        </div>

        {syncStatus === 'idle' && (
          <button onClick={handleSync} className="btn-primary">
            Sync Now
          </button>
        )}

        {syncStatus === 'syncing' && (
          <div className="flex items-center gap-3">
            <Spinner />
            <span>Syncing {syncResult?.unsyncedCount} records...</span>
          </div>
        )}

        {syncStatus === 'success' && (
          <div className="bg-green-50 border border-green-200 p-4 rounded">
            <p className="text-green-800">
              ✓ Successfully synced {syncResult?.syncedCount} records
            </p>
            {syncResult?.conflicts.length > 0 && (
              <p className="text-yellow-800 mt-2">
                ⚠ {syncResult.conflicts.length} conflicts detected - review in dashboard
              </p>
            )}
          </div>
        )}

        {syncStatus === 'error' && (
          <div className="bg-red-50 border border-red-200 p-4 rounded">
            <p className="text-red-800">✗ Sync failed - will retry automatically</p>
            {syncResult?.errors.map((error, i) => (
              <p key={i} className="text-sm text-red-600 mt-1">{error}</p>
            ))}
          </div>
        )}
      </div>
    );

}

---

3. Conflict Resolution Strategy

For oil & gas field data, here's my recommended approach:

Conflict Resolution Rules (Priority Order)

export enum ConflictResolutionStrategy {
// 1. NEWEST_WINS - For sensor readings (latest data is most accurate)
NEWEST_WINS = 'NEWEST_WINS',

    // 2. HIGHEST_VALUE - For production volumes (never underreport production)
    HIGHEST_VALUE = 'HIGHEST_VALUE',

    // 3. MANUAL_REVIEW - For critical safety data (equipment inspections)
    MANUAL_REVIEW = 'MANUAL_REVIEW',

    // 4. MERGE - For notes/comments (append both)
    MERGE = 'MERGE',

}

export class ConflictResolver {
resolveConflict(
localEvent: FieldDataEvent,
cloudEvent: FieldDataEvent,
): ConflictResolution {
// Determine strategy based on event type
const strategy = this.getStrategyForEventType(localEvent.type);

      switch (strategy) {
        case ConflictResolutionStrategy.NEWEST_WINS:
          return localEvent.timestamp > cloudEvent.timestamp
            ? { winner: localEvent, loser: cloudEvent }
            : { winner: cloudEvent, loser: localEvent };

        case ConflictResolutionStrategy.HIGHEST_VALUE:
          const localValue = this.extractValue(localEvent);
          const cloudValue = this.extractValue(cloudEvent);
          return localValue > cloudValue
            ? { winner: localEvent, loser: cloudEvent }
            : { winner: cloudEvent, loser: localEvent };

        case ConflictResolutionStrategy.MANUAL_REVIEW:
          // Flag for review in dashboard
          return {
            requiresReview: true,
            options: [localEvent, cloudEvent],
          };

        case ConflictResolutionStrategy.MERGE:
          return {
            merged: this.mergeEvents(localEvent, cloudEvent),
          };
      }
    }

    private getStrategyForEventType(eventType: string): ConflictResolutionStrategy {
      const strategyMap = {
        'WELL_READING_RECORDED': ConflictResolutionStrategy.NEWEST_WINS,
        'PRODUCTION_LOGGED': ConflictResolutionStrategy.HIGHEST_VALUE,
        'EQUIPMENT_INSPECTED': ConflictResolutionStrategy.MANUAL_REVIEW,
        'NOTES_ADDED': ConflictResolutionStrategy.MERGE,
      };

      return strategyMap[eventType] || ConflictResolutionStrategy.MANUAL_REVIEW;
    }

}

Best practice: For oil & gas, bias toward safety and compliance. When in doubt, flag for manual review rather than auto-resolve.

---

4. ML Opportunities Beyond Predictive Maintenance

⏺ ML Use Cases for Oil & Gas Data

Based on the market research, here are ML opportunities ranked by business value:

| ML Use Case | Business Value | Complexity | Data Requirements
|
|--------------------------------|-----------------------------------------|------------|---------------------------------------
---------|
| 1. Predictive Maintenance | 🟢 Very High (prevents costly downtime) | Medium | Sensor time-series (vibration, temp,
pressure) |
| 2. Production Optimization | 🟢 Very High (increases revenue) | Medium | Historical production data, well
parameters |
| 3. Anomaly Detection | 🟢 High (early warning system) | Low-Medium | Any time-series data (production,
sensors) |
| 4. Decline Curve Analysis | 🟡 High (forecasting) | Medium | Historical production volumes
|
| 5. Emissions Prediction | 🟡 High (ESG compliance) | Medium | Production volumes, equipment usage
|
| 6. Water Cut Prediction | 🟡 Medium (operational efficiency) | Medium | Production data (oil, gas, water
volumes) |
| 7. Well Performance Comparison | 🟡 Medium (benchmarking) | Low | Production data across wells
|
| 8. Drilling Time Prediction | 🔵 Medium (planning) | High | Drilling logs, geology data
|

ML Architecture

// ML Prediction Service (runs in cloud)
@Injectable()
export class ProductionMLService {
private readonly pythonMLEndpoint = process.env.ML_SERVICE_URL; // Separate Python service

    // 1. Production Optimization: Recommend optimal production rates
    async optimizeProduction(wellId: string, tenantId: string): Promise<OptimizationRecommendation> {
      const db = await this.tenantDbService.getTenantDatabase(tenantId);

      // Fetch historical production data
      const historicalData = await db
        .select()
        .from(productionDataTable)
        .where(eq(productionDataTable.wellId, wellId))
        .orderBy(desc(productionDataTable.recordedAt))
        .limit(365); // Last year of data

      // Call Python ML service
      const response = await fetch(`${this.pythonMLEndpoint}/optimize-production`, {
        method: 'POST',
        body: JSON.stringify({
          wellId,
          historicalData,
        }),
      });

      const prediction = await response.json();

      return {
        currentRate: prediction.currentRate,
        optimizedRate: prediction.optimizedRate,
        expectedIncrease: prediction.expectedIncrease, // +5% production
        confidence: prediction.confidence,
        recommendation: prediction.recommendation,
      };
    }

    // 2. Anomaly Detection: Flag unusual patterns
    async detectAnomalies(wellId: string, tenantId: string): Promise<Anomaly[]> {
      const db = await this.tenantDbService.getTenantDatabase(tenantId);

      // Get recent sensor readings
      const sensorData = await db
        .select()
        .from(sensorReadingsTable)
        .where(eq(sensorReadingsTable.wellId, wellId))
        .orderBy(desc(sensorReadingsTable.timestamp))
        .limit(1000); // Last 1000 readings

      // Call anomaly detection model
      const response = await fetch(`${this.pythonMLEndpoint}/detect-anomalies`, {
        method: 'POST',
        body: JSON.stringify({ sensorData }),
      });

      const anomalies = await response.json();

      // Store anomalies in database for alerting
      for (const anomaly of anomalies) {
        await db.insert(anomaliesTable).values({
          id: uuidv4(),
          wellId,
          type: anomaly.type, // 'PRESSURE_SPIKE', 'TEMPERATURE_ANOMALY'
          severity: anomaly.severity, // 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
          detectedAt: new Date(),
          data: anomaly.data,
        });

        // Trigger alert if severity is high/critical
        if (['HIGH', 'CRITICAL'].includes(anomaly.severity)) {
          await this.alertService.sendAlert({
            tenantId,
            wellId,
            message: `${anomaly.type} detected at well ${wellId}`,
            severity: anomaly.severity,
          });
        }
      }

      return anomalies;
    }

    // 3. Decline Curve Analysis: Forecast future production
    async forecastProduction(wellId: string, tenantId: string, months: number): Promise<ProductionForecast> {
      const db = await this.tenantDbService.getTenantDatabase(tenantId);

      const historicalData = await db
        .select()
        .from(productionDataTable)
        .where(eq(productionDataTable.wellId, wellId))
        .orderBy(asc(productionDataTable.recordedAt));

      // Call forecasting model
      const response = await fetch(`${this.pythonMLEndpoint}/forecast-production`, {
        method: 'POST',
        body: JSON.stringify({
          wellId,
          historicalData,
          forecastMonths: months,
        }),
      });

      const forecast = await response.json();

      return {
        wellId,
        forecastMonths: months,
        predictions: forecast.predictions, // Array of {month, barrels, confidence}
        declineRate: forecast.declineRate, // % per month
        estimatedUltimateRecovery: forecast.eur, // Total barrels over well lifetime
      };
    }

    // 4. Emissions Prediction: Estimate emissions based on production
    async predictEmissions(wellId: string, tenantId: string, productionVolume: number): Promise<EmissionsPrediction> {
      const db = await this.tenantDbService.getTenantDatabase(tenantId);

      // Get well equipment configuration
      const well = await db.select().from(wellsTable).where(eq(wellsTable.id, wellId)).limit(1);

      // Call emissions model
      const response = await fetch(`${this.pythonMLEndpoint}/predict-emissions`, {
        method: 'POST',
        body: JSON.stringify({
          productionVolume,
          equipmentType: well[0].equipmentType,
          wellAge: well[0].wellAge,
          flaringEnabled: well[0].flaringEnabled,
        }),
      });

      const emissions = await response.json();

      return {
        co2Tons: emissions.co2Tons,
        methaneKg: emissions.methaneKg,
        vocKg: emissions.vocKg,
        totalCO2Equivalent: emissions.totalCO2e,
        confidence: emissions.confidence,
      };
    }

}

// Background job to run ML predictions nightly
@Injectable()
export class MLPredictionJobs {
@Cron('0 2 \*\* \*') // Run at 2 AM daily
async runDailyPredictions(): Promise<void> {
this.logger.log('Starting daily ML predictions...');

      // Get all active tenants
      const tenants = await this.tenantConfigService.getActiveTenants();

      for (const tenant of tenants) {
        try {
          const db = await this.tenantDbService.getTenantDatabase(tenant.id);

          // Get all active wells for this tenant
          const wells = await db.select().from(wellsTable).where(eq(wellsTable.status, 'ACTIVE'));

          for (const well of wells) {
            // Run anomaly detection
            await this.mlService.detectAnomalies(well.id, tenant.id);

            // Run production optimization (weekly, not daily)
            if (new Date().getDay() === 1) { // Monday
              await this.mlService.optimizeProduction(well.id, tenant.id);
            }
          }
        } catch (error) {
          this.logger.error(`ML predictions failed for tenant ${tenant.id}:`, error);
        }
      }

      this.logger.log('Daily ML predictions completed');
    }

}

Python ML Service (Separate Microservice)

# Python FastAPI service for ML models

from fastapi import FastAPI
from pydantic import BaseModel
import numpy as np
from sklearn.ensemble import IsolationForest, RandomForestRegressor
import pandas as pd

app = FastAPI()

class AnomalyDetectionRequest(BaseModel):
sensorData: list[dict]

class OptimizationRequest(BaseModel):
wellId: str
historicalData: list[dict]

@app.post("/detect-anomalies")
async def detect_anomalies(request: AnomalyDetectionRequest): # Convert to DataFrame
df = pd.DataFrame(request.sensorData)

      # Extract features
      features = df[['pressure', 'temperature', 'vibration', 'flow_rate']].values

      # Train Isolation Forest for anomaly detection
      model = IsolationForest(contamination=0.05, random_state=42)
      predictions = model.fit_predict(features)

      # Flag anomalies
      anomalies = []
      for i, pred in enumerate(predictions):
          if pred == -1:  # Anomaly detected
              anomaly_type = classify_anomaly_type(df.iloc[i])
              anomalies.append({
                  'type': anomaly_type,
                  'severity': calculate_severity(df.iloc[i]),
                  'data': df.iloc[i].to_dict(),
              })

      return {'anomalies': anomalies}

@app.post("/optimize-production")
async def optimize_production(request: OptimizationRequest):
df = pd.DataFrame(request.historicalData)

      # Extract features for production optimization
      X = df[['pressure', 'temperature', 'choke_size', 'runtime_hours']].values
      y = df['production_barrels'].values

      # Train Random Forest Regressor
      model = RandomForestRegressor(n_estimators=100, random_state=42)
      model.fit(X, y)

      # Predict optimal production rate
      current_settings = X[-1]  # Latest settings
      current_rate = y[-1]

      # Try different choke sizes to find optimal
      optimal_choke = optimize_choke_size(model, current_settings)
      optimized_rate = model.predict([optimal_choke])[0]

      return {
          'currentRate': float(current_rate),
          'optimizedRate': float(optimized_rate),
          'expectedIncrease': float((optimized_rate - current_rate) / current_rate * 100),
          'confidence': 0.85,
          'recommendation': f'Adjust choke size to {optimal_choke[2]:.2f} inches',
      }

@app.post("/forecast-production")
async def forecast_production(request: dict):
df = pd.DataFrame(request['historicalData'])
months = request['forecastMonths']

      # Fit decline curve (exponential decline model)
      X = np.arange(len(df)).reshape(-1, 1)
      y = df['production_barrels'].values

      # Exponential decline: q(t) = q0 * exp(-D * t)
      from scipy.optimize import curve_fit

      def decline_curve(t, q0, D):
          return q0 * np.exp(-D * t)

      params, _ = curve_fit(decline_curve, X.flatten(), y)
      q0, D = params

      # Forecast future months
      future_months = np.arange(len(df), len(df) + months)
      predictions = decline_curve(future_months, q0, D)

      return {
          'predictions': [
              {'month': int(m), 'barrels': float(p), 'confidence': 0.8}
              for m, p in zip(future_months, predictions)
          ],
          'declineRate': float(D * 100),  # % per month
          'eur': float(np.sum(predictions)),  # Estimated Ultimate Recovery
      }

Deployment: Host Python ML service as separate Railway service or AWS Lambda. NestJS API calls it via HTTP.

---

5. File Storage Architecture

Since you said "client's choice, default Azure":

// File storage abstraction (Strategy Pattern)
export interface FileStorageProvider {
upload(file: Buffer, path: string, metadata?: any): Promise<string>; // Returns URL
download(path: string): Promise<Buffer>;
delete(path: string): Promise<void>;
getSignedUrl(path: string, expiresIn: number): Promise<string>;
}

// Azure Blob Storage implementation
@Injectable()
export class AzureBlobStorageProvider implements FileStorageProvider {
private containerClient: ContainerClient;

    constructor(private readonly configService: ConfigService) {
      const connectionString = configService.get('AZURE_STORAGE_CONNECTION_STRING');
      const containerName = configService.get('AZURE_CONTAINER_NAME');

      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      this.containerClient = blobServiceClient.getContainerClient(containerName);
    }

    async upload(file: Buffer, path: string, metadata?: any): Promise<string> {
      const blockBlobClient = this.containerClient.getBlockBlobClient(path);
      await blockBlobClient.upload(file, file.length, { metadata });
      return blockBlobClient.url;
    }

    async download(path: string): Promise<Buffer> {
      const blockBlobClient = this.containerClient.getBlockBlobClient(path);
      const downloadResponse = await blockBlobClient.download();
      return await streamToBuffer(downloadResponse.readableStreamBody);
    }

    async getSignedUrl(path: string, expiresIn: number): Promise<string> {
      const blockBlobClient = this.containerClient.getBlockBlobClient(path);
      const sasUrl = await blockBlobClient.generateSasUrl({
        permissions: BlobSASPermissions.parse('r'),
        expiresOn: new Date(Date.now() + expiresIn * 1000),
      });
      return sasUrl;
    }

}

// AWS S3 implementation
@Injectable()
export class S3StorageProvider implements FileStorageProvider {
private s3Client: S3Client;
private bucketName: string;

    constructor(private readonly configService: ConfigService) {
      this.s3Client = new S3Client({
        region: configService.get('AWS_REGION'),
        credentials: {
          accessKeyId: configService.get('AWS_ACCESS_KEY_ID'),
          secretAccessKey: configService.get('AWS_SECRET_ACCESS_KEY'),
        },
      });
      this.bucketName = configService.get('AWS_S3_BUCKET');
    }

    async upload(file: Buffer, path: string, metadata?: any): Promise<string> {
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: path,
        Body: file,
        Metadata: metadata,
      }));

      return `https://${this.bucketName}.s3.amazonaws.com/${path}`;
    }

    // ... similar implementations for download, delete, getSignedUrl

}

// Factory to select provider based on tenant config
@Injectable()
export class FileStorageFactory {
constructor(
private readonly azureProvider: AzureBlobStorageProvider,
private readonly s3Provider: S3StorageProvider,
) {}

    getProvider(tenant: Tenant): FileStorageProvider {
      switch (tenant.fileStorageProvider) {
        case 'AZURE':
          return this.azureProvider;
        case 'AWS':
          return this.s3Provider;
        default:
          return this.azureProvider; // Default to Azure
      }
    }

}

// Usage
@Injectable()
export class FieldPhotoService {
async uploadFieldPhoto(
tenantId: string,
wellId: string,
photo: Buffer,
metadata: { uploadedBy: string; description: string },
): Promise<string> {
const tenant = await this.tenantService.getTenant(tenantId);
const storageProvider = this.fileStorageFactory.getProvider(tenant);

      const path = `tenants/${tenantId}/wells/${wellId}/photos/${uuidv4()}.jpg`;
      const url = await storageProvider.upload(photo, path, metadata);

      // Save reference in database
      await this.db.insert(fieldPhotosTable).values({
        id: uuidv4(),
        tenantId,
        wellId,
        url,
        uploadedBy: metadata.uploadedBy,
        description: metadata.description,
        createdAt: new Date(),
      });

      return url;
    }

}

---

6. Authentication Architecture

⏺ ★ Insight ─────────────────────────────────────
Authentication trade-off: For oil & gas operators, you have two paths: (1) Simple email/password - easy to implement, works
everywhere, but operators manage another set of credentials, or (2) SSO integration (Active Directory/SAML) - more complex, but
operators prefer it because field workers can use their company credentials.

My recommendation: Start with email/password + magic links for MVP (fast to market), then add SSO as a paid feature for larger
operators. Field workers often don't have corporate email, so magic links (passwordless) work better than traditional passwords.
─────────────────────────────────────────────────

Recommended Authentication Architecture

// Phase 1: Email/Password + Magic Links (MVP)
// Phase 2: SSO/SAML (Enterprise feature)

// Master database: User authentication
export const tenantUsers = pgTable('tenant_users', {
id: varchar('id', { length: 255 }).primaryKey(),
tenantId: varchar('tenant_id', { length: 255 }).notNull().references(() => tenants.id),
email: varchar('email', { length: 255 }).notNull(),
passwordHash: text('password_hash'), // Nullable (for magic link only users)
role: varchar('role', { length: 50 }).notNull(), // ADMIN, MANAGER, FIELD_OPERATOR
firstName: varchar('first_name', { length: 255 }).notNull(),
lastName: varchar('last_name', { length: 255 }).notNull(),
phoneNumber: varchar('phone_number', { length: 50 }), // For SMS alerts
status: varchar('status', { length: 50 }).notNull().default('ACTIVE'), // ACTIVE, SUSPENDED, INVITED
lastLoginAt: timestamp('last_login_at'),
createdAt: timestamp('created_at').notNull().defaultNow(),
updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Magic link tokens for passwordless login
export const magicLinkTokens = pgTable('magic_link_tokens', {
id: varchar('id', { length: 255 }).primaryKey(),
userId: varchar('user_id', { length: 255 }).notNull().references(() => tenantUsers.id),
token: varchar('token', { length: 255 }).notNull().unique(),
expiresAt: timestamp('expires_at').notNull(),
usedAt: timestamp('used_at'),
createdAt: timestamp('created_at').notNull().defaultNow(),
});

// SSO configuration (for Enterprise tenants)
export const ssoConfigurations = pgTable('sso_configurations', {
id: varchar('id', { length: 255 }).primaryKey(),
tenantId: varchar('tenant_id', { length: 255 }).notNull().references(() => tenants.id).unique(),
provider: varchar('provider', { length: 50 }).notNull(), // 'SAML', 'OIDC', 'AZURE_AD'
entityId: text('entity_id'),
ssoUrl: text('sso_url'),
certificate: text('certificate'),
enabled: boolean('enabled').notNull().default(false),
createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Authentication service
@Injectable()
export class AuthService {
constructor(
private readonly jwtService: JwtService,
private readonly userRepository: IUserRepository,
private readonly emailService: EmailService,
) {}

    // 1. Email/Password login
    async login(email: string, password: string, subdomain: string): Promise<AuthResponse> {
      // Get tenant from subdomain
      const tenant = await this.tenantService.getTenantBySlug(subdomain);
      if (!tenant) {
        throw new UnauthorizedException('Invalid tenant');
      }

      // Find user in master database
      const user = await this.userRepository.findByEmailAndTenant(email, tenant.id);
      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Verify password
      if (!user.passwordHash) {
        throw new UnauthorizedException('User has not set a password. Use magic link instead.');
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Update last login
      await this.userRepository.updateLastLogin(user.id);

      // Generate JWT
      const accessToken = this.generateAccessToken(user, tenant);
      const refreshToken = this.generateRefreshToken(user);

      return {
        accessToken,
        refreshToken,
        user: this.mapToDto(user),
      };
    }

    // 2. Magic link (passwordless) login
    async sendMagicLink(email: string, subdomain: string): Promise<void> {
      const tenant = await this.tenantService.getTenantBySlug(subdomain);
      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }

      const user = await this.userRepository.findByEmailAndTenant(email, tenant.id);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Generate magic link token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await this.db.insert(magicLinkTokens).values({
        id: uuidv4(),
        userId: user.id,
        token,
        expiresAt,
      });

      // Send email with magic link
      const magicLinkUrl = `https://${subdomain}.wellpulse.io/auth/magic-link?token=${token}`;

      await this.emailService.send({
        to: email,
        subject: 'Your WellPulse Login Link',
        html: `
          <p>Hi ${user.firstName},</p>
          <p>Click the link below to sign in to WellPulse:</p>
          <a href="${magicLinkUrl}">${magicLinkUrl}</a>
          <p>This link expires in 15 minutes.</p>
        `,
      });
    }

    async verifyMagicLink(token: string): Promise<AuthResponse> {
      const tokenRecord = await this.db
        .select()
        .from(magicLinkTokens)
        .where(eq(magicLinkTokens.token, token))
        .limit(1);

      if (!tokenRecord[0]) {
        throw new UnauthorizedException('Invalid magic link');
      }

      if (tokenRecord[0].usedAt) {
        throw new UnauthorizedException('Magic link already used');
      }

      if (new Date() > tokenRecord[0].expiresAt) {
        throw new UnauthorizedException('Magic link expired');
      }

      // Mark token as used
      await this.db
        .update(magicLinkTokens)
        .set({ usedAt: new Date() })
        .where(eq(magicLinkTokens.id, tokenRecord[0].id));

      // Get user and tenant
      const user = await this.userRepository.findById(tokenRecord[0].userId);
      const tenant = await this.tenantService.getTenantById(user.tenantId);

      // Generate JWT
      const accessToken = this.generateAccessToken(user, tenant);
      const refreshToken = this.generateRefreshToken(user);

      return {
        accessToken,
        refreshToken,
        user: this.mapToDto(user),
      };
    }

    // 3. SSO login (Enterprise feature)
    async initiateSSOLogin(subdomain: string): Promise<{ ssoUrl: string }> {
      const tenant = await this.tenantService.getTenantBySlug(subdomain);
      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }

      const ssoConfig = await this.db
        .select()
        .from(ssoConfigurations)
        .where(and(
          eq(ssoConfigurations.tenantId, tenant.id),
          eq(ssoConfigurations.enabled, true),
        ))
        .limit(1);

      if (!ssoConfig[0]) {
        throw new BadRequestException('SSO not enabled for this tenant');
      }

      // Generate SAML request
      const samlRequest = this.samlService.generateRequest(ssoConfig[0]);

      return {
        ssoUrl: `${ssoConfig[0].ssoUrl}?SAMLRequest=${samlRequest}`,
      };
    }

    async handleSSOCallback(samlResponse: string): Promise<AuthResponse> {
      // Verify SAML response
      const assertion = await this.samlService.verifyResponse(samlResponse);

      // Extract user info from SAML
      const email = assertion.email;
      const tenantId = assertion.tenantId;

      // Find or create user
      let user = await this.userRepository.findByEmailAndTenant(email, tenantId);

      if (!user) {
        // Auto-provision user from SSO
        user = await this.userRepository.create({
          tenantId,
          email,
          firstName: assertion.firstName,
          lastName: assertion.lastName,
          role: 'FIELD_OPERATOR', // Default role
        });
      }

      const tenant = await this.tenantService.getTenantById(tenantId);

      // Generate JWT
      const accessToken = this.generateAccessToken(user, tenant);
      const refreshToken = this.generateRefreshToken(user);

      return {
        accessToken,
        refreshToken,
        user: this.mapToDto(user),
      };
    }

    // JWT generation
    private generateAccessToken(user: User, tenant: Tenant): string {
      const payload = {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        role: user.role,
      };

      return this.jwtService.sign(payload, {
        expiresIn: '1h', // Short-lived access token
      });
    }

    private generateRefreshToken(user: User): string {
      const payload = {
        userId: user.id,
        type: 'refresh',
      };

      return this.jwtService.sign(payload, {
        expiresIn: '30d', // Long-lived refresh token
      });
    }

}

// Login flow for Electron/React Native apps
export class OfflineAuthService {
// Store credentials securely
async login(email: string, password: string, subdomain: string): Promise<void> {
// Call cloud API
const response = await fetch(`https://${subdomain}.wellpulse.io/api/auth/login`, {
method: 'POST',
body: JSON.stringify({ email, password }),
});

      const { accessToken, refreshToken, user } = await response.json();

      // Store tokens in secure storage
      await this.secureStorage.set('accessToken', accessToken);
      await this.secureStorage.set('refreshToken', refreshToken);
      await this.secureStorage.set('user', JSON.stringify(user));

      // App is now authenticated offline
      this.isAuthenticated = true;
    }

    // Offline mode: Verify stored credentials
    async verifyOfflineAuth(): Promise<boolean> {
      const accessToken = await this.secureStorage.get('accessToken');
      if (!accessToken) return false;

      // Decode JWT (don't verify signature offline, trust local storage)
      const decoded = jwtDecode(accessToken);

      // Check if token expired
      if (decoded.exp * 1000 < Date.now()) {
        // Try to refresh token when back online
        return false;
      }

      return true;
    }

}

Role-Based Access Control (RBAC)

// Roles for oil & gas operators
export enum UserRole {
ADMIN = 'ADMIN', // Full access, billing, user management
MANAGER = 'MANAGER', // View all data, run reports, manage wells
FIELD_OPERATOR = 'FIELD_OPERATOR', // Enter field data, view assigned wells
VIEWER = 'VIEWER', // Read-only access (for contractors, consultants)
}

// Permissions by role
const ROLE_PERMISSIONS = {
[UserRole.ADMIN]: [
'wells:read', 'wells:write', 'wells:delete',
'users:read', 'users:write', 'users:delete',
'reports:read', 'reports:export',
'settings:read', 'settings:write',
],
[UserRole.MANAGER]: [
'wells:read', 'wells:write',
'users:read',
'reports:read', 'reports:export',
'settings:read',
],
[UserRole.FIELD_OPERATOR]: [
'wells:read', 'wells:write', // Only assigned wells
'field-data:write',
'reports:read', // Only own reports
],
[UserRole.VIEWER]: [
'wells:read',
'reports:read',
],
};

// CASL-based permissions guard
@Injectable()
export class PermissionsGuard implements CanActivate {
canActivate(context: ExecutionContext): boolean {
const request = context.switchToHttp().getRequest();
const user = request.user;
const requiredPermission = this.getRequiredPermission(context);

      const userPermissions = ROLE_PERMISSIONS[user.role];

      if (!userPermissions.includes(requiredPermission)) {
        throw new ForbiddenException(`Missing permission: ${requiredPermission}`);
      }

      return true;
    }

}

---

Summary & Next Steps

⏺ Architecture Decisions Summary

| Decision | Chosen Approach | Rationale
|
|---------------------|------------------------------------------------------------|--------------------------------------------
---------------------------------------------------|
| Deployment | Cloud-first (Railway), subdomain-per-tenant | Simpler ops, Slack-style UX, client chooses
DB location |
| Database | PostgreSQL per tenant (client-controlled location) | Data sovereignty, compliance, scalability
|
| Sync | Batch sync at end of shift | Natural sync point, efficient, matches
field workflows |
| Conflict Resolution | Smart rules (newest wins, highest value, manual review) | Safety-first for O&G, automated where safe
|
| ML | Cloud-based Python microservice | 8 use cases (predictive maintenance,
production optimization, anomaly detection, forecasting) |
| File Storage | Pluggable (Azure default, AWS optional) | Client choice, Strategy Pattern
|
| Authentication | Email/password + magic links (MVP) → SSO/SAML (Enterprise) | Fast to market, upgrade path for large
operators |

---

Ready to Build?

I've designed the complete architecture. Would you like me to:

1. Update CLAUDE.md and patterns to remove PSA references and add O&G domain language?
2. Create new pattern documents for Database-Per-Tenant, Offline Sync, Conflict Resolution?
3. Scaffold the monorepo structure (apps/api, apps/web, apps/electron, apps/mobile)?
4. Start building the core infrastructure (tenant middleware, database connection pooling, auth system)?

Let me know which direction you'd like to go! 🚀

Todos
☒ Design subdomain-per-tenant architecture (Slack-style)
☒ Document batch sync strategy for offline field apps
☒ Create conflict resolution pattern for field data
☒ Research ML opportunities for oil & gas production data
☒ Design authentication architecture for multi-tenant O&G platform
☐ Update CLAUDE.md to remove PSA references
☐ Create new pattern: Database-Per-Tenant Multi-Tenancy Pattern

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

>  
> ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
> ? for shortcuts
