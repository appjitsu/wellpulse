# Feature Flags Guide

**Version**: 1.0
**Last Updated**: October 29, 2025

Complete guide to using the feature flags system in WellPulse for tier-based access control and progressive feature rollout.

---

## Overview

Feature flags enable:
- **Tier-Based Access Control**: Automatically enable/disable features based on subscription tier
- **Progressive Rollout**: Gradually enable beta features for testing
- **Tenant-Level Overrides**: Grant early access or disable features for specific tenants
- **Clear Feature Registry**: Centralized documentation of all features and requirements

---

## Feature Registry

All features are defined in `src/application/feature-flags/feature-flags.service.ts`:

```typescript
const FEATURE_REGISTRY: Record<string, Feature> = {
  advancedML: {
    key: 'advancedML',
    name: 'Advanced ML & Predictive Analytics',
    description: 'Machine learning models for predictive maintenance',
    minimumTier: 'PROFESSIONAL',  // Requires PROFESSIONAL or higher
    isBeta: false,
    defaultEnabled: true,
  },
  aiAssistant: {
    key: 'aiAssistant',
    name: 'AI Assistant',
    description: 'Natural language AI assistant for data queries',
    minimumTier: null,  // Available to all tiers
    isBeta: true,       // Beta feature - requires opt-in
    defaultEnabled: false,
  },
};
```

### Feature Properties

- **key**: Unique identifier (use in code)
- **name**: Display name for users
- **description**: Feature description
- **minimumTier**: `'STARTER'`, `'PROFESSIONAL'`, `'ENTERPRISE'`, `'ENTERPRISE_PLUS'`, or `null` (all tiers)
- **isBeta**: Whether feature is in beta (gradual rollout)
- **defaultEnabled**: Default state for qualifying tiers

---

## Subscription Tier Hierarchy

```
STARTER (Free/Trial)
  ↓
PROFESSIONAL ($299/month)
  ↓
ENTERPRISE ($999/month)
  ↓
ENTERPRISE_PLUS ($1,999/month)
```

Features with `minimumTier: 'PROFESSIONAL'` are available to PROFESSIONAL, ENTERPRISE, and ENTERPRISE_PLUS.

---

## Using Feature Flags

### 1. Protecting Routes with `@RequiresFeature()`

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, FeatureFlagGuard } from '../guards';
import { RequiresFeature } from '../decorators';

@Controller('ml')
@UseGuards(JwtAuthGuard, FeatureFlagGuard)
export class MLController {

  @Get('predict')
  @RequiresFeature('advancedML')
  async predict() {
    // Only tenants with advancedML enabled can access
    // Automatically returns 403 Forbidden if feature not enabled
  }

  @Get('beta-forecast')
  @RequiresFeature('productionForecasting')
  async forecast() {
    // Beta feature - requires manual enablement per tenant
  }
}
```

### 2. Checking Features Programmatically

```typescript
import { Injectable } from '@nestjs/common';
import { FeatureFlagsService } from '../../application/feature-flags/feature-flags.service';

@Injectable()
export class WellsService {
  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  async getWellDetails(tenantId: string, wellId: string) {
    const hasML = await this.featureFlagsService.isFeatureEnabled(
      tenantId,
      'advancedML',
    );

    const wellData = await this.fetchWellData(wellId);

    if (hasML) {
      // Include ML predictions
      wellData.predictions = await this.generatePredictions(wellId);
    }

    return wellData;
  }

  // Check multiple features at once
  async getAvailableFeatures(tenantId: string) {
    return this.featureFlagsService.areFeaturesEnabled(tenantId, [
      'advancedML',
      'anomalyDetection',
      'customReports',
    ]);
    // Returns: { advancedML: true, anomalyDetection: true, customReports: false }
  }
}
```

### 3. Getting All Feature Flags for UI

```typescript
@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  @Get('features')
  @UseGuards(JwtAuthGuard)
  async getFeatures(@TenantId() tenantId: string) {
    // Get all features with their enabled state
    const flags = await this.featureFlagsService.getAllFeatureFlags(tenantId);

    return {
      features: flags,
      // Returns:
      // {
      //   advancedML: true,
      //   anomalyDetection: true,
      //   productionForecasting: false,
      //   customIntegrations: false,
      //   ...
      // }
    };
  }
}
```

---

## Feature Evaluation Logic

For each feature check, the system evaluates in this order:

1. **Tenant-Specific Override**: Check `tenant.featureFlags[featureKey]`
   - If exists, use that value (true/false)
   - This allows enabling features for testing or disabling for specific tenants

2. **Tier Eligibility**: Check if tenant's tier qualifies
   - If `minimumTier` is set, compare tenant tier
   - If tenant tier is lower, feature is disabled

3. **Default State**: Fall back to `feature.defaultEnabled`
   - Beta features typically have `defaultEnabled: false`

### Example Evaluation

```typescript
// Feature: productionForecasting
// - minimumTier: 'ENTERPRISE'
// - isBeta: true
// - defaultEnabled: false

// Tenant A: PROFESSIONAL tier, no overrides
isFeatureEnabled(tenantA, 'productionForecasting')
// → false (tier too low)

// Tenant B: ENTERPRISE tier, no overrides
isFeatureEnabled(tenantB, 'productionForecasting')
// → false (beta feature, not enabled by default)

// Tenant C: ENTERPRISE tier, override: { productionForecasting: true }
isFeatureEnabled(tenantC, 'productionForecasting')
// → true (override enabled for beta testing)

// Tenant D: STARTER tier, override: { productionForecasting: true }
isFeatureEnabled(tenantD, 'productionForecasting')
// → true (override allows access even though tier is too low)
```

---

## Managing Tenant-Level Overrides

### Enabling Beta Features for Testing

```typescript
// Enable a beta feature for a specific tenant
await featureFlagsService.enableFeatureForTenant(
  'tenant-123',
  'aiAssistant',
);

// Now tenant-123 can access aiAssistant even though it's beta
```

### Disabling Features

```typescript
// Disable a feature for a specific tenant (e.g., due to usage concerns)
await featureFlagsService.disableFeatureForTenant(
  'tenant-456',
  'customIntegrations',
);
```

### Database Storage

Feature flag overrides are stored in the `tenants` table:

```sql
-- tenants table
CREATE TABLE tenants (
  ...
  feature_flags JSONB,  -- { "aiAssistant": true, "productionForecasting": true }
  ...
);
```

---

## Error Handling

### Feature Not Enabled (403 Forbidden)

When `@RequiresFeature()` guard denies access:

```json
{
  "statusCode": 403,
  "message": "Access denied. The \"Advanced ML & Predictive Analytics\" feature is not enabled for your account. This feature requires PROFESSIONAL tier or higher. Please contact support to upgrade your plan.",
  "error": "Forbidden",
  "correlationId": "a1b2c3d4e5f6g7h8",
  "timestamp": "2025-10-29T12:34:56.789Z",
  "path": "/ml/predict",
  "method": "GET"
}
```

### Missing Tenant Context (401 Unauthorized)

If tenant context is not set (middleware issue):

```json
{
  "statusCode": 401,
  "message": "Tenant context required. Ensure you are accessing via a valid tenant subdomain.",
  "error": "Unauthorized"
}
```

---

## Adding New Features

### Step 1: Define Feature in Registry

Edit `src/application/feature-flags/feature-flags.service.ts`:

```typescript
const FEATURE_REGISTRY: Record<string, Feature> = {
  // ... existing features ...

  // New feature
  realtimeCollaboration: {
    key: 'realtimeCollaboration',
    name: 'Real-time Collaboration',
    description: 'Live cursors and real-time editing',
    minimumTier: 'ENTERPRISE',
    isBeta: true,
    defaultEnabled: false,
  },
};
```

### Step 2: Protect Routes

```typescript
@Controller('collaboration')
@UseGuards(JwtAuthGuard, FeatureFlagGuard)
export class CollaborationController {

  @Get('session')
  @RequiresFeature('realtimeCollaboration')
  async getSession() {
    // Feature-protected endpoint
  }
}
```

### Step 3: Check in Code (Optional)

```typescript
const hasCollab = await featureFlagsService.isFeatureEnabled(
  tenantId,
  'realtimeCollaboration',
);

if (hasCollab) {
  // Enable real-time WebSocket connections
}
```

### Step 4: Gradual Rollout

1. **Beta Testing**: Enable for select tenants
   ```typescript
   await featureFlagsService.enableFeatureForTenant('tenant-123', 'realtimeCollaboration');
   ```

2. **Tier Rollout**: Change `defaultEnabled: true` when ready
   ```typescript
   realtimeCollaboration: {
     // ...
     defaultEnabled: true,  // Now enabled for all ENTERPRISE+ tenants
   }
   ```

3. **General Availability**: Remove `minimumTier` to make available to all
   ```typescript
   realtimeCollaboration: {
     // ...
     minimumTier: null,  // Available to all tiers
   }
   ```

4. **Remove Flag**: Once fully rolled out, remove from registry and guards

---

## Current Features

### ML & Analytics
- `advancedML` - Advanced ML & Predictive Analytics (PROFESSIONAL+)
- `anomalyDetection` - Anomaly Detection (PROFESSIONAL+)
- `productionForecasting` - Production Forecasting (ENTERPRISE+, Beta)

### Integrations
- `customIntegrations` - Custom SCADA/ERP Integrations (ENTERPRISE+)
- `etlSync` - ETL Sync (ENTERPRISE_PLUS)
- `sapIntegration` - SAP Integration (ENTERPRISE_PLUS, Beta)

### Database
- `multiDatabase` - SQL Server, MySQL, Oracle Support (ENTERPRISE+)
- `onPremDatabase` - On-Premises Database Hosting (ENTERPRISE+)

### Collaboration
- `teamCollaboration` - Comments & Mentions (PROFESSIONAL+)
- `advancedRBAC` - Custom Roles & Permissions (ENTERPRISE+)

### Mobile
- `offlineMode` - Offline Mobile/Desktop (All Tiers)
- `photoAttachments` - Photo Attachments (All Tiers)

### Compliance
- `escCompliance` - ESG Compliance Reporting (PROFESSIONAL+)
- `customReports` - Custom Report Builder (PROFESSIONAL+)
- `auditLogs` - Audit Trail (PROFESSIONAL+)

### Support
- `prioritySupport` - 24/7 Priority Support (ENTERPRISE+)
- `slaGuarantee` - 99.9% SLA (ENTERPRISE_PLUS)

### Beta
- `aiAssistant` - AI Assistant (All Tiers, Beta)
- `mobileAppV2` - Next-Gen Mobile App (All Tiers, Beta)

---

## Best Practices

### 1. Use Feature Flags for Progressive Rollout
```typescript
// Start with beta flag
newFeature: {
  minimumTier: null,
  isBeta: true,
  defaultEnabled: false,  // Opt-in only
}

// After testing, enable for paid tiers
newFeature: {
  minimumTier: 'PROFESSIONAL',
  isBeta: false,
  defaultEnabled: true,  // Auto-enabled for qualifying tiers
}

// Eventually remove flag entirely (when fully stable)
```

### 2. Combine with RBAC for Fine-Grained Control
```typescript
@UseGuards(JwtAuthGuard, RolesGuard, FeatureFlagGuard)
@Roles('ADMIN')
@RequiresFeature('advancedML')
@Post('ml/train')
async trainModel() {
  // Requires ADMIN role AND advancedML feature
}
```

### 3. Provide Clear Error Messages
The FeatureFlagGuard automatically includes feature name and tier requirements in error messages.

### 4. Log Feature Access
```typescript
if (hasFeature) {
  logger.log(`Tenant ${tenantId} accessing feature: ${featureKey}`);
}
```

### 5. Clean Up Old Flags
Once a feature is fully rolled out and stable, remove the feature flag to reduce complexity:
- Remove from FEATURE_REGISTRY
- Remove `@RequiresFeature()` decorators
- Remove programmatic checks

---

## Frontend Integration

### Fetching Feature Flags

```typescript
// React Query hook
export function useFeatureFlags() {
  return useQuery({
    queryKey: ['featureFlags'],
    queryFn: async () => {
      const response = await fetch('/api/tenants/features', {
        credentials: 'include',
      });
      return response.json();
    },
  });
}

// Usage in component
function MLDashboard() {
  const { data: features } = useFeatureFlags();

  if (!features?.advancedML) {
    return <UpgradePrompt feature="Advanced ML" requiredTier="PROFESSIONAL" />;
  }

  return <MLPredictions />;
}
```

### Conditional Rendering

```typescript
function NavigationMenu() {
  const { data: features } = useFeatureFlags();

  return (
    <nav>
      <NavItem to="/dashboard">Dashboard</NavItem>
      <NavItem to="/wells">Wells</NavItem>
      {features?.advancedML && (
        <NavItem to="/ml">ML Predictions</NavItem>
      )}
      {features?.customReports && (
        <NavItem to="/reports">Custom Reports</NavItem>
      )}
    </nav>
  );
}
```

---

## Testing

### Unit Tests

```typescript
describe('FeatureFlagsService', () => {
  it('should enable feature for qualifying tier', async () => {
    const tenant = createTenant({ tier: 'ENTERPRISE' });

    const isEnabled = await service.isFeatureEnabled(
      tenant.id,
      'advancedML',
    );

    expect(isEnabled).toBe(true);
  });

  it('should disable feature for lower tier', async () => {
    const tenant = createTenant({ tier: 'STARTER' });

    const isEnabled = await service.isFeatureEnabled(
      tenant.id,
      'advancedML',  // Requires PROFESSIONAL
    );

    expect(isEnabled).toBe(false);
  });

  it('should respect tenant override', async () => {
    const tenant = createTenant({
      tier: 'STARTER',
      featureFlags: { advancedML: true },  // Override
    });

    const isEnabled = await service.isFeatureEnabled(
      tenant.id,
      'advancedML',
    );

    expect(isEnabled).toBe(true);  // Override wins
  });
});
```

### E2E Tests

```typescript
describe('Feature Flag Guard (E2E)', () => {
  it('should allow access when feature enabled', async () => {
    const { tenantId, accessToken } = await createTestTenant({
      tier: 'PROFESSIONAL',
    });

    const response = await request(app.getHttpServer())
      .get('/ml/predict')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Tenant-Subdomain', 'test');

    expect(response.status).toBe(200);
  });

  it('should deny access when feature disabled', async () => {
    const { tenantId, accessToken } = await createTestTenant({
      tier: 'STARTER',  // advancedML requires PROFESSIONAL
    });

    const response = await request(app.getHttpServer())
      .get('/ml/predict')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Tenant-Subdomain', 'test');

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('Advanced ML');
    expect(response.body.message).toContain('PROFESSIONAL');
  });
});
```

---

## Troubleshooting

### Feature Not Working Despite Correct Tier

1. Check tenant override: `SELECT feature_flags FROM tenants WHERE id = 'xxx'`
2. Verify feature key spelling
3. Check guard is applied: `@UseGuards(FeatureFlagGuard)`
4. Ensure tenant context is set (middleware must run first)

### 401 Unauthorized Error

- Ensure `TenantResolverMiddleware` is running before the route
- Check that subdomain or `X-Tenant-Subdomain` header is provided
- Verify tenant exists and is active

### Feature Flag Not Updating

- Feature flags are cached at the service level (check per request)
- Database overrides take effect immediately
- FEATURE_REGISTRY changes require application restart

---

## Related Patterns

- **Strategy Pattern**: See [docs/patterns/47-Strategy-Pattern.md](../patterns/47-Strategy-Pattern.md)
- **RBAC Pattern**: See [docs/patterns/43-RBAC-Pattern.md](../patterns/43-RBAC-Pattern.md)
- **Multi-Tenancy**: See [docs/patterns/69-Database-Per-Tenant-Multi-Tenancy-Pattern.md](../patterns/69-Database-Per-Tenant-Multi-Tenancy-Pattern.md)

---

## Summary

✅ **Define features** in FEATURE_REGISTRY with tier requirements
✅ **Protect routes** with `@RequiresFeature()` decorator
✅ **Check programmatically** using FeatureFlagsService
✅ **Progressive rollout** with beta flags and overrides
✅ **Clear errors** with feature name and tier requirements
✅ **Clean up** flags after full rollout

Feature flags provide a robust foundation for tier-based access control and progressive feature delivery across the WellPulse platform.
