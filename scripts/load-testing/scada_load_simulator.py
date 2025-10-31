#!/usr/bin/env python3
"""
SCADA Load Testing Simulator

Simulates realistic workloads for WellPulse:
1. SCADA data ingestion (OPC-UA simulated readings)
2. Mobile app manual data entry (field technician input)
3. Normal and peak load scenarios

Usage:
    python scada_load_simulator.py --mode normal    # 50 wells, 10 tags/well = 500 tags/sec
    python scada_load_simulator.py --mode peak      # 200 wells, 10 tags/well = 2000 tags/sec
    python scada_load_simulator.py --mode stress    # 1000 wells, 10 tags/well = 10K tags/sec
"""

import argparse
import asyncio
import random
import time
from datetime import datetime, timedelta
from typing import List, Dict
import httpx
import uuid
from dataclasses import dataclass
import statistics

@dataclass
class Well:
    """Represents a single well in the field"""
    id: str
    name: str
    latitude: float
    longitude: float
    tags: List['Tag']

@dataclass
class Tag:
    """Represents a single SCADA tag (sensor/measurement)"""
    id: str
    well_id: str
    node_id: str
    name: str
    data_type: str
    min_value: float
    max_value: float
    current_value: float
    variance: float  # How much the value can change per reading

@dataclass
class LoadProfile:
    """Load testing profile configuration"""
    name: str
    well_count: int
    tags_per_well: int
    reading_interval_ms: int  # How often readings are generated
    mobile_entries_per_minute: int  # Manual data entries from mobile apps
    duration_minutes: int

# Load profiles
PROFILES = {
    'normal': LoadProfile(
        name='Normal Operations',
        well_count=50,
        tags_per_well=10,
        reading_interval_ms=1000,  # 1 reading/sec per tag
        mobile_entries_per_minute=30,  # 30 manual entries/minute
        duration_minutes=60,
    ),
    'peak': LoadProfile(
        name='Peak Operations',
        well_count=200,
        tags_per_well=10,
        reading_interval_ms=1000,
        mobile_entries_per_minute=120,  # 120 manual entries/minute
        duration_minutes=60,
    ),
    'stress': LoadProfile(
        name='Stress Test',
        well_count=1000,
        tags_per_well=10,
        reading_interval_ms=1000,
        mobile_entries_per_minute=500,
        duration_minutes=30,
    ),
}

class ScadaSimulator:
    """Simulates SCADA data ingestion"""

    def __init__(self, profile: LoadProfile, grpc_endpoint: str = "localhost:50051"):
        self.profile = profile
        self.grpc_endpoint = grpc_endpoint
        self.wells: List[Well] = []
        self.stats = {
            'readings_sent': 0,
            'readings_failed': 0,
            'mobile_entries_sent': 0,
            'mobile_entries_failed': 0,
            'latencies': [],
        }

    def generate_wells(self) -> None:
        """Generate simulated wells with realistic Permian Basin coordinates"""
        print(f"Generating {self.profile.well_count} wells...")

        # Permian Basin approximate bounds
        lat_min, lat_max = 31.5, 32.5
        lon_min, lon_max = -103.0, -102.0

        for i in range(self.profile.well_count):
            well_id = str(uuid.uuid4())
            well = Well(
                id=well_id,
                name=f"WELL-{i+1:04d}",
                latitude=random.uniform(lat_min, lat_max),
                longitude=random.uniform(lon_min, lon_max),
                tags=[]
            )

            # Generate tags for this well
            for j in range(self.profile.tags_per_well):
                tag = self._generate_tag(well_id, j)
                well.tags.append(tag)

            self.wells.append(well)

        print(f"Generated {len(self.wells)} wells with {len(self.wells) * self.profile.tags_per_well} tags")

    def _generate_tag(self, well_id: str, tag_index: int) -> Tag:
        """Generate a realistic SCADA tag"""
        tag_types = [
            {'name': 'Pressure', 'type': 'Float', 'min': 0, 'max': 5000, 'variance': 50},
            {'name': 'Temperature', 'type': 'Float', 'min': 40, 'max': 200, 'variance': 5},
            {'name': 'FlowRate', 'type': 'Float', 'min': 0, 'max': 1000, 'variance': 20},
            {'name': 'LiquidLevel', 'type': 'Float', 'min': 0, 'max': 100, 'variance': 2},
            {'name': 'GasVolume', 'type': 'Float', 'min': 0, 'max': 50000, 'variance': 500},
            {'name': 'OilVolume', 'type': 'Float', 'min': 0, 'max': 10000, 'variance': 100},
            {'name': 'WaterCut', 'type': 'Float', 'min': 0, 'max': 100, 'variance': 1},
            {'name': 'MotorCurrent', 'type': 'Float', 'min': 0, 'max': 100, 'variance': 5},
            {'name': 'Vibration', 'type': 'Float', 'min': 0, 'max': 10, 'variance': 0.5},
            {'name': 'PowerConsumption', 'type': 'Float', 'min': 0, 'max': 50, 'variance': 2},
        ]

        tag_type = tag_types[tag_index % len(tag_types)]

        return Tag(
            id=str(uuid.uuid4()),
            well_id=well_id,
            node_id=f"ns=2;s={tag_type['name']}.{tag_index}",
            name=tag_type['name'],
            data_type=tag_type['type'],
            min_value=tag_type['min'],
            max_value=tag_type['max'],
            current_value=random.uniform(tag_type['min'], tag_type['max']),
            variance=tag_type['variance'],
        )

    def update_tag_value(self, tag: Tag) -> float:
        """Update tag value with realistic variance"""
        # Add random walk with bounds
        change = random.gauss(0, tag.variance)
        new_value = tag.current_value + change

        # Keep within bounds
        new_value = max(tag.min_value, min(tag.max_value, new_value))
        tag.current_value = new_value

        return new_value

    async def simulate_scada_readings(self, api_url: str, tenant_id: str) -> None:
        """Simulate continuous SCADA readings"""
        print(f"Starting SCADA reading simulation for {len(self.wells)} wells...")

        async with httpx.AsyncClient(timeout=30.0) as client:
            interval_sec = self.profile.reading_interval_ms / 1000.0

            while True:
                batch_start = time.time()

                # Generate readings for all tags
                tasks = []
                for well in self.wells:
                    for tag in well.tags:
                        value = self.update_tag_value(tag)
                        tasks.append(
                            self._send_reading(
                                client,
                                api_url,
                                tenant_id,
                                well.id,
                                tag.node_id,
                                value,
                            )
                        )

                # Send all readings concurrently
                results = await asyncio.gather(*tasks, return_exceptions=True)

                # Update stats
                for result in results:
                    if isinstance(result, Exception):
                        self.stats['readings_failed'] += 1
                    else:
                        self.stats['readings_sent'] += 1

                batch_duration = time.time() - batch_start

                # Print stats every 10 seconds
                if self.stats['readings_sent'] % (len(self.wells) * self.profile.tags_per_well * 10) == 0:
                    self._print_stats()

                # Wait for next interval
                sleep_time = max(0, interval_sec - batch_duration)
                await asyncio.sleep(sleep_time)

    async def _send_reading(
        self,
        client: httpx.AsyncClient,
        api_url: str,
        tenant_id: str,
        well_id: str,
        tag_node_id: str,
        value: float,
    ) -> None:
        """Send a single reading to the API"""
        start = time.time()

        try:
            # In production, this would go directly to the Rust ingestion service
            # For testing, we'll send to NestJS API which forwards to Rust
            response = await client.post(
                f"{api_url}/api/scada/readings",
                json={
                    'wellId': well_id,
                    'tagNodeId': tag_node_id,
                    'timestamp': datetime.utcnow().isoformat(),
                    'value': value,
                    'quality': 'Good',
                },
                headers={'X-Tenant-ID': tenant_id},
            )
            response.raise_for_status()

            latency = (time.time() - start) * 1000  # ms
            self.stats['latencies'].append(latency)

        except Exception as e:
            print(f"Error sending reading: {e}")
            raise

    async def simulate_mobile_entries(self, api_url: str, tenant_id: str) -> None:
        """Simulate manual data entry from mobile apps"""
        print(f"Starting mobile app simulation ({self.profile.mobile_entries_per_minute} entries/min)...")

        async with httpx.AsyncClient(timeout=30.0) as client:
            interval_sec = 60.0 / self.profile.mobile_entries_per_minute

            while True:
                # Random well
                well = random.choice(self.wells)

                # Simulate field technician data entry
                entry = {
                    'wellId': well.id,
                    'entryType': random.choice(['production', 'inspection', 'maintenance']),
                    'timestamp': datetime.utcnow().isoformat(),
                    'data': self._generate_mobile_entry_data(),
                }

                try:
                    response = await client.post(
                        f"{api_url}/api/field-data",
                        json=entry,
                        headers={'X-Tenant-ID': tenant_id},
                    )
                    response.raise_for_status()
                    self.stats['mobile_entries_sent'] += 1
                except Exception as e:
                    self.stats['mobile_entries_failed'] += 1
                    print(f"Error sending mobile entry: {e}")

                await asyncio.sleep(interval_sec)

    def _generate_mobile_entry_data(self) -> Dict:
        """Generate realistic mobile app data entry"""
        entry_type = random.choice(['production', 'inspection', 'maintenance'])

        if entry_type == 'production':
            return {
                'oilVolume': random.uniform(0, 500),
                'gasVolume': random.uniform(0, 5000),
                'waterVolume': random.uniform(0, 200),
                'runTime': random.uniform(0, 24),
                'downTime': random.uniform(0, 2),
            }
        elif entry_type == 'inspection':
            return {
                'condition': random.choice(['Good', 'Fair', 'Poor']),
                'notes': 'Routine inspection',
                'issues': random.choice([[], ['Minor leak'], ['Vibration detected']]),
            }
        else:  # maintenance
            return {
                'workType': random.choice(['Preventive', 'Corrective', 'Emergency']),
                'partsReplaced': random.choice([[], ['Pump seal'], ['Motor bearing']]),
                'laborHours': random.uniform(0.5, 8.0),
                'cost': random.uniform(100, 5000),
            }

    def _print_stats(self) -> None:
        """Print current statistics"""
        total_readings = self.stats['readings_sent'] + self.stats['readings_failed']
        total_mobile = self.stats['mobile_entries_sent'] + self.stats['mobile_entries_failed']

        success_rate_scada = (
            (self.stats['readings_sent'] / total_readings * 100) if total_readings > 0 else 0
        )
        success_rate_mobile = (
            (self.stats['mobile_entries_sent'] / total_mobile * 100) if total_mobile > 0 else 0
        )

        avg_latency = statistics.mean(self.stats['latencies'][-1000:]) if self.stats['latencies'] else 0
        p95_latency = (
            statistics.quantiles(self.stats['latencies'][-1000:], n=20)[18]
            if len(self.stats['latencies']) >= 1000
            else 0
        )

        print(f"\n{'='*80}")
        print(f"Load Testing Stats - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*80}")
        print(f"Profile: {self.profile.name}")
        print(f"Wells: {len(self.wells)} | Tags: {len(self.wells) * self.profile.tags_per_well}")
        print(f"\nSCADA Readings:")
        print(f"  Sent: {self.stats['readings_sent']:,} ({success_rate_scada:.2f}% success)")
        print(f"  Failed: {self.stats['readings_failed']:,}")
        print(f"  Avg Latency: {avg_latency:.2f}ms | P95: {p95_latency:.2f}ms")
        print(f"\nMobile Entries:")
        print(f"  Sent: {self.stats['mobile_entries_sent']:,} ({success_rate_mobile:.2f}% success)")
        print(f"  Failed: {self.stats['mobile_entries_failed']:,}")
        print(f"{'='*80}\n")

    async def run(self, api_url: str, tenant_id: str) -> None:
        """Run the full simulation"""
        self.generate_wells()

        print(f"\nStarting {self.profile.name} load test")
        print(f"Target: {len(self.wells) * self.profile.tags_per_well} readings/sec")
        print(f"Duration: {self.profile.duration_minutes} minutes")
        print(f"API Endpoint: {api_url}\n")

        # Run both simulators concurrently
        try:
            await asyncio.gather(
                self.simulate_scada_readings(api_url, tenant_id),
                self.simulate_mobile_entries(api_url, tenant_id),
            )
        except KeyboardInterrupt:
            print("\n\nStopping simulation...")
            self._print_stats()

def main():
    parser = argparse.ArgumentParser(description='SCADA Load Testing Simulator')
    parser.add_argument(
        '--mode',
        choices=['normal', 'peak', 'stress'],
        default='normal',
        help='Load profile to use',
    )
    parser.add_argument(
        '--api-url',
        default='http://localhost:4000',
        help='API endpoint URL',
    )
    parser.add_argument(
        '--tenant-id',
        default=str(uuid.uuid4()),
        help='Tenant ID for testing',
    )

    args = parser.parse_args()

    profile = PROFILES[args.mode]
    simulator = ScadaSimulator(profile)

    print(f"""
╔══════════════════════════════════════════════════════════════╗
║         WellPulse SCADA Load Testing Simulator               ║
╚══════════════════════════════════════════════════════════════╝

Profile: {profile.name}
Wells: {profile.well_count}
Tags per Well: {profile.tags_per_well}
Total Tags: {profile.well_count * profile.tags_per_well}
Target Throughput: {profile.well_count * profile.tags_per_well} readings/sec
Mobile Entries: {profile.mobile_entries_per_minute}/min
Duration: {profile.duration_minutes} minutes

Press Ctrl+C to stop
    """)

    asyncio.run(simulator.run(args.api_url, args.tenant_id))

if __name__ == '__main__':
    main()
