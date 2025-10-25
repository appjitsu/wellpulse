#!/usr/bin/env node

/**
 * WellPulse API Stress Test Script
 *
 * A custom Node.js script to hammer the API with concurrent requests.
 * Useful for testing connection pool behavior, rate limiting, and performance under load.
 *
 * Usage:
 *   node scripts/stress-test.js [options]
 *
 * Options:
 *   --endpoint <url>      API endpoint to test (default: http://localhost:4000/api/health)
 *   --requests <number>   Total number of requests (default: 1000)
 *   --concurrency <number> Number of concurrent requests (default: 50)
 *   --duration <seconds>  Run for specified duration instead of request count
 *   --tenant <subdomain>  Tenant subdomain for tenant-scoped tests
 *   --method <GET|POST>   HTTP method (default: GET)
 *   --body <json>         JSON body for POST requests
 *   --delay <ms>          Delay between request batches (default: 0)
 *   --verbose             Log each request
 *
 * Examples:
 *   # Hammer health endpoint with 10,000 requests (50 concurrent)
 *   node scripts/stress-test.js --requests 10000 --concurrency 50
 *
 *   # Stress test metrics endpoint for 60 seconds
 *   node scripts/stress-test.js --endpoint http://localhost:4000/api/metrics --duration 60
 *
 *   # Test connection pool with tenant-scoped requests
 *   node scripts/stress-test.js --endpoint http://localhost:4000/api/wells --tenant acmeoil --requests 5000
 *
 *   # Hammer admin users endpoint
 *   node scripts/stress-test.js --endpoint http://localhost:4000/api/admin/users --requests 2000 --concurrency 100
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// Parse command-line arguments
const args = process.argv.slice(2);
const config = {
  endpoint: 'http://localhost:4000/api/health',
  requests: 1000,
  concurrency: 50,
  duration: null,
  tenant: null,
  method: 'GET',
  body: null,
  delay: 0,
  verbose: false,
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--endpoint':
      config.endpoint = args[++i];
      break;
    case '--requests':
      config.requests = parseInt(args[++i]);
      break;
    case '--concurrency':
      config.concurrency = parseInt(args[++i]);
      break;
    case '--duration':
      config.duration = parseInt(args[++i]);
      break;
    case '--tenant':
      config.tenant = args[++i];
      break;
    case '--method':
      config.method = args[++i].toUpperCase();
      break;
    case '--body':
      config.body = args[++i];
      break;
    case '--delay':
      config.delay = parseInt(args[++i]);
      break;
    case '--verbose':
      config.verbose = true;
      break;
    case '--help':
      console.log('See script header for usage instructions');
      process.exit(0);
  }
}

// Validate configuration
if (config.concurrency > config.requests && !config.duration) {
  console.warn(
    `⚠️  Concurrency (${config.concurrency}) is greater than total requests (${config.requests}). Adjusting concurrency to ${config.requests}.`,
  );
  config.concurrency = config.requests;
}

// Statistics tracking
const stats = {
  total: 0,
  completed: 0,
  succeeded: 0,
  failed: 0,
  errors: {},
  statusCodes: {},
  responseTimes: [],
  startTime: null,
  endTime: null,
  minResponseTime: Infinity,
  maxResponseTime: 0,
  totalResponseTime: 0,
};

// Track active requests
let activeRequests = 0;
let requestQueue = [];
let testComplete = false;

/**
 * Make a single HTTP request
 */
function makeRequest() {
  return new Promise((resolve) => {
    const url = new URL(config.endpoint);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: config.method,
      headers: {
        'User-Agent': 'WellPulse-Stress-Test/1.0',
        'Content-Type': 'application/json',
      },
    };

    // Add tenant subdomain to Host header if specified
    if (config.tenant) {
      options.headers.Host = `${config.tenant}.${url.hostname}${url.port ? ':' + url.port : ''}`;
    }

    // Add body for POST requests
    if (config.method === 'POST' && config.body) {
      const bodyData = config.body;
      options.headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const startTime = Date.now();

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        // Update statistics
        stats.completed++;
        stats.responseTimes.push(responseTime);
        stats.minResponseTime = Math.min(stats.minResponseTime, responseTime);
        stats.maxResponseTime = Math.max(stats.maxResponseTime, responseTime);
        stats.totalResponseTime += responseTime;

        // Track status codes
        stats.statusCodes[res.statusCode] = (stats.statusCodes[res.statusCode] || 0) + 1;

        if (res.statusCode >= 200 && res.statusCode < 300) {
          stats.succeeded++;
        } else {
          stats.failed++;
        }

        if (config.verbose) {
          console.log(
            `✓ Request ${stats.completed}/${config.requests} - Status: ${res.statusCode} - Time: ${responseTime}ms`,
          );
        }

        activeRequests--;
        resolve();
      });
    });

    req.on('error', (error) => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      stats.completed++;
      stats.failed++;
      stats.responseTimes.push(responseTime);

      const errorKey = error.code || error.message;
      stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;

      if (config.verbose) {
        console.error(
          `✗ Request ${stats.completed}/${config.requests} - Error: ${errorKey} - Time: ${responseTime}ms`,
        );
      }

      activeRequests--;
      resolve();
    });

    // Write body for POST requests
    if (config.method === 'POST' && config.body) {
      req.write(config.body);
    }

    req.end();
  });
}

/**
 * Process request queue with concurrency control
 */
async function processQueue() {
  while (requestQueue.length > 0 || activeRequests > 0) {
    // Check if we should stop (duration-based test)
    if (config.duration && Date.now() - stats.startTime >= config.duration * 1000) {
      testComplete = true;
      break;
    }

    // Start new requests up to concurrency limit
    while (requestQueue.length > 0 && activeRequests < config.concurrency) {
      const request = requestQueue.shift();
      activeRequests++;
      stats.total++;
      request();
    }

    // Wait a bit before checking again
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Add delay between batches if configured
    if (config.delay > 0 && activeRequests === 0) {
      await new Promise((resolve) => setTimeout(resolve, config.delay));
    }
  }
}

/**
 * Calculate statistics percentiles
 */
function calculatePercentile(arr, percentile) {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

/**
 * Print test results
 */
function printResults() {
  const duration = ((stats.endTime - stats.startTime) / 1000).toFixed(2);
  const avgResponseTime = (stats.totalResponseTime / stats.completed).toFixed(2);
  const requestsPerSecond = (stats.completed / (duration || 1)).toFixed(2);

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                 STRESS TEST RESULTS                       ');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📊 TEST CONFIGURATION:`);
  console.log(`   Endpoint:       ${config.endpoint}`);
  console.log(`   Method:         ${config.method}`);
  console.log(`   Tenant:         ${config.tenant || 'N/A'}`);
  console.log(`   Total Requests: ${config.requests}${config.duration ? ` (${config.duration}s duration)` : ''}`);
  console.log(`   Concurrency:    ${config.concurrency}`);
  console.log(
    `   Delay:          ${config.delay}ms${config.delay > 0 ? ' (between batches)' : ' (no delay)'}`,
  );

  console.log(`\n⏱️  PERFORMANCE:`);
  console.log(`   Total Duration:   ${duration}s`);
  console.log(`   Requests/Second:  ${requestsPerSecond}`);
  console.log(`   Avg Response Time: ${avgResponseTime}ms`);
  console.log(`   Min Response Time: ${stats.minResponseTime}ms`);
  console.log(`   Max Response Time: ${stats.maxResponseTime}ms`);
  console.log(`   P50 (Median):      ${calculatePercentile(stats.responseTimes, 50)}ms`);
  console.log(`   P95:               ${calculatePercentile(stats.responseTimes, 95)}ms`);
  console.log(`   P99:               ${calculatePercentile(stats.responseTimes, 99)}ms`);

  console.log(`\n📈 REQUEST STATISTICS:`);
  console.log(`   Total Sent:     ${stats.total}`);
  console.log(`   Completed:      ${stats.completed}`);
  console.log(`   Succeeded:      ${stats.succeeded} (${((stats.succeeded / stats.completed) * 100).toFixed(1)}%)`);
  console.log(`   Failed:         ${stats.failed} (${((stats.failed / stats.completed) * 100).toFixed(1)}%)`);

  console.log(`\n📡 STATUS CODES:`);
  Object.entries(stats.statusCodes)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([code, count]) => {
      const percentage = ((count / stats.completed) * 100).toFixed(1);
      const emoji = code.startsWith('2') ? '✅' : code.startsWith('4') ? '⚠️' : '❌';
      console.log(`   ${emoji} ${code}: ${count} (${percentage}%)`);
    });

  if (Object.keys(stats.errors).length > 0) {
    console.log(`\n❌ ERRORS:`);
    Object.entries(stats.errors)
      .sort(([, a], [, b]) => b - a)
      .forEach(([error, count]) => {
        const percentage = ((count / stats.completed) * 100).toFixed(1);
        console.log(`   ${error}: ${count} (${percentage}%)`);
      });
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
}

/**
 * Main execution
 */
async function main() {
  console.log('\n🚀 Starting WellPulse API Stress Test...\n');
  console.log(`Target:       ${config.endpoint}`);
  console.log(`Method:       ${config.method}`);
  console.log(`Tenant:       ${config.tenant || 'N/A'}`);
  console.log(
    `Load Profile: ${config.requests} requests${config.duration ? ` OR ${config.duration}s duration` : ''}, ${config.concurrency} concurrent`,
  );
  console.log(`\nWarming up...\n`);

  stats.startTime = Date.now();

  // Create request queue
  if (config.duration) {
    // For duration-based tests, continuously queue requests
    const interval = setInterval(() => {
      if (testComplete) {
        clearInterval(interval);
        return;
      }
      requestQueue.push(makeRequest);
    }, 0);

    // Stop after duration
    setTimeout(() => {
      testComplete = true;
      clearInterval(interval);
    }, config.duration * 1000);
  } else {
    // For count-based tests, queue all requests upfront
    for (let i = 0; i < config.requests; i++) {
      requestQueue.push(makeRequest);
    }
  }

  // Process queue
  await processQueue();

  // Wait for all active requests to complete
  while (activeRequests > 0) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  stats.endTime = Date.now();

  // Print results
  printResults();

  console.log('✅ Stress test completed!\n');
}

// Run the test
main().catch((error) => {
  console.error('❌ Stress test failed:', error);
  process.exit(1);
});
