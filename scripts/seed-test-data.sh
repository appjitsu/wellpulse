#!/bin/bash

# Seed Test Data Script
#
# Creates test wells in tenant databases to populate metrics dashboard.
# This directly seeds the database, bypassing authentication.
#
# Usage: ./scripts/seed-test-data.sh

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   WellPulse Test Data Seeder            ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# Database credentials
DB_USER="wellpulse"
DB_PASS="wellpulse"
DB_HOST="localhost"
DB_PORT="5432"

# Tenant databases
ACME_DB="acme_wellpulse"
WELLPULSE_DB="wellpulse_internal"

echo -e "${YELLOW}📊 Seeding test data into tenant databases...${NC}"
echo ""

# Seed ACME tenant
echo -e "${GREEN}[1/2]${NC} Seeding ACME tenant (${ACME_DB})..."
PGPASSWORD=$DB_PASS psql -h $DB_HOST -U $DB_USER -d $ACME_DB -c "
INSERT INTO wells (id, name, api_number, location_latitude, location_longitude, status, operator, field_name, created_at, updated_at, created_by)
VALUES
  (gen_random_uuid(), 'ACME Well #1', 'API-42-123-45678-01', 31.8457, -102.3676, 'PRODUCING', 'ACME Oil & Gas', 'Permian Basin', NOW(), NOW(), 'system'),
  (gen_random_uuid(), 'ACME Well #2', 'API-42-123-45678-02', 31.8523, -102.3712, 'DRILLING', 'ACME Oil & Gas', 'Permian Basin', NOW(), NOW(), 'system'),
  (gen_random_uuid(), 'ACME Well #3', 'API-42-123-45678-03', 31.8489, -102.3698, 'PRODUCING', 'ACME Oil & Gas', 'Permian Basin', NOW(), NOW(), 'system')
ON CONFLICT (api_number) DO NOTHING;
"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ ACME tenant seeded${NC}"
else
  echo -e "${YELLOW}⚠️  ACME tenant seeding failed (might already exist)${NC}"
fi
echo ""

# Seed WellPulse internal tenant
echo -e "${GREEN}[2/2]${NC} Seeding WellPulse internal tenant (${WELLPULSE_DB})..."
PGPASSWORD=$DB_PASS psql -h $DB_HOST -U $DB_USER -d $WELLPULSE_DB -c "
INSERT INTO wells (id, name, api_number, location_latitude, location_longitude, status, operator, field_name, created_at, updated_at, created_by)
VALUES
  (gen_random_uuid(), 'Demo Well #1', 'API-42-999-11111-01', 31.9123, -102.4567, 'PRODUCING', 'WellPulse Demo', 'Demo Field', NOW(), NOW(), 'system'),
  (gen_random_uuid(), 'Demo Well #2', 'API-42-999-11111-02', 31.9145, -102.4589, 'SHUTDOWN', 'WellPulse Demo', 'Demo Field', NOW(), NOW(), 'system')
ON CONFLICT (api_number) DO NOTHING;
"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ WellPulse internal tenant seeded${NC}"
else
  echo -e "${YELLOW}⚠️  WellPulse internal seeding failed (might already exist)${NC}"
fi
echo ""

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Seeding Complete! ✅              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}💡 Now run the API test script to create connection pools:${NC}"
echo -e "   ./scripts/test-api-metrics.sh"
echo ""
