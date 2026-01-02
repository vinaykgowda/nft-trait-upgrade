import { NextRequest } from 'next/server';
import { TransactionBuilder } from '@/lib/services/transaction-builder';
import { InventoryManager } from '@/lib/services/inventory-manager';
import { TraitRepository } from '@/lib/repositories/traits';
import { ProjectRepository } from '@/lib/repositories/projects';
import { ProjectTokensService } from '@/lib/services/project-tokens';
import { createNFTService } from '@/lib/services/nft';
import { createApiResponse, getRequestId } from '@/lib/api/response';
import { validateRequestBody } from '@/lib/api/validation';
import { z } from 'zod';

const transactionBuildSchema = z.object({
  walletAddress: z.string().min(32).max(44),
  assetId: z.string().min(32).max(44),
  reservationId: z.string().uuid(),
  paymentToken: z.enum(['SOL', 'LDZ']).optional(),
  totalAmount: z.number().positive().optional(),
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
      walletAddress, 
      assetId, 
      reservationId, 
      paymentToken, 
      totalAmount,
      transactionType
    } = validateRequestBody(body, transactionBuildSchema);

    const transactionBuilder = new TransactionBuilder();
    const inventoryManager = new InventoryManager();
    const traitRepo = new TraitRepository();
    const projectRepo = new ProjectRepository();
    const projectTokensService = new ProjectTokensService();
    const nftService = createNFTService();

    console.log('🔨 Building transaction for:', {
      wallet: walletAddress,
      asset: assetId,
      reservation: reservationId,
      paymentToken,
      totalAmount
    });

    // Verify ownership of the asset (skip in development)
    if (process.env.NODE_ENV === 'production') {
      const isOwner = await nftService.verifyOwnership(walletAddress, assetId);
      if (!isOwner) {
        return apiResponse.error('Asset not owned by wallet', 403);
      }
    } else {
      console.log('⚠️ Skipping NFT ownership verification in development mode');
    }

    // Verify reservation exists and is active
    const reservationStatus = await inventoryManager.getReservationStatus(reservationId);
    if (!reservationStatus.found || reservationStatus.isExpired) {
      return apiResponse.error('Reservation not found or expired', 400);
    }

    const reservation = reservationStatus.reservation!;
    
    // Verify reservation matches the request
    if (reservation.walletAddress !== walletAddress || reservation.assetId !== assetId) {
      return apiResponse.error('Reservation does not match request parameters', 400);
    }

    // Get all reservations for this wallet/asset combination (since we create one reservation per trait)
    // For now, we'll work with the single trait from this reservation
    const traitIds = [reservation.traitId]; // Convert single traitId to array

    // Get trait information with pricing (use findWithRelations to get token info)
    const traitsWithRelations = await traitRepo.findWithRelations({});
    const traits = traitsWithRelations.filter(trait => traitIds.includes(trait.id));

    // Validate all traits exist
    if (traits.length !== traitIds.length) {
      return apiResponse.error('One or more traits not found', 400);
    }

    // Calculate total payment by token type
    let solTotal = 0;
    let ldzTotal = 0;

    for (const trait of traits) {
      if (!trait.token_symbol) {
        return apiResponse.error(`Token information not found for trait ${trait.name}`, 400);
      }

      const amount = Number(trait.price_amount);
      if (trait.token_symbol === 'SOL') {
        solTotal += amount;
      } else if (trait.token_symbol === 'LDZ') {
        ldzTotal += amount;
      }
    }

    // Get project configuration (including treasury wallet) from database
    let treasuryWallet: string;
    
    // For development, use fallback treasury wallet
    treasuryWallet = process.env.TREASURY_WALLET!;
    console.log('💰 Using treasury wallet:', treasuryWallet);

    if (!treasuryWallet) {
      return apiResponse.error('Treasury wallet not configured', 500);
    }

    // Determine primary payment token and amount
    let primaryToken: 'SOL' | 'LDZ';
    let primaryAmount: number;
    let tokenMintAddress: string | undefined;

    if (paymentToken && totalAmount) {
      // Use provided payment info (for mixed payments, this would be called multiple times)
      primaryToken = paymentToken;
      primaryAmount = totalAmount;
      
      if (paymentToken === 'LDZ') {
        tokenMintAddress = process.env.LDZ_TOKEN_MINT;
        if (!tokenMintAddress) {
          return apiResponse.error('LDZ token mint not configured', 500);
        }
      }
    } else {
      // Auto-determine payment (for single token payments)
      if (solTotal > 0 && ldzTotal > 0) {
        return apiResponse.error('Mixed payment detected. Please specify paymentToken and totalAmount', 400);
      } else if (ldzTotal > 0) {
        primaryToken = 'LDZ';
        primaryAmount = ldzTotal;
        tokenMintAddress = process.env.LDZ_TOKEN_MINT;
        if (!tokenMintAddress) {
          return apiResponse.error('LDZ token mint not configured', 500);
        }
      } else {
        primaryToken = 'SOL';
        primaryAmount = solTotal;
      }
    }

    console.log('💰 Payment details:', {
      primaryToken,
      primaryAmount,
      solTotal,
      ldzTotal,
      tokenMintAddress: tokenMintAddress || 'N/A (SOL)',
      transactionType
    });

    // Build payment-only transaction (no metadata update)
    const partiallySignedTransaction = await transactionBuilder.buildPaymentTransaction({
      walletAddress,
      assetId,
      traitIds: traitIds,
      paymentAmount: primaryAmount.toString(),
      treasuryWallet,
      tokenMintAddress
    });

    // Validate the transaction
    const validation = transactionBuilder.validateTransaction(partiallySignedTransaction.transaction);
    if (!validation.valid) {
      return apiResponse.error(`Transaction validation failed: ${validation.error}`, 500);
    }

    // Simulate the transaction (skip in development)
    if (process.env.NODE_ENV === 'production') {
      const simulation = await transactionBuilder.simulateTransaction(partiallySignedTransaction.transaction);
      if (!simulation.success) {
        return apiResponse.error(`Transaction simulation failed: ${simulation.error}`, 400);
      }
    } else {
      console.log('⚠️ Skipping transaction simulation in development mode');
    }

    console.log('✅ Payment transaction built and validated successfully');

    // Return the payment-only transaction for user to sign
    return apiResponse.success({
      transaction: partiallySignedTransaction.transaction.serialize({ requireAllSignatures: false }).toString('base64'),
      reservationId,
      transactionType: 'payment',
      paymentDetails: {
        token: primaryToken,
        amount: primaryAmount,
        treasuryWallet,
        tokenMintAddress,
        totalSOL: solTotal,
        totalLDZ: ldzTotal,
        hasMixedPayment: solTotal > 0 && ldzTotal > 0
      },
      traits: traits.map(trait => ({
        id: trait.id,
        name: trait.name,
        priceAmount: trait.price_amount,
        priceToken: trait.price_token_id
      })),
      timeRemaining: reservationStatus.timeRemaining,
      validation: {
        hasPaymentInstruction: validation.hasPaymentInstruction,
        hasUpdateInstruction: validation.hasUpdateInstruction
      }
    });
  } catch (error) {
    console.error('❌ Transaction build error:', error);
    return apiResponse.handleError(error, {
      operation: 'build_transaction',
      type: 'transaction_build',
      walletAddress: body?.walletAddress,
      assetId: body?.assetId,
      reservationId: body?.reservationId,
    });
  }
}