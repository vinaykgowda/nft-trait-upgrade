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
  reservationId: z.string().uuid().optional(), // Single reservation (legacy)
  reservationIds: z.array(z.string().uuid()).optional(), // Multiple reservations (new)
  signedTransaction: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reservationId, reservationIds, signedTransaction } = confirmTransactionSchema.parse(body);

    // Support both single and multiple reservations
    const reservationIdsToProcess = reservationIds || (reservationId ? [reservationId] : []);
    if (reservationIdsToProcess.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No reservation IDs provided' },
        { status: 400 }
      );
    }

    console.log('🔄 Confirming transaction for reservations:', reservationIdsToProcess);

    const transactionBuilder = new TransactionBuilder();
    const inventoryManager = new InventoryManager();
    const purchaseRepo = new PurchaseRepository();
    const transactionMonitor = new TransactionMonitor();

    // Verify all reservations are still valid
    const reservations = [];
    for (const resId of reservationIdsToProcess) {
      const reservationStatus = await inventoryManager.getReservationStatus(resId);
      if (!reservationStatus.found || reservationStatus.isExpired) {
        return NextResponse.json(
          { success: false, error: `Reservation ${resId} expired or not found` },
          { status: 400 }
        );
      }
      reservations.push(reservationStatus.reservation!);
    }

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

    // Get trait data for all reservations
    const traitRepo = new (await import('@/lib/repositories/traits')).TraitRepository();
    const traitsWithRelations = await traitRepo.findWithRelations({});
    const traits = reservations.map(res => {
      const trait = traitsWithRelations.find(t => t.id === res.traitId);
      if (!trait) throw new Error(`Trait ${res.traitId} not found`);
      return trait;
    });

    const treasuryWallet = await configService.getTreasuryWallet();

    // Calculate total price for all traits (for purchase record)
    const totalPriceAmount = traits.reduce((sum, t) => sum + parseFloat(t.price_amount), 0).toString();
    const primaryTokenId = traits[0].price_token_id;

    // Consume ALL reservations and create purchase records atomically
    // This decrements supply for each trait inside a transaction
    const purchaseDataTemplate = {
      priceAmount: totalPriceAmount,
      tokenId: primaryTokenId,
      treasuryWallet: treasuryWallet,
      status: 'tx_built' as const,
    };

    const consumeResult = await inventoryManager.consumeMultipleReservations(
      reservationIdsToProcess,
      purchaseDataTemplate
    );
    
    if (!consumeResult.success) {
      return NextResponse.json(
        { success: false, error: consumeResult.error || 'Failed to consume reservations' },
        { status: 400 }
      );
    }

    const purchases = consumeResult.purchases!;
    const primaryPurchase = purchases[0];

    try {
      console.log('📡 Sending atomic transaction to Solana...');

      const result = await transactionBuilder.sendAndConfirmTransaction({
        transaction,
        requiredSignatures: [reservations[0].walletAddress],
        delegateSignatures: [],
      });

      if (result.success) {
        console.log('✅ Atomic transaction confirmed:', result.signature);

        // Update all purchase records with confirmed status
        for (const purchase of purchases) {
          await purchaseRepo.updateStatus(purchase.id, 'confirmed', result.signature);
        }
        
        await transactionMonitor.startMonitoring(result.signature!, primaryPurchase.id);

        return NextResponse.json({
          success: true,
          signature: result.signature,
          purchaseId: primaryPurchase.id,
          purchaseIds: purchases.map(p => p.id),
          status: 'confirmed',
          message: 'Transaction completed successfully',
          paymentExecuted: result.paymentExecuted,
          updateExecuted: result.updateExecuted,
          traitsProcessed: purchases.length,
        });
      } else {
        console.error('❌ Transaction failed:', result.error);

        // SECURITY FIX: If we have a signature, DO NOT restore supply immediately
        // The transaction might still confirm. Mark as pending and let monitoring handle it.
        if (result.signature) {
          console.warn('⚠️ Transaction timeout with signature - marking as pending:', result.signature);
          
          for (const purchase of purchases) {
            await purchaseRepo.updateStatus(purchase.id, 'pending', result.signature);
          }
          
          // Start monitoring to check if it confirms later
          await transactionMonitor.startMonitoring(result.signature, primaryPurchase.id);
          
          return NextResponse.json({
            success: false,
            signature: result.signature,
            status: 'pending',
            error: 'Transaction confirmation timeout - monitoring for completion',
            message: 'Your transaction was submitted but confirmation is taking longer than expected. We are monitoring it.',
          }, { status: 202 }); // 202 Accepted
        }

        // No signature means transaction never made it to the network - safe to restore
        for (const purchase of purchases) {
          await purchaseRepo.updateStatus(purchase.id, 'failed');
          await restoreSupply(purchase.traitId);
        }

        return NextResponse.json(
          { success: false, error: result.error || 'Transaction failed' },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error('❌ Transaction confirmation error:', error);

      // Exception during send — restore supply for all traits and mark purchases as failed
      for (const purchase of purchases) {
        await purchaseRepo.updateStatus(purchase.id, 'failed');
        await restoreSupply(purchase.traitId);
      }

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
