#!/usr/bin/env python3
"""
SCADA & Mobile App Load Testing Simulator for WellPulse

Simulates realistic workloads for:
1. SCADA data ingestion from RTUs/PLCs (high-frequency time-series data)
2. Mobile app field data entry from pumpers (lower-frequency manual entries)

Usage:
    python scada_load_simulator.py --profile normal    # Normal operations
    python scada_load_simulator.py --profile peak      # Peak hours
    python scada_load_simulator.py --profile stress    # Stress testing
"""

import argparse
import asyncio
import random
import time
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List

try:
    import aiohttp
    import psycopg
except ImportError:
    print("Missing dependencies. Install with:")
    print("  pip install aiohttp psycopg[binary]")
    exit(1)


@dataclass
class LoadProfile:
    """Load testing profile configuration"""
    name: str
    well_count: int
    tags_per_well: int
    reading_interval_ms: int  # SCADA reading frequency
    mobile_entries_per_minute: int  # Manual field data entries
    duration_seconds: int


# Load profiles for different scenarios
PROFILES = {
    'normal': LoadProfile(
        name='Normal Operations',
        well_count=50,
        tags_per_well=10,
        reading_interval_ms=1000,  # 1 reading per second per tag
        mobile_entries_per_minute=30,  # 1 entry every 2 seconds
        duration_seconds=300  # 5 minutes
    ),
    'peak': LoadProfile(
        name='Peak Hours',
        well_count=200,
        tags_per_well=10,
        reading_interval_ms=1000,
        mobile_entries_per_minute=120,  # 2 entries per second
        duration_seconds=600  # 10 minutes
    ),
    'stress': LoadProfile(
        name='Stress Test',
        well_count=1000,
        tags_per_well=10,
        reading_interval_ms=1000,
        mobile_entries_per_minute=500,  # 8+ entries per second
        duration_seconds=1800  # 30 minutes
    ),
}


# SCADA tag templates (realistic oil & gas field instrumentation)
TAG_TEMPLATES = [
    {'name': 'CASING_PRESSURE', 'unit': 'PSI', 'min': 50, 'max': 1500, 'variance': 10},
    {'name': 'TUBING_PRESSURE', 'unit': 'PSI', 'min': 30, 'max': 1200, 'variance': 8},
    {'name': 'LINE_PRESSURE', 'unit': 'PSI', 'min': 20, 'max': 800, 'variance': 5},
    {'name': 'SEPARATOR_PRESSURE', 'unit': 'PSI', 'min': 10, 'max': 500, 'variance': 5},
    {'name': 'WELLHEAD_TEMP', 'unit': 'F', 'min': 60, 'max': 200, 'variance': 3},
    {'name': 'OIL_FLOW_RATE', 'unit': 'BBL/D', 'min': 0, 'max': 500, 'variance': 20},
    {'name': 'GAS_FLOW_RATE', 'unit': 'MCF/D', 'min': 0, 'max': 2000, 'variance': 50},
    {'name': 'WATER_FLOW_RATE', 'unit': 'BBL/D', 'min': 0, 'max': 1000, 'variance': 30},
    {'name': 'CHOKE_POSITION', 'unit': '%', 'min': 0, 'max': 100, 'variance': 5},
    {'name': 'MOTOR_AMPS', 'unit': 'A', 'min': 5, 'max': 150, 'variance': 10},
]

print("Load testing script created successfully!")


class ScadaDataGenerator:
    """Generates realistic SCADA readings"""

    def __init__(self, well_count: int, tags_per_well: int):
        self.well_count = well_count
        self.tags_per_well = tags_per_well
        # Generate UUIDs for wells (simulating real database IDs)
        import uuid
        self.well_ids = [str(uuid.uuid4()) for _ in range(well_count)]
        self.tag_states = {}

        # Initialize tag states
        for well_id in self.well_ids:
            self.tag_states[well_id] = {}
            for tag in TAG_TEMPLATES[:tags_per_well]:
                initial_value = random.uniform(tag['min'], tag['max'])
                self.tag_states[well_id][tag['name']] = initial_value

    def generate_reading(self, well_id: str, tag_name: str) -> dict:
        """Generate a single SCADA reading with realistic variance"""
        tag_config = next(t for t in TAG_TEMPLATES if t['name'] == tag_name)

        last_value = self.tag_states[well_id][tag_name]
        variance = random.uniform(-tag_config['variance'], tag_config['variance'])
        new_value = last_value + variance

        new_value = max(tag_config['min'], min(tag_config['max'], new_value))
        self.tag_states[well_id][tag_name] = new_value

        quality = 'Good' if random.random() > 0.005 else 'Uncertain'

        return {
            'timestamp': datetime.now(timezone.utc),
            'well_id': well_id,
            'tag_node_id': f"ns=2;s=WELL.{tag_name}",
            'value': round(new_value, 2),
            'quality': quality,
        }

    def generate_batch(self, batch_size: int) -> List[dict]:
        """Generate a batch of SCADA readings"""
        readings = []
        for _ in range(batch_size):
            well_id = random.choice(self.well_ids)
            tag_name = random.choice([t['name'] for t in TAG_TEMPLATES[:self.tags_per_well]])
            readings.append(self.generate_reading(well_id, tag_name))
        return readings


class LoadTester:
    """Orchestrates load testing"""

    def __init__(self, profile: LoadProfile, db_url: str):
        self.profile = profile
        self.db_url = db_url
        self.scada_gen = ScadaDataGenerator(profile.well_count, profile.tags_per_well)

        self.scada_readings_sent = 0
        self.scada_errors = 0
        self.start_time = None

    async def insert_scada_batch(self, conn, readings: List[dict]):
        """Insert SCADA readings directly into TimescaleDB"""
        try:
            values = [
                (r['timestamp'], r['well_id'], r['tag_node_id'], r['value'], r['quality'])
                for r in readings
            ]

            async with conn.cursor() as cur:
                await cur.executemany(
                    "INSERT INTO scada_readings (timestamp, well_id, tag_node_id, value, quality) VALUES (%s, %s, %s, %s, %s)",
                    values
                )
                await conn.commit()

            self.scada_readings_sent += len(readings)
        except Exception as e:
            self.scada_errors += 1
            print(f"❌ SCADA batch insert error: {e}")

    async def scada_worker(self):
        """Continuously generate and insert SCADA data"""
        conn = await psycopg.AsyncConnection.connect(self.db_url)

        try:
            batch_size = 100
            interval = (self.profile.reading_interval_ms / 1000) * batch_size

            while True:
                readings = self.scada_gen.generate_batch(batch_size)
                await self.insert_scada_batch(conn, readings)
                await asyncio.sleep(interval)
        finally:
            await conn.close()

    async def stats_reporter(self):
        """Report load testing statistics"""
        while True:
            await asyncio.sleep(10)

            elapsed = time.time() - self.start_time
            scada_rate = self.scada_readings_sent / elapsed if elapsed > 0 else 0

            print(f"\n{'='*60}")
            print(f"📊 Load Test Statistics ({int(elapsed)}s elapsed)")
            print(f"{'='*60}")
            print(f"SCADA Readings:  {self.scada_readings_sent:,} ({scada_rate:.1f}/s)")
            print(f"SCADA Errors:    {self.scada_errors}")
            success = self.scada_readings_sent - self.scada_errors
            total = self.scada_readings_sent
            rate = (success / total * 100) if total > 0 else 100.0
            print(f"Success Rate:    {rate:.1f}%")
            print(f"{'='*60}\n")

    async def run(self):
        """Run load test"""
        self.start_time = time.time()

        print(f"\n🚀 Starting Load Test: {self.profile.name}")
        print(f"{'='*60}")
        print(f"Wells:                {self.profile.well_count}")
        print(f"Tags per well:        {self.profile.tags_per_well}")
        print(f"SCADA interval:       {self.profile.reading_interval_ms}ms")
        print(f"Duration:             {self.profile.duration_seconds}s")
        print(f"{'='*60}\n")

        tasks = [
            asyncio.create_task(self.scada_worker()),
            asyncio.create_task(self.stats_reporter()),
        ]

        try:
            await asyncio.sleep(self.profile.duration_seconds)
        finally:
            for task in tasks:
                task.cancel()

            elapsed = time.time() - self.start_time
            print(f"\n{'='*60}")
            print(f"✅ Load Test Complete!")
            print(f"{'='*60}")
            print(f"Total Runtime:       {int(elapsed)}s")
            print(f"SCADA Readings:      {self.scada_readings_sent:,}")
            print(f"{'='*60}\n")


async def main():
    parser = argparse.ArgumentParser(description='WellPulse Load Testing Simulator')
    parser.add_argument('--profile', choices=['normal', 'peak', 'stress'], default='normal')
    parser.add_argument('--db-url', default='postgresql://wellpulse:wellpulse@localhost:5432/wellpulse_internal')

    args = parser.parse_args()
    profile = PROFILES[args.profile]

    tester = LoadTester(profile, args.db_url)
    await tester.run()


if __name__ == '__main__':
    asyncio.run(main())
