/**
 * Get SCADA Connections Query
 *
 * Retrieves all SCADA connections for a tenant, optionally filtered by well ID.
 */

export class GetScadaConnectionsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly wellId?: string,
    public readonly onlyEnabled?: boolean,
  ) {}
}
