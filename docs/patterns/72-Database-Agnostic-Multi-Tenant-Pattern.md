# Database-Agnostic Multi-Tenant Pattern

**Category**: Architecture Pattern
**Complexity**: Advanced
**Status**: ✅ Production Ready
**Related Patterns**: Adapter Pattern, Repository Pattern, ETL Pattern, Anti-Corruption Layer
**Industry Context**: Oil & Gas Field Data Management

---

## Overview

The Database-Agnostic Multi-Tenant Pattern extends the Database-Per-Tenant architecture to support **any database technology** (PostgreSQL, SQL Server, MySQL, Oracle, etc.) through a flexible abstraction layer. This is critical for WellPulse because oil & gas operators often have:

1. **Existing databases** they can't (or won't) migrate from
2. **Preference for specific vendors** (Microsoft SQL Server in Windows-heavy environments)
3. **Legacy systems** that must stay operational during WellPulse adoption
4. **Corporate standards** mandating specific database platforms

**Key Principle**: PostgreSQL is the default and preferred option (simplest, fastest), but WellPulse can adapt to client requirements through three strategies:

1. **Native Support** (PostgreSQL only - 80% of clients)
2. **Adapter Layer** (Direct connection to SQL Server, MySQL, Oracle - 15% of clients)
3. **ETL Sync** (Read-only sync from any database - 5% of clients)

---

## The Problem

**Scenario**: WellPulse onboards Texas Energy Co., a mid-sized operator who:
- Has 10 years of production data in **Microsoft SQL Server**
- Uses SQL Server Analysis Services for reporting
- IT team experienced with SQL Server, unfamiliar with PostgreSQL
- Wants to keep SQL Server as their source of truth

**Current Architecture Limitation**:
```typescript
// Drizzle ORM is PostgreSQL-specific
const db = drizzle(pool); // Only works with PostgreSQL
await db.select().from(wellsTable).where(...); // PostgreSQL syntax
```

**Challenge**: How do we support SQL Server without rewriting the entire application?

---

## The Solution: Three-Tier Strategy

### Tier 1: Native PostgreSQL (Default - 80% of clients)

**For**: Small/medium clients with no existing database

**Approach**: WellPulse provisions PostgreSQL, handles all setup

**Implementation**: No changes needed (current architecture works as-is)

**Advantages**:
- ✅ Zero complexity
- ✅ Fastest performance (direct Drizzle ORM queries)
- ✅ Full feature support (ML, real-time sync, etc.)
- ✅ Lowest cost ($30-50/month for managed PostgreSQL)

---

### Tier 2: Adapter Layer (15% of clients)

**For**: Clients with SQL Server, MySQL, or Oracle who want native integration

**Approach**: Implement database-specific adapters behind a common interface

**Architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                     WellPulse API                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │        Repository Interface (Database-Agnostic)     │   │
│  │  IWellRepository, IProductionRepository, etc.       │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Repository Factory (Strategy)             │   │
│  │  - Detects tenant database type                     │   │
│  │  - Returns appropriate adapter                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  ┌────────┬────────────┬────────────┬──────────────────┐   │
│  │ Postgres│ SQL Server │   MySQL    │     Oracle       │   │
│  │ Adapter │  Adapter   │  Adapter   │    Adapter       │   │
│  └────────┴────────────┴────────────┴──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
     ↓           ↓            ↓              ↓
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│PostgreSQL│ │SQL Server│ │  MySQL   │ │  Oracle  │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

**Implementation**:

#### 1. Database-Agnostic Repository Interface

```typescript
// apps/api/src/domain/repositories/well.repository.interface.ts
export interface IWellRepository {
  findById(tenantId: string, wellId: string): Promise<Well | null>;
  findAll(tenantId: string, filters?: WellFilters): Promise<Well[]>;
  findByApiNumber(tenantId: string, apiNumber: string): Promise<Well | null>;
  save(tenantId: string, well: Well): Promise<void>;
  delete(tenantId: string, wellId: string): Promise<void>;
  count(tenantId: string): Promise<number>;
}

export interface WellFilters {
  status?: 'ACTIVE' | 'INACTIVE' | 'PLUGGED';
  lease?: string;
  createdAfter?: Date;
  limit?: number;
  offset?: number;
}
```

#### 2. PostgreSQL Adapter (Default)

```typescript
// apps/api/src/infrastructure/database/adapters/postgres/postgres-well.repository.ts
import { Injectable } from '@nestjs/common';
import { IWellRepository } from '@/domain/repositories/well.repository.interface';
import { Well } from '@/domain/wells/well.entity';
import { TenantDatabaseService } from '../../services/tenant-database.service';
import { wellsTable } from '../../schema/tenant/wells.schema';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class PostgresWellRepository implements IWellRepository {
  constructor(private readonly tenantDbService: TenantDatabaseService) {}

  async findById(tenantId: string, wellId: string): Promise<Well | null> {
    const db = await this.tenantDbService.getTenantDatabase(tenantId);

    const results = await db
      .select()
      .from(wellsTable)
      .where(
        and(
          eq(wellsTable.id, wellId),
          eq(wellsTable.deletedAt, null)
        )
      )
      .limit(1);

    return results[0] ? this.toDomain(results[0]) : null;
  }

  async findAll(tenantId: string, filters?: WellFilters): Promise<Well[]> {
    const db = await this.tenantDbService.getTenantDatabase(tenantId);

    let query = db.select().from(wellsTable).where(eq(wellsTable.deletedAt, null));

    if (filters?.status) {
      query = query.where(eq(wellsTable.status, filters.status));
    }

    if (filters?.lease) {
      query = query.where(eq(wellsTable.lease, filters.lease));
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    const results = await query;
    return results.map(this.toDomain);
  }

  async save(tenantId: string, well: Well): Promise<void> {
    const db = await this.tenantDbService.getTenantDatabase(tenantId);
    const data = this.toPersistence(well);

    await db.insert(wellsTable).values(data).onConflictDoUpdate({
      target: wellsTable.id,
      set: data,
    });
  }

  async delete(tenantId: string, wellId: string): Promise<void> {
    const db = await this.tenantDbService.getTenantDatabase(tenantId);

    await db
      .update(wellsTable)
      .set({ deletedAt: new Date() })
      .where(eq(wellsTable.id, wellId));
  }

  async count(tenantId: string): Promise<number> {
    const db = await this.tenantDbService.getTenantDatabase(tenantId);

    const results = await db
      .select({ count: sql<number>`count(*)` })
      .from(wellsTable)
      .where(eq(wellsTable.deletedAt, null));

    return results[0].count;
  }

  private toDomain(row: any): Well {
    return Well.create(
      {
        name: row.name,
        apiNumber: row.api_number,
        location: { latitude: row.latitude, longitude: row.longitude },
        status: row.status,
        lease: row.lease,
        createdAt: row.created_at,
      },
      row.id
    );
  }

  private toPersistence(well: Well): any {
    return {
      id: well.id,
      name: well.name,
      api_number: well.apiNumber,
      latitude: well.location.latitude,
      longitude: well.location.longitude,
      status: well.status,
      lease: well.lease,
      created_at: well.createdAt,
      updated_at: new Date(),
    };
  }
}
```

#### 3. SQL Server Adapter

```typescript
// apps/api/src/infrastructure/database/adapters/sqlserver/sqlserver-well.repository.ts
import { Injectable } from '@nestjs/common';
import { IWellRepository } from '@/domain/repositories/well.repository.interface';
import { Well } from '@/domain/wells/well.entity';
import * as mssql from 'mssql';
import { TenantDatabaseService } from '../../services/tenant-database.service';

@Injectable()
export class SqlServerWellRepository implements IWellRepository {
  constructor(private readonly tenantDbService: TenantDatabaseService) {}

  async findById(tenantId: string, wellId: string): Promise<Well | null> {
    const pool = await this.tenantDbService.getSqlServerPool(tenantId);

    const result = await pool
      .request()
      .input('wellId', mssql.VarChar, wellId)
      .query(`
        SELECT id, name, api_number, latitude, longitude, status, lease, created_at
        FROM wells
        WHERE id = @wellId AND deleted_at IS NULL
      `);

    return result.recordset[0] ? this.toDomain(result.recordset[0]) : null;
  }

  async findAll(tenantId: string, filters?: WellFilters): Promise<Well[]> {
    const pool = await this.tenantDbService.getSqlServerPool(tenantId);

    let query = `
      SELECT id, name, api_number, latitude, longitude, status, lease, created_at
      FROM wells
      WHERE deleted_at IS NULL
    `;

    const request = pool.request();

    if (filters?.status) {
      query += ` AND status = @status`;
      request.input('status', mssql.VarChar, filters.status);
    }

    if (filters?.lease) {
      query += ` AND lease = @lease`;
      request.input('lease', mssql.VarChar, filters.lease);
    }

    if (filters?.limit) {
      query += ` ORDER BY created_at DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
      request.input('offset', mssql.Int, filters.offset || 0);
      request.input('limit', mssql.Int, filters.limit);
    }

    const result = await request.query(query);
    return result.recordset.map(this.toDomain);
  }

  async save(tenantId: string, well: Well): Promise<void> {
    const pool = await this.tenantDbService.getSqlServerPool(tenantId);

    await pool
      .request()
      .input('id', mssql.VarChar, well.id)
      .input('name', mssql.VarChar, well.name)
      .input('api_number', mssql.VarChar, well.apiNumber)
      .input('latitude', mssql.Float, well.location.latitude)
      .input('longitude', mssql.Float, well.location.longitude)
      .input('status', mssql.VarChar, well.status)
      .input('lease', mssql.VarChar, well.lease)
      .input('updated_at', mssql.DateTime, new Date())
      .query(`
        MERGE INTO wells AS target
        USING (SELECT @id AS id) AS source
        ON target.id = source.id
        WHEN MATCHED THEN
          UPDATE SET
            name = @name,
            api_number = @api_number,
            latitude = @latitude,
            longitude = @longitude,
            status = @status,
            lease = @lease,
            updated_at = @updated_at
        WHEN NOT MATCHED THEN
          INSERT (id, name, api_number, latitude, longitude, status, lease, created_at, updated_at)
          VALUES (@id, @name, @api_number, @latitude, @longitude, @status, @lease, GETDATE(), @updated_at);
      `);
  }

  async delete(tenantId: string, wellId: string): Promise<void> {
    const pool = await this.tenantDbService.getSqlServerPool(tenantId);

    await pool
      .request()
      .input('wellId', mssql.VarChar, wellId)
      .input('deletedAt', mssql.DateTime, new Date())
      .query(`
        UPDATE wells
        SET deleted_at = @deletedAt
        WHERE id = @wellId
      `);
  }

  async count(tenantId: string): Promise<number> {
    const pool = await this.tenantDbService.getSqlServerPool(tenantId);

    const result = await pool.request().query(`
      SELECT COUNT(*) as count
      FROM wells
      WHERE deleted_at IS NULL
    `);

    return result.recordset[0].count;
  }

  private toDomain(row: any): Well {
    return Well.create(
      {
        name: row.name,
        apiNumber: row.api_number,
        location: { latitude: row.latitude, longitude: row.longitude },
        status: row.status,
        lease: row.lease,
        createdAt: row.created_at,
      },
      row.id
    );
  }
}
```

#### 4. Repository Factory (Strategy Pattern)

```typescript
// apps/api/src/infrastructure/database/factories/repository.factory.ts
import { Injectable } from '@nestjs/common';
import { IWellRepository } from '@/domain/repositories/well.repository.interface';
import { PostgresWellRepository } from '../adapters/postgres/postgres-well.repository';
import { SqlServerWellRepository } from '../adapters/sqlserver/sqlserver-well.repository';
import { MySqlWellRepository } from '../adapters/mysql/mysql-well.repository';
import { TenantConfigService } from '../services/tenant-config.service';

@Injectable()
export class RepositoryFactory {
  constructor(
    private readonly tenantConfigService: TenantConfigService,
    private readonly postgresWellRepo: PostgresWellRepository,
    private readonly sqlServerWellRepo: SqlServerWellRepository,
    private readonly mysqlWellRepo: MySqlWellRepository,
  ) {}

  async getWellRepository(tenantId: string): Promise<IWellRepository> {
    const tenant = await this.tenantConfigService.getTenantById(tenantId);

    switch (tenant.databaseType) {
      case 'POSTGRESQL':
        return this.postgresWellRepo;

      case 'SQL_SERVER':
        return this.sqlServerWellRepo;

      case 'MYSQL':
        return this.mysqlWellRepo;

      case 'ORACLE':
        // return this.oracleWellRepo; // Future

      default:
        throw new Error(`Unsupported database type: ${tenant.databaseType}`);
    }
  }

  // Repeat for other repositories: getProductionRepository(), getEquipmentRepository(), etc.
}
```

#### 5. Usage in Application Layer (CQRS Handler)

```typescript
// apps/api/src/application/wells/queries/get-well-by-id.handler.ts
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { GetWellByIdQuery } from './get-well-by-id.query';
import { Well } from '@/domain/wells/well.entity';
import { RepositoryFactory } from '@/infrastructure/database/factories/repository.factory';

@QueryHandler(GetWellByIdQuery)
export class GetWellByIdHandler implements IQueryHandler<GetWellByIdQuery> {
  constructor(private readonly repoFactory: RepositoryFactory) {}

  async execute(query: GetWellByIdQuery): Promise<Well | null> {
    const { tenantId, wellId } = query;

    // Factory returns correct adapter based on tenant's database type
    const wellRepository = await this.repoFactory.getWellRepository(tenantId);

    return await wellRepository.findById(tenantId, wellId);
  }
}
```

**Advantages**:
- ✅ Native performance (direct database queries)
- ✅ Client keeps their preferred database
- ✅ No data duplication
- ✅ Real-time data access

**Disadvantages**:
- ❌ High complexity (4+ implementations per repository)
- ❌ Limited to SQL databases with similar schemas
- ❌ SQL syntax differences (migrations challenging)
- ❌ Testing burden (test against multiple databases)

**Pricing**: Enterprise tier (+$500/month) for SQL Server, MySQL, Oracle support

---

### Tier 3: ETL Sync Layer (5% of clients)

**For**: Clients with proprietary databases, legacy systems, or incompatible schemas

**Approach**: Sync data from client's database to WellPulse PostgreSQL (read-only), field data entries go to PostgreSQL

**Architecture**:

```
┌───────────────────────────────────────────────────────────────┐
│           Client's Source System                              │
│   (Any database: SQL Server, Oracle, MySQL, Proprietary)     │
│   - wells_table (custom schema)                              │
│   - production_records (custom schema)                        │
│   - equipment_master (custom schema)                          │
└──────────────────┬────────────────────────────────────────────┘
                   │ ETL Sync (every 15 min)
                   ↓
┌───────────────────────────────────────────────────────────────┐
│         WellPulse PostgreSQL (Read + Write)                   │
├───────────────────────────────────────────────────────────────┤
│  Synced from Client (Read-Only):                             │
│  - wells (mapped from client schema)                         │
│  - production_data (mapped from client schema)               │
│  - equipment (mapped from client schema)                     │
│                                                                │
│  WellPulse-Native (Read/Write):                              │
│  - field_events (offline sync from Electron/Mobile)          │
│  - ml_predictions                                             │
│  - alerts                                                      │
└───────────────────────────────────────────────────────────────┘
                   ↑
           WellPulse API reads here
```

**Implementation**:

#### 1. ETL Configuration Schema

```typescript
// apps/api/src/infrastructure/database/schema/master/tenants.schema.ts
export const tenants = pgTable('tenants', {
  // ... existing fields
  databaseType: varchar('database_type', { length: 50 }).notNull(),
    // "POSTGRESQL" | "SQL_SERVER" | "MYSQL" | "ORACLE" | "ETL_SYNCED"

  etlConfig: jsonb('etl_config'), // Only for ETL_SYNCED tenants
    // {
    //   sourceType: "SQL_SERVER" | "ORACLE" | "MYSQL" | "CUSTOM",
    //   sourceConnection: "connection string",
    //   syncInterval: 15, // minutes
    //   schemaMapping: { ... }, // How to map client schema to WellPulse schema
    //   lastSyncedAt: "2025-10-23T14:30:00Z"
    // }
});
```

#### 2. Schema Mapping Configuration

```json
{
  "sourceType": "SQL_SERVER",
  "sourceConnection": "Server=client-sql-server;Database=production;User=readonly;Password=***",
  "syncInterval": 15,
  "schemaMapping": {
    "wells": {
      "sourceTable": "dbo.WellMaster",
      "columnMapping": {
        "id": "WellID",
        "name": "WellName",
        "api_number": "APINumber",
        "latitude": "Latitude",
        "longitude": "Longitude",
        "status": "Status",
        "lease": "LeaseName"
      },
      "transforms": {
        "status": {
          "type": "MAP",
          "mapping": {
            "Active": "ACTIVE",
            "Shut-In": "INACTIVE",
            "P&A": "PLUGGED"
          }
        }
      }
    },
    "production_data": {
      "sourceTable": "dbo.ProductionRecords",
      "columnMapping": {
        "id": "RecordID",
        "well_id": "WellID",
        "date": "ProductionDate",
        "oil": "OilVolume",
        "gas": "GasVolume",
        "water": "WaterVolume"
      }
    }
  }
}
```

#### 3. ETL Sync Service

```typescript
// apps/api/src/infrastructure/etl/etl-sync.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { TenantConfigService } from '../database/services/tenant-config.service';
import { TenantDatabaseService } from '../database/services/tenant-database.service';
import * as mssql from 'mssql';

@Injectable()
export class EtlSyncService {
  private readonly logger = new Logger(EtlSyncService.name);

  constructor(
    private readonly tenantConfigService: TenantConfigService,
    private readonly tenantDbService: TenantDatabaseService,
  ) {}

  async syncTenant(tenantId: string): Promise<void> {
    const tenant = await this.tenantConfigService.getTenantById(tenantId);

    if (tenant.databaseType !== 'ETL_SYNCED') {
      return; // Only sync ETL tenants
    }

    this.logger.log(`Starting ETL sync for tenant: ${tenant.slug}`);

    const startTime = Date.now();

    try {
      // Connect to client's source database
      const sourceDb = await this.connectToSourceDatabase(tenant.etlConfig);

      // Connect to WellPulse PostgreSQL database
      const targetDb = await this.tenantDbService.getTenantDatabase(tenantId);

      // Sync each entity
      await this.syncWells(sourceDb, targetDb, tenant.etlConfig.schemaMapping.wells);
      await this.syncProductionData(sourceDb, targetDb, tenant.etlConfig.schemaMapping.production_data);
      await this.syncEquipment(sourceDb, targetDb, tenant.etlConfig.schemaMapping.equipment);

      // Update last synced timestamp
      await this.tenantConfigService.updateLastSyncedAt(tenantId, new Date());

      const duration = Date.now() - startTime;
      this.logger.log(`ETL sync completed for ${tenant.slug} in ${duration}ms`);
    } catch (error) {
      this.logger.error(`ETL sync failed for ${tenant.slug}:`, error);
      throw error;
    }
  }

  private async connectToSourceDatabase(etlConfig: any): Promise<any> {
    switch (etlConfig.sourceType) {
      case 'SQL_SERVER':
        return await mssql.connect(etlConfig.sourceConnection);
      case 'MYSQL':
        // return await mysql.createConnection(etlConfig.sourceConnection);
      case 'ORACLE':
        // return await oracledb.getConnection(etlConfig.sourceConnection);
      default:
        throw new Error(`Unsupported source type: ${etlConfig.sourceType}`);
    }
  }

  private async syncWells(sourceDb: any, targetDb: any, mapping: any): Promise<void> {
    // Extract from source
    const sourceWells = await sourceDb.request().query(`SELECT * FROM ${mapping.sourceTable}`);

    // Transform to WellPulse schema
    const transformedWells = sourceWells.recordset.map((row) => {
      return {
        id: row[mapping.columnMapping.id],
        name: row[mapping.columnMapping.name],
        api_number: row[mapping.columnMapping.api_number],
        latitude: row[mapping.columnMapping.latitude],
        longitude: row[mapping.columnMapping.longitude],
        status: this.transformValue(row[mapping.columnMapping.status], mapping.transforms?.status),
        lease: row[mapping.columnMapping.lease],
        updated_at: new Date(),
      };
    });

    // Load into WellPulse PostgreSQL (upsert)
    for (const well of transformedWells) {
      await targetDb
        .insert(wellsTable)
        .values(well)
        .onConflictDoUpdate({
          target: wellsTable.id,
          set: well,
        });
    }

    this.logger.log(`Synced ${transformedWells.length} wells`);
  }

  private async syncProductionData(sourceDb: any, targetDb: any, mapping: any): Promise<void> {
    // Similar to syncWells, but for production data
    // Only sync last 90 days (avoid syncing entire history every time)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    const query = `
      SELECT * FROM ${mapping.sourceTable}
      WHERE ${mapping.columnMapping.date} >= @cutoffDate
    `;

    // ... extract, transform, load
  }

  private transformValue(value: any, transform: any): any {
    if (!transform) return value;

    switch (transform.type) {
      case 'MAP':
        return transform.mapping[value] || value;
      case 'UPPERCASE':
        return value?.toUpperCase();
      case 'LOWERCASE':
        return value?.toLowerCase();
      default:
        return value;
    }
  }
}
```

#### 4. Scheduled ETL Job (Bull Queue)

```typescript
// apps/api/src/infrastructure/etl/etl-sync.processor.ts
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { EtlSyncService } from './etl-sync.service';

@Processor('etl-sync')
export class EtlSyncProcessor {
  constructor(private readonly etlSyncService: EtlSyncService) {}

  @Process('sync-tenant')
  async syncTenant(job: Job<{ tenantId: string }>): Promise<void> {
    await this.etlSyncService.syncTenant(job.data.tenantId);
  }
}

// Schedule ETL sync every 15 minutes for each ETL tenant
@Injectable()
export class EtlSyncScheduler {
  constructor(
    @InjectQueue('etl-sync') private readonly etlQueue: Queue,
    private readonly tenantConfigService: TenantConfigService,
  ) {}

  @Cron('*/15 * * * *') // Every 15 minutes
  async scheduleEtlSync() {
    const etlTenants = await this.tenantConfigService.getEtlTenants();

    for (const tenant of etlTenants) {
      await this.etlQueue.add('sync-tenant', { tenantId: tenant.id });
    }
  }
}
```

**Advantages**:
- ✅ Works with **any** database (even proprietary systems)
- ✅ WellPulse still uses PostgreSQL only (simple codebase)
- ✅ No client migration required
- ✅ Can sync from multiple source systems simultaneously

**Disadvantages**:
- ❌ Data lag (15-60 minutes depending on sync interval)
- ❌ ETL configuration complexity (schema mapping)
- ❌ Potential conflicts if client modifies data directly
- ❌ Requires read-only access to client database

**Pricing**: Enterprise tier (+$1,000/month) for ETL sync setup + ongoing maintenance

---

## Integration with External Systems

Beyond databases, oil & gas operators use various specialized software systems that may need integration:

### Common O&G Software Systems

| System Type | Examples | Integration Strategy |
|-------------|----------|---------------------|
| **SCADA** (Supervisory Control and Data Acquisition) | Emerson DeltaV, Schneider Electric, Rockwell Automation | ETL sync (read sensor data every 5 min) |
| **Production Accounting** | PHDWin, OGsys, Quorum | ETL sync (read production allocations daily) |
| **Land Management** | Quorum LandWorks, P2 BOLO, TrakTech | ETL sync (well ownership, leases) |
| **GIS (Geographic Information Systems)** | Esri ArcGIS, MapInfo | API integration (geocoding, mapping) |
| **LIMS (Laboratory Information Management)** | LabWare, Thermo Fisher | ETL sync (oil/gas/water analysis results) |
| **ERP** (Enterprise Resource Planning) | SAP, Oracle, Microsoft Dynamics | ETL sync (cost data, invoices) |
| **Regulatory Reporting** | Texas RRC, New Mexico OCD | API integration (submit compliance reports) |

### Integration Pattern for External Systems

```typescript
// apps/api/src/infrastructure/integrations/integration.service.ts
import { Injectable } from '@nestjs/common';

export interface IIntegrationAdapter {
  fetchData(config: any): Promise<any>;
  testConnection(config: any): Promise<boolean>;
  getLastSyncTime(): Promise<Date | null>;
}

@Injectable()
export class IntegrationService {
  private adapters: Map<string, IIntegrationAdapter> = new Map();

  constructor() {
    // Register adapters
    this.adapters.set('SCADA_EMERSON', new EmersonScadaAdapter());
    this.adapters.set('PRODUCTION_PHDWIN', new PhdwinAdapter());
    this.adapters.set('GIS_ARCGIS', new ArcGisAdapter());
    // ... more adapters
  }

  async syncExternalSystem(tenantId: string, systemType: string): Promise<void> {
    const adapter = this.adapters.get(systemType);

    if (!adapter) {
      throw new Error(`No adapter found for system type: ${systemType}`);
    }

    const integrationConfig = await this.getIntegrationConfig(tenantId, systemType);

    // Fetch data from external system
    const externalData = await adapter.fetchData(integrationConfig);

    // Transform and load into WellPulse
    await this.loadDataIntoWellPulse(tenantId, externalData);
  }
}
```

**Example: SCADA Integration**

```typescript
// apps/api/src/infrastructure/integrations/adapters/scada-emerson.adapter.ts
import { IIntegrationAdapter } from '../integration.service';
import axios from 'axios';

export class EmersonScadaAdapter implements IIntegrationAdapter {
  async fetchData(config: any): Promise<any> {
    // Connect to Emerson DeltaV OPC UA server
    const response = await axios.post(config.opcUaEndpoint, {
      nodes: config.sensorNodeIds, // Temperature, pressure, flow rate sensors
      startTime: config.lastSyncTime,
      endTime: new Date(),
    });

    return response.data.values; // Time-series sensor data
  }

  async testConnection(config: any): Promise<boolean> {
    try {
      await axios.get(`${config.opcUaEndpoint}/health`);
      return true;
    } catch {
      return false;
    }
  }

  async getLastSyncTime(): Promise<Date | null> {
    // Retrieve from database
    return null;
  }
}
```

---

## Decision Matrix: Which Strategy to Use?

| Client Scenario | Recommended Strategy | Reason |
|----------------|---------------------|---------|
| New client, no existing database | **Tier 1: PostgreSQL** | Simplest, fastest, cheapest |
| Has SQL Server, willing to migrate | **Tier 1: PostgreSQL** + migration assistance | Long-term simplicity |
| Has SQL Server, refuses to migrate, similar schema | **Tier 2: Adapter** | Native performance, real-time |
| Has Oracle/MySQL, similar schema | **Tier 2: Adapter** | Native performance, real-time |
| Has proprietary/incompatible database | **Tier 3: ETL Sync** | Only option for custom schemas |
| Uses SCADA/production accounting software | **Tier 3: ETL Sync** | Read-only external system integration |
| Legacy system must stay operational | **Tier 3: ETL Sync** | No disruption to existing system |

---

## Implementation Roadmap

### Phase 1: MVP (Months 1-3)
- ✅ Tier 1: PostgreSQL support only (80% of clients)
- ✅ Offer PostgreSQL provisioning as part of onboarding

### Phase 2: Enterprise Features (Months 4-6)
- ✅ Tier 2: SQL Server adapter (most common request)
- ✅ Tier 3: ETL sync framework (generic)
- ✅ SCADA integration (high value for clients)

### Phase 3: Full Multi-Database (Months 7-12)
- ✅ Tier 2: MySQL, Oracle adapters
- ✅ Tier 3: Pre-built adapters for PHDWin, OGsys, Quorum
- ✅ Tier 3: GIS integration (ArcGIS, MapInfo)

---

## Testing Strategy

### Unit Tests
- Mock database adapters
- Test schema mapping transformations
- Test ETL sync logic with sample data

### Integration Tests
- Test PostgreSQL adapter (primary)
- Test SQL Server adapter with real SQL Server (Docker)
- Test MySQL adapter with real MySQL (Docker)
- Test ETL sync with sample source database

### E2E Tests
- Create test tenant for each database type
- Run full application workflows (auth, production entry, sync)
- Verify data consistency across adapters

---

## Pricing Recommendations

| Tier | Database Support | Price/Month |
|------|-----------------|-------------|
| **Starter** | WellPulse-managed PostgreSQL (Azure) | $99 |
| **Professional** | Client-managed PostgreSQL (Azure/AWS/on-prem) | $299 |
| **Enterprise** | SQL Server, MySQL via Adapter | $999 |
| **Enterprise Plus** | ETL sync from any database + external systems | $1,999 |

**Custom Integrations**: $5,000-$25,000 one-time setup fee for proprietary systems

---

## Related Documentation

- [Database-Per-Tenant Multi-Tenancy Pattern](./69-Database-Per-Tenant-Multi-Tenancy-Pattern.md)
- [Anti-Corruption Layer Pattern](./XX-Anti-Corruption-Layer-Pattern.md)
- [Adapter Pattern](./XX-Adapter-Pattern.md)
- [ETL Pattern](./XX-ETL-Pattern.md)

---

**Summary**: PostgreSQL is the default and recommended option (80% of clients). For the 20% who need something else, we provide Adapter Layer (native performance) or ETL Sync (maximum flexibility) as Enterprise tier features.
