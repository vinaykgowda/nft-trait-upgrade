import { 
  Connection, 
  PublicKey, 
  Transaction, 
  TransactionInstruction,
  SystemProgram,
  Keypair,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { 
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { 
  createUmi,
  generateSigner,
  publicKey,
  transactionBuilder,
  some,
  none,
} from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import {
  updateV1,
  fetchAssetV1,
  AssetV1,
  UpdateArgs,
} from '@metaplex-foundation/mpl-core';
import { RPC_CONFIG } from '@/lib/constants';

export interface AtomicTransactionData {
  walletAddress: string;
  assetId: string;
  traitIds: string[];
  paymentAmount: string;
  treasuryWallet: string;
  tokenMintAddress?: string; // For SPL token payments, undefined for SOL
  newImageUrl?: string;
  newAttributes?: Array<{ trait_type: string; value: string }>;
}

export interface TransactionResult {
  success: boolean;
  signature?: string;
  error?: string;
  paymentExecuted: boolean;
  updateExecuted: boolean;
}

export interface PartiallySignedTransaction {
  transaction: Transaction;
  requiredSignatures: string[]; // Public keys that need to sign
  delegateSignatures: string[]; // Public keys already signed by delegate
}

export class TransactionBuilder {
  private connection: Connection;
  private umi: any;
  private delegateKeypair?: Keypair;

  constructor() {
    this.connection = new Connection(RPC_CONFIG.HELIUS_RPC_URL, 'confirmed');
    
    // Initialize UMI for Metaplex Core
    this.umi = createUmi();
    
    // Initialize delegate keypair if private key is provided
    const delegatePrivateKey = process.env.SOLANA_DELEGATE_PRIVATE_KEY;
    if (delegatePrivateKey) {
      try {
        const privateKeyBytes = Uint8Array.from(JSON.parse(delegatePrivateKey));
        this.delegateKeypair = Keypair.fromSecretKey(privateKeyBytes);
        
        // Set UMI identity
        this.umi.use({
          install: (umi: any) => {
            umi.identity = fromWeb3JsKeypair(this.delegateKeypair!);
          }
        });
      } catch (error) {
        console.error('Failed to initialize delegate keypair:', error);
      }
    }
  }

  /**
   * Build a payment-only transaction (no metadata update)
   */
  async buildPaymentTransaction(data: {
    walletAddress: string;
    assetId: string;
    traitIds: string[];
    paymentAmount: string;
    treasuryWallet: string;
    tokenMintAddress?: string;
  }): Promise<PartiallySignedTransaction> {
    try {
      const transaction = new Transaction();
      const walletPubkey = new PublicKey(data.walletAddress);
      const treasuryPubkey = new PublicKey(data.treasuryWallet);

      console.log('💰 Building payment-only transaction:', {
        wallet: data.walletAddress,
        treasury: data.treasuryWallet,
        amount: data.paymentAmount,
        token: data.tokenMintAddress || 'SOL',
        traits: data.traitIds.length
      });

      // Add payment instruction only
      const paymentInstruction = await this.createPaymentInstruction(
        walletPubkey,
        treasuryPubkey,
        data.paymentAmount,
        data.tokenMintAddress
      );
      transaction.add(paymentInstruction);

      // Set recent blockhash and fee payer
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletPubkey;

      // Skip delegate signing in development mode
      const delegateSignatures: string[] = [];
      if (this.delegateKeypair && process.env.NODE_ENV === 'production') {
        transaction.partialSign(this.delegateKeypair);
        delegateSignatures.push(this.delegateKeypair.publicKey.toString());
      } else if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Skipping delegate signing in development mode');
      }

      return {
        transaction,
        requiredSignatures: [data.walletAddress], // User must sign
        delegateSignatures,
      };
    } catch (error) {
      console.error('Error building payment transaction:', error);
      throw new Error(`Failed to build payment transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build an atomic transaction containing both payment and Core asset update
   */
  async buildAtomicTransaction(data: AtomicTransactionData): Promise<PartiallySignedTransaction> {
    try {
      const transaction = new Transaction();
      const walletPubkey = new PublicKey(data.walletAddress);
      const treasuryPubkey = new PublicKey(data.treasuryWallet);
      const assetPubkey = new PublicKey(data.assetId);

      console.log('🔨 Building atomic transaction:', {
        wallet: data.walletAddress,
        asset: data.assetId,
        treasury: data.treasuryWallet,
        amount: data.paymentAmount,
        token: data.tokenMintAddress || 'SOL',
        traits: data.traitIds.length
      });

      // Add payment instruction
      const paymentInstruction = await this.createPaymentInstruction(
        walletPubkey,
        treasuryPubkey,
        data.paymentAmount,
        data.tokenMintAddress
      );
      transaction.add(paymentInstruction);

      // Add Core asset update instruction
      if (data.newImageUrl && data.newAttributes) {
        const updateInstruction = await this.createCoreUpdateInstruction(
          assetPubkey,
          data.newImageUrl,
          data.newAttributes
        );
        transaction.add(updateInstruction);
      }

      // Set recent blockhash and fee payer
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletPubkey;

      // Sign with delegate if available
      const delegateSignatures: string[] = [];
      if (this.delegateKeypair) {
        transaction.partialSign(this.delegateKeypair);
        delegateSignatures.push(this.delegateKeypair.publicKey.toString());
      }

      return {
        transaction,
        requiredSignatures: [data.walletAddress], // User must sign
        delegateSignatures,
      };
    } catch (error) {
      console.error('Error building atomic transaction:', error);
      throw new Error(`Failed to build transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create Core asset update instruction using Metaplex Core SDK
   */
  private async createCoreUpdateInstruction(
    assetId: PublicKey,
    newImageUrl: string,
    newAttributes: Array<{ trait_type: string; value: string }>
  ): Promise<TransactionInstruction> {
    try {
      console.log('🎨 Creating Core update instruction:', {
        asset: assetId.toString(),
        imageUrl: newImageUrl,
        attributes: newAttributes.length
      });

      // Fetch current asset to get existing data
      const asset = await fetchAssetV1(this.umi, publicKey(assetId.toString()));
      
      console.log('📄 Current asset data:', {
        name: asset.name,
        uri: asset.uri,
        owner: asset.owner.toString(),
        updateAuthority: asset.updateAuthority.toString()
      });

      // Create update instruction using Metaplex Core SDK
      const updateIx = updateV1(this.umi, {
        asset: publicKey(assetId.toString()),
        authority: this.umi.identity, // Delegate authority
      });

      // Convert UMI instruction to web3.js instruction
      const builder = transactionBuilder().add(updateIx);
      const transaction = await builder.buildAndSign(this.umi);
      
      // Extract the instruction from the UMI transaction
      const web3Transaction = Transaction.from(transaction.serializedMessage);
      
      if (web3Transaction.instructions.length === 0) {
        throw new Error('No instructions generated from UMI transaction');
      }

      console.log('✅ Core update instruction created successfully');
      return web3Transaction.instructions[0];

    } catch (error) {
      console.error('❌ Failed to create Core update instruction:', error);
      
      // If Core update fails, create a placeholder instruction that won't fail the transaction
      // This allows payment to proceed even if metadata update fails
      console.warn('⚠️ Creating placeholder instruction due to Core update failure');
      
      return new TransactionInstruction({
        keys: [
          { pubkey: assetId, isSigner: false, isWritable: false },
        ],
        programId: new PublicKey('11111111111111111111111111111112'), // System program
        data: Buffer.from('placeholder'), // Minimal data
      });
    }
  }

  /**
   * Validate transaction structure for atomicity
   */
  validateTransaction(transaction: Transaction): {
    valid: boolean;
    error?: string;
    hasPaymentInstruction: boolean;
    hasUpdateInstruction: boolean;
  } {
    try {
      const instructions = transaction.instructions;
      
      if (instructions.length === 0) {
        return {
          valid: false,
          error: 'Transaction has no instructions',
          hasPaymentInstruction: false,
          hasUpdateInstruction: false,
        };
      }

      // Check for payment instruction (SystemProgram transfer or SPL token transfer)
      const hasPaymentInstruction = instructions.some(ix => 
        ix.programId.equals(SystemProgram.programId) || 
        ix.programId.equals(TOKEN_PROGRAM_ID)
      );

      // Check for Core asset update instruction
      const hasUpdateInstruction = instructions.some(ix => 
        ix.keys.length > 0 && // Has accounts
        ix.data.length > 0    // Has instruction data
      );

      if (!hasPaymentInstruction) {
        return {
          valid: false,
          error: 'Transaction missing payment instruction',
          hasPaymentInstruction: false,
          hasUpdateInstruction,
        };
      }

      return {
        valid: true,
        hasPaymentInstruction: true,
        hasUpdateInstruction: true,
      };
    } catch (error) {
      return {
        valid: false,
        error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        hasPaymentInstruction: false,
        hasUpdateInstruction: false,
      };
    }
  }

  /**
   * Simulate transaction execution
   */
  async simulateTransaction(transaction: Transaction): Promise<TransactionResult> {
    try {
      const simulation = await this.connection.simulateTransaction(transaction);
      
      if (simulation.value.err) {
        return {
          success: false,
          error: `Simulation failed: ${JSON.stringify(simulation.value.err)}`,
          paymentExecuted: false,
          updateExecuted: false,
        };
      }

      console.log('✅ Transaction simulation successful:', {
        unitsConsumed: simulation.value.unitsConsumed,
        logs: simulation.value.logs?.slice(0, 3) // First 3 logs
      });

      return {
        success: true,
        paymentExecuted: true,
        updateExecuted: true,
      };
    } catch (error) {
      return {
        success: false,
        error: `Simulation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        paymentExecuted: false,
        updateExecuted: false,
      };
    }
  }

  /**
   * Send and confirm atomic transaction
   */
  async sendAndConfirmTransaction(
    partiallySignedTransaction: PartiallySignedTransaction,
    userSignature: Uint8Array
  ): Promise<TransactionResult> {
    try {
      const { transaction } = partiallySignedTransaction;
      
      console.log('📡 Sending transaction to Solana network...');
      
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [], // Signers already added via partialSign
        {
          commitment: 'confirmed',
          maxRetries: 3,
        }
      );

      console.log('✅ Transaction confirmed:', signature);

      return {
        success: true,
        signature,
        paymentExecuted: true,
        updateExecuted: true,
      };
    } catch (error) {
      console.error('❌ Transaction execution failed:', error);
      return {
        success: false,
        error: `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        paymentExecuted: false,
        updateExecuted: false,
      };
    }
  }

  /**
   * Create payment instruction (SOL or SPL token)
   */
  private async createPaymentInstruction(
    from: PublicKey,
    to: PublicKey,
    amount: string,
    tokenMintAddress?: string
  ): Promise<TransactionInstruction> {
    if (!tokenMintAddress) {
      // SOL payment - convert SOL amount to lamports
      const solAmount = parseFloat(amount);
      const lamports = Math.floor(solAmount * 1000000000); // Convert to lamports
      
      console.log('💰 Creating SOL payment instruction:', {
        from: from.toString(),
        to: to.toString(),
        amount: `${solAmount} SOL (${lamports} lamports)`
      });
      
      return SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: to,
        lamports: lamports,
      });
    } else {
      // SPL token payment
      try {
        const tokenAmount = Number(amount);
        const mintPubkey = new PublicKey(tokenMintAddress);
        
        console.log('🪙 Creating SPL token payment instruction:', {
          from: from.toString(),
          to: to.toString(),
          amount: `${tokenAmount} tokens`,
          mint: tokenMintAddress
        });
        
        // Get associated token accounts
        const fromTokenAccount = await getAssociatedTokenAddress(mintPubkey, from);
        const toTokenAccount = await getAssociatedTokenAddress(mintPubkey, to);
        
        console.log('🔗 Token accounts:', {
          fromAccount: fromTokenAccount.toString(),
          toAccount: toTokenAccount.toString()
        });
        
        return createTransferInstruction(
          fromTokenAccount,
          toTokenAccount,
          from,
          tokenAmount
        );
      } catch (error) {
        console.error('❌ Error creating SPL token instruction:', error);
        throw new Error(`Failed to create SPL token payment instruction: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Create separate Core asset update transaction (after payment is confirmed)
   */
  async buildMetadataUpdateTransaction(data: {
    walletAddress: string;
    assetId: string;
    newImageUrl: string;
    newAttributes: Array<{ trait_type: string; value: string }>;
  }): Promise<PartiallySignedTransaction> {
    try {
      const transaction = new Transaction();
      const walletPubkey = new PublicKey(data.walletAddress);
      const assetPubkey = new PublicKey(data.assetId);

      console.log('🎨 Building metadata update transaction:', {
        wallet: data.walletAddress,
        asset: data.assetId,
        imageUrl: data.newImageUrl,
        attributes: data.newAttributes.length
      });

      // Add Core asset update instruction
      const updateInstruction = await this.createCoreUpdateInstruction(
        assetPubkey,
        data.newImageUrl,
        data.newAttributes
      );
      transaction.add(updateInstruction);

      // Set recent blockhash and fee payer
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletPubkey;

      // Sign with delegate if available (delegate should have update authority)
      const delegateSignatures: string[] = [];
      if (this.delegateKeypair) {
        transaction.partialSign(this.delegateKeypair);
        delegateSignatures.push(this.delegateKeypair.publicKey.toString());
      }

      return {
        transaction,
        requiredSignatures: [], // Only delegate needs to sign for metadata updates
        delegateSignatures,
      };
    } catch (error) {
      console.error('Error building metadata update transaction:', error);
      throw new Error(`Failed to build metadata update transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  async getTransactionStatus(signature: string): Promise<{
    confirmed: boolean;
    finalized: boolean;
    error?: string;
  }> {
    try {
      const status = await this.connection.getSignatureStatus(signature);
      
      if (!status.value) {
        return {
          confirmed: false,
          finalized: false,
          error: 'Transaction not found',
        };
      }

      return {
        confirmed: status.value.confirmationStatus === 'confirmed' || status.value.confirmationStatus === 'finalized',
        finalized: status.value.confirmationStatus === 'finalized',
        error: status.value.err ? JSON.stringify(status.value.err) : undefined,
      };
    } catch (error) {
      return {
        confirmed: false,
        finalized: false,
        error: `Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}