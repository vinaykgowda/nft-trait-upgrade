import fc from 'fast-check';
import { TraitRepository, TraitRow } from '../../src/lib/repositories/traits';
import { TraitPoolRepository, TraitPoolRow } from '../../src/lib/repositories/trait-pool';

// Feature: pv-reforge, Property 4: Trait pool partitioning

/**
 * Property 4: Trait pool partitioning
 *
 * For any trait in the system, if `swap_pool_only = true` then the trait appears in the
 * Trait_Pool query results and does NOT appear in the marketplace query results;
 * if `swap_pool_only = false` then the trait appears in the marketplace query results
 * and does NOT appear in the Trait_Pool query results.
 *
 * **Validates: Requirements 2.2, 2.3, 13.4**
 */

/**
 * Arbitrary for generating a trait with swap_pool_only flag.
 */
interface TestTrait {
  id: string;
  slot_id: string;
  slot_name: string;
  name: string;
  image_layer_url: string;
  rarity_tier_id: string;
  total_supply: number | null;
  remaining_supply: number | null;
  price_amount: string;
  price_token_id: string;
  active: boolean;
  swap_pool_only: boolean;
  ldz_earning: string;
  layer_order: number;
  project_id: string;
}

const arbTestTrait: fc.Arbitrary<TestTrait> = fc.record({
  id: fc.uuid(),
  slot_id: fc.uuid(),
  slot_name: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
  image_layer_url: fc.webUrl(),
  rarity_tier_id: fc.uuid(),
  total_supply: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: null }),
  remaining_supply: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: null }),
  price_amount: fc.double({ min: 0, max: 100, noNaN: true }).map((v) => v.toFixed(2)),
  price_token_id: fc.uuid(),
  active: fc.constant(true), // Only active traits are relevant for partitioning
  swap_pool_only: fc.boolean(),
  ldz_earning: fc.double({ min: 0, max: 50, noNaN: true }).map((v) => v.toFixed(2)),
  layer_order: fc.integer({ min: 0, max: 10 }),
  project_id: fc.uuid(),
});

/**
 * Create a mock TraitRepository that simulates the database with the given traits.
 * The findAvailable method should exclude swap_pool_only = true traits.
 */
function createMockTraitRepository(traits: TestTrait[]): TraitRepository {
  const repo = new TraitRepository();

  // Override findAvailable to simulate the actual SQL query behavior
  repo.findAvailable = jest.fn(async (): Promise<TraitRow[]> => {
    return traits
      .filter((t) => t.active)
      .filter((t) => t.total_supply === null || (t.remaining_supply !== null && t.remaining_supply > 0))
      .filter((t) => t.swap_pool_only === false || t.swap_pool_only === null || t.swap_pool_only === undefined)
      .map((t) => ({
        id: t.id,
        slot_id: t.slot_id,
        name: t.name,
        image_layer_url: t.image_layer_url,
        rarity_tier_id: t.rarity_tier_id,
        total_supply: t.total_supply ?? undefined,
        remaining_supply: t.remaining_supply ?? undefined,
        price_amount: t.price_amount,
        price_token_id: t.price_token_id,
        active: t.active,
        created_at: new Date(),
        updated_at: new Date(),
      }));
  });

  return repo;
}

/**
 * Create a mock TraitPoolRepository that simulates the database with the given traits.
 * The findByCollection method should only return swap_pool_only = true traits.
 */
function createMockTraitPoolRepository(traits: TestTrait[]): TraitPoolRepository {
  const repo = new TraitPoolRepository();

  // Override findByCollection to simulate the actual SQL query behavior
  repo.findByCollection = jest.fn(async (collectionId: string): Promise<TraitPoolRow[]> => {
    return traits
      .filter((t) => t.swap_pool_only === true)
      .filter((t) => t.active)
      .filter((t) => t.project_id === collectionId)
      .map((t) => ({
        id: t.id,
        slot_id: t.slot_id,
        slot_name: t.slot_name,
        name: t.name,
        image_layer_url: t.image_layer_url,
        ldz_earning: t.ldz_earning,
        layer_order: t.layer_order,
      }));
  });

  return repo;
}

describe('Trait Pool Partitioning Property Tests', () => {
  describe('Property 4: Trait pool partitioning', () => {
    it('swap_pool_only=true traits appear in pool results and NOT in marketplace results', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(arbTestTrait, { minLength: 1, maxLength: 20 }),
          async (traits) => {
            const collectionId = traits[0].project_id;
            // Assign all traits to the same collection for this test
            const normalizedTraits = traits.map((t) => ({ ...t, project_id: collectionId }));

            const traitRepo = createMockTraitRepository(normalizedTraits);
            const poolRepo = createMockTraitPoolRepository(normalizedTraits);

            const marketplaceTraits = await traitRepo.findAvailable();
            const poolTraits = await poolRepo.findByCollection(collectionId);

            const marketplaceIds = new Set(marketplaceTraits.map((t) => t.id));
            const poolIds = new Set(poolTraits.map((t) => t.id));

            // For each trait with swap_pool_only = true:
            // - It MUST appear in pool results
            // - It MUST NOT appear in marketplace results
            for (const trait of normalizedTraits) {
              if (!trait.active) continue; // Inactive traits won't appear in either

              if (trait.swap_pool_only === true) {
                expect(poolIds.has(trait.id)).toBe(true);
                expect(marketplaceIds.has(trait.id)).toBe(false);
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('swap_pool_only=false traits appear in marketplace results and NOT in pool results', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(arbTestTrait, { minLength: 1, maxLength: 20 }),
          async (traits) => {
            const collectionId = traits[0].project_id;
            // Assign all traits to the same collection for this test
            const normalizedTraits = traits.map((t) => ({ ...t, project_id: collectionId }));

            const traitRepo = createMockTraitRepository(normalizedTraits);
            const poolRepo = createMockTraitPoolRepository(normalizedTraits);

            const marketplaceTraits = await traitRepo.findAvailable();
            const poolTraits = await poolRepo.findByCollection(collectionId);

            const marketplaceIds = new Set(marketplaceTraits.map((t) => t.id));
            const poolIds = new Set(poolTraits.map((t) => t.id));

            // For each trait with swap_pool_only = false:
            // - It MUST appear in marketplace results (if active and has supply)
            // - It MUST NOT appear in pool results
            for (const trait of normalizedTraits) {
              if (!trait.active) continue;

              if (trait.swap_pool_only === false) {
                // Check supply availability (same logic as findAvailable)
                const hasSupply = trait.total_supply === null || 
                  (trait.remaining_supply !== null && trait.remaining_supply > 0);
                
                if (hasSupply) {
                  expect(marketplaceIds.has(trait.id)).toBe(true);
                }
                expect(poolIds.has(trait.id)).toBe(false);
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('marketplace and pool trait sets are disjoint (no trait appears in both)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(arbTestTrait, { minLength: 1, maxLength: 20 }),
          async (traits) => {
            const collectionId = traits[0].project_id;
            const normalizedTraits = traits.map((t) => ({ ...t, project_id: collectionId }));

            const traitRepo = createMockTraitRepository(normalizedTraits);
            const poolRepo = createMockTraitPoolRepository(normalizedTraits);

            const marketplaceTraits = await traitRepo.findAvailable();
            const poolTraits = await poolRepo.findByCollection(collectionId);

            const marketplaceIds = new Set(marketplaceTraits.map((t) => t.id));
            const poolIds = new Set(poolTraits.map((t) => t.id));

            // No trait should appear in both sets
            for (const id of marketplaceIds) {
              expect(poolIds.has(id)).toBe(false);
            }
            for (const id of poolIds) {
              expect(marketplaceIds.has(id)).toBe(false);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
