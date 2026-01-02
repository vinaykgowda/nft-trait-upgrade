import { CoreAsset, Trait } from '@/types';
import { NFTMetadata, IrysUploadService } from './irys-upload';
import { TraitSelection } from './preview';

export interface MetadataBuilderOptions {
  name?: string;
  description?: string;
  externalUrl?: string;
  additionalAttributes?: Array<{
    trait_type: string;
    value: string;
  }>;
}

export class MetadataService {
  private irysService: IrysUploadService;

  constructor(irysService: IrysUploadService) {
    this.irysService = irysService;
  }

  /**
   * Builds NFT metadata JSON with trait attributes
   */
  buildMetadata(
    baseAsset: CoreAsset,
    appliedTraits: Trait[],
    options: MetadataBuilderOptions = {}
  ): Omit<NFTMetadata, 'image'> {
    const {
      name = baseAsset.name,
      description = `${baseAsset.name} with custom traits`,
      externalUrl,
      additionalAttributes = []
    } = options;

    // Build attributes from applied traits
    const traitAttributes = appliedTraits.map(trait => ({
      trait_type: trait.rarityTier.name, // Use rarity tier as trait type
      value: trait.name
    }));

    // Combine with existing attributes and additional ones
    const existingAttributes = baseAsset.attributes || [];
    const allAttributes = [
      ...existingAttributes,
      ...traitAttributes,
      ...additionalAttributes
    ];

    return {
      name,
      description,
      external_url: externalUrl,
      attributes: allAttributes,
      properties: {
        files: [], // Will be populated when image is uploaded
        category: 'image'
      }
    };
  }

  /**
   * Creates complete metadata with trait information
   */
  buildTraitMetadata(
    baseAsset: CoreAsset,
    selectedTraits: TraitSelection,
    options: MetadataBuilderOptions = {}
  ): Omit<NFTMetadata, 'image'> {
    const appliedTraits = Object.values(selectedTraits);
    return this.buildMetadata(baseAsset, appliedTraits, options);
  }

  /**
   * Uploads metadata to Irys and returns the URI
   */
  async uploadMetadata(
    imageBuffer: Buffer,
    baseAsset: CoreAsset,
    appliedTraits: Trait[],
    options: MetadataBuilderOptions = {}
  ): Promise<{ imageUri: string; metadataUri: string }> {
    try {
      // Build metadata
      const metadata = this.buildMetadata(baseAsset, appliedTraits, options);

      // Upload image and metadata to Irys
      const { imageResult, metadataResult } = await this.irysService.uploadImageAndMetadata(
        imageBuffer,
        metadata,
        'image/png'
      );

      return {
        imageUri: imageResult.url,
        metadataUri: metadataResult.url
      };
    } catch (error) {
      console.error('Error uploading metadata:', error);
      throw new Error(`Metadata upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Updates existing metadata with new traits
   */
  async updateMetadata(
    existingMetadataUri: string,
    imageBuffer: Buffer,
    baseAsset: CoreAsset,
    newTraits: Trait[],
    options: MetadataBuilderOptions = {}
  ): Promise<{ imageUri: string; metadataUri: string }> {
    try {
      // Fetch existing metadata to preserve other properties
      const existingResponse = await fetch(existingMetadataUri);
      let existingMetadata: Partial<NFTMetadata> = {};
      
      if (existingResponse.ok) {
        existingMetadata = await existingResponse.json();
      }

      // Build new metadata, preserving existing properties where appropriate
      const newMetadata = this.buildMetadata(baseAsset, newTraits, {
        ...options,
        name: options.name || existingMetadata.name || baseAsset.name,
        description: options.description || existingMetadata.description,
        externalUrl: options.externalUrl || existingMetadata.external_url
      });

      // Upload new image and metadata
      const { imageResult, metadataResult } = await this.irysService.uploadImageAndMetadata(
        imageBuffer,
        newMetadata,
        'image/png'
      );

      return {
        imageUri: imageResult.url,
        metadataUri: metadataResult.url
      };
    } catch (error) {
      console.error('Error updating metadata:', error);
      throw new Error(`Metadata update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates metadata structure
   */
  validateMetadata(metadata: NFTMetadata): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!metadata.name || metadata.name.trim().length === 0) {
      errors.push('Metadata must have a non-empty name');
    }

    if (!metadata.image || !this.isValidUrl(metadata.image)) {
      errors.push('Metadata must have a valid image URL');
    }

    if (!metadata.attributes || !Array.isArray(metadata.attributes)) {
      errors.push('Metadata must have an attributes array');
    }

    if (!metadata.properties || !metadata.properties.category) {
      errors.push('Metadata must have properties with category');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Extracts trait information from metadata
   */
  extractTraitsFromMetadata(metadata: NFTMetadata): Array<{ type: string; value: string }> {
    if (!metadata.attributes) {
      return [];
    }

    return metadata.attributes.map(attr => ({
      type: attr.trait_type,
      value: attr.value
    }));
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}