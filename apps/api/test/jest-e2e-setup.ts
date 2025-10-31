/**
 * Jest E2E Test Setup
 *
 * Loads .env.test file before running E2E tests.
 * This ensures test environment variables (including Azure AD dummy config) are loaded.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.test from apps/api directory
dotenv.config({
  path: path.resolve(__dirname, '../.env.test'),
});

console.log('✓ Loaded .env.test for E2E tests');
console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);
console.log(
  `  AZURE_AD_CLIENT_ID: ${process.env.AZURE_AD_CLIENT_ID ? '✓ Set' : '✗ Missing'}`,
);
console.log(
  `  AZURE_AD_TENANT_ID: ${process.env.AZURE_AD_TENANT_ID ? '✓ Set' : '✗ Missing'}`,
);
