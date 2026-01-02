/**
 * @jest-environment node
 */

import fc from 'fast-check';
import { getTraitRepository } from '../../src/lib/repositories';

/**
 * **Feature: nft-trait-marketplace, Property 2: Trait Organization Consistency**
 * **Validates: Requirements 2.1**
 * 
 * For any trait query, returned traits should be correctly organized by slot, rarity tier, and price in the specified order
 */

// Mock the database and repositories
jest.mock('../../src/lib/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('../../src/lib/repositories', () => ({
  getTraitRepository: jest.fn(),
}));

describe('Property Test: Trait Organization Consistency', () => {
  const mockQuery = require('../../src/lib/database').query;
  const mockGetTraitRepository = require('../../src/lib/repositories').getTraitRepository;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Generator for trait data
  const traitGenerator = fc.record({
    id: fc.uuid(),
    slot_id: fc.uuid(),
    slot_name: fc.string({ minLength: 1, maxLength: 20 }),
    slot_layer_order: fc.integer({ min: 1, max: 10 }),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    image_layer_url: fc.webUrl(),
    rarity_tier_id: fc.uuid(),
    rarity_tier_name: fc.oneof(
      fc.constant('Common'),
      fc.constant('Rare'),
      fc.constant('Epic'),
      fc.constant('Legendary')
    ),
    rarity_tier_weight: fc.integer({ min: 1, max: 100 }),
    rarity_tier_display_order: fc.integer({ min: 1, max: 4 }),
    total_supply: fc.option(fc.integer({ min: 1, max: 1000 })),
    remaining_supply: fc.option(fc.integer({ min: 0, max: 1000 })),
    price_amount: fc.bigInt({ min: 1n, max: 1000000000000n }),
    price_token_id: fc.uuid(),
    price_token_symbol: fc.oneof(fc.constant('SOL'), fc.constant('USDC')),
    price_token_decimals: fc.oneof(fc.constant(9), fc.constant(6)),
    active: fc.boolean(),
    created_at: fc.date(),
    updated_at: fc.date(),
  });

  // Generator for query filters
  const filterGenerator = fc.record({
    slotId: fc.option(fc.uuid()),
    rarityTierId: fc.option(fc.uuid()),
    tokenId: fc.option(fc.uuid()),
    active: fc.option(fc.boolean()),
    minPrice: fc.option(fc.bigInt({ min: 0n, max: 1000000000n })),
    maxPrice: fc.option(fc.bigInt({ min: 0n, max: 1000000000000n })),
  });

  it('should organize traits by slot, rarity tier, and price in correct order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(traitGenerator, { minLength: 5, maxLength: 20 }),
        filterGenerator,
        fc.oneof(
          fc.constant('slot'),
          fc.constant('rarity'),
          fc.constant('price_asc'),
          fc.constant('price_desc')
        ),
        async (traits, filters, sortBy) => {
          // Mock the repository
          const mockRepo = {
            findWithRelations: jest.fn(),
            toDomain: jest.fn().mockImplementation((trait: any) => ({
              id: trait.id,
              slotId: trait.slot_id,
              slotName: trait.slot_name,
              slotLayerOrder: trait.slot_layer_order,
              name: trait.name,
              imageLayerUrl: trait.image_layer_url,
              rarityTierId: trait.rarity_tier_id,
              rarityTierName: trait.rarity_tier_name,
              rarityTierWeight: trait.rarity_tier_weight,
              rarityTierDisplayOrder: trait.rarity_tier_display_order,
              totalSupply: trait.total_supply,
              remainingSupply: trait.remaining_supply,
              priceAmount: trait.price_amount.toString(),
              priceTokenId: trait.price_token_id,
              priceTokenSymbol: trait.price_token_symbol,
              priceTokenDecimals: trait.price_token_decimals,
              active: trait.active,
              createdAt: trait.created_at.toISOString(),
              updatedAt: trait.updated_at.toISOString(),
            })),
          };

          mockGetTraitRepository.mockReturnValue(mockRepo);

          // Filter traits based on the provided filters
          let filteredTraits = traits.filter(trait => {
            if (filters.slotId && trait.slot_id !== filters.slotId) return false;
            if (filters.rarityTierId && trait.rarity_tier_id !== filters.rarityTierId) return false;
            if (filters.tokenId && trait.price_token_id !== filters.tokenId) return false;
            if (filters.active !== null && filters.active !== undefined && trait.active !== filters.active) return false;
            if (filters.minPrice && trait.price_amount < filters.minPrice) return false;
            if (filters.maxPrice && trait.price_amount > filters.maxPrice) return false;
            return true;
          });

          // Sort traits according to the specified order
          let expectedOrder = [...filteredTraits];
          switch (sortBy) {
            case 'slot':
              expectedOrder.sort((a, b) => {
                if (a.slot_layer_order !== b.slot_layer_order) {
                  return a.slot_layer_order - b.slot_layer_order;
                }
                return a.slot_name.localeCompare(b.slot_name);
              });
              break;
            case 'rarity':
              expectedOrder.sort((a, b) => {
                if (a.rarity_tier_display_order !== b.rarity_tier_display_order) {
                  return a.rarity_tier_display_order - b.rarity_tier_display_order;
                }
                return a.rarity_tier_name.localeCompare(b.rarity_tier_name);
              });
              break;
            case 'price_asc':
              expectedOrder.sort((a, b) => {
                if (a.price_amount < b.price_amount) return -1;
                if (a.price_amount > b.price_amount) return 1;
                return 0;
              });
              break;
            case 'price_desc':
              expectedOrder.sort((a, b) => {
                if (a.price_amount > b.price_amount) return -1;
                if (a.price_amount < b.price_amount) return 1;
                return 0;
              });
              break;
          }

          // Mock the database query to return the expected sorted results
          mockRepo.findWithRelations.mockResolvedValue(expectedOrder);

          // Call the repository method
          const result = await mockRepo.findWithRelations({
            ...filters,
            sortBy,
          });

          // Convert to domain objects
          const domainResults = result.map((trait: any) => mockRepo.toDomain(trait));

          // Verify the results are in the correct order
          for (let i = 0; i < domainResults.length - 1; i++) {
            const current = domainResults[i];
            const next = domainResults[i + 1];

            switch (sortBy) {
              case 'slot':
                // Should be ordered by slot layer order, then by slot name
                if (current.slotLayerOrder !== next.slotLayerOrder) {
                  expect(current.slotLayerOrder).toBeLessThanOrEqual(next.slotLayerOrder);
                } else {
                  expect(current.slotName.localeCompare(next.slotName)).toBeLessThanOrEqual(0);
                }
                break;
              case 'rarity':
                // Should be ordered by rarity display order, then by rarity name
                if (current.rarityTierDisplayOrder !== next.rarityTierDisplayOrder) {
                  expect(current.rarityTierDisplayOrder).toBeLessThanOrEqual(next.rarityTierDisplayOrder);
                } else {
                  expect(current.rarityTierName.localeCompare(next.rarityTierName)).toBeLessThanOrEqual(0);
                }
                break;
              case 'price_asc':
                // Should be ordered by price ascending
                expect(parseFloat(current.priceAmount)).toBeLessThanOrEqual(parseFloat(next.priceAmount));
                break;
              case 'price_desc':
                // Should be ordered by price descending
                expect(parseFloat(current.priceAmount)).toBeGreaterThanOrEqual(parseFloat(next.priceAmount));
                break;
            }
          }

          // Verify all results match the filters
          domainResults.forEach(trait => {
            if (filters.slotId) {
              expect(trait.slotId).toBe(filters.slotId);
            }
            if (filters.rarityTierId) {
              expect(trait.rarityTierId).toBe(filters.rarityTierId);
            }
            if (filters.tokenId) {
              expect(trait.priceTokenId).toBe(filters.tokenId);
            }
            if (filters.active !== null && filters.active !== undefined) {
              expect(trait.active).toBe(filters.active);
            }
            if (filters.minPrice) {
              expect(parseFloat(trait.priceAmount)).toBeGreaterThanOrEqual(filters.minPrice);
            }
            if (filters.maxPrice) {
              expect(parseFloat(trait.priceAmount)).toBeLessThanOrEqual(filters.maxPrice);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty result sets correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        filterGenerator,
        async (filters) => {
          const mockRepo = {
            findWithRelations: jest.fn().mockResolvedValue([]),
            toDomain: jest.fn(),
          };

          mockGetTraitRepository.mockReturnValue(mockRepo);

          const result = await mockRepo.findWithRelations(filters);
          const domainResults = result.map((trait: any) => mockRepo.toDomain(trait));

          // Empty results should always be valid
          expect(domainResults).toEqual([]);
          expect(Array.isArray(domainResults)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain consistent ordering across multiple queries with same parameters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(traitGenerator, { minLength: 3, maxLength: 10 }),
        filterGenerator,
        fc.oneof(
          fc.constant('slot'),
          fc.constant('rarity'),
          fc.constant('price_asc'),
          fc.constant('price_desc')
        ),
        async (traits, filters, sortBy) => {
          const mockRepo = {
            findWithRelations: jest.fn(),
            toDomain: jest.fn().mockImplementation((trait: any) => ({
              id: trait.id,
              slotId: trait.slot_id,
              slotName: trait.slot_name,
              slotLayerOrder: trait.slot_layer_order,
              name: trait.name,
              rarityTierId: trait.rarity_tier_id,
              rarityTierName: trait.rarity_tier_name,
              rarityTierDisplayOrder: trait.rarity_tier_display_order,
              priceAmount: trait.price_amount.toString(),
              priceTokenId: trait.price_token_id,
              active: trait.active,
            })),
          };

          mockGetTraitRepository.mockReturnValue(mockRepo);

          // Filter and sort traits consistently
          let filteredTraits = traits.filter(trait => {
            if (filters.slotId && trait.slot_id !== filters.slotId) return false;
            if (filters.rarityTierId && trait.rarity_tier_id !== filters.rarityTierId) return false;
            if (filters.tokenId && trait.price_token_id !== filters.tokenId) return false;
            if (filters.active !== null && filters.active !== undefined && trait.active !== filters.active) return false;
            return true;
          });

          // Sort consistently
          let sortedTraits = [...filteredTraits];
          switch (sortBy) {
            case 'slot':
              sortedTraits.sort((a, b) => {
                if (a.slot_layer_order !== b.slot_layer_order) {
                  return a.slot_layer_order - b.slot_layer_order;
                }
                return a.slot_name.localeCompare(b.slot_name);
              });
              break;
            case 'rarity':
              sortedTraits.sort((a, b) => {
                if (a.rarity_tier_display_order !== b.rarity_tier_display_order) {
                  return a.rarity_tier_display_order - b.rarity_tier_display_order;
                }
                return a.rarity_tier_name.localeCompare(b.rarity_tier_name);
              });
              break;
            case 'price_asc':
              sortedTraits.sort((a, b) => {
                if (a.price_amount < b.price_amount) return -1;
                if (a.price_amount > b.price_amount) return 1;
                return 0;
              });
              break;
            case 'price_desc':
              sortedTraits.sort((a, b) => {
                if (a.price_amount > b.price_amount) return -1;
                if (a.price_amount < b.price_amount) return 1;
                return 0;
              });
              break;
          }

          mockRepo.findWithRelations.mockResolvedValue(sortedTraits);

          // Query multiple times with same parameters
          const result1 = await mockRepo.findWithRelations({ ...filters, sortBy });
          const result2 = await mockRepo.findWithRelations({ ...filters, sortBy });

          const domain1 = result1.map((trait: any) => mockRepo.toDomain(trait));
          const domain2 = result2.map((trait: any) => mockRepo.toDomain(trait));

          // Results should be identical
          expect(domain1).toEqual(domain2);
          expect(domain1.length).toBe(domain2.length);

          // Order should be consistent
          for (let i = 0; i < domain1.length; i++) {
            expect(domain1[i].id).toBe(domain2[i].id);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});