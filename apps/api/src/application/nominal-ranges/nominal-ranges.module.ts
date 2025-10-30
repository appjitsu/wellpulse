/**
 * Nominal Ranges Module
 *
 * Wires up Nominal Ranges domain with CQRS handlers and infrastructure.
 * Manages nominal range configurations at global, org, and well levels.
 */

import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Command Handlers
import { UpdateOrgNominalRangesHandler } from './commands/update-org-nominal-ranges.command';
import { SetWellNominalRangeHandler } from './commands/set-well-nominal-range.command';
import { DeleteOrgNominalRangeHandler } from './commands/delete-org-nominal-range.command';
import { DeleteWellNominalRangeHandler } from './commands/delete-well-nominal-range.command';

// Query Handlers
import { GetEffectiveNominalRangesHandler } from './queries/get-effective-nominal-ranges.query';
import { GetOrgNominalRangesHandler } from './queries/get-org-nominal-ranges.query';
import { GetWellNominalRangesHandler } from './queries/get-well-nominal-ranges.query';

// Services
import { FieldEntryValidationService } from './services/field-entry-validation.service';

const CommandHandlers = [
  UpdateOrgNominalRangesHandler,
  SetWellNominalRangeHandler,
  DeleteOrgNominalRangeHandler,
  DeleteWellNominalRangeHandler,
];

const QueryHandlers = [
  GetEffectiveNominalRangesHandler,
  GetOrgNominalRangesHandler,
  GetWellNominalRangesHandler,
];

const Services = [FieldEntryValidationService];

/**
 * Nominal Ranges Module
 *
 * Note: This module only provides application layer components.
 * Infrastructure (repositories) and presentation (controllers) are wired up
 * in their respective modules in the infrastructure and presentation layers.
 */
@Module({
  imports: [CqrsModule],
  providers: [...CommandHandlers, ...QueryHandlers, ...Services],
  exports: [FieldEntryValidationService], // Export service for use in other modules
})
export class NominalRangesModule {}
