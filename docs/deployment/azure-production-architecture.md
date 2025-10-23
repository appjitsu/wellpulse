# Azure Production Architecture

**Version**: 1.0
**Last Updated**: October 23, 2025
**Status**: 🏗️ Architecture Design

---

## Overview

WellPulse production infrastructure is hosted entirely on **Microsoft Azure** for enterprise credibility, industry alignment (O&G standard), and comprehensive hybrid cloud capabilities. Staging and ephemeral PR environments use Railway for fast iteration.

**Key Principle**: API and web applications run on Azure, but **client databases can be hosted anywhere** (Azure, AWS, on-premises, or client's own infrastructure). The WellPulse API establishes secure connections to tenant databases regardless of location.

---

## Deployment Strategy

| Environment     | Platform       | Purpose                      | Lifecycle                            |
| --------------- | -------------- | ---------------------------- | ------------------------------------ |
| **Production**  | Azure          | Customer-facing platform     | Persistent                           |
| **Staging**     | Railway        | Pre-production testing       | Persistent                           |
| **PR Previews** | Railway        | Feature testing, code review | Ephemeral (auto-deleted after merge) |
| **Local Dev**   | Docker Compose | Development                  | Developer machines                   |

---

## Azure Production Architecture

### Resource Group Structure

```
wellpulse-prod (Resource Group - Primary Region: East US 2)
│
├── Compute
│   ├── wellpulse-api (Azure Container Apps) - Tenant-facing NestJS API
│   ├── wellpulse-web (Azure Container Apps) - Client dashboard (Next.js - map interface)
│   ├── wellpulse-admin (Azure Container Apps) - Internal admin portal (Next.js with API routes)
│   └── wellpulse-ml (Azure Container Apps) - ML service (Python FastAPI)
│
├── Databases
│   └── wellpulse-master-db (Azure PostgreSQL Flexible Server)
│       └── wellpulse_master (Database)
│
├── Caching & Messaging
│   ├── wellpulse-redis (Azure Cache for Redis - Basic 250MB)
│   └── wellpulse-servicebus (Azure Service Bus - Standard tier)
│
├── Storage
│   └── wellpulseprod (Azure Storage Account)
│       ├── field-photos (Blob Container)
│       ├── compliance-reports (Blob Container)
│       └── equipment-documents (Blob Container)
│
├── Networking
│   ├── wellpulse-vnet (Virtual Network)
│   ├── wellpulse-vpn-gateway (VPN Gateway for on-prem connections)
│   └── wellpulse-frontdoor (Azure Front Door for CDN + WAF)
│
├── Security & Identity
│   ├── wellpulse-keyvault (Azure Key Vault)
│   └── wellpulse-managed-identity (Managed Identity for apps)
│
└── Monitoring & Logging
    ├── wellpulse-appinsights (Application Insights)
    ├── wellpulse-logs (Log Analytics Workspace)
    └── wellpulse-monitor (Azure Monitor Alerts)
```

---

## Compute: Azure Container Apps

**Why Container Apps over App Service?**

- Automatic scaling to zero (cost savings for low-traffic periods)
- Built-in ingress with automatic HTTPS
- Easier to deploy containers from GitHub Actions
- Supports background workers (Bull queues)
- Cheaper than App Service for multi-container workloads

### Tenant-Facing API Container App

```yaml
# wellpulse-api (Azure Container App)
Purpose: Main NestJS API for tenant operations (wells, production data, field entries)
Configuration:
  Image: ghcr.io/yourusername/wellpulse-api:latest
  Ingress: Enabled, External, Port 3001
  Custom Domains:
    - api.wellpulse.io
    - *.wellpulse.io/api/* (tenant subdomain routing)
  Scale Rules:
    - Min Replicas: 0 (bootstrap), 1 (production)
    - Max Replicas: 10
    - HTTP Concurrency: 100
  Resources:
    CPU: 0.5 vCPU (bootstrap), 1.0 vCPU (production)
    Memory: 1.0 Gi (bootstrap), 2.0 Gi (production)
  Environment Variables:
    - DATABASE_URL_MASTER: @Microsoft.KeyVault(SecretUri=...)
    - REDIS_URL: @Microsoft.KeyVault(SecretUri=...) # Optional in bootstrap
    - JWT_SECRET: @Microsoft.KeyVault(SecretUri=...)
    - AZURE_STORAGE_CONNECTION_STRING: @Microsoft.KeyVault(SecretUri=...)
```

### Client Dashboard Container App

```yaml
# wellpulse-web (Azure Container App)
Purpose: Client-facing dashboard (Next.js - map interface, production charts, well data)
Configuration:
  Image: ghcr.io/yourusername/wellpulse-web:latest
  Ingress: Enabled, External, Port 3000
  Custom Domains:
    - wellpulse.io
    - *.wellpulse.io (wildcard for tenant subdomains like acmeoil.wellpulse.io)
  Scale Rules:
    - Min Replicas: 0 (bootstrap), 1 (production)
    - Max Replicas: 5
    - HTTP Concurrency: 50
  Resources:
    CPU: 0.25 vCPU (bootstrap), 0.5 vCPU (production)
    Memory: 0.5 Gi (bootstrap), 1.0 Gi (production)
```

### Admin Portal Container App

```yaml
# wellpulse-admin (Azure Container App)
Purpose: Internal admin portal for WellPulse staff (Next.js with API routes)
         - Tenant provisioning via UI
         - Database management (test connections, run migrations)
         - User management across all tenants
         - Billing & analytics dashboard
Configuration:
  Image: ghcr.io/yourusername/wellpulse-admin:latest
  Ingress: Enabled, External, Port 3002
  Custom Domain: admin.wellpulse.io
  IP Restrictions: # Optional
    - 203.0.113.0/24 (WellPulse office IP range)
  Scale Rules:
    - Min Replicas: 0 (low traffic, scale to zero)
    - Max Replicas: 2
    - HTTP Concurrency: 10
  Resources:
    CPU: 0.25 vCPU
    Memory: 0.5 Gi
  Environment Variables:
    - DATABASE_URL_MASTER: @Microsoft.KeyVault(SecretUri=...)
    - AZURE_SUBSCRIPTION_ID: @Microsoft.KeyVault(SecretUri=...) # For provisioning
    - AZURE_CLIENT_ID: @Microsoft.KeyVault(SecretUri=...) # Service Principal
    - AZURE_CLIENT_SECRET: @Microsoft.KeyVault(SecretUri=...)
    - NEXTAUTH_SECRET: @Microsoft.KeyVault(SecretUri=...) # For admin authentication
```

### ML Service Container App

```yaml
# wellpulse-ml (Azure Container App)
Purpose: Predictive maintenance, production optimization, anomaly detection (Python FastAPI)
Configuration:
  Image: ghcr.io/yourusername/wellpulse-ml:latest
  Ingress: Enabled, Internal (only accessible from wellpulse-api)
  Scale Rules:
    - Min Replicas: 0 (scale to zero when idle)
    - Max Replicas: 3
    - HTTP Concurrency: 10 (ML is CPU-intensive)
  Resources:
    CPU: 1.0 vCPU (bootstrap), 2.0 vCPU (production)
    Memory: 2.0 Gi (bootstrap), 4.0 Gi (production)
```

---

## Databases: Master + Per-Tenant

### Master Database (Azure PostgreSQL Flexible Server)

Stores tenant metadata, user authentication, and configuration.

```yaml
Server: wellpulse-master-db
Configuration:
  SKU: Burstable B1ms (1 vCore, 2 GiB RAM)
  Storage: 32 GB (auto-grow enabled)
  Backup Retention: 7 days
  Geo-Redundancy: Enabled (paired region: West US 2)
  High Availability: Disabled (not critical, can tolerate brief downtime)
  Public Access: Disabled
  Private Endpoint: Enabled (VNet-integrated)

Databases:
  - wellpulse_master

Connection String (stored in Key Vault):
  postgresql://wellpulse_admin:{password}@wellpulse-master-db.postgres.database.azure.com:5432/wellpulse_master?sslmode=require
```

### Tenant Databases (Client Choice)

**Architecture Decision**: Tenant databases are **NOT** hosted by WellPulse. Clients choose where their data lives.

#### Option 1: Azure PostgreSQL (Recommended, ~70% of clients expected)

```yaml
Server: {client-slug}-db.postgres.database.azure.com
Configuration:
  SKU: Burstable B1ms or B2s (client pays via their Azure subscription)
  Location: Client's preferred Azure region
  Private Endpoint: Optional (for VNet peering to WellPulse API)

Connection Method:
  - VNet Peering (if in same region as WellPulse API)
  - Azure Private Link (cross-region)
  - Public endpoint with SSL + IP whitelisting (fallback)

Stored in Master DB:
  tenants.databaseUrl = "postgresql://user:pass@{client-slug}-db.postgres.database.azure.com:5432/{client-db}"
  tenants.connectionType = "AZURE_PRIVATE_LINK" | "PUBLIC_SSL" | "VNET_PEERING"
```

#### Option 2: AWS RDS PostgreSQL (~20% of clients)

```yaml
Server: {client-slug}-db.{region}.rds.amazonaws.com
Configuration:
  Instance Type: db.t4g.micro or db.t4g.small
  Location: Client's preferred AWS region

Connection Method:
  - VPN Connection (AWS-to-Azure via Site-to-Site VPN)
  - Public endpoint with SSL + IP whitelisting

Stored in Master DB:
  tenants.databaseUrl = "postgresql://user:pass@{client-slug}-db.{region}.rds.amazonaws.com:5432/{client-db}"
  tenants.connectionType = "AWS_VPN" | "PUBLIC_SSL"
```

#### Option 3: On-Premises PostgreSQL (~10% of clients)

```yaml
Server: 192.168.x.x (client's internal network)
Configuration:
  Hardware: Client's own infrastructure

Connection Method:
  - Azure VPN Gateway (Site-to-Site VPN)
  - Azure ExpressRoute (for large clients with dedicated circuits)

Stored in Master DB: tenants.databaseUrl = "postgresql://user:pass@192.168.x.x:5432/{client-db}"
  tenants.connectionType = "ON_PREMISES_VPN"
  tenants.vpnGatewayId = "wellpulse-vpn-gateway"
```

---

## Networking Architecture

### Virtual Network (VNet)

```yaml
Name: wellpulse-vnet
Address Space: 10.0.0.0/16
Subnets:
  - container-apps-subnet (10.0.1.0/24)
  - postgres-subnet (10.0.2.0/24)
  - redis-subnet (10.0.3.0/24)
  - gateway-subnet (10.0.255.0/27) # For VPN Gateway
```

### VPN Gateway (Hybrid Connectivity)

```yaml
Name: wellpulse-vpn-gateway
SKU: VpnGw1 (650 Mbps, up to 30 tunnels)
Purpose: Connect to on-premises client databases
Configuration:
  Type: RouteBased
  Protocol: IKEv2

Per-Tenant VPN Connections:
  - acmeoil-vpn (connects to ACME Oil on-prem network)
  - permianprod-vpn (connects to Permian Production on-prem network)
```

### Azure Front Door (CDN + WAF + Subdomain Routing)

```yaml
Name: wellpulse-frontdoor
Purpose:
  - CDN for Next.js static assets
  - Web Application Firewall (WAF)
  - Wildcard subdomain routing (*.wellpulse.io)
  - DDoS protection

Routing Rules:
  - *.wellpulse.io/* → wellpulse-web (Container App)
  - *.wellpulse.io/api/* → wellpulse-api (Container App)

WAF Policy:
  - OWASP Top 10 protection
  - Rate limiting (100 requests/minute per IP)
  - Geo-blocking (optional, for clients in specific regions)
```

---

## Storage: Azure Blob Storage

```yaml
Storage Account: wellpulseprod
Configuration:
  SKU: Standard LRS (Locally Redundant Storage)
  Access Tier: Hot (frequently accessed field photos)
  Public Access: Disabled (use SAS tokens or Azure AD)

Containers:
  - field-photos: Equipment photos from Electron/Mobile apps
  - compliance-reports: Generated PDF reports (ESG, production)
  - equipment-documents: Manuals, inspection records

Lifecycle Management:
  - Move to Cool tier after 90 days (save costs)
  - Archive tier after 365 days (rarely accessed historical data)
```

**Client Choice**: Some clients may prefer AWS S3. The WellPulse API uses the **Strategy Pattern** to support both:

```typescript
// Configured per tenant in master database
tenants.fileStorageProvider = "AZURE_BLOB" | "AWS_S3" | "CLIENT_MANAGED"
tenants.fileStorageConfig = {
  // Azure Blob
  connectionString: "...",
  containerName: "..."

  // OR AWS S3
  bucketName: "...",
  region: "us-east-1",
  accessKeyId: "...",
  secretAccessKey: "..."
}
```

---

## Caching & Messaging

### Azure Cache for Redis

```yaml
Name: wellpulse-redis
Configuration:
  SKU: Basic C0 (250 MB) → Upgrade to Standard C1 (1 GB) at 50+ tenants
  Purpose:
    - Session storage (JWT refresh tokens)
    - API response caching
    - Bull/BullMQ job queues
  Access:
    - VNet-integrated (private endpoint)
    - TLS 1.2+ only

Connection String (stored in Key Vault): rediss://:{password}@wellpulse-redis.redis.cache.windows.net:6380
```

### Azure Service Bus (Optional, for production-grade queuing)

```yaml
Name: wellpulse-servicebus
Configuration:
  SKU: Standard (supports topics/subscriptions)
  Purpose:
    - Background jobs (alternative to Bull/Redis)
    - Event-driven architecture (pub/sub for ML predictions)

Queues:
  - field-data-sync: Process offline sync batches
  - ml-predictions: Trigger ML model runs
  - email-notifications: Send alerts to operators
```

**Decision**: Start with **Bull + Redis** for simplicity. Migrate to Service Bus if Redis queuing becomes a bottleneck.

---

## Security: Key Vault + Managed Identity

### Azure Key Vault

```yaml
Name: wellpulse-keyvault
Purpose: Store secrets, API keys, database passwords
Access Policy: Managed Identity (wellpulse-managed-identity)

Secrets Stored:
  - DATABASE-URL-MASTER: Master database connection string
  - JWT-SECRET: JWT signing key
  - AZURE-STORAGE-CONNECTION-STRING: Blob storage credentials
  - SENDGRID-API-KEY: Email service API key
  - {TENANT-SLUG}-DATABASE-URL: Per-tenant database connections (optional, if not in tenant table)
```

### Managed Identity

```yaml
Name: wellpulse-managed-identity
Type: System-assigned (per Container App)
Purpose:
  - Container Apps authenticate to Key Vault without passwords
  - Access Blob Storage without connection strings
  - Read secrets from Key Vault

Permissions:
  - Key Vault: Get Secrets
  - Blob Storage: Contributor (read/write blobs)
```

**Security Best Practice**: Never store secrets in environment variables or code. All secrets live in Key Vault, referenced by Container Apps via `@Microsoft.KeyVault(SecretUri=...)`.

---

## Monitoring & Observability

### Application Insights

```yaml
Name: wellpulse-appinsights
Purpose: Application performance monitoring (APM)
Integrated with:
  - wellpulse-api (NestJS logs, request tracing)
  - wellpulse-web (Next.js page performance, client-side errors)
  - wellpulse-ml (ML prediction latency, model performance)

Key Metrics:
  - API request duration (p50, p95, p99)
  - Database query performance
  - ML prediction latency
  - Field data sync success rate
  - User login patterns
```

### Log Analytics Workspace

```yaml
Name: wellpulse-logs
Purpose: Centralized logging for all Azure resources
Log Sources:
  - Container Apps (application logs)
  - PostgreSQL (slow query logs)
  - Redis (cache hit/miss rates)
  - VPN Gateway (connection logs)

Retention: 30 days (upgrade to 90 days for production compliance)
```

### Azure Monitor Alerts

```yaml
Name: wellpulse-monitor
Alerts:
  - API Error Rate > 5% (5xx responses) → Email ops team
  - Database CPU > 80% for 5 minutes → Auto-scale trigger
  - Redis memory > 90% → Upgrade tier
  - VPN tunnel disconnected → Email + SMS
  - Container App crash loop → PagerDuty incident
```

---

## CI/CD: GitHub Actions → Azure Container Registry → Container Apps

### Deployment Pipeline

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Azure Production

on:
  push:
    branches: [main]

jobs:
  deploy-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker image
        run: docker build -t wellpulse-api:${{ github.sha }} -f apps/api/Dockerfile .

      - name: Push to Azure Container Registry
        uses: azure/docker-login@v1
        with:
          login-server: wellpulse.azurecr.io
          username: ${{ secrets.ACR_USERNAME }}
          password: ${{ secrets.ACR_PASSWORD }}
        run: |
          docker tag wellpulse-api:${{ github.sha }} wellpulse.azurecr.io/wellpulse-api:latest
          docker push wellpulse.azurecr.io/wellpulse-api:latest

      - name: Deploy to Container App
        uses: azure/container-apps-deploy-action@v1
        with:
          resource-group: wellpulse-prod
          container-app-name: wellpulse-api
          image: wellpulse.azurecr.io/wellpulse-api:latest
```

**Zero-Downtime Deployments**: Container Apps supports blue-green deployments. New revision deployed alongside old, traffic gradually shifted over.

---

## Cost Estimation (Monthly, Azure Production)

### Bootstrap Phase (0-10 tenants, <$100/month target)

**Problem**: Initial architecture costs $445/month, but 20-well minimum = $200/month revenue.

**Solution**: Ultra-lean deployment for bootstrapping, upgrade as revenue grows.

| Resource                              | Bootstrap Config (0-10 tenants)                   | Cost             | Production Config (50+ tenants)    | Cost            |
| ------------------------------------- | ------------------------------------------------- | ---------------- | ---------------------------------- | --------------- |
| **Container Apps Environment**        | Consumption plan                                  | $0 (pay per use) | Consumption plan                   | $0              |
| - API (NestJS - 0.5 vCPU, 1 GB)       | Min: 0, Max: 3                                    | ~$25             | Min: 1, Max: 10 (1 vCPU, 2 GB)     | ~$100           |
| - Web (Next.js - 0.25 vCPU, 0.5 GB)   | Min: 0, Max: 2                                    | ~$10             | Min: 1, Max: 5 (0.5 vCPU, 1 GB)    | ~$50            |
| - Admin (Next.js - 0.25 vCPU, 0.5 GB) | Min: 0, Max: 1                                    | ~$3              | Min: 0, Max: 2 (0.5 vCPU, 1 GB)    | ~$10            |
| - ML (Python - 1 vCPU, 2 GB)          | Min: 0, Max: 1 (on-demand only)                   | ~$5              | Min: 0, Max: 3 (2 vCPU, 4 GB)      | ~$30            |
| **PostgreSQL**                        | **Azure DB for PostgreSQL - Single Server**       | $12              | Flexible Server B2s                | $50             |
|                                       | Burstable B1 (1 vCore, 2 GB, 32 GB storage)       |                  | (2 vCore, 4 GB, 64 GB)             |                 |
| **Redis**                             | **Skip - use in-memory cache**                    | $0               | Azure Cache for Redis - Basic C0   | $16             |
| **Blob Storage**                      | Standard LRS, Hot tier (~10 GB)                   | $1               | Standard LRS, Hot tier (~100 GB)   | $5              |
| **VPN Gateway**                       | **Skip - clients use public SSL endpoints**       | $0               | VpnGw1 (for on-prem clients)       | $150            |
| **Front Door**                        | **Skip - use Azure DNS + Container Apps ingress** | $0               | Front Door Standard + CDN          | $35             |
| **Key Vault**                         | Standard (1,000 operations/month)                 | $1               | Standard (10,000 operations/month) | $5              |
| **Application Insights**              | 1 GB logs/month (free tier)                       | $0               | 5 GB logs/month                    | $10             |
| **TOTAL**                             |                                                   | **~$57/month**   |                                    | **~$461/month** |

### Cost Optimization Strategies by Phase

**Phase 1: Bootstrap (0-10 tenants, $57/month)**

- ✅ Skip VPN Gateway - clients connect via **public SSL endpoints with IP whitelisting**
- ✅ Skip Front Door - use **Azure DNS + Container Apps built-in ingress** (supports wildcard SSL)
- ✅ Skip Redis - use **in-memory cache in NestJS** (switch to Redis at 20+ tenants)
- ✅ Scale to Zero - all Container Apps sleep when idle (save ~60% on compute)
- ✅ Use PostgreSQL Single Server Burstable B1 (cheaper than Flexible Server for low traffic)
- ✅ ML Service only runs on-demand (0 replicas when idle)

**Phase 2: Growth (10-50 tenants, $150-300/month)**

- Add Azure Cache for Redis (session management, job queues)
- Upgrade PostgreSQL to Flexible Server B2s
- Increase Container App min replicas to 1 for faster response times

**Phase 3: Scale (50+ tenants, $460+/month)**

- Add VPN Gateway for enterprise clients with on-prem databases
- Add Front Door for global CDN + WAF
- Implement Reserved Instances (1-year commit for 30-40% savings)

### Revenue vs. Cost Targets

| Tenants | Wells (avg) | Monthly Revenue (@$10/well) | Infrastructure Cost | Gross Margin |
| ------- | ----------- | --------------------------- | ------------------- | ------------ |
| 1-5     | 100         | $1,000                      | $57                 | 94%          |
| 10      | 200         | $2,000                      | $75                 | 96%          |
| 25      | 500         | $5,000                      | $150                | 97%          |
| 50      | 1,000       | $10,000                     | $300                | 97%          |
| 100     | 2,000       | $20,000                     | $600                | 97%          |

**Key Insight**: Even at minimal scale (5 tenants, 100 wells = $1,000/month), you're profitable with 94% margin.

---

## Disaster Recovery & High Availability

### Backup Strategy

```yaml
Master Database:
  - Automated backups: Daily (7-day retention)
  - Geo-redundant backups: Enabled (paired region: West US 2)
  - Point-in-time restore: Up to 7 days

Tenant Databases:
  - Responsibility: Client (they own the database)
  - WellPulse provides backup scripts/guidance

Blob Storage:
  - Geo-redundant storage (GRS): Optional for critical data
  - Soft delete: 30-day retention for accidental deletions
```

### High Availability (HA)

```yaml
Container Apps:
  - Multi-replica deployments (min 1, max 10)
  - Automatic health checks and restarts
  - Blue-green deployments for zero downtime

Master Database:
  - High Availability: Zone-redundant (upgrade from Burstable to General Purpose)
  - Failover: Automatic (<1 minute RTO)

Redis:
  - Standard tier: Geo-replication (optional)

Front Door:
  - Built-in global redundancy
```

**RTO (Recovery Time Objective)**: <5 minutes
**RPO (Recovery Point Objective)**: <1 hour (based on backup frequency)

---

## Infrastructure as Code (IaC)

**Recommendation**: Use **Azure Bicep** (Azure-native IaC, simpler than Terraform for Azure-only deployments).

```bicep
// main.bicep - Deploy entire WellPulse infrastructure
param location string = 'eastus2'
param environment string = 'prod'

module containerApps 'modules/container-apps.bicep' = {
  name: 'wellpulse-container-apps'
  params: {
    location: location
    environment: environment
  }
}

module database 'modules/postgresql.bicep' = {
  name: 'wellpulse-database'
  params: {
    location: location
    administratorLogin: 'wellpulse_admin'
    administratorPassword: keyVault.getSecret('POSTGRES-ADMIN-PASSWORD')
  }
}

module storage 'modules/blob-storage.bicep' = {
  name: 'wellpulse-storage'
  params: {
    location: location
    sku: 'Standard_LRS'
  }
}

// ... more modules for Redis, VPN Gateway, Front Door, etc.
```

**Deployment**: `az deployment group create --resource-group wellpulse-prod --template-file main.bicep`

---

## Railway Staging/PR Environment Strategy

**Purpose**: Fast iteration, ephemeral PR previews for code review.

### Staging Environment (Persistent)

```yaml
Railway Project: wellpulse-staging
Services:
  - wellpulse-api (main branch)
  - wellpulse-web (main branch)
  - wellpulse-ml (main branch)
  - PostgreSQL (Railway-managed)
  - Redis (Railway-managed)

Auto-Deploy: On push to main branch
URL: https://staging.wellpulse.io
```

### PR Preview Environments (Ephemeral)

```yaml
Railway PR Deployments: Enabled
Trigger: On pull request creation
Lifecycle: Auto-deleted after PR merge/close
URL: https://pr-{number}.wellpulse.io

Example:
  PR #42 → https://pr-42.wellpulse.io
  - Deploys all services (API, Web, ML, DB, Redis)
  - Isolated environment for testing
  - Automatically deleted when PR is merged
```

**Cost**: Railway Pro ($20/month) supports unlimited PR deployments. Perfect for fast development iteration before production merge.

---

## Tenant Onboarding Flow

### Step 1: Create Tenant Record (Master DB)

```sql
INSERT INTO tenants (id, slug, name, database_url, region, status)
VALUES (
  'acmeoil-uuid',
  'acmeoil',
  'ACME Oil & Gas',
  'postgresql://user:pass@acmeoil-db.postgres.database.azure.com:5432/acmeoil_prod',
  'azure-east-us',
  'ACTIVE'
);
```

### Step 2: Client Provisions Database (Their Choice)

**Option A: Client uses Azure (Recommended)**

1. Client creates Azure PostgreSQL Flexible Server in their subscription
2. Client shares connection string with WellPulse (stored in Key Vault)
3. WellPulse establishes VNet peering or Private Link
4. WellPulse runs migrations: `pnpm --filter=api db:migrate --tenant=acmeoil`

**Option B: Client uses AWS RDS**

1. Client creates AWS RDS PostgreSQL instance
2. Client configures VPN or public endpoint with SSL
3. Client shares connection string
4. WellPulse runs migrations

**Option C: Client uses on-premises PostgreSQL**

1. Client provisions on-prem PostgreSQL
2. WellPulse configures Site-to-Site VPN via Azure VPN Gateway
3. Client whitelists WellPulse VPN IP ranges
4. WellPulse runs migrations

### Step 3: Test Connection

```bash
# Test tenant database connection
pnpm --filter=api db:test-connection --tenant=acmeoil

# Run migrations
pnpm --filter=api db:migrate --tenant=acmeoil

# Verify schema
pnpm --filter=api db:studio --tenant=acmeoil
```

### Step 4: DNS Configuration

```bash
# Add wildcard DNS record for tenant subdomain
acmeoil.wellpulse.io → Azure Front Door (CNAME)

# SSL certificate auto-provisioned by Front Door
```

### Step 5: Create Admin User

```sql
INSERT INTO tenant_users (id, tenant_id, email, password_hash, role)
VALUES (
  'user-uuid',
  'acmeoil-uuid',
  'admin@acmeoil.com',
  '$2b$...',  -- bcrypt hash
  'ADMIN'
);
```

**Total Onboarding Time**: 30-60 minutes per tenant (mostly client database provisioning).

---

## Security Checklist

### Network Security

- [ ] All databases on private endpoints (no public access)
- [ ] VNet integration for Container Apps
- [ ] VPN Gateway for on-premises connections
- [ ] Front Door WAF enabled (OWASP Top 10)
- [ ] DDoS protection enabled

### Identity & Access

- [ ] Managed Identities for all Container Apps
- [ ] Secrets stored in Key Vault (never in code)
- [ ] Role-Based Access Control (RBAC) on all resources
- [ ] Multi-factor authentication for Azure portal access

### Data Protection

- [ ] SSL/TLS for all database connections
- [ ] Encryption at rest for Blob Storage
- [ ] SAS tokens with expiration for blob access
- [ ] Soft delete enabled (30-day retention)

### Compliance & Auditing

- [ ] Audit logging enabled (Azure Monitor)
- [ ] Log retention: 30+ days
- [ ] Compliance certifications: SOC 2, ISO 27001 (Azure built-in)
- [ ] Regular vulnerability scanning (Azure Security Center)

---

## Next Steps

1. **Create Azure Subscription** (if not already created)
2. **Provision Resource Group**: `wellpulse-prod`
3. **Deploy Master Database** (PostgreSQL Flexible Server)
4. **Set up Key Vault** and store initial secrets
5. **Configure GitHub Actions** for CI/CD
6. **Deploy Container Apps** (API, Web, ML)
7. **Configure Front Door** for wildcard subdomain routing
8. **Test with 1 pilot tenant** (ideally Azure-based for simplicity)
9. **Document onboarding process** for sales team

---

## Related Documentation

- [Database-Per-Tenant Multi-Tenancy Pattern](../patterns/XX-Database-Per-Tenant-Multi-Tenancy-Pattern.md)
- [Offline Batch Sync Pattern](../patterns/XX-Offline-Batch-Sync-Pattern.md)
- [Conflict Resolution Pattern](../patterns/XX-Conflict-Resolution-Pattern.md)
- [Permian Basin Market Research](../research/01-permian-basin-market-research.md)
- [Architecture Feedback](../research/02-architecture-feedback.md)

---

**Questions or Clarifications?** Contact: [your-email@wellpulse.io]
