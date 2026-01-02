import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { TransactionBuilder } from '@/lib/services/transaction-builder';
import { InventoryManager } from '@/lib/services/inventory-manager';
import { PurchaseRepository } from '@/lib/repositories/purchases';
import { TransactionMonitor } from '@/lib/services/transaction-monitor';
import { Transaction } from '@solana/web3.js';

const confirmTransactionSchema = z.object({
  reservationId: z.string().uuid(),
  signedTransaction: z.string(), // Base64 encoded signed transaction
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reservationId, signedTransaction } = confirmTransactionSchema.parse(body);

    console.log('🔄 Confirming transaction for reservation:', reservationId);

    const transactionBuilder = new TransactionBuilder();
    const inventoryManager = new InventoryManager();
    const purchaseRepo = new PurchaseRepository();
    const transactionMonitor = new TransactionMonitor();

    // Verify reservation is still valid
    const reservationStatus = await inventoryManager.getReservationStatus(reservationId);
    if (!reservationStatus.found || reservationStatus.isExpired) {
      return NextResponse.json(
        { success: false, error: 'Reservation expired or not found' },
        { status: 400 }
      );
    }

    const reservation = reservationStatus.reservation!;

    // Deserialize the signed transaction
    let transaction: Transaction;
    try {
      const transactionBuffer = Buffer.from(signedTransaction, 'base64');
      transaction = Transaction.from(transactionBuffer);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid transaction format' },
        { status: 400 }
      );
    }

    // Validate the transaction structure
    const validation = transactionBuilder.validateTransaction(transaction);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: `Transaction validation failed: ${validation.error}` },
        { status: 400 }
      );
    }

    console.log('✅ Transaction validation passed:', {
      hasPayment: validation.hasPaymentInstruction,
      hasUpdate: validation.hasUpdateInstruction
    });

    // Create purchase records for all traits in the reservation
    const purchasePromises = reservation.traitIds.map(async (traitId) => {
      const mockPurchaseData = {
        walletAddress: reservation.walletAddress,
        assetId: reservation.assetId,
        traitId: traitId,
        priceAmount: '1.0', // This should come from trait data
        tokenId: 'sol-token-id', // This should come from trait data
        treasuryWallet: process.env.TREASURY_WALLET || 'EE72RERKxoJFt61MFZSnWvztjD43zPDr2aVizkS41nLC',
        status: 'tx_built' as const,
      };

      return mockPurchaseData;
    });

    const purchaseDataArray = await Promise.all(purchasePromises);

    // Consume the reservation and create purchase records
    const consumeResult = await inventoryManager.consumeReservation(reservationId, purchaseDataArray[0]);
    if (!consumeResult.success) {
      return NextResponse.json(
        { success: false, error: consumeResult.error || 'Failed to consume reservation' },
        { status: 400 }
      );
    }

    const purchase = consumeResult.purchase!;

    try {
      console.log('📡 Sending atomic transaction to Solana...');

      // Send the transaction to the network
      const result = await transactionBuilder.sendAndConfirmTransaction(
        {
          transaction,
          requiredSignatures: [reservation.walletAddress],
          delegateSignatures: [], // Would be populated from build step
        },
        new Uint8Array() // User signature already in transaction
      );

      if (result.success) {
        console.log('✅ Atomic transaction confirmed:', result.signature);

        // Update purchase record with transaction signature
        await purchaseRepo.updateStatus(purchase.id, 'confirmed', result.signature);

        // Start monitoring the transaction for finalization
        await transactionMonitor.startMonitoring(result.signature!, purchase.id);

        return NextResponse.json({
          success: true,
          signature: result.signature,
          purchaseId: purchase.id,
          status: 'confirmed',
          message: 'Atomic transaction completed successfully - payment processed and metadata updated',
          paymentExecuted: result.paymentExecuted,
          updateExecuted: result.updateExecuted,
        });
      } else {
        console.error('❌ Transaction failed:', result.error);

        // Update purchase record with failure
        await purchaseRepo.updateStatus(purchase.id, 'failed');

        return NextResponse.json(
          { success: false, error: result.error || 'Transaction failed' },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error('❌ Transaction confirmation error:', error);

      // Update purchase record with failure
      await purchaseRepo.updateStatus(purchase.id, 'failed');

      return NextResponse.json(
        { success: false, error: 'Transaction confirmation failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ Transaction confirm error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
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