# Sprint 4: Enterprise Features Implementation Plan

**Status**: Planning
**Target**: Transform WellPulse into enterprise-grade production monitoring platform
**Goal**: Combine all competitor features (RigReports, WellView, Peloton, P2 BOLO) into unified solution for small-medium operators

---

## Executive Summary

This sprint transforms WellPulse from a basic field data entry tool into a comprehensive, enterprise-grade production monitoring and business intelligence platform. We're implementing features from all major competitors while maintaining our focus on small-medium operators in the Permian Basin.

**Key Differentiators:**
- Enterprise-level features at SMB pricing
- Offline-first mobile/desktop data entry
- Real-time alerting with configurable thresholds
- Comprehensive reporting suite (20+ report types)
- Advanced RBAC with Azure Entra ID integration
- Multi-level nominal range configuration (org → well-specific)

---

## Phase 1: Nominal Range Management & Alerts (Priority: CRITICAL)

### 1.1 Database Schema Changes

**Master DB** (applies to all tenants):
```sql
-- Default nominal ranges template (seeded on tenant creation)
CREATE TABLE nominal_range_templates (
  id UUID PRIMARY KEY,
  field_name VARCHAR NOT NULL, -- e.g., 'productionVolume', 'pressure', 'bsw'
  well_type VARCHAR, -- NULL = applies to all well types, or specific: 'beam-pump', 'pcp', etc.
  min_value DECIMAL,
  max_value DECIMAL,
  unit VARCHAR, -- 'bbl', 'psi', '%', etc.
  severity VARCHAR DEFAULT 'warning', -- 'info', 'warning', 'critical'
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Tenant DB** (per-tenant customization):
```sql
-- Org-level nominal ranges (overrides defaults)
CREATE TABLE org_nominal_ranges (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  field_name VARCHAR NOT NULL,
  well_type VARCHAR,
  min_value DECIMAL,
  max_value DECIMAL,
  unit VARCHAR,
  severity VARCHAR DEFAULT 'warning',
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  updated_by UUID REFERENCES users(id)
);

-- Well-specific nominal ranges (overrides org-level)
CREATE TABLE well_nominal_ranges (
  id UUID PRIMARY KEY,
  well_id UUID NOT NULL REFERENCES wells(id),
  field_name VARCHAR NOT NULL,
  min_value DECIMAL,
  max_value DECIMAL,
  unit VARCHAR,
  severity VARCHAR DEFAULT 'warning',
  reason TEXT, -- Why this well has custom ranges (e.g., "Aging well, lower production expected")
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  updated_by UUID REFERENCES users(id)
);

-- Alert preferences (org-wide and per-user)
CREATE TABLE alert_preferences (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID REFERENCES users(id), -- NULL = org-wide default
  alert_type VARCHAR NOT NULL, -- 'nominal_range_violation', 'well_down', 'equipment_failure'
  enabled BOOLEAN DEFAULT TRUE,
  channels JSONB, -- { "email": true, "sms": true, "push": false }
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Alert log (for audit trail and reporting)
CREATE TABLE alerts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  well_id UUID REFERENCES wells(id),
  field_entry_id UUID REFERENCES field_entries(id),
  alert_type VARCHAR NOT NULL,
  severity VARCHAR NOT NULL,
  field_name VARCHAR,
  actual_value DECIMAL,
  expected_min DECIMAL,
  expected_max DECIMAL,
  message TEXT,
  acknowledged_at TIMESTAMP,
  acknowledged_by UUID REFERENCES users(id),
  created_at TIMESTAMP
);
```

### 1.2 Seed Data for Nominal Ranges

**Default nominal ranges** (seeded on every new tenant creation):

| Field Name | Well Type | Min | Max | Unit | Severity |
|------------|-----------|-----|-----|------|----------|
| productionVolume | all | 1 | 500 | bbl/day | warning |
| productionVolume | all | 0 | 1 | bbl/day | critical |
| gasVolume | all | 10 | 5000 | mcf/day | warning |
| waterCut | all | 0 | 50 | % | warning |
| waterCut | all | 50 | 100 | % | critical |
| bsw | all | 0 | 1 | % | info |
| bsw | all | 1 | 8 | % | warning |
| bsw | all | 8 | 100 | % | critical |
| pressure | all | 50 | 3000 | psi | warning |
| temperature | all | 60 | 250 | °F | warning |
| casingPressure | all | 0 | 50 | psi | warning |
| casingPressure | all | 50 | 9999 | psi | critical |
| gor | all | 500 | 6000 | cf/bbl | info |
| gor | all | 6000 | 50000 | cf/bbl | warning |
| pumpRuntime | beam-pump | 20 | 24 | hours | warning |
| strokesPerMinute | beam-pump | 8 | 20 | spm | warning |
| motorAmps | pcp,submersible | 20 | 100 | amps | warning |
| motorTemp | pcp,submersible | 100 | 250 | °F | warning |
| gasInjectionVolume | gas-lift | 50 | 500 | mcf | warning |

### 1.3 Backend Implementation (API)

**Domain Layer:**
```typescript
// apps/api/src/domain/nominal-ranges/
export class NominalRange {
  id: string;
  fieldName: string;
  wellType?: WellType;
  minValue?: number;
  maxValue?: number;
  unit: string;
  severity: 'info' | 'warning' | 'critical';

  validate(value: number): { isValid: boolean; violation?: NominalRangeViolation } {
    if (this.minValue !== undefined && value < this.minValue) {
      return { isValid: false, violation: { type: 'below_min', actual: value, expected: this.minValue } };
    }
    if (this.maxValue !== undefined && value > this.maxValue) {
      return { isValid: false, violation: { type: 'above_max', actual: value, expected: this.maxValue } };
    }
    return { isValid: true };
  }
}

// apps/api/src/domain/alerts/
export class Alert {
  id: string;
  tenantId: string;
  wellId: string;
  fieldEntryId: string;
  alertType: string;
  severity: 'info' | 'warning' | 'critical';
  fieldName: string;
  actualValue: number;
  expectedMin?: number;
  expectedMax?: number;
  message: string;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  createdAt: Date;
}
```

**Application Layer (CQRS):**
```typescript
// apps/api/src/application/nominal-ranges/commands/
export class UpdateOrgNominalRangesCommand {
  tenantId: string;
  ranges: Array<{ fieldName: string; wellType?: string; minValue?: number; maxValue?: number; unit: string; severity: string }>;
  updatedBy: string;
}

export class SetWellNominalRangeCommand {
  tenantId: string;
  wellId: string;
  fieldName: string;
  minValue?: number;
  maxValue?: number;
  reason: string; // Why this well needs custom ranges
  updatedBy: string;
}

export class UpdateAlertPreferencesCommand {
  tenantId: string;
  userId?: string; // NULL = org-wide
  alertType: string;
  enabled: boolean;
  channels: { email: boolean; sms: boolean; push: boolean };
}

// apps/api/src/application/nominal-ranges/queries/
export class GetEffectiveNominalRangesQuery {
  tenantId: string;
  wellId?: string; // If provided, returns well-specific overrides
  wellType?: WellType;
}

export class GetAlertHistoryQuery {
  tenantId: string;
  wellId?: string;
  startDate?: Date;
  endDate?: Date;
  severity?: string[];
  acknowledged?: boolean;
  limit: number;
  offset: number;
}

// apps/api/src/application/field-data/services/
export class FieldEntryValidationService {
  async validateFieldEntry(tenantId: string, wellId: string, entryData: FieldEntryData): Promise<ValidationResult[]> {
    // 1. Get effective nominal ranges for this well (well-specific > org-level > default)
    const ranges = await this.nominalRangeRepo.getEffectiveRanges(tenantId, wellId);

    // 2. Validate each field
    const violations: NominalRangeViolation[] = [];
    for (const [fieldName, value] of Object.entries(entryData)) {
      const range = ranges.find(r => r.fieldName === fieldName);
      if (range && value !== null && value !== undefined) {
        const result = range.validate(Number(value));
        if (!result.isValid) {
          violations.push({ fieldName, ...result.violation, severity: range.severity });
        }
      }
    }

    return violations;
  }
}

// apps/api/src/application/alerts/services/
export class AlertNotificationService {
  async sendAlerts(tenantId: string, violations: NominalRangeViolation[], entryId: string, wellId: string): Promise<void> {
    // 1. Get alert preferences for all managers/admins
    const recipients = await this.userRepo.getUsersWithAlertPreferences(tenantId, ['manager', 'admin']);

    // 2. Filter based on user-specific preferences
    const enabledRecipients = recipients.filter(r => r.alertPreferences.enabled);

    // 3. Send notifications via enabled channels
    for (const recipient of enabledRecipients) {
      if (recipient.alertPreferences.channels.email) {
        await this.emailService.sendNominalRangeViolationEmail(recipient.email, violations, wellId);
      }
      if (recipient.alertPreferences.channels.sms) {
        await this.smsService.sendNominalRangeViolationSMS(recipient.phone, violations, wellId);
      }
    }

    // 4. Log alerts for audit trail
    for (const violation of violations) {
      await this.alertRepo.create({
        tenantId,
        wellId,
        fieldEntryId: entryId,
        alertType: 'nominal_range_violation',
        severity: violation.severity,
        fieldName: violation.fieldName,
        actualValue: violation.actual,
        expectedMin: violation.type === 'below_min' ? violation.expected : undefined,
        expectedMax: violation.type === 'above_max' ? violation.expected : undefined,
        message: this.formatAlertMessage(violation),
      });
    }
  }
}
```

**Presentation Layer (Controllers):**
```typescript
// apps/api/src/presentation/nominal-ranges/nominal-ranges.controller.ts
@Controller('api/nominal-ranges')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NominalRangesController {

  @Get('org')
  @Roles('admin', 'manager')
  async getOrgRanges(@TenantContext() tenantId: string, @Query('wellType') wellType?: WellType) {
    // Returns org-level nominal ranges (with defaults as fallback)
  }

  @Put('org')
  @Roles('admin', 'manager')
  async updateOrgRanges(@TenantContext() tenantId: string, @Body() dto: UpdateOrgNominalRangesDto, @User() user) {
    // Update org-level nominal ranges
  }

  @Get('well/:wellId')
  @Roles('admin', 'manager')
  async getWellRanges(@TenantContext() tenantId: string, @Param('wellId') wellId: string) {
    // Returns well-specific nominal ranges (with org-level as fallback)
  }

  @Put('well/:wellId/:fieldName')
  @Roles('admin', 'manager')
  async setWellRange(@TenantContext() tenantId: string, @Param('wellId') wellId: string, @Param('fieldName') fieldName: string, @Body() dto: SetWellNominalRangeDto, @User() user) {
    // Override nominal range for specific well
  }

  @Delete('well/:wellId/:fieldName')
  @Roles('admin', 'manager')
  async deleteWellRange(@TenantContext() tenantId: string, @Param('wellId') wellId: string, @Param('fieldName') fieldName: string) {
    // Remove well-specific override, fall back to org-level
  }
}

// apps/api/src/presentation/alerts/alerts.controller.ts
@Controller('api/alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertsController {

  @Get('preferences')
  @Roles('admin', 'manager', 'consultant')
  async getAlertPreferences(@TenantContext() tenantId: string, @User() user) {
    // Get user's alert preferences (or org-wide if admin)
  }

  @Put('preferences')
  @Roles('admin', 'manager', 'consultant')
  async updateAlertPreferences(@TenantContext() tenantId: string, @User() user, @Body() dto: UpdateAlertPreferencesDto) {
    // Update user's alert preferences
  }

  @Put('preferences/:userId')
  @Roles('admin')
  async updateUserAlertPreferences(@TenantContext() tenantId: string, @Param('userId') userId: string, @Body() dto: UpdateAlertPreferencesDto) {
    // Admin can toggle alerts for other users
  }

  @Get('history')
  @Roles('admin', 'manager')
  async getAlertHistory(@TenantContext() tenantId: string, @Query() query: GetAlertHistoryDto) {
    // Get alert history with filters
  }

  @Post(':alertId/acknowledge')
  @Roles('admin', 'manager')
  async acknowledgeAlert(@TenantContext() tenantId: string, @Param('alertId') alertId: string, @User() user) {
    // Mark alert as acknowledged
  }
}
```

### 1.4 Mobile App Changes

**Visual Indication of Nominal Range Violations:**

```typescript
// apps/mobile/components/field-entry/ProductionDataForm.tsx
// Update input styling to show red background for out-of-range values

const useNominalRangeValidation = (fieldName: string, value: string, wellId: string) => {
  const [violation, setViolation] = useState<NominalRangeViolation | null>(null);

  useEffect(() => {
    if (value && wellId) {
      // Call API to validate value against nominal ranges
      api.validateFieldValue(wellId, fieldName, parseFloat(value))
        .then(result => setViolation(result.violation || null));
    }
  }, [fieldName, value, wellId]);

  return violation;
};

// In component:
const productionViolation = useNominalRangeValidation('productionVolume', productionVolume, selectedWell?.id);

<TextInput
  style={[
    styles.input,
    productionViolation && productionViolation.severity === 'critical' && styles.inputCritical,
    productionViolation && productionViolation.severity === 'warning' && styles.inputWarning,
  ]}
  // ... other props
/>

const styles = StyleSheet.create({
  inputCritical: {
    backgroundColor: '#DC2626', // Red
    color: '#FFFFFF',
    borderColor: '#B91C1C',
  },
  inputWarning: {
    backgroundColor: '#F59E0B', // Amber
    color: '#FFFFFF',
    borderColor: '#D97706',
  },
});
```

**Test Data Generation (Development Mode):**

```typescript
// apps/mobile/app/(tabs)/entry.tsx
// Add development mode button to auto-fill with random data

const fillWithTestData = () => {
  if (!selectedWell) {
    Alert.alert('Select Well First', 'Please select a well before generating test data');
    return;
  }

  // Random production volumes (some intentionally out of range)
  setProductionVolume(String(Math.random() > 0.7 ? Math.floor(Math.random() * 1000) : Math.floor(Math.random() * 100)));
  setGasVolume(String(Math.random() > 0.7 ? Math.floor(Math.random() * 10000) : Math.floor(Math.random() * 1000)));
  setWaterVolume(String(Math.floor(Math.random() * 50)));
  setWaterCut(String(Math.random() > 0.6 ? Math.floor(Math.random() * 100) : Math.floor(Math.random() * 50)));

  // Random pressure/temperature (some out of range)
  setPressure(String(Math.random() > 0.7 ? Math.floor(Math.random() * 5000) : Math.floor(Math.random() * 2000)));
  setTemperature(String(Math.floor(Math.random() * 250)));

  // Random BS&W (some violating sales requirements)
  setBsw(String((Math.random() * 10).toFixed(2)));

  // Random GOR (some exceeding gas well threshold)
  setGor(String(Math.floor(Math.random() * 15000)));

  // Well-type-specific fields
  if (selectedWell.wellType === 'beam-pump') {
    setPumpRuntime(String(Math.floor(Math.random() * 24)));
    setStrokesPerMinute(String(Math.floor(Math.random() * 25)));
    setStrokeLength(String(Math.floor(Math.random() * 100)));
    setEngineHours(String(Math.floor(Math.random() * 20000)));
    setEngineTemp(String(Math.floor(Math.random() * 300)));
  }
  // ... similar for other well types

  // Check all checklist items
  setChecklist({
    pumpOperating: true,
    noLeaks: true,
    gaugesWorking: true,
    safetyEquipment: true,
    tankLevelsChecked: true,
    separatorOperating: true,
    noAbnormalSounds: true,
    valvePositionsCorrect: true,
    heaterTreaterOperating: true,
    noVisibleCorrosion: true,
    ventLinesClear: true,
    chemicalInjectionWorking: true,
    secondaryContainmentOk: true,
    wellSiteSecure: true,
    spillKitsAvailable: true,
  });

  toast.success('Test data generated (some values out of range)', { duration: 3000 });
};

// Add button in development mode
{__DEV__ && (
  <TouchableOpacity style={styles.testDataButton} onPress={fillWithTestData}>
    <Text style={styles.testDataButtonText}>🎲 Fill with Test Data</Text>
  </TouchableOpacity>
)}
```

### 1.5 Web Portal Changes

**Settings Page for Nominal Ranges:**

```typescript
// apps/web/app/(dashboard)/settings/nominal-ranges/page.tsx
export default function NominalRangesSettings() {
  const [orgRanges, setOrgRanges] = useState<NominalRange[]>([]);
  const [selectedWellType, setSelectedWellType] = useState<WellType | 'all'>('all');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Nominal Range Settings</h1>
        <Select value={selectedWellType} onValueChange={setSelectedWellType}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Well Types</SelectItem>
            <SelectItem value="beam-pump">Beam Pump</SelectItem>
            <SelectItem value="pcp">PCP</SelectItem>
            <SelectItem value="submersible">Submersible</SelectItem>
            <SelectItem value="gas-lift">Gas Lift</SelectItem>
            <SelectItem value="plunger-lift">Plunger Lift</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization-Wide Nominal Ranges</CardTitle>
          <CardDescription>
            These ranges apply to all wells unless overridden at the well level
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field Name</TableHead>
                <TableHead>Min Value</TableHead>
                <TableHead>Max Value</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgRanges.filter(r => !r.wellType || r.wellType === selectedWellType).map(range => (
                <TableRow key={range.id}>
                  <TableCell className="font-medium">{range.fieldName}</TableCell>
                  <TableCell>
                    <Input type="number" value={range.minValue} onChange={...} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" value={range.maxValue} onChange={...} />
                  </TableCell>
                  <TableCell>{range.unit}</TableCell>
                  <TableCell>
                    <Badge variant={range.severity === 'critical' ? 'destructive' : range.severity === 'warning' ? 'warning' : 'default'}>
                      {range.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">Edit</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// apps/web/app/(dashboard)/wells/[id]/nominal-ranges/page.tsx
export default function WellNominalRanges({ params }: { params: { id: string } }) {
  const [wellRanges, setWellRanges] = useState<WellNominalRange[]>([]);
  const [orgRanges, setOrgRanges] = useState<NominalRange[]>([]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Well-Specific Nominal Ranges</h1>

      <Alert>
        <AlertDescription>
          These ranges override the organization-wide settings for this specific well.
          Leave blank to use organization defaults.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field Name</TableHead>
                <TableHead>Org Default</TableHead>
                <TableHead>Well Override Min</TableHead>
                <TableHead>Well Override Max</TableHead>
                <TableHead>Reason for Override</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgRanges.map(orgRange => {
                const wellOverride = wellRanges.find(wr => wr.fieldName === orgRange.fieldName);
                return (
                  <TableRow key={orgRange.fieldName}>
                    <TableCell className="font-medium">{orgRange.fieldName}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {orgRange.minValue} - {orgRange.maxValue} {orgRange.unit}
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={wellOverride?.minValue || ''} placeholder={String(orgRange.minValue)} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={wellOverride?.maxValue || ''} placeholder={String(orgRange.maxValue)} />
                    </TableCell>
                    <TableCell>
                      <Input value={wellOverride?.reason || ''} placeholder="Why override?" />
                    </TableCell>
                    <TableCell>
                      {wellOverride ? (
                        <Button variant="ghost" size="sm" onClick={() => deleteOverride(wellOverride.id)}>
                          Reset to Default
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setOverride(orgRange.fieldName)}>
                          Set Override
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Alert Preferences Settings:**

```typescript
// apps/web/app/(dashboard)/settings/alerts/page.tsx
export default function AlertSettings() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<AlertPreferences | null>(null);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);

  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Alert Settings</h1>

      {/* User's own alert preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Your Alert Preferences</CardTitle>
          <CardDescription>
            Configure how you receive alerts about production anomalies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enable-alerts" className="text-base">Enable Alerts</Label>
              <p className="text-sm text-gray-500">Receive notifications for nominal range violations</p>
            </div>
            <Switch id="enable-alerts" checked={preferences?.enabled} onCheckedChange={...} />
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-base">Notification Channels</Label>
            <div className="flex items-center justify-between">
              <Label htmlFor="email-alerts">Email</Label>
              <Switch id="email-alerts" checked={preferences?.channels.email} onCheckedChange={...} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="sms-alerts">SMS</Label>
              <Switch id="sms-alerts" checked={preferences?.channels.sms} onCheckedChange={...} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin: Team-wide alert management */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Team Alert Management</CardTitle>
            <CardDescription>
              Manage alert settings for all team members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Alerts Enabled</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>SMS</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.map(member => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell>{member.role}</TableCell>
                    <TableCell>
                      <Switch checked={member.alertPreferences?.enabled} onCheckedChange={...} />
                    </TableCell>
                    <TableCell>
                      <Switch checked={member.alertPreferences?.channels.email} onCheckedChange={...} />
                    </TableCell>
                    <TableCell>
                      <Switch checked={member.alertPreferences?.channels.sms} onCheckedChange={...} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">Edit</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### 1.6 Keyboard Navigation Fix (Mobile)

**Issue**: Tab order on data entry form doesn't match visual order.

**Solution**: Add `returnKeyType="next"` and ref forwarding with explicit focus management:

```typescript
// apps/mobile/app/(tabs)/entry.tsx
// Create refs in correct tab order
const wellNameRef = useRef<TextInput>(null);
const productionVolumeRef = useRef<TextInput>(null);
const gasVolumeRef = useRef<TextInput>(null);
const waterVolumeRef = useRef<TextInput>(null);
const waterCutRef = useRef<TextInput>(null);
const pressureRef = useRef<TextInput>(null);
const temperatureRef = useRef<TextInput>(null);
const tankLevelRef = useRef<TextInput>(null);
const bswRef = useRef<TextInput>(null);
const gorRef = useRef<TextInput>(null);
const fluidLevelRef = useRef<TextInput>(null);
const casingPressureRef = useRef<TextInput>(null);
const tubingPressureRef = useRef<TextInput>(null);
// ... continue for all fields in visual order

// In component:
<TextInput
  ref={wellNameRef}
  returnKeyType="next"
  onSubmitEditing={() => productionVolumeRef.current?.focus()}
  // ...
/>
<TextInput
  ref={productionVolumeRef}
  returnKeyType="next"
  onSubmitEditing={() => gasVolumeRef.current?.focus()}
  // ...
/>
// ... continue for all fields
```

---

## Phase 2: Dashboard KPIs & Visualizations (Priority: HIGH)

### 2.1 Dashboard KPIs (Organization Overview)

**Key Performance Indicators:**
- **Total Production**: BOEPD (Barrels of Oil Equivalent Per Day)
- **Active Wells**: Count + % change vs. last period
- **Well Downtime**: Total hours + top 5 wells by downtime
- **Water Cut**: Average % across all wells + trend
- **Production Cost**: Cost per BOE + breakdown by category
- **Carbon Emissions**: Estimated tons CO2e + ESG compliance status
- **Alerts**: Count of unacknowledged critical alerts
- **Revenue (if integrated with accounting)**: Estimated based on production × commodity prices

**Implementation:**

```typescript
// apps/api/src/application/analytics/queries/get-dashboard-kpis.query.ts
export interface DashboardKPIs {
  totalProduction: {
    boepd: number;
    change: number; // % change vs. previous period
    trend: 'up' | 'down' | 'stable';
  };
  activeWells: {
    count: number;
    total: number;
    change: number;
  };
  downtime: {
    totalHours: number;
    topWells: Array<{ wellId: string; wellName: string; hours: number; reason: string }>;
  };
  waterCut: {
    average: number;
    trend: Array<{ date: string; value: number }>;
  };
  costPerBOE: {
    amount: number;
    breakdown: { labor: number; chemical: number; maintenance: number; power: number };
  };
  carbonEmissions: {
    tonsC02e: number;
    complianceStatus: 'compliant' | 'warning' | 'violation';
  };
  alerts: {
    unacknowledged: number;
    critical: number;
    warning: number;
  };
}

// Query handler calculates from field_entries aggregated over last 24 hours / 7 days / 30 days
```

**UI Components:**

```typescript
// apps/web/app/(dashboard)/page.tsx
export default function Dashboard() {
  const { data: kpis } = useQuery({ queryKey: ['dashboard-kpis'], queryFn: api.getDashboardKPIs });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Production</CardTitle>
            <Oil className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.totalProduction.boepd.toLocaleString()} BOEPD</div>
            <p className="text-xs text-muted-foreground">
              <span className={kpis?.totalProduction.change > 0 ? 'text-green-600' : 'text-red-600'}>
                {kpis?.totalProduction.change > 0 ? '+' : ''}{kpis?.totalProduction.change}%
              </span> from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Wells</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.activeWells.count} / {kpis?.activeWells.total}</div>
            <p className="text-xs text-muted-foreground">
              {((kpis?.activeWells.count / kpis?.activeWells.total) * 100).toFixed(1)}% uptime
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost per BOE</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${kpis?.costPerBOE.amount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Per barrel of oil equivalent</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unacknowledged Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{kpis?.alerts.unacknowledged}</div>
            <p className="text-xs text-muted-foreground">
              {kpis?.alerts.critical} critical, {kpis?.alerts.warning} warning
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProductionTrendChart />
        <WaterCutTrendChart />
        <DowntimeByWellChart />
        <CostBreakdownChart />
      </div>
    </div>
  );
}
```

### 2.2 Well Detail Page with Gauges & Charts

**Gauges** (using Recharts or react-gauge-chart):
- Production rate (current vs. 30-day average)
- Pressure gauge (current casing/tubing pressure)
- Water cut gauge (current %)
- Temperature gauge (current vs. normal range)

**Charts:**
- Production history (line chart, 30/60/90 days)
- Downtime analysis (bar chart by reason)
- Equipment runtime (beam pump SPM, motor amps over time)
- BS&W trend (line chart to identify increasing water content)

```typescript
// apps/web/app/(dashboard)/wells/[id]/page.tsx
export default function WellDetail({ params }: { params: { id: string } }) {
  const { data: well } = useQuery({ queryKey: ['well', params.id], queryFn: () => api.getWell(params.id) });
  const { data: analytics } = useQuery({ queryKey: ['well-analytics', params.id], queryFn: () => api.getWellAnalytics(params.id) });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{well?.name}</h1>
        <Badge variant={well?.status === 'active' ? 'success' : 'destructive'}>
          {well?.status}
        </Badge>
      </div>

      {/* Gauges Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Production Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <GaugeChart
              id="production-gauge"
              nrOfLevels={3}
              percent={analytics?.production.current / analytics?.production.max}
              colors={['#DC2626', '#F59E0B', '#10B981']}
              arcWidth={0.3}
              textColor="#111827"
            />
            <p className="text-center text-sm mt-2">{analytics?.production.current} bbl/day</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Casing Pressure</CardTitle>
          </CardHeader>
          <CardContent>
            <GaugeChart
              id="pressure-gauge"
              nrOfLevels={3}
              percent={analytics?.pressure.casing / analytics?.pressure.maxSafe}
              colors={['#10B981', '#F59E0B', '#DC2626']}
              arcWidth={0.3}
              textColor="#111827"
            />
            <p className="text-center text-sm mt-2">{analytics?.pressure.casing} psi</p>
          </CardContent>
        </Card>

        {/* Similar gauges for water cut and temperature */}
      </div>

      {/* Production Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Production History (30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics?.productionHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="oil" stroke="#10B981" name="Oil (bbl)" />
              <Line type="monotone" dataKey="gas" stroke="#3B82F6" name="Gas (mcf)" />
              <Line type="monotone" dataKey="water" stroke="#6366F1" name="Water (bbl)" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Downtime Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Downtime by Reason (Last 90 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics?.downtimeByReason}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="reason" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="hours" fill="#DC2626" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Phase 3: Advanced Reporting Suite (Priority: HIGH)

Based on RigReports feature set, implement 20+ report types:

### 3.1 Report Types

**Production Reports:**
1. Daily Production Report (by well, by field, by operator)
2. Monthly Production Summary
3. Production Decline Curve Analysis
4. Water Cut Trend Report
5. Gas-to-Oil Ratio Analysis
6. Production vs. Forecast Variance

**Operational Reports:**
7. Well Downtime Report (by well, by reason, by timeframe)
8. Equipment Failure Analysis
9. Maintenance Schedule & Compliance
10. Pump Performance Report (SPM, runtime, efficiency)
11. Completion Activity Report

**Financial Reports:**
12. Cost per BOE by Well
13. Operating Expense Breakdown
14. AFE (Authorization for Expenditure) Tracking
15. Revenue by Well (if commodity pricing integrated)
16. Workover Cost Analysis

**Compliance & Safety Reports:**
17. Daily Inspection Checklist Summary
18. Safety Equipment Status
19. Environmental Compliance (spills, leaks, emissions)
20. Regulatory Reporting (RRC Texas Form 1, etc.)

**Analytics Reports:**
21. Production Outlier Detection (ML-powered)
22. Predictive Maintenance Recommendations
23. Well Health Score (composite metric)
24. Comparative Well Performance

### 3.2 Implementation

**Backend:**

```typescript
// apps/api/src/application/reports/queries/
export class GenerateDailyProductionReportQuery {
  tenantId: string;
  date: Date;
  wellIds?: string[]; // Optional filter
  format: 'pdf' | 'excel' | 'csv';
}

export class GenerateWellDowntimeReportQuery {
  tenantId: string;
  startDate: Date;
  endDate: Date;
  groupBy: 'well' | 'reason' | 'date';
  format: 'pdf' | 'excel' | 'csv';
}

// apps/api/src/infrastructure/reporting/
export class ReportGenerationService {
  async generateDailyProductionReport(tenantId: string, date: Date): Promise<Buffer> {
    // 1. Query field_entries for given date
    // 2. Aggregate by well
    // 3. Calculate totals, averages
    // 4. Generate PDF using PDFKit or Excel using ExcelJS
    // 5. Return buffer
  }

  async generateDowntimeReport(tenantId: string, startDate: Date, endDate: Date, groupBy: string): Promise<Buffer> {
    // Similar aggregation and PDF/Excel generation
  }
}
```

**Frontend (Web Portal):**

```typescript
// apps/web/app/(dashboard)/reports/page.tsx
export default function Reports() {
  const [selectedReport, setSelectedReport] = useState<string>('daily-production');
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(/* last 30 days */);
  const [format, setFormat] = useState<'pdf' | 'excel' | 'csv'>('pdf');

  const { mutate: generateReport, isLoading } = useMutation({
    mutationFn: (params) => api.generateReport(selectedReport, params),
    onSuccess: (data) => {
      // Download generated report
      const blob = new Blob([data], { type: format === 'pdf' ? 'application/pdf' : 'application/vnd.ms-excel' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedReport}-${format}.${format}`;
      a.click();
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Reports</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Report Type Selection */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Report Types</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedReport} onValueChange={setSelectedReport}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Production</SelectLabel>
                  <SelectItem value="daily-production">Daily Production</SelectItem>
                  <SelectItem value="monthly-production">Monthly Production</SelectItem>
                  <SelectItem value="decline-curve">Decline Curve Analysis</SelectItem>
                  <SelectItem value="water-cut-trend">Water Cut Trend</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Operational</SelectLabel>
                  <SelectItem value="downtime">Well Downtime</SelectItem>
                  <SelectItem value="equipment-failure">Equipment Failure</SelectItem>
                  <SelectItem value="maintenance">Maintenance Schedule</SelectItem>
                  <SelectItem value="pump-performance">Pump Performance</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Financial</SelectLabel>
                  <SelectItem value="cost-per-boe">Cost per BOE</SelectItem>
                  <SelectItem value="opex-breakdown">OPEX Breakdown</SelectItem>
                  <SelectItem value="afe-tracking">AFE Tracking</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Compliance</SelectLabel>
                  <SelectItem value="inspection-summary">Inspection Summary</SelectItem>
                  <SelectItem value="environmental">Environmental Compliance</SelectItem>
                  <SelectItem value="regulatory">Regulatory Reporting</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Report Parameters & Preview */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Report Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Date Range</Label>
                <DateRangePicker value={dateRange} onChange={setDateRange} />
              </div>
              <div>
                <Label>Format</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="excel">Excel</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={() => generateReport({ dateRange, format })} disabled={isLoading}>
              {isLoading ? 'Generating...' : 'Generate Report'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## Phase 4: Advanced RBAC & Role Management (Priority: MEDIUM)

### 4.1 Custom Role Creation

**Current State**: Fixed roles (admin, manager, consultant, operator)

**New Capability**: Admins can:
- Create custom roles with specific permissions
- Clone existing roles and modify
- Assign/remove multiple roles per user
- Set default permissions for new roles

**Database Changes:**

```sql
-- Tenant DB
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name VARCHAR NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT FALSE, -- Cannot delete/modify system roles
  permissions JSONB NOT NULL, -- { "wells": { "read": true, "write": false, "delete": false }, ... }
  created_at TIMESTAMP,
  created_by UUID REFERENCES users(id)
);

CREATE TABLE user_roles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  role_id UUID NOT NULL REFERENCES roles(id),
  assigned_at TIMESTAMP,
  assigned_by UUID REFERENCES users(id)
);

-- Seed default roles
INSERT INTO roles (id, tenant_id, name, is_system_role, permissions) VALUES
  ('admin-role-id', 'tenant-id', 'Admin', TRUE, '{"wells": {"read": true, "write": true, "delete": true}, "users": {"read": true, "write": true, "delete": true}, ...}'),
  ('manager-role-id', 'tenant-id', 'Manager', TRUE, '{"wells": {"read": true, "write": true, "delete": false}, "users": {"read": true, "write": false}, ...}'),
  ('consultant-role-id', 'tenant-id', 'Consultant', TRUE, '{"wells": {"read": true, "write": true, "delete": false}, "users": {"read": false}, ...}'),
  ('operator-role-id', 'tenant-id', 'Operator', TRUE, '{"wells": {"read": true, "write": false}, "field_entries": {"read": true, "write": true}, ...}');
```

**Backend Implementation:**

```typescript
// apps/api/src/application/rbac/commands/
export class CreateRoleCommand {
  tenantId: string;
  name: string;
  description?: string;
  permissions: Record<string, Record<string, boolean>>; // { resource: { action: boolean } }
  createdBy: string;
}

export class UpdateRolePermissionsCommand {
  tenantId: string;
  roleId: string;
  permissions: Record<string, Record<string, boolean>>;
  updatedBy: string;
}

export class AssignRoleToUserCommand {
  tenantId: string;
  userId: string;
  roleId: string;
  assignedBy: string;
}

// apps/api/src/presentation/rbac/rbac.controller.ts
@Controller('api/rbac')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RBACController {

  @Get('roles')
  @Roles('admin')
  async getRoles(@TenantContext() tenantId: string) {
    // Return all roles for tenant
  }

  @Post('roles')
  @Roles('admin')
  async createRole(@TenantContext() tenantId: string, @Body() dto: CreateRoleDto, @User() user) {
    // Create custom role
  }

  @Put('roles/:roleId')
  @Roles('admin')
  async updateRole(@TenantContext() tenantId: string, @Param('roleId') roleId: string, @Body() dto: UpdateRoleDto, @User() user) {
    // Update role permissions (cannot modify system roles)
  }

  @Delete('roles/:roleId')
  @Roles('admin')
  async deleteRole(@TenantContext() tenantId: string, @Param('roleId') roleId: string) {
    // Delete custom role (cannot delete system roles)
  }

  @Post('users/:userId/roles/:roleId')
  @Roles('admin')
  async assignRole(@TenantContext() tenantId: string, @Param('userId') userId: string, @Param('roleId') roleId: string, @User() user) {
    // Assign role to user
  }

  @Delete('users/:userId/roles/:roleId')
  @Roles('admin')
  async removeRole(@TenantContext() tenantId: string, @Param('userId') userId: string, @Param('roleId') roleId: string) {
    // Remove role from user
  }
}
```

**Frontend (Web Portal):**

```typescript
// apps/web/app/(dashboard)/settings/roles/page.tsx
export default function RolesManagement() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Role Management</h1>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Custom Role
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roles List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {roles.map(role => (
                <div
                  key={role.id}
                  className={`p-3 rounded-lg cursor-pointer ${selectedRole?.id === role.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}`}
                  onClick={() => setSelectedRole(role)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{role.name}</p>
                      <p className="text-sm text-gray-500">{role.description}</p>
                    </div>
                    {role.isSystemRole && (
                      <Badge variant="outline">System</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Role Permissions Editor */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{selectedRole ? `Edit ${selectedRole.name}` : 'Select a role'}</CardTitle>
            {selectedRole?.isSystemRole && (
              <Alert>
                <AlertDescription>
                  This is a system role. You can view its permissions but cannot modify it.
                </AlertDescription>
              </Alert>
            )}
          </CardHeader>
          <CardContent>
            {selectedRole && (
              <div className="space-y-4">
                <div>
                  <Label>Role Name</Label>
                  <Input value={selectedRole.name} disabled={selectedRole.isSystemRole} onChange={...} />
                </div>

                <div>
                  <Label>Description</Label>
                  <Textarea value={selectedRole.description} disabled={selectedRole.isSystemRole} onChange={...} />
                </div>

                <Separator />

                <div>
                  <Label className="text-base">Permissions</Label>
                  <Table className="mt-2">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Resource</TableHead>
                        <TableHead>Read</TableHead>
                        <TableHead>Write</TableHead>
                        <TableHead>Delete</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(selectedRole.permissions).map(([resource, actions]) => (
                        <TableRow key={resource}>
                          <TableCell className="font-medium capitalize">{resource}</TableCell>
                          <TableCell>
                            <Checkbox checked={actions.read} disabled={selectedRole.isSystemRole} onCheckedChange={...} />
                          </TableCell>
                          <TableCell>
                            <Checkbox checked={actions.write} disabled={selectedRole.isSystemRole} onCheckedChange={...} />
                          </TableCell>
                          <TableCell>
                            <Checkbox checked={actions.delete} disabled={selectedRole.isSystemRole} onCheckedChange={...} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {!selectedRole.isSystemRole && (
                  <div className="flex gap-2">
                    <Button onClick={() => updateRole(selectedRole)}>Save Changes</Button>
                    <Button variant="destructive" onClick={() => deleteRole(selectedRole.id)}>Delete Role</Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## Phase 5: Azure Entra ID Integration (Priority: MEDIUM)

### 5.1 Multi-Tenant Azure Entra ID Setup

**Requirements:**
1. Register WellPulse as multi-tenant application in Azure
2. Each tenant org can authenticate via their own Azure AD
3. Support RBAC from Azure (sync App Roles → WellPulse roles)
4. Conditional Access compliance
5. Cross-tenant user sync (optional for enterprise clients)

**Implementation Steps:**

**1. Azure AD App Registration:**
```bash
# Register multi-tenant application
az ad app create \
  --display-name "WellPulse Production" \
  --sign-in-audience AzureADMultipleOrgs \
  --web-redirect-uris "https://wellpulse.io/auth/callback" "https://*.wellpulse.io/auth/callback"

# Create App Roles in manifest
{
  "appRoles": [
    {
      "allowedMemberTypes": ["User"],
      "displayName": "WellPulse Admin",
      "id": "admin-role-guid",
      "isEnabled": true,
      "description": "Full access to WellPulse",
      "value": "wellpulse.admin"
    },
    {
      "allowedMemberTypes": ["User"],
      "displayName": "WellPulse Manager",
      "id": "manager-role-guid",
      "isEnabled": true,
      "description": "Manager access to WellPulse",
      "value": "wellpulse.manager"
    },
    // ... more roles
  ]
}
```

**2. Backend Integration (NestJS):**

```typescript
// apps/api/src/infrastructure/auth/strategies/azure-ad.strategy.ts
import { BearerStrategy } from 'passport-azure-ad';

@Injectable()
export class AzureADStrategy extends PassportStrategy(BearerStrategy, 'azure-ad') {
  constructor(private configService: ConfigService) {
    super({
      identityMetadata: `https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration`,
      clientID: configService.get('AZURE_AD_CLIENT_ID'),
      validateIssuer: true,
      issuer: null, // Multi-tenant, validate dynamically
      passReqToCallback: false,
      loggingLevel: 'info',
      scope: ['openid', 'profile', 'email'],
    });
  }

  async validate(payload: any): Promise<any> {
    // 1. Validate token issuer against allowed tenant list
    const tenantId = payload.tid; // Azure AD Tenant ID
    const allowedTenant = await this.tenantService.findByAzureTenantId(tenantId);

    if (!allowedTenant) {
      throw new UnauthorizedException('Tenant not authorized');
    }

    // 2. Extract user info and roles from token
    const azureRoles = payload.roles || []; // App Roles assigned in Azure AD

    // 3. Map Azure AD roles to WellPulse roles
    const wellpulseRoles = this.mapAzureRolesToWellPulseRoles(azureRoles);

    // 4. Find or create user in WellPulse
    let user = await this.userService.findByAzureObjectId(payload.oid);

    if (!user) {
      user = await this.userService.createFromAzureAD({
        azureObjectId: payload.oid,
        email: payload.email || payload.upn,
        name: payload.name,
        tenantId: allowedTenant.id,
        roles: wellpulseRoles,
      });
    } else {
      // Update roles from Azure AD (single source of truth)
      await this.userService.updateRoles(user.id, wellpulseRoles);
    }

    return { userId: user.id, tenantId: allowedTenant.id, roles: wellpulseRoles };
  }

  private mapAzureRolesToWellPulseRoles(azureRoles: string[]): string[] {
    const roleMap = {
      'wellpulse.admin': 'admin',
      'wellpulse.manager': 'manager',
      'wellpulse.consultant': 'consultant',
      'wellpulse.operator': 'operator',
    };

    return azureRoles.map(role => roleMap[role]).filter(Boolean);
  }
}

// apps/api/src/presentation/auth/auth.controller.ts
@Controller('api/auth')
export class AuthController {

  @Post('azure-ad/login')
  @UseGuards(AuthGuard('azure-ad'))
  async azureLogin(@User() user, @Res() res: Response) {
    // Generate JWT token for WellPulse
    const token = this.jwtService.sign({ userId: user.userId, tenantId: user.tenantId });

    // Set httpOnly cookie
    res.cookie('access_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.json({ success: true, user });
  }
}
```

**3. Tenant Onboarding Flow:**

When a new organization signs up:
1. Org admin provides their Azure AD Tenant ID
2. WellPulse registers the tenant in `tenants` table with `azure_tenant_id`
3. Admin grants consent for WellPulse to access their Azure AD:
   ```
   https://login.microsoftonline.com/{azure_tenant_id}/adminconsent?client_id={wellpulse_client_id}&redirect_uri={callback_url}
   ```
4. Users from that organization can now sign in using their Azure AD credentials
5. Roles are synced from Azure AD App Roles

**4. Database Schema Updates:**

```sql
-- Master DB
ALTER TABLE tenants ADD COLUMN azure_tenant_id VARCHAR UNIQUE;
ALTER TABLE tenants ADD COLUMN sso_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN sso_provider VARCHAR; -- 'azure-ad', 'okta', 'auth0', etc.

-- Tenant DB
ALTER TABLE users ADD COLUMN azure_object_id VARCHAR UNIQUE;
ALTER TABLE users ADD COLUMN sso_provider VARCHAR;
ALTER TABLE users ADD COLUMN last_sso_sync TIMESTAMP;
```

### 5.2 Conditional Access Support

WellPulse API respects Azure AD Conditional Access policies:
- MFA enforcement (validated via token claims)
- Device compliance (validated via token claims)
- Location-based access (IP restrictions from Azure)

No additional WellPulse code needed—Azure AD enforces at authentication time.

---

## Phase 6: Additional Enterprise Features

### 6.1 Automated Report Scheduling

**Feature**: Schedule reports to auto-generate and email daily/weekly/monthly

```typescript
// apps/api/src/application/reports/commands/
export class ScheduleReportCommand {
  tenantId: string;
  reportType: string;
  schedule: 'daily' | 'weekly' | 'monthly';
  recipients: string[]; // Email addresses
  parameters: Record<string, any>; // Report-specific params (date range, wells, etc.)
  format: 'pdf' | 'excel' | 'csv';
  createdBy: string;
}

// apps/api/src/infrastructure/jobs/report-scheduler.job.ts
@Injectable()
export class ReportSchedulerJob {
  @Cron('0 6 * * *') // 6 AM daily
  async generateScheduledReports() {
    const scheduledReports = await this.reportScheduleRepo.findDueReports();

    for (const schedule of scheduledReports) {
      const report = await this.reportService.generate(schedule.reportType, schedule.parameters);

      for (const recipient of schedule.recipients) {
        await this.emailService.sendReportEmail(recipient, report, schedule.reportType);
      }

      await this.reportScheduleRepo.updateLastRun(schedule.id, new Date());
    }
  }
}
```

### 6.2 Export/Import Configuration

**Feature**: Admins can export/import nominal ranges, roles, alert preferences across tenants

```typescript
// apps/api/src/application/config/commands/
export class ExportTenantConfigCommand {
  tenantId: string;
  includeRoles: boolean;
  includeNominalRanges: boolean;
  includeAlertPreferences: boolean;
}

export class ImportTenantConfigCommand {
  tenantId: string;
  config: TenantConfigExport; // JSON with roles, nominal ranges, etc.
  overwriteExisting: boolean;
}
```

### 6.3 Audit Logging

**Feature**: Complete audit trail of all data changes and user actions

```sql
-- Tenant DB
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID REFERENCES users(id),
  action VARCHAR NOT NULL, -- 'create', 'update', 'delete', 'login', 'export', etc.
  resource_type VARCHAR NOT NULL, -- 'well', 'field_entry', 'user', 'role', etc.
  resource_id UUID,
  old_value JSONB, -- Previous state (for updates/deletes)
  new_value JSONB, -- New state (for creates/updates)
  ip_address VARCHAR,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_log_tenant ON audit_log(tenant_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
```

---

## Implementation Timeline & Priorities

### Sprint 4A (Week 1-2): Nominal Ranges & Alerts
- ✅ **CRITICAL**: Nominal range database schema
- ✅ **CRITICAL**: Backend validation service
- ✅ **CRITICAL**: Mobile visual indicators (red background)
- ✅ **CRITICAL**: Alert notifications (email/SMS)
- ✅ **HIGH**: Web portal nominal range settings
- ✅ **HIGH**: Well-specific overrides
- ✅ **HIGH**: Alert preferences management
- ✅ **MEDIUM**: Test data generation button
- ✅ **MEDIUM**: Keyboard navigation fix

### Sprint 4B (Week 3-4): Dashboard & Visualizations
- ✅ **HIGH**: Dashboard KPIs (BOEPD, active wells, cost/BOE, alerts)
- ✅ **HIGH**: Production trend charts
- ✅ **HIGH**: Well detail gauges
- ✅ **HIGH**: Water cut / downtime charts
- ✅ **MEDIUM**: Export to Excel/PDF

### Sprint 4C (Week 5-6): Reporting Suite
- ✅ **HIGH**: Report generation backend (5 core reports)
- ✅ **HIGH**: Report UI (selection, parameters, download)
- ✅ **MEDIUM**: Report scheduling (automated delivery)
- ✅ **MEDIUM**: Additional 15+ report types

### Sprint 4D (Week 7-8): Advanced RBAC
- ✅ **MEDIUM**: Custom role creation
- ✅ **MEDIUM**: Permission matrix UI
- ✅ **MEDIUM**: Multi-role assignment
- ✅ **LOW**: Role cloning

### Sprint 4E (Week 9-10): Azure Entra ID
- ✅ **MEDIUM**: Multi-tenant Azure AD setup
- ✅ **MEDIUM**: SSO authentication flow
- ✅ **MEDIUM**: Role sync from Azure AD
- ✅ **LOW**: Conditional Access support docs

---

## Additional Competitor Research Recommendations

**Must Research:**
1. **WellView Allez** - Well operations & downtime tracking specifics
2. **P2 BOLO** - Accounting integration features
3. **Quorum WellEZ** - Production accounting workflows
4. **Enverus (formerly DrillingInfo)** - Analytics & benchmarking
5. **ComboCurve** - Decline curve analysis & forecasting

**Feature Gaps to Address:**
- SCADA integration (real-time data ingestion from RTUs)
- Land management (lease tracking, royalty calculations)
- Regulatory compliance automation (RRC Form 1 auto-fill)
- AFE (Authorization for Expenditure) workflow
- Well planning & drilling programs

---

## Questions for Clarification

1. **SMS Provider**: Which SMS service should we use? (Twilio, AWS SNS, Azure Communication Services)
2. **Commodity Pricing**: Should we integrate with external APIs for oil/gas prices, or manual entry?
3. **Report Branding**: Do we need white-label report templates per tenant?
4. **SCADA Integration**: Priority for real-time sensor data ingestion? (This is a major feature)
5. **Regulatory Automation**: Which state(s) regulatory forms should we support first? (Texas RRC, New Mexico OCD, etc.)
6. **Mobile Offline**: Should test data generation work offline? (Currently requires API call for validation)

---

## Success Metrics

**Phase 1 (Nominal Ranges & Alerts):**
- Zero false negatives (all out-of-range values flagged)
- <5% false positives (values flagged incorrectly)
- <1 minute delay for alert delivery after sync
- 100% of managers receive alerts when configured

**Phase 2 (Dashboard):**
- Dashboard loads in <2 seconds
- All KPIs accurate within 0.1% of source data
- Charts render smoothly on mobile and desktop

**Phase 3 (Reporting):**
- Reports generate in <10 seconds for 30-day data
- PDF/Excel formatting matches industry standards
- Zero errors in scheduled report delivery

**Phase 4 (RBAC):**
- Admins can create custom roles in <5 minutes
- Permission changes take effect immediately
- Zero unauthorized access incidents

**Phase 5 (Azure Entra):**
- SSO login completes in <3 seconds
- 100% role sync accuracy from Azure AD
- Support 100+ concurrent SSO authentications

---

This plan transforms WellPulse into an enterprise-grade platform while maintaining focus on small-medium Permian Basin operators. Let me know which phases to prioritize for immediate implementation!
