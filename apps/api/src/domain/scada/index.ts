// Export entities
export * from './scada-connection.entity';
export * from './scada-reading.entity';
export * from './alarm.entity';
export * from './tag-mapping.entity';

// Export value objects (explicit to avoid naming conflicts)
export {
  OpcUaEndpoint,
  OpcUaSecurityMode,
  OpcUaSecurityPolicy,
  OpcUaEndpointProps,
} from './value-objects/opc-ua-endpoint.vo';
export {
  TagConfiguration,
  TagConfigurationProps,
} from './value-objects/tag-configuration.vo';
export {
  ReadingValue,
  ReadingValueProps,
} from './value-objects/reading-value.vo';
// Note: ReadingQuality is exported from both scada-reading.entity (uppercase) and reading-value.vo (capitalized)
// Consumers should import from the specific file they need
