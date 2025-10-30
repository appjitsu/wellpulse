/**
 * Master Database Seed File
 *
 * Seeds initial development data for the master database:
 * - Super admin user for platform management
 * - WellPulse internal tenant (for admin portal)
 * - Demo trial tenant (for testing)
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
import * as crypto from 'crypto';

/**
 * Generate tenant secret key and hash
 */
function generateTenantSecret(): { secret: string; hash: string } {
  const secret = crypto.randomBytes(32).toString('base64');
  const hash = crypto.createHash('sha256').update(secret).digest('hex');
  return { secret, hash };
}

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

    const wellpulseSecret = generateTenantSecret();

    const [wellpulseTenant] = await masterDb
      .insert(tenants)
      .values({
        slug: 'wellpulse',
        subdomain: 'wellpulse',
        tenantId: 'WELLPULS-ADMIN1', // Static tenant ID for internal use (8 letters + 6 chars)
        secretKeyHash: wellpulseSecret.hash,
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
      console.log(`   Tenant ID: ${wellpulseTenant.tenantId}`);
      console.log(`   Secret: ${wellpulseSecret.secret}`);
    } else {
      console.log('ℹ️  WellPulse master tenant already exists');
    }

    // ========================================================================
    // 3. Create Trial Tenant (Demo Company)
    // ========================================================================
    console.log('\n🆓 Creating trial tenant...');

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14-day trial

    const demoSecret = generateTenantSecret();

    const [trialTenant] = await masterDb
      .insert(tenants)
      .values({
        slug: 'demo-oil-co',
        subdomain: 'demo',
        tenantId: 'DEMO-A5L32W', // Fixed tenant ID for demo tenant
        secretKeyHash: demoSecret.hash,
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
      console.log(`   Tenant ID: ${trialTenant.tenantId}`);
      console.log(`   Secret: ${demoSecret.secret}`);
    } else {
      console.log('ℹ️  Trial tenant already exists');
    }

    console.log('\n✅ Master database seed completed!\n');
    console.log('📝 Summary:');
    console.log('   - Super Admin: admin@wellpulse.app / WellPulse2025!');
    console.log(
      '   - WellPulse Master Tenant: wellpulse.wellpulse.app (ENTERPRISE, ACTIVE)',
    );
    console.log('     Tenant ID: WELLPULS-ADMIN1');
    console.log('   - Demo Tenant: demo.wellpulse.app (STARTER, TRIAL)');
    console.log('     Tenant ID: DEMO-A5L32W');
    console.log('');
    console.log('🔐 IMPORTANT: Save tenant secrets securely!');
    console.log(
      '   Secrets are only shown once during seed and must be stored securely.',
    );
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
