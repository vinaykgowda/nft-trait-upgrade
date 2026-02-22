/**
 * Unit tests for ImageCompositionService format verification
 * Validates that createPreview uses PNG format and createFinalComposition uses WebP
 * Requirements: 1.1, 1.4
 */

import { ImageCompositionService } from '@/lib/services/image-composition';
import { TraitSelection } from '@/lib/services/preview';
import { TraitSlot } from '@/types';

// Mock sharp for testing
jest.mock('sharp', () => {
  const mockSharp = {
    resize: jest.fn().mockReturnThis(),
    composite: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-image-data'))
  };
  
  return jest.fn(() => mockSharp);
});

describe('ImageCompositionService Format Tests', () => {
  let compositionService: ImageCompositionService;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    compositionService = new ImageCompositionService();
    
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
  ];

  const mockTraits: TraitSelection = {
    'background-slot': {
      id: 'bg-1',
      slotId: 'background-slot',
      name: 'Blue Background',
      imageLayerUrl: 'https://example.com/bg.png',
      rarityTier: { id: 'common', name: 'Common', weight: 100, displayOrder: 1 },
      priceAmount: 100n,
      priceToken: { id: 'sol', symbol: 'SOL', decimals: 9, enabled: true },
      active: true,
    },
  };

  describe('createPreview', () => {
    it('should use PNG format for preview images', async () => {
      // Requirement 1.4: Preview images should use PNG format
      const result = await compositionService.createPreview(
        'https://example.com/base.png',
        mockTraits,
        mockSlots,
        512
      );

      expect(result.format).toBe('png');
    });

    it('should use default preview size of 512 when not specified', async () => {
      const result = await compositionService.createPreview(
        'https://example.com/base.png',
        mockTraits,
        mockSlots
      );

      expect(result.width).toBe(512);
      expect(result.height).toBe(512);
      expect(result.format).toBe('png');
    });

    it('should use custom preview size when specified', async () => {
      const result = await compositionService.createPreview(
        'https://example.com/base.png',
        mockTraits,
        mockSlots,
        256
      );

      expect(result.width).toBe(256);
      expect(result.height).toBe(256);
      expect(result.format).toBe('png');
    });

    it('should always use PNG format regardless of trait selection', async () => {
      const emptyTraits: TraitSelection = {};
      
      const result = await compositionService.createPreview(
        'https://example.com/base.png',
        emptyTraits,
        mockSlots,
        512
      );

      expect(result.format).toBe('png');
    });
  });

  describe('createFinalComposition', () => {
    it('should use WebP format for final compositions', async () => {
      // Requirement 1.1: Final compositions should use WebP format
      const result = await compositionService.createFinalComposition(
        'https://example.com/base.png',
        mockTraits,
        mockSlots
      );

      expect(result.format).toBe('webp');
    });

    it('should use 1500x1500 dimensions for final compositions', async () => {
      // Requirement 1.2: Final compositions should be 1500x1500
      const result = await compositionService.createFinalComposition(
        'https://example.com/base.png',
        mockTraits,
        mockSlots
      );

      expect(result.width).toBe(1500);
      expect(result.height).toBe(1500);
      expect(result.format).toBe('webp');
    });

    it('should always use WebP format regardless of trait selection', async () => {
      const emptyTraits: TraitSelection = {};
      
      const result = await compositionService.createFinalComposition(
        'https://example.com/base.png',
        emptyTraits,
        mockSlots
      );

      expect(result.format).toBe('webp');
    });
  });

  describe('Format Consistency', () => {
    it('should maintain different formats for preview vs final composition', async () => {
      const baseUrl = 'https://example.com/base.png';
      
      const previewResult = await compositionService.createPreview(
        baseUrl,
        mockTraits,
        mockSlots,
        512
      );
      
      const finalResult = await compositionService.createFinalComposition(
        baseUrl,
        mockTraits,
        mockSlots
      );

      // Preview should be PNG
      expect(previewResult.format).toBe('png');
      
      // Final should be WebP
      expect(finalResult.format).toBe('webp');
      
      // They should be different
      expect(previewResult.format).not.toBe(finalResult.format);
    });
  });
});
