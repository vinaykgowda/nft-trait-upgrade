import fc from 'fast-check';
import { ReforgeCombinationRepository } from '../../src/lib/repositories/reforge-combinations';

// Feature: pv-reforge, Property 9: Combination uniqueness invariant

/**
 * Property 9: Combination uniqueness invariant
 *
 * For any two completed reforge orders within the same collection, their
 * combination hashes must be different. Equivalently, no two orders should
 * share the same sorted set of trait IDs.
 *
 * More specifically:
 * - For any two different sets of trait IDs, their hashes should be different
 * - For the same set of trait IDs (regardless of order), the hash should be the same
 * - The hash function should be deterministic
 *
 * Validates: Requirements 8.1, 8.3
 */

// Mock the database module to avoid real DB connections
jest.mock('../../src/lib/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

describe('Combination Validator Property Tests', () => {
  describe('Property 9: Combination uniqueness invariant', () => {
    it('generateHash is deterministic: same trait IDs always produce the same hash', () => {
      fc.assert(
        fc.property(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
          (traitIds) => {
            const hash1 = ReforgeCombinationRepository.generateHash(traitIds);
            const hash2 = ReforgeCombinationRepository.generateHash(traitIds);

            expect(hash1).toBe(hash2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('generateHash is order-independent: same trait IDs in any order produce the same hash', () => {
      fc.assert(
        fc.property(
          fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }),
          (traitIds) => {
            const shuffled = [...traitIds].sort(() => Math.random() - 0.5);
            const hash1 = ReforgeCombinationRepository.generateHash(traitIds);
            const hash2 = ReforgeCombinationRepository.generateHash(shuffled);

            expect(hash1).toBe(hash2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('generateHash produces different hashes for different sets of trait IDs', () => {
      fc.assert(
        fc.property(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 8 }),
          fc.array(fc.uuid(), { minLength: 1, maxLength: 8 }),
          (traitIds1, traitIds2) => {
            // Only test when the sorted sets are actually different
            const sorted1 = [...traitIds1].sort().join(',');
            const sorted2 = [...traitIds2].sort().join(',');

            fc.pre(sorted1 !== sorted2);

            const hash1 = ReforgeCombinationRepository.generateHash(traitIds1);
            const hash2 = ReforgeCombinationRepository.generateHash(traitIds2);

            expect(hash1).not.toBe(hash2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('generateHash produces a valid SHA-256 hex string (64 characters)', () => {
      fc.assert(
        fc.property(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
          (traitIds) => {
            const hash = ReforgeCombinationRepository.generateHash(traitIds);

            // SHA-256 produces a 64-character hex string
            expect(hash).toMatch(/^[a-f0-9]{64}$/);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 9: isUnique and recordCombination integration', () => {
    let repo: ReforgeCombinationRepository;
    const mockQuery = require('../../src/lib/database').query;

    beforeEach(() => {
      repo = new ReforgeCombinationRepository();
      jest.clearAllMocks();
    });

    it('isUnique returns true when combination does not exist in DB', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: 1, maxLength: 8 }),
          async (collectionId, traitIds) => {
            // Mock DB returning no rows (combination doesn't exist)
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await repo.isUnique(collectionId, traitIds);
            expect(result).toBe(true);

            // Verify the hash was computed correctly and passed to the query
            const expectedHash = ReforgeCombinationRepository.generateHash(traitIds);
            expect(mockQuery).toHaveBeenCalledWith(
              expect.stringContaining('combination_hash'),
              [collectionId, expectedHash]
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isUnique returns false when combination already exists in DB', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: 1, maxLength: 8 }),
          async (collectionId, traitIds) => {
            // Mock DB returning a row (combination exists)
            mockQuery.mockResolvedValueOnce({ rows: [{ id: '1' }] });

            const result = await repo.isUnique(collectionId, traitIds);
            expect(result).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('recordCombination stores the correct hash for the given trait IDs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: 1, maxLength: 8 }),
          async (orderId, collectionId, traitIds) => {
            const expectedHash = ReforgeCombinationRepository.generateHash(traitIds);

            mockQuery.mockResolvedValueOnce({
              rows: [{
                id: 'new-id',
                order_id: orderId,
                collection_id: collectionId,
                combination_hash: expectedHash,
                trait_ids: traitIds,
                created_at: new Date(),
              }],
            });

            await repo.recordCombination(orderId, collectionId, traitIds);

            expect(mockQuery).toHaveBeenCalledWith(
              expect.stringContaining('INSERT'),
              [orderId, collectionId, expectedHash, traitIds]
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
