/**
 * Unit tests for preview rendering functionality
 * Tests image composition, layer ordering, and rule validation
 * Requirements: 2.2, 2.3, 2.4
 */

import { PreviewService, TraitSelection, CanvasPreviewRenderer } from '@/lib/services/preview';
import { Trait, TraitSlot } from '@/types';

// Mock HTML Canvas API for Node.js environment
const mockCanvas = {
  width: 0,
  height: 0,
  getContext: jest.fn(() => ({
    clearRect: jest.fn(),
    drawImage: jest.fn(),
  })),
  toDataURL: jest.fn(() => 'data:image/png;base64,mock-image-data'),
};

// Mock Image constructor
global.Image = jest.fn(() => ({
  crossOrigin: '',
  onload: null,
  onerror: null,
  src: '',
})) as any;

describe('Preview Rendering Unit Tests', () => {
  let previewService: PreviewService;

  beforeEach(() => {
    previewService = new PreviewService();
    jest.clearAllMocks();
  });

  describe('PreviewService', () => {
    const mockSlots: TraitSlot[] = [
      {
        id: 'background-slot',
        name: 'Background',
        layerOrder: 1,
        rulesJson: null,
      },
      {
        id: 'base-slot',
        name: 'Base',
        layerOrder: 2,
        rulesJson: null,
      },
      {
        id: 'eyes-slot',
        name: 'Eyes',
        layerOrder: 3,
        rulesJson: {
          dependencies: [
            {
              slotId: 'base-slot',
              traitIds: [],
              slotName: 'Base'
            }
          ]
        },
      },
    ];

    const mockTraits: Trait[] = [
      {
        id: 'bg-1',
        slotId: 'background-slot',
        name: 'Blue Background',
        imageLayerUrl: 'https://example.com/bg.png',
        rarityTier: { id: 'common', name: 'Common', weight: 100, displayOrder: 1 },
        priceAmount: 100n,
        priceToken: { id: 'sol', symbol: 'SOL', decimals: 9, enabled: true },
        active: true,
      },
      {
        id: 'base-1',
        slotId: 'base-slot',
        name: 'Human Base',
        imageLayerUrl: 'https://example.com/base.png',
        rarityTier: { id: 'common', name: 'Common', weight: 100, displayOrder: 1 },
        priceAmount: 200n,
        priceToken: { id: 'sol', symbol: 'SOL', decimals: 9, enabled: true },
        active: true,
      },
      {
        id: 'eyes-1',
        slotId: 'eyes-slot',
        name: 'Blue Eyes',
        imageLayerUrl: 'https://example.com/eyes.png',
        rarityTier: { id: 'rare', name: 'Rare', weight: 50, displayOrder: 2 },
        priceAmount: 500n,
        priceToken: { id: 'sol', symbol: 'SOL', decimals: 9, enabled: true },
        active: true,
      },
    ];

    describe('orderTraitsByLayer', () => {
      test('should order traits by slot layer order', () => {
        const selection: TraitSelection = {
          'eyes-slot': mockTraits[2], // layer 3
          'background-slot': mockTraits[0], // layer 1
          'base-slot': mockTraits[1], // layer 2
        };

        const ordered = previewService.orderTraitsByLayer(selection, mockSlots);

        expect(ordered).toHaveLength(3);
        expect(ordered[0].slotId).toBe('background-slot'); // layer 1
        expect(ordered[1].slotId).toBe('base-slot'); // layer 2
        expect(ordered[2].slotId).toBe('eyes-slot'); // layer 3
      });

      test('should handle empty selection', () => {
        const selection: TraitSelection = {};
        const ordered = previewService.orderTraitsByLayer(selection, mockSlots);
        expect(ordered).toEqual([]);
      });

      test('should handle single trait', () => {
        const selection: TraitSelection = {
          'base-slot': mockTraits[1],
        };

        const ordered = previewService.orderTraitsByLayer(selection, mockSlots);
        expect(ordered).toHaveLength(1);
        expect(ordered[0].id).toBe('base-1');
      });

      test('should handle missing slot gracefully', () => {
        const selection: TraitSelection = {
          'unknown-slot': mockTraits[0],
        };

        const ordered = previewService.orderTraitsByLayer(selection, mockSlots);
        expect(ordered).toHaveLength(1);
        // Should still include the trait even if slot is not found
      });
    });

    describe('validateTraitCombination', () => {
      test('should detect exclusion violations', () => {
        const slotsWithExclusion: TraitSlot[] = [
          {
            id: 'slot-1',
            name: 'Slot 1',
            layerOrder: 1,
            rulesJson: {
              exclusions: [
                {
                  slotId: 'slot-2',
                  traitIds: ['trait-2'],
                }
              ]
            },
          },
          {
            id: 'slot-2',
            name: 'Slot 2',
            layerOrder: 2,
            rulesJson: null,
          },
        ];

        const selection: TraitSelection = {
          'slot-1': { ...mockTraits[0], id: 'trait-1', slotId: 'slot-1' },
          'slot-2': { ...mockTraits[1], id: 'trait-2', slotId: 'slot-2' },
        };

        const violations = previewService.validateTraitCombination(selection, slotsWithExclusion);
        
        expect(violations).toHaveLength(1);
        expect(violations[0].type).toBe('exclusion');
        expect(violations[0].conflictingTraits).toContain('trait-1');
        expect(violations[0].conflictingTraits).toContain('trait-2');
      });

      test('should detect dependency violations', () => {
        const selection: TraitSelection = {
          'eyes-slot': mockTraits[2], // Has dependency on base-slot
          // Missing base-slot trait
        };

        const violations = previewService.validateTraitCombination(selection, mockSlots);
        
        expect(violations).toHaveLength(1);
        expect(violations[0].type).toBe('dependency');
        expect(violations[0].conflictingTraits).toContain('eyes-1');
        expect(violations[0].message).toContain('requires a trait in Base');
      });

      test('should pass validation for valid combinations', () => {
        const selection: TraitSelection = {
          'background-slot': mockTraits[0],
          'base-slot': mockTraits[1],
          'eyes-slot': mockTraits[2], // Dependency satisfied
        };

        const violations = previewService.validateTraitCombination(selection, mockSlots);
        expect(violations).toHaveLength(0);
      });

      test('should handle empty selection', () => {
        const selection: TraitSelection = {};
        const violations = previewService.validateTraitCombination(selection, mockSlots);
        expect(violations).toHaveLength(0);
      });

      test('should handle slots without rules', () => {
        const slotsWithoutRules: TraitSlot[] = [
          {
            id: 'slot-1',
            name: 'Slot 1',
            layerOrder: 1,
            rulesJson: null,
          },
        ];

        const selection: TraitSelection = {
          'slot-1': mockTraits[0],
        };

        const violations = previewService.validateTraitCombination(selection, slotsWithoutRules);
        expect(violations).toHaveLength(0);
      });
    });

    describe('generatePreview', () => {
      test('should generate valid preview for valid combination', () => {
        const selection: TraitSelection = {
          'background-slot': mockTraits[0],
          'base-slot': mockTraits[1],
        };

        const result = previewService.generatePreview(selection, mockSlots);

        expect(result.isValid).toBe(true);
        expect(result.violations).toHaveLength(0);
        expect(result.layeredTraits).toHaveLength(2);
        expect(result.layeredTraits[0].slotId).toBe('background-slot'); // layer 1 first
        expect(result.layeredTraits[1].slotId).toBe('base-slot'); // layer 2 second
      });

      test('should generate invalid preview for rule violations', () => {
        const selection: TraitSelection = {
          'eyes-slot': mockTraits[2], // Missing required base
        };

        const result = previewService.generatePreview(selection, mockSlots);

        expect(result.isValid).toBe(false);
        expect(result.violations.length).toBeGreaterThan(0);
        expect(result.layeredTraits).toHaveLength(1);
      });
    });
  });

  describe('CanvasPreviewRenderer', () => {
    let renderer: CanvasPreviewRenderer;
    let mockContext: any;

    const testTraits: Trait[] = [
      {
        id: 'bg-1',
        slotId: 'background-slot',
        name: 'Blue Background',
        imageLayerUrl: 'https://example.com/bg.png',
        rarityTier: { id: 'common', name: 'Common', weight: 100, displayOrder: 1 },
        priceAmount: 100n,
        priceToken: { id: 'sol', symbol: 'SOL', decimals: 9, enabled: true },
        active: true,
      },
      {
        id: 'base-1',
        slotId: 'base-slot',
        name: 'Human Base',
        imageLayerUrl: 'https://example.com/base.png',
        rarityTier: { id: 'common', name: 'Common', weight: 100, displayOrder: 1 },
        priceAmount: 200n,
        priceToken: { id: 'sol', symbol: 'SOL', decimals: 9, enabled: true },
        active: true,
      },
    ];

    beforeEach(() => {
      mockContext = {
        clearRect: jest.fn(),
        drawImage: jest.fn(),
      };
      
      const canvas = {
        ...mockCanvas,
        getContext: jest.fn(() => mockContext),
      } as any;

      renderer = new CanvasPreviewRenderer(canvas);
    });

    test('should throw error if canvas context is not available', () => {
      const badCanvas = {
        getContext: jest.fn(() => null),
      } as any;

      expect(() => new CanvasPreviewRenderer(badCanvas)).toThrow('Could not get 2D context from canvas');
    });

    test('should render preview with base image and traits', async () => {
      // Mock Image loading
      const mockImage = {
        crossOrigin: '',
        onload: null,
        onerror: null,
        src: '',
      };
      
      (global.Image as jest.Mock).mockImplementation(() => mockImage);

      const baseImage = 'https://example.com/base.jpg';
      const layeredTraits = [testTraits[0], testTraits[1]];

      // Simulate successful image loading
      const renderPromise = renderer.renderPreview(baseImage, layeredTraits, 512, 512);
      
      // Trigger onload for base image
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload();
      }, 0);

      // Trigger onload for trait images
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload();
      }, 10);
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload();
      }, 20);

      const result = await renderPromise;

      expect(result).toBe('data:image/png;base64,mock-image-data');
      expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, 512, 512);
      expect(mockContext.drawImage).toHaveBeenCalledTimes(3); // base + 2 traits
    });

    test('should handle image loading errors', async () => {
      const mockImage = {
        crossOrigin: '',
        onload: null,
        onerror: null,
        src: '',
      };
      
      (global.Image as jest.Mock).mockImplementation(() => mockImage);

      const baseImage = 'https://example.com/invalid.jpg';
      const layeredTraits: Trait[] = [];

      const renderPromise = renderer.renderPreview(baseImage, layeredTraits);
      
      // Simulate image loading error
      setTimeout(() => {
        if (mockImage.onerror) mockImage.onerror(new Error('Failed to load image'));
      }, 0);

      await expect(renderPromise).rejects.toThrow();
    });

    test('should set canvas dimensions correctly', async () => {
      const canvas = {
        ...mockCanvas,
        getContext: jest.fn(() => mockContext),
      } as any;

      renderer = new CanvasPreviewRenderer(canvas);

      const mockImage = {
        crossOrigin: '',
        onload: null,
        onerror: null,
        src: '',
      };
      
      (global.Image as jest.Mock).mockImplementation(() => mockImage);

      const renderPromise = renderer.renderPreview('test.jpg', [], 256, 256);
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload();
      }, 0);

      await renderPromise;

      expect(canvas.width).toBe(256);
      expect(canvas.height).toBe(256);
    });
  });
});