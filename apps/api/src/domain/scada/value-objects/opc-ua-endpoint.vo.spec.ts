import {
  OpcUaEndpoint,
  OpcUaSecurityMode,
  OpcUaSecurityPolicy,
} from './opc-ua-endpoint.vo';

describe('OpcUaEndpoint Value Object', () => {
  describe('create()', () => {
    describe('Valid OPC-UA Endpoint Configurations', () => {
      it('should create endpoint with basic configuration (no security)', () => {
        const endpoint = OpcUaEndpoint.create({
          url: 'opc.tcp://192.168.1.100:4840',
          securityMode: 'None',
          securityPolicy: 'None',
        });

        expect(endpoint.url).toBe('opc.tcp://192.168.1.100:4840');
        expect(endpoint.securityMode).toBe('None');
        expect(endpoint.securityPolicy).toBe('None');
        expect(endpoint.hasCredentials).toBe(false);
      });

      it('should create endpoint with username and password', () => {
        const endpoint = OpcUaEndpoint.create({
          url: 'opc.tcp://192.168.1.100:4840',
          securityMode: 'Sign',
          securityPolicy: 'Basic256Sha256',
          username: 'admin',
          password: 'securePassword123',
        });

        expect(endpoint.hasCredentials).toBe(true);
        expect(endpoint.username).toBe('admin');
      });

      it('should create endpoint with Sign security mode', () => {
        const endpoint = OpcUaEndpoint.create({
          url: 'opc.tcp://rtu.example.com:4840',
          securityMode: 'Sign',
          securityPolicy: 'Basic256',
        });

        expect(endpoint.securityMode).toBe('Sign');
        expect(endpoint.securityPolicy).toBe('Basic256');
      });

      it('should create endpoint with SignAndEncrypt security mode', () => {
        const endpoint = OpcUaEndpoint.create({
          url: 'opc.tcp://plc.factory.com:4840',
          securityMode: 'SignAndEncrypt',
          securityPolicy: 'Aes256_Sha256_RsaPss',
        });

        expect(endpoint.securityMode).toBe('SignAndEncrypt');
        expect(endpoint.securityPolicy).toBe('Aes256_Sha256_RsaPss');
      });

      it('should create endpoint with all security policies', () => {
        const policies: OpcUaSecurityPolicy[] = [
          'None',
          'Basic128Rsa15',
          'Basic256',
          'Basic256Sha256',
          'Aes128_Sha256_RsaOaep',
          'Aes256_Sha256_RsaPss',
        ];

        policies.forEach((policy) => {
          const endpoint = OpcUaEndpoint.create({
            url: 'opc.tcp://192.168.1.100:4840',
            securityMode: policy === 'None' ? 'None' : 'SignAndEncrypt',
            securityPolicy: policy,
          });

          expect(endpoint.securityPolicy).toBe(policy);
        });
      });

      it('should create endpoint with localhost', () => {
        const endpoint = OpcUaEndpoint.create({
          url: 'opc.tcp://localhost:4840',
          securityMode: 'None',
          securityPolicy: 'None',
        });

        expect(endpoint.url).toBe('opc.tcp://localhost:4840');
      });

      it('should create endpoint with hostname', () => {
        const endpoint = OpcUaEndpoint.create({
          url: 'opc.tcp://scada-server.company.local:4840',
          securityMode: 'None',
          securityPolicy: 'None',
        });

        expect(endpoint.url).toBe('opc.tcp://scada-server.company.local:4840');
      });

      it('should create endpoint with custom port', () => {
        const endpoint = OpcUaEndpoint.create({
          url: 'opc.tcp://192.168.1.100:8080',
          securityMode: 'None',
          securityPolicy: 'None',
        });

        expect(endpoint.url).toBe('opc.tcp://192.168.1.100:8080');
      });
    });

    describe('URL Validation', () => {
      it('should throw error for URL not starting with opc.tcp://', () => {
        expect(() =>
          OpcUaEndpoint.create({
            url: 'http://192.168.1.100:4840',
            securityMode: 'None',
            securityPolicy: 'None',
          }),
        ).toThrow('OPC-UA endpoint URL must start with opc.tcp://');
      });

      it('should throw error for HTTPS URL', () => {
        expect(() =>
          OpcUaEndpoint.create({
            url: 'https://192.168.1.100:4840',
            securityMode: 'None',
            securityPolicy: 'None',
          }),
        ).toThrow('OPC-UA endpoint URL must start with opc.tcp://');
      });

      it('should throw error for empty URL', () => {
        expect(() =>
          OpcUaEndpoint.create({
            url: '',
            securityMode: 'None',
            securityPolicy: 'None',
          }),
        ).toThrow('OPC-UA endpoint URL is required');
      });
    });

    describe('Security Mode Validation', () => {
      it('should throw error for incompatible security mode and policy (None with Sign)', () => {
        expect(() =>
          OpcUaEndpoint.create({
            url: 'opc.tcp://192.168.1.100:4840',
            securityMode: 'None',
            securityPolicy: 'Basic256',
          }),
        ).toThrow('Security policy must be None when security mode is None');
      });

      it('should throw error for incompatible security mode and policy (Sign with None)', () => {
        expect(() =>
          OpcUaEndpoint.create({
            url: 'opc.tcp://192.168.1.100:4840',
            securityMode: 'Sign',
            securityPolicy: 'None',
          }),
        ).toThrow(
          'Security policy cannot be None when security mode is not None',
        );
      });

      it('should throw error for SignAndEncrypt with None policy', () => {
        expect(() =>
          OpcUaEndpoint.create({
            url: 'opc.tcp://192.168.1.100:4840',
            securityMode: 'SignAndEncrypt',
            securityPolicy: 'None',
          }),
        ).toThrow(
          'Security policy cannot be None when security mode is not None',
        );
      });
    });

    describe('Credentials Validation', () => {
      it('should throw error for password without username', () => {
        expect(() =>
          OpcUaEndpoint.create({
            url: 'opc.tcp://192.168.1.100:4840',
            securityMode: 'None',
            securityPolicy: 'None',
            password: 'password123',
          }),
        ).toThrow('Username is required when password is provided');
      });

      it('should throw error for username without password', () => {
        expect(() =>
          OpcUaEndpoint.create({
            url: 'opc.tcp://192.168.1.100:4840',
            securityMode: 'None',
            securityPolicy: 'None',
            username: 'admin',
          }),
        ).toThrow('Password is required when username is provided');
      });
    });
  });

  describe('getters', () => {
    it('should return URL', () => {
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      expect(endpoint.url).toBe('opc.tcp://192.168.1.100:4840');
    });

    it('should return security mode', () => {
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'SignAndEncrypt',
        securityPolicy: 'Aes256_Sha256_RsaPss',
      });

      expect(endpoint.securityMode).toBe('SignAndEncrypt');
    });

    it('should return security policy', () => {
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'Sign',
        securityPolicy: 'Basic256Sha256',
      });

      expect(endpoint.securityPolicy).toBe('Basic256Sha256');
    });

    it('should return username when provided', () => {
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
        username: 'operator',
        password: 'pass123',
      });

      expect(endpoint.username).toBe('operator');
    });

    it('should return undefined for username when not provided', () => {
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      expect(endpoint.username).toBeUndefined();
    });

    it('should expose password via getter for persistence', () => {
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
        username: 'admin',
        password: 'secretPassword',
      });

      // Password is accessible via getter for persistence layer
      expect(endpoint.password).toBe('secretPassword');
    });
  });

  describe('hasCredentials', () => {
    it('should return true when username is provided', () => {
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
        username: 'user',
        password: 'pass123',
      });

      expect(endpoint.hasCredentials).toBe(true);
    });

    it('should return true when both username and password are provided', () => {
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
        username: 'user',
        password: 'pass',
      });

      expect(endpoint.hasCredentials).toBe(true);
    });

    it('should return false when no credentials are provided', () => {
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      expect(endpoint.hasCredentials).toBe(false);
    });
  });

  describe('toPrimitives()', () => {
    it('should convert to primitive object without credentials', () => {
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'Sign',
        securityPolicy: 'Basic256Sha256',
      });

      const primitives = endpoint.toPrimitives();

      expect(primitives).toEqual({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'Sign',
        securityPolicy: 'Basic256Sha256',
        username: undefined,
        password: undefined,
      });
    });

    it('should convert to primitive object with credentials', () => {
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'SignAndEncrypt',
        securityPolicy: 'Aes256_Sha256_RsaPss',
        username: 'admin',
        password: 'secure123',
      });

      const primitives = endpoint.toPrimitives();

      expect(primitives.url).toBe('opc.tcp://192.168.1.100:4840');
      expect(primitives.securityMode).toBe('SignAndEncrypt');
      expect(primitives.securityPolicy).toBe('Aes256_Sha256_RsaPss');
      expect(primitives.username).toBe('admin');
      expect(primitives.password).toBe('secure123');
    });
  });

  describe('fromPrimitives()', () => {
    it('should reconstruct endpoint from primitives', () => {
      const primitives = {
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'Sign' as OpcUaSecurityMode,
        securityPolicy: 'Basic256' as OpcUaSecurityPolicy,
        username: 'user',
        password: 'pass',
      };

      const endpoint = OpcUaEndpoint.fromPrimitives(primitives);

      expect(endpoint.url).toBe(primitives.url);
      expect(endpoint.securityMode).toBe(primitives.securityMode);
      expect(endpoint.securityPolicy).toBe(primitives.securityPolicy);
      expect(endpoint.username).toBe(primitives.username);
      expect(endpoint.hasCredentials).toBe(true);
    });

    it('should reconstruct endpoint without credentials', () => {
      const primitives = {
        url: 'opc.tcp://localhost:4840',
        securityMode: 'None' as OpcUaSecurityMode,
        securityPolicy: 'None' as OpcUaSecurityPolicy,
      };

      const endpoint = OpcUaEndpoint.fromPrimitives(primitives);

      expect(endpoint.url).toBe(primitives.url);
      expect(endpoint.hasCredentials).toBe(false);
    });
  });

  describe('Immutability', () => {
    it('should maintain state consistency', () => {
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'SignAndEncrypt',
        securityPolicy: 'Basic256Sha256',
      });

      expect(endpoint.url).toBe('opc.tcp://192.168.1.100:4840');
      expect(endpoint.securityMode).toBe('SignAndEncrypt');

      // Multiple calls should return consistent results
      expect(endpoint.url).toBe('opc.tcp://192.168.1.100:4840');
      expect(endpoint.securityMode).toBe('SignAndEncrypt');
    });

    it('should create new instances rather than modifying existing ones', () => {
      const endpoint1 = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.100:4840',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      const endpoint2 = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.1.200:4840',
        securityMode: 'Sign',
        securityPolicy: 'Basic256',
      });

      // Both should maintain their original state
      expect(endpoint1.url).toBe('opc.tcp://192.168.1.100:4840');
      expect(endpoint2.url).toBe('opc.tcp://192.168.1.200:4840');
    });
  });

  describe('Real-world SCADA Examples', () => {
    it('should create endpoint for Rockwell Allen-Bradley PLC', () => {
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://plc.factory.local:4840',
        securityMode: 'SignAndEncrypt',
        securityPolicy: 'Basic256Sha256',
        username: 'opcuser',
        password: 'rockwell123',
      });

      expect(endpoint.url).toBe('opc.tcp://plc.factory.local:4840');
      expect(endpoint.securityMode).toBe('SignAndEncrypt');
      expect(endpoint.hasCredentials).toBe(true);
    });

    it('should create endpoint for Emerson DeltaV DCS', () => {
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://192.168.100.50:49320',
        securityMode: 'None',
        securityPolicy: 'None',
      });

      expect(endpoint.url).toBe('opc.tcp://192.168.100.50:49320');
      expect(endpoint.securityMode).toBe('None');
    });

    it('should create endpoint for Schneider Electric RTU', () => {
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://rtu-001.oilfield.local:4840',
        securityMode: 'Sign',
        securityPolicy: 'Aes128_Sha256_RsaOaep',
        username: 'scada_operator',
        password: 'schneider_secure_2024',
      });

      expect(endpoint.url).toBe('opc.tcp://rtu-001.oilfield.local:4840');
      expect(endpoint.securityPolicy).toBe('Aes128_Sha256_RsaOaep');
    });

    it('should create endpoint for Permian Basin well site RTU', () => {
      const endpoint = OpcUaEndpoint.create({
        url: 'opc.tcp://10.50.1.15:4840',
        securityMode: 'SignAndEncrypt',
        securityPolicy: 'Aes256_Sha256_RsaPss',
        username: 'wellsite_admin',
        password: 'permian_secure_2024',
      });

      expect(endpoint.url).toBe('opc.tcp://10.50.1.15:4840');
      expect(endpoint.securityMode).toBe('SignAndEncrypt');
      expect(endpoint.securityPolicy).toBe('Aes256_Sha256_RsaPss');
      expect(endpoint.hasCredentials).toBe(true);
    });
  });
});
