#!/usr/bin/env tsx
/**
 * Production Data Simulator
 *
 * Continuously generates realistic SCADA readings and manual pumper entries
 * for Oil & Gas production testing in the Permian Basin.
 *
 * Features:
 * - Seeds wells with realistic Permian Basin locations
 * - Generates SCADA readings every 5-15 minutes (automated)
 * - Simulates manual pumper entries twice daily (6 AM and 6 PM)
 * - Realistic production volumes with daily variations
 * - Equipment failures and maintenance events
 * - Seasonal production trends
 *
 * Usage:
 *   npx tsx scripts/simulate-production-data.ts
 *   npx tsx scripts/simulate-production-data.ts --seed-only
 *   npx tsx scripts/simulate-production-data.ts --scada-interval=300000 --pumper-interval=43200000
 */

import axios from 'axios';
import { randomUUID } from 'crypto';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';

// Configuration
const config = {
  apiUrl: process.env.API_URL || 'http://localhost:4000/api',
  scadaGrpcUrl: process.env.SCADA_GRPC_URL || 'localhost:50051',
  tenantSubdomain: process.env.TENANT_SUBDOMAIN || 'demo',
  tenantId: process.env.TENANT_ID || '68b88aec-2dce-41c2-b67c-d2ce131c7288', // Demo tenant ID
  scadaInterval: parseInt(process.env.SCADA_INTERVAL || '300000'), // 5 minutes
  pumperInterval: parseInt(process.env.PUMPER_INTERVAL || '43200000'), // 12 hours
  seedOnly: process.argv.includes('--seed-only'),
};

// Parse CLI args
const args = process.argv.slice(2);
args.forEach(arg => {
  if (arg.startsWith('--scada-interval=')) {
    config.scadaInterval = parseInt(arg.split('=')[1]);
  }
  if (arg.startsWith('--pumper-interval=')) {
    config.pumperInterval = parseInt(arg.split('=')[1]);
  }
});

interface Well {
  id: string;
  name: string;
  apiNumber: string;
  location: { latitude: number; longitude: number };
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  wellType: 'HORIZONTAL' | 'VERTICAL' | 'DIRECTIONAL';
  baselineOil: number; // Barrels per day
  baselineGas: number; // MCF per day
  baselineWater: number; // Barrels per day
}

// Permian Basin well templates
const wellTemplates = [
  // High-producing horizontal wells
  { name: 'Wolfcamp A-1H', type: 'HORIZONTAL' as const, oil: 250, gas: 450, water: 180 },
  { name: 'Wolfcamp B-2H', type: 'HORIZONTAL' as const, oil: 220, gas: 420, water: 160 },
  { name: 'Bone Spring-3H', type: 'HORIZONTAL' as const, oil: 280, gas: 480, water: 200 },
  { name: 'Spraberry-4H', type: 'HORIZONTAL' as const, oil: 200, gas: 380, water: 140 },

  // Medium-producing directional wells
  { name: 'Delaware-5D', type: 'DIRECTIONAL' as const, oil: 120, gas: 220, water: 90 },
  { name: 'Avalon-6D', type: 'DIRECTIONAL' as const, oil: 140, gas: 250, water: 100 },

  // Lower-producing vertical wells
  { name: 'San Andres-7V', type: 'VERTICAL' as const, oil: 45, gas: 80, water: 35 },
  { name: 'Clearfork-8V', type: 'VERTICAL' as const, oil: 35, gas: 60, water: 25 },
  { name: 'Yates-9V', type: 'VERTICAL' as const, oil: 40, gas: 70, water: 30 },
  { name: 'Grayburg-10V', type: 'VERTICAL' as const, oil: 30, gas: 50, water: 20 },
];

// Permian Basin geographic bounds (Midland and Delaware basins)
const permianBounds = {
  lat: { min: 31.5, max: 33.0 },
  lon: { min: -103.5, max: -101.5 },
};

let createdWells: Well[] = [];
let scadaClient: any = null;

/**
 * Initialize gRPC client for SCADA service
 */
async function initializeScadaClient(): Promise<void> {
  try {
    const PROTO_PATH = join(__dirname, '../apps/scada-ingestion/proto/scada.proto');
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const scadaProto: any = grpc.loadPackageDefinition(packageDefinition).scada;
    scadaClient = new scadaProto.ScadaService(
      config.scadaGrpcUrl,
      grpc.credentials.createInsecure(),
    );

    // Test connection
    return new Promise((resolve, reject) => {
      scadaClient.HealthCheck({}, (error: any, response: any) => {
        if (error) {
          console.warn('⚠️  SCADA gRPC service not available:', error.message);
          console.warn('   SCADA readings will be logged only (not persisted)');
          scadaClient = null;
          resolve();
        } else {
          console.log(`✓ Connected to SCADA gRPC service (${response.active_connections} connections)`);
          resolve();
        }
      });
    });
  } catch (error: any) {
    console.warn('⚠️  Failed to initialize SCADA client:', error.message);
    console.warn('   SCADA readings will be logged only (not persisted)');
    scadaClient = null;
  }
}

/**
 * Generate random value within range with normal distribution
 */
function randomNormal(min: number, max: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const value = (min + max) / 2 + z * (max - min) / 6;
  return Math.max(min, Math.min(max, value));
}

/**
 * Generate realistic API number (42 = Texas)
 */
function generateApiNumber(): string {
  const state = '42'; // Texas
  const county = String(Math.floor(Math.random() * 500) + 1).padStart(3, '0');
  const sequence = String(Math.floor(Math.random() * 99999) + 1).padStart(5, '0');
  return `${state}-${county}-${sequence}`;
}

/**
 * Seed wells into database
 */
async function seedWells(): Promise<void> {
  console.log('🌱 Seeding wells...\n');

  for (const template of wellTemplates) {
    const well: Well = {
      id: randomUUID(),
      name: template.name,
      apiNumber: generateApiNumber(),
      location: {
        latitude: randomNormal(permianBounds.lat.min, permianBounds.lat.max),
        longitude: randomNormal(permianBounds.lon.min, permianBounds.lon.max),
      },
      status: 'ACTIVE',
      wellType: template.type,
      baselineOil: template.oil,
      baselineGas: template.gas,
      baselineWater: template.water,
    };

    try {
      const response = await axios.post(
        `${config.apiUrl}/wells`,
        {
          name: well.name,
          apiNumber: well.apiNumber,
          location: well.location,
          status: well.status,
          wellType: well.wellType,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Host: `${config.tenantSubdomain}.localhost:4000`,
          },
        },
      );

      if (response.status === 201) {
        well.id = response.data.id;
        createdWells.push(well);
        console.log(`✓ Created well: ${well.name} (${well.apiNumber})`);
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.error('❌ Authentication required. Please login first.');
        console.error('   Run: curl -X POST http://localhost:4000/api/auth/login');
        process.exit(1);
      }
      console.error(`✗ Failed to create ${well.name}:`, error.response?.data || error.message);
    }
  }

  console.log(`\n✅ Seeded ${createdWells.length} wells\n`);
}

/**
 * Generate production reading with realistic variations
 */
function generateProductionData(well: Well, time: Date) {
  // Time-based factors
  const hourOfDay = time.getHours();
  const dayOfYear = Math.floor(
    (time.getTime() - new Date(time.getFullYear(), 0, 0).getTime()) / 86400000,
  );

  // Seasonal variation (summer heat reduces efficiency by ~10%)
  const seasonalFactor = 1 - 0.1 * Math.sin((dayOfYear / 365) * 2 * Math.PI);

  // Daily production cycle (slight dip during midday heat)
  const dailyCycleFactor = 1 - 0.05 * Math.sin(((hourOfDay - 6) / 24) * 2 * Math.PI);

  // Random equipment efficiency (95-105%)
  const efficiencyFactor = randomNormal(0.95, 1.05);

  // Simulate occasional equipment issues (5% chance of 50% reduction)
  const equipmentIssue = Math.random() < 0.05 ? 0.5 : 1.0;

  // Well decline curve (0.5% monthly decline)
  const monthsOld = Math.floor(Math.random() * 24); // 0-2 years old
  const declineFactor = Math.pow(0.995, monthsOld);

  const combinedFactor =
    seasonalFactor * dailyCycleFactor * efficiencyFactor * equipmentIssue * declineFactor;

  return {
    oil: Math.max(0, well.baselineOil * combinedFactor),
    gas: Math.max(0, well.baselineGas * combinedFactor),
    water: Math.max(0, well.baselineWater * combinedFactor * randomNormal(0.9, 1.1)),
    tubing_pressure: randomNormal(800, 1200), // PSI
    casing_pressure: randomNormal(400, 800), // PSI
    temperature: randomNormal(120, 180), // Fahrenheit
  };
}

/**
 * Send SCADA reading via gRPC to Rust service (simulates automated sensor data)
 */
async function sendScadaReading(well: Well): Promise<void> {
  const now = new Date();
  const data = generateProductionData(well, now);
  const timestamp = Math.floor(now.getTime() / 1000); // Unix timestamp in seconds

  console.log(
    `📡 SCADA [${now.toISOString()}] ${well.name}: Oil=${data.oil.toFixed(1)} bbl, Gas=${data.gas.toFixed(1)} mcf, H2O=${data.water.toFixed(1)} bbl, TP=${data.tubing_pressure.toFixed(0)} psi, CP=${data.casing_pressure.toFixed(0)} psi`,
  );

  // Send readings via gRPC to Rust SCADA service
  if (scadaClient) {
    // Note: The Rust service expects readings to come from OPC-UA connections
    // For simulation, we're logging what would be sent
    // In production, this would integrate with actual OPC-UA servers
    console.log(
      `   → Would send to gRPC: tenant=${config.tenantId}, well=${well.id}, timestamp=${timestamp}`,
    );
  }
}

/**
 * Send manual pumper entry via REST API to NestJS (simulates field personnel daily reports)
 */
async function sendPumperEntry(well: Well): Promise<void> {
  const now = new Date();
  const data = generateProductionData(well, now);

  // Round to whole numbers for manual entry (pumpers don't report decimals)
  const manualData = {
    wellId: well.id,
    date: now.toISOString().split('T')[0],
    oil: Math.round(data.oil),
    gas: Math.round(data.gas),
    water: Math.round(data.water),
    runTime: 24, // Hours (full day)
    comments: Math.random() < 0.1 ? 'Normal operations' : null, // 10% add comments
  };

  console.log(
    `👷 PUMPER [${now.toISOString()}] ${well.name}: Oil=${manualData.oil} bbl, Gas=${manualData.gas} mcf, H2O=${manualData.water} bbl`,
  );

  // Send to NestJS API field-data endpoint
  try {
    const response = await axios.post(
      `${config.apiUrl}/field-data`,
      manualData,
      {
        headers: {
          'Content-Type': 'application/json',
          Host: `${config.tenantSubdomain}.localhost:4000`,
        },
      },
    );

    if (response.status === 201) {
      console.log(`   ✓ Saved to database via API (id: ${response.data.id})`);
    }
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.log('   ⚠️  Authentication required (will retry next cycle)');
    } else if (error.response?.status === 404) {
      console.log('   ⚠️  Field-data API endpoint not implemented yet');
    } else {
      console.error(`   ✗ Failed to save: ${error.response?.data?.message || error.message}`);
    }
  }
}

/**
 * Main simulation loop
 */
async function runSimulation(): Promise<void> {
  console.log('🏭 Starting production data simulation...');
  console.log(`   SCADA interval: ${config.scadaInterval / 1000}s`);
  console.log(`   Pumper interval: ${config.pumperInterval / 1000}s\n`);

  // SCADA readings (every 5-15 minutes)
  setInterval(() => {
    createdWells.forEach(well => {
      if (well.status === 'ACTIVE') {
        sendScadaReading(well).catch(console.error);
      }
    });
  }, config.scadaInterval);

  // Manual pumper entries (twice daily: 6 AM and 6 PM)
  const schedulePumperEntry = () => {
    const now = new Date();
    const hour = now.getHours();

    // Only send during pumper shift times (6 AM or 6 PM ±30 minutes)
    if ((hour >= 5 && hour <= 7) || (hour >= 17 && hour <= 19)) {
      createdWells.forEach(well => {
        if (well.status === 'ACTIVE') {
          sendPumperEntry(well).catch(console.error);
        }
      });
    }
  };

  // Check every hour for pumper shift times
  setInterval(schedulePumperEntry, config.pumperInterval);

  // Initial readings
  console.log('📊 Generating initial readings...\n');
  createdWells.forEach(well => {
    if (well.status === 'ACTIVE') {
      sendScadaReading(well).catch(console.error);
    }
  });

  console.log('\n✅ Simulation running. Press Ctrl+C to stop.\n');
}

/**
 * Main entry point
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   WellPulse Production Data Simulator (Permian Basin)         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    // Initialize gRPC client for SCADA
    await initializeScadaClient();

    // Seed wells
    await seedWells();

    if (config.seedOnly) {
      console.log('✅ Seed-only mode complete. Exiting.\n');
      process.exit(0);
    }

    // Run continuous simulation
    await runSimulation();
  } catch (error: any) {
    console.error('❌ Simulation error:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down simulation...');
  console.log(`✅ Generated data for ${createdWells.length} wells`);
  process.exit(0);
});

main();
