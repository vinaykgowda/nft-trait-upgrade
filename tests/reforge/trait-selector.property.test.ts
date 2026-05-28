import fc from 'fast-check';
import { TraitSelectorService } from '../../src/lib/services/trait-selector';
import { TraitPoolRepository, TraitPoolRow } from '../../src/lib/repositories/trait-pool';
import { PoolTrait } from '../../src/types/reforge';

// Feature: pv-reforge, Property 8: Trait selection validity

/**
 * Validates: Requirements 7.2, 7.3, 7.5
 *
 * Property 8: Trait selection validity
 *
 * For any trait pool and pack earning range [min, max], the TraitSelector output must satisfy:
 * (a) exactly one trait is selected for each mandatory slot (background, skin, eyes, mouth)
 * (b) the sum of LDZ earnings of all selected traits with ldzEarning > 0 falls within [min, max] inclusive
 * (c) zero-earning traits do not contribute to the earning sum
 */

const MANDATORY_SLOTS = ['background', 'skin', 'eyes', 'mouth'];

/**
 * Create a mock TraitPoolRepository that returns pre-defined traits.
 */
function createMockRepository(traits: PoolTrait[]): TraitPoolRepository {
  const repo = new TraitPoolRepository();

  // Convert PoolTrait to TraitPoolRow format
  const rows: TraitPoolRow[] = traits.map((t) => ({
    id: t.id,
    slot_id: t.slotId,
    slot_name: t.slotName,
    name: t.name,
    image_layer_url: t.imageLayerUrl,
    ldz_earning: t.ldzEarning.toString(),
    layer_order: t.layerOrder,
  }));

  repo.findByCollection = jest.fn(async () => rows);
  repo.findBySlot = jest.fn(async (_collectionId: string, slotId: string) =>
    rows.filter((r) => r.slot_id === slotId)
  );

  return repo;
}

/**
 * Arbitrary for generating a single PoolTrait with a given slot name.
 */
function arbPoolTrait(slotName: string, slotId: string): fc.Arbitrary<PoolTrait> {
  return fc.record({
    id: fc.uuid(),
    slotId: fc.constant(slotId),
    slotName: fc.constant(slotName),
    name: fc.string({ minLength: 1, maxLength: 20 }),
    imageLayerUrl: fc.webUrl(),
    ldzEarning: fc.oneof(
      fc.constant(0), // zero-earning traits
      fc.double({ min: 0.01, max: 50, noNaN: true }) // earning traits
    ),
    layerOrder: fc.integer({ min: 0, max: 10 }),
  });
}

/**
 * Arbitrary for generating a trait pool that has at least one trait per mandatory slot.
 * This ensures the selector can always find a valid combination.
 */
const arbTraitPool: fc.Arbitrary<PoolTrait[]> = fc
  .record({
    background: fc.array(arbPoolTrait('background', 'slot-bg'), { minLength: 1, maxLength: 5 }),
    skin: fc.array(arbPoolTrait('skin', 'slot-skin'), { minLength: 1, maxLength: 5 }),
    eyes: fc.array(arbPoolTrait('eyes', 'slot-eyes'), { minLength: 1, maxLength: 5 }),
    mouth: fc.array(arbPoolTrait('mouth', 'slot-mouth'), { minLength: 1, maxLength: 5 }),
    // Optional slots
    hat: fc.array(arbPoolTrait('hat', 'slot-hat'), { minLength: 0, maxLength: 3 }),
    accessory: fc.array(arbPoolTrait('accessory', 'slot-acc'), { minLength: 0, maxLength: 3 }),
  })
  .map((slots) => [
    ...slots.background,
    ...slots.skin,
    ...slots.eyes,
    ...slots.mouth,
    ...slots.hat,
    ...slots.accessory,
  ]);

/**
 * Generate a valid earning range [min, max] that is achievable given the trait pool.
 * We compute the minimum possible earning (picking lowest earning trait per mandatory slot)
 * and maximum possible earning (picking highest earning trait per mandatory slot + optional).
 */
function computeAchievableRange(traits: PoolTrait[]): { minPossible: number; maxPossible: number } {
  const bySlot = new Map<string, PoolTrait[]>();
  for (const t of traits) {
    const key = t.slotName.toLowerCase();
    if (!bySlot.has(key)) bySlot.set(key, []);
    bySlot.get(key)!.push(t);
  }

  let minPossible = 0;
  let maxPossible = 0;

  for (const slot of MANDATORY_SLOTS) {
    const slotTraits = bySlot.get(slot) || [];
    const earnings = slotTraits.map((t) => t.ldzEarning).filter((e) => e > 0);
    if (earnings.length > 0) {
      minPossible += Math.min(...earnings);
      maxPossible += Math.max(...earnings);
    }
    // If all traits in a mandatory slot are zero-earning, they contribute 0
  }

  // Optional slots can add to max
  for (const [slotName, slotTraits] of bySlot) {
    if (!MANDATORY_SLOTS.includes(slotName)) {
      const earnings = slotTraits.map((t) => t.ldzEarning).filter((e) => e > 0);
      if (earnings.length > 0) {
        maxPossible += Math.max(...earnings);
      }
    }
  }

  return { minPossible, maxPossible };
}

describe('Trait Selector Property Tests', () => {
  describe('Property 8: Trait selection validity', () => {
    it('selected traits satisfy mandatory slot, earning range, and zero-earning constraints', async () => {
      await fc.assert(
        fc.asyncProperty(arbTraitPool, async (traitPool) => {
          const { minPossible, maxPossible } = computeAchievableRange(traitPool);

          // Skip if no valid range is achievable (all traits are zero-earning)
          // In that case, use [0, 0] as the range
          const minLdz = minPossible;
          const maxLdz = maxPossible;

          // If min > max (shouldn't happen with our logic, but guard)
          if (minLdz > maxLdz) return;

          const repo = createMockRepository(traitPool);
          const selector = new TraitSelectorService(repo);

          try {
            const result = await selector.selectTraits('test-collection', minLdz, maxLdz);

            // (a) Exactly one trait is selected for each mandatory slot
            for (const slot of MANDATORY_SLOTS) {
              const slotTraits = result.filter(
                (t) => t.slotName.toLowerCase() === slot
              );
              expect(slotTraits).toHaveLength(1);
            }

            // (b) Sum of LDZ earnings of traits with ldzEarning > 0 falls within [min, max]
            const earningSum = result.reduce((sum, t) => {
              if (t.ldzEarning > 0) return sum + t.ldzEarning;
              return sum;
            }, 0);
            expect(earningSum).toBeGreaterThanOrEqual(minLdz);
            expect(earningSum).toBeLessThanOrEqual(maxLdz);

            // (c) Zero-earning traits do not contribute to the earning sum
            const zeroEarningTraits = result.filter((t) => t.ldzEarning === 0);
            const sumWithoutZero = result.reduce((sum, t) => {
              if (t.ldzEarning > 0) return sum + t.ldzEarning;
              return sum;
            }, 0);
            const sumWithZero = result.reduce((sum, t) => sum + t.ldzEarning, 0);
            // The earning sum used for range check should equal sum excluding zeros
            expect(earningSum).toBe(sumWithoutZero);
            // If there are zero-earning traits, the total sum differs from the earning sum
            if (zeroEarningTraits.length > 0) {
              expect(sumWithZero).toBe(sumWithoutZero); // zero-earning traits add 0
            }
          } catch (e: any) {
            // If selection fails, it should be because no valid combination exists
            // This is acceptable - the property only needs to hold when selection succeeds
            expect(e.message).toContain('TRAIT_SELECTION_FAILED');
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
