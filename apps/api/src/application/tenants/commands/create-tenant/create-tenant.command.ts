/**
 * Create Tenant Command
 *
 * Command to create a new tenant with database provisioning.
 */

export class CreateTenantCommand {
  constructor(
    public readonly slug: string,
    public readonly subdomain: string,
    public readonly name: string,
    public readonly contactEmail: string,
    public readonly subscriptionTier: string,
    public readonly databaseType: string,
    public readonly contactPhone?: string,
    public readonly billingEmail?: string,
    public readonly maxWells?: number,
    public readonly maxUsers?: number,
    public readonly storageQuotaGb?: number,
    public readonly trialDays?: number,
    public readonly createdBy?: string,
  ) {}
}
