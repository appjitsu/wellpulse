/**
 * Metrics Module
 *
 * Provides HTTP endpoint for Prometheus metrics.
 */

import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';

@Module({
  controllers: [MetricsController],
})
export class MetricsModule {}
