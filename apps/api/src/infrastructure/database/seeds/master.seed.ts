/**
 * Master Database Seed File
 *
 * Seeds initial development data for the master database:
 * - Super admin user for platform management
 * - Sample tenants for testing (WellPulse internal, ACME, Demo)
 * - Billing subscriptions
 * - Initial usage metrics
 *
 * Run with: pnpm db:seed:master
 */

import { masterDb } from '../master/client';
import {
  tenants,
  adminUsers,
  billingSubscriptions,
  usageMetrics,
} from '../master/schema';
import * as bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Starting master database seed...\n');

  try {
    // ========================================================================
    // 1. Create Super Admin User
    // ========================================================================
    console.log('👤 Creating super admin user...');

    const hashedPassword = await bcrypt.hash('WellPulse2025!', 10);

    const [superAdmin] = await masterDb
      .insert(adminUsers)
      .values({
        email: 'admin@wellpulse.app',
        passwordHash: hashedPassword,
        name: 'WellPulse Admin',
        role: 'SUPER_ADMIN',
        isActive: true,
        permissions: ['*'], // All permissions
      })
      .returning()
      .onConflictDoNothing();

    if (superAdmin) {
      console.log(`✅ Super admin created: ${superAdmin.email}`);
    } else {
      console.log('ℹ️  Super admin already exists');
    }

    // ========================================================================
    // 2. Create Master Tenant (WellPulse - for internal admin users)
    // ========================================================================
    console.log('\n🏢 Creating master tenant (WellPulse)...');

    const [wellpulseTenant] = await masterDb
      .insert(tenants)
      .values({
        slug: 'wellpulse',
        subdomain: 'wellpulse',
        name: 'WellPulse (Internal)',
        databaseType: 'POSTGRESQL',
        databaseUrl:
          'postgresql://wellpulse:wellpulse@localhost:5432/wellpulse_internal',
        databaseName: 'wellpulse_internal',
        databaseHost: 'localhost',
        databasePort: 5432,
        subscriptionTier: 'ENTERPRISE',
        maxWells: 999999, // Unlimited
        maxUsers: 999999, // Unlimited
        storageQuotaGb: 999999, // Unlimited
        status: 'ACTIVE',
        contactEmail: 'admin@wellpulse.app',
        billingEmail: 'billing@wellpulse.app',
        featureFlags: {
          enableMlPredictions: true,
          enableOfflineSync: true,
          enableAdvancedReporting: true,
        },
        createdBy: superAdmin?.id,
      })
      .returning()
      .onConflictDoNothing();

    if (wellpulseTenant) {
      console.log(
        `✅ Master tenant created: ${wellpulseTenant.name} (${wellpulseTenant.subdomain})`,
      );
    } else {
      console.log('ℹ️  WellPulse master tenant already exists');
    }

    // ========================================================================
    // 3. Create Sample Tenant (ACME Oil & Gas)
    // ========================================================================
    console.log('\n🏢 Creating sample tenant...');

    const [acmeTenant] = await masterDb
      .insert(tenants)
      .values({
        slug: 'acme-oil-gas',
        subdomain: 'acme',
        name: 'ACME Oil & Gas',
        databaseType: 'POSTGRESQL',
        databaseUrl:
          'postgresql://wellpulse:wellpulse@localhost:5432/acme_wellpulse',
        databaseName: 'acme_wellpulse',
        databaseHost: 'localhost',
        databasePort: 5432,
        subscriptionTier: 'PROFESSIONAL',
        maxWells: 200,
        maxUsers: 20,
        storageQuotaGb: 50,
        status: 'ACTIVE',
        contactEmail: 'admin@acmeoil.com',
        contactPhone: '+1-555-0100',
        billingEmail: 'billing@acmeoil.com',
        featureFlags: {
          enableMlPredictions: true,
          enableOfflineSync: true,
          enableAdvancedReporting: true,
        },
        createdBy: superAdmin?.id,
      })
      .returning()
      .onConflictDoNothing();

    if (acmeTenant) {
      console.log(
        `✅ Tenant created: ${acmeTenant.name} (${acmeTenant.subdomain}.wellpulse.app)`,
      );
    } else {
      console.log('ℹ️  ACME tenant already exists');
    }

    // ========================================================================
    // 4. Create Billing Subscription for ACME
    // ========================================================================
    if (acmeTenant) {
      console.log('\n💳 Creating billing subscription...');

      const now = new Date();
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const [subscription] = await masterDb
        .insert(billingSubscriptions)
        .values({
          tenantId: acmeTenant.id,
          tier: 'PROFESSIONAL',
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          basePriceUsd: 29900, // $299.00
          perWellPriceUsd: 500, // $5.00 per well
          perUserPriceUsd: 2000, // $20.00 per user
          storageOveragePricePerGbUsd: 100, // $1.00 per GB
          currentPeriodStart: now,
          currentPeriodEnd: nextMonth,
          nextBillingDate: nextMonth,
          paymentMethod: 'CREDIT_CARD',
        })
        .returning()
        .onConflictDoNothing();

      if (subscription) {
        console.log(
          `✅ Subscription created: ${subscription.tier} - $${subscription.basePriceUsd / 100}/mo`,
        );
      } else {
        console.log('ℹ️  Subscription already exists');
      }
    }

    // ========================================================================
    // 5. Create Initial Usage Metrics
    // ========================================================================
    if (acmeTenant) {
      console.log('\n📊 Creating initial usage metrics...');

      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      const [metrics] = await masterDb
        .insert(usageMetrics)
        .values({
          tenantId: acmeTenant.id,
          periodStart: yesterday,
          periodEnd: now,
          metricDate: now,
          activeWellCount: 45,
          totalWellCount: 50,
          activeUserCount: 8,
          totalUserCount: 10,
          storageUsedGb: 12,
          storageQuotaGb: 50,
          storageOverageGb: 0,
          apiRequestCount: 1250,
          apiErrorCount: 3,
          apiRateLimitHits: 0,
          productionDataEntriesCount: 150,
          mlPredictionsCount: 25,
          mobileAppSyncsCount: 12,
          electronAppSyncsCount: 8,
          avgApiResponseTimeMs: 85,
          p95ApiResponseTimeMs: 210,
        })
        .returning()
        .onConflictDoNothing();

      if (metrics) {
        console.log(
          `✅ Usage metrics created: ${metrics.activeWellCount} wells, ${metrics.activeUserCount} users`,
        );
      } else {
        console.log('ℹ️  Usage metrics already exist');
      }
    }

    // ========================================================================
    // 6. Create Trial Tenant (Demo Company)
    // ========================================================================
    console.log('\n🆓 Creating trial tenant...');

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14-day trial

    const [trialTenant] = await masterDb
      .insert(tenants)
      .values({
        slug: 'demo-oil-co',
        subdomain: 'demo',
        name: 'Demo Oil Company',
        databaseType: 'POSTGRESQL',
        databaseUrl:
          'postgresql://wellpulse:wellpulse@localhost:5432/demo_wellpulse',
        databaseName: 'demo_wellpulse',
        databaseHost: 'localhost',
        databasePort: 5432,
        subscriptionTier: 'STARTER',
        maxWells: 50,
        maxUsers: 5,
        storageQuotaGb: 10,
        status: 'TRIAL',
        trialEndsAt: trialEndsAt,
        contactEmail: 'demo@demooil.com',
        featureFlags: {
          enableMlPredictions: false,
          enableOfflineSync: true,
          enableAdvancedReporting: false,
        },
        createdBy: superAdmin?.id,
      })
      .returning()
      .onConflictDoNothing();

    if (trialTenant) {
      console.log(
        `✅ Trial tenant created: ${trialTenant.name} (expires ${trialTenant.trialEndsAt?.toLocaleDateString()})`,
      );
    } else {
      console.log('ℹ️  Trial tenant already exists');
    }

    console.log('\n✅ Master database seed completed!\n');
    console.log('📝 Summary:');
    console.log('   - Super Admin: admin@wellpulse.app / WellPulse2025!');
    console.log(
      '   - WellPulse Master Tenant: wellpulse (ENTERPRISE, ACTIVE) - for admin users',
    );
    console.log('   - ACME Tenant: acme.wellpulse.app (PROFESSIONAL, ACTIVE)');
    console.log('   - Demo Tenant: demo.wellpulse.app (STARTER, TRIAL)');
    console.log('');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

// Run seed if called directly
if (require.main === module) {
  seed()
    .then(() => {
      console.log('✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

export { seed };
