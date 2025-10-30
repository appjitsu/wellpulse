/**
 * Health Check Controller
 *
 * Provides production-ready health check endpoint for Azure Container Apps monitoring.
 * Used by:
 * - Azure Container Apps health probes (liveness/readiness)
 * - Load balancers for routing decisions
 * - Monitoring systems for alerting
 */

import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Comprehensive health check endpoint
   * Returns HTTP 200 if healthy, 503 if unhealthy
   */
  @Get()
  async check(@Res() res: Response) {
    const healthCheck = await this.healthService.check();

    // Set appropriate HTTP status code
    const statusCode =
      healthCheck.status === 'healthy'
        ? HttpStatus.OK
        : healthCheck.status === 'degraded'
          ? HttpStatus.OK // Still serving requests
          : HttpStatus.SERVICE_UNAVAILABLE;

    res.status(statusCode).json(healthCheck);
  }
}
