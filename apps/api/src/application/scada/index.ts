/**
 * SCADA Application Layer Barrel Export
 *
 * Centralized export of all SCADA commands, queries, and handlers.
 */

// Export commands
export {
  CreateScadaConnectionCommand,
  CreateScadaConnectionHandler,
  CreateTagMappingsCommand,
  CreateTagMappingsHandler,
  UpdateScadaConnectionCommand,
  UpdateScadaConnectionHandler,
  DeleteScadaConnectionCommand,
  DeleteScadaConnectionHandler,
  RecordScadaReadingCommand,
  RecordScadaReadingHandler,
  AcknowledgeAlarmCommand,
  AcknowledgeAlarmHandler,
} from './commands';

// Export queries
export {
  GetScadaConnectionsQuery,
  GetScadaConnectionsHandler,
  GetScadaConnectionByIdQuery,
  GetScadaConnectionByIdHandler,
  GetScadaReadingsQuery,
  GetScadaReadingsHandler,
  GetActiveAlarmsQuery,
  GetActiveAlarmsHandler,
} from './queries';

// Export DTOs (explicit to avoid conflicts)
export { ScadaConnectionDto, ScadaReadingDto, AlarmDto } from './dto';
