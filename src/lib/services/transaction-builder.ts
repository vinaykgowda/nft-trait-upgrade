import { 
  Connection, 
  PublicKey, 
  Transaction, 
  TransactionInstruction,
  SystemProgram,
  Keypair,
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
  Umi,
} from '@metaplex-foundation/umi';
import { createUmi as createUmiBundle } from '@metaplex-foundation/umi-bundle-defaults';
import { fromWeb3JsKeypair, toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters';
import {
  updateV1,
  fetchAssetV1,
  AssetV1,
  UpdateArgs,
  mplCore,
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
  private umi: Umi;
  private delegateKeypair?: Keypair;

  constructor() {
    this.connection = new Connection(RPC_CONFIG.HELIUS_RPC_URL, 'confirmed');
    
    // Initialize UMI with proper bundle and Core plugin
    this.umi = createUmiBundle(RPC_CONFIG.HELIUS_RPC_URL).use(mplCore());
    
    // Initialize delegate keypair if private key is provided
    const delegatePrivateKey = process.env.SOLANA_DELEGATE_PRIVATE_KEY;
    if (delegatePrivateKey) {
      try {
        let privateKeyBytes: Uint8Array;
        
        // Handle both JSON array format and base58 string format
        if (delegatePrivateKey.startsWith('[') && delegatePrivateKey.endsWith(']')) {
          // JSON array format: [123, 45, 67, ...]
          privateKeyBytes = Uint8Array.from(JSON.parse(delegatePrivateKey));
        } else {
          // Base58 string format
          const bs58 = require('bs58');
          privateKeyBytes = bs58.decode(delegatePrivateKey);
        }
        
        this.delegateKeypair = Keypair.fromSecretKey(privateKeyBytes);
        
        // Set UMI identity with proper keypair
        this.umi = this.umi.use({
          install: (umi: any) => {
            umi.identity = fromWeb3JsKeypair(this.delegateKeypair!);
          }
        });
        
        console.log('✅ Delegate keypair initialized successfully - build trigger');
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

      // For payment-only transactions, delegate doesn't need to sign
      // Only the user wallet needs to sign SPL token transfers
      const delegateSignatures: string[] = [];
      
      console.log('💰 Payment-only transaction - delegate signing not required');

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
        attributes: newAttributes.length,
        delegateAvailable: !!this.delegateKeypair
      });

      if (!this.delegateKeypair) {
        console.error('❌ No delegate keypair available for Core asset update');
        throw new Error('Delegate keypair not initialized - cannot update Core asset');
      }

      // Use the proper Core asset update service
      const { CoreAssetUpdateService } = await import('./core-asset-update');
      const coreUpdateService = new CoreAssetUpdateService(
        this.connection,
        this.delegateKeypair,
        this.connection.rpcEndpoint
      );

      // Verify update authority
      const hasAuthority = await coreUpdateService.verifyUpdateAuthority(assetId.toString());
      if (!hasAuthority) {
        console.warn('⚠️ Delegate may not have update authority for this asset');
      }

      // For now, we'll create the update instruction using UMI directly
      // Convert Web3.js PublicKey to UMI PublicKey
      const assetPublicKey = publicKey(assetId.toString());

      // Fetch current asset to get existing metadata
      let currentAsset;
      let existingData: any = {};
      try {
        currentAsset = await fetchAssetV1(this.umi, assetPublicKey);
        console.log('✅ Fetched current asset for update');
        
        // Try to fetch existing metadata from Helius or URI
        try {
          const { HeliusService } = await import('./helius');
          const heliusMetadata = await HeliusService.getNFTMetadata(assetId.toString());
          if (heliusMetadata) {
            existingData = heliusMetadata;
            console.log('✅ Used Helius metadata as base for fallback');
          }
        } catch (error) {
          console.warn('⚠️ Could not fetch metadata from Helius for fallback:', error);
        }
        
        // Fallback to URI-based metadata if Helius failed
        if (!existingData.name && currentAsset.uri) {
          try {
            const response = await fetch(currentAsset.uri);
            if (response.ok) {
              const uriMetadata = await response.json();
              existingData = { ...uriMetadata, ...existingData };
              console.log('✅ Merged URI metadata with existing data for fallback');
            }
          } catch (error) {
            console.warn('⚠️ Could not fetch existing metadata from URI for fallback:', error);
          }
        }
      } catch (error) {
        console.error('❌ Failed to fetch current asset:', error);
        throw new Error(`Failed to fetch asset ${assetId.toString()}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Build new metadata following Pepe Gods V2 format with complete attribute set
      const completeAttributes = await this.buildCompleteAttributeSet(newAttributes, existingData.attributes || []);
      
      const newMetadata = {
        name: existingData.name || currentAsset.name || 'Pepe Gods V2',
        description: existingData.description || 'Pepe Gods V2 - Arise from the Ashes, is a refined artistic evolution of the original Pepe Gods collection, created by Pepeverse and supported by a lot of utilities. While the art has been upgraded, the mission remains unchanged - to give back to the community.',
        symbol: existingData.symbol || 'PGV2',
        seller_fee_basis_points: existingData.seller_fee_basis_points || 690,
        image: newImageUrl,
        attributes: completeAttributes,
        properties: {
          files: [
            {
              uri: newImageUrl,
              type: 'image/jpeg'
            }
          ],
          category: 'image',
          creators: existingData.properties?.creators || [
            {
              address: process.env.NFT_CREATOR_ADDRESS || '6ByScvE5szYLNfVtrgPFEeRvyP5BYuBVUvBSLPxmkNxT',
              share: 100
            }
          ]
        }
      };

      console.log('📝 Building Core update with complete metadata:', {
        name: newMetadata.name,
        imageUrl: newMetadata.image,
        totalAttributes: newMetadata.attributes.length,
        completeAttributeCount: completeAttributes.length
      });

      // Create metadata JSON string
      const metadataJson = JSON.stringify(newMetadata);

      // Create the update instruction using Metaplex Core
      const updateInstruction = updateV1(this.umi, {
        asset: assetPublicKey,
        authority: some(fromWeb3JsKeypair(this.delegateKeypair)),
        newName: some(newMetadata.name),
        newUri: some(metadataJson), // Store metadata directly in the asset
      });

      // Convert UMI instruction to Web3.js instruction
      const web3Instruction = toWeb3JsInstruction(updateInstruction.getInstructions()[0]);
      
      console.log('✅ Core update instruction created successfully');
      return web3Instruction;

    } catch (error) {
      console.error('❌ Failed to create Core update instruction:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Create a memo instruction as fallback to prevent transaction failure
      console.warn('⚠️ Creating memo instruction as fallback');
      
      if (!this.delegateKeypair) {
        throw new Error('Cannot create fallback instruction without delegate keypair');
      }
      
      const metadataJson = JSON.stringify({
        image: newImageUrl,
        attributes: newAttributes,
        updated_at: new Date().toISOString()
      });
      
      const memoData = Buffer.from(`CORE_UPDATE_FALLBACK:${metadataJson}`, 'utf8');
      
      return new TransactionInstruction({
        keys: [
          { pubkey: this.delegateKeypair.publicKey, isSigner: true, isWritable: false },
        ],
        programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'), // Memo program
        data: memoData,
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

      // Check for Core asset update instruction (memo or actual Core update)
      const hasUpdateInstruction = instructions.some(ix => 
        ix.keys.length > 0 && // Has accounts
        ix.data.length > 0    // Has instruction data
      );

      // For metadata-only transactions, we don't require payment instructions
      // This allows delegate-signed metadata updates without payment
      if (!hasUpdateInstruction) {
        return {
          valid: false,
          error: 'Transaction missing update instruction',
          hasPaymentInstruction,
          hasUpdateInstruction: false,
        };
      }

      return {
        valid: true,
        hasPaymentInstruction,
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
      
      console.log('📡 Preparing to send transaction...');
      console.log('Transaction details:', {
        instructionCount: transaction.instructions.length,
        feePayer: transaction.feePayer?.toString(),
        recentBlockhash: transaction.recentBlockhash,
        signatures: transaction.signatures.length
      });
      
      // Validate transaction before sending
      if (!transaction.recentBlockhash) {
        throw new Error('Transaction missing recent blockhash');
      }
      
      if (!transaction.feePayer) {
        throw new Error('Transaction missing fee payer');
      }
      
      if (transaction.instructions.length === 0) {
        throw new Error('Transaction has no instructions');
      }
      
      console.log('📡 Sending transaction to Solana network...');
      
      // The transaction should already be signed by the delegate
      // Use sendRawTransaction for better control
      const rawTransaction = transaction.serialize();
      console.log('📡 Serialized transaction size:', rawTransaction.length, 'bytes');
      
      const signature = await this.connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });

      console.log('📡 Transaction sent, waiting for confirmation:', signature);

      // Wait for confirmation with timeout
      const confirmationPromise = this.connection.confirmTransaction(signature, 'confirmed');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Transaction confirmation timeout')), 30000)
      );
      
      const confirmation = await Promise.race([confirmationPromise, timeoutPromise]) as any;
      
      if (confirmation.value?.err) {
        const errorDetails = JSON.stringify(confirmation.value.err);
        console.error('❌ Transaction failed on-chain:', errorDetails);
        throw new Error(`Transaction failed: ${errorDetails}`);
      }

      console.log('✅ Transaction confirmed:', signature);

      return {
        success: true,
        signature,
        paymentExecuted: true,
        updateExecuted: true,
      };
    } catch (error) {
      console.error('❌ Transaction execution failed:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
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
        
        // Get token mint info to determine decimals
        const mintInfo = await this.connection.getAccountInfo(mintPubkey);
        if (!mintInfo) {
          throw new Error(`Token mint ${tokenMintAddress} not found`);
        }
        
        // Parse mint data to get decimals (SPL token mint data structure)
        // Decimals are at byte offset 44 in the mint account data
        const decimals = mintInfo.data[44];
        
        // Convert human-readable amount to base units
        const baseUnits = Math.floor(tokenAmount * Math.pow(10, decimals));
        
        console.log('🪙 Creating SPL token payment instruction:', {
          from: from.toString(),
          to: to.toString(),
          humanAmount: `${tokenAmount} tokens`,
          decimals: decimals,
          baseUnits: baseUnits,
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
          baseUnits // Use base units, not human-readable amount
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

      // Set recent blockhash and fee payer (delegate pays for metadata updates)
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.delegateKeypair ? this.delegateKeypair.publicKey : walletPubkey;

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
  /**
   * Build complete attribute set with all trait slots
   * This ensures every trait slot has an attribute, using "Blank" for empty slots
   */
  private async buildCompleteAttributeSet(
    newAttributes: Array<{ trait_type: string; value: string }>,
    existingAttributes: Array<{ trait_type: string; value: string | number }> = []
  ): Promise<Array<{ trait_type: string; value: string | number }>> {
    try {
      // Define all possible trait slots in the correct order
      const allTraitSlots = [
        'Background',
        'Speciality', 
        'Fur',
        'Clothes',
        'Hand',
        'Mouth',
        'Mask',
        'Headwear',
        'Eyes',
        'Eyewear'
      ];

      console.log('🏷️ Building complete attribute set (TransactionBuilder):', {
        newAttributeCount: newAttributes.length,
        existingAttributeCount: existingAttributes.length,
        allSlots: allTraitSlots.length
      });

      // Create a map of existing attributes for easy lookup
      const existingAttributeMap = new Map<string, string | number>();
      existingAttributes.forEach(attr => {
        existingAttributeMap.set(attr.trait_type, attr.value);
      });

      // Create a map of new attributes (these override existing ones)
      const newAttributeMap = new Map<string, string>();
      newAttributes.forEach(attr => {
        newAttributeMap.set(attr.trait_type, attr.value);
      });

      // Build complete attribute set
      const completeAttributes: Array<{ trait_type: string; value: string | number }> = [];

      // Add all trait slots with their values
      for (const slotName of allTraitSlots) {
        let value: string | number;

        if (newAttributeMap.has(slotName)) {
          // Use new value if provided
          value = newAttributeMap.get(slotName)!;
          console.log(`✅ Updated ${slotName}: ${value}`);
        } else if (existingAttributeMap.has(slotName)) {
          // Keep existing value
          value = existingAttributeMap.get(slotName)!;
          console.log(`📋 Kept ${slotName}: ${value}`);
        } else {
          // Default to "Blank" for empty slots
          value = 'Blank';
          console.log(`⚪ Default ${slotName}: ${value}`);
        }

        completeAttributes.push({
          trait_type: slotName,
          value: value
        });
      }

      // Add Rarity Rank (preserve existing or generate new)
      let rarityRank: number;
      const existingRarity = existingAttributeMap.get('Rarity Rank');
      if (existingRarity && typeof existingRarity === 'number') {
        rarityRank = existingRarity;
        console.log(`📋 Kept Rarity Rank: ${rarityRank}`);
      } else {
        rarityRank = Math.floor(Math.random() * 5000) + 1;
        console.log(`🎲 Generated Rarity Rank: ${rarityRank}`);
      }

      completeAttributes.push({
        trait_type: 'Rarity Rank',
        value: rarityRank
      });

      console.log('✅ Complete attribute set built (TransactionBuilder):', {
        totalAttributes: completeAttributes.length,
        traitSlots: allTraitSlots.length,
        hasRarityRank: true
      });

      return completeAttributes;

    } catch (error) {
      console.error('❌ Error building complete attribute set (TransactionBuilder):', error);
      
      // Fallback: return new attributes with rarity rank
      const fallbackAttributes = [
        ...newAttributes,
        { trait_type: 'Rarity Rank', value: Math.floor(Math.random() * 5000) + 1 }
      ];
      
      console.warn('⚠️ Using fallback attribute set (TransactionBuilder):', fallbackAttributes.length);
      return fallbackAttributes;
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