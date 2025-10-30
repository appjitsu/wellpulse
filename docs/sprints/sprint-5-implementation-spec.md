# Sprint 5 Implementation Specification

**Sprint Duration:** 7 weeks (Split into 3 phases)
**Start Date:** November 5, 2025
**Target Completion:** December 20, 2025
**Theme:** Enterprise Readiness - SCADA, Compliance, Production Accounting

---

## Product Owner Decisions (Finalized)

### ✅ SMS Provider
**Decision:** Azure Communication Services
**Rationale:** Already using Azure for hosting, single vendor billing, SMS + Email unified
**Implementation:** `@azure/communication-sms` package

### ✅ Commodity Pricing API
**Decision:** Energy Information Administration (EIA) API
**Source:** https://www.eia.gov/opendata/
**Pricing:** FREE for up to 5,000 requests/day
**Coverage:**
- WTI Crude Oil spot price (Cushing, OK)
- Natural gas spot price (Henry Hub, LA)
- Historical data back to 1986
- Daily updates

**Implementation:**
```typescript
// EIA API client
const EIA_API_KEY = process.env.EIA_API_KEY; // Register at eia.gov
const EIA_BASE_URL = 'https://api.eia.gov/v2';

async function getCurrentOilPrice(): Promise<number> {
  const response = await axios.get(`${EIA_BASE_URL}/petroleum/pri/spt/data/`, {
    params: {
      api_key: EIA_API_KEY,
      frequency: 'daily',
      data: ['value'],
      facets: { series: ['RWTC'] }, // WTI Cushing spot price
      sort: [{ column: 'period', direction: 'desc' }],
      length: 1,
    },
  });

  return response.data.response.data[0].value; // $/barrel
}

async function getCurrentGasPrice(): Promise<number> {
  // Henry Hub natural gas spot price
  // Series ID: NG.RNGWHHD.D ($/MMBtu)
}
```

**Background Job:** Update prices daily at 6 AM CT (after EIA publishes)

**Fallback:** Manual price entry by tenant admins if API unavailable

### ✅ Report Branding
**Decision:** White-label reports with company info and logo per tenant
**Implementation:**
- Add `logo_url` and `branding_config` (JSONB) to `tenants` table
- Logo upload via Azure Blob Storage
- PDF templates use tenant logo + colors
- Configurable header/footer text

**Example PDF Header:**
```
┌──────────────────────────────────────────────────┐
│  [ACME OIL COMPANY LOGO]                         │
│  123 Main Street, Midland, TX 79701              │
│  Phone: (432) 555-1234 | www.acmeoil.com         │
└──────────────────────────────────────────────────┘

         RRC FORM 1 - OIL WELL POTENTIAL TEST
                  Generated: Oct 29, 2025
```

### ✅ SCADA Integration Priority
**Decision:** Ready for implementation, Phase 1 = OPC-UA protocol
**Architecture:**
```
Well Site (Edge)                    WellPulse Cloud
├── RTU/PLC                    →    ScadaIngestionService
│   ├── Pressure Sensor             ├── OPC-UA Client
│   ├── Temperature Sensor          ├── Tag Subscriptions
│   └── Flow Meter                  ├── Data Transformation
├── OPC-UA Server                   └── Auto-Create FieldEntries
└── Network Gateway (VPN)                     ↓
                                         AlertService
                                    (Nominal Range Violations)
```

**Phased Rollout:**
- Sprint 5A: OPC-UA support (most common protocol)
- Sprint 6: Modbus TCP (older RTUs)
- Sprint 7: MQTT (IoT sensors)

**Connectivity Options:**
1. **VPN Gateway** (preferred) - Secure tunnel from well site to Azure
2. **Cellular Gateway** - 4G/5G modem at well site
3. **Satellite** (remote wells) - Higher latency but works anywhere

### ✅ Regulatory Forms
**Decision:** Texas RRC only for Sprint 5
**Forms to Support:**
1. **RRC Form 1** (Oil Well Potential Test) - CRITICAL
2. **RRC Form G-1** (Gas Well Potential Test) - CRITICAL
3. **RRC Form W-10** (Completion/Recompletion) - HIGH PRIORITY
4. **RRC Form P-4** (Producer's Monthly Report) - MEDIUM (similar to Form 1 but monthly)

**Future States:**
- Sprint 7+: New Mexico OCD
- Sprint 8+: Oklahoma OCC

### ✅ Mobile Offline Test Data
**Decision:** Generate test data offline (no backend calls)
**Rationale:** Field testing without connectivity, faster development iteration

**Implementation:**
```typescript
// apps/mobile/src/utils/test-data-generator.ts

export function generateTestProductionEntry(wellId: string): FieldEntry {
  return {
    id: uuid.v4(),
    wellId,
    entryType: 'PRODUCTION',
    date: new Date(),
    data: {
      oilVolume: Math.floor(Math.random() * 400) + 50, // 50-450 BBL
      gasVolume: Math.floor(Math.random() * 4500) + 500, // 500-5000 MCF
      waterVolume: Math.floor(Math.random() * 200) + 10, // 10-210 BBL
      runtime: 24,
      pressure: Math.floor(Math.random() * 500) + 100, // 100-600 PSI
      temperature: Math.floor(Math.random() * 40) + 80, // 80-120°F
    },
    deviceId: DeviceInfo.getUniqueId(),
    recordedAt: new Date().toISOString(),
    syncedAt: null,
    notes: 'Test data (generated offline)',
  };
}

// Usage in development mode
if (__DEV__) {
  const testEntry = generateTestProductionEntry(wellId);
  await localDatabase.insert('field_entries', testEntry);
}
```

**Test Data Menu:**
```
Settings → Developer Options (hidden, 7 taps on version number)
├── Generate Test Wells (10 wells)
├── Generate Test Production (100 entries)
├── Generate Test Alerts (20 alerts)
├── Simulate SCADA Data (real-time updates)
└── Clear All Test Data
```

---

## Sprint 5A: SCADA Integration + Interactive Map (3 weeks)

### Backend Tasks (80 hours)

#### 1. SCADA Infrastructure (48 hours)

**Install Dependencies:**
```bash
pnpm add node-opcua @azure/communication-sms
```

**Domain Entities:**
```typescript
// apps/api/src/domain/scada/scada-connection.entity.ts
export class ScadaConnection {
  id: string;
  wellId: string;
  protocol: 'OPC_UA' | 'MODBUS_TCP' | 'MQTT';
  endpointUrl: string;
  credentialsEncrypted: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  lastSyncAt: Date | null;
  errorMessage: string | null;

  static create(data: CreateScadaConnectionData): ScadaConnection {
    // Validate endpoint URL format
    // Encrypt credentials
    return new ScadaConnection(data);
  }

  connect(): void {
    this.status = 'CONNECTED';
    this.errorMessage = null;
    this.lastSyncAt = new Date();
  }

  disconnect(): void {
    this.status = 'DISCONNECTED';
  }

  fail(error: string): void {
    this.status = 'ERROR';
    this.errorMessage = error;
  }
}

// apps/api/src/domain/scada/scada-tag-mapping.entity.ts
export class ScadaTagMapping {
  id: string;
  connectionId: string;
  scadaTagName: string; // ns=2;s=WellPressure
  wellpulseField: string; // pressure_psi
  unitConversion: {
    from: string;
    to: string;
    multiplier: number;
  } | null;
  aggregationMethod: 'AVERAGE' | 'SUM' | 'LAST' | 'MIN' | 'MAX';
  sampleIntervalSeconds: number;

  transform(scadaValue: number): number {
    if (!this.unitConversion) return scadaValue;
    return scadaValue * this.unitConversion.multiplier;
  }
}
```

**Repository Interfaces:**
```typescript
// apps/api/src/domain/repositories/scada-connection.repository.interface.ts
export interface IScadaConnectionRepository {
  findById(tenantId: string, id: string): Promise<ScadaConnection | null>;
  findByWell(tenantId: string, wellId: string): Promise<ScadaConnection[]>;
  findAllActive(tenantId: string): Promise<ScadaConnection[]>;
  create(tenantId: string, connection: ScadaConnection): Promise<ScadaConnection>;
  update(tenantId: string, connection: ScadaConnection): Promise<void>;
  delete(tenantId: string, id: string): Promise<void>;
}

export interface IScadaTagMappingRepository {
  findByConnection(tenantId: string, connectionId: string): Promise<ScadaTagMapping[]>;
  create(tenantId: string, mapping: ScadaTagMapping): Promise<ScadaTagMapping>;
  update(tenantId: string, mapping: ScadaTagMapping): Promise<void>;
  delete(tenantId: string, id: string): Promise<void>;
}

export interface IScadaReadingRepository {
  create(tenantId: string, reading: ScadaReading): Promise<void>;
  findByConnection(
    tenantId: string,
    connectionId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ScadaReading[]>;
  aggregate(
    tenantId: string,
    connectionId: string,
    tagName: string,
    startDate: Date,
    endDate: Date,
    aggregationMethod: string
  ): Promise<{ timestamp: Date; value: number }[]>;
}
```

**CQRS Commands:**
```typescript
// apps/api/src/application/scada/commands/create-scada-connection.command.ts
export class CreateScadaConnectionCommand {
  constructor(
    public readonly tenantId: string,
    public readonly wellId: string,
    public readonly protocol: string,
    public readonly endpointUrl: string,
    public readonly username: string,
    public readonly password: string,
    public readonly createdBy: string
  ) {}
}

@CommandHandler(CreateScadaConnectionCommand)
export class CreateScadaConnectionHandler {
  async execute(command: CreateScadaConnectionCommand): Promise<string> {
    // Validate well exists
    const well = await this.wellRepository.findById(command.tenantId, command.wellId);
    if (!well) throw new NotFoundException('Well not found');

    // Encrypt credentials
    const credentialsEncrypted = await this.encryptionService.encrypt(
      JSON.stringify({ username: command.username, password: command.password })
    );

    // Create connection entity
    const connection = ScadaConnection.create({
      wellId: command.wellId,
      protocol: command.protocol as ScadaProtocol,
      endpointUrl: command.endpointUrl,
      credentialsEncrypted,
      status: 'DISCONNECTED',
    });

    // Save to repository
    await this.scadaConnectionRepository.create(command.tenantId, connection);

    // Test connection (async)
    await this.scadaIngestionService.testConnection(connection.id);

    return connection.id;
  }
}

// apps/api/src/application/scada/commands/create-tag-mapping.command.ts
export class CreateTagMappingCommand {
  constructor(
    public readonly tenantId: string,
    public readonly connectionId: string,
    public readonly scadaTagName: string,
    public readonly wellpulseField: string,
    public readonly unitConversion: { from: string; to: string; multiplier: number } | null,
    public readonly aggregationMethod: string,
    public readonly sampleIntervalSeconds: number
  ) {}
}
```

**CQRS Queries:**
```typescript
// apps/api/src/application/scada/queries/get-scada-connections.query.ts
export class GetScadaConnectionsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly wellId?: string
  ) {}
}

@QueryHandler(GetScadaConnectionsQuery)
export class GetScadaConnectionsHandler {
  async execute(query: GetScadaConnectionsQuery): Promise<ScadaConnectionDto[]> {
    const connections = query.wellId
      ? await this.scadaConnectionRepository.findByWell(query.tenantId, query.wellId)
      : await this.scadaConnectionRepository.findAllActive(query.tenantId);

    return connections.map(c => this.toDto(c));
  }
}

// apps/api/src/application/scada/queries/browse-opc-tags.query.ts
export class BrowseOpcTagsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly connectionId: string
  ) {}
}

@QueryHandler(BrowseOpcTagsQuery)
export class BrowseOpcTagsHandler {
  async execute(query: BrowseOpcTagsQuery): Promise<OpcTag[]> {
    const connection = await this.scadaConnectionRepository.findById(
      query.tenantId,
      query.connectionId
    );

    if (!connection) throw new NotFoundException('SCADA connection not found');

    // Connect to OPC-UA server and browse available tags
    const tags = await this.opcUaService.browseTags(connection);
    return tags;
  }
}
```

**Infrastructure: SCADA Ingestion Service:**
```typescript
// apps/api/src/infrastructure/services/scada-ingestion.service.ts
import {
  OPCUAClient,
  MessageSecurityMode,
  SecurityPolicy,
  AttributeIds,
  ClientSubscription,
  ClientMonitoredItem,
} from 'node-opcua';

@Injectable()
export class ScadaIngestionService implements OnModuleDestroy {
  private readonly logger = new Logger(ScadaIngestionService.name);
  private clients = new Map<string, OPCUAClient>();
  private subscriptions = new Map<string, ClientSubscription>();

  async connect(connection: ScadaConnection): Promise<void> {
    try {
      const credentials = this.decryptCredentials(connection.credentialsEncrypted);

      const client = OPCUAClient.create({
        applicationName: 'WellPulse SCADA Client',
        connectionStrategy: {
          initialDelay: 1000,
          maxRetry: 5,
          maxDelay: 10000,
        },
        securityMode: MessageSecurityMode.None, // Or configure based on connection settings
        securityPolicy: SecurityPolicy.None,
        endpointMustExist: false,
      });

      await client.connect(connection.endpointUrl);
      const session = await client.createSession({
        userName: credentials.username,
        password: credentials.password,
      });

      this.clients.set(connection.id, client);
      this.logger.log(`Connected to SCADA: ${connection.endpointUrl}`);

      // Create subscription for real-time monitoring
      await this.createSubscription(connection, session);

      // Update connection status
      connection.connect();
      await this.scadaConnectionRepository.update(connection.tenantId, connection);
    } catch (error) {
      this.logger.error(`Failed to connect to SCADA: ${error.message}`);
      connection.fail(error.message);
      await this.scadaConnectionRepository.update(connection.tenantId, connection);
      throw error;
    }
  }

  private async createSubscription(
    connection: ScadaConnection,
    session: any
  ): Promise<void> {
    const subscription = ClientSubscription.create(session, {
      requestedPublishingInterval: 1000, // 1 second
      requestedLifetimeCount: 100,
      requestedMaxKeepAliveCount: 10,
      maxNotificationsPerPublish: 100,
      publishingEnabled: true,
      priority: 10,
    });

    this.subscriptions.set(connection.id, subscription);

    // Subscribe to all mapped tags
    const mappings = await this.scadaTagMappingRepository.findByConnection(
      connection.tenantId,
      connection.id
    );

    for (const mapping of mappings) {
      const monitoredItem = ClientMonitoredItem.create(
        subscription,
        {
          nodeId: mapping.scadaTagName,
          attributeId: AttributeIds.Value,
        },
        {
          samplingInterval: mapping.sampleIntervalSeconds * 1000,
          discardOldest: true,
          queueSize: 10,
        }
      );

      monitoredItem.on('changed', async (dataValue) => {
        await this.handleTagValueChange(connection, mapping, dataValue);
      });
    }
  }

  private async handleTagValueChange(
    connection: ScadaConnection,
    mapping: ScadaTagMapping,
    dataValue: any
  ): Promise<void> {
    const rawValue = dataValue.value.value;
    const transformedValue = mapping.transform(rawValue);

    // Store raw reading
    await this.scadaReadingRepository.create(connection.tenantId, {
      connectionId: connection.id,
      tagName: mapping.scadaTagName,
      value: rawValue,
      unit: mapping.unitConversion?.from || 'unknown',
      timestamp: new Date(),
      quality: dataValue.statusCode.name,
    });

    // Check if we should create a field entry (hourly aggregation)
    const shouldCreateEntry = this.shouldAggregateToFieldEntry(
      mapping.sampleIntervalSeconds
    );

    if (shouldCreateEntry) {
      await this.createFieldEntryFromScada(connection, mapping, transformedValue);
    }

    // Check nominal range violations
    await this.checkNominalRangeViolation(
      connection.wellId,
      mapping.wellpulseField,
      transformedValue
    );
  }

  private async createFieldEntryFromScada(
    connection: ScadaConnection,
    mapping: ScadaTagMapping,
    value: number
  ): Promise<void> {
    // Get hourly aggregated readings
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 3600000); // 1 hour ago

    const aggregated = await this.scadaReadingRepository.aggregate(
      connection.tenantId,
      connection.id,
      mapping.scadaTagName,
      startDate,
      endDate,
      mapping.aggregationMethod
    );

    if (aggregated.length === 0) return;

    // Create field entry
    const fieldEntry = FieldEntry.createProduction({
      wellId: connection.wellId,
      date: new Date(),
      data: {
        [mapping.wellpulseField]: aggregated[0].value,
      },
      recordedAt: new Date(),
      deviceId: `SCADA-${connection.id}`,
      source: 'SCADA',
    });

    await this.fieldEntryRepository.create(connection.tenantId, fieldEntry);
    this.logger.log(`Created field entry from SCADA: ${mapping.wellpulseField} = ${aggregated[0].value}`);
  }

  private async checkNominalRangeViolation(
    wellId: string,
    fieldName: string,
    value: number
  ): Promise<void> {
    // Delegate to FieldEntryValidationService
    await this.fieldEntryValidationService.validateSingleField(wellId, fieldName, value);
  }

  async disconnect(connectionId: string): Promise<void> {
    const client = this.clients.get(connectionId);
    if (client) {
      await client.disconnect();
      this.clients.delete(connectionId);
    }

    const subscription = this.subscriptions.get(connectionId);
    if (subscription) {
      await subscription.terminate();
      this.subscriptions.delete(connectionId);
    }
  }

  async testConnection(connectionId: string): Promise<boolean> {
    try {
      const connection = await this.scadaConnectionRepository.findById(connectionId);
      await this.connect(connection);
      await this.disconnect(connectionId);
      return true;
    } catch (error) {
      return false;
    }
  }

  async browseTags(connection: ScadaConnection): Promise<OpcTag[]> {
    const client = OPCUAClient.create({
      applicationName: 'WellPulse SCADA Browser',
      connectionStrategy: { maxRetry: 1 },
    });

    await client.connect(connection.endpointUrl);
    const session = await client.createSession();

    // Browse root node
    const browseResult = await session.browse('RootFolder');
    const tags: OpcTag[] = [];

    for (const reference of browseResult.references) {
      tags.push({
        nodeId: reference.nodeId.toString(),
        browseName: reference.browseName.toString(),
        displayName: reference.displayName.text,
        nodeClass: reference.nodeClass.toString(),
      });
    }

    await session.close();
    await client.disconnect();

    return tags;
  }

  onModuleDestroy() {
    // Disconnect all clients on shutdown
    for (const [connectionId] of this.clients) {
      void this.disconnect(connectionId);
    }
  }
}
```

**Controller:**
```typescript
// apps/api/src/presentation/scada/scada.controller.ts
@Controller('scada')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScadaController {
  @Post('connections')
  @Roles('ADMIN', 'MANAGER')
  async createConnection(
    @Body() dto: CreateScadaConnectionDto,
    @TenantContext() tenantId: string,
    @Request() req: any
  ): Promise<{ id: string }> {
    const command = new CreateScadaConnectionCommand(
      tenantId,
      dto.wellId,
      dto.protocol,
      dto.endpointUrl,
      dto.username,
      dto.password,
      req.user.userId
    );

    const id = await this.commandBus.execute(command);
    return { id };
  }

  @Get('connections')
  async getConnections(
    @TenantContext() tenantId: string,
    @Query('wellId') wellId?: string
  ): Promise<ScadaConnectionDto[]> {
    const query = new GetScadaConnectionsQuery(tenantId, wellId);
    return await this.queryBus.execute(query);
  }

  @Post('connections/:id/test')
  async testConnection(
    @Param('id') connectionId: string,
    @TenantContext() tenantId: string
  ): Promise<{ success: boolean }> {
    const success = await this.scadaIngestionService.testConnection(connectionId);
    return { success };
  }

  @Get('connections/:id/tags')
  async browseTags(
    @Param('id') connectionId: string,
    @TenantContext() tenantId: string
  ): Promise<OpcTag[]> {
    const query = new BrowseOpcTagsQuery(tenantId, connectionId);
    return await this.queryBus.execute(query);
  }

  @Post('connections/:id/mappings')
  @Roles('ADMIN', 'MANAGER')
  async createTagMapping(
    @Param('id') connectionId: string,
    @Body() dto: CreateTagMappingDto,
    @TenantContext() tenantId: string
  ): Promise<{ id: string }> {
    const command = new CreateTagMappingCommand(
      tenantId,
      connectionId,
      dto.scadaTagName,
      dto.wellpulseField,
      dto.unitConversion,
      dto.aggregationMethod,
      dto.sampleIntervalSeconds
    );

    const id = await this.commandBus.execute(command);
    return { id };
  }

  @Get('readings/:connectionId')
  async getReadings(
    @Param('connectionId') connectionId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @TenantContext() tenantId: string
  ): Promise<ScadaReadingDto[]> {
    const query = new GetScadaReadingsQuery(
      tenantId,
      connectionId,
      new Date(startDate),
      new Date(endDate)
    );
    return await this.queryBus.execute(query);
  }
}
```

**Database Migration:**
```sql
-- apps/api/src/infrastructure/database/migrations/tenant/0002_scada_integration.sql

-- SCADA connections (per-well)
CREATE TABLE scada_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  well_id UUID REFERENCES wells(id) ON DELETE CASCADE,
  protocol VARCHAR(50) NOT NULL, -- OPC_UA, MODBUS_TCP, MQTT
  endpoint_url VARCHAR(500) NOT NULL,
  credentials_encrypted TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'DISCONNECTED',
  last_sync_at TIMESTAMP,
  error_message TEXT,
  tenant_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX idx_scada_connections_well ON scada_connections(well_id);
CREATE INDEX idx_scada_connections_tenant ON scada_connections(tenant_id);
CREATE INDEX idx_scada_connections_status ON scada_connections(status);

-- SCADA tag mappings
CREATE TABLE scada_tag_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES scada_connections(id) ON DELETE CASCADE,
  scada_tag_name VARCHAR(200) NOT NULL,
  wellpulse_field VARCHAR(100) NOT NULL,
  unit_conversion JSONB,
  aggregation_method VARCHAR(50) DEFAULT 'AVERAGE',
  sample_interval_seconds INTEGER DEFAULT 60,
  tenant_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scada_tag_mappings_connection ON scada_tag_mappings(connection_id);
CREATE INDEX idx_scada_tag_mappings_tenant ON scada_tag_mappings(tenant_id);

-- SCADA readings (time-series data)
CREATE TABLE scada_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES scada_connections(id) ON DELETE CASCADE,
  tag_name VARCHAR(200) NOT NULL,
  value NUMERIC(15, 4) NOT NULL,
  unit VARCHAR(20),
  timestamp TIMESTAMP NOT NULL,
  quality VARCHAR(50) DEFAULT 'GOOD',
  tenant_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Optimize for time-series queries
CREATE INDEX idx_scada_readings_connection_timestamp
  ON scada_readings(connection_id, timestamp DESC);
CREATE INDEX idx_scada_readings_tenant_timestamp
  ON scada_readings(tenant_id, timestamp DESC);
CREATE INDEX idx_scada_readings_tag_timestamp
  ON scada_readings(connection_id, tag_name, timestamp DESC);

-- Partition table by month for performance (optional, if high volume)
-- CREATE TABLE scada_readings_2025_11 PARTITION OF scada_readings
--   FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
```

**Background Job (Bull/BullMQ):**
```typescript
// apps/api/src/infrastructure/jobs/scada-connection-manager.job.ts
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';

@Processor('scada')
export class ScadaConnectionManagerProcessor {
  @Process('maintain-connections')
  async handleMaintainConnections(job: Job): Promise<void> {
    // Get all active SCADA connections
    const connections = await this.scadaConnectionRepository.findAllActive();

    for (const connection of connections) {
      try {
        // Check if client is still connected
        const isConnected = this.scadaIngestionService.isConnected(connection.id);

        if (!isConnected) {
          this.logger.warn(`Reconnecting to SCADA: ${connection.id}`);
          await this.scadaIngestionService.connect(connection);
        }
      } catch (error) {
        this.logger.error(`Failed to maintain SCADA connection ${connection.id}: ${error.message}`);
      }
    }
  }
}

// Schedule job every 5 minutes
@Injectable()
export class ScadaScheduler {
  constructor(
    @InjectQueue('scada') private scadaQueue: Queue
  ) {}

  @Cron('*/5 * * * *') // Every 5 minutes
  async maintainConnections() {
    await this.scadaQueue.add('maintain-connections', {}, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }
}
```

#### 2. EIA Commodity Pricing API (16 hours)

**Backend Service:**
```typescript
// apps/api/src/infrastructure/services/commodity-pricing.service.ts
import axios from 'axios';

interface CommodityPrice {
  commodity: 'OIL' | 'GAS';
  price: number;
  unit: string;
  date: Date;
  source: string;
}

@Injectable()
export class CommodityPricingService {
  private readonly logger = new Logger(CommodityPricingService.name);
  private readonly EIA_API_KEY = process.env.EIA_API_KEY;
  private readonly EIA_BASE_URL = 'https://api.eia.gov/v2';

  // Cache prices for 24 hours
  private cache = new Map<string, { price: number; timestamp: Date }>();
  private readonly CACHE_TTL_MS = 86400000; // 24 hours

  async getCurrentOilPrice(): Promise<CommodityPrice> {
    const cacheKey = 'oil-price';
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp.getTime() < this.CACHE_TTL_MS) {
      return {
        commodity: 'OIL',
        price: cached.price,
        unit: '$/BBL',
        date: cached.timestamp,
        source: 'EIA (cached)',
      };
    }

    try {
      const response = await axios.get(`${this.EIA_BASE_URL}/petroleum/pri/spt/data/`, {
        params: {
          api_key: this.EIA_API_KEY,
          frequency: 'daily',
          data: ['value'],
          facets: { series: ['RWTC'] }, // WTI Cushing spot price
          sort: [{ column: 'period', direction: 'desc' }],
          length: 1,
        },
      });

      const price = response.data.response.data[0].value;
      this.cache.set(cacheKey, { price, timestamp: new Date() });

      return {
        commodity: 'OIL',
        price,
        unit: '$/BBL',
        date: new Date(response.data.response.data[0].period),
        source: 'EIA - WTI Cushing',
      };
    } catch (error) {
      this.logger.error(`Failed to fetch oil price from EIA: ${error.message}`);
      throw new ServiceUnavailableException('Unable to fetch current oil price');
    }
  }

  async getCurrentGasPrice(): Promise<CommodityPrice> {
    const cacheKey = 'gas-price';
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp.getTime() < this.CACHE_TTL_MS) {
      return {
        commodity: 'GAS',
        price: cached.price,
        unit: '$/MMBTU',
        date: cached.timestamp,
        source: 'EIA (cached)',
      };
    }

    try {
      const response = await axios.get(`${this.EIA_BASE_URL}/natural-gas/pri/spt/data/`, {
        params: {
          api_key: this.EIA_API_KEY,
          frequency: 'daily',
          data: ['value'],
          facets: { series: ['RNGWHHD'] }, // Henry Hub spot price
          sort: [{ column: 'period', direction: 'desc' }],
          length: 1,
        },
      });

      const price = response.data.response.data[0].value;
      this.cache.set(cacheKey, { price, timestamp: new Date() });

      return {
        commodity: 'GAS',
        price,
        unit: '$/MMBTU',
        date: new Date(response.data.response.data[0].period),
        source: 'EIA - Henry Hub',
      };
    } catch (error) {
      this.logger.error(`Failed to fetch gas price from EIA: ${error.message}`);
      throw new ServiceUnavailableException('Unable to fetch current gas price');
    }
  }

  async getHistoricalPrices(
    commodity: 'OIL' | 'GAS',
    startDate: Date,
    endDate: Date
  ): Promise<CommodityPrice[]> {
    const seriesId = commodity === 'OIL' ? 'RWTC' : 'RNGWHHD';
    const unit = commodity === 'OIL' ? '$/BBL' : '$/MMBTU';

    try {
      const response = await axios.get(`${this.EIA_BASE_URL}/petroleum/pri/spt/data/`, {
        params: {
          api_key: this.EIA_API_KEY,
          frequency: 'daily',
          data: ['value'],
          facets: { series: [seriesId] },
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
          sort: [{ column: 'period', direction: 'asc' }],
        },
      });

      return response.data.response.data.map((d: any) => ({
        commodity,
        price: d.value,
        unit,
        date: new Date(d.period),
        source: 'EIA',
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch historical ${commodity} prices: ${error.message}`);
      throw new ServiceUnavailableException('Unable to fetch historical prices');
    }
  }

  // Fallback: Manual price entry per tenant
  async setManualPrice(
    tenantId: string,
    commodity: 'OIL' | 'GAS',
    price: number
  ): Promise<void> {
    await this.tenantPricingRepository.upsert({
      tenantId,
      commodity,
      price,
      effectiveDate: new Date(),
      source: 'MANUAL',
    });
  }

  async getEffectivePrice(
    tenantId: string,
    commodity: 'OIL' | 'GAS'
  ): Promise<CommodityPrice> {
    // Check for tenant-specific manual override
    const manualPrice = await this.tenantPricingRepository.findCurrent(tenantId, commodity);

    if (manualPrice) {
      return manualPrice;
    }

    // Fallback to EIA API
    return commodity === 'OIL'
      ? await this.getCurrentOilPrice()
      : await this.getCurrentGasPrice();
  }
}
```

**Controller:**
```typescript
// apps/api/src/presentation/pricing/commodity-pricing.controller.ts
@Controller('pricing')
export class CommodityPricingController {
  @Get('current/oil')
  async getCurrentOilPrice(): Promise<CommodityPrice> {
    return await this.commodityPricingService.getCurrentOilPrice();
  }

  @Get('current/gas')
  async getCurrentGasPrice(): Promise<CommodityPrice> {
    return await this.commodityPricingService.getCurrentGasPrice();
  }

  @Get('historical/:commodity')
  async getHistoricalPrices(
    @Param('commodity') commodity: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ): Promise<CommodityPrice[]> {
    return await this.commodityPricingService.getHistoricalPrices(
      commodity as 'OIL' | 'GAS',
      new Date(startDate),
      new Date(endDate)
    );
  }

  @Post('manual')
  @Roles('ADMIN', 'MANAGER')
  async setManualPrice(
    @TenantContext() tenantId: string,
    @Body() dto: SetManualPriceDto
  ): Promise<void> {
    await this.commodityPricingService.setManualPrice(
      tenantId,
      dto.commodity,
      dto.price
    );
  }
}
```

**Background Job:**
```typescript
// Update prices daily at 6 AM CT (after EIA publishes)
@Cron('0 6 * * *', { timeZone: 'America/Chicago' })
async updateDailyPrices() {
  await this.commodityPricingService.getCurrentOilPrice(); // Refresh cache
  await this.commodityPricingService.getCurrentGasPrice(); // Refresh cache
  this.logger.log('Daily commodity prices updated');
}
```

#### 3. Report Branding (White-Label) (16 hours)

**Database Schema Update:**
```sql
-- Add branding fields to tenants table
ALTER TABLE tenants ADD COLUMN logo_url VARCHAR(500);
ALTER TABLE tenants ADD COLUMN branding_config JSONB DEFAULT '{
  "primaryColor": "#3b82f6",
  "secondaryColor": "#10b981",
  "companyName": null,
  "address": null,
  "phone": null,
  "email": null,
  "website": null
}'::jsonb;
```

**Logo Upload Controller:**
```typescript
// apps/api/src/presentation/tenants/tenant-branding.controller.ts
@Controller('tenants/branding')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantBrandingController {
  @Post('logo')
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('logo'))
  async uploadLogo(
    @TenantContext() tenantId: string,
    @UploadedFile() file: Express.Multer.File
  ): Promise<{ logoUrl: string }> {
    // Upload to Azure Blob Storage
    const logoUrl = await this.azureBlobService.upload(
      `tenants/${tenantId}/logo.png`,
      file.buffer,
      file.mimetype
    );

    // Update tenant record
    await this.tenantRepository.updateLogo(tenantId, logoUrl);

    return { logoUrl };
  }

  @Put('branding')
  @Roles('ADMIN')
  async updateBranding(
    @TenantContext() tenantId: string,
    @Body() dto: UpdateBrandingDto
  ): Promise<void> {
    await this.tenantRepository.updateBranding(tenantId, dto);
  }

  @Get('branding')
  async getBranding(@TenantContext() tenantId: string): Promise<BrandingDto> {
    const tenant = await this.tenantRepository.findById(tenantId);
    return {
      logoUrl: tenant.logoUrl,
      primaryColor: tenant.brandingConfig.primaryColor,
      secondaryColor: tenant.brandingConfig.secondaryColor,
      companyName: tenant.brandingConfig.companyName || tenant.name,
      address: tenant.brandingConfig.address,
      phone: tenant.brandingConfig.phone,
      email: tenant.brandingConfig.email,
      website: tenant.brandingConfig.website,
    };
  }
}
```

**PDF Report Service with Branding:**
```typescript
// apps/api/src/infrastructure/services/pdf-report.service.ts
import PDFDocument from 'pdfkit';
import axios from 'axios';

@Injectable()
export class PdfReportService {
  async generateRRCForm1(wellId: string, tenantId: string): Promise<Buffer> {
    const well = await this.wellRepository.findById(tenantId, wellId);
    const tenant = await this.tenantRepository.findById(tenantId);
    const formData = await this.rrcFormService.generateForm1Data(wellId);

    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', chunk => chunks.push(chunk));

    // Add logo
    if (tenant.logoUrl) {
      const logoBuffer = await this.downloadImage(tenant.logoUrl);
      doc.image(logoBuffer, 50, 45, { width: 100 });
    }

    // Company header (right-aligned)
    doc.fontSize(10)
       .text(tenant.brandingConfig.companyName || tenant.name, 350, 50, { align: 'right' })
       .text(tenant.brandingConfig.address || '', 350, 65, { align: 'right' })
       .text(tenant.brandingConfig.phone || '', 350, 80, { align: 'right' })
       .text(tenant.brandingConfig.website || '', 350, 95, { align: 'right', link: tenant.brandingConfig.website });

    // Form title
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .text('RRC FORM 1 - OIL WELL POTENTIAL TEST', 50, 140, { align: 'center' });

    // Form body
    doc.fontSize(11)
       .font('Helvetica')
       .text(`Generated: ${new Date().toLocaleDateString()}`, 50, 170, { align: 'center' });

    doc.moveDown(2);

    // Form fields
    this.addFormField(doc, 'Operator Name:', formData.operatorName);
    this.addFormField(doc, 'Operator Number:', formData.operatorNumber);
    this.addFormField(doc, 'API Number:', formData.wellApiNumber);
    this.addFormField(doc, 'Well Name:', formData.wellName);
    this.addFormField(doc, 'Lease Name:', formData.leaseName);
    this.addFormField(doc, 'County:', formData.county);
    this.addFormField(doc, 'Field Name:', formData.fieldName);
    this.addFormField(doc, 'Test Date:', formData.testDate.toLocaleDateString());

    doc.moveDown(1);
    doc.fontSize(12).font('Helvetica-Bold').text('PRODUCTION DATA');
    doc.fontSize(11).font('Helvetica');

    this.addFormField(doc, 'Oil Rate (BOPD):', formData.oilRate.toString());
    this.addFormField(doc, 'Gas Rate (MCFD):', formData.gasRate.toString());
    this.addFormField(doc, 'Water Rate (BWPD):', formData.waterRate.toString());
    this.addFormField(doc, 'Gas-Oil Ratio (GOR):', formData.gasOilRatio.toFixed(2));
    this.addFormField(doc, 'Oil Gravity (API):', formData.oilGravity.toString());

    doc.moveDown(1);
    doc.fontSize(12).font('Helvetica-Bold').text('PRESSURE DATA');
    doc.fontSize(11).font('Helvetica');

    this.addFormField(doc, 'Tubing Pressure (PSI):', formData.tubingPressure.toString());
    this.addFormField(doc, 'Casing Pressure (PSI):', formData.casingPressure.toString());
    this.addFormField(doc, 'Choke Size (1/64"):', formData.chokeSize.toString());
    this.addFormField(doc, 'Test Hours:', formData.testHours.toString());

    // Footer with branding colors
    doc.rect(50, 700, 512, 2).fill(tenant.brandingConfig.primaryColor || '#3b82f6');
    doc.fontSize(8)
       .fillColor('#666')
       .text(`Generated by WellPulse - ${tenant.brandingConfig.companyName || tenant.name}`, 50, 710, { align: 'center' });

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  private addFormField(doc: PDFKit.PDFDocument, label: string, value: string): void {
    doc.font('Helvetica-Bold').text(label, { continued: true }).font('Helvetica').text(` ${value}`);
    doc.moveDown(0.5);
  }

  private async downloadImage(url: string): Promise<Buffer> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  }
}
```

### Frontend Tasks (60 hours)

#### 1. Interactive Well Map with Mapbox (32 hours)

**Install Mapbox:**
```bash
cd apps/web
pnpm add mapbox-gl @types/mapbox-gl
```

**Environment Variable:**
```env
# apps/web/.env.local
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1Ijoid2VsbHB1bHNlIiwiYSI6ImNsejExMjM0NTY3ODkwMnBqYnJlc3Q5czEifQ.xxxxxxxxxxx
```

**Map Component:**
```typescript
// apps/web/components/wells/wells-map-view.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

interface WellMarkerData {
  id: string;
  name: string;
  apiNumber: string;
  latitude: number;
  longitude: number;
  status: 'ACTIVE' | 'INACTIVE' | 'PLUGGED';
  lastProduction: {
    oil: number;
    gas: number;
    date: string;
  };
}

export function WellsMapView({ wells }: { wells: WellMarkerData[] }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Initialize map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-102.0779, 31.9973], // Midland, TX
      zoom: 9,
    });

    // Add controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      map.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (!map.current || !mapLoaded || wells.length === 0) return;

    // Remove existing markers
    document.querySelectorAll('.well-marker').forEach(el => el.remove());

    // Add well markers
    wells.forEach(well => {
      const color = well.status === 'ACTIVE' ? '#22c55e'
                  : well.status === 'INACTIVE' ? '#eab308'
                  : '#ef4444';

      // Create marker element
      const el = document.createElement('div');
      el.className = 'well-marker';
      el.style.backgroundImage = `url(data:image/svg+xml;base64,${btoa(`
        <svg width="30" height="40" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 0 L30 30 L15 40 L0 30 Z" fill="${color}" stroke="#fff" stroke-width="2"/>
        </svg>
      `)})`;
      el.style.width = '30px';
      el.style.height = '40px';
      el.style.cursor = 'pointer';

      // Create popup
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div class="p-3 min-w-[250px]">
          <h3 class="font-bold text-lg mb-2">${well.name}</h3>
          <p class="text-sm text-gray-600 mb-3">API: ${well.apiNumber}</p>
          <div class="space-y-1 mb-3">
            <p class="text-sm">Oil: <span class="font-semibold">${well.lastProduction.oil} BBL</span></p>
            <p class="text-sm">Gas: <span class="font-semibold">${well.lastProduction.gas} MCF</span></p>
            <p class="text-xs text-gray-500">${new Date(well.lastProduction.date).toLocaleDateString()}</p>
          </div>
          <a href="/wells/${well.id}" class="text-blue-600 hover:text-blue-800 text-sm font-medium">
            View Details →
          </a>
        </div>
      `);

      // Add marker to map
      new mapboxgl.Marker(el)
        .setLngLat([well.longitude, well.latitude])
        .setPopup(popup)
        .addTo(map.current!);
    });

    // Fit map to wells bounds
    if (wells.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      wells.forEach(well => {
        bounds.extend([well.longitude, well.latitude]);
      });
      map.current.fitBounds(bounds, { padding: 50 });
    }
  }, [wells, mapLoaded]);

  return (
    <div className="relative w-full h-[600px]">
      <div ref={mapContainer} className="w-full h-full rounded-lg shadow-lg" />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Wells Page Update:**
```typescript
// apps/web/app/(dashboard)/wells/page.tsx
'use client';

import { useState } from 'react';
import { useWells } from '@/hooks/use-wells';
import { WellsMapView } from '@/components/wells/wells-map-view';
import { WellsTable } from '@/components/wells/wells-table';
import { Button } from '@/components/ui/button';
import { MapIcon, ListIcon } from 'lucide-react';

export default function WellsPage() {
  const [view, setView] = useState<'map' | 'list'>('map');
  const { data: wells, isLoading } = useWells();

  if (isLoading) {
    return <div>Loading wells...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Wells</h1>
        <div className="flex gap-2">
          <Button
            variant={view === 'map' ? 'default' : 'outline'}
            onClick={() => setView('map')}
            className="flex items-center gap-2"
          >
            <MapIcon className="w-4 h-4" />
            Map View
          </Button>
          <Button
            variant={view === 'list' ? 'default' : 'outline'}
            onClick={() => setView('list')}
            className="flex items-center gap-2"
          >
            <ListIcon className="w-4 h-4" />
            List View
          </Button>
        </div>
      </div>

      {view === 'map' ? (
        <WellsMapView wells={wells || []} />
      ) : (
        <WellsTable wells={wells || []} />
      )}
    </div>
  );
}
```

#### 2. SCADA Management UI (28 hours)

**SCADA Connections Page:**
```typescript
// apps/web/app/(dashboard)/settings/scada/page.tsx
'use client';

import { useScadaConnections } from '@/hooks/use-scada';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusIcon, CheckCircleIcon, XCircleIcon, AlertCircleIcon } from 'lucide-react';
import { CreateScadaConnectionDialog } from '@/components/scada/create-connection-dialog';

export default function ScadaConnectionsPage() {
  const { data: connections, isLoading } = useScadaConnections();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONNECTED':
        return <Badge variant="success" className="flex items-center gap-1">
          <CheckCircleIcon className="w-3 h-3" />
          Connected
        </Badge>;
      case 'DISCONNECTED':
        return <Badge variant="secondary">Disconnected</Badge>;
      case 'ERROR':
        return <Badge variant="destructive" className="flex items-center gap-1">
          <XCircleIcon className="w-3 h-3" />
          Error
        </Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">SCADA Connections</h1>
          <p className="text-gray-600 mt-1">
            Connect to SCADA systems for real-time well monitoring
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Connection
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {connections?.map((connection) => (
          <div key={connection.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{connection.wellName}</h3>
                <p className="text-sm text-gray-600">{connection.endpointUrl}</p>
              </div>
              {getStatusBadge(connection.status)}
            </div>

            <div className="space-y-1 text-sm">
              <p>
                <span className="text-gray-600">Protocol:</span>{' '}
                <span className="font-medium">{connection.protocol}</span>
              </p>
              {connection.lastSyncAt && (
                <p>
                  <span className="text-gray-600">Last Sync:</span>{' '}
                  <span className="font-medium">
                    {new Date(connection.lastSyncAt).toLocaleString()}
                  </span>
                </p>
              )}
              {connection.errorMessage && (
                <p className="text-red-600 text-xs mt-2 flex items-start gap-1">
                  <AlertCircleIcon className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  {connection.errorMessage}
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" className="flex-1">
                Configure Tags
              </Button>
              <Button variant="outline" size="sm">
                Test
              </Button>
            </div>
          </div>
        ))}
      </div>

      {showCreateDialog && (
        <CreateScadaConnectionDialog
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
        />
      )}
    </div>
  );
}
```

**Create SCADA Connection Dialog:**
```typescript
// apps/web/components/scada/create-connection-dialog.tsx
'use client';

import { useState } from 'react';
import { useCreateScadaConnection } from '@/hooks/use-scada';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

export function CreateScadaConnectionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate: createConnection, isLoading } = useCreateScadaConnection();
  const [formData, setFormData] = useState({
    wellId: '',
    protocol: 'OPC_UA',
    endpointUrl: '',
    username: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    createConnection(formData, {
      onSuccess: () => {
        onClose();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add SCADA Connection</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="wellId">Well</Label>
            <Select
              id="wellId"
              value={formData.wellId}
              onChange={(e) => setFormData({ ...formData, wellId: e.target.value })}
              required
            >
              <option value="">Select a well...</option>
              {/* Populate from useWells() hook */}
            </Select>
          </div>

          <div>
            <Label htmlFor="protocol">Protocol</Label>
            <Select
              id="protocol"
              value={formData.protocol}
              onChange={(e) => setFormData({ ...formData, protocol: e.target.value })}
              required
            >
              <option value="OPC_UA">OPC-UA</option>
              <option value="MODBUS_TCP" disabled>Modbus TCP (Coming Soon)</option>
              <option value="MQTT" disabled>MQTT (Coming Soon)</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="endpointUrl">Endpoint URL</Label>
            <Input
              id="endpointUrl"
              value={formData.endpointUrl}
              onChange={(e) => setFormData({ ...formData, endpointUrl: e.target.value })}
              placeholder="opc.tcp://192.168.1.100:4840"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Example: opc.tcp://192.168.1.100:4840
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Connection'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Summary

Sprint 5A delivers:
1. ✅ **Complete SCADA Integration** - OPC-UA protocol support with real-time data ingestion
2. ✅ **Interactive Well Map** - Mapbox-powered visualization with markers, popups, clustering
3. ✅ **EIA Commodity Pricing** - Free oil/gas price API with daily updates
4. ✅ **Report Branding** - White-label PDFs with tenant logos and colors
5. ✅ **Mobile Test Data** - Offline test data generation for field testing

**Next:** Sprint 5B will tackle Production Accounting and RRC Compliance Automation.

---

**Document Version:** 1.0
**Last Updated:** October 29, 2025
**Author:** Claude (WellPulse AI Assistant)
