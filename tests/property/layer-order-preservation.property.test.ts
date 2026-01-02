/**
 * **Feature: nft-trait-marketplace, Property 3: Layer Order Preservation**
 * **Validates: Requirements 2.2**
 * 
 * Property: For any NFT and selected traits, the preview should apply trait layers 
 * according to the configured slot layer order
 */

import fc from 'fast-check';
import { PreviewService, TraitSelection } from '@/lib/services/preview';
import { Trait, TraitSlot } from '@/types';

describe('Layer Order Preservation Property Tests', () => {
  const previewService = new PreviewService();

  // Generator for trait slots with layer orders
  const traitSlotGen = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 20 }),
    layerOrder: fc.integer({ min: 1, max: 10 }),
    rulesJson: fc.constant(null), // No rules for this test
  });

  // Generator for traits
  const traitGen = fc.record({
    id: fc.uuid(),
    slotId: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 30 }),
    imageLayerUrl: fc.webUrl(),
    rarityTier: fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 20 }),
      weight: fc.integer({ min: 1, max: 100 }),
      displayOrder: fc.integer({ min: 1, max: 10 }),
    }),
    totalSupply: fc.option(fc.integer({ min: 1, max: 1000 })),
    remainingSupply: fc.option(fc.integer({ min: 0, max: 1000 })),
    priceAmount: fc.bigInt({ min: 1n, max: 1000000n }),
    priceToken: fc.record({
      id: fc.uuid(),
      symbol: fc.string({ minLength: 1, maxLength: 10 }),
      mintAddress: fc.option(fc.string({ minLength: 32, maxLength: 44 })),
      decimals: fc.integer({ min: 0, max: 18 }),
      enabled: fc.constant(true),
    }),
    active: fc.constant(true),
  });

  test('traits should be ordered by slot layer order', () => {
    fc.assert(
      fc.property(
        fc.array(traitSlotGen, { minLength: 2, maxLength: 8 }).map(slots => {
          // Ensure unique layer orders and IDs
          return slots.map((slot, index) => ({
            ...slot,
            id: `slot-${index}`,
            layerOrder: index + 1
          }));
        }),
        fc.array(traitGen, { minLength: 1, maxLength: 10 }),
        (slots: TraitSlot[], traits: Trait[]) => {
          // Create trait selection by assigning traits to slots
          const selectedTraits: TraitSelection = {};
          
          // Assign each trait to a random slot
          traits.forEach((trait, index) => {
            const slotIndex = index % slots.length;
            const slot = slots[slotIndex];
            selectedTraits[slot.id] = { ...trait, slotId: slot.id };
          });

          const orderedTraits = previewService.orderTraitsByLayer(selectedTraits, slots);
          
          // Verify traits are ordered by their slot's layer order
          for (let i = 1; i < orderedTraits.length; i++) {
            const prevTrait = orderedTraits[i - 1];
            const currentTrait = orderedTraits[i];
            
            const prevSlot = slots.find(s => s.id === prevTrait.slotId);
            const currentSlot = slots.find(s => s.id === currentTrait.slotId);
            
            if (prevSlot && currentSlot) {
              // Previous trait's layer order should be <= current trait's layer order
              expect(prevSlot.layerOrder).toBeLessThanOrEqual(currentSlot.layerOrder);
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('all selected traits should be included in ordered result', () => {
    fc.assert(
      fc.property(
        fc.array(traitSlotGen, { minLength: 1, maxLength: 5 }).map(slots => {
          return slots.map((slot, index) => ({
            ...slot,
            id: `slot-${index}`,
            layerOrder: index + 1
          }));
        }),
        fc.array(traitGen, { minLength: 1, maxLength: 5 }),
        (slots: TraitSlot[], traits: Trait[]) => {
          // Create trait selection
          const selectedTraits: TraitSelection = {};
          traits.forEach((trait, index) => {
            const slotIndex = index % slots.length;
            const slot = slots[slotIndex];
            selectedTraits[slot.id] = { ...trait, slotId: slot.id };
          });

          const orderedTraits = previewService.orderTraitsByLayer(selectedTraits, slots);
          
          // All selected traits should be in the result
          const selectedTraitIds = Object.values(selectedTraits).map(t => t.id);
          const orderedTraitIds = orderedTraits.map(t => t.id);
          
          expect(orderedTraitIds.sort()).toEqual(selectedTraitIds.sort());
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('empty selection should return empty array', () => {
    fc.assert(
      fc.property(
        fc.array(traitSlotGen, { minLength: 1, maxLength: 5 }),
        (slots: TraitSlot[]) => {
          const emptySelection: TraitSelection = {};
          const orderedTraits = previewService.orderTraitsByLayer(emptySelection, slots);
          
          expect(orderedTraits).toEqual([]);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('single trait should maintain its position', () => {
    fc.assert(
      fc.property(
        traitSlotGen,
        traitGen,
        (slot: TraitSlot, trait: Trait) => {
          const slots = [{ ...slot, id: 'test-slot' }];
          const selection: TraitSelection = { 'test-slot': { ...trait, slotId: 'test-slot' } };
          
          const orderedTraits = previewService.orderTraitsByLayer(selection, slots);
          
          expect(orderedTraits).toHaveLength(1);
          expect(orderedTraits[0].id).toBe(trait.id);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});