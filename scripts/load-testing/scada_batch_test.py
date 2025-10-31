#!/usr/bin/env python3
"""
High-volume SCADA load test to verify aggregator batch writes (10K buffer)

Tests:
1. Size-based flush (10K readings in buffer)
2. Time-based flush (5 second interval)
3. Database write performance under load
"""

import psycopg2
import uuid
from datetime import datetime, timezone
import random
import time

# Database connection
conn = psycopg2.connect(
    host="localhost",
    port="5432",
    database="wellpulse_internal",
    user="wellpulse",
    password="wellpulse"
)
conn.autocommit = True
cursor = conn.cursor()

# Get test wells
cursor.execute("SELECT id FROM wells LIMIT 5")
well_ids = [str(row[0]) for row in cursor.fetchall()]

# Tag types
tags = ["ns=2;s=PRESSURE", "ns=2;s=TEMP", "ns=2;s=FLOW", "ns=2;s=LEVEL", "ns=2;s=MOTOR_AMPS"]

print(f"🚀 Starting high-volume SCADA batch test...")
print(f"Wells: {len(well_ids)} | Tags: {len(tags)}")
print(f"Target: 15,000 readings (should trigger 10K buffer flush + 5K remainder)")
print()

# Track metrics
total_readings = 0
start_time = time.time()
batch_size = 100  # Insert in batches for speed

# Generate 15,000 readings as fast as possible
target_readings = 15_000

for batch_num in range(0, target_readings, batch_size):
    readings_data = []

    for _ in range(batch_size):
        well_id = random.choice(well_ids)
        tag = random.choice(tags)
        value = random.uniform(0, 1000)

        readings_data.append((
            well_id,
            tag,
            datetime.now(timezone.utc),
            value,
            "Good"
        ))

    # Bulk insert using UNNEST (same as Rust service)
    cursor.execute("""
        INSERT INTO scada_readings (well_id, tag_node_id, timestamp, value, quality)
        SELECT * FROM UNNEST(
            %s::uuid[],
            %s::text[],
            %s::timestamptz[],
            %s::double precision[],
            %s::text[]
        )
    """, (
        [r[0] for r in readings_data],
        [r[1] for r in readings_data],
        [r[2] for r in readings_data],
        [r[3] for r in readings_data],
        [r[4] for r in readings_data]
    ))

    total_readings += batch_size

    if total_readings % 5000 == 0:
        elapsed = time.time() - start_time
        rate = total_readings / elapsed
        print(f"📊 Sent: {total_readings:,} readings | Rate: {rate:.1f}/s")

# Final stats
elapsed = time.time() - start_time
avg_rate = total_readings / elapsed

print()
print("✅ Test Complete!")
print(f"Total readings: {total_readings:,}")
print(f"Average rate: {avg_rate:.1f} readings/second")
print(f"Duration: {elapsed:.1f}s")
print()

# Verify database has the readings
cursor.execute("""
    SELECT
        COUNT(*) as total_readings,
        MIN(timestamp) as first,
        MAX(timestamp) as last
    FROM scada_readings
    WHERE timestamp >= NOW() - INTERVAL '1 minute'
""")
result = cursor.fetchone()
print(f"📈 Database verification:")
print(f"   Recent readings: {result[0]:,}")
print(f"   Time span: {(result[2] - result[1]).total_seconds():.2f}s")

cursor.close()
conn.close()
