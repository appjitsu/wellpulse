/**
 * Get SCADA Readings Query
 *
 * Retrieves time-series SCADA readings with optional filters.
 */

export class GetScadaReadingsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly wellId?: string,
    public readonly scadaConnectionId?: string,
    public readonly tagName?: string,
    public readonly startTime?: Date,
    public readonly endTime?: Date,
    public readonly limit?: number,
    public readonly offset?: number,
  ) {}
}
