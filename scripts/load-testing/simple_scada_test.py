#!/usr/bin/env python3
"""Simple SCADA load test - inserts directly to TimescaleDB"""
import asyncio
import random
import time
import uuid
from datetime import datetime, timezone
import psycopg

async def insert_test_data(duration_seconds=30):
    """Insert SCADA readings for testing"""
    conn = await psycopg.AsyncConnection.connect(
        'postgresql://wellpulse:wellpulse@localhost:5432/wellpulse_internal'
    )
    
    # Generate 10 test wells
    well_ids = [str(uuid.uuid4()) for _ in range(10)]
    tags = ['PRESSURE', 'TEMP', 'FLOW', 'LEVEL', 'MOTOR_AMPS']
    
    readings_sent = 0
    start_time = time.time()
    
    print(f"\n🚀 Starting 30-second SCADA insert test...")
    print(f"Wells: 10 | Tags: 5 | Target: ~50 readings/second\n")
    
    try:
        while time.time() - start_time < duration_seconds:
            batch = []
            for _ in range(50):  # 50 readings per second
                well_id = random.choice(well_ids)
                tag = random.choice(tags)
                value = random.uniform(0, 1000)
                
                batch.append((
                    datetime.now(timezone.utc),
                    well_id,
                    f"ns=2;s={tag}",
                    value,
                    'Good'
                ))
            
            async with conn.cursor() as cur:
                await cur.executemany(
                    "INSERT INTO scada_readings (timestamp, well_id, tag_node_id, value, quality) VALUES (%s, %s, %s, %s, %s)",
                    batch
                )
                await conn.commit()
            
            readings_sent += len(batch)
            
            if readings_sent % 500 == 0:
                elapsed = time.time() - start_time
                rate = readings_sent / elapsed
                print(f"📊 Sent: {readings_sent:,} readings | Rate: {rate:.1f}/s")
            
            await asyncio.sleep(1)  # 1 second batches
        
        elapsed = time.time() - start_time
        print(f"\n✅ Test Complete!")
        print(f"Total readings: {readings_sent:,}")
        print(f"Average rate: {readings_sent/elapsed:.1f} readings/second")
        print(f"Duration: {elapsed:.1f}s\n")
        
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(insert_test_data(30))
