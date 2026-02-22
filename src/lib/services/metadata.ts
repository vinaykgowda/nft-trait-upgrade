import { CoreAsset, Trait, TraitSlot, NFTMetadata } from '@/types';
import { PinataUploadService } from './pinata-upload';
import { TraitSelection } from './preview';

export interface MetadataBuilderOptions {
  name?: string;
  description?: string;
  externalUrl?: string;
  symbol?: string;
  sellerFeeBasisPoints?: number;
  additionalAttributes?: Array<{
    trait_type: string;
    value: string;
  }>;
}

// Allowlisted domains for SSRF protection
const ALLOWED_METADATA_DOMAINS = [
  'gateway.irys.xyz',
  'arweave.net',
  'adznwylv2j3tfcl7.public.blob.vercel-storage.com', // Your Vercel Blob domain
  'devnet.irys.xyz',
  'node1.irys.xyz',
  'node2.irys.xyz',
  'gateway.pinata.cloud',
  process.env.PINATA_GATEWAY
].filter(Boolean); // Filter out undefined values

export class MetadataService {
  private pinataService: PinataUploadService;

  constructor(pinataService: PinataUploadService) {
    this.pinataService = pinataService;
  }

  /**
   * Validates URL for SSRF protection
   */
  private validateMetadataUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      
      // Only allow HTTPS
      if (parsedUrl.protocol !== 'https:') {
        console.warn('🚨 SSRF Protection: Only HTTPS URLs allowed for metadata');
        return false;
      }

      // Check if domain is allowlisted
      const isAllowed = ALLOWED_METADATA_DOMAINS.some(domain => 
        parsedUrl.hostname === domain || parsedUrl.hostname.endsWith('.' + domain)
      );

      if (!isAllowed) {
        console.warn('🚨 SSRF Protection: Domain not allowlisted:', parsedUrl.hostname);
        return false;
      }

      return true;
    } catch (error) {
      console.warn('🚨 SSRF Protection: Invalid URL format:', url);
      return false;
    }
  }

  /**
   * Builds NFT metadata JSON with trait attributes
   */
  buildMetadata(
    baseAsset: CoreAsset,
    appliedTraits: Trait[],
    traitSlots: TraitSlot[] = [],
    options: MetadataBuilderOptions = {}
  ): Omit<NFTMetadata, 'image'> {
    const {
      name = baseAsset.name,
      description = `${baseAsset.name} with custom traits`,
      externalUrl,
      symbol = baseAsset.symbol || 'NFT',
      sellerFeeBasisPoints = baseAsset.seller_fee_basis_points || 500, // 5% default royalty
      additionalAttributes = []
    } = options;

    // Build attributes from applied traits - FIXED: Use trait slot name as trait_type
    const traitAttributes = appliedTraits.map(trait => {
      // Find the slot for this trait to get the proper slot name
      const slot = traitSlots.find(s => s.id === trait.slotId);
      const slotName = slot?.name || trait.rarityTier.name; // Fallback to rarity if no slot found
      
      console.log(`🏷️ Building attribute: ${slotName} = ${trait.name}`);
      
      return {
        trait_type: slotName, // FIXED: Use slot name instead of rarity tier name
        value: trait.name     // Trait name as value
      };
    });

    // Combine with existing attributes and additional ones
    const existingAttributes = baseAsset.attributes || [];
    const allAttributes = [
      ...existingAttributes,
      ...traitAttributes,
      ...additionalAttributes
    ];

    console.log('📋 Final metadata attributes:', allAttributes);

    return {
      name,
      description,
      symbol, // FIXED: Include symbol
      seller_fee_basis_points: sellerFeeBasisPoints, // FIXED: Include royalty info
      external_url: externalUrl,
      attributes: allAttributes,
      properties: {
        files: [], // Will be populated when image is uploaded
        category: 'image',
        creators: [
          {
            address: process.env.NFT_CREATOR_ADDRESS || 'EE72RERKxoJFt61MFZSnWvztjD43zPDr2aVizkS41nLC',
            share: 100
          }
        ]
      }
    };
  }

  /**
   * Creates complete metadata with trait information
   */
  buildTraitMetadata(
    baseAsset: CoreAsset,
    selectedTraits: TraitSelection,
    traitSlots: TraitSlot[] = [],
    options: MetadataBuilderOptions = {}
  ): Omit<NFTMetadata, 'image'> {
    const appliedTraits = Object.values(selectedTraits);
    return this.buildMetadata(baseAsset, appliedTraits, traitSlots, options);
  }

  /**
   * Uploads metadata to Irys and returns the URI
   */
  async uploadMetadata(
    imageBuffer: Buffer,
    baseAsset: CoreAsset,
    appliedTraits: Trait[],
    traitSlots: TraitSlot[] = [],
    options: MetadataBuilderOptions = {}
  ): Promise<{ imageUri: string; metadataUri: string }> {
    try {
      // Build metadata with proper slot names
      const metadata = this.buildMetadata(baseAsset, appliedTraits, traitSlots, options);

      // Upload image and metadata to Pinata - Use WebP format
      const imageResult = await this.pinataService.uploadImage(imageBuffer, 'image/webp');
      
      // Update metadata with image URL
      const completeMetadata = {
        ...metadata,
        image: imageResult.url,
        properties: {
          ...(metadata.properties || {}),
          files: [
            {
              uri: imageResult.url,
              type: 'image/webp'
            },
            ...(metadata.properties?.files || [])
          ]
        }
      };
      
      const metadataResult = await this.pinataService.uploadMetadata(completeMetadata);

      console.log('✅ Metadata uploaded with proper files array:', {
        imageUri: imageResult.url,
        metadataUri: metadataResult.url,
        filesPopulated: (metadata.properties?.files?.length || 0) > 0
      });

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
   * Updates existing metadata with new traits - FIXED: SSRF protection
   */
  async updateMetadata(
    existingMetadataUri: string,
    imageBuffer: Buffer,
    baseAsset: CoreAsset,
    newTraits: Trait[],
    traitSlots: TraitSlot[] = [],
    options: MetadataBuilderOptions = {}
  ): Promise<{ imageUri: string; metadataUri: string }> {
    try {
      let existingMetadata: Partial<NFTMetadata> = {};
      
      // FIXED: SSRF protection - validate URL before fetching
      if (this.validateMetadataUrl(existingMetadataUri)) {
        console.log('🔒 Fetching existing metadata from validated URL:', existingMetadataUri);
        
        try {
          const existingResponse = await fetch(existingMetadataUri, {
            method: 'GET',
            headers: {
              'User-Agent': 'NFT-Trait-Marketplace/1.0'
            },
            // Add timeout to prevent hanging
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });
          
          if (existingResponse.ok) {
            existingMetadata = await existingResponse.json();
            console.log('✅ Successfully fetched existing metadata');
          } else {
            console.warn('⚠️ Failed to fetch existing metadata, using defaults');
          }
        } catch (fetchError) {
          console.warn('⚠️ Error fetching existing metadata, using defaults:', fetchError);
        }
      } else {
        console.warn('🚨 SSRF Protection: Blocked potentially unsafe metadata URL');
      }

      // Build new metadata with proper slot names, preserving existing properties where appropriate
      const newMetadata = this.buildMetadata(baseAsset, newTraits, traitSlots, {
        ...options,
        name: options.name || existingMetadata.name || baseAsset.name,
        description: options.description || existingMetadata.description,
        externalUrl: options.externalUrl || existingMetadata.external_url,
        symbol: options.symbol || existingMetadata.symbol || baseAsset.symbol,
        sellerFeeBasisPoints: options.sellerFeeBasisPoints || existingMetadata.seller_fee_basis_points || baseAsset.seller_fee_basis_points
      });

      // Upload new image and metadata - Use WebP format
      const imageResult = await this.pinataService.uploadImage(imageBuffer, 'image/webp');
      
      // Update metadata with image URL
      const completeNewMetadata = {
        ...newMetadata,
        image: imageResult.url,
        properties: {
          ...(newMetadata.properties || {}),
          files: [
            {
              uri: imageResult.url,
              type: 'image/webp'
            },
            ...(newMetadata.properties?.files || [])
          ]
        }
      };
      
      const metadataResult = await this.pinataService.uploadMetadata(completeNewMetadata);

      console.log('✅ Metadata updated with SSRF protection and proper format');

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
      value: String(attr.value)
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