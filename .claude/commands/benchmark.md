---
description: Run performance benchmarks for tests and quality checks
---

Run performance benchmarks to measure execution speed:

1. Run the test benchmark: `./benchmark-tests.sh`
2. Time the quality check: `time pnpm quality:fast`
3. Report results in a table format showing:
   - Worker counts tested
   - Execution times
   - Recommendations

This helps identify the optimal worker count and configuration for your system.
