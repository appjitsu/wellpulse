/**
 * Encryption Service
 *
 * Provides AES-256-GCM encryption and decryption for sensitive data.
 * Primary use case: Encrypting database connection strings before storing in master DB.
 *
 * Security Features:
 * - AES-256-GCM (Galois/Counter Mode) authenticated encryption
 * - Random initialization vector (IV) for each encryption
 * - Authentication tag prevents tampering
 * - Constant-time operations where possible
 *
 * Key Management:
 * - Encryption key stored in environment variable (ENCRYPTION_KEY)
 * - Key must be 32 bytes (256 bits) for AES-256
 * - In production: Use Azure Key Vault or AWS Secrets Manager
 *
 * Data Format:
 * - Encrypted format: IV:AUTH_TAG:CIPHERTEXT (hex-encoded)
 * - IV: 16 bytes initialization vector
 * - AUTH_TAG: 16 bytes authentication tag
 * - CIPHERTEXT: Variable length encrypted data
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 16; // 128 bits
  private readonly authTagLength = 16; // 128 bits
  private readonly encryptionKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    const keyString = this.configService.get<string>('ENCRYPTION_KEY');

    if (!keyString) {
      throw new Error(
        'ENCRYPTION_KEY environment variable is not set. ' +
          'This is required for encrypting sensitive data like database connection strings.',
      );
    }

    // Ensure key is exactly 32 bytes (256 bits) for AES-256
    // If key is shorter, derive using SHA-256 hash
    // If key is longer, truncate to 32 bytes
    if (keyString.length === 32) {
      this.encryptionKey = Buffer.from(keyString, 'utf-8');
    } else {
      // Use SHA-256 to derive a 32-byte key from any length input
      this.encryptionKey = crypto
        .createHash('sha256')
        .update(keyString)
        .digest();
      this.logger.warn(
        'ENCRYPTION_KEY is not 32 bytes. Deriving key using SHA-256. ' +
          'For production, use a 32-character random key.',
      );
    }

    this.logger.log('EncryptionService initialized with AES-256-GCM');
  }

  /**
   * Encrypt sensitive data
   *
   * @param plaintext - Data to encrypt (e.g., database connection string)
   * @returns Encrypted data in format: IV:AUTH_TAG:CIPHERTEXT (hex-encoded)
   */
  encrypt(plaintext: string): string {
    try {
      // Generate random IV (Initialization Vector) for each encryption
      // Using different IVs prevents pattern detection in ciphertext
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher with algorithm, key, and IV
      const cipher = crypto.createCipheriv(
        this.algorithm,
        this.encryptionKey,
        iv,
      );

      // Encrypt the plaintext
      let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
      ciphertext += cipher.final('hex');

      // Get authentication tag (GCM mode provides authenticity + confidentiality)
      const authTag = cipher.getAuthTag();

      // Combine IV + AUTH_TAG + CIPHERTEXT for storage
      // Format: IV:AUTH_TAG:CIPHERTEXT (all hex-encoded, colon-separated)
      const encrypted = `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;

      return encrypted;
    } catch (error) {
      this.logger.error(
        `Encryption failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt encrypted data
   *
   * @param encrypted - Encrypted data in format: IV:AUTH_TAG:CIPHERTEXT
   * @returns Original plaintext
   * @throws Error if decryption fails (wrong key, tampered data, etc.)
   */
  decrypt(encrypted: string): string {
    try {
      // Split the encrypted string into components
      const parts = encrypted.split(':');

      if (parts.length !== 3) {
        throw new Error(
          'Invalid encrypted format. Expected IV:AUTH_TAG:CIPHERTEXT',
        );
      }

      const [ivHex, authTagHex, ciphertext] = parts;

      // Convert from hex to Buffer
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      // Validate IV and auth tag lengths
      if (iv.length !== this.ivLength) {
        throw new Error(`Invalid IV length. Expected ${this.ivLength} bytes.`);
      }
      if (authTag.length !== this.authTagLength) {
        throw new Error(
          `Invalid auth tag length. Expected ${this.authTagLength} bytes.`,
        );
      }

      // Create decipher with algorithm, key, and IV
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.encryptionKey,
        iv,
      );

      // Set authentication tag (GCM mode validates data integrity)
      decipher.setAuthTag(authTag);

      // Decrypt the ciphertext
      let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
      plaintext += decipher.final('utf8');

      return plaintext;
    } catch (error) {
      this.logger.error(
        `Decryption failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        'Failed to decrypt data. Data may be corrupted or key may be incorrect.',
      );
    }
  }

  /**
   * Check if data appears to be encrypted
   *
   * @param data - Data to check
   * @returns True if data matches encrypted format (IV:AUTH_TAG:CIPHERTEXT)
   */
  isEncrypted(data: string): boolean {
    // Check if data matches format: 32_hex_chars:32_hex_chars:variable_hex_chars
    const encryptedPattern = /^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/i;
    return encryptedPattern.test(data);
  }

  /**
   * Encrypt if not already encrypted
   *
   * Useful for migrating existing plaintext data to encrypted format.
   * Checks if data is already encrypted before encrypting.
   *
   * @param data - Data that may or may not be encrypted
   * @returns Encrypted data
   */
  encryptIfNeeded(data: string): string {
    if (this.isEncrypted(data)) {
      return data; // Already encrypted
    }
    return this.encrypt(data);
  }

  /**
   * Decrypt if encrypted, otherwise return as-is
   *
   * Useful for backward compatibility during migration.
   * Allows gradual encryption of existing data.
   *
   * @param data - Data that may or may not be encrypted
   * @returns Decrypted data or original data if not encrypted
   */
  decryptIfNeeded(data: string): string {
    if (this.isEncrypted(data)) {
      return this.decrypt(data);
    }
    return data; // Not encrypted, return as-is
  }
}
