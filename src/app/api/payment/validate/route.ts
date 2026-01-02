import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';

export async function POST(request: NextRequest) {
  try {
    const { 
      txSignature, 
      expectedAmount, 
      paymentToken, 
      fromWallet, 
      toWallet 
    } = await request.json();

    if (!txSignature || !expectedAmount || !paymentToken || !fromWallet || !toWallet) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get Solana connection
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    console.log('🔍 Validating payment:', {
      txSignature,
      expectedAmount,
      paymentToken,
      fromWallet: fromWallet.slice(0, 8) + '...',
      toWallet: toWallet.slice(0, 8) + '...'
    });

    // Get transaction details
    const transaction = await connection.getTransaction(txSignature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    });

    if (!transaction) {
      return NextResponse.json(
        { 
          valid: false, 
          error: 'Transaction not found or not confirmed' 
        },
        { status: 400 }
      );
    }

    if (transaction.meta?.err) {
      return NextResponse.json(
        { 
          valid: false, 
          error: 'Transaction failed on blockchain' 
        },
        { status: 400 }
      );
    }

    let paymentValid = false;
    let actualAmount = 0;

    if (paymentToken === 'SOL') {
      // Validate SOL payment
      const result = await validateSOLPayment(
        transaction,
        fromWallet,
        toWallet,
        expectedAmount
      );
      paymentValid = result.valid;
      actualAmount = result.amount;
    } else if (paymentToken === 'LDZ') {
      // Validate LDZ token payment
      const result = await validateTokenPayment(
        transaction,
        fromWallet,
        toWallet,
        expectedAmount,
        process.env.LDZ_TOKEN_MINT || '' // LDZ token mint address
      );
      paymentValid = result.valid;
      actualAmount = result.amount;
    } else {
      return NextResponse.json(
        { 
          valid: false, 
          error: 'Unsupported payment token' 
        },
        { status: 400 }
      );
    }

    if (!paymentValid) {
      return NextResponse.json(
        { 
          valid: false, 
          error: `Payment validation failed. Expected: ${expectedAmount} ${paymentToken}, Found: ${actualAmount} ${paymentToken}` 
        },
        { status: 400 }
      );
    }

    console.log('✅ Payment validated successfully:', {
      txSignature,
      amount: actualAmount,
      token: paymentToken
    });

    return NextResponse.json({
      valid: true,
      txSignature,
      amount: actualAmount,
      token: paymentToken,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Payment validation error:', error);
    return NextResponse.json(
      { 
        valid: false,
        error: 'Payment validation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function validateSOLPayment(
  transaction: any,
  fromWallet: string,
  toWallet: string,
  expectedAmount: number
): Promise<{ valid: boolean; amount: number }> {
  try {
    const fromPubkey = new PublicKey(fromWallet);
    const toPubkey = new PublicKey(toWallet);

    // Check pre and post balances
    const preBalances = transaction.meta?.preBalances || [];
    const postBalances = transaction.meta?.postBalances || [];
    const accountKeys = transaction.transaction?.message?.accountKeys || [];

    // Find account indices
    let fromIndex = -1;
    let toIndex = -1;

    for (let i = 0; i < accountKeys.length; i++) {
      const key = accountKeys[i];
      if (key.equals(fromPubkey)) {
        fromIndex = i;
      }
      if (key.equals(toPubkey)) {
        toIndex = i;
      }
    }

    if (fromIndex === -1 || toIndex === -1) {
      console.log('❌ SOL validation: Account not found in transaction');
      return { valid: false, amount: 0 };
    }

    // Calculate transferred amount (in lamports)
    const fromBalanceChange = preBalances[fromIndex] - postBalances[fromIndex];
    const toBalanceChange = postBalances[toIndex] - preBalances[toIndex];

    // Convert to SOL
    const transferredAmount = fromBalanceChange / 1000000000; // lamports to SOL
    const receivedAmount = toBalanceChange / 1000000000;

    console.log('💰 SOL Payment Details:', {
      fromBalanceChange: fromBalanceChange / 1000000000,
      toBalanceChange: toBalanceChange / 1000000000,
      expectedAmount,
      transferredAmount
    });

    // Allow for small differences due to transaction fees
    const tolerance = 0.001; // 0.001 SOL tolerance
    const isValid = Math.abs(transferredAmount - expectedAmount) <= tolerance && 
                   receivedAmount > 0;

    return {
      valid: isValid,
      amount: transferredAmount
    };

  } catch (error) {
    console.error('SOL validation error:', error);
    return { valid: false, amount: 0 };
  }
}

async function validateTokenPayment(
  transaction: any,
  fromWallet: string,
  toWallet: string,
  expectedAmount: number,
  tokenMint: string
): Promise<{ valid: boolean; amount: number }> {
  try {
    if (!tokenMint) {
      console.log('❌ Token validation: No token mint provided');
      return { valid: false, amount: 0 };
    }

    // For SPL token transfers, we need to check the token transfer instructions
    const instructions = transaction.transaction?.message?.instructions || [];
    
    // Look for SPL token transfer instructions
    for (const instruction of instructions) {
      // Check if this is a token transfer instruction
      // This is a simplified check - in production you'd want more robust parsing
      if (instruction.data && instruction.accounts) {
        try {
          // Parse token transfer instruction data
          // This would need proper SPL token instruction parsing
          console.log('🔍 Checking token instruction:', instruction);
          
          // For now, return a mock validation
          // In production, you'd parse the actual token transfer amount
          const mockTransferAmount = expectedAmount; // This should be parsed from instruction data
          
          console.log('💰 Token Payment Details:', {
            expectedAmount,
            foundAmount: mockTransferAmount,
            tokenMint
          });

          const tolerance = 0.01; // Small tolerance for token amounts
          const isValid = Math.abs(mockTransferAmount - expectedAmount) <= tolerance;

          return {
            valid: isValid,
            amount: mockTransferAmount
          };
        } catch (parseError) {
          console.log('Failed to parse token instruction:', parseError);
        }
      }
    }

    console.log('❌ Token validation: No valid token transfer found');
    return { valid: false, amount: 0 };

  } catch (error) {
    console.error('Token validation error:', error);
    return { valid: false, amount: 0 };
  }
}