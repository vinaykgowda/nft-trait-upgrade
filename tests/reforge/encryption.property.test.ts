import fc from 'fast-check';
import crypto from 'crypto';
import { EncryptionService } from '../../src/lib/services/encryption';

// Feature: pv-reforge, Property 11: Encryption round-trip

/**
 * Property 11: Encryption round-trip
 *
 * For any valid private key string, encrypting it with the EncryptionService
 * and then decrypting the result should produce the original key. Additionally,
 * the encrypted form must differ from the plaintext.
 *
 * Validates: Requirements 14.2, 10.3
 */
describe('Encryption Service Property Tests', () => {
  // Generate a valid 256-bit hex key for testing
  const testKey = crypto.randomBytes(32).toString('hex');
  let encryptionService: EncryptionService;

  beforeAll(() => {
    encryptionService = new EncryptionService(testKey);
  });

  describe('Property 11: Encryption round-trip', () => {
    it('encrypting and then decrypting any string should produce the original string, and encrypted form must differ from plaintext', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary non-empty strings representing private keys
          fc.string({ minLength: 1, maxLength: 256 }),
          (plaintext) => {
            const encrypted = encryptionService.encrypt(plaintext);
            const decrypted = encryptionService.decrypt(encrypted);

            // Round-trip: decrypt(encrypt(x)) === x
            expect(decrypted).toBe(plaintext);

            // Encrypted form must differ from plaintext
            expect(encrypted).not.toBe(plaintext);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
