#!/usr/bin/env python3
import sys
sys.path.insert(0, '/Users/jason/projects/wellpulse/scripts/load-testing')
from scada_load_simulator import LoadProfile, LoadTester
import asyncio

# Quick 30-second test
quick_profile = LoadProfile(
    name='Quick Test (30s)',
    well_count=10,
    tags_per_well=5,
    reading_interval_ms=1000,
    mobile_entries_per_minute=10,
    duration_seconds=30
)

async def main():
    tester = LoadTester(
        quick_profile,
        'postgresql://wellpulse:wellpulse@localhost:5432/wellpulse_internal'
    )
    await tester.run()

asyncio.run(main())
