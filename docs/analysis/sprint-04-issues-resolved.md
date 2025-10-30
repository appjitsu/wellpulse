# Sprint 4 Issues - Resolution Report

**Date**: October 29, 2025
**Scope**: Issues identified in Sprint 4 codebase analysis
**Status**: ✅ 1 of 2 medium-priority issues resolved

---

## Issues Identified

From the Sprint 4 codebase analysis, 2 medium-priority issues were found:

### Issue #1: Dashboard Metrics Not Using Alert System ✅ RESOLVED

**Priority**: P2 (Medium)
**Status**: ✅ **RESOLVED**
**Location**: `apps/api/src/application/dashboard/queries/get-dashboard-metrics.query.ts:132`
**Description**: Dashboard metrics query had a TODO comment to "implement alerts system", but the alert system is actually already implemented in Sprint 4.

**Root Cause**: The dashboard metrics query handler was written before the alert system was implemented and was never updated to use the new AlertRepository.

**Fix Applied**:

1. **Added IAlertRepository import**:
```typescript
import { IAlertRepository } from '../../../domain/repositories/alert.repository.interface';
```

2. **Injected AlertRepository in constructor**:
```typescript
constructor(
  @Inject('IWellRepository')
  private readonly wellRepository: IWellRepository,
  @Inject('IFieldEntryRepository')
  private readonly fieldEntryRepository: IFieldEntryRepository,
  @Inject('IAlertRepository')  // ← NEW
  private readonly alertRepository: IAlertRepository,
) {}
```

3. **Updated execute() to call getActiveAlertsMetric with tenantId**:
```typescript
const [totalWellsMetric, dailyProductionMetric, monthlyRevenueMetric, activeAlertsMetric] =
  await Promise.all([
    this.getTotalWellsMetric(tenantId),
    this.getDailyProductionMetric(tenantId),
    this.getMonthlyRevenueMetric(tenantId),
    this.getActiveAlertsMetric(tenantId), // ← NOW ASYNC
  ]);
```

4. **Implemented getActiveAlertsMetric() method**:
```typescript
/**
 * Get active (unacknowledged) alerts count
 */
private async getActiveAlertsMetric(tenantId: string): Promise<MetricDto> {
  const unacknowledgedCount = await this.alertRepository.countUnacknowledged(tenantId);

  // For now, return simple metric without trend calculation
  // TODO: Track historical counts to calculate actual change
  const change = unacknowledgedCount > 0 ? `+${unacknowledgedCount}` : '0';
  const trend: 'up' | 'down' | 'neutral' =
    unacknowledgedCount > 10 ? 'up' : unacknowledgedCount > 0 ? 'neutral' : 'neutral';

  return {
    value: unacknowledgedCount,
    change,
    trend,
  };
}
```

5. **Added AlertRepository to DashboardModule providers**:
```typescript
// In apps/api/src/presentation/dashboard/dashboard.module.ts
import { AlertRepository } from '../../infrastructure/database/repositories/alert.repository';

const Repositories = [
  WellRepository,
  FieldEntryRepository,
  AlertRepository,  // ← NEW
  {
    provide: 'IWellRepository',
    useExisting: WellRepository,
  },
  {
    provide: 'IFieldEntryRepository',
    useExisting: FieldEntryRepository,
  },
  {
    provide: 'IAlertRepository',  // ← NEW
    useExisting: AlertRepository,
  },
];
```

**Result**:
- ✅ Dashboard now shows **real unacknowledged alert counts** instead of hardcoded 0
- ✅ Alert count updates in real-time as alerts are created/acknowledged
- ✅ No new TypeScript compilation errors introduced
- ✅ Removed misleading TODO comment

**Files Modified**:
- `apps/api/src/application/dashboard/queries/get-dashboard-metrics.query.ts` (7 changes)
- `apps/api/src/presentation/dashboard/dashboard.module.ts` (2 changes)

---

### Issue #2: SMS Notifications Not Implemented ⏳ PENDING

**Priority**: P2 (Medium)
**Status**: ⏳ **PENDING** (Deferred to Sprint 5)
**Location**: `apps/api/src/application/alerts/services/alert-notification.service.ts`
**Description**: Email notifications are implemented, but SMS notifications via Azure Communication Services are not yet implemented.

**TODOs Found**:
```typescript
// TODO: Extend EmailService with sendGenericEmail method
// TODO: Implement SMS notifications using Twilio or AWS SNS
```

**Note**: Architecture decision specifies **Azure Communication Services** (not Twilio/AWS SNS).

**Recommendation**: Implement in Sprint 5 as part of advanced alerting features.

**Estimated Effort**: 4-6 hours

**Implementation Plan**:
1. Add Azure Communication Services SDK (`@azure/communication-sms`)
2. Create `SmsService` in infrastructure layer
3. Update `AlertNotificationService` to send SMS for critical alerts
4. Add user preferences for SMS notification opt-in
5. Add phone number to user profile (with validation)
6. Update alert preferences schema to include SMS settings

**Files To Modify**:
- `apps/api/src/infrastructure/services/sms.service.ts` (new)
- `apps/api/src/application/alerts/services/alert-notification.service.ts` (update)
- `apps/api/src/domain/users/user.entity.ts` (add phone number)
- `apps/api/src/infrastructure/database/schema/tenant/alert-preferences.schema.ts` (update)

---

## Pre-Existing Issues (Not Addressed)

The following TypeScript compilation errors exist but are **out of scope** for this issue resolution (they existed before Sprint 4):

1. **Test Mock Issues** (6 files):
   - Missing `findByAzureObjectId` in IUserRepository mocks
   - **Impact**: Test files fail to compile
   - **Recommendation**: Update test mocks to include new Azure AD method

2. **Alert Severity Enum Mismatch**:
   - `apps/api/src/presentation/alerts/alerts.controller.ts:110`
   - **Impact**: DTOs use different severity enum values
   - **Recommendation**: Align DTO enums with domain enums

3. **Nominal Range Severity Enum Mismatch**:
   - `apps/api/src/presentation/nominal-ranges/nominal-ranges.controller.ts:122`
   - **Impact**: DTOs use different severity enum values
   - **Recommendation**: Align DTO enums with domain enums

4. **Health Controller Test Issues**:
   - `apps/api/src/presentation/health/health.controller.spec.ts`
   - **Impact**: Test expects different method signature
   - **Recommendation**: Update test to match new HealthService implementation

5. **Import Issues in E2E Tests**:
   - `test/app.e2e-spec.ts`, `test/auth/auth.e2e-spec.ts`
   - **Impact**: Tests fail to compile
   - **Recommendation**: Fix CommonJS/ESM import issues

---

## Summary

**Issues Resolved**: 1 / 2 (50%)
**Compilation Status**: No new errors introduced ✅
**Runtime Impact**: Dashboard metrics now show real alert data ✅

**Next Steps**:
1. ✅ **DONE**: Dashboard alert metrics integration
2. ⏳ **Sprint 5**: Implement SMS notifications with Azure Communication Services
3. ⏳ **Sprint 5**: Fix pre-existing TypeScript compilation errors (test mocks, enum mismatches)
4. ⏳ **Sprint 5**: Add comprehensive unit tests for dashboard metrics query handler

---

**Report Generated**: October 29, 2025
**Author**: Claude Code
**Sprint**: Sprint 4 MVP (Issue Resolution)
