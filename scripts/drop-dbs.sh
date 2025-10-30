#!/bin/bash

##
## Drop WellPulse Databases
##
## Drops all WellPulse databases (master + tenant databases)
## Usage: ./scripts/drop-dbs.sh
##

set -e

echo "🗑️  Dropping WellPulse databases..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Database list
DATABASES=(
  "wellpulse_master"
  "wellpulse_internal"
  "demo_wellpulse"
)

# Terminate all connections to WellPulse databases
echo "⚠️  Terminating active connections..."
for db in "${DATABASES[@]}"; do
  psql -h localhost -d postgres -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = '$db' AND pid <> pg_backend_pid();
  " 2>/dev/null || true
done

echo ""
echo "🔥 Dropping databases..."

# Drop each database
for db in "${DATABASES[@]}"; do
  echo -n "   Dropping $db... "
  if psql -h localhost -d postgres -c "DROP DATABASE IF EXISTS $db;" 2>/dev/null; then
    echo -e "${GREEN}✓${NC}"
  else
    echo -e "${RED}✗${NC}"
    echo -e "${RED}Error: Failed to drop $db${NC}"
    exit 1
  fi
done

echo ""
echo -e "${GREEN}✅ All WellPulse databases dropped successfully!${NC}"
echo ""
echo "Databases removed:"
for db in "${DATABASES[@]}"; do
  echo "   - $db"
done
echo ""
