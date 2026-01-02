import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { TransactionBuilder } from '@/lib/services/transaction-builder';
import { PurchaseRepository } from '@/lib/repositories/purchases';

const statusSchema = z.object({
  signature: z.string().optional(),
  purchaseId: z.string().uuid().optional(),
}).refine(data => data.signature || data.purchaseId, {
  message: "Either signature or purchaseId must be provided"
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const signature = searchParams.get('signature');
    const purchaseId = searchParams.get('purchaseId');

    const validatedParams = statusSchema.parse({ signature, purchaseId });

    const transactionBuilder = new TransactionBuilder();
    const purchaseRepo = new PurchaseRepository();

    let transactionStatus = null;
    let purchaseRecord = null;

    // Get purchase record if purchaseId provided
    if (validatedParams.purchaseId) {
      purchaseRecord = await purchaseRepo.findById(validatedParams.purchaseId);
      if (!purchaseRecord) {
        return NextResponse.json(
          { success: false, error: 'Purchase not found' },
          { status: 404 }
        );
      }

      // Use signature from purchase record if not provided in params
      if (purchaseRecord.tx_signature && !validatedParams.signature) {
        validatedParams.signature = purchaseRecord.tx_signature;
      }
    }

    // Get transaction status if signature available
    if (validatedParams.signature) {
      transactionStatus = await transactionBuilder.getTransactionStatus(validatedParams.signature);
    }

    // Determine overall status
    let overallStatus = 'unknown';
    let statusDetails = {};

    if (purchaseRecord) {
      overallStatus = purchaseRecord.status;
      statusDetails = {
        purchaseId: purchaseRecord.id,
        walletAddress: purchaseRecord.wallet_address,
        assetId: purchaseRecord.asset_id,
        traitId: purchaseRecord.trait_id,
        priceAmount: purchaseRecord.price_amount,
        createdAt: purchaseRecord.created_at,
        updatedAt: purchaseRecord.updated_at,
      };
    }

    if (transactionStatus) {
      statusDetails = {
        ...statusDetails,
        signature: validatedParams.signature,
        confirmed: transactionStatus.confirmed,
        finalized: transactionStatus.finalized,
        transactionError: transactionStatus.error,
      };

      // Update overall status based on transaction status
      if (transactionStatus.error) {
        overallStatus = 'failed';
      } else if (transactionStatus.finalized) {
        overallStatus = 'fulfilled';
      } else if (transactionStatus.confirmed) {
        overallStatus = 'confirmed';
      }

      // Update purchase record if status changed
      if (purchaseRecord && purchaseRecord.status !== overallStatus) {
        await purchaseRepo.updateStatus(purchaseRecord.id, overallStatus as any);
      }
    }

    return NextResponse.json({
      success: true,
      status: overallStatus,
      details: statusDetails,
    });
  } catch (error) {
    console.error('Transaction status error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}