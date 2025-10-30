/**
 * Artillery Processor
 *
 * Custom functions for load testing scenarios.
 * Provides data generation, validation, and custom logic.
 */

const crypto = require('crypto');

module.exports = {
  /**
   * Generate random production data
   */
  generateProductionData: function (requestParams, context, ee, next) {
    // Set production volume (50-1000 barrels)
    context.vars.productionVolume = Math.floor(Math.random() * 950) + 50;

    // Set gas volume (100-5000 MCF)
    context.vars.gasVolume = Math.floor(Math.random() * 4900) + 100;

    // Set water volume (0-500 barrels)
    context.vars.waterVolume = Math.floor(Math.random() * 500);

    // Set operating pressure (100-3000 PSI)
    context.vars.operatingPressure = Math.floor(Math.random() * 2900) + 100;

    // Set timestamp (last 30 days)
    const now = new Date();
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    context.vars.entryDate = date.toISOString();

    return next();
  },

  /**
   * Generate random well name
   */
  generateWellName: function (requestParams, context, ee, next) {
    const prefixes = ['North', 'South', 'East', 'West', 'Central'];
    const types = ['Producer', 'Injector', 'Observation'];
    const numbers = Math.floor(Math.random() * 9999) + 1;

    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const type = types[Math.floor(Math.random() * types.length)];

    context.vars.wellName = `${prefix}-${type}-${numbers}`;
    return next();
  },

  /**
   * Generate random location in Permian Basin
   */
  generatePermianLocation: function (requestParams, context, ee, next) {
    // Permian Basin approximate coordinates
    // Latitude: 31.5 to 32.5
    // Longitude: -103.5 to -102.0
    context.vars.latitude = (Math.random() * 1.0 + 31.5).toFixed(6);
    context.vars.longitude = (Math.random() * 1.5 - 103.5).toFixed(6);

    return next();
  },

  /**
   * Log scenario start
   */
  logScenarioStart: function (requestParams, context, ee, next) {
    console.log(
      `[${new Date().toISOString()}] Starting scenario: ${context.scenario?.name || 'Unknown'}`,
    );
    return next();
  },

  /**
   * Log response time
   */
  logResponseTime: function (requestParams, response, context, ee, next) {
    if (response.timings) {
      const totalTime = response.timings.phases.total || 0;
      if (totalTime > 1000) {
        // Log slow responses (> 1 second)
        console.log(
          `[${new Date().toISOString()}] SLOW RESPONSE: ${requestParams.url} - ${totalTime}ms`,
        );
      }
    }
    return next();
  },

  /**
   * Validate response structure
   */
  validateResponse: function (requestParams, response, context, ee, next) {
    if (!response.body) {
      console.error(
        `[${new Date().toISOString()}] ERROR: No response body for ${requestParams.url}`,
      );
    }

    try {
      // Try to parse as JSON
      if (typeof response.body === 'string') {
        JSON.parse(response.body);
      }
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] ERROR: Invalid JSON response for ${requestParams.url}`,
      );
    }

    return next();
  },

  /**
   * Setup before scenario
   */
  beforeScenario: function (userContext, events, done) {
    // Generate unique user ID for this virtual user
    userContext.vars.userId = crypto.randomBytes(16).toString('hex');

    // Generate tenant context
    userContext.vars.tenantSubdomain = 'loadtest';

    done();
  },

  /**
   * Cleanup after scenario
   */
  afterScenario: function (userContext, events, done) {
    // Could implement cleanup logic here
    done();
  },

  /**
   * Custom think time (pause between requests)
   */
  customThink: function (requestParams, context, ee, next) {
    // Random think time between 1-5 seconds (simulating real user behavior)
    const thinkTime = Math.floor(Math.random() * 4000) + 1000;
    setTimeout(next, thinkTime);
  },

  /**
   * Generate realistic field notes
   */
  generateFieldNotes: function (requestParams, context, ee, next) {
    const notes = [
      'Normal operations',
      'Pressure slightly elevated',
      'Equipment maintenance scheduled',
      'Production within expected range',
      'Minor leak detected and sealed',
      'Safety inspection passed',
      'Pump replaced',
      'Flow line cleaned',
    ];

    context.vars.fieldNotes =
      notes[Math.floor(Math.random() * notes.length)];

    return next();
  },

  /**
   * Set request headers with tenant context
   */
  setTenantHeaders: function (requestParams, context, ee, next) {
    requestParams.headers = requestParams.headers || {};
    requestParams.headers['X-Tenant-Subdomain'] = context.vars.tenantSubdomain;

    return next();
  },
};
