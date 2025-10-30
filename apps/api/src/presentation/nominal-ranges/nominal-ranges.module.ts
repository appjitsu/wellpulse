/**
 * Nominal Ranges Module
 *
 * Presentation layer module for nominal ranges REST API.
 */

import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { NominalRangesController } from './nominal-ranges.controller';

@Module({
  imports: [CqrsModule],
  controllers: [NominalRangesController],
})
export class NominalRangesModule {}
