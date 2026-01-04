import { NextRequest } from 'next/server';
import { TransactionBuilder } from '@/lib/services/transaction-builder';
import { InventoryManager } from '@/lib/services/inventory-manager';
import { TraitRepository } from '@/lib/repositories/traits';
import { ProjectRepository } from '@/lib/repositories/projects';
import { ProjectTokensService } from '@/lib/services/project-tokens';
import { createNFTService } from '@/lib/services/nft';
import { configService } from '@/lib/services/config';
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

    // Get project configuration (including treasury wallet) from dynamic config
    const treasuryWallet = await configService.getTreasuryWallet();
    console.log('💰 Using treasury wallet:', treasuryWallet);

    // Determine primary payment token and amount
    let primaryToken: 'SOL' | 'LDZ';
    let primaryAmount: number;
    let tokenMintAddress: string | undefined;

    if (paymentToken && totalAmount) {
      // Use provided payment info (for mixed payments, this would be called multiple times)
      primaryToken = paymentToken;
      primaryAmount = totalAmount;
      
      if (paymentToken === 'LDZ') {
        tokenMintAddress = await configService.getTokenMintAddress('LDZ');
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
        tokenMintAddress = await configService.getTokenMintAddress('LDZ');
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

    // Debug: Check token accounts exist before building transaction
    if (tokenMintAddress) {
      try {
        const { getAssociatedTokenAddress } = await import('@solana/spl-token');
        const { PublicKey, Connection } = await import('@solana/web3.js');
        
        const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
        const walletPubkey = new PublicKey(walletAddress);
        const treasuryPubkey = new PublicKey(treasuryWallet);
        const mintPubkey = new PublicKey(tokenMintAddress);
        
        const userTokenAccount = await getAssociatedTokenAddress(mintPubkey, walletPubkey);
        const treasuryTokenAccount = await getAssociatedTokenAddress(mintPubkey, treasuryPubkey);
        
        console.log('🔍 Token account check:', {
          userWallet: walletAddress,
          userTokenAccount: userTokenAccount.toString(),
          treasuryWallet,
          treasuryTokenAccount: treasuryTokenAccount.toString(),
          tokenMint: tokenMintAddress
        });
        
        // Check if accounts exist
        const userAccountInfo = await connection.getAccountInfo(userTokenAccount);
        const treasuryAccountInfo = await connection.getAccountInfo(treasuryTokenAccount);
        
        console.log('📊 Account existence check:', {
          userAccountExists: !!userAccountInfo,
          treasuryAccountExists: !!treasuryAccountInfo,
          userAccountData: userAccountInfo ? 'Has data' : 'No account',
          treasuryAccountData: treasuryAccountInfo ? 'Has data' : 'No account'
        });
        
        if (!userAccountInfo) {
          return apiResponse.error(`User does not have a ${primaryToken} token account. Please create one first.`, 400);
        }
        
        if (!treasuryAccountInfo) {
          console.warn('⚠️ Treasury token account does not exist - this may cause transaction failure');
        }
        
      } catch (accountCheckError) {
        console.error('❌ Token account check failed:', accountCheckError);
        // Continue anyway - let the transaction fail with more specific error
      }
    }

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

    // Simulate the transaction (temporarily disabled to debug account issues)
    if (false && process.env.NODE_ENV === 'production') {
      const simulation = await transactionBuilder.simulateTransaction(partiallySignedTransaction.transaction);
      if (!simulation.success) {
        return apiResponse.error(`Transaction simulation failed: ${simulation.error}`, 400);
      }
    } else {
      console.log('⚠️ Skipping transaction simulation - disabled for debugging');
    }

    console.log('✅ Payment transaction built and validated successfully');

    // Serialize the transaction with proper error handling
    let serializedTransaction: string;
    try {
      serializedTransaction = partiallySignedTransaction.transaction.serialize({ 
        requireAllSignatures: false,
        verifySignatures: false 
      }).toString('base64');
      console.log('✅ Transaction serialized successfully');
    } catch (serializationError) {
      console.error('❌ Transaction serialization failed:', serializationError);
      return apiResponse.error(`Transaction serialization failed: ${serializationError instanceof Error ? serializationError.message : 'Unknown error'}`, 500);
    }

    // Return the payment-only transaction for user to sign
    return apiResponse.success({
      transaction: serializedTransaction,
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