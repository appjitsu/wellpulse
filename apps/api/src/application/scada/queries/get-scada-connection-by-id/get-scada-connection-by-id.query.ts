/**
 * Get SCADA Connection By ID Query
 *
 * Retrieves a single SCADA connection by its ID.
 */

export class GetScadaConnectionByIdQuery {
  constructor(
    public readonly tenantId: string,
    public readonly connectionId: string,
  ) {}
}
