/**
 * Artillery Custom Functions Processor
 *
 * This file contains custom JavaScript functions that can be used in Artillery scenarios.
 * Reference: https://www.artillery.io/docs/guides/guides/extending-artillery
 */

module.exports = {
  /**
   * Select a random tenant subdomain for multi-tenant testing
   */
  selectTenant: function (context, events, done) {
    const tenants = ['acmeoil', 'demooil', 'testoil', 'samplepermian'];
    const randomTenant = tenants[Math.floor(Math.random() * tenants.length)];

    context.vars.tenantSubdomain = randomTenant;

    return done();
  },

  /**
   * Generate realistic well data
   */
  generateWellData: function (context, events, done) {
    const wellTypes = ['OIL', 'GAS', 'WATER_INJECTION'];
    const statuses = ['ACTIVE', 'INACTIVE', 'PLANNED', 'ABANDONED'];

    context.vars.wellData = {
      name: `Well-${Math.floor(Math.random() * 10000)}`,
      apiNumber: `API-${Math.floor(Math.random() * 1000000)}`,
      wellType: wellTypes[Math.floor(Math.random() * wellTypes.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      location: {
        latitude: 31.5 + Math.random() * 2, // Permian Basin area
        longitude: -102.5 + Math.random() * 2,
      },
      spudDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
    };

    return done();
  },

  /**
   * Before scenario hook - log scenario start
   */
  beforeScenario: function (context, events, done) {
    console.log(`[Artillery] Starting scenario for virtual user ${context._uid}`);
    return done();
  },

  /**
   * After response hook - log errors
   */
  afterResponse: function (req, res, context, events, done) {
    if (res.statusCode >= 400) {
      console.log(
        `[Artillery] Error response: ${res.statusCode} for ${req.url} (Tenant: ${context.vars.tenantSubdomain || 'N/A'})`,
      );
    }

    // Track custom metrics
    if (res.statusCode === 500) {
      events.emit('counter', 'http.server_errors', 1);
    }

    if (res.headers['x-response-time']) {
      const responseTime = parseFloat(res.headers['x-response-time']);
      events.emit('histogram', 'custom.response_time', responseTime);
    }

    return done();
  },

  /**
   * Custom metric aggregation
   */
  customStats: function (context, events, done) {
    // Emit custom metrics
    events.emit('counter', 'custom.scenarios_completed', 1);

    return done();
  },
};
