# WellPulse Production Data Simulator

Continuously generates realistic SCADA readings and manual pumper entries for testing the WellPulse platform with real-world production data patterns.

## Features

### 🏭 Well Seeding
- **10 Permian Basin wells** with realistic configurations:
  - 4 high-producing horizontal wells (Wolfcamp, Bone Spring, Spraberry)
  - 2 medium-producing directional wells (Delaware, Avalon)
  - 4 lower-producing vertical wells (San Andres, Clearfork, Yates, Grayburg)
- Realistic API numbers (Texas state code 42)
- Geographic locations within Midland and Delaware basins
- Varied production baselines matching actual Permian production rates

### 📡 SCADA Data (Automated Sensor Readings)
- **Frequency**: Every 5 minutes (configurable)
- **Parameters**:
  - Oil production (barrels per day)
  - Gas production (MCF per day)
  - Water production (barrels per day)
  - Tubing pressure (PSI)
  - Casing pressure (PSI)
  - Temperature (°F)

### 👷 Manual Pumper Entries (Field Personnel Reports)
- **Frequency**: Twice daily at shift changes (6 AM and 6 PM ±30 minutes)
- **Data**: Rounded whole numbers (realistic manual reporting)
- Simulates field personnel making daily production checks

### 🌡️ Realistic Production Patterns
- **Seasonal variations**: Summer heat reduces efficiency by ~10%
- **Daily cycles**: Slight production dip during midday heat
- **Equipment efficiency**: Random 95-105% variations
- **Equipment failures**: 5% chance of 50% production drop
- **Well decline curve**: 0.5% monthly production decline
- **Well age simulation**: 0-24 months of production history

## Usage

### Quick Start

```bash
# 1. Ensure API server is running
pnpm --filter=api dev

# 2. Run continuous simulation
pnpm simulate:data

# 3. Or seed wells only (no continuous data)
pnpm simulate:seed
```

### Advanced Configuration

```bash
# Custom SCADA interval (300000ms = 5 minutes)
pnpm simulate:data --scada-interval=300000

# Custom pumper interval (43200000ms = 12 hours)
pnpm simulate:data --pumper-interval=43200000

# Seed only (no continuous simulation)
pnpm simulate:data --seed-only

# Environment variables
API_URL=http://localhost:4000/api \
TENANT_SUBDOMAIN=demo \
SCADA_INTERVAL=300000 \
PUMPER_INTERVAL=43200000 \
pnpm simulate:data
```

### Running in Background

```bash
# Using nohup
nohup pnpm simulate:data > /tmp/wellpulse-simulation.log 2>&1 &

# Using screen
screen -S wellpulse-sim
pnpm simulate:data
# Press Ctrl+A, then D to detach

# Reattach later
screen -r wellpulse-sim
```

## Sample Output

```
╔════════════════════════════════════════════════════════════════╗
║   WellPulse Production Data Simulator (Permian Basin)         ║
╚════════════════════════════════════════════════════════════════╝

🌱 Seeding wells...

✓ Created well: Wolfcamp A-1H (42-165-28374)
✓ Created well: Wolfcamp B-2H (42-329-45892)
✓ Created well: Bone Spring-3H (42-087-56123)
✓ Created well: Spraberry-4H (42-271-38492)
✓ Created well: Delaware-5D (42-412-67234)
✓ Created well: Avalon-6D (42-198-41567)
✓ Created well: San Andres-7V (42-354-29485)
✓ Created well: Clearfork-8V (42-276-53812)
✓ Created well: Yates-9V (42-441-38476)
✓ Created well: Grayburg-10V (42-183-62849)

✅ Seeded 10 wells

🏭 Starting production data simulation...
   SCADA interval: 300s
   Pumper interval: 43200s

📊 Generating initial readings...

📡 SCADA [2025-10-31T01:23:15.234Z] Wolfcamp A-1H: Oil=248.3 bbl, Gas=445.7 mcf, H2O=178.2 bbl
📡 SCADA [2025-10-31T01:23:15.345Z] Wolfcamp B-2H: Oil=217.9 bbl, Gas=415.3 mcf, H2O=162.1 bbl
📡 SCADA [2025-10-31T01:23:15.456Z] Bone Spring-3H: Oil=276.4 bbl, Gas=472.8 mcf, H2O=195.7 bbl
...
👷 PUMPER [2025-10-31T06:15:32.123Z] Wolfcamp A-1H: Oil=250 bbl, Gas=448 mcf, H2O=180 bbl
...

✅ Simulation running. Press Ctrl+C to stop.
```

## Architecture

### Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│  Simulator (TypeScript)                                      │
└─────────┬────────────────────────────────────┬───────────────┘
          │                                    │
          │ 📡 SCADA (every 5 min)            │ 👷 Pumper (6 AM/PM)
          │ Automated sensor data              │ Manual field reports
          │                                    │
          ↓                                    ↓
┌─────────────────────┐              ┌──────────────────────┐
│  Rust SCADA Service │              │  NestJS API          │
│  Port: 50051 (gRPC) │              │  Port: 4000 (REST)   │
└──────────┬──────────┘              └──────────┬───────────┘
           │                                    │
           ↓                                    ↓
  ┌──────────────────┐                ┌──────────────────┐
  │  TimescaleDB     │                │  PostgreSQL      │
  │  (time-series)   │                │  (field_data)    │
  └──────────────────┘                └──────────────────┘
```

**Key Differences:**
- **SCADA**: High-frequency automated readings → Rust gRPC service → TimescaleDB (optimized for time-series)
- **Pumper**: Low-frequency manual entries → NestJS REST API → PostgreSQL (traditional relational data)

### Production Calculation

```typescript
finalProduction = baseline
  × seasonalFactor      // Summer heat (-10%)
  × dailyCycleFactor    // Midday dip (-5%)
  × efficiencyFactor    // Random (95-105%)
  × equipmentIssue      // Occasional failures (50%)
  × declineCurve        // Monthly decline (0.5%)
```

## Testing

The simulator is designed for:

1. **Load Testing**: Generate sustained traffic to test API performance
2. **Dashboard Testing**: Populate dashboards with realistic time-series data
3. **Alert Testing**: Trigger anomaly detection and alerting systems
4. **Mobile App Testing**: Test offline sync with realistic field data patterns
5. **ML Model Training**: Generate training data for predictive maintenance models

## Troubleshooting

### Authentication Errors

```bash
# Error: 401 Unauthorized
# Solution: Login first or disable auth for testing
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@wellpulse.app", "password": "test123"}'
```

### Port Issues

```bash
# Error: ECONNREFUSED
# Solution: Ensure API server is running on port 4000
pnpm --filter=api dev
```

### Database Issues

```bash
# Error: Database connection failed
# Solution: Ensure PostgreSQL is running and tenant database exists
PGPASSWORD=wellpulse psql -U wellpulse -h localhost -c "CREATE DATABASE demo_wellpulse"
```

## Future Enhancements

- [ ] Actual gRPC integration with Rust SCADA service
- [ ] CSV file generation for bulk import testing
- [ ] Equipment maintenance event simulation
- [ ] Weather-based production impacts
- [ ] Multi-tenant simulation (multiple operators)
- [ ] Gas lift optimization scenarios
- [ ] ESP (Electric Submersible Pump) failure simulation
- [ ] Regulatory compliance event triggers

## References

- **Permian Basin**: World's most productive oil field (Midland & Delaware basins)
- **API Number Format**: State-County-Sequence (42-XXX-XXXXX for Texas)
- **Production Ranges**: Based on 2024 Permian Basin production averages
- **Decline Curves**: Typical Permian horizontal well decline of 60% in year 1, then 5-10% annually
