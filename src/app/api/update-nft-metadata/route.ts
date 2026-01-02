import { NextRequest, NextResponse } from 'next/server';
import { CoreAssetUpdateService } from '@/lib/services/core-asset-update';
import { IrysUploadService, NFTMetadata } from '@/lib/services/irys-upload';
import { Connection, Keypair } from '@solana/web3.js';
import { Trait } from '@/types';
import { getTraitSlotRepository } from '@/lib/repositories';

export async function POST(request: NextRequest) {
  try {
    const { assetId, newImageUrl, newTraits, originalTraits, txSignature } = await request.json();

    if (!assetId || !newImageUrl || !Array.isArray(newTraits)) {
      return NextResponse.json(
        { error: 'Missing required fields: assetId, newImageUrl, newTraits' },
        { status: 400 }
      );
    }

    // Get update authority keypair
    const updatePrivateKey = process.env.UPDATE_AUTHORITY_PRIVATE_KEY;
    if (!updatePrivateKey) {
      throw new Error('UPDATE_AUTHORITY_PRIVATE_KEY not configured');
    }

    const updateKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(updatePrivateKey))
    );

    // Get Solana connection
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl);

    // Get trait slots for proper naming
    const traitSlotRepo = getTraitSlotRepository();
    const slots = await traitSlotRepo.findAllOrdered();
    const domainSlots = slots.map(slot => traitSlotRepo.toDomain(slot));

    // Create a map of slot ID to slot name
    const slotIdToName = new Map();
    domainSlots.forEach(slot => {
      slotIdToName.set(slot.id, slot.name);
    });

    // Build complete trait attributes - include ALL slots
    const completeAttributes: Array<{ trait_type: string; value: string }> = [];
    
    // Create a map of updated traits by slot ID
    const updatedTraitsBySlot = new Map();
    newTraits.forEach((trait: any) => {
      if (trait.slotId) {
        updatedTraitsBySlot.set(trait.slotId, trait);
      }
    });

    // Create a map of original traits by slot name (from Helius data)
    const originalTraitsBySlotName = new Map();
    if (originalTraits && Array.isArray(originalTraits)) {
      originalTraits.forEach((attr: any) => {
        if (attr.trait_type && attr.value) {
          originalTraitsBySlotName.set(attr.trait_type, attr.value);
        }
      });
    }

    // Process each slot to build complete attributes
    domainSlots.forEach(slot => {
      const slotName = slot.name;
      let traitValue = 'Blank'; // Default value

      // Check if this slot has an updated trait
      if (updatedTraitsBySlot.has(slot.id)) {
        const updatedTrait = updatedTraitsBySlot.get(slot.id);
        traitValue = updatedTrait.name;
      } else if (originalTraitsBySlotName.has(slotName)) {
        // Keep the original trait value if no update
        traitValue = originalTraitsBySlotName.get(slotName);
      }

      // Add to attributes (even if Blank)
      completeAttributes.push({
        trait_type: slotName,
        value: traitValue
      });
    });

    // Get creator information and collection details from environment
    const creatorAddress = process.env.NFT_CREATOR_ADDRESS || updateKeypair.publicKey.toString();
    const collectionSymbol = process.env.NFT_COLLECTION_SYMBOL || 'PGV2';
    const sellerFeeBasisPoints = parseInt(process.env.NFT_SELLER_FEE_BASIS_POINTS || '690');
    
    // Create new metadata with complete trait structure matching your format
    const metadata: NFTMetadata = {
      name: `Updated NFT ${assetId.slice(0, 8)}`,
      description: `NFT updated with new traits via trait marketplace. Transaction: ${txSignature}`,
      symbol: collectionSymbol,
      seller_fee_basis_points: sellerFeeBasisPoints,
      image: newImageUrl,
      external_url: process.env.NEXT_PUBLIC_APP_URL || '',
      attributes: completeAttributes,
      properties: {
        files: [
          {
            uri: newImageUrl,
            type: 'image/png'
          }
        ],
        category: 'image',
        creators: [
          {
            address: creatorAddress,
            share: 100
          }
        ]
      }
    };

    console.log('📝 Creating metadata with complete trait structure:');
    console.log('   - Total attributes:', completeAttributes.length);
    completeAttributes.forEach(attr => {
      console.log(`   - ${attr.trait_type}: ${attr.value}`);
    });

    // Upload metadata to Irys
    const irysService = new IrysUploadService(updateKeypair);
    const metadataResult = await irysService.uploadMetadata(metadata);

    // Update Core Asset with new metadata URI
    const coreAssetService = new CoreAssetUpdateService(connection, updateKeypair);
    const updateResult = await coreAssetService.updateAssetWithTrait(
      assetId,
      metadataResult.url,
      {
        name: metadata.name,
        description: metadata.description,
        image: newImageUrl,
        attributes: metadata.attributes
      }
    );

    return NextResponse.json({
      success: true,
      metadataUri: metadataResult.url,
      updateSignature: updateResult.signature,
      metadata,
      updatedSlots: Array.from(updatedTraitsBySlot.keys()),
      totalAttributes: completeAttributes.length
    });

  } catch (error) {
    console.error('Error updating NFT metadata:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update NFT metadata',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}