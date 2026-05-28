import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits auth tag

/**
 * EncryptionService provides AES-256-GCM encryption/decryption
 * for sensitive data like Update Authority private keys.
 * 
 * The ENCRYPTION_KEY environment variable must be a 64-character hex string
 * representing a 256-bit key.
 */
export class EncryptionService {
  private key: Buffer;

  constructor(encryptionKey?: string) {
    const keyHex = encryptionKey || process.env.ENCRYPTION_KEY;
    if (!keyHex) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    if (keyHex.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be a 64-character hex string (256 bits)');
    }
    this.key = Buffer.from(keyHex, 'hex');
  }

  /**
   * Encrypts plaintext using AES-256-GCM.
   * Returns base64(iv + ciphertext + tag)
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    // Concatenate iv + ciphertext + tag and encode as base64
    const result = Buffer.concat([iv, encrypted, tag]);
    return result.toString('base64');
  }

  /**
   * Decrypts a base64(iv + ciphertext + tag) string back to plaintext.
   */
  decrypt(ciphertext: string): string {
    const data = Buffer.from(ciphertext, 'base64');

    if (data.length < IV_LENGTH + TAG_LENGTH + 1) {
      throw new Error('Invalid ciphertext: data too short');
    }

    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(data.length - TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH, data.length - TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
