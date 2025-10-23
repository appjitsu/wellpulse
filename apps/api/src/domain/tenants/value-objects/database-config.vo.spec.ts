import { DatabaseConfig } from './database-config.vo';

describe('DatabaseConfig Value Object', () => {
  describe('create()', () => {
    describe('Valid Configurations', () => {
      it('should create PostgreSQL config with all fields', () => {
        const config = DatabaseConfig.create({
          type: 'POSTGRESQL',
          url: 'postgresql://user:pass@localhost:5432/db',
          name: 'tenant_db',
          host: 'localhost',
          port: 5432,
        });

        expect(config.type).toBe('POSTGRESQL');
        expect(config.url).toBe('postgresql://user:pass@localhost:5432/db');
        expect(config.name).toBe('tenant_db');
        expect(config.host).toBe('localhost');
        expect(config.port).toBe(5432);
      });

      it('should create PostgreSQL config with minimal fields', () => {
        const config = DatabaseConfig.create({
          type: 'POSTGRESQL',
          url: 'postgresql://user:pass@localhost:5432/db',
          name: 'tenant_db',
        });

        expect(config.type).toBe('POSTGRESQL');
        expect(config.url).toBe('postgresql://user:pass@localhost:5432/db');
        expect(config.name).toBe('tenant_db');
        expect(config.host).toBeUndefined();
        expect(config.port).toBeUndefined();
      });

      it('should create SQL Server config', () => {
        const config = DatabaseConfig.create({
          type: 'SQL_SERVER',
          url: 'mssql://user:pass@localhost:1433/db',
          name: 'tenant_db',
          host: 'localhost',
          port: 1433,
        });

        expect(config.type).toBe('SQL_SERVER');
        expect(config.isSQLServer()).toBe(true);
      });

      it('should create MySQL config', () => {
        const config = DatabaseConfig.create({
          type: 'MYSQL',
          url: 'mysql://user:pass@localhost:3306/db',
          name: 'tenant_db',
          host: 'localhost',
          port: 3306,
        });

        expect(config.type).toBe('MYSQL');
        expect(config.isMySQL()).toBe(true);
      });

      it('should create Oracle config', () => {
        const config = DatabaseConfig.create({
          type: 'ORACLE',
          url: 'oracle://user:pass@localhost:1521/db',
          name: 'tenant_db',
          host: 'localhost',
          port: 1521,
        });

        expect(config.type).toBe('ORACLE');
        expect(config.isOracle()).toBe(true);
      });

      it('should create ETL_SYNCED config with etlConfig', () => {
        const etlConfig = {
          syncInterval: 300,
          source: 'SCADA_SYSTEM',
          transformRules: ['rule1', 'rule2'],
        };

        const config = DatabaseConfig.create({
          type: 'ETL_SYNCED',
          url: 'postgresql://sync:pass@localhost:5432/sync_db',
          name: 'etl_sync_db',
          etlConfig,
        });

        expect(config.type).toBe('ETL_SYNCED');
        expect(config.isETLSynced()).toBe(true);
        expect(config.etlConfig).toEqual(etlConfig);
      });

      it('should create config with port at minimum boundary (1)', () => {
        const config = DatabaseConfig.create({
          type: 'POSTGRESQL',
          url: 'postgresql://user:pass@localhost:1/db',
          name: 'tenant_db',
          port: 1,
        });

        expect(config.port).toBe(1);
      });

      it('should create config with port at maximum boundary (65535)', () => {
        const config = DatabaseConfig.create({
          type: 'POSTGRESQL',
          url: 'postgresql://user:pass@localhost:65535/db',
          name: 'tenant_db',
          port: 65535,
        });

        expect(config.port).toBe(65535);
      });

      it('should accept URL with special characters', () => {
        const config = DatabaseConfig.create({
          type: 'POSTGRESQL',
          url: 'postgresql://user:p@ss!w0rd@db.example.com:5432/tenant_db',
          name: 'tenant_db',
        });

        expect(config.url).toBe(
          'postgresql://user:p@ss!w0rd@db.example.com:5432/tenant_db',
        );
      });

      it('should accept database name with underscores', () => {
        const config = DatabaseConfig.create({
          type: 'POSTGRESQL',
          url: 'postgresql://user:pass@localhost:5432/db',
          name: 'tenant_db_prod_2024',
        });

        expect(config.name).toBe('tenant_db_prod_2024');
      });
    });

    describe('Invalid Configurations - URL Validation', () => {
      it('should throw error for missing URL', () => {
        expect(() =>
          DatabaseConfig.create({
            type: 'POSTGRESQL',
            url: '',
            name: 'tenant_db',
          }),
        ).toThrow('Database URL is required');
      });

      it('should throw error for whitespace-only URL', () => {
        expect(() =>
          DatabaseConfig.create({
            type: 'POSTGRESQL',
            url: '   ',
            name: 'tenant_db',
          }),
        ).toThrow('Database URL is required');
      });

      it('should throw error for null URL', () => {
        expect(() =>
          DatabaseConfig.create({
            type: 'POSTGRESQL',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            url: null as any,
            name: 'tenant_db',
          }),
        ).toThrow('Database URL is required');
      });

      it('should throw error for undefined URL', () => {
        expect(() =>
          DatabaseConfig.create({
            type: 'POSTGRESQL',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            url: undefined as any,
            name: 'tenant_db',
          }),
        ).toThrow('Database URL is required');
      });
    });

    describe('Invalid Configurations - Name Validation', () => {
      it('should throw error for missing name', () => {
        expect(() =>
          DatabaseConfig.create({
            type: 'POSTGRESQL',
            url: 'postgresql://user:pass@localhost:5432/db',
            name: '',
          }),
        ).toThrow('Database name is required');
      });

      it('should throw error for whitespace-only name', () => {
        expect(() =>
          DatabaseConfig.create({
            type: 'POSTGRESQL',
            url: 'postgresql://user:pass@localhost:5432/db',
            name: '   ',
          }),
        ).toThrow('Database name is required');
      });

      it('should throw error for null name', () => {
        expect(() =>
          DatabaseConfig.create({
            type: 'POSTGRESQL',
            url: 'postgresql://user:pass@localhost:5432/db',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            name: null as any,
          }),
        ).toThrow('Database name is required');
      });

      it('should throw error for undefined name', () => {
        expect(() =>
          DatabaseConfig.create({
            type: 'POSTGRESQL',
            url: 'postgresql://user:pass@localhost:5432/db',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            name: undefined as any,
          }),
        ).toThrow('Database name is required');
      });
    });

    describe('Invalid Configurations - Port Validation', () => {
      it('should throw error for port below minimum (0)', () => {
        expect(() =>
          DatabaseConfig.create({
            type: 'POSTGRESQL',
            url: 'postgresql://user:pass@localhost:5432/db',
            name: 'tenant_db',
            port: 0,
          }),
        ).toThrow('Database port must be between 1 and 65535');
      });

      it('should throw error for negative port', () => {
        expect(() =>
          DatabaseConfig.create({
            type: 'POSTGRESQL',
            url: 'postgresql://user:pass@localhost:5432/db',
            name: 'tenant_db',
            port: -1,
          }),
        ).toThrow('Database port must be between 1 and 65535');
      });

      it('should throw error for port above maximum (65536)', () => {
        expect(() =>
          DatabaseConfig.create({
            type: 'POSTGRESQL',
            url: 'postgresql://user:pass@localhost:5432/db',
            name: 'tenant_db',
            port: 65536,
          }),
        ).toThrow('Database port must be between 1 and 65535');
      });

      it('should throw error for extremely large port', () => {
        expect(() =>
          DatabaseConfig.create({
            type: 'POSTGRESQL',
            url: 'postgresql://user:pass@localhost:5432/db',
            name: 'tenant_db',
            port: 999999,
          }),
        ).toThrow('Database port must be between 1 and 65535');
      });
    });

    describe('Invalid Configurations - ETL Validation', () => {
      it('should throw error for ETL_SYNCED without etlConfig', () => {
        expect(() =>
          DatabaseConfig.create({
            type: 'ETL_SYNCED',
            url: 'postgresql://user:pass@localhost:5432/db',
            name: 'etl_db',
          }),
        ).toThrow('ETL configuration is required for ETL_SYNCED databases');
      });

      it('should throw error for ETL_SYNCED with null etlConfig', () => {
        expect(() =>
          DatabaseConfig.create({
            type: 'ETL_SYNCED',
            url: 'postgresql://user:pass@localhost:5432/db',
            name: 'etl_db',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            etlConfig: null as any,
          }),
        ).toThrow('ETL configuration is required for ETL_SYNCED databases');
      });

      it('should throw error for ETL_SYNCED with undefined etlConfig', () => {
        expect(() =>
          DatabaseConfig.create({
            type: 'ETL_SYNCED',
            url: 'postgresql://user:pass@localhost:5432/db',
            name: 'etl_db',
            etlConfig: undefined,
          }),
        ).toThrow('ETL configuration is required for ETL_SYNCED databases');
      });
    });
  });

  describe('Getters', () => {
    it('should provide access to all properties', () => {
      const config = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db',
        host: 'localhost',
        port: 5432,
      });

      expect(config.type).toBe('POSTGRESQL');
      expect(config.url).toBe('postgresql://user:pass@localhost:5432/db');
      expect(config.name).toBe('tenant_db');
      expect(config.host).toBe('localhost');
      expect(config.port).toBe(5432);
      expect(config.etlConfig).toBeUndefined();
    });

    it('should return undefined for optional properties when not provided', () => {
      const config = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db',
      });

      expect(config.host).toBeUndefined();
      expect(config.port).toBeUndefined();
      expect(config.etlConfig).toBeUndefined();
    });

    it('should provide access to ETL config when present', () => {
      const etlConfig = { syncInterval: 300 };
      const config = DatabaseConfig.create({
        type: 'ETL_SYNCED',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'etl_db',
        etlConfig,
      });

      expect(config.etlConfig).toEqual(etlConfig);
    });
  });

  describe('Database Type Predicates', () => {
    describe('isPostgreSQL()', () => {
      it('should return true for PostgreSQL type', () => {
        const config = DatabaseConfig.create({
          type: 'POSTGRESQL',
          url: 'postgresql://user:pass@localhost:5432/db',
          name: 'tenant_db',
        });

        expect(config.isPostgreSQL()).toBe(true);
        expect(config.isSQLServer()).toBe(false);
        expect(config.isMySQL()).toBe(false);
        expect(config.isOracle()).toBe(false);
        expect(config.isETLSynced()).toBe(false);
      });
    });

    describe('isSQLServer()', () => {
      it('should return true for SQL Server type', () => {
        const config = DatabaseConfig.create({
          type: 'SQL_SERVER',
          url: 'mssql://user:pass@localhost:1433/db',
          name: 'tenant_db',
        });

        expect(config.isPostgreSQL()).toBe(false);
        expect(config.isSQLServer()).toBe(true);
        expect(config.isMySQL()).toBe(false);
        expect(config.isOracle()).toBe(false);
        expect(config.isETLSynced()).toBe(false);
      });
    });

    describe('isMySQL()', () => {
      it('should return true for MySQL type', () => {
        const config = DatabaseConfig.create({
          type: 'MYSQL',
          url: 'mysql://user:pass@localhost:3306/db',
          name: 'tenant_db',
        });

        expect(config.isPostgreSQL()).toBe(false);
        expect(config.isSQLServer()).toBe(false);
        expect(config.isMySQL()).toBe(true);
        expect(config.isOracle()).toBe(false);
        expect(config.isETLSynced()).toBe(false);
      });
    });

    describe('isOracle()', () => {
      it('should return true for Oracle type', () => {
        const config = DatabaseConfig.create({
          type: 'ORACLE',
          url: 'oracle://user:pass@localhost:1521/db',
          name: 'tenant_db',
        });

        expect(config.isPostgreSQL()).toBe(false);
        expect(config.isSQLServer()).toBe(false);
        expect(config.isMySQL()).toBe(false);
        expect(config.isOracle()).toBe(true);
        expect(config.isETLSynced()).toBe(false);
      });
    });

    describe('isETLSynced()', () => {
      it('should return true for ETL_SYNCED type', () => {
        const config = DatabaseConfig.create({
          type: 'ETL_SYNCED',
          url: 'postgresql://user:pass@localhost:5432/db',
          name: 'etl_db',
          etlConfig: { syncInterval: 300 },
        });

        expect(config.isPostgreSQL()).toBe(false);
        expect(config.isSQLServer()).toBe(false);
        expect(config.isMySQL()).toBe(false);
        expect(config.isOracle()).toBe(false);
        expect(config.isETLSynced()).toBe(true);
      });
    });
  });

  describe('requiresNativeAdapter()', () => {
    it('should return false for PostgreSQL', () => {
      const config = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db',
      });

      expect(config.requiresNativeAdapter()).toBe(false);
    });

    it('should return true for SQL Server', () => {
      const config = DatabaseConfig.create({
        type: 'SQL_SERVER',
        url: 'mssql://user:pass@localhost:1433/db',
        name: 'tenant_db',
      });

      expect(config.requiresNativeAdapter()).toBe(true);
    });

    it('should return true for MySQL', () => {
      const config = DatabaseConfig.create({
        type: 'MYSQL',
        url: 'mysql://user:pass@localhost:3306/db',
        name: 'tenant_db',
      });

      expect(config.requiresNativeAdapter()).toBe(true);
    });

    it('should return true for Oracle', () => {
      const config = DatabaseConfig.create({
        type: 'ORACLE',
        url: 'oracle://user:pass@localhost:1521/db',
        name: 'tenant_db',
      });

      expect(config.requiresNativeAdapter()).toBe(true);
    });

    it('should return false for ETL_SYNCED', () => {
      const config = DatabaseConfig.create({
        type: 'ETL_SYNCED',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'etl_db',
        etlConfig: { syncInterval: 300 },
      });

      expect(config.requiresNativeAdapter()).toBe(false);
    });
  });

  describe('supportsRealTimeSync()', () => {
    it('should return true for PostgreSQL', () => {
      const config = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db',
      });

      expect(config.supportsRealTimeSync()).toBe(true);
    });

    it('should return true for SQL Server', () => {
      const config = DatabaseConfig.create({
        type: 'SQL_SERVER',
        url: 'mssql://user:pass@localhost:1433/db',
        name: 'tenant_db',
      });

      expect(config.supportsRealTimeSync()).toBe(true);
    });

    it('should return true for MySQL', () => {
      const config = DatabaseConfig.create({
        type: 'MYSQL',
        url: 'mysql://user:pass@localhost:3306/db',
        name: 'tenant_db',
      });

      expect(config.supportsRealTimeSync()).toBe(true);
    });

    it('should return true for Oracle', () => {
      const config = DatabaseConfig.create({
        type: 'ORACLE',
        url: 'oracle://user:pass@localhost:1521/db',
        name: 'tenant_db',
      });

      expect(config.supportsRealTimeSync()).toBe(true);
    });

    it('should return false for ETL_SYNCED', () => {
      const config = DatabaseConfig.create({
        type: 'ETL_SYNCED',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'etl_db',
        etlConfig: { syncInterval: 300 },
      });

      expect(config.supportsRealTimeSync()).toBe(false);
    });
  });

  describe('toPersistence()', () => {
    it('should extract all properties for PostgreSQL config', () => {
      const config = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db',
        host: 'localhost',
        port: 5432,
      });

      const persistence = config.toPersistence();

      expect(persistence).toEqual({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db',
        host: 'localhost',
        port: 5432,
        etlConfig: undefined,
      });
    });

    it('should extract minimal properties when optional fields not provided', () => {
      const config = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db',
      });

      const persistence = config.toPersistence();

      expect(persistence).toEqual({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db',
        host: undefined,
        port: undefined,
        etlConfig: undefined,
      });
    });

    it('should extract ETL config for ETL_SYNCED type', () => {
      const etlConfig = { syncInterval: 300, source: 'SCADA' };
      const config = DatabaseConfig.create({
        type: 'ETL_SYNCED',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'etl_db',
        etlConfig,
      });

      const persistence = config.toPersistence();

      expect(persistence.etlConfig).toEqual(etlConfig);
    });

    it('should return a new object each time', () => {
      const config = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db',
      });

      const persistence1 = config.toPersistence();
      const persistence2 = config.toPersistence();

      expect(persistence1).not.toBe(persistence2);
      expect(persistence1).toEqual(persistence2);
    });

    it('should be serializable to JSON', () => {
      const config = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db',
        host: 'localhost',
        port: 5432,
      });

      const json = JSON.stringify(config.toPersistence());
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(json);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsed.type).toBe('POSTGRESQL');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsed.name).toBe('tenant_db');
    });
  });

  describe('equals()', () => {
    it('should return true for configs with same type, url, and name', () => {
      const config1 = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db',
      });

      const config2 = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db',
      });

      expect(config1.equals(config2)).toBe(true);
    });

    it('should return true even if optional fields differ', () => {
      const config1 = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db',
        host: 'localhost',
        port: 5432,
      });

      const config2 = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db',
        host: 'different-host',
        port: 9999,
      });

      expect(config1.equals(config2)).toBe(true);
    });

    it('should return false for different database types', () => {
      const config1 = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db',
      });

      const config2 = DatabaseConfig.create({
        type: 'MYSQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db',
      });

      expect(config1.equals(config2)).toBe(false);
    });

    it('should return false for different URLs', () => {
      const config1 = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db1',
        name: 'tenant_db',
      });

      const config2 = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db2',
        name: 'tenant_db',
      });

      expect(config1.equals(config2)).toBe(false);
    });

    it('should return false for different names', () => {
      const config1 = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db_1',
      });

      const config2 = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db_2',
      });

      expect(config1.equals(config2)).toBe(false);
    });

    it('should be reflexive (x.equals(x) = true)', () => {
      const config = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db',
      });

      expect(config.equals(config)).toBe(true);
    });

    it('should be symmetric (x.equals(y) = y.equals(x))', () => {
      const config1 = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db',
      });

      const config2 = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db',
      });

      expect(config1.equals(config2)).toBe(config2.equals(config1));
    });
  });

  describe('Immutability', () => {
    it('should maintain property consistency after creation', () => {
      const config = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db',
      });

      // Properties should be accessible via getters
      expect(config.type).toBe('POSTGRESQL');
      expect(config.url).toBe('postgresql://user:pass@localhost:5432/db');
      expect(config.name).toBe('tenant_db');

      // Multiple accesses should return same values
      expect(config.type).toBe('POSTGRESQL');
      expect(config.url).toBe('postgresql://user:pass@localhost:5432/db');
      expect(config.name).toBe('tenant_db');
    });

    it('should maintain state consistency', () => {
      const config = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db',
        port: 5432,
      });

      // All getters should return consistent values
      const type1 = config.type;
      const type2 = config.type;
      const url1 = config.url;
      const url2 = config.url;
      const port1 = config.port;
      const port2 = config.port;

      expect(type1).toBe(type2);
      expect(url1).toBe(url2);
      expect(port1).toBe(port2);
    });

    it('should use private constructor (TypeScript enforced)', () => {
      // TypeScript prevents direct instantiation at compile time
      // This test documents that instances can only be created via create() method
      const config = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db',
      });

      expect(config).toBeInstanceOf(DatabaseConfig);
      expect(config.type).toBe('POSTGRESQL');
    });

    it('should preserve ETL config reference', () => {
      const etlConfig = { syncInterval: 300 };
      const config = DatabaseConfig.create({
        type: 'ETL_SYNCED',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'etl_db',
        etlConfig,
      });

      // Config should have the ETL config
      const retrievedConfig = config.etlConfig;
      expect(retrievedConfig).toBeDefined();
      expect(retrievedConfig?.syncInterval).toBe(300);
    });
  });

  describe('Edge Cases', () => {
    it('should handle all database types', () => {
      const types = [
        'POSTGRESQL',
        'SQL_SERVER',
        'MYSQL',
        'ORACLE',
        'ETL_SYNCED',
      ] as const;

      types.forEach((type) => {
        const props: any = {
          type,
          url: `${type.toLowerCase()}://user:pass@localhost:5432/db`,
          name: 'tenant_db',
        };

        if (type === 'ETL_SYNCED') {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          props.etlConfig = { syncInterval: 300 };
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const config = DatabaseConfig.create(props);
        expect(config.type).toBe(type);
      });
    });

    it('should handle complex ETL config objects', () => {
      const complexEtlConfig = {
        syncInterval: 300,
        source: 'SCADA_SYSTEM',
        transformRules: ['rule1', 'rule2'],
        mappings: {
          field1: 'source_field1',
          field2: 'source_field2',
        },
        filters: ['status=active', 'type=well'],
        batchSize: 1000,
      };

      const config = DatabaseConfig.create({
        type: 'ETL_SYNCED',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'etl_db',
        etlConfig: complexEtlConfig,
      });

      expect(config.etlConfig).toEqual(complexEtlConfig);
    });

    it('should handle URLs with different protocols', () => {
      const urls = [
        'postgresql://user:pass@localhost:5432/db',
        'postgres://user:pass@localhost:5432/db',
        'mssql://user:pass@localhost:1433/db',
        'mysql://user:pass@localhost:3306/db',
        'oracle://user:pass@localhost:1521/db',
      ];

      urls.forEach((url) => {
        const config = DatabaseConfig.create({
          type: 'POSTGRESQL',
          url,
          name: 'tenant_db',
        });

        expect(config.url).toBe(url);
      });
    });

    it('should handle database names with various formats', () => {
      const names = [
        'tenant_db',
        'tenant-db',
        'TenantDB',
        'tenant_db_2024',
        'db123',
        'TENANT_DB_PROD',
      ];

      names.forEach((name) => {
        const config = DatabaseConfig.create({
          type: 'POSTGRESQL',
          url: 'postgresql://user:pass@localhost:5432/db',
          name,
        });

        expect(config.name).toBe(name);
      });
    });

    it('should maintain consistency across multiple operations', () => {
      const config = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db',
        host: 'localhost',
        port: 5432,
      });

      // Multiple calls to same methods should return consistent results
      expect(config.isPostgreSQL()).toBe(true);
      expect(config.isPostgreSQL()).toBe(true);
      expect(config.requiresNativeAdapter()).toBe(false);
      expect(config.requiresNativeAdapter()).toBe(false);
      expect(config.supportsRealTimeSync()).toBe(true);
      expect(config.supportsRealTimeSync()).toBe(true);

      const persistence1 = config.toPersistence();
      const persistence2 = config.toPersistence();
      expect(persistence1).toEqual(persistence2);
    });

    it('should handle recreation from persistence data', () => {
      const original = DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/db',
        name: 'tenant_db',
        host: 'localhost',
        port: 5432,
      });

      const persistence = original.toPersistence();
      const recreated = DatabaseConfig.create(persistence);

      expect(recreated.equals(original)).toBe(true);
      expect(recreated.type).toBe(original.type);
      expect(recreated.url).toBe(original.url);
      expect(recreated.name).toBe(original.name);
      expect(recreated.host).toBe(original.host);
      expect(recreated.port).toBe(original.port);
    });
  });
});
