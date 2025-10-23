/**
 * Database Configuration Value Object
 *
 * Encapsulates tenant database connection details.
 * Supports multiple database types: PostgreSQL, SQL Server, MySQL, Oracle, ETL.
 */

export type DatabaseType =
  | 'POSTGRESQL'
  | 'SQL_SERVER'
  | 'MYSQL'
  | 'ORACLE'
  | 'ETL_SYNCED';

interface DatabaseConfigProps {
  type: DatabaseType;
  url: string; // Encrypted connection string
  name: string; // Database name
  host?: string; // For monitoring/health checks
  port?: number;
  etlConfig?: Record<string, unknown>; // For ETL_SYNCED tenants
}

export class DatabaseConfig {
  private constructor(private readonly props: DatabaseConfigProps) {
    this.validate();
  }

  static create(props: DatabaseConfigProps): DatabaseConfig {
    return new DatabaseConfig(props);
  }

  private validate(): void {
    if (!this.props.url || this.props.url.trim().length === 0) {
      throw new Error('Database URL is required');
    }

    if (!this.props.name || this.props.name.trim().length === 0) {
      throw new Error('Database name is required');
    }

    if (this.props.type === 'ETL_SYNCED' && !this.props.etlConfig) {
      throw new Error('ETL configuration is required for ETL_SYNCED databases');
    }

    // Validate port range if provided
    if (
      this.props.port !== undefined &&
      (this.props.port < 1 || this.props.port > 65535)
    ) {
      throw new Error('Database port must be between 1 and 65535');
    }
  }

  // Getters
  get type(): DatabaseType {
    return this.props.type;
  }

  get url(): string {
    return this.props.url;
  }

  get name(): string {
    return this.props.name;
  }

  get host(): string | undefined {
    return this.props.host;
  }

  get port(): number | undefined {
    return this.props.port;
  }

  get etlConfig(): Record<string, unknown> | undefined {
    return this.props.etlConfig;
  }

  // Predicates
  isPostgreSQL(): boolean {
    return this.props.type === 'POSTGRESQL';
  }

  isSQLServer(): boolean {
    return this.props.type === 'SQL_SERVER';
  }

  isMySQL(): boolean {
    return this.props.type === 'MYSQL';
  }

  isOracle(): boolean {
    return this.props.type === 'ORACLE';
  }

  isETLSynced(): boolean {
    return this.props.type === 'ETL_SYNCED';
  }

  requiresNativeAdapter(): boolean {
    return this.isSQLServer() || this.isMySQL() || this.isOracle();
  }

  supportsRealTimeSync(): boolean {
    return !this.isETLSynced();
  }

  // Extract for persistence
  toPersistence() {
    return {
      type: this.props.type,
      url: this.props.url,
      name: this.props.name,
      host: this.props.host,
      port: this.props.port,
      etlConfig: this.props.etlConfig,
    };
  }

  equals(other: DatabaseConfig): boolean {
    return (
      this.props.type === other.props.type &&
      this.props.url === other.props.url &&
      this.props.name === other.props.name
    );
  }
}
