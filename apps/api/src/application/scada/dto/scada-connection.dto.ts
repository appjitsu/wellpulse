/**
 * SCADA Connection DTO
 *
 * Data Transfer Object for SCADA connection responses.
 * Flattens value objects for presentation layer consumption.
 */

import {
  ScadaConnection,
  ConnectionStatus,
} from '../../../domain/scada/scada-connection.entity';

export class ScadaConnectionDto {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly wellId: string;
  public readonly name: string;
  public readonly description?: string;
  public readonly endpointUrl: string;
  public readonly endpointSecurityMode: string;
  public readonly endpointSecurityPolicy: string;
  public readonly endpointHasCredentials: boolean;
  public readonly pollIntervalSeconds: number;
  public readonly status: ConnectionStatus;
  public readonly lastConnectedAt?: string;
  public readonly lastErrorMessage?: string;
  public readonly isEnabled: boolean;
  public readonly createdAt: string;
  public readonly updatedAt: string;
  public readonly createdBy: string;
  public readonly updatedBy: string;

  private constructor(props: {
    id: string;
    tenantId: string;
    wellId: string;
    name: string;
    description?: string;
    endpointUrl: string;
    endpointSecurityMode: string;
    endpointSecurityPolicy: string;
    endpointHasCredentials: boolean;
    pollIntervalSeconds: number;
    status: ConnectionStatus;
    lastConnectedAt?: string;
    lastErrorMessage?: string;
    isEnabled: boolean;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    updatedBy: string;
  }) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.wellId = props.wellId;
    this.name = props.name;
    this.description = props.description;
    this.endpointUrl = props.endpointUrl;
    this.endpointSecurityMode = props.endpointSecurityMode;
    this.endpointSecurityPolicy = props.endpointSecurityPolicy;
    this.endpointHasCredentials = props.endpointHasCredentials;
    this.pollIntervalSeconds = props.pollIntervalSeconds;
    this.status = props.status;
    this.lastConnectedAt = props.lastConnectedAt;
    this.lastErrorMessage = props.lastErrorMessage;
    this.isEnabled = props.isEnabled;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdBy = props.createdBy;
    this.updatedBy = props.updatedBy;
  }

  /**
   * Create DTO from domain entity
   * Flattens OpcUaEndpoint value object into primitive fields
   */
  static fromDomain(connection: ScadaConnection): ScadaConnectionDto {
    return new ScadaConnectionDto({
      id: connection.id,
      tenantId: connection.tenantId,
      wellId: connection.wellId,
      name: connection.name,
      description: connection.description,
      endpointUrl: connection.endpoint.url,
      endpointSecurityMode: connection.endpoint.securityMode,
      endpointSecurityPolicy: connection.endpoint.securityPolicy,
      endpointHasCredentials: connection.endpoint.hasCredentials,
      pollIntervalSeconds: connection.pollIntervalSeconds,
      status: connection.status,
      lastConnectedAt: connection.lastConnectedAt?.toISOString(),
      lastErrorMessage: connection.lastErrorMessage,
      isEnabled: connection.isEnabled,
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
      createdBy: connection.createdBy,
      updatedBy: connection.updatedBy,
    });
  }
}
