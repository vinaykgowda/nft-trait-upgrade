import { NextRequest } from 'next/server';
import { TransactionBuilder } from '@/lib/services/transaction-builder';
import { createApiResponse, getRequestId } from '@/lib/api/response';
import { validateRequestBody } from '@/lib/api/validation';
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

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const apiResponse = createApiResponse(requestId);
  let body: any = null;

  try {
    body = await request.json();
    const { 
      walletAddress, 
      assetId, 
      newImageUrl,
      newAttributes,
      txSignature
    } = validateRequestBody(body, metadataUpdateSchema);

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
      const paymentStatus = await transactionBuilder.getTransactionStatus(txSignature);
      if (!paymentStatus.confirmed) {
        return apiResponse.error('Payment transaction not confirmed', 400);
      }
      console.log('✅ Payment transaction confirmed, proceeding with metadata update');
    } else {
      console.log('⚠️ No payment transaction signature provided, proceeding with metadata update only');
    }

    // Build metadata update transaction
    const partiallySignedTransaction = await transactionBuilder.buildMetadataUpdateTransaction({
      walletAddress,
      assetId,
      newImageUrl,
      newAttributes
    });

    // Validate the transaction
    const validation = transactionBuilder.validateTransaction(partiallySignedTransaction.transaction);
    if (!validation.valid) {
      return apiResponse.error(`Transaction validation failed: ${validation.error}`, 500);
    }

    // Simulate the transaction
    const simulation = await transactionBuilder.simulateTransaction(partiallySignedTransaction.transaction);
    if (!simulation.success) {
      return apiResponse.error(`Transaction simulation failed: ${simulation.error}`, 400);
    }

    console.log('✅ Metadata update transaction built and validated successfully');

    // Execute the metadata update transaction (delegate-signed)
    const result = await transactionBuilder.sendAndConfirmTransaction(
      partiallySignedTransaction,
      new Uint8Array() // No user signature needed for metadata updates
    );

    if (result.success) {
      console.log('✅ Metadata update transaction confirmed:', result.signature);

      return apiResponse.success({
        success: true,
        signature: result.signature,
        message: 'NFT metadata updated successfully',
        newImageUrl,
        newAttributes,
        paymentTxSignature: txSignature || null
      });
    } else {
      console.error('❌ Metadata update failed:', result.error);
      return apiResponse.error(`Metadata update failed: ${result.error}`, 500);
    }

  } catch (error) {
    console.error('❌ Metadata update error:', error);
    return apiResponse.handleError(error, {
      operation: 'update_metadata',
      type: 'metadata_update',
      walletAddress: body?.walletAddress,
      assetId: body?.assetId,
    });
  }
}