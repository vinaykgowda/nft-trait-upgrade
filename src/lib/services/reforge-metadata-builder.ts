import { SelectedTrait } from '@/types/reforge';
import { NFTMetadata } from '@/types';

/**
 * ReforgeMetadataBuilder constructs NFT metadata from selected traits.
 *
 * Extracted from ReforgeService to allow independent testing and reuse.
 */
export class ReforgeMetadataBuilder {
  /**
   * Build NFT metadata from selected traits and an image URL.
   *
   * The attributes array contains one entry per selected trait with:
   * - trait_type = slot name (e.g., "Background", "Skin", "Eyes", "Mouth")
   * - value = trait name (e.g., "Blue Sky", "Green", "Laser", "Smile")
   */
  buildMetadata(
    selectedTraits: SelectedTrait[],
    imageUrl: string,
    options?: {
      name?: string;
      description?: string;
    }
  ): NFTMetadata {
    const attributes = selectedTraits.map((trait) => ({
      trait_type: trait.slotName,
      value: trait.traitName,
    }));

    return {
      name: options?.name ?? 'Reforged NFT',
      description: options?.description ?? 'Reforged via PV Reforge system',
      image: imageUrl,
      attributes,
      properties: {
        files: [{ uri: imageUrl, type: 'image/webp' }],
        category: 'image',
      },
    };
  }
}
