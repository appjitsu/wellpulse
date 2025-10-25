/**
 * Metrics Controller
 *
 * Exposes Prometheus metrics at /metrics endpoint.
 * This is a manual controller to ensure metrics are accessible.
 */

import { Controller, Get, Header } from '@nestjs/common';
import { register } from 'prom-client';

@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', register.contentType)
  async getMetrics(): Promise<string> {
    return await register.metrics();
  }
}
