import sharp from 'sharp';
import { Trait, TraitSlot, CoreAsset } from '@/types';
import { PreviewService, TraitSelection } from './preview';

export interface CompositionResult {
  imageBuffer: Buffer;
  width: number;
  height: number;
  format: 'png' | 'jpeg';
}

export interface CompositionOptions {
  width?: number;
  height?: number;
  format?: 'png' | 'jpeg';
  quality?: number; // For JPEG
}

export class ImageCompositionService {
  private previewService: PreviewService;

  constructor() {
    this.previewService = new PreviewService();
  }

  /**
   * Composes a final NFT image by layering trait images according to slot order
   */
  async composeImage(
    baseImageUrl: string,
    selectedTraits: TraitSelection,
    slots: TraitSlot[],
    options: CompositionOptions = {},
    baseUrl?: string
  ): Promise<CompositionResult> {
    const {
      width = 512,
      height = 512,
      format = 'png',
      quality = 90
    } = options;

    try {
      console.log('🎨 Starting image composition:', {
        baseImageUrl,
        selectedTraitsCount: Object.keys(selectedTraits).length,
        selectedTraitsKeys: Object.keys(selectedTraits),
        slotsCount: slots.length,
        dimensions: `${width}x${height}`,
        format
      });

      // Handle transparent base case
      let compositeImage: sharp.Sharp;
      
      if (baseImageUrl === '/api/transparent-base' || baseImageUrl.includes('transparent-base')) {
        // Create transparent base
        compositeImage = sharp({
          create: {
            width,
            height,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          }
        });
      } else {
        // Convert relative URLs to absolute URLs for base image
        let absoluteBaseImageUrl = baseImageUrl;
        if (baseImageUrl.startsWith('/')) {
          const fallbackBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          absoluteBaseImageUrl = `${baseUrl || fallbackBaseUrl}${baseImageUrl}`;
        }

        // Fetch base image
        const baseImageResponse = await fetch(absoluteBaseImageUrl);
        if (!baseImageResponse.ok) {
          throw new Error(`Failed to fetch base image: ${baseImageResponse.statusText}`);
        }
        const baseImageBuffer = Buffer.from(await baseImageResponse.arrayBuffer());
        compositeImage = sharp(baseImageBuffer).resize(width, height);
      }

      // Get traits ordered by layer
      const orderedTraits = this.previewService.orderTraitsByLayer(selectedTraits, slots);

      console.log(`Composing image with ${orderedTraits.length} traits in order:`, 
        orderedTraits.map(t => `${t.name} (layer ${slots.find(s => s.id === t.slotId)?.layerOrder})`));

      // Prepare composite layers
      const layers: sharp.OverlayOptions[] = [];

      // Layer traits in order
      for (const trait of orderedTraits) {
        try {
          // Convert relative URLs to absolute URLs
          let traitImageUrl = trait.imageLayerUrl;
          if (traitImageUrl.startsWith('/')) {
            // Get the base URL from environment or construct it
            const fallbackBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            traitImageUrl = `${baseUrl || fallbackBaseUrl}${traitImageUrl}`;
          }

          console.log(`Fetching trait image: ${traitImageUrl}`);
          
          // Add timeout to prevent hanging
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          try {
            const traitResponse = await fetch(traitImageUrl, { 
              signal: controller.signal,
              headers: {
                'User-Agent': 'NFT-Trait-Marketplace/1.0'
              }
            });
            clearTimeout(timeoutId);
            
            if (!traitResponse.ok) {
              console.error(`Failed to fetch trait image: ${traitImageUrl} - Status: ${traitResponse.status}`);
              continue;
            }
            
            const traitBuffer = Buffer.from(await traitResponse.arrayBuffer());
            console.log(`✅ Fetched trait image: ${trait.name} (${traitBuffer.length} bytes)`);
            
            // Resize trait to match dimensions and ensure it has alpha channel
            const resizedTraitBuffer = await sharp(traitBuffer)
              .resize(width, height)
              .png()
              .toBuffer();

            layers.push({
              input: resizedTraitBuffer,
              top: 0,
              left: 0
            });
          } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
              console.error(`Timeout fetching trait image: ${traitImageUrl}`);
            } else {
              console.error(`Network error fetching trait image: ${traitImageUrl}`, fetchError);
            }
            continue;
          }
        } catch (error) {
          console.error(`Failed to load trait image: ${trait.imageLayerUrl}`, error);
          // Continue with other traits even if one fails
        }
      }

      // Apply all layers at once
      if (layers.length > 0) {
        console.log(`🎨 Applying ${layers.length} trait layers to composition`);
        compositeImage = compositeImage.composite(layers);
      } else {
        console.warn('⚠️ No trait layers to apply - using base image only');
      }

      // Generate final buffer
      console.log(`🎨 Generating final ${format} image buffer...`);
      let imageBuffer: Buffer;
      if (format === 'jpeg') {
        imageBuffer = await compositeImage.jpeg({ quality }).toBuffer();
      } else {
        imageBuffer = await compositeImage.png().toBuffer();
      }

      console.log(`✅ Image composition completed: ${imageBuffer.length} bytes, ${width}x${height} ${format}`);

      return {
        imageBuffer,
        width,
        height,
        format
      };
    } catch (error) {
      console.error('Error composing image:', error);
      throw new Error(`Image composition failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates that all trait images are accessible before composition
   */
  async validateTraitImages(traits: Trait[]): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const trait of traits) {
      try {
        const response = await fetch(trait.imageLayerUrl);
        if (!response.ok) {
          errors.push(`Failed to load trait ${trait.name} (${trait.id}): ${response.statusText}`);
        }
      } catch (error) {
        errors.push(`Failed to load trait ${trait.name} (${trait.id}): ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Creates a preview composition for client-side display (smaller for performance)
   */
  async createPreview(
    baseImageUrl: string,
    selectedTraits: TraitSelection,
    slots: TraitSlot[],
    previewSize: number = 512,
    baseUrl?: string
  ): Promise<CompositionResult> {
    return this.composeImage(baseImageUrl, selectedTraits, slots, {
      width: previewSize,
      height: previewSize,
      format: 'png'
    }, baseUrl);
  }

  /**
   * Creates a high-quality final composition for NFT metadata
   * Fixed at 1500x1500px JPEG 90% quality for optimal file size
   */
  async createFinalComposition(
    baseImageUrl: string,
    selectedTraits: TraitSelection,
    slots: TraitSlot[],
    baseUrl?: string
  ): Promise<CompositionResult> {
    console.log('🎨 Creating final composition:', {
      baseImageUrl,
      selectedTraits: Object.keys(selectedTraits),
      traitCount: Object.keys(selectedTraits).length,
      slots: slots.length
    });

    return this.composeImage(baseImageUrl, selectedTraits, slots, {
      width: 1500,
      height: 1500,
      format: 'jpeg',
      quality: 90
    }, baseUrl);
  }

  /**
   * Gets the standard NFT image dimensions and formats
   */
  static getStandardDimensions() {
    return {
      preview: { width: 512, height: 512, format: 'png' },
      final: { width: 1500, height: 1500, format: 'jpeg', quality: 90 }
    };
  }

}