import fc from 'fast-check';
import { ReforgePackRepository, ReforgePackRow } from '../../src/lib/repositories/reforge-packs';
import { PackManager } from '../../src/lib/services/pack-manager';
import { PackTier, ReforgePack } from '../../src/types/reforge';

// Feature: pv-reforge, Property 6: Inventory concurrency safety

/**
 * Property 6: Inventory concurrency safety
 *
 * For any pack with remaining_count = N and M concurrent purchase attempts where M > N,
 * at most N purchases should succeed and remaining_count should never go below zero.
 *
 * **Validates: Requirements 4.6**
 */

/**
 * Create a mock repository that simulates optimistic locking behavior.
 * The decrementInventory uses an atomic check-and-decrement pattern
 * (UPDATE ... WHERE remaining_count > 0 RETURNING *).
 */
function createConcurrencyMockRepository() {
  const packStore = new Map<string, ReforgePackRow>();

  const repo = new ReforgePackRepository();

  repo.findById = jest.fn(async (id: string) => packStore.get(id) || null);

  /**
   * Simulate the atomic decrementInventory with optimistic locking.
   * This mirrors the SQL: UPDATE ... SET remaining_count = remaining_count - 1
   * WHERE id = $1 AND remaining_count > 0 RETURNING *
   *
   * The key property: even under concurrent access, remaining_count never goes below 0
   * because the WHERE clause prevents it atomically.
   */
  repo.decrementInventory = jest.fn(async (id: string): Promise<ReforgePackRow | null> => {
    const row = packStore.get(id);
    if (!row || row.remaining_count <= 0) return null;
    row.remaining_count -= 1;
    row.updated_at = new Date();
    packStore.set(id, row);
    return { ...row };
  });

  repo.toDomain = jest.fn((row: ReforgePackRow): ReforgePack => ({
    id: row.id,
    collectionId: row.collection_id,
    tierName: row.tier_name as PackTier,
    solPrice: parseFloat(row.sol_price),
    minLdzEarning: parseFloat(row.min_ldz_earning),
    maxLdzEarning: parseFloat(row.max_ldz_earning),
    totalInventory: row.total_inventory,
    remainingCount: row.remaining_count,
    enabled: row.enabled,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  }));

  return { repo, packStore };
}

/**
 * Helper to add a pack to the mock store with a specific remaining count.
 */
function addPackToStore(
  packStore: Map<string, ReforgePackRow>,
  remainingCount: number
): ReforgePackRow {
  const row: ReforgePackRow = {
    id: 'test-pack-concurrent',
    collection_id: 'collection-1',
    tier_name: 'gold',
    sol_price: '1.5',
    min_ldz_earning: '10',
    max_ldz_earning: '50',
    total_inventory: remainingCount,
    remaining_count: remainingCount,
    enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
  };
  packStore.set(row.id, row);
  return row;
}

describe('Inventory Concurrency Safety Property Tests', () => {
  describe('Property 6: Inventory concurrency safety', () => {
    it('at most N purchases succeed for a pack with remaining_count = N when M > N attempts are made', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 20 }),  // N: remaining inventory
          fc.integer({ min: 1, max: 30 }),  // extra attempts beyond N
          async (N, extra) => {
            const M = N + extra; // M > N concurrent attempts
            const { repo, packStore } = createConcurrencyMockRepository();

            addPackToStore(packStore, N);

            const packManager = new PackManager(repo);

            // Simulate M concurrent purchase attempts using decrementInventory
            const results = await Promise.all(
              Array.from({ length: M }, () => packManager.decrementInventory('test-pack-concurrent'))
            );

            // Count successful purchases (non-null results)
            const successCount = results.filter((r) => r !== null).length;

            // At most N purchases should succeed
            expect(successCount).toBeLessThanOrEqual(N);

            // Exactly N should succeed (since our mock is sequential via Promise.all)
            expect(successCount).toBe(N);

            // remaining_count should never go below zero
            const finalPack = packStore.get('test-pack-concurrent')!;
            expect(finalPack.remaining_count).toBeGreaterThanOrEqual(0);
            expect(finalPack.remaining_count).toBe(0);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('remaining_count never goes below zero regardless of number of attempts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 10 }),  // N: remaining inventory (can be 0)
          fc.integer({ min: 1, max: 50 }),  // M: number of attempts
          async (N, M) => {
            const { repo, packStore } = createConcurrencyMockRepository();

            addPackToStore(packStore, N);

            const packManager = new PackManager(repo);

            // Fire M concurrent attempts
            const results = await Promise.all(
              Array.from({ length: M }, () => packManager.decrementInventory('test-pack-concurrent'))
            );

            const successCount = results.filter((r) => r !== null).length;

            // Invariant: at most N succeed
            expect(successCount).toBeLessThanOrEqual(N);

            // Invariant: remaining_count >= 0
            const finalPack = packStore.get('test-pack-concurrent')!;
            expect(finalPack.remaining_count).toBeGreaterThanOrEqual(0);

            // The final remaining count should be N - successCount
            expect(finalPack.remaining_count).toBe(N - successCount);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('all attempts succeed when M <= N', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 50 }),  // N: remaining inventory
          fc.integer({ min: 1, max: 50 }),  // M: number of attempts (will be capped to <= N)
          async (N, rawM) => {
            const M = Math.min(rawM, N); // Ensure M <= N
            const { repo, packStore } = createConcurrencyMockRepository();

            addPackToStore(packStore, N);

            const packManager = new PackManager(repo);

            // Fire M attempts (all should succeed since M <= N)
            const results = await Promise.all(
              Array.from({ length: M }, () => packManager.decrementInventory('test-pack-concurrent'))
            );

            const successCount = results.filter((r) => r !== null).length;

            // All M should succeed
            expect(successCount).toBe(M);

            // remaining_count should be N - M
            const finalPack = packStore.get('test-pack-concurrent')!;
            expect(finalPack.remaining_count).toBe(N - M);
            expect(finalPack.remaining_count).toBeGreaterThanOrEqual(0);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
