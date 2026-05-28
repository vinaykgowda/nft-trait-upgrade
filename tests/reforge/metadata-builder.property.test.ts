import fc from 'fast-check';
import { ReforgeMetadataBuilder } from '../../src/lib/services/reforge-metadata-builder';
import { SelectedTrait } from '../../src/types/reforge';

// Feature: pv-reforge, Property 10: Metadata contains all traits

/**
 * Property 10: Metadata contains all selected traits
 *
 * For any set of selected traits from a reforge, the generated NFT metadata
 * `attributes` array must contain one entry for each selected trait with the
 * correct `trait_type` (slot name) and `value` (trait name).
 *
 * Validates: Requirements 10.1
 */
describe('Metadata Builder Property Tests', () => {
  const builder = new ReforgeMetadataBuilder();

  // Arbitrary for generating a SelectedTrait
  const selectedTraitArb: fc.Arbitrary<SelectedTrait> = fc.record({
    slotId: fc.uuid(),
    slotName: fc.string({ minLength: 1, maxLength: 50 }),
    traitId: fc.uuid(),
    traitName: fc.string({ minLength: 1, maxLength: 50 }),
    imageUrl: fc.webUrl(),
    ldzEarning: fc.float({ min: 0, max: 100, noNaN: true }),
  });

  // Arbitrary for generating an array of SelectedTraits (1 to 10 traits)
  const selectedTraitsArb: fc.Arbitrary<SelectedTrait[]> = fc.array(selectedTraitArb, {
    minLength: 1,
    maxLength: 10,
  });

  // Arbitrary for a valid image URL
  const imageUrlArb: fc.Arbitrary<string> = fc.webUrl();

  describe('Property 10: Metadata contains all selected traits', () => {
    it('attributes array must contain one entry for each selected trait with correct trait_type and value', () => {
      fc.assert(
        fc.property(
          selectedTraitsArb,
          imageUrlArb,
          (selectedTraits, imageUrl) => {
            const metadata = builder.buildMetadata(selectedTraits, imageUrl);

            // The attributes array length must equal the number of selected traits
            expect(metadata.attributes).toHaveLength(selectedTraits.length);

            // Each selected trait must have a corresponding attribute entry
            for (let i = 0; i < selectedTraits.length; i++) {
              const trait = selectedTraits[i];
              const attr = metadata.attributes[i];

              // trait_type must equal the slot name
              expect(attr.trait_type).toBe(trait.slotName);

              // value must equal the trait name
              expect(attr.value).toBe(trait.traitName);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('metadata image field must match the provided image URL', () => {
      fc.assert(
        fc.property(
          selectedTraitsArb,
          imageUrlArb,
          (selectedTraits, imageUrl) => {
            const metadata = builder.buildMetadata(selectedTraits, imageUrl);

            expect(metadata.image).toBe(imageUrl);
            expect(metadata.properties?.files?.[0]?.uri).toBe(imageUrl);
            expect(metadata.properties?.files?.[0]?.type).toBe('image/webp');
            expect(metadata.properties?.category).toBe('image');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
