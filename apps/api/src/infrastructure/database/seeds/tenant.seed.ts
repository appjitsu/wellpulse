/**
 * Tenant Database Seed File
 *
 * Seeds realistic development data for a tenant database:
 * - Permian Basin wells (Midland-Odessa area)
 * - Field operators, managers, and admins
 * - Production, inspection, and maintenance field entries
 * - Offline sync simulation data
 *
 * Run with: node -r ts-node/register src/infrastructure/database/seeds/tenant.seed.ts <tenant_subdomain>
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { tenantUsers, wells, fieldEntries } from '../schema/tenant';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// Permian Basin coordinates (Midland-Odessa area)
const PERMIAN_BASIN_CENTER = {
  latitude: 31.9973,
  longitude: -102.0779,
};

// Generate random coordinate within ~50 mile radius of Midland
function generatePermianCoordinate() {
  const radiusDegrees = 0.7; // ~50 miles
  const randomAngle = Math.random() * 2 * Math.PI;
  const randomRadius = Math.random() * radiusDegrees;

  // Round to 7 decimal places to match numeric(10, 7) schema
  const latitude = parseFloat(
    (
      PERMIAN_BASIN_CENTER.latitude +
      randomRadius * Math.cos(randomAngle)
    ).toFixed(7),
  );
  const longitude = parseFloat(
    (
      PERMIAN_BASIN_CENTER.longitude +
      randomRadius * Math.sin(randomAngle)
    ).toFixed(7),
  );

  return { latitude, longitude };
}

// Realistic well names for Permian Basin
const LEASE_NAMES = [
  'Spraberry Unit',
  'Wolfcamp Ranch',
  'Clearfork Lease',
  'Delaware Basin Unit',
  'Bone Spring Field',
  'Canyon Reef Prospect',
  'Yates Field Unit',
  'Fullerton Field',
  'Howard-Glasscock Unit',
  'TXL Field',
  'Grayburg Formation',
  'San Andres Unit',
  'Ellenburger Deep',
  'Dean Wells',
  'Avalon Shale',
];

const WELL_SUFFIXES = ['A', 'B', 'C', 'D', 'H', 'V', '1H', '2H', '3H', '4H'];

// Operating companies/contractors for wells
// In a real tenant database, most wells would be self-operated or use contract operators
const OPERATORS = [
  'Self-Operated', // Tenant operates their own wells
  'Self-Operated',
  'Self-Operated',
  'Contract Pumping Services LLC', // Third-party contract operator
  'Permian Field Services', // Local contract operator
];

function generateApiNumber(): string {
  // Texas API numbers: 42 (Texas) + 3-digit county + 5-digit well number
  const counties = ['227', '329', '317', '461']; // Midland, Pecos, Reagan, Upton counties
  const county = counties[Math.floor(Math.random() * counties.length)];
  const wellNumber = Math.floor(10000 + Math.random() * 90000);
  return `42-${county}-${wellNumber}`;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

// Generate date within last N days
function randomDate(daysAgo: number): Date {
  const now = new Date();
  const randomDays = Math.floor(Math.random() * daysAgo);
  const date = new Date(now);
  date.setDate(date.getDate() - randomDays);
  return date;
}

async function seed(tenantSubdomain: string) {
  console.log(`🌱 Starting tenant database seed for: ${tenantSubdomain}\n`);

  const { Pool } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  let tenantId: string;
  let tenantPool: any;

  try {
    // Get tenant ID and database URL from master database
    console.log('🔍 Looking up tenant...');
    const { masterDb } = await import('../master/client');
    const { tenants: tenantTable } = await import('../master/schema');
    const { eq } = await import('drizzle-orm');

    const [tenant] = await masterDb
      .select()
      .from(tenantTable)
      .where(eq(tenantTable.subdomain, tenantSubdomain))
      .limit(1);

    if (!tenant) {
      throw new Error(`Tenant with subdomain '${tenantSubdomain}' not found`);
    }

    tenantId = tenant.id;
    console.log(`✅ Found tenant: ${tenant.name} (${tenant.id})\n`);

    // Create direct database connection using tenant's database URL
    tenantPool = new Pool({
      connectionString: tenant.databaseUrl,
      max: 10,
    });
    const db = drizzle(tenantPool);

    // ========================================================================
    // 1. Create Users
    // ========================================================================
    console.log('👥 Creating users...');

    const hashedPassword = await bcrypt.hash('demo123', 10);

    const users = [
      {
        id: uuidv4(),
        tenantId,
        email: 'peter@demo.com',
        passwordHash: hashedPassword,
        name: 'Peter Pumper',
        role: 'OPERATOR' as const,
        status: 'ACTIVE' as const,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        tenantId,
        email: 'polly@demo.com',
        passwordHash: hashedPassword,
        name: 'Polly Pumper',
        role: 'OPERATOR' as const,
        status: 'ACTIVE' as const,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        tenantId,
        email: 'mandy@demo.com',
        passwordHash: hashedPassword,
        name: 'Mandy Manager',
        role: 'MANAGER' as const,
        status: 'ACTIVE' as const,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        tenantId,
        email: 'andy@demo.com',
        passwordHash: hashedPassword,
        name: 'Andy Administrator',
        role: 'ADMIN' as const,
        status: 'ACTIVE' as const,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await db.insert(tenantUsers).values(users).onConflictDoNothing();

    // Query actual users from database (in case they already existed)
    const { or } = await import('drizzle-orm');
    const actualUsers = await db
      .select()
      .from(tenantUsers)
      .where(
        or(
          eq(tenantUsers.email, 'peter@demo.com'),
          eq(tenantUsers.email, 'polly@demo.com'),
          eq(tenantUsers.email, 'mandy@demo.com'),
          eq(tenantUsers.email, 'andy@demo.com'),
        ),
      );

    // Map users by email for easy access
    const usersByEmail = Object.fromEntries(
      actualUsers.map((u) => [u.email, u]),
    );

    console.log(`✅ Created/Found ${actualUsers.length} users`);
    actualUsers.forEach((u) =>
      console.log(`   - ${u.name} (${u.email}) - ${u.role}`),
    );

    // ========================================================================
    // 2. Create Wells
    // ========================================================================
    console.log('\n🛢️  Creating Permian Basin wells...');

    const wellData = [];
    const wellCount = 15;

    for (let i = 0; i < wellCount; i++) {
      const coords = generatePermianCoordinate();
      const lease = LEASE_NAMES[i % LEASE_NAMES.length];
      const suffix = WELL_SUFFIXES[i % WELL_SUFFIXES.length];
      // Better well numbering to avoid duplicates: start from 1 and increment
      const wellNumber = i + 1;
      // Assign different operators to create variety
      const operator = OPERATORS[i % OPERATORS.length];

      wellData.push({
        id: uuidv4(),
        name: `${lease} #${wellNumber}${suffix}`,
        apiNumber: generateApiNumber(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        status: i % 10 === 9 ? 'INACTIVE' : 'ACTIVE', // 10% inactive
        lease: lease,
        field:
          i < 5
            ? 'Spraberry Trend'
            : i < 10
              ? 'Wolfcamp Field'
              : 'Delaware Basin',
        operator,
        metadata: {
          wellType: i % 3 === 0 ? 'HORIZONTAL' : 'VERTICAL',
          depth: randomInt(5000, 15000),
        },
        spudDate: randomDate(365 * 3), // Within last 3 years
        completionDate: randomDate(365 * 2), // Within last 2 years
        createdBy: usersByEmail['peter@demo.com'].id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Insert wells one at a time to get better error messages
    for (let i = 0; i < wellData.length; i++) {
      try {
        await db.insert(wells).values(wellData[i]).onConflictDoNothing();
        console.log(
          `   Inserted well ${i + 1}/${wellCount}: ${wellData[i].name}`,
        );
      } catch (error: any) {
        console.error(`❌ Failed to insert well #${i + 1}:`, error.message);
        console.error('Full error object:', JSON.stringify(error, null, 2));
        console.error('Error keys:', Object.keys(error));
        console.error('Well data:', JSON.stringify(wellData[i], null, 2));
        throw error;
      }
    }

    // Query actual wells from database (in case they already existed)
    const { isNull } = await import('drizzle-orm');
    const actualWells = await db
      .select()
      .from(wells)
      .where(isNull(wells.deletedAt));
    console.log(`   Found ${actualWells.length} wells in database`);

    console.log(`✅ Created ${wellCount} wells in Permian Basin`);
    console.log(
      `   - Spraberry Trend: ${wellData.filter((w) => w.field === 'Spraberry Trend').length}`,
    );
    console.log(
      `   - Wolfcamp Field: ${wellData.filter((w) => w.field === 'Wolfcamp Field').length}`,
    );
    console.log(
      `   - Delaware Basin: ${wellData.filter((w) => w.field === 'Delaware Basin').length}`,
    );
    console.log(
      `   - Active: ${wellData.filter((w) => w.status === 'ACTIVE').length}`,
    );
    console.log(
      `   - Inactive: ${wellData.filter((w) => w.status === 'INACTIVE').length}`,
    );

    // ========================================================================
    // 3. Create Field Entries
    // ========================================================================
    console.log('\n📝 Creating field entries...');

    const fieldData = [];
    const entriesPerWell = 30; // Last 30 days of data

    // Create map from API number to actual well ID
    const wellIdMap = Object.fromEntries(
      actualWells.map((w) => [w.apiNumber, w.id]),
    );

    for (const well of wellData.filter((w) => w.status === 'ACTIVE')) {
      // Get actual well ID from database
      const actualWellId = wellIdMap[well.apiNumber];
      if (!actualWellId) {
        console.warn(
          `   ⚠️  Warning: Could not find well ${well.apiNumber} in database`,
        );
        continue;
      }
      // Production entries (daily)
      for (let day = 0; day < entriesPerWell; day++) {
        const recordedAt = randomDate(entriesPerWell);
        const operator = actualUsers.find((u) => u.role === 'OPERATOR');

        fieldData.push({
          id: uuidv4(),
          tenantId,
          wellId: actualWellId,
          entryType: 'PRODUCTION',
          productionData: {
            oilVolume: randomFloat(50, 500, 1), // barrels per day
            gasVolume: randomFloat(1000, 10000, 0), // MCF per day
            waterVolume: randomFloat(100, 1000, 1), // barrels per day
            tubeingPressure: randomFloat(500, 2000, 0), // PSI
            casingPressure: randomFloat(200, 1500, 0), // PSI
            chokeSize: randomInt(8, 64), // 64ths of an inch
            runtime: randomFloat(20, 24, 1), // hours
          },
          recordedAt,
          syncedAt: day < 3 ? null : recordedAt, // Last 3 days not synced (offline)
          createdBy: operator!.id,
          deviceId: 'FIELD_TABLET_001',
          latitude: well.latitude + randomFloat(-0.001, 0.001, 6),
          longitude: well.longitude + randomFloat(-0.001, 0.001, 6),
          createdAt: recordedAt,
          updatedAt: recordedAt,
        });
      }

      // Inspection entries (weekly)
      for (let week = 0; week < 4; week++) {
        const recordedAt = randomDate(week * 7);
        const operators = actualUsers.filter((u) => u.role === 'OPERATOR');
        const operator = operators[randomInt(0, operators.length - 1)]; // Random operator

        const hasIssues = Math.random() < 0.3; // 30% have issues

        fieldData.push({
          id: uuidv4(),
          tenantId,
          wellId: actualWellId,
          entryType: 'INSPECTION',
          inspectionData: {
            equipmentStatus: hasIssues
              ? Math.random() < 0.5
                ? 'DEGRADED'
                : 'FAILED'
              : 'OPERATIONAL',
            leaksDetected: hasIssues && Math.random() < 0.4,
            safetyHazards: hasIssues && Math.random() < 0.2,
            visualCondition: hasIssues
              ? 'FAIR'
              : Math.random() < 0.7
                ? 'GOOD'
                : 'EXCELLENT',
            inspectionType: 'ROUTINE',
            nextInspectionDate: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            correctiveActions: hasIssues
              ? [
                  'Replace worn gasket on wellhead',
                  'Tighten valve packing',
                  'Schedule detailed inspection',
                ]
              : undefined,
          },
          recordedAt,
          syncedAt: recordedAt,
          createdBy: operator.id,
          deviceId: 'FIELD_TABLET_002',
          latitude: well.latitude + randomFloat(-0.001, 0.001, 6),
          longitude: well.longitude + randomFloat(-0.001, 0.001, 6),
          notes: hasIssues
            ? 'Minor issues detected during routine inspection'
            : 'All systems operational',
          createdAt: recordedAt,
          updatedAt: recordedAt,
        });
      }

      // Maintenance entries (monthly or as-needed)
      if (Math.random() < 0.5) {
        const recordedAt = randomDate(30);
        const operators = actualUsers.filter((u) => u.role === 'OPERATOR');
        const operator = operators[randomInt(0, operators.length - 1)];

        fieldData.push({
          id: uuidv4(),
          tenantId,
          wellId: actualWellId,
          entryType: 'MAINTENANCE',
          maintenanceData: {
            maintenanceType: Math.random() < 0.3 ? 'EMERGENCY' : 'PREVENTIVE',
            workPerformed: [
              'Replaced rod pump',
              'Serviced wellhead valves',
              'Calibrated pressure sensors',
              'Greased surface equipment',
            ],
            partsReplaced: [
              'Rod pump assembly',
              'Valve stem packing',
              'Pressure sensor',
            ],
            downtime: randomFloat(2, 8, 1), // hours
            cost: randomFloat(500, 5000, 2), // USD
            vendorName:
              Math.random() < 0.5
                ? 'Permian Services Inc'
                : 'Oilfield Maintenance Co',
            nextMaintenanceDate: new Date(
              Date.now() + 90 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          },
          recordedAt,
          syncedAt: recordedAt,
          createdBy: operator.id,
          deviceId: 'MAINTENANCE_TRUCK_001',
          latitude: well.latitude + randomFloat(-0.001, 0.001, 6),
          longitude: well.longitude + randomFloat(-0.001, 0.001, 6),
          notes: 'Scheduled preventive maintenance completed',
          createdAt: recordedAt,
          updatedAt: recordedAt,
        });
      }
    }

    // Insert field entries in batches to avoid parameter limit
    const BATCH_SIZE = 50;
    let insertedCount = 0;

    for (let i = 0; i < fieldData.length; i += BATCH_SIZE) {
      const batch = fieldData.slice(i, i + BATCH_SIZE);
      try {
        await db.insert(fieldEntries).values(batch).onConflictDoNothing();
        insertedCount += batch.length;
        console.log(
          `   Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(fieldData.length / BATCH_SIZE)} (${batch.length} entries)`,
        );
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `   ⚠️  Failed to insert batch at index ${i}: ${errorMessage}`,
        );
        // Log first entry in failed batch for debugging
        console.error('   First entry in batch:', JSON.stringify(batch[0]));
        throw error;
      }
    }

    const productionCount = fieldData.filter(
      (e) => e.entryType === 'PRODUCTION',
    ).length;
    const inspectionCount = fieldData.filter(
      (e) => e.entryType === 'INSPECTION',
    ).length;
    const maintenanceCount = fieldData.filter(
      (e) => e.entryType === 'MAINTENANCE',
    ).length;

    console.log(`✅ Created ${insertedCount} field entries`);
    console.log(`   - Production: ${productionCount}`);
    console.log(`   - Inspection: ${inspectionCount}`);
    console.log(`   - Maintenance: ${maintenanceCount}`);
    console.log(
      `   - Pending sync: ${fieldData.filter((e) => !e.syncedAt).length}`,
    );

    console.log('\n✅ Tenant database seed completed!\n');
    console.log('📝 Summary:');
    console.log(`   - Tenant: ${tenant.name} (${tenantSubdomain})`);
    console.log(
      `   - Users: ${users.length} (login with any user using password: demo123)`,
    );
    users.forEach((u) => console.log(`     • ${u.email} (${u.role})`));
    console.log(
      `   - Wells: ${wellCount} (${wellData.filter((w) => w.status === 'ACTIVE').length} active)`,
    );
    console.log(`   - Field Entries: ${fieldData.length}`);
    console.log('');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Seed failed:', errorMessage);
    throw error;
  } finally {
    // Close database connection
    if (tenantPool) {
      await tenantPool.end();
      console.log('🔌 Database connection closed');
    }
    process.exit(0);
  }
}

// Run seed if called directly
if (require.main === module) {
  const tenantSubdomain = process.argv[2];

  if (!tenantSubdomain) {
    console.error('❌ Error: Tenant subdomain is required');
    console.error('Usage: ts-node tenant.seed.ts <tenant_subdomain>');
    console.error('Example: ts-node tenant.seed.ts acme');
    process.exit(1);
  }

  seed(tenantSubdomain)
    .then(() => {
      console.log('✨ Done!');
    })
    .catch((error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('💥 Fatal error:', errorMessage);
      process.exit(1);
    });
}

export { seed };
