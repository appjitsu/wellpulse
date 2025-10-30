#!/bin/bash

##
## Create WellPulse Databases
##
## Creates all WellPulse databases (master + tenant databases)
## Runs migrations and optionally seeds data
##
## Usage:
##   ./scripts/create-dbs.sh              # Create and migrate only
##   ./scripts/create-dbs.sh --seed       # Create, migrate, and seed demo data
##

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
SEED_DATA=false
if [[ "$1" == "--seed" ]]; then
  SEED_DATA=true
fi

echo "🚀 Creating WellPulse databases..."
echo ""

# Step 1: Create master database
echo -e "${BLUE}📦 Step 1: Creating master database${NC}"
echo -n "   Creating wellpulse_master... "
if psql -h localhost -d postgres -c "CREATE DATABASE wellpulse_master OWNER wellpulse;" 2>/dev/null; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  echo -e "${RED}Error: Failed to create wellpulse_master${NC}"
  echo "Tip: Database may already exist. Run './scripts/drop-dbs.sh' first."
  exit 1
fi
echo ""

# Step 2: Run master migrations
echo -e "${BLUE}📦 Step 2: Running master database migrations${NC}"
cd /Users/jason/projects/wellpulse/apps/api
pnpm exec tsx src/infrastructure/database/scripts/migrate-master.ts
echo ""

# Step 3: Seed master database
echo -e "${BLUE}📦 Step 3: Seeding master database (creating tenants)${NC}"
pnpm exec tsx src/infrastructure/database/seeds/master.seed.ts
echo ""

# Step 4: Create tenant databases
echo -e "${BLUE}📦 Step 4: Creating tenant databases${NC}"

# Get tenant database names from master
TENANT_DBS=$(psql -h localhost -d wellpulse_master -t -c "SELECT database_name FROM tenants ORDER BY subdomain;")

for db in $TENANT_DBS; do
  db=$(echo $db | xargs) # trim whitespace
  echo -n "   Creating $db... "
  if psql -h localhost -d postgres -c "CREATE DATABASE $db OWNER wellpulse;" 2>/dev/null; then
    echo -e "${GREEN}✓${NC}"
  else
    echo -e "${RED}✗${NC}"
    echo -e "${RED}Error: Failed to create $db${NC}"
    exit 1
  fi
done
echo ""

# Step 5: Run tenant migrations
echo -e "${BLUE}📦 Step 5: Running tenant database migrations${NC}"
pnpm --filter=api db:migrate:tenant
echo ""

# Step 6: Seed demo tenant (optional)
if [ "$SEED_DATA" = true ]; then
  echo -e "${BLUE}📦 Step 6: Seeding demo tenant database${NC}"
  pnpm exec tsx src/infrastructure/database/seeds/tenant.seed.ts demo
  echo ""
fi

# Summary
echo ""
echo -e "${GREEN}✅ WellPulse databases created successfully!${NC}"
echo ""
echo "📊 Database Summary:"
echo ""

# Query master for tenant info
psql -h localhost -d wellpulse_master -c "
  SELECT
    subdomain,
    name,
    database_name,
    subscription_tier,
    status
  FROM tenants
  ORDER BY subdomain;
" 2>/dev/null

echo ""
echo -e "${YELLOW}📝 Login Credentials:${NC}"
echo ""
echo "  Master Admin:"
echo "    Email: admin@wellpulse.app"
echo "    Password: WellPulse2025!"
echo ""

if [ "$SEED_DATA" = true ]; then
  echo "  Demo Tenant Users:"
  echo "    andy@demo.com (Andy Administrator - ADMIN)"
  echo "    mandy@demo.com (Mandy Manager - MANAGER)"
  echo "    peter@demo.com (Peter Pumper - OPERATOR)"
  echo "    polly@demo.com (Polly Pumper - OPERATOR)"
  echo "    Password (all): demo123"
  echo ""
fi

echo "🎉 Done!"
echo ""
