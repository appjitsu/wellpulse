/**
 * Get All Users Query
 *
 * Admin portal query to fetch users across all tenants or for a specific tenant.
 * Returns paginated list with tenant information.
 */

export class GetAllUsersQuery {
  constructor(
    public readonly page: number = 1,
    public readonly limit: number = 10,
    public readonly search?: string,
    public readonly tenantId?: string,
    public readonly role?: string,
    public readonly status?: string,
  ) {}
}
