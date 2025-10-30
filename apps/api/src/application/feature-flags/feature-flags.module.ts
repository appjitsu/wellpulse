/**
 * Feature Flags Module
 *
 * Provides feature flag management and evaluation.
 * Exports FeatureFlagsService for use across the application.
 */

import { Module } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';

@Module({
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
