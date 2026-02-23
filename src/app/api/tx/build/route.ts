import { NextRequest } from 'next/server';
import { TransactionBuilder } from '@/lib/services/transaction-builder';
import { InventoryManager } from '@/lib/services/inventory-manager';
import { TraitRepository } from '@/lib/repositories/traits';
import { createNFTService } from '@/lib/services/nft';
import { configService } from '@/lib/services/config';
import { createApiResponse, getRequestId } from '@/lib/api/response';
import { validateRequestBody } from '@/lib/api/validation';
import { z } from 'zod';

const paymentItemSchema = z.object({
  token: z.string(),
  amount: z.number().positive()
});

const transactionBuildSchema = z.object({
  walletAddress: z.string().min(32).max(44),
  assetId: z.string().min(32).max(44),
  reservationId: z.string().uuid(),
  // Legacy single-token fields (backwards compatible)
  paymentToken: z.enum(['SOL', 'LDZ']).optional(),
  totalAmount: z.number().positive().optional(),
  // New: array of payments for mixed-token support
  payments: z.array(paymentItemSchema).optional(),
  transactionType: z.enum(['payment', 'metadata']).default('payment')
});

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const apiResponse = createApiResponse(requestId);
  let body: any = null;

  try {
    body = await request.json();
    console.log('📥 Transaction build request:', body);

    const {
      walletAddress, assetId, reservationId,
      paymentToken, totalAmount, payments, transactionType
    } = validateRequestBody(body, transactionBuildSchema);

    const transactionBuilder = new TransactionBuilder();
    const inventoryManager = new InventoryManager();
    const traitRepo = new TraitRepository();
    const nftService = createNFTService();

    // Verify ownership (skip in dev)
    if (process.env.NODE_ENV === 'production') {
      const isOwner = await nftService.verifyOwnership(walletAddress, assetId);
      if (!isOwner) return apiResponse.error('Asset not owned by wallet', 403);
    } else {
      console.log('⚠️ Skipping NFT ownership verification in development mode');
    }

    // Verify reservation
    const reservationStatus = await inventoryManager.getReservationStatus(reservationId);
    if (!reservationStatus.found || reservationStatus.isExpired) {
      return apiResponse.error('Reservation not found or expired', 400);
    }
    const reservation = reservationStatus.reservation!;
    if (reservation.walletAddress !== walletAddress || reservation.assetId !== assetId) {
      return apiResponse.error('Reservation does not match request parameters', 400);
    }

    const traitIds = [reservation.traitId];
    const traitsWithRelations = await traitRepo.findWithRelations({});
    const traits = traitsWithRelations.filter(trait => traitIds.includes(trait.id));
    if (traits.length !== traitIds.length) {
      return apiResponse.error('One or more traits not found', 400);
    }

    const treasuryWallet = await configService.getTreasuryWallet();
    console.log('💰 Using treasury wallet:', treasuryWallet);

    // Build the list of payment instructions to include in ONE transaction
    // Supports both legacy (single paymentToken/totalAmount) and new (payments array) formats
    const paymentList: Array<{ amount: string; tokenMintAddress?: string; tokenSymbol: string }> = [];

    if (payments && payments.length > 0) {
      // New format: explicit payments array (supports mixed tokens in one tx)
      for (const p of payments) {
        let tokenMintAddress: string | undefined;
        if (p.token !== 'SOL') {
          tokenMintAddress = await configService.getTokenMintAddress(p.token as 'SOL' | 'LDZ');
          if (!tokenMintAddress) {
            return apiResponse.error(`${p.token} token mint not configured`, 500);
          }
        }
        paymentList.push({ amount: p.amount.toString(), tokenMintAddress, tokenSymbol: p.token });
      }
    } else if (paymentToken && totalAmount) {
      // Legacy format: single token
      let tokenMintAddress: string | undefined;
      if (paymentToken === 'LDZ') {
        tokenMintAddress = await configService.getTokenMintAddress('LDZ');
        if (!tokenMintAddress) return apiResponse.error('LDZ token mint not configured', 500);
      }
      paymentList.push({ amount: totalAmount.toString(), tokenMintAddress, tokenSymbol: paymentToken });
    } else {
      // Auto-determine from trait data
      let solTotal = 0, ldzTotal = 0;
      for (const trait of traits) {
        const amount = parseFloat(trait.price_amount);
        if (trait.token_symbol === 'SOL') solTotal += amount;
        else if (trait.token_symbol === 'LDZ') ldzTotal += amount;
      }
      if (solTotal > 0) paymentList.push({ amount: solTotal.toString(), tokenMintAddress: undefined, tokenSymbol: 'SOL' });
      if (ldzTotal > 0) {
        const ldzMint = await configService.getTokenMintAddress('LDZ');
        if (!ldzMint) return apiResponse.error('LDZ token mint not configured', 500);
        paymentList.push({ amount: ldzTotal.toString(), tokenMintAddress: ldzMint, tokenSymbol: 'LDZ' });
      }
    }

    console.log('💰 Payment instructions to build:', paymentList);

    // Token account checks for SPL tokens
    for (const p of paymentList) {
      if (p.tokenMintAddress) {
        try {
          const { getAssociatedTokenAddress } = await import('@solana/spl-token');
          const { PublicKey, Connection } = await import('@solana/web3.js');
          const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
          const walletPubkey = new PublicKey(walletAddress);
          const mintPubkey = new PublicKey(p.tokenMintAddress);
          const userTokenAccount = await getAssociatedTokenAddress(mintPubkey, walletPubkey);
          const userAccountInfo = await connection.getAccountInfo(userTokenAccount);
          if (!userAccountInfo) {
            return apiResponse.error(`User does not have a ${p.tokenSymbol} token account. Please create one first.`, 400);
          }
        } catch (err) {
          console.error(`❌ Token account check failed for ${p.tokenSymbol}:`, err);
        }
      }
    }

    // Build ONE transaction with ALL payment instructions
    const partiallySignedTransaction = await transactionBuilder.buildMixedPaymentTransaction({
      walletAddress,
      assetId,
      traitIds,
      payments: paymentList.map(p => ({ amount: p.amount, tokenMintAddress: p.tokenMintAddress })),
      treasuryWallet
    });

    const validation = transactionBuilder.validateTransaction(partiallySignedTransaction.transaction);
    if (!validation.valid) {
      return apiResponse.error(`Transaction validation failed: ${validation.error}`, 500);
    }

    console.log('⚠️ Skipping transaction simulation - disabled for debugging');
    console.log('✅ Payment transaction built and validated successfully');

    let serializedTransaction: string;
    try {
      serializedTransaction = partiallySignedTransaction.transaction.serialize({
        requireAllSignatures: false, verifySignatures: false
      }).toString('base64');
      console.log('✅ Transaction serialized successfully');
    } catch (serializationError) {
      console.error('❌ Transaction serialization failed:', serializationError);
      return apiResponse.error(`Transaction serialization failed: ${serializationError instanceof Error ? serializationError.message : 'Unknown error'}`, 500);
    }

    return apiResponse.success({
      transaction: serializedTransaction,
      reservationId,
      transactionType: 'payment',
      paymentDetails: {
        payments: paymentList.map(p => ({ token: p.tokenSymbol, amount: parseFloat(p.amount) })),
        treasuryWallet,
        hasMixedPayment: paymentList.length > 1
      },
      traits: traits.map(trait => ({ id: trait.id, name: trait.name, priceAmount: trait.price_amount, priceToken: trait.price_token_id })),
      timeRemaining: reservationStatus.timeRemaining,
      validation: { hasPaymentInstruction: validation.hasPaymentInstruction, hasUpdateInstruction: validation.hasUpdateInstruction }
    });
  } catch (error) {
    console.error('❌ Transaction build error:', error);
    return apiResponse.handleError(error, {
      operation: 'build_transaction', type: 'transaction_build',
      walletAddress: body?.walletAddress, assetId: body?.assetId, reservationId: body?.reservationId,
    });
  }
}
