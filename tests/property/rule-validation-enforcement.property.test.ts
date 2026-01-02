/**
 * **Feature: nft-trait-marketplace, Property 4: Rule Validation Enforcement**
 * **Validates: Requirements 2.3**
 * 
 * Property: For any trait combination that violates configured rules, the system should 
 * prevent the combination and highlight conflicts
 */

import fc from 'fast-check';
import { PreviewService, TraitSelection } from '@/lib/services/preview';
import { Trait, TraitSlot } from '@/types';

describe('Rule Validation Enforcement Property Tests', () => {
  const previewService = new PreviewService();

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

  test('exclusion rules should prevent conflicting trait combinations', () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.uuid(), fc.uuid(), fc.uuid(), fc.uuid()), // slot1Id, slot2Id, trait1Id, trait2Id
        traitGen,
        traitGen,
        ([slot1Id, slot2Id, trait1Id, trait2Id], trait1Base, trait2Base) => {
          // Create slots with exclusion rule
          const slots: TraitSlot[] = [
            {
              id: slot1Id,
              name: 'Slot 1',
              layerOrder: 1,
              rulesJson: {
                exclusions: [
                  {
                    slotId: slot2Id,
                    traitIds: [trait2Id] // trait1 excludes trait2
                  }
                ]
              }
            },
            {
              id: slot2Id,
              name: 'Slot 2',
              layerOrder: 2,
              rulesJson: null
            }
          ];

          // Create traits
          const trait1: Trait = { ...trait1Base, id: trait1Id, slotId: slot1Id };
          const trait2: Trait = { ...trait2Base, id: trait2Id, slotId: slot2Id };

          // Create selection with conflicting traits
          const selectedTraits: TraitSelection = {
            [slot1Id]: trait1,
            [slot2Id]: trait2
          };

          const violations = previewService.validateTraitCombination(selectedTraits, slots);
          
          // Should detect the exclusion violation
          expect(violations.length).toBeGreaterThan(0);
          expect(violations.some(v => v.type === 'exclusion')).toBe(true);
          expect(violations.some(v => v.conflictingTraits.includes(trait1Id))).toBe(true);
          expect(violations.some(v => v.conflictingTraits.includes(trait2Id))).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('dependency rules should require specific trait combinations', () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.uuid(), fc.uuid(), fc.uuid(), fc.uuid()), // slot1Id, slot2Id, trait1Id, trait2Id
        traitGen,
        traitGen,
        ([slot1Id, slot2Id, trait1Id, trait2Id], trait1Base, trait2Base) => {
          // Create slots with dependency rule
          const slots: TraitSlot[] = [
            {
              id: slot1Id,
              name: 'Slot 1',
              layerOrder: 1,
              rulesJson: {
                dependencies: [
                  {
                    slotId: slot2Id,
                    traitIds: [trait2Id], // trait1 requires trait2
                    slotName: 'Slot 2'
                  }
                ]
              }
            },
            {
              id: slot2Id,
              name: 'Slot 2',
              layerOrder: 2,
              rulesJson: null
            }
          ];

          // Create traits
          const trait1: Trait = { ...trait1Base, id: trait1Id, slotId: slot1Id };
          const trait2: Trait = { ...trait2Base, id: trait2Id, slotId: slot2Id };

          // Create selection with trait1 but without required trait2
          const selectedTraits: TraitSelection = {
            [slot1Id]: trait1
            // Missing trait2 which is required
          };

          const violations = previewService.validateTraitCombination(selectedTraits, slots);
          
          // Should detect the dependency violation
          expect(violations.length).toBeGreaterThan(0);
          expect(violations.some(v => v.type === 'dependency')).toBe(true);
          expect(violations.some(v => v.conflictingTraits.includes(trait1Id))).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('valid trait combinations should pass validation', () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.uuid(), fc.uuid(), fc.uuid(), fc.uuid()), // slot1Id, slot2Id, trait1Id, trait2Id
        traitGen,
        traitGen,
        ([slot1Id, slot2Id, trait1Id, trait2Id], trait1Base, trait2Base) => {
          // Create slots with no conflicting rules
          const slots: TraitSlot[] = [
            {
              id: slot1Id,
              name: 'Slot 1',
              layerOrder: 1,
              rulesJson: null // No rules
            },
            {
              id: slot2Id,
              name: 'Slot 2',
              layerOrder: 2,
              rulesJson: null // No rules
            }
          ];

          // Create traits
          const trait1: Trait = { ...trait1Base, id: trait1Id, slotId: slot1Id };
          const trait2: Trait = { ...trait2Base, id: trait2Id, slotId: slot2Id };

          // Create valid selection
          const selectedTraits: TraitSelection = {
            [slot1Id]: trait1,
            [slot2Id]: trait2
          };

          const violations = previewService.validateTraitCombination(selectedTraits, slots);
          
          // Should have no violations
          expect(violations).toHaveLength(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('satisfied dependencies should pass validation', () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.uuid(), fc.uuid(), fc.uuid(), fc.uuid()), // slot1Id, slot2Id, trait1Id, trait2Id
        traitGen,
        traitGen,
        ([slot1Id, slot2Id, trait1Id, trait2Id], trait1Base, trait2Base) => {
          // Create slots with dependency rule
          const slots: TraitSlot[] = [
            {
              id: slot1Id,
              name: 'Slot 1',
              layerOrder: 1,
              rulesJson: {
                dependencies: [
                  {
                    slotId: slot2Id,
                    traitIds: [trait2Id], // trait1 requires trait2
                    slotName: 'Slot 2'
                  }
                ]
              }
            },
            {
              id: slot2Id,
              name: 'Slot 2',
              layerOrder: 2,
              rulesJson: null
            }
          ];

          // Create traits
          const trait1: Trait = { ...trait1Base, id: trait1Id, slotId: slot1Id };
          const trait2: Trait = { ...trait2Base, id: trait2Id, slotId: slot2Id };

          // Create selection with both traits (dependency satisfied)
          const selectedTraits: TraitSelection = {
            [slot1Id]: trait1,
            [slot2Id]: trait2 // Required trait is present
          };

          const violations = previewService.validateTraitCombination(selectedTraits, slots);
          
          // Should have no violations since dependency is satisfied
          expect(violations).toHaveLength(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('empty trait selection should pass validation', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 20 }),
            layerOrder: fc.integer({ min: 1, max: 10 }),
            rulesJson: fc.oneof(
              fc.constant(null),
              fc.record({
                exclusions: fc.array(fc.record({
                  slotId: fc.uuid(),
                  traitIds: fc.array(fc.uuid())
                })),
                dependencies: fc.array(fc.record({
                  slotId: fc.uuid(),
                  traitIds: fc.array(fc.uuid()),
                  slotName: fc.string()
                }))
              })
            )
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (slots: TraitSlot[]) => {
          const emptySelection: TraitSelection = {};
          const violations = previewService.validateTraitCombination(emptySelection, slots);
          
          // Empty selection should never have violations
          expect(violations).toHaveLength(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('generatePreview should correctly identify invalid combinations', () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.uuid(), fc.uuid(), fc.uuid(), fc.uuid()), // slot1Id, slot2Id, trait1Id, trait2Id
        traitGen,
        traitGen,
        ([slot1Id, slot2Id, trait1Id, trait2Id], trait1Base, trait2Base) => {
          // Create slots with exclusion rule
          const slots: TraitSlot[] = [
            {
              id: slot1Id,
              name: 'Slot 1',
              layerOrder: 1,
              rulesJson: {
                exclusions: [
                  {
                    slotId: slot2Id,
                    traitIds: [trait2Id]
                  }
                ]
              }
            },
            {
              id: slot2Id,
              name: 'Slot 2',
              layerOrder: 2,
              rulesJson: null
            }
          ];

          // Create traits
          const trait1: Trait = { ...trait1Base, id: trait1Id, slotId: slot1Id };
          const trait2: Trait = { ...trait2Base, id: trait2Id, slotId: slot2Id };

          // Create conflicting selection
          const selectedTraits: TraitSelection = {
            [slot1Id]: trait1,
            [slot2Id]: trait2
          };

          const previewResult = previewService.generatePreview(selectedTraits, slots);
          
          // Should be invalid due to exclusion rule
          expect(previewResult.isValid).toBe(false);
          expect(previewResult.violations.length).toBeGreaterThan(0);
          expect(previewResult.layeredTraits.length).toBe(2); // Traits still ordered even if invalid
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});