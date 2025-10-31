/**
 * SCADA Presentation Module
 *
 * Provides REST API endpoints for SCADA management and monitoring:
 * - SCADA connection and tag mapping management
 * - SCADA readings recording and querying
 * - Alarm management and acknowledgment
 * - WebSocket gateway for real-time SCADA data streaming
 *
 * Imports SCADA application module for CQRS command/query handlers.
 *
 * Architecture:
 * - REST API: SCADA connection/tag mapping CRUD, readings, alarms
 * - WebSocket: Real-time SCADA readings from Rust service via Redis Pub/Sub
 * - CQRS: Command/Query separation for complex operations
 */

import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScadaController } from './scada.controller';
import { ScadaReadingsController } from './scada-readings.controller';
import { AlarmsController } from './alarms.controller';
import { ScadaGateway } from './scada.gateway';
import { TenantDatabaseService } from '../../infrastructure/database/tenant-database.service';
import { ScadaSubscriberService } from '../../infrastructure/redis/scada-subscriber.service';

// Import CQRS handlers from application layer
import {
  CreateScadaConnectionHandler,
  CreateTagMappingsHandler,
  UpdateScadaConnectionHandler,
  DeleteScadaConnectionHandler,
  RecordScadaReadingHandler,
  AcknowledgeAlarmHandler,
} from '../../application/scada/commands';

import {
  GetScadaConnectionsHandler,
  GetScadaConnectionByIdHandler,
  GetScadaReadingsHandler,
  GetActiveAlarmsHandler,
} from '../../application/scada/queries';

// Import repositories from infrastructure
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { ScadaConnectionRepository } from '../../infrastructure/database/repositories/scada-connection.repository';
import { TagMappingRepository } from '../../infrastructure/database/repositories/tag-mapping.repository';
import { WellRepository } from '../../infrastructure/database/repositories/well.repository';
import { ScadaReadingRepository } from '../../infrastructure/database/repositories/scada-reading.repository';
import { AlarmRepository } from '../../infrastructure/database/repositories/alarm.repository';

const CommandHandlers = [
  CreateScadaConnectionHandler,
  CreateTagMappingsHandler,
  UpdateScadaConnectionHandler,
  DeleteScadaConnectionHandler,
  RecordScadaReadingHandler,
  AcknowledgeAlarmHandler,
];

const QueryHandlers = [
  GetScadaConnectionsHandler,
  GetScadaConnectionByIdHandler,
  GetScadaReadingsHandler,
  GetActiveAlarmsHandler,
];

const Repositories = [
  {
    provide: 'IScadaConnectionRepository',
    useClass: ScadaConnectionRepository,
  },
  {
    provide: 'ITagMappingRepository',
    useClass: TagMappingRepository,
  },
  {
    provide: 'IWellRepository',
    useClass: WellRepository,
  },
  {
    provide: 'IScadaReadingRepository',
    useClass: ScadaReadingRepository,
  },
  {
    provide: 'IAlarmRepository',
    useClass: AlarmRepository,
  },
];

@Module({
  imports: [
    CqrsModule, // Enable CQRS CommandBus and QueryBus
    DatabaseModule, // Database connection and services
    // Import JwtModule for WebSocket authentication
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET is not configured');
        }
        return {
          secret,
          signOptions: {
            expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '7d',
          },
        } as JwtModuleOptions;
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [
    ScadaController, // SCADA connections and tag mappings
    ScadaReadingsController, // SCADA readings recording and querying
    AlarmsController, // Alarm management and acknowledgment
  ],
  providers: [
    // CQRS Handlers
    ...CommandHandlers,
    ...QueryHandlers,
    // Repositories
    ...Repositories,
    // Infrastructure Services
    TenantDatabaseService,
    ScadaGateway, // WebSocket gateway for real-time SCADA data
    ScadaSubscriberService, // Redis Pub/Sub subscriber
  ],
})
export class ScadaModule {}
