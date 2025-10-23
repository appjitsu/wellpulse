/**
 * Get Tenant Query
 *
 * Query to retrieve a single tenant by ID, slug, or subdomain.
 */

export class GetTenantQuery {
  constructor(
    public readonly id?: string,
    public readonly slug?: string,
    public readonly subdomain?: string,
  ) {
    if (!id && !slug && !subdomain) {
      throw new Error(
        'At least one identifier (id, slug, or subdomain) must be provided',
      );
    }
  }
}
