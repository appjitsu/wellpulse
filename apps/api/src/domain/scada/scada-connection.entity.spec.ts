import { ScadaConnection } from './scada-connection.entity';
import { OpcUaEndpoint } from './value-objects/opc-ua-endpoint.vo';

describe('ScadaConnection Entity', () => {
  const mockEndpoint = OpcUaEndpoint.create({
    url: 'opc.tcp://192.168.1.100:4840',
    securityMode: 'SignAndEncrypt',
    securityPolicy: 'Basic256Sha256',
    username: 'admin',
    password: 'password123',
  });

  describe('create()', () => {
    describe('Valid SCADA Connection Creation', () => {
      it('should create SCADA connection with minimal required fields', () => {
        const connection = ScadaConnection.create({
          tenantId: '00000000-0000-0000-0000-000000000001',
          wellId: '00000000-0000-0000-0000-000000000002',
          name: 'Well 001 RTU',
          endpoint: mockEndpoint,
          createdBy: '00000000-0000-0000-0000-000000000003',
        });

        expect(connection.id).toMatch(/^scada_\d+_[a-z0-9]{7}$/);
        expect(connection.tenantId).toBe(
          '00000000-0000-0000-0000-000000000001',
        );
        expect(connection.wellId).toBe('00000000-0000-0000-0000-000000000002');
        expect(connection.name).toBe('Well 001 RTU');
        expect(connection.status).toBe('inactive');
        expect(connection.pollIntervalSeconds).toBe(5); // Default
        expect(connection.isEnabled).toBe(true);
        expect(connection.createdBy).toBe(
          '00000000-0000-0000-0000-000000000003',
        );
      });

      it('should create SCADA connection with description', () => {
        const connection = ScadaConnection.create({
          tenantId: '00000000-0000-0000-0000-000000000001',
          wellId: '00000000-0000-0000-0000-000000000002',
          name: 'Well 001 RTU',
          description: 'Primary SCADA system for production monitoring',
          endpoint: mockEndpoint,
          createdBy: '00000000-0000-0000-0000-000000000003',
        });

        expect(connection.description).toBe(
          'Primary SCADA system for production monitoring',
        );
      });

      it('should create SCADA connection with custom poll interval', () => {
        const connection = ScadaConnection.create({
          tenantId: '00000000-0000-0000-0000-000000000001',
          wellId: '00000000-0000-0000-0000-000000000002',
          name: 'Well 001 RTU',
          endpoint: mockEndpoint,
          pollIntervalSeconds: 10,
          createdBy: '00000000-0000-0000-0000-000000000003',
        });

        expect(connection.pollIntervalSeconds).toBe(10);
      });

      it('should accept minimum poll interval (1 second)', () => {
        const connection = ScadaConnection.create({
          tenantId: '00000000-0000-0000-0000-000000000001',
          wellId: '00000000-0000-0000-0000-000000000002',
          name: 'Fast Polling RTU',
          endpoint: mockEndpoint,
          pollIntervalSeconds: 1,
          createdBy: '00000000-0000-0000-0000-000000000003',
        });

        expect(connection.pollIntervalSeconds).toBe(1);
      });

      it('should accept maximum poll interval (300 seconds)', () => {
        const connection = ScadaConnection.create({
          tenantId: '00000000-0000-0000-0000-000000000001',
          wellId: '00000000-0000-0000-0000-000000000002',
          name: 'Slow Polling RTU',
          endpoint: mockEndpoint,
          pollIntervalSeconds: 300,
          createdBy: '00000000-0000-0000-0000-000000000003',
        });

        expect(connection.pollIntervalSeconds).toBe(300);
      });
    });

    describe('Name Validation', () => {
      it('should throw error for empty name', () => {
        expect(() =>
          ScadaConnection.create({
            tenantId: '00000000-0000-0000-0000-000000000001',
            wellId: '00000000-0000-0000-0000-000000000002',
            name: '',
            endpoint: mockEndpoint,
            createdBy: '00000000-0000-0000-0000-000000000003',
          }),
        ).toThrow('Connection name is required');
      });

      it('should throw error for name too short (less than 3 characters)', () => {
        expect(() =>
          ScadaConnection.create({
            tenantId: '00000000-0000-0000-0000-000000000001',
            wellId: '00000000-0000-0000-0000-000000000002',
            name: 'AB',
            endpoint: mockEndpoint,
            createdBy: '00000000-0000-0000-0000-000000000003',
          }),
        ).toThrow('Connection name must be between 3 and 100 characters');
      });

      it('should throw error for name exceeding maximum length', () => {
        const longName = 'A'.repeat(101);

        expect(() =>
          ScadaConnection.create({
            tenantId: '00000000-0000-0000-0000-000000000001',
            wellId: '00000000-0000-0000-0000-000000000002',
            name: longName,
            endpoint: mockEndpoint,
            createdBy: '00000000-0000-0000-0000-000000000003',
          }),
        ).toThrow('Connection name must be between 3 and 100 characters');
      });

      it('should accept name at maximum length (100 characters)', () => {
        const maxLengthName = 'A'.repeat(100);

        const connection = ScadaConnection.create({
          tenantId: '00000000-0000-0000-0000-000000000001',
          wellId: '00000000-0000-0000-0000-000000000002',
          name: maxLengthName,
          endpoint: mockEndpoint,
          createdBy: '00000000-0000-0000-0000-000000000003',
        });

        expect(connection.name).toBe(maxLengthName);
      });
    });

    describe('Poll Interval Validation', () => {
      it('should throw error for poll interval less than 1 second', () => {
        expect(() =>
          ScadaConnection.create({
            tenantId: '00000000-0000-0000-0000-000000000001',
            wellId: '00000000-0000-0000-0000-000000000002',
            name: 'Well 001 RTU',
            endpoint: mockEndpoint,
            pollIntervalSeconds: 0,
            createdBy: '00000000-0000-0000-0000-000000000003',
          }),
        ).toThrow('Poll interval must be between 1 and 300 seconds');
      });

      it('should throw error for negative poll interval', () => {
        expect(() =>
          ScadaConnection.create({
            tenantId: '00000000-0000-0000-0000-000000000001',
            wellId: '00000000-0000-0000-0000-000000000002',
            name: 'Well 001 RTU',
            endpoint: mockEndpoint,
            pollIntervalSeconds: -5,
            createdBy: '00000000-0000-0000-0000-000000000003',
          }),
        ).toThrow('Poll interval must be between 1 and 300 seconds');
      });

      it('should throw error for poll interval greater than 300 seconds', () => {
        expect(() =>
          ScadaConnection.create({
            tenantId: '00000000-0000-0000-0000-000000000001',
            wellId: '00000000-0000-0000-0000-000000000002',
            name: 'Well 001 RTU',
            endpoint: mockEndpoint,
            pollIntervalSeconds: 301,
            createdBy: '00000000-0000-0000-0000-000000000003',
          }),
        ).toThrow('Poll interval must be between 1 and 300 seconds');
      });
    });
  });

  describe('Status Management', () => {
    it('should start with inactive status', () => {
      const connection = ScadaConnection.create({
        tenantId: '00000000-0000-0000-0000-000000000001',
        wellId: '00000000-0000-0000-0000-000000000002',
        name: 'Well 001 RTU',
        endpoint: mockEndpoint,
        createdBy: '00000000-0000-0000-0000-000000000003',
      });

      expect(connection.status).toBe('inactive');
    });

    it('should transition to connecting status', () => {
      const connection = ScadaConnection.create({
        tenantId: '00000000-0000-0000-0000-000000000001',
        wellId: '00000000-0000-0000-0000-000000000002',
        name: 'Well 001 RTU',
        endpoint: mockEndpoint,
        createdBy: '00000000-0000-0000-0000-000000000003',
      });

      connection.markConnecting();

      expect(connection.status).toBe('connecting');
    });

    it('should transition to active status with timestamp', () => {
      const connection = ScadaConnection.create({
        tenantId: '00000000-0000-0000-0000-000000000001',
        wellId: '00000000-0000-0000-0000-000000000002',
        name: 'Well 001 RTU',
        endpoint: mockEndpoint,
        createdBy: '00000000-0000-0000-0000-000000000003',
      });

      const beforeConnect = new Date();
      connection.markConnected();
      const afterConnect = new Date();

      expect(connection.status).toBe('active');
      expect(connection.lastConnectedAt).toBeDefined();
      expect(connection.lastConnectedAt!.getTime()).toBeGreaterThanOrEqual(
        beforeConnect.getTime(),
      );
      expect(connection.lastConnectedAt!.getTime()).toBeLessThanOrEqual(
        afterConnect.getTime(),
      );
      expect(connection.lastErrorMessage).toBeUndefined();
    });

    it('should transition to error status with error message', () => {
      const connection = ScadaConnection.create({
        tenantId: '00000000-0000-0000-0000-000000000001',
        wellId: '00000000-0000-0000-0000-000000000002',
        name: 'Well 001 RTU',
        endpoint: mockEndpoint,
        createdBy: '00000000-0000-0000-0000-000000000003',
      });

      connection.markError('Connection timeout after 30 seconds');

      expect(connection.status).toBe('error');
      expect(connection.lastErrorMessage).toBe(
        'Connection timeout after 30 seconds',
      );
    });

    it('should clear error message when transitioning to active', () => {
      const connection = ScadaConnection.create({
        tenantId: '00000000-0000-0000-0000-000000000001',
        wellId: '00000000-0000-0000-0000-000000000002',
        name: 'Well 001 RTU',
        endpoint: mockEndpoint,
        createdBy: '00000000-0000-0000-0000-000000000003',
      });

      connection.markError('Connection failed');
      expect(connection.lastErrorMessage).toBe('Connection failed');

      connection.markConnected();
      expect(connection.status).toBe('active');
      expect(connection.lastErrorMessage).toBeUndefined();
    });
  });

  describe('Enable/Disable', () => {
    it('should start enabled by default', () => {
      const connection = ScadaConnection.create({
        tenantId: '00000000-0000-0000-0000-000000000001',
        wellId: '00000000-0000-0000-0000-000000000002',
        name: 'Well 001 RTU',
        endpoint: mockEndpoint,
        createdBy: '00000000-0000-0000-0000-000000000003',
      });

      expect(connection.isEnabled).toBe(true);
    });

    it('should disable connection', () => {
      const connection = ScadaConnection.create({
        tenantId: '00000000-0000-0000-0000-000000000001',
        wellId: '00000000-0000-0000-0000-000000000002',
        name: 'Well 001 RTU',
        endpoint: mockEndpoint,
        createdBy: '00000000-0000-0000-0000-000000000003',
      });

      connection.disable('00000000-0000-0000-0000-000000000003');

      expect(connection.isEnabled).toBe(false);
    });

    it('should enable connection', () => {
      const connection = ScadaConnection.create({
        tenantId: '00000000-0000-0000-0000-000000000001',
        wellId: '00000000-0000-0000-0000-000000000002',
        name: 'Well 001 RTU',
        endpoint: mockEndpoint,
        createdBy: '00000000-0000-0000-0000-000000000003',
      });

      connection.disable('00000000-0000-0000-0000-000000000003');
      expect(connection.isEnabled).toBe(false);

      connection.enable('00000000-0000-0000-0000-000000000003');
      expect(connection.isEnabled).toBe(true);
    });
  });

  describe('Health Check', () => {
    it('should be unhealthy when disabled', () => {
      const connection = ScadaConnection.create({
        tenantId: '00000000-0000-0000-0000-000000000001',
        wellId: '00000000-0000-0000-0000-000000000002',
        name: 'Well 001 RTU',
        endpoint: mockEndpoint,
        createdBy: '00000000-0000-0000-0000-000000000003',
      });

      connection.disable('00000000-0000-0000-0000-000000000003');

      expect(connection.isHealthy()).toBe(false);
    });

    it('should be unhealthy when not active', () => {
      const connection = ScadaConnection.create({
        tenantId: '00000000-0000-0000-0000-000000000001',
        wellId: '00000000-0000-0000-0000-000000000002',
        name: 'Well 001 RTU',
        endpoint: mockEndpoint,
        createdBy: '00000000-0000-0000-0000-000000000003',
      });

      expect(connection.status).toBe('inactive');
      expect(connection.isHealthy()).toBe(false);
    });

    it('should be healthy immediately after connection with generous threshold', () => {
      const connection = ScadaConnection.create({
        tenantId: '00000000-0000-0000-0000-000000000001',
        wellId: '00000000-0000-0000-0000-000000000002',
        name: 'Well 001 RTU',
        endpoint: mockEndpoint,
        createdBy: '00000000-0000-0000-0000-000000000003',
      });

      connection.markConnected();

      // Immediately after connecting, should be healthy with any reasonable threshold
      expect(connection.isHealthy()).toBe(true);
      expect(connection.isHealthy(60000)).toBe(true); // 60 second threshold
      expect(connection.isHealthy(300000)).toBe(true); // 5 minute threshold
    });

    it('should be healthy when enabled, active, and recently connected', () => {
      const connection = ScadaConnection.create({
        tenantId: '00000000-0000-0000-0000-000000000001',
        wellId: '00000000-0000-0000-0000-000000000002',
        name: 'Well 001 RTU',
        endpoint: mockEndpoint,
        createdBy: '00000000-0000-0000-0000-000000000003',
      });

      connection.markConnected();

      expect(connection.isHealthy()).toBe(true);
    });

    it('should allow custom staleness threshold', () => {
      const connection = ScadaConnection.create({
        tenantId: '00000000-0000-0000-0000-000000000001',
        wellId: '00000000-0000-0000-0000-000000000002',
        name: 'Well 001 RTU',
        endpoint: mockEndpoint,
        createdBy: '00000000-0000-0000-0000-000000000003',
      });

      connection.markConnected();

      // With 5 minute threshold, should still be healthy
      expect(connection.isHealthy(300000)).toBe(true);
    });
  });

  describe('fromPrimitives() and toPrimitives()', () => {
    it('should convert to primitives and reconstruct', () => {
      const original = ScadaConnection.create({
        tenantId: '00000000-0000-0000-0000-000000000001',
        wellId: '00000000-0000-0000-0000-000000000002',
        name: 'Well 001 RTU',
        description: 'Test RTU',
        endpoint: mockEndpoint,
        pollIntervalSeconds: 10,
        createdBy: '00000000-0000-0000-0000-000000000003',
      });

      original.markConnected();

      const primitives = original.toPrimitives();
      const reconstructed = ScadaConnection.fromPrimitives(primitives);

      expect(reconstructed.id).toBe(original.id);
      expect(reconstructed.tenantId).toBe(original.tenantId);
      expect(reconstructed.wellId).toBe(original.wellId);
      expect(reconstructed.name).toBe(original.name);
      expect(reconstructed.description).toBe(original.description);
      expect(reconstructed.status).toBe(original.status);
      expect(reconstructed.pollIntervalSeconds).toBe(
        original.pollIntervalSeconds,
      );
      expect(reconstructed.isEnabled).toBe(original.isEnabled);
    });

    it('should handle undefined optional fields', () => {
      const original = ScadaConnection.create({
        tenantId: '00000000-0000-0000-0000-000000000001',
        wellId: '00000000-0000-0000-0000-000000000002',
        name: 'Well 001 RTU',
        endpoint: mockEndpoint,
        createdBy: '00000000-0000-0000-0000-000000000003',
      });

      const primitives = original.toPrimitives();
      const reconstructed = ScadaConnection.fromPrimitives(primitives);

      expect(reconstructed.description).toBeUndefined();
      expect(reconstructed.lastConnectedAt).toBeUndefined();
      expect(reconstructed.lastErrorMessage).toBeUndefined();
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle typical connection lifecycle', () => {
      // Create connection
      const connection = ScadaConnection.create({
        tenantId: '00000000-0000-0000-0000-000000000001',
        wellId: '00000000-0000-0000-0000-000000000002',
        name: 'Permian Basin Well 42-165-12345',
        description: 'Rockwell PLC for production monitoring',
        endpoint: mockEndpoint,
        pollIntervalSeconds: 5,
        createdBy: '00000000-0000-0000-0000-000000000003',
      });

      expect(connection.status).toBe('inactive');

      // Start connecting
      connection.markConnecting();
      expect(connection.status).toBe('connecting');

      // Connection succeeds
      connection.markConnected();
      expect(connection.status).toBe('active');
      expect(connection.lastConnectedAt).toBeDefined();
      expect(connection.isHealthy()).toBe(true);

      // Connection fails later
      connection.markError('Network timeout');
      expect(connection.status).toBe('error');
      expect(connection.lastErrorMessage).toBe('Network timeout');
      expect(connection.isHealthy()).toBe(false);

      // Reconnect successfully
      connection.markConnected();
      expect(connection.status).toBe('active');
      expect(connection.lastErrorMessage).toBeUndefined();
      expect(connection.isHealthy()).toBe(true);
    });

    it('should handle maintenance scenario (disable temporarily)', () => {
      const connection = ScadaConnection.create({
        tenantId: '00000000-0000-0000-0000-000000000001',
        wellId: '00000000-0000-0000-0000-000000000002',
        name: 'Well 001 RTU',
        endpoint: mockEndpoint,
        createdBy: '00000000-0000-0000-0000-000000000003',
      });

      connection.markConnected();
      expect(connection.isHealthy()).toBe(true);

      // Disable for maintenance
      connection.disable('00000000-0000-0000-0000-000000000003');
      expect(connection.isEnabled).toBe(false);
      expect(connection.isHealthy()).toBe(false);

      // Re-enable after maintenance
      connection.enable('00000000-0000-0000-0000-000000000003');
      expect(connection.isEnabled).toBe(true);
    });
  });
});
