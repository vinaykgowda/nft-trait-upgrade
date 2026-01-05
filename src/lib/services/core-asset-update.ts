import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { 
  createUmi,
  publicKey,
  some,
  none,
  Umi,
  signerIdentity,
  createSignerFromKeypair,
} from '@metaplex-foundation/umi';
import { createUmi as createUmiBundle } from '@metaplex-foundation/umi-bundle-defaults';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import {
  updateV1,
  fetchAssetV1,
  AssetV1,
  mplCore,
} from '@metaplex-foundation/mpl-core';

export interface UpdateOptions {
  name?: string;
  description?: string;
  image?: string;
  externalUrl?: string;
  attributes?: Array<{
    trait_type: string;
    value: string;
  }>;
}

export interface CoreAssetMetadata {
  name: string;
  description: string;
  symbol: string;
  seller_fee_basis_points: number;
  image: string;
  external_url?: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  properties: {
    files: Array<{
      uri: string;
      type: string;
    }>;
    category: string;
    creators: Array<{
      address: string;
      share: number;
    }>;
  };
}

export class CoreAssetUpdateService {
  private connection: Connection;
  private umi: Umi;
  private updateAuthority: Keypair;

  constructor(connection: Connection, updateAuthority: Keypair, rpcUrl?: string) {
    this.connection = connection;
    this.updateAuthority = updateAuthority;
    
    // Initialize UMI with proper bundle and Core plugin
    const umiRpcUrl = rpcUrl || connection.rpcEndpoint;
    this.umi = createUmiBundle(umiRpcUrl)
      .use(mplCore());
    
    // Set the signer identity
    const umiKeypair = fromWeb3JsKeypair(updateAuthority);
    const signer = createSignerFromKeypair(this.umi, umiKeypair);
    this.umi = this.umi.use(signerIdentity(signer));
    
    console.log('✅ Core asset update service initialized with authority:', updateAuthority.publicKey.toString());
  }

  /**
   * Update Core Asset metadata with new traits following Pepe Gods V2 format
   */
  async updateAssetWithTraits(
    assetAddress: string,
    newImageUrl: string,
    newAttributes: Array<{ trait_type: string; value: string }>,
    existingMetadata?: Partial<CoreAssetMetadata>
  ): Promise<{ signature: string; success: boolean }> {
    try {
      console.log('🎨 Updating Core Asset with traits:', {
        assetAddress,
        newImageUrl,
        attributeCount: newAttributes.length,
        updateAuthority: this.updateAuthority.publicKey.toString()
      });

      // Convert Web3.js PublicKey to UMI PublicKey
      const assetPublicKey = publicKey(assetAddress);

      // Fetch current asset metadata
      let currentAsset: AssetV1;
      try {
        currentAsset = await fetchAssetV1(this.umi, assetPublicKey);
        console.log('✅ Fetched current asset metadata:', {
          name: currentAsset.name,
          uri: currentAsset.uri
        });
      } catch (error) {
        console.error('❌ Failed to fetch current asset:', error);
        throw new Error(`Failed to fetch asset ${assetAddress}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Parse existing metadata if URI is available or fetch from Helius
      let existingData: Partial<CoreAssetMetadata> = {};
      
      // First try to fetch from Helius for more complete metadata
      try {
        const { HeliusService } = await import('./helius');
        const heliusMetadata = await HeliusService.getNFTMetadata(assetAddress);
        if (heliusMetadata) {
          existingData = heliusMetadata as Partial<CoreAssetMetadata>;
          console.log('✅ Used Helius metadata as base');
        }
      } catch (error) {
        console.warn('⚠️ Could not fetch metadata from Helius:', error);
      }
      
      // Fallback to URI-based metadata if Helius failed
      if (!existingData.name && currentAsset.uri) {
        try {
          const response = await fetch(currentAsset.uri);
          if (response.ok) {
            const uriMetadata = await response.json();
            existingData = { ...uriMetadata, ...existingData }; // Helius takes precedence
            console.log('✅ Merged URI metadata with existing data');
          }
        } catch (error) {
          console.warn('⚠️ Could not fetch existing metadata from URI:', error);
        }
      }

      // Build new metadata following Pepe Gods V2 format
      const newMetadata: CoreAssetMetadata = {
        name: existingData.name || currentAsset.name || 'Pepe Gods V2',
        description: existingData.description || 'Pepe Gods V2 - Arise from the Ashes, is a refined artistic evolution of the original Pepe Gods collection, created by Pepeverse and supported by a lot of utilities. While the art has been upgraded, the mission remains unchanged - to give back to the community.',
        symbol: existingData.symbol || 'PGV2',
        seller_fee_basis_points: existingData.seller_fee_basis_points || 690,
        image: newImageUrl,
        external_url: existingData.external_url,
        attributes: await this.buildCompleteAttributeSet(newAttributes, existingData.attributes || []),
        properties: {
          files: [
            {
              uri: newImageUrl,
              type: 'image/jpeg'
            }
          ],
          category: 'image',
          creators: existingData.properties?.creators || [
            {
              address: process.env.NFT_CREATOR_ADDRESS || '6ByScvE5szYLNfVtrgPFEeRvyP5BYuBVUvBSLPxmkNxT',
              share: 100
            }
          ]
        }
      };

      console.log('📝 Built new metadata:', {
        name: newMetadata.name,
        symbol: newMetadata.symbol,
        attributeCount: newMetadata.attributes.length,
        imageUrl: newMetadata.image
      });

      // Create metadata JSON string
      const metadataJson = JSON.stringify(newMetadata);

      // Create the update instruction using Metaplex Core
      const updateBuilder = updateV1(this.umi, {
        asset: assetPublicKey,
        newName: some(newMetadata.name),
        newUri: some(metadataJson), // For Core assets, metadata can be stored directly
      });

      // Build and send the transaction
      const result = await updateBuilder.sendAndConfirm(this.umi);

      console.log('✅ Core asset updated successfully:', result.signature);

      return {
        signature: result.signature,
        success: true
      };

    } catch (error) {
      console.error('❌ Failed to update Core Asset:', error);
      throw new Error(`Core Asset update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Batch update multiple assets
   */
  async batchUpdateAssets(
    updates: Array<{
      assetAddress: string;
      newImageUrl: string;
      newAttributes: Array<{ trait_type: string; value: string }>;
    }>
  ): Promise<Array<{ signature: string; success: boolean; assetAddress: string }>> {
    const results = [];

    for (const update of updates) {
      try {
        const result = await this.updateAssetWithTraits(
          update.assetAddress,
          update.newImageUrl,
          update.newAttributes
        );
        results.push({
          ...result,
          assetAddress: update.assetAddress,
        });
      } catch (error) {
        console.error(`Failed to update asset ${update.assetAddress}:`, error);
        results.push({
          signature: '',
          success: false,
          assetAddress: update.assetAddress,
        });
      }
    }

    return results;
  }

  /**
   * Verify asset ownership and update authority
   */
  async verifyUpdateAuthority(assetAddress: string): Promise<boolean> {
    try {
      console.log('🔍 Verifying update authority for asset:', assetAddress);
      
      const assetPublicKey = publicKey(assetAddress);
      const asset = await fetchAssetV1(this.umi, assetPublicKey);
      
      // Check if the update authority matches
      const hasAuthority = asset.updateAuthority.type === 'Address' && 
                          asset.updateAuthority.address === fromWeb3JsKeypair(this.updateAuthority).publicKey;
      
      console.log('🔍 Update authority check:', {
        assetAuthority: asset.updateAuthority,
        ourAuthority: fromWeb3JsKeypair(this.updateAuthority).publicKey,
        hasAuthority
      });
      
      return hasAuthority;
    } catch (error) {
      console.error('Failed to verify update authority:', error);
      return false;
    }
  }

  /**
   * Build complete attribute set with all trait slots
   * This ensures every trait slot has an attribute, using "Blank" for empty slots
   */
  private async buildCompleteAttributeSet(
    newAttributes: Array<{ trait_type: string; value: string }>,
    existingAttributes: Array<{ trait_type: string; value: string | number }> = []
  ): Promise<Array<{ trait_type: string; value: string | number }>> {
    try {
      // Define all possible trait slots in the correct order
      const allTraitSlots = [
        'Background',
        'Speciality', 
        'Fur',
        'Clothes',
        'Hand',
        'Mouth',
        'Mask',
        'Headwear',
        'Eyes',
        'Eyewear'
      ];

      console.log('🏷️ Building complete attribute set:', {
        newAttributeCount: newAttributes.length,
        existingAttributeCount: existingAttributes.length,
        allSlots: allTraitSlots.length
      });

      // Create a map of existing attributes for easy lookup
      const existingAttributeMap = new Map<string, string | number>();
      existingAttributes.forEach(attr => {
        existingAttributeMap.set(attr.trait_type, attr.value);
      });

      // Create a map of new attributes (these override existing ones)
      const newAttributeMap = new Map<string, string>();
      newAttributes.forEach(attr => {
        newAttributeMap.set(attr.trait_type, attr.value);
      });

      // Build complete attribute set
      const completeAttributes: Array<{ trait_type: string; value: string | number }> = [];

      // Add all trait slots with their values
      for (const slotName of allTraitSlots) {
        let value: string | number;

        if (newAttributeMap.has(slotName)) {
          // Use new value if provided
          value = newAttributeMap.get(slotName)!;
          console.log(`✅ Updated ${slotName}: ${value}`);
        } else if (existingAttributeMap.has(slotName)) {
          // Keep existing value
          value = existingAttributeMap.get(slotName)!;
          console.log(`📋 Kept ${slotName}: ${value}`);
        } else {
          // Default to "Blank" for empty slots
          value = 'Blank';
          console.log(`⚪ Default ${slotName}: ${value}`);
        }

        completeAttributes.push({
          trait_type: slotName,
          value: value
        });
      }

      // Add Rarity Rank (preserve existing or generate new)
      let rarityRank: number;
      const existingRarity = existingAttributeMap.get('Rarity Rank');
      if (existingRarity && typeof existingRarity === 'number') {
        rarityRank = existingRarity;
        console.log(`📋 Kept Rarity Rank: ${rarityRank}`);
      } else {
        rarityRank = Math.floor(Math.random() * 5000) + 1;
        console.log(`🎲 Generated Rarity Rank: ${rarityRank}`);
      }

      completeAttributes.push({
        trait_type: 'Rarity Rank',
        value: rarityRank
      });

      console.log('✅ Complete attribute set built:', {
        totalAttributes: completeAttributes.length,
        traitSlots: allTraitSlots.length,
        hasRarityRank: true
      });

      return completeAttributes;

    } catch (error) {
      console.error('❌ Error building complete attribute set:', error);
      
      // Fallback: return new attributes with rarity rank
      const fallbackAttributes = [
        ...newAttributes,
        { trait_type: 'Rarity Rank', value: Math.floor(Math.random() * 5000) + 1 }
      ];
      
      console.warn('⚠️ Using fallback attribute set:', fallbackAttributes.length);
      return fallbackAttributes;
    }
  }
  async getAssetMetadata(assetAddress: string): Promise<CoreAssetMetadata | null> {
    try {
      const assetPublicKey = publicKey(assetAddress);
      const asset = await fetchAssetV1(this.umi, assetPublicKey);
      
      if (asset.uri) {
        const response = await fetch(asset.uri);
        if (response.ok) {
          return await response.json();
        }
      }
      
      // Return basic metadata if URI fetch fails
      return {
        name: asset.name || 'Unknown Asset',
        description: 'Asset description not available',
        symbol: 'UNKNOWN',
        seller_fee_basis_points: 0,
        image: '',
        attributes: [],
        properties: {
          files: [],
          category: 'image',
          creators: []
        }
      };
    } catch (error) {
      console.error('Failed to get asset metadata:', error);
      return null;
    }
  }
}