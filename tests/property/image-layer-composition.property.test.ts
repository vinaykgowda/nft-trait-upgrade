/**
 * **Feature: nft-trait-marketplace, Property 12: Image Layer Composition**
 * **Validates: Requirements 11.1**
 * 
 * Property: For any final NFT image composition, trait layers should be applied 
 * according to the configured slot order to produce the correct visual result
 */

import fc from 'fast-check';
import { ImageCompositionService } from '@/lib/services/image-composition';
import { PreviewService, TraitSelection } from '@/lib/services/preview';
import { Trait, TraitSlot } from '@/types';

// Mock sharp for testing
jest.mock('sharp', () => {
  const mockSharp = {
    resize: jest.fn().mockReturnThis(),
    composite: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-image-data'))
  };
  
  return jest.fn(() => mockSharp);
});

describe('Image Layer Composition Property Tests', () => {
  let compositionService: ImageCompositionService;
  let previewService: PreviewService;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    compositionService = new ImageCompositionService();
    previewService = new PreviewService();
    
    // Create a fresh mock for each test
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    
    // Mock successful fetch responses by default
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Generator for trait slots with layer orders
  const traitSlotGen = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 20 }),
    layerOrder: fc.integer({ min: 1, max: 10 }),
    rulesJson: fc.constant(null),
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

  test('composition should apply traits in correct layer order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(traitSlotGen, { minLength: 2, maxLength: 5 }).map(slots => {
          // Ensure unique layer orders and IDs
          return slots.map((slot, index) => ({
            ...slot,
            id: `slot-${index}`,
            layerOrder: index + 1
          }));
        }),
        fc.array(traitGen, { minLength: 1, maxLength: 5 }),
        fc.webUrl(), // base image URL
        async (slots: TraitSlot[], traits: Trait[], baseImageUrl: string) => {
          // Reset mock for this test iteration
          mockFetch.mockClear();
          mockFetch.mockResolvedValue({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
          });

          // Create trait selection by assigning traits to slots
          const selectedTraits: TraitSelection = {};
          
          traits.forEach((trait, index) => {
            const slotIndex = index % slots.length;
            const slot = slots[slotIndex];
            selectedTraits[slot.id] = { ...trait, slotId: slot.id };
          });

          // Compose the image
          const result = await compositionService.composeImage(
            baseImageUrl,
            selectedTraits,
            slots,
            { width: 256, height: 256 }
          );

          // Verify the result structure
          expect(result).toHaveProperty('imageBuffer');
          expect(result).toHaveProperty('width', 256);
          expect(result).toHaveProperty('height', 256);
          expect(result).toHaveProperty('format', 'png');
          expect(Buffer.isBuffer(result.imageBuffer)).toBe(true);

          // Verify that traits were processed in the correct order
          // by checking the order of fetch calls
          const fetchCalls = mockFetch.mock.calls;
          
          // First call should be base image
          expect(fetchCalls[0][0]).toBe(baseImageUrl);
          
          // Subsequent calls should be traits in layer order
          const orderedTraits = previewService.orderTraitsByLayer(selectedTraits, slots);
          const expectedTraitUrls = orderedTraits.map(trait => trait.imageLayerUrl);
          
          const actualTraitUrls = fetchCalls.slice(1).map(call => call[0]);
          expect(actualTraitUrls).toEqual(expectedTraitUrls);

          return true;
        }
      ),
      { numRuns: 20 } // Reduced for faster testing
    );
  });

  test('composition should handle empty trait selection', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(traitSlotGen, { minLength: 1, maxLength: 3 }),
        fc.webUrl(),
        async (slots: TraitSlot[], baseImageUrl: string) => {
          // Reset mock for this test iteration
          mockFetch.mockClear();
          mockFetch.mockResolvedValue({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
          });

          const emptySelection: TraitSelection = {};

          const result = await compositionService.composeImage(
            baseImageUrl,
            emptySelection,
            slots
          );

          // Should still produce a valid result with just the base image
          expect(result).toHaveProperty('imageBuffer');
          expect(Buffer.isBuffer(result.imageBuffer)).toBe(true);
          
          // Only base image should be fetched
          const fetchCalls = mockFetch.mock.calls;
          expect(fetchCalls).toHaveLength(1);
          expect(fetchCalls[0][0]).toBe(baseImageUrl);

          return true;
        }
      ),
      { numRuns: 20 } // Reduced for faster testing
    );
  });

  test('composition should preserve image dimensions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(traitSlotGen, { minLength: 1, maxLength: 3 }),
        fc.array(traitGen, { minLength: 1, maxLength: 3 }),
        fc.webUrl(),
        fc.integer({ min: 128, max: 1024 }),
        fc.integer({ min: 128, max: 1024 }),
        async (slots: TraitSlot[], traits: Trait[], baseImageUrl: string, width: number, height: number) => {
          // Reset mock for this test iteration
          mockFetch.mockClear();
          mockFetch.mockResolvedValue({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
          });

          const selectedTraits: TraitSelection = {};
          
          traits.forEach((trait, index) => {
            const slotIndex = index % slots.length;
            const slot = slots[slotIndex];
            selectedTraits[slot.id] = { ...trait, slotId: slot.id };
          });

          const result = await compositionService.composeImage(
            baseImageUrl,
            selectedTraits,
            slots,
            { width, height }
          );

          expect(result.width).toBe(width);
          expect(result.height).toBe(height);

          return true;
        }
      ),
      { numRuns: 20 } // Reduced for faster testing
    );
  });

  test('composition should handle different output formats', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(traitSlotGen, { minLength: 1, maxLength: 2 }),
        fc.array(traitGen, { minLength: 1, maxLength: 2 }),
        fc.webUrl(),
        fc.constantFrom('png', 'jpeg'),
        async (slots: TraitSlot[], traits: Trait[], baseImageUrl: string, format: 'png' | 'jpeg') => {
          // Reset mock for this test iteration
          mockFetch.mockClear();
          mockFetch.mockResolvedValue({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
          });

          const selectedTraits: TraitSelection = {};
          
          traits.forEach((trait, index) => {
            const slotIndex = index % slots.length;
            const slot = slots[slotIndex];
            selectedTraits[slot.id] = { ...trait, slotId: slot.id };
          });

          const result = await compositionService.composeImage(
            baseImageUrl,
            selectedTraits,
            slots,
            { format }
          );

          expect(result.format).toBe(format);

          return true;
        }
      ),
      { numRuns: 20 } // Reduced for faster testing
    );
  });

  test('trait validation should identify inaccessible images', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(traitGen, { minLength: 1, maxLength: 5 }),
        async (traits: Trait[]) => {
          // Reset mock for this test iteration
          mockFetch.mockClear();

          // Mock some traits to fail loading
          const failingTraitIndex = Math.floor(Math.random() * traits.length);
          
          mockFetch.mockImplementation((url: string) => {
            if (url === traits[failingTraitIndex].imageLayerUrl) {
              return Promise.resolve({ ok: false, statusText: 'Not Found' });
            }
            return Promise.resolve({ ok: true });
          });

          const validation = await compositionService.validateTraitImages(traits);

          if (traits.length === 1 && failingTraitIndex === 0) {
            expect(validation.valid).toBe(false);
            expect(validation.errors).toHaveLength(1);
          } else if (failingTraitIndex < traits.length) {
            expect(validation.valid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
          }

          return true;
        }
      ),
      { numRuns: 20 } // Reduced for faster testing
    );
  });
});