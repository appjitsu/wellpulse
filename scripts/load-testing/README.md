# SCADA Load Testing Simulator

Comprehensive load testing tool for WellPulse SCADA ingestion and mobile data entry.

## Features

- **SCADA Data Simulation**: Generates realistic OPC-UA tag readings with proper variance
- **Mobile App Simulation**: Simulates field technicians entering production, inspection, and maintenance data
- **Multiple Load Profiles**: Normal, Peak, and Stress test scenarios
- **Realistic Data**: Permian Basin coordinates, proper tag types, realistic value ranges
- **Continuous Operation**: Runs indefinitely until stopped
- **Real-time Metrics**: Success rates, latencies, throughput

## Installation

```bash
cd scripts/load-testing
pip install -r requirements.txt
```

## Usage

### Normal Operations (50 wells, 500 tags/sec)
```bash
python scada_load_simulator.py --mode normal
```

### Peak Operations (200 wells, 2000 tags/sec)
```bash
python scada_load_simulator.py --mode peak
```

### Stress Test (1000 wells, 10K tags/sec)
```bash
python scada_load_simulator.py --mode stress
```

### Custom Configuration
```bash
python scada_load_simulator.py \
  --mode peak \
  --api-url http://localhost:4000 \
  --tenant-id 12345678-1234-1234-1234-123456789012
```

## Load Profiles

### Normal Operations
- **Wells**: 50
- **Tags per Well**: 10
- **Total Tags**: 500
- **Reading Interval**: 1 second
- **Throughput**: 500 readings/sec
- **Mobile Entries**: 30/minute
- **Duration**: 60 minutes

### Peak Operations
- **Wells**: 200
- **Tags per Well**: 10
- **Total Tags**: 2,000
- **Reading Interval**: 1 second
- **Throughput**: 2,000 readings/sec
- **Mobile Entries**: 120/minute
- **Duration**: 60 minutes

### Stress Test
- **Wells**: 1,000
- **Tags per Well**: 10
- **Total Tags**: 10,000
- **Reading Interval**: 1 second
- **Throughput**: 10,000 readings/sec
- **Mobile Entries**: 500/minute
- **Duration**: 30 minutes

## Simulated Tag Types

The simulator generates realistic SCADA tags:

1. **Pressure** (0-5000 PSI)
2. **Temperature** (40-200°F)
3. **Flow Rate** (0-1000 BBL/day)
4. **Liquid Level** (0-100%)
5. **Gas Volume** (0-50,000 MCF)
6. **Oil Volume** (0-10,000 BBL)
7. **Water Cut** (0-100%)
8. **Motor Current** (0-100 A)
9. **Vibration** (0-10 mm/s)
10. **Power Consumption** (0-50 kW)

## Mobile Data Entry Types

### Production Entries
- Oil/gas/water volumes
- Run time and downtime
- Equipment status

### Inspection Entries
- Equipment condition
- Visual inspection notes
- Identified issues

### Maintenance Entries
- Work type (preventive, corrective, emergency)
- Parts replaced
- Labor hours and costs

## Metrics

The simulator tracks and reports:

- **SCADA Readings**: Success rate, failure count, throughput
- **Mobile Entries**: Success rate, failure count
- **Latency**: Average and P95 latency for API calls
- **Timestamp**: Current time for monitoring trends

Example output:
```
================================================================================
Load Testing Stats - 2025-01-30 14:23:15
================================================================================
Profile: Peak Operations
Wells: 200 | Tags: 2,000

SCADA Readings:
  Sent: 120,000 (99.98% success)
  Failed: 24
  Avg Latency: 12.34ms | P95: 45.67ms

Mobile Entries:
  Sent: 240 (100.00% success)
  Failed: 0
================================================================================
```

## Integration with Rust SCADA Service

The load simulator is designed to test the complete data pipeline:

```
Load Simulator → NestJS API → Rust Ingestion Service → TimescaleDB
```

1. **Simulator** generates realistic SCADA readings and mobile entries
2. **NestJS API** receives data via REST endpoints
3. **Rust Service** ingests SCADA data via OPC-UA simulation or direct gRPC
4. **TimescaleDB** stores readings in per-tenant hypertables

## Continuous Operation

The simulator runs indefinitely until stopped with `Ctrl+C`. This allows for:

- Long-running soak tests
- 24/7 system validation
- Performance regression detection
- Database growth monitoring

## Troubleshooting

### High Failure Rate
- Check API endpoint is accessible
- Verify tenant ID exists in database
- Check database connection pool settings
- Monitor Rust service logs

### High Latency
- Check network connectivity
- Monitor database query performance
- Verify TimescaleDB indexes
- Check aggregation buffer settings

### Memory Issues
- Reduce load profile (use `normal` instead of `stress`)
- Check Rust service memory usage
- Monitor database connection pool

## Performance Targets

Expected performance with optimized system:

| Metric | Target | Acceptable |
|--------|--------|------------|
| SCADA Throughput | 10,000 readings/sec | 5,000 readings/sec |
| API Latency (avg) | < 10ms | < 50ms |
| API Latency (P95) | < 50ms | < 200ms |
| Success Rate | > 99.9% | > 99% |
| Database Write Latency | < 100ms | < 500ms |

## Next Steps

1. Run normal profile to establish baseline
2. Run peak profile to test production capacity
3. Run stress test to find breaking points
4. Monitor Prometheus metrics during tests
5. Analyze TimescaleDB query performance
6. Tune aggregation buffer settings
7. Optimize database indexes
