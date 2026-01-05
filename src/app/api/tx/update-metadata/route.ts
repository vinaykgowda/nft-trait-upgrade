import { NextRequest } from 'next/server';
import { TransactionBuilder } from '@/lib/services/transaction-builder';
import { createApiResponse, getRequestId } from '@/lib/api/response';
import { validateRequestBody } from '@/lib/api/validation';
import { getTraitSlotRepository } from '@/lib/repositories';
import { z } from 'zod';

const metadataUpdateSchema = z.object({
  walletAddress: z.string().min(32).max(44),
  assetId: z.string().min(32).max(44),
  newImageUrl: z.string().url(),
  newAttributes: z.array(z.object({
    trait_type: z.string(),
    value: z.string()
  })),
  txSignature: z.string().optional() // Payment transaction signature for verification (optional)
});

/**
 * Build complete attribute set with all trait slots
 * This ensures every trait slot has an attribute, using "Blank" for empty slots
 */
async function buildCompleteAttributeSet(
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

    console.log('🏷️ Building complete attribute set (API):', {
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

    console.log('✅ Complete attribute set built (API):', {
      totalAttributes: completeAttributes.length,
      traitSlots: allTraitSlots.length,
      hasRarityRank: true
    });

    return completeAttributes;

  } catch (error) {
    console.error('❌ Error building complete attribute set (API):', error);
    
    // Fallback: return new attributes with rarity rank
    const fallbackAttributes = [
      ...newAttributes,
      { trait_type: 'Rarity Rank', value: Math.floor(Math.random() * 5000) + 1 }
    ];
    
    console.warn('⚠️ Using fallback attribute set (API):', fallbackAttributes.length);
    return fallbackAttributes;
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const apiResponse = createApiResponse(requestId);
  let body: any = null;

  try {
    console.log('🎨 Metadata update request received');
    
    body = await request.json();
    console.log('📝 Request body:', {
      walletAddress: body?.walletAddress,
      assetId: body?.assetId,
      hasImageUrl: !!body?.newImageUrl,
      attributeCount: body?.newAttributes?.length || 0,
      hasTxSignature: !!body?.txSignature
    });
    
    const { 
      walletAddress, 
      assetId, 
      newImageUrl,
      newAttributes,
      txSignature
    } = validateRequestBody(body, metadataUpdateSchema);

    console.log('✅ Request validation passed');
    console.log('🎨 Building metadata update transaction:', {
      wallet: walletAddress,
      asset: assetId,
      imageUrl: newImageUrl,
      attributes: newAttributes.length,
      paymentTx: txSignature || 'none'
    });

    const transactionBuilder = new TransactionBuilder();

    // Verify payment transaction was successful (if provided)
    if (txSignature) {
      console.log('🔍 Verifying payment transaction:', txSignature);
      const paymentStatus = await transactionBuilder.getTransactionStatus(txSignature);
      if (!paymentStatus.confirmed) {
        console.error('❌ Payment transaction not confirmed:', paymentStatus);
        return apiResponse.error('Payment transaction not confirmed', 400);
      }
      console.log('✅ Payment transaction confirmed, proceeding with metadata update');
    } else {
      console.log('⚠️ No payment transaction signature provided, proceeding with metadata update only');
    }

    // Build metadata update transaction
    console.log('🔨 Building metadata update transaction...');
    
    // Try to use proper Core asset update, but fall back to transaction builder if needed
    try {
      // Use the proper Core asset update service
      const { CoreAssetUpdateService } = await import('@/lib/services/core-asset-update');
      const { Connection, Keypair } = await import('@solana/web3.js');
      const { RPC_CONFIG } = await import('@/lib/constants');
      
      // Initialize delegate keypair
      const delegatePrivateKey = process.env.SOLANA_DELEGATE_PRIVATE_KEY;
      if (!delegatePrivateKey) {
        throw new Error('SOLANA_DELEGATE_PRIVATE_KEY not configured');
      }
      
      let delegateKeypair: Keypair;
      let privateKeyBytes: Uint8Array;
      if (delegatePrivateKey.startsWith('[') && delegatePrivateKey.endsWith(']')) {
        privateKeyBytes = Uint8Array.from(JSON.parse(delegatePrivateKey));
      } else {
        const bs58 = require('bs58');
        privateKeyBytes = bs58.decode(delegatePrivateKey);
      }
      delegateKeypair = Keypair.fromSecretKey(privateKeyBytes);
      console.log('✅ Delegate keypair initialized for Core update');
      
      // Initialize Core asset update service
      const connection = new Connection(RPC_CONFIG.HELIUS_RPC_URL, 'confirmed');
      const coreUpdateService = new CoreAssetUpdateService(
        connection,
        delegateKeypair,
        RPC_CONFIG.HELIUS_RPC_URL
      );
      
      // Perform the Core asset update
      console.log('🎨 Updating Core asset with new traits...');
      const updateResult = await coreUpdateService.updateAssetWithTraits(
        assetId,
        newImageUrl,
        newAttributes
      );
      
      if (updateResult.success) {
        console.log('✅ Core asset updated successfully:', updateResult.signature);

        // Build complete attributes for response
        const completeAttributesForResponse = await buildCompleteAttributeSet(newAttributes);

        return apiResponse.success({
          success: true,
          signature: updateResult.signature,
          message: 'NFT metadata updated successfully',
          newImageUrl,
          newAttributes: completeAttributesForResponse,
          paymentTxSignature: txSignature || null
        });
      } else {
        throw new Error('Core asset update returned false');
      }
      
    } catch (coreUpdateError) {
      console.warn('⚠️ Core asset update failed, falling back to transaction builder:', coreUpdateError);
      
      // Fallback to transaction builder approach
      const partiallySignedTransaction = await transactionBuilder.buildMetadataUpdateTransaction({
        walletAddress,
        assetId,
        newImageUrl,
        newAttributes
      });

      console.log('✅ Fallback transaction built successfully');

      // Validate the transaction
      console.log('🔍 Validating fallback transaction...');
      const validation = transactionBuilder.validateTransaction(partiallySignedTransaction.transaction);
      if (!validation.valid) {
        console.error('❌ Transaction validation failed:', validation.error);
        return apiResponse.error(`Transaction validation failed: ${validation.error}`, 500);
      }

      console.log('✅ Fallback transaction validation passed');

      // Simulate the transaction
      console.log('🎭 Simulating fallback transaction...');
      const simulation = await transactionBuilder.simulateTransaction(partiallySignedTransaction.transaction);
      if (!simulation.success) {
        console.error('❌ Transaction simulation failed:', simulation.error);
        return apiResponse.error(`Transaction simulation failed: ${simulation.error}`, 400);
      }

      console.log('✅ Fallback transaction simulation passed');

      // Execute the metadata update transaction (delegate-signed)
      console.log('📡 Executing fallback metadata update transaction...');
      const result = await transactionBuilder.sendAndConfirmTransaction(
        partiallySignedTransaction,
        new Uint8Array() // No user signature needed for metadata updates
      );

      if (result.success) {
        console.log('✅ Fallback metadata update transaction confirmed:', result.signature);

        // Build complete attributes for response (same logic as used in transaction)
        const completeAttributesForResponse = await buildCompleteAttributeSet(newAttributes);

        return apiResponse.success({
          success: true,
          signature: result.signature,
          message: 'NFT metadata updated successfully (fallback method)',
          newImageUrl,
          newAttributes: completeAttributesForResponse,
          paymentTxSignature: txSignature || null
        });
      } else {
        console.error('❌ Fallback metadata update failed:', result.error);
        return apiResponse.error(`Metadata update failed: ${result.error}`, 500);
      }
    }

  } catch (error) {
    console.error('❌ Metadata update error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      body: body,
      requestId: requestId
    });
    
    return apiResponse.handleError(error, {
      operation: 'update_metadata',
      type: 'metadata_update',
      walletAddress: body?.walletAddress,
      assetId: body?.assetId,
    });
  }
}