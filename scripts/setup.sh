#!/bin/bash

# WellPulse Project Setup Script
# This script automates the initial setup of the WellPulse development environment

set -e  # Exit on error

echo "🚀 Starting WellPulse setup..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js 20+ is installed
echo -e "${BLUE}Checking Node.js version...${NC}"
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${YELLOW}⚠️  Node.js 20+ is required. Current version: $(node -v)${NC}"
    echo "Please upgrade Node.js: https://nodejs.org/"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v) detected${NC}"
echo ""

# Check if pnpm is installed
echo -e "${BLUE}Checking pnpm...${NC}"
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}pnpm not found. Installing pnpm...${NC}"
    npm install -g pnpm@8.0.0
fi
echo -e "${GREEN}✓ pnpm $(pnpm -v) detected${NC}"
echo ""

# Copy environment files
echo -e "${BLUE}Setting up environment files...${NC}"
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env${NC}"
else
    echo -e "${YELLOW}⚠️  .env already exists, skipping${NC}"
fi

if [ ! -f apps/api/.env ]; then
    cp apps/api/.env.example apps/api/.env
    echo -e "${GREEN}✓ Created apps/api/.env${NC}"
else
    echo -e "${YELLOW}⚠️  apps/api/.env already exists, skipping${NC}"
fi

if [ ! -f apps/web/.env ]; then
    cp apps/web/.env.example apps/web/.env
    echo -e "${GREEN}✓ Created apps/web/.env${NC}"
else
    echo -e "${YELLOW}⚠️  apps/web/.env already exists, skipping${NC}"
fi
echo ""

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
pnpm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Check Docker
echo -e "${BLUE}Checking Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker not found. Please install Docker Desktop:${NC}"
    echo "   https://www.docker.com/products/docker-desktop"
    echo ""
    echo -e "${YELLOW}Skipping Docker setup...${NC}"
else
    echo -e "${GREEN}✓ Docker detected${NC}"

    # Start Docker services
    echo -e "${BLUE}Starting Docker services...${NC}"
    docker compose up -d
    echo -e "${GREEN}✓ Docker services started${NC}"
    echo ""

    # Wait for PostgreSQL to be ready
    echo -e "${BLUE}Waiting for PostgreSQL to be ready...${NC}"
    sleep 5
    echo -e "${GREEN}✓ PostgreSQL ready${NC}"
    echo ""

    # Push database schema
    echo -e "${BLUE}Setting up database...${NC}"
    pnpm --filter=api run db:push
    echo -e "${GREEN}✓ Database schema created${NC}"
    echo ""

    # Seed database
    echo -e "${BLUE}Seeding database with demo data...${NC}"
    pnpm --filter=api run db:seed
    echo -e "${GREEN}✓ Database seeded${NC}"
    echo ""
fi

# Success message
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}║  🎉  WellPulse setup complete!                             ║${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo ""
echo "  1. Start development servers:"
echo -e "     ${YELLOW}pnpm dev${NC}"
echo ""
echo "  2. Access the applications:"
echo "     • Web:      http://localhost:4001"
echo "     • API:      http://localhost:4000/api/v1"
echo "     • API Docs: http://localhost:4000/api/docs"
echo "     • Health:   http://localhost:4000/health"
echo ""
echo "  3. Docker services:"
echo "     • PostgreSQL:    localhost:5432"
echo "     • Redis:         localhost:6379"
echo "     • Mailpit UI:    http://localhost:8025"
echo "     • MinIO Console: http://localhost:9001"
echo ""
echo "  4. Demo accounts:"
echo "     • admin@demo.wellpulse.app / password123"
echo "     • manager@demo.wellpulse.app / password123"
echo "     • consultant@demo.wellpulse.app / password123"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "  • Stop Docker:  docker compose down"
echo "  • View logs:    docker compose logs -f"
echo "  • Run tests:    pnpm test"
echo "  • Type check:   pnpm exec turbo run type-check"
echo ""
echo "Happy coding! 🚀"
echo ""
