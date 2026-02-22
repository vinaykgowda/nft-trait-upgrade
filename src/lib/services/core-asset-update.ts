import { Connection, Keypair } from '@solana/web3.js';
import { 
  publicKey,
  some,
  Umi,
  signerIdentity,
  createSignerFromKeypair,
} from '@metaplex-foundation/umi';
import { createUmi as createUmiBundle } from '@metaplex-foundation/umi-bundle-defaults';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import {
  updateV1,
  fetchAssetV1,
  fetchCollectionV1,
  AssetV1,
  mplCore,
} from '@metaplex-foundation/mpl-core';


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
  private umi: Umi;
  private updateAuthority: Keypair;

  constructor(connection: Connection, updateAuthority: Keypair, rpcUrl?: string) {
    this.updateAuthority = updateAuthority;

    const endpoint = rpcUrl || connection.rpcEndpoint;

    this.umi = createUmiBundle(endpoint).use(mplCore());

    const umiKeypair = fromWeb3JsKeypair(updateAuthority);
    const signer = createSignerFromKeypair(this.umi, umiKeypair);
    this.umi = this.umi.use(signerIdentity(signer));
    
    console.log('✅ Core asset update service initialized with authority:', updateAuthority.publicKey.toString());
  }

  async updateAssetUri(
      assetAddress: string,
      metadataUri: string
    ): Promise<{ signature: string; success: boolean }> {
      try {
        console.log('🧾 Updating Core Asset URI:', { assetAddress, metadataUri });

        const assetPublicKey = publicKey(assetAddress);

        // Fetch the asset to check if it belongs to a collection
        const currentAsset = await fetchAssetV1(this.umi, assetPublicKey);

        // If update authority is a Collection, include the collection account (fixes MissingCollection / Custom:25)
        let collectionForUpdate: any = undefined;
        const ua: any = (currentAsset as any)?.updateAuthority;
        if (ua?.type === 'Collection' && ua?.address) {
          const collectionPk = publicKey(ua.address);
          collectionForUpdate = await fetchCollectionV1(this.umi, collectionPk);
          console.log('✅ Using collection for Core update:', collectionPk.toString());
        }

        const builder = updateV1(this.umi, {
          asset: assetPublicKey,
          ...(collectionForUpdate ? { collection: collectionForUpdate } : {}),
          newUri: some(metadataUri),
        } as any);

        const result = await builder.sendAndConfirm(this.umi, {
          send: { skipPreflight: false },
          confirm: { commitment: 'confirmed' },
        });

        const sigStr = result.signature.toString();

        console.log('✅ Core Asset URI updated:', sigStr);

        return { signature: sigStr, success: true };
      } catch (e: any) {
        console.error('❌ Core Asset URI update failed:', e);
        throw new Error(`Core Asset URI update failed: ${e?.message || String(e)}`);
      }
    }

  async verifyUpdateAuthority(assetAddress: string): Promise<boolean> {
    try {
      console.log('🔍 Verifying update authority for asset:', assetAddress);
      
      const assetPublicKey = publicKey(assetAddress);
      const asset = await fetchAssetV1(this.umi, assetPublicKey);
      
      // Check if the update authority matches
      let hasAuthority = asset.updateAuthority.type === 'Address' && 
                          asset.updateAuthority.address === fromWeb3JsKeypair(this.updateAuthority).publicKey;

      // Best-effort: if authority is Collection, check if our key matches the collection update authority.
      if (!hasAuthority) {
        const ua: any = (asset as any)?.updateAuthority;
        if (ua?.type === 'Collection' && ua?.address) {
          try {
            const col = await fetchCollectionV1(this.umi, publicKey(ua.address));
            const colUa: any = (col as any)?.updateAuthority;
            if (colUa?.type === 'Address' && colUa?.address) {
              hasAuthority = colUa.address === fromWeb3JsKeypair(this.updateAuthority).publicKey;
            }
          } catch (e) {
            // ignore - delegate plugins may still allow update even if this check can't confirm it
          }
        }
      }

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
   * ✅ FIXED:
   * - Builds full off-chain metadata JSON
   * - Uploads metadata JSON to Irys (if caller didn’t provide newMetadataUri)
   * - Updates Core asset with newUri = metadataUri (NOT the JSON string)
   * - Includes collection account when updateAuthority is Collection (fixes Custom:25 MissingCollection)
   */
  async updateAssetWithTraits(
    assetAddress: string,
    newImageUrl: string,
    newAttributes: Array<{ trait_type: string; value: string }>,
    existingMetadata?: Partial<CoreAssetMetadata>,
    newMetadataUri?: string
  ): Promise<{ signature: string; success: boolean }> {
    try {
      console.log('🎨 Updating Core Asset with traits:', {
        assetAddress,
        newImageUrl,
        attributeCount: newAttributes.length,
        updateAuthority: this.updateAuthority.publicKey.toString()
      });

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

      // Parse existing metadata if URI is available or use provided base
      let existingData: Partial<CoreAssetMetadata> = {};
      if (existingMetadata) {
        existingData = existingMetadata;
        console.log('✅ Using provided existing metadata');
      } else if (currentAsset.uri && currentAsset.uri.startsWith('http')) {
        try {
          const response = await fetch(currentAsset.uri);
          if (response.ok) {
            existingData = await response.json();
            console.log('✅ Fetched existing metadata from URI');
          }
        } catch (error) {
          console.warn('⚠️ Failed to fetch existing metadata from URI:', error);
        }
      }

      // Build complete attribute set
      const allTraitSlots = [
        'Background','Speciality','Fur','Clothes','Hand','Mouth','Mask','Headwear','Eyes','Eyewear'
      ];

      const existingAttributesMap = new Map<string, any>();
      if (existingData.attributes) {
        for (const attr of existingData.attributes) existingAttributesMap.set(attr.trait_type, attr);
      }

      const newAttributesMap = new Map<string, any>();
      for (const attr of newAttributes) newAttributesMap.set(attr.trait_type, attr);

      const completeAttributes: Array<{ trait_type: string; value: string | number }> = [];
      for (const slot of allTraitSlots) {
        if (newAttributesMap.has(slot)) {
          completeAttributes.push({ trait_type: slot, value: newAttributesMap.get(slot).value });
          console.log(`✅ Updated ${slot}: ${newAttributesMap.get(slot).value}`);
        } else if (existingAttributesMap.has(slot)) {
          completeAttributes.push({ trait_type: slot, value: existingAttributesMap.get(slot).value });
          console.log(`📋 Kept ${slot}: ${existingAttributesMap.get(slot).value}`);
        } else {
          completeAttributes.push({ trait_type: slot, value: 'Blank' });
          console.log(`📋 Defaulted ${slot}: Blank`);
        }
      }

      const rarityAttr = newAttributesMap.get('Rarity Rank') || existingAttributesMap.get('Rarity Rank');
      if (rarityAttr) {
        completeAttributes.push({ trait_type: 'Rarity Rank', value: rarityAttr.value });
        console.log(`📋 Kept Rarity Rank: ${rarityAttr.value}`);
      }

      const newMetadata: CoreAssetMetadata = {
        name: existingData.name || currentAsset.name || 'Unknown',
        description: existingData.description || 'Pepe Gods V2 - Arise from the Ashes, is a refined artistic evolution of the original Pepe Gods collection, created by Pepeverse and supported by a lot of utilities. While the art has been upgraded, the mission remains unchanged - to give back to the community.',
        symbol: existingData.symbol || 'PGV2',
        seller_fee_basis_points: existingData.seller_fee_basis_points || 690,
        image: newImageUrl,
        external_url: existingData.external_url,
        attributes: completeAttributes,
        properties: {
          files: [{ uri: newImageUrl, type: 'image/webp' }],
          category: 'image',
          creators: existingData.properties?.creators || [{
            address: process.env.NFT_CREATOR_ADDRESS || '6ByScvE5szYLNfVtrgPFEeRvyP5BYuBVUvBSLPxmkNxT',
            share: 100
          }]
        }
      };

      // Upload OFF-CHAIN metadata JSON to Pinata IPFS if no metadata URI is provided.
      // This avoids putting JSON directly on-chain (tx too large).
      if (!newMetadataUri) {
        const { PinataUploadService } = await import('./pinata-upload');
        const pinata = new PinataUploadService();
        const uploaded = await pinata.uploadMetadata(newMetadata);
        newMetadataUri = uploaded.url;
        console.log('✅ Metadata JSON uploaded to Pinata IPFS:', newMetadataUri);
      }

      if (!newMetadataUri.startsWith('http')) {
        throw new Error(`Invalid newMetadataUri: ${newMetadataUri}`);
      }

      // If update authority is a Collection, include the collection account to avoid MissingCollection (Custom:25).
      let collectionForUpdate: any = undefined;
      try {
        const ua: any = (currentAsset as any)?.updateAuthority;
        if (ua?.type === 'Collection' && ua?.address) {
          const collectionPk = publicKey(ua.address);
          collectionForUpdate = await fetchCollectionV1(this.umi, collectionPk);
          console.log('✅ Using collection for Core update:', collectionPk.toString());
        }
      } catch (e) {
        console.warn('⚠️ Could not fetch collection for update (will try update without it):', e);
      }

      // ✅ Core update: set uri to metadata URL (NOT JSON)
      const updateBuilder = updateV1(this.umi, {
        asset: assetPublicKey,
        ...(collectionForUpdate ? { collection: collectionForUpdate } : {}),
        newName: some(newMetadata.name),
        newUri: some(newMetadataUri),
      } as any);

      const result = await updateBuilder.sendAndConfirm(this.umi);

      console.log('✅ Core asset updated successfully:', result.signature);

      return { signature: result.signature.toString(), success: true };

    } catch (error) {
      console.error('❌ Failed to update Core Asset:', error);
      throw new Error(`Core Asset update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
