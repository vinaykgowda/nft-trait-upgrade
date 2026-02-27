import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { TransactionBuilder } from '@/lib/services/transaction-builder';
import { InventoryManager } from '@/lib/services/inventory-manager';
import { PurchaseRepository } from '@/lib/repositories/purchases';
import { TransactionMonitor } from '@/lib/services/transaction-monitor';
import { configService } from '@/lib/services/config';
import { Transaction } from '@solana/web3.js';
import { query } from '@/lib/database';

const confirmTransactionSchema = z.object({
  reservationId: z.string().uuid(),
  signedTransaction: z.string(),
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

    // Get trait data for price and token info
    const traitRepo = new (await import('@/lib/repositories/traits')).TraitRepository();
    const traitsWithRelations = await traitRepo.findWithRelations({});
    const trait = traitsWithRelations.find(t => t.id === reservation.traitId);

    if (!trait) {
      return NextResponse.json(
        { success: false, error: 'Trait not found' },
        { status: 400 }
      );
    }

    const treasuryWallet = await configService.getTreasuryWallet();

    // Consume reservation and create purchase record
    // This decrements supply inside a transaction
    const purchaseData = {
      walletAddress: reservation.walletAddress,
      assetId: reservation.assetId,
      traitId: reservation.traitId,
      priceAmount: trait.price_amount,
      tokenId: trait.price_token_id,
      treasuryWallet: treasuryWallet,
      status: 'tx_built' as const,
    };

    const consumeResult = await inventoryManager.consumeReservation(reservationId, purchaseData);
    if (!consumeResult.success) {
      return NextResponse.json(
        { success: false, error: consumeResult.error || 'Failed to consume reservation' },
        { status: 400 }
      );
    }

    const purchase = consumeResult.purchase!;

    try {
      console.log('📡 Sending atomic transaction to Solana...');

      const result = await transactionBuilder.sendAndConfirmTransaction({
        transaction,
        requiredSignatures: [reservation.walletAddress],
        delegateSignatures: [],
      });

      if (result.success) {
        console.log('✅ Atomic transaction confirmed:', result.signature);

        await purchaseRepo.updateStatus(purchase.id, 'confirmed', result.signature);
        await transactionMonitor.startMonitoring(result.signature!, purchase.id);

        return NextResponse.json({
          success: true,
          signature: result.signature,
          purchaseId: purchase.id,
          status: 'confirmed',
          message: 'Transaction completed successfully',
          paymentExecuted: result.paymentExecuted,
          updateExecuted: result.updateExecuted,
        });
      } else {
        console.error('❌ Transaction failed:', result.error);

        // Transaction failed — restore supply and mark purchase as failed
        await purchaseRepo.updateStatus(purchase.id, 'failed');
        await restoreSupply(reservation.traitId);

        return NextResponse.json(
          { success: false, error: result.error || 'Transaction failed' },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error('❌ Transaction confirmation error:', error);

      // Exception during send — restore supply and mark purchase as failed
      await purchaseRepo.updateStatus(purchase.id, 'failed');
      await restoreSupply(reservation.traitId);

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

/**
 * Restore supply for a trait when a transaction fails after reservation was consumed.
 * This prevents supply from being permanently lost on failed transactions.
 */
async function restoreSupply(traitId: string): Promise<void> {
  try {
    await query(
      `UPDATE traits SET remaining_supply = remaining_supply + 1
       WHERE id = $1 AND remaining_supply IS NOT NULL AND total_supply IS NOT NULL
       AND remaining_supply < total_supply`,
      [traitId]
    );
    console.log('🔄 Supply restored for trait:', traitId);
  } catch (err) {
    console.error('❌ Failed to restore supply for trait:', traitId, err);
  }
}
