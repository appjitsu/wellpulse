/**
 * Encryption Service Tests
 *
 * Tests AES-256-GCM encryption/decryption for sensitive data.
 * CRITICAL for security - database connection strings must be encrypted at rest.
 *
 * Security Requirements:
 * - AES-256-GCM authenticated encryption
 * - Random IV for each encryption
 * - Authentication tag prevents tampering
 * - Backward compatibility with plaintext URLs
 * - Proper key derivation for non-32-byte keys
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;
  let configService: ConfigService;

  const validEncryptionKey = 'abcdefghijklmnopqrstuvwxyz123456'; // 32 bytes

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'ENCRYPTION_KEY') {
          return validEncryptionKey;
        }
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should throw error if ENCRYPTION_KEY is not set', () => {
      const mockConfigService = {
        get: jest.fn(() => undefined),
      };

      expect(() => {
        new EncryptionService(mockConfigService as any);
      }).toThrow('ENCRYPTION_KEY environment variable is not set');
    });

    it('should accept 32-byte encryption key', () => {
      const mockConfigService = {
        get: jest.fn(() => validEncryptionKey),
      };

      expect(() => {
        new EncryptionService(mockConfigService as any);
      }).not.toThrow();
    });

    it('should derive key from non-32-byte input using SHA-256', () => {
      const shortKey = 'shortkey';
      const mockConfigService = {
        get: jest.fn(() => shortKey),
      };

      // Should not throw - will derive key using SHA-256
      expect(() => {
        new EncryptionService(mockConfigService as any);
      }).not.toThrow();
    });
  });

  describe('encrypt()', () => {
    it('should encrypt plaintext successfully', () => {
      const plaintext = 'postgresql://user:password@localhost:5432/db';

      const encrypted = service.encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext (random IV)', () => {
      const plaintext = 'postgresql://user:password@localhost:5432/db';

      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);

      // Different IVs should produce different ciphertexts
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should return encrypted string in correct format (IV:AUTH_TAG:CIPHERTEXT)', () => {
      const plaintext = 'test-data';

      const encrypted = service.encrypt(plaintext);

      // Should have format: 32_hex_chars:32_hex_chars:variable_hex_chars
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);

      // IV should be 16 bytes = 32 hex chars
      expect(parts[0]).toHaveLength(32);
      expect(/^[0-9a-f]{32}$/i.test(parts[0])).toBe(true);

      // Auth tag should be 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32);
      expect(/^[0-9a-f]{32}$/i.test(parts[1])).toBe(true);

      // Ciphertext should be hex
      expect(/^[0-9a-f]+$/i.test(parts[2])).toBe(true);
    });

    it('should encrypt database URLs correctly', () => {
      const databaseUrl =
        'postgresql://wellpulse:secret123@db.example.com:5432/tenant_db';

      const encrypted = service.encrypt(databaseUrl);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toContain('wellpulse');
      expect(encrypted).not.toContain('secret123');
      expect(encrypted).not.toContain('db.example.com');
    });

    it('should handle empty strings', () => {
      const encrypted = service.encrypt('');

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });

    it('should handle special characters', () => {
      const plaintext =
        'password with special chars: !@#$%^&*()_+{}[]|\\:;"<>?,./`~';

      const encrypted = service.encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });

    it('should handle unicode characters', () => {
      const plaintext = 'unicode: 你好世界 🚀🔐';

      const encrypted = service.encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });
  });

  describe('decrypt()', () => {
    it('should decrypt encrypted data back to original plaintext', () => {
      const plaintext = 'postgresql://user:password@localhost:5432/db';

      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should decrypt database URLs correctly', () => {
      const databaseUrl =
        'postgresql://wellpulse:secret123@db.example.com:5432/tenant_db';

      const encrypted = service.encrypt(databaseUrl);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(databaseUrl);
      expect(decrypted).toContain('wellpulse');
      expect(decrypted).toContain('secret123');
    });

    it('should handle empty strings', () => {
      const encrypted = service.encrypt('');
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe('');
    });

    it('should handle special characters', () => {
      const plaintext = 'password: !@#$%^&*()';

      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = 'unicode: 你好世界 🚀🔐';

      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error for invalid encrypted format', () => {
      const invalidFormat = 'not:valid:encrypted:data:too:many:parts';

      expect(() => service.decrypt(invalidFormat)).toThrow(
        'Failed to decrypt data',
      );
    });

    it('should throw error for tampered ciphertext', () => {
      const plaintext = 'sensitive data';
      const encrypted = service.encrypt(plaintext);

      // Tamper with ciphertext
      const parts = encrypted.split(':');
      parts[2] = parts[2].replace(/0/g, '1'); // Change some hex digits
      const tampered = parts.join(':');

      expect(() => service.decrypt(tampered)).toThrow('Failed to decrypt data');
    });

    it('should throw error for tampered auth tag', () => {
      const plaintext = 'sensitive data';
      const encrypted = service.encrypt(plaintext);

      // Tamper with auth tag
      const parts = encrypted.split(':');
      parts[1] = parts[1].replace(/a/g, 'b');
      const tampered = parts.join(':');

      expect(() => service.decrypt(tampered)).toThrow('Failed to decrypt data');
    });

    it('should throw error for wrong encryption key', () => {
      const plaintext = 'sensitive data';
      const encrypted = service.encrypt(plaintext);

      // Create new service with different key
      const differentKeyConfigService = {
        get: jest.fn(() => 'different_32_byte_key_1234567890ab'),
      };
      const differentKeyService = new EncryptionService(
        differentKeyConfigService as any,
      );

      expect(() => differentKeyService.decrypt(encrypted)).toThrow(
        'Failed to decrypt data',
      );
    });
  });

  describe('isEncrypted()', () => {
    it('should return true for encrypted data', () => {
      const plaintext = 'test data';
      const encrypted = service.encrypt(plaintext);

      expect(service.isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plaintext database URLs', () => {
      const plaintextUrl = 'postgresql://user:pass@localhost:5432/db';

      expect(service.isEncrypted(plaintextUrl)).toBe(false);
    });

    it('should return false for random strings', () => {
      expect(service.isEncrypted('random string')).toBe(false);
      expect(service.isEncrypted('123456789')).toBe(false);
      expect(service.isEncrypted('')).toBe(false);
    });

    it('should return false for malformed encrypted format', () => {
      expect(service.isEncrypted('abc:def:ghi')).toBe(false); // Too short
      expect(service.isEncrypted('not-hex:data:here')).toBe(false); // Not hex
    });

    it('should validate encrypted format strictly', () => {
      // Valid format: 32_hex:32_hex:variable_hex
      const validEncrypted = service.encrypt('test');
      expect(service.isEncrypted(validEncrypted)).toBe(true);

      // Invalid formats
      expect(
        service.isEncrypted('a'.repeat(31) + ':' + 'b'.repeat(32) + ':cdef'),
      ).toBe(false); // IV too short
      expect(
        service.isEncrypted('a'.repeat(32) + ':' + 'b'.repeat(31) + ':cdef'),
      ).toBe(false); // Auth tag too short
      expect(
        service.isEncrypted(
          'ZZZZ' + 'a'.repeat(28) + ':' + 'b'.repeat(32) + ':cdef',
        ),
      ).toBe(false); // Invalid hex in IV
    });
  });

  describe('encryptIfNeeded()', () => {
    it('should encrypt plaintext data', () => {
      const plaintext = 'postgresql://user:pass@localhost:5432/db';

      const result = service.encryptIfNeeded(plaintext);

      expect(service.isEncrypted(result)).toBe(true);
      expect(result).not.toBe(plaintext);
    });

    it('should not re-encrypt already encrypted data', () => {
      const plaintext = 'test data';
      const encrypted = service.encrypt(plaintext);

      const result = service.encryptIfNeeded(encrypted);

      expect(result).toBe(encrypted); // Same encrypted string
    });

    it('should handle backward compatibility migration', () => {
      // Simulates migrating from plaintext to encrypted storage
      const plaintextUrl = 'postgresql://user:pass@localhost:5432/db';

      // First time: encrypt
      const encrypted1 = service.encryptIfNeeded(plaintextUrl);
      expect(service.isEncrypted(encrypted1)).toBe(true);

      // Second time: already encrypted, don't re-encrypt
      const encrypted2 = service.encryptIfNeeded(encrypted1);
      expect(encrypted2).toBe(encrypted1);
    });
  });

  describe('decryptIfNeeded()', () => {
    it('should decrypt encrypted data', () => {
      const plaintext = 'postgresql://user:pass@localhost:5432/db';
      const encrypted = service.encrypt(plaintext);

      const result = service.decryptIfNeeded(encrypted);

      expect(result).toBe(plaintext);
    });

    it('should return plaintext data as-is', () => {
      const plaintext = 'postgresql://user:pass@localhost:5432/db';

      const result = service.decryptIfNeeded(plaintext);

      expect(result).toBe(plaintext);
    });

    it('should handle backward compatibility during migration', () => {
      // Scenario: Database has mix of plaintext and encrypted URLs

      const plaintextUrl = 'postgresql://user:pass@localhost:5432/db1';
      const encryptedUrl = service.encrypt(
        'postgresql://user:pass@localhost:5432/db2',
      );

      // Both should return valid URLs
      expect(service.decryptIfNeeded(plaintextUrl)).toBe(plaintextUrl);
      expect(service.decryptIfNeeded(encryptedUrl)).toBe(
        'postgresql://user:pass@localhost:5432/db2',
      );
    });
  });

  describe('Round-trip Encryption', () => {
    it('should handle multiple encrypt/decrypt cycles', () => {
      const plaintext = 'test data';

      const encrypted1 = service.encrypt(plaintext);
      const decrypted1 = service.decrypt(encrypted1);

      expect(decrypted1).toBe(plaintext);

      // Encrypt again (should produce different ciphertext due to random IV)
      const encrypted2 = service.encrypt(plaintext);
      const decrypted2 = service.decrypt(encrypted2);

      expect(decrypted2).toBe(plaintext);
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle large data', () => {
      const largePlaintext = 'a'.repeat(10000);

      const encrypted = service.encrypt(largePlaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(largePlaintext);
      expect(decrypted.length).toBe(10000);
    });

    it('should handle database URLs with complex passwords', () => {
      const complexUrl =
        'postgresql://user:P@ssw0rd!#$%^&*()_+{}[]|\\:;"<>?,./`~@db.host.com:5432/db_name?sslmode=require';

      const encrypted = service.encrypt(complexUrl);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(complexUrl);
    });
  });

  describe('Security Properties', () => {
    it('should use different IV for each encryption (prevents pattern detection)', () => {
      const plaintext = 'same plaintext';

      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);

      // Extract IVs
      const iv1 = encrypted1.split(':')[0];
      const iv2 = encrypted2.split(':')[0];

      expect(iv1).not.toBe(iv2);
    });

    it('should include authentication tag (GCM mode provides authenticity)', () => {
      const plaintext = 'test data';
      const encrypted = service.encrypt(plaintext);

      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);

      // Auth tag should be present and 32 hex chars (16 bytes)
      expect(parts[1]).toHaveLength(32);
      expect(/^[0-9a-f]{32}$/i.test(parts[1])).toBe(true);
    });

    it('should detect tampering via authentication tag', () => {
      const plaintext = 'sensitive data';
      const encrypted = service.encrypt(plaintext);

      // Attempt to modify ciphertext (flip the first character)
      const parts = encrypted.split(':');
      const originalCiphertext = parts[2];
      // Ensure we actually change something by flipping first hex digit
      const firstChar = originalCiphertext[0];
      const flippedChar = firstChar === 'f' ? '0' : 'f';
      const tamperedCiphertext = flippedChar + originalCiphertext.slice(1);
      const tampered = `${parts[0]}:${parts[1]}:${tamperedCiphertext}`;

      // Should throw due to auth tag verification failure
      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('should not leak information via error messages in production', () => {
      const invalidEncrypted = 'invalid:data:here';

      try {
        service.decrypt(invalidEncrypted);
        fail('Should have thrown');
      } catch (error) {
        // Error message should be generic
        expect((error as Error).message).toBe(
          'Failed to decrypt data. Data may be corrupted or key may be incorrect.',
        );
        // Should not reveal internal details
        expect((error as Error).message).not.toContain('Invalid');
        expect((error as Error).message).not.toContain('Expected');
      }
    });
  });
});
