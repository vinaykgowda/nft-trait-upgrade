import fc from 'fast-check';
import { PackManager, CreatePackInput } from '../../src/lib/services/pack-manager';
import { ReforgePackRepository, ReforgePackRow } from '../../src/lib/repositories/reforge-packs';
import { PackTier, ReforgePack } from '../../src/types/reforge';

// Feature: pv-reforge, Property 1: Pack creation round-trip
// Feature: pv-reforge, Property 2: Pack validation rejects invalid configurations
// Feature: pv-reforge, Property 3: Disabled packs reject all purchases

/**
 * Mock the ReforgePackRepository to avoid hitting a real database.
 * We simulate an in-memory store for pack rows.
 */
function createMockRepository() {
  const store = new Map<string, ReforgePackRow>();
  let idCounter = 0;

  const repo = new ReforgePackRepository();

  // Override create to store in memory
  repo.create = jest.fn(async (data: Partial<ReforgePackRow>): Promise<ReforgePackRow> => {
    const id = data.id || `pack-${++idCounter}`;
    const now = new Date();
    const row: ReforgePackRow = {
      id,
      collection_id: data.collection_id || '',
      tier_name: data.tier_name || 'silver',
      sol_price: data.sol_price || '0',
      min_ldz_earning: data.min_ldz_earning || '0',
      max_ldz_earning: data.max_ldz_earning || '0',
      total_inventory: data.total_inventory || 0,
      remaining_count: data.remaining_count ?? data.total_inventory ?? 0,
      enabled: data.enabled ?? true,
      created_at: now,
      updated_at: now,
    };
    store.set(id, row);
    return row;
  });

  // Override findById to read from memory
  repo.findById = jest.fn(async (id: string): Promise<ReforgePackRow | null> => {
    return store.get(id) || null;
  });

  // Override findByCollection
  repo.findByCollection = jest.fn(async (collectionId: string, activeOnly?: boolean): Promise<ReforgePackRow[]> => {
    const rows = Array.from(store.values()).filter((r) => r.collection_id === collectionId);
    if (activeOnly) return rows.filter((r) => r.enabled);
    return rows;
  });

  // Override setEnabled
  repo.setEnabled = jest.fn(async (id: string, enabled: boolean): Promise<ReforgePackRow | null> => {
    const row = store.get(id);
    if (!row) return null;
    row.enabled = enabled;
    row.updated_at = new Date();
    store.set(id, row);
    return row;
  });

  // Override decrementInventory
  repo.decrementInventory = jest.fn(async (id: string): Promise<ReforgePackRow | null> => {
    const row = store.get(id);
    if (!row || row.remaining_count <= 0) return null;
    row.remaining_count -= 1;
    row.updated_at = new Date();
    store.set(id, row);
    return row;
  });

  // Override update
  repo.update = jest.fn(async (id: string, data: Partial<ReforgePackRow>): Promise<ReforgePackRow | null> => {
    const row = store.get(id);
    if (!row) return null;
    Object.assign(row, data, { updated_at: new Date() });
    store.set(id, row);
    return row;
  });

  return { repo, store };
}

/**
 * Arbitrary for valid PackTier values.
 */
const arbTier = fc.constantFrom<PackTier>('silver', 'gold', 'diamond');

/**
 * Arbitrary for valid pack configurations (min <= max, positive inventory, positive price).
 */
const arbValidPackInput: fc.Arbitrary<CreatePackInput> = fc.record({
  collectionId: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  tierName: arbTier,
  solPrice: fc.double({ min: 0.001, max: 1000, noNaN: true }),
  minLdzEarning: fc.double({ min: 0, max: 500, noNaN: true }),
  maxLdzEarning: fc.double({ min: 0, max: 500, noNaN: true }),
  totalInventory: fc.integer({ min: 1, max: 10000 }),
}).map((input) => {
  // Ensure min <= max by sorting
  const min = Math.min(input.minLdzEarning, input.maxLdzEarning);
  const max = Math.max(input.minLdzEarning, input.maxLdzEarning);
  return { ...input, minLdzEarning: min, maxLdzEarning: max };
});

/**
 * Arbitrary for invalid pack configurations where min > max LDZ.
 */
const arbInvalidLdzRange: fc.Arbitrary<CreatePackInput> = fc.record({
  collectionId: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  tierName: arbTier,
  solPrice: fc.double({ min: 0.001, max: 1000, noNaN: true }),
  minLdzEarning: fc.double({ min: 1, max: 500, noNaN: true }),
  maxLdzEarning: fc.double({ min: 0, max: 499, noNaN: true }),
  totalInventory: fc.integer({ min: 1, max: 10000 }),
}).filter((input) => input.minLdzEarning > input.maxLdzEarning);

/**
 * Arbitrary for invalid pack configurations where totalInventory <= 0.
 */
const arbInvalidInventory: fc.Arbitrary<CreatePackInput> = fc.record({
  collectionId: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  tierName: arbTier,
  solPrice: fc.double({ min: 0.001, max: 1000, noNaN: true }),
  minLdzEarning: fc.double({ min: 0, max: 500, noNaN: true }),
  maxLdzEarning: fc.double({ min: 0, max: 500, noNaN: true }),
  totalInventory: fc.integer({ min: -100, max: 0 }),
}).map((input) => {
  const min = Math.min(input.minLdzEarning, input.maxLdzEarning);
  const max = Math.max(input.minLdzEarning, input.maxLdzEarning);
  return { ...input, minLdzEarning: min, maxLdzEarning: max };
});

describe('Pack Validation Property Tests', () => {
  describe('Property 1: Pack creation round-trip', () => {
    /**
     * Property 1: Pack creation round-trip
     *
     * For any valid pack configuration (with valid tier, positive price, valid LDZ range,
     * positive inventory, and collection ID), creating the pack and then reading it back
     * should produce an equivalent record with all fields preserved.
     *
     * Validates: Requirements 1.1
     */
    it('creating a pack and reading it back should preserve all fields', async () => {
      await fc.assert(
        fc.asyncProperty(arbValidPackInput, async (input) => {
          const { repo } = createMockRepository();
          const manager = new PackManager(repo);

          const created = await manager.createPack(input);

          // Read it back
          const retrieved = await manager.getPackById(created.id);

          expect(retrieved).not.toBeNull();
          expect(retrieved!.collectionId).toBe(input.collectionId);
          expect(retrieved!.tierName).toBe(input.tierName);
          expect(retrieved!.solPrice).toBeCloseTo(input.solPrice, 5);
          expect(retrieved!.minLdzEarning).toBeCloseTo(input.minLdzEarning, 5);
          expect(retrieved!.maxLdzEarning).toBeCloseTo(input.maxLdzEarning, 5);
          expect(retrieved!.totalInventory).toBe(input.totalInventory);
          expect(retrieved!.remainingCount).toBe(input.totalInventory);
          expect(retrieved!.enabled).toBe(true);
          expect(retrieved!.id).toBe(created.id);

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Pack validation rejects invalid configurations', () => {
    /**
     * Property 2: Pack validation rejects invalid configurations
     *
     * For any pack configuration where minLdzEarning > maxLdzEarning OR totalInventory <= 0,
     * the Pack_Manager should reject the creation and no pack record should be stored.
     *
     * Validates: Requirements 1.2, 1.3
     */
    it('should reject packs where minLdzEarning > maxLdzEarning', async () => {
      await fc.assert(
        fc.asyncProperty(arbInvalidLdzRange, async (input) => {
          const { repo, store } = createMockRepository();
          const manager = new PackManager(repo);

          await expect(manager.createPack(input)).rejects.toThrow();

          // No pack should be stored
          expect(store.size).toBe(0);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should reject packs where totalInventory <= 0', async () => {
      await fc.assert(
        fc.asyncProperty(arbInvalidInventory, async (input) => {
          const { repo, store } = createMockRepository();
          const manager = new PackManager(repo);

          await expect(manager.createPack(input)).rejects.toThrow();

          // No pack should be stored
          expect(store.size).toBe(0);

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Disabled packs reject all purchases', () => {
    /**
     * Property 3: Disabled packs reject all purchases
     *
     * For any pack that has enabled = false, and any valid user with wallet and Discord,
     * a purchase attempt should be rejected and pack inventory should remain unchanged.
     *
     * Validates: Requirements 1.7
     */
    it('should reject purchase attempts for disabled packs and leave inventory unchanged', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbValidPackInput,
          fc.string({ minLength: 32, maxLength: 44 }), // wallet address
          fc.string({ minLength: 1, maxLength: 20 }),   // discord id
          async (input, _walletAddress, _discordId) => {
            const { repo } = createMockRepository();
            const manager = new PackManager(repo);

            // Create a valid pack, then disable it
            const created = await manager.createPack(input);
            await manager.disablePack(created.id);

            const inventoryBefore = created.remainingCount;

            // Attempt to validate purchase (should be rejected)
            await expect(manager.validatePurchase(created.id)).rejects.toMatchObject({
              error: 'PACK_DISABLED',
            });

            // Verify inventory is unchanged
            const afterAttempt = await manager.getPackById(created.id);
            expect(afterAttempt!.remainingCount).toBe(inventoryBefore);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
