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
  publicKey,
  some,
  Umi,
  signerIdentity,
  createSignerFromKeypair,
} from '@metaplex-foundation/umi';
import { createUmi as createUmiBundle } from '@metaplex-foundation/umi-bundle-defaults';
import { fromWeb3JsKeypair, toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters';
import {
  updateV1,
  fetchAssetV1,
  fetchCollectionV1,
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
  newMetadataUri?: string; // ✅ optional: if not provided, we upload JSON to Irys inside builder
}

export interface TransactionResult {
  success: boolean;
  signature?: string;
  error?: string;
  paymentExecuted?: boolean;
  updateExecuted?: boolean;
}

export class TransactionBuilder {
  private connection: Connection;
  private umi: Umi;
  private delegateKeypair: Keypair | null = null;
  private initialized = false;

  constructor() {
    this.connection = new Connection(RPC_CONFIG.HELIUS_RPC_URL, 'confirmed');
    this.umi = createUmiBundle(RPC_CONFIG.HELIUS_RPC_URL).use(mplCore());
    this.initializeDelegateKeypair();
  }

  private initializeDelegateKeypair() {
    try {
      const delegatePrivateKey = process.env.SOLANA_DELEGATE_PRIVATE_KEY;
      if (!delegatePrivateKey) {
        console.warn('⚠️ SOLANA_DELEGATE_PRIVATE_KEY not set');
        return;
      }

      let secretKey: Uint8Array;
      if (delegatePrivateKey.startsWith('[')) {
        secretKey = Uint8Array.from(JSON.parse(delegatePrivateKey));
      } else {
        const bs58 = require('bs58');
        secretKey = bs58.decode(delegatePrivateKey);
      }

      this.delegateKeypair = Keypair.fromSecretKey(secretKey);

      const umiKeypair = fromWeb3JsKeypair(this.delegateKeypair);
      const signer = createSignerFromKeypair(this.umi, umiKeypair);
      this.umi = this.umi.use(signerIdentity(signer));

      console.log('✅ Delegate keypair and UMI signer initialized successfully - build trigger');
      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize delegate keypair:', error);
      this.delegateKeypair = null;
      this.initialized = false;
    }
  }

  async buildAtomicTransaction(data: AtomicTransactionData): Promise<Transaction> {
    if (!this.initialized || !this.delegateKeypair) {
      throw new Error('Delegate keypair not initialized');
    }

    const transaction = new Transaction();
    const walletPubkey = new PublicKey(data.walletAddress);
    const treasuryPubkey = new PublicKey(data.treasuryWallet);
    const assetPubkey = new PublicKey(data.assetId);

    console.log('🎨 Building metadata update transaction:', {
      wallet: data.walletAddress,
      treasury: data.treasuryWallet,
      amount: data.paymentAmount,
      token: data.tokenMintAddress || 'SOL',
      traits: data.traitIds.length
    });

    if (parseFloat(data.paymentAmount) > 0) {
      const paymentInstruction = await this.createPaymentInstruction(
        walletPubkey,
        treasuryPubkey,
        data.paymentAmount,
        data.tokenMintAddress
      );
      transaction.add(paymentInstruction);
    }

    if (data.newImageUrl && data.newAttributes && data.newAttributes.length > 0) {
      const coreUpdateInstruction = await this.createCoreUpdateInstruction(
        assetPubkey,
        data.newImageUrl,
        data.newAttributes,
        data.newMetadataUri
      );
      transaction.add(coreUpdateInstruction);
    }

    const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletPubkey;

    transaction.partialSign(this.delegateKeypair);

    console.log('✅ Atomic transaction built successfully');
    return transaction;
  }

  async buildPaymentTransaction(data: {
    walletAddress: string;
    assetId: string;
    traitIds: string[];
    paymentAmount: string;
    treasuryWallet: string;
    tokenMintAddress?: string;
  }): Promise<{ transaction: Transaction; requiredSignatures: string[]; delegateSignatures: string[] }> {
    if (!this.initialized || !this.delegateKeypair) {
      throw new Error('Delegate keypair not initialized');
    }

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

    if (parseFloat(data.paymentAmount) > 0) {
      const paymentInstruction = await this.createPaymentInstruction(
        walletPubkey,
        treasuryPubkey,
        data.paymentAmount,
        data.tokenMintAddress
      );
      transaction.add(paymentInstruction);
    }

    const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletPubkey;

    return {
      transaction,
      requiredSignatures: [data.walletAddress],
      delegateSignatures: []
    };
  }

  async createPaymentInstruction(
    walletPubkey: PublicKey,
    treasuryPubkey: PublicKey,
    amount: string,
    tokenMintAddress?: string
  ): Promise<TransactionInstruction> {
    const lamports = Math.floor(parseFloat(amount) * 1e9);

    if (!tokenMintAddress) {
      return SystemProgram.transfer({
        fromPubkey: walletPubkey,
        toPubkey: treasuryPubkey,
        lamports
      });
    }

    const mintPubkey = new PublicKey(tokenMintAddress);
    const fromAta = await getAssociatedTokenAddress(mintPubkey, walletPubkey);
    const toAta = await getAssociatedTokenAddress(mintPubkey, treasuryPubkey);

    return createTransferInstruction(
      fromAta,
      toAta,
      walletPubkey,
      lamports,
      [],
      TOKEN_PROGRAM_ID
    );
  }

  /**
   * ✅ FIXED:
   * - Upload metadata JSON to Irys when needed
   * - updateV1 uses newUri = metadata URL
   * - includes collection when updateAuthority is Collection (fixes Custom:25 MissingCollection)
   * - fallback memo is tiny (no JSON)
   */
  async createCoreUpdateInstruction(
    assetId: PublicKey,
    newImageUrl: string,
    newAttributes: Array<{ trait_type: string; value: string }>,
    newMetadataUri?: string
  ): Promise<TransactionInstruction> {
    try {
      console.log('🎨 Creating Core update instruction:', {
        asset: assetId.toString(),
        imageUrl: newImageUrl,
        attributes: newAttributes.length,
        delegateAvailable: !!this.delegateKeypair
      });

      if (!this.delegateKeypair) {
        throw new Error('No delegate keypair available for Core asset update');
      }

      const assetPublicKey = publicKey(assetId.toString());

      // Fetch current asset and merge metadata
      let currentAsset;
      let existingData: any = {};
      try {
        currentAsset = await fetchAssetV1(this.umi, assetPublicKey);
        console.log('✅ Fetched current asset for update');
        
        // Try Helius first
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

        // Fallback to URI JSON
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

      // Build complete attribute set
      const completeAttributes = await this.buildCompleteAttributeSet(newAttributes, existingData.attributes || []);

      const newMetadata = {
        name: existingData.name || currentAsset.name || 'Unknown',
        description: existingData.description || 'Pepe Gods V2 - Arise from the Ashes, is a refined artistic evolution of the original Pepe Gods collection, created by Pepeverse and supported by a lot of utilities. While the art has been upgraded, the mission remains unchanged - to give back to the community.',
        symbol: existingData.symbol || 'PGV2',
        seller_fee_basis_points: existingData.seller_fee_basis_points || 690,
        image: newImageUrl,
        external_url: existingData.external_url,
        attributes: completeAttributes,
        properties: {
          files: [{ uri: newImageUrl, type: 'image/webp' }],
          category: 'image',
          creators: existingData.properties?.creators || [
            {
              address: process.env.NFT_CREATOR_ADDRESS || '6ByScvE5szYLNfVtrgPFEeRvyP5BYuBVUvBSLPxmkNxT',
              share: 100
            }
          ]
        }
      };

      // Upload OFF-CHAIN metadata JSON to Pinata IPFS if caller did not provide a metadata URI.
      if (!newMetadataUri) {
        const { PinataUploadService } = await import('./pinata-upload');
        const pinata = new PinataUploadService();
        const uploaded = await pinata.uploadMetadata(newMetadata);

        newMetadataUri = uploaded.url;
        console.log('✅ Metadata JSON uploaded to Pinata IPFS:', newMetadataUri);
      }

      if (!newMetadataUri.startsWith('http')) {
        throw new Error(`Invalid newMetadataUri: ${newMetadataUri}`);
      }

      // Verify delegate has update authority before building the instruction
      const ua: any = (currentAsset as any)?.updateAuthority;
      const delegatePubkeyStr = this.delegateKeypair.publicKey.toString();

      let collectionForUpdate: any = undefined;

      if (ua?.type === 'Collection' && ua?.address) {
        // Collection-managed asset — fetch collection and verify delegate is collection update authority
        try {
          const collectionPk = publicKey(ua.address);
          collectionForUpdate = await fetchCollectionV1(this.umi, collectionPk);
          console.log('✅ Using collection for Core update:', collectionPk.toString());
        } catch (e) {
          throw new Error(
            `Failed to fetch collection ${ua.address} for asset ${assetId.toString()}. ` +
            `Cannot verify update authority. Cause: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      } else if (ua?.type === 'Address' && ua?.address) {
        // Direct update authority — verify delegate matches
        if (ua.address.toString() !== delegatePubkeyStr) {
          throw new Error(
            `Delegate authority mismatch: delegate=${delegatePubkeyStr}, ` +
            `asset updateAuthority=${ua.address.toString()}. Cannot update this asset.`
          );
        }
        console.log('✅ Delegate matches direct update authority');
      } else {
        console.warn('⚠️ Unknown update authority type, proceeding with delegate:', ua);
      }

      // ✅ Core update instruction (small)
      const updateInstruction = updateV1(this.umi, {
        asset: assetPublicKey,
        ...(collectionForUpdate ? { collection: collectionForUpdate } : {}),
        authority: createSignerFromKeypair(this.umi, fromWeb3JsKeypair(this.delegateKeypair)),
        newName: some(newMetadata.name),
        newUri: some(newMetadataUri),
      } as any);

      const web3Instruction = toWeb3JsInstruction(updateInstruction.getInstructions()[0]);

      console.log('✅ Core update instruction created successfully');
      return web3Instruction;

    } catch (error) {
      console.error('❌ Failed to create Core update instruction:', error);
      // HARD FAIL — never fall back to memo. A memo tx would succeed on-chain
      // but the NFT URI would remain unchanged, silently corrupting the upgrade.
      throw new Error(
        `METADATA_UPDATE_FAILED: Core updateV1 instruction could not be created. ` +
        `Asset: ${assetId.toString()}. Cause: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // (keep the rest of your file unchanged)
  async buildCompleteAttributeSet(
    newAttributes: Array<{ trait_type: string; value: string }>,
    existingAttributes: Array<{ trait_type: string; value: string | number }> = []
  ): Promise<Array<{ trait_type: string; value: string | number }>> {
    // your existing implementation here (unchanged)
    const allTraitSlots = [
      'Background','Speciality','Fur','Clothes','Hand','Mouth','Mask','Headwear','Eyes','Eyewear'
    ];

    const newAttributeMap = new Map<string, string>();
    for (const attr of newAttributes) newAttributeMap.set(attr.trait_type, attr.value);

    const existingAttributeMap = new Map<string, string | number>();
    for (const attr of existingAttributes) existingAttributeMap.set(attr.trait_type, attr.value);

    const completeAttributes: Array<{ trait_type: string; value: string | number }> = [];

    for (const slotName of allTraitSlots) {
      if (newAttributeMap.has(slotName)) {
        completeAttributes.push({ trait_type: slotName, value: newAttributeMap.get(slotName)! });
      } else if (existingAttributeMap.has(slotName)) {
        completeAttributes.push({ trait_type: slotName, value: existingAttributeMap.get(slotName)! });
      } else {
        completeAttributes.push({ trait_type: slotName, value: 'Blank' });
      }
    }

    const rarity = newAttributeMap.get('Rarity Rank') ?? existingAttributeMap.get('Rarity Rank');
    if (rarity !== undefined) completeAttributes.push({ trait_type: 'Rarity Rank', value: rarity });

    return completeAttributes;
  }

  validateTransaction(transaction: Transaction): { 
    valid: boolean; 
    error?: string; 
    hasPaymentInstruction: boolean; 
    hasUpdateInstruction: boolean; 
  } {
    try {
      if (!transaction.recentBlockhash) {
        return { 
          valid: false, 
          error: 'Missing recent blockhash',
          hasPaymentInstruction: false,
          hasUpdateInstruction: false
        };
      }
      
      if (!transaction.feePayer) {
        return { 
          valid: false, 
          error: 'Missing fee payer',
          hasPaymentInstruction: false,
          hasUpdateInstruction: false
        };
      }
      
      if (transaction.instructions.length === 0) {
        return { 
          valid: false, 
          error: 'No instructions in transaction',
          hasPaymentInstruction: false,
          hasUpdateInstruction: false
        };
      }

      const instructions = transaction.instructions;
      
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

      return { 
        valid: true,
        hasPaymentInstruction,
        hasUpdateInstruction
      };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Unknown validation error',
        hasPaymentInstruction: false,
        hasUpdateInstruction: false
      };
    }
  }

  async simulateTransaction(transaction: Transaction): Promise<TransactionResult> {
    try {
      const simulation = await this.connection.simulateTransaction(transaction);
      
      if (simulation.value.err) {
        return {
          success: false,
          error: `Simulation failed: ${JSON.stringify(simulation.value.err)}`,
          paymentExecuted: false,
          updateExecuted: false
        };
      }

      console.log('✅ Transaction simulation successful:', {
        unitsConsumed: simulation.value.unitsConsumed,
        logs: simulation.value.logs?.slice(0, 3)
      });

      return { 
        success: true,
        paymentExecuted: true,
        updateExecuted: true
      };
    } catch (error) {
      return {
        success: false,
        error: `Simulation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        paymentExecuted: false,
        updateExecuted: false
      };
    }
  }

  async sendAndConfirmTransaction(
    partiallySignedTransaction: { transaction: Transaction; requiredSignatures: string[]; delegateSignatures: string[] }
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
      
      const rawTransaction = transaction.serialize();
      console.log('📡 Serialized transaction size:', rawTransaction.length, 'bytes');
      
      const signature = await this.connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });

      console.log('📡 Transaction sent, waiting for confirmation:', signature);

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
        updateExecuted: true
      };
    } catch (error) {
      console.error('❌ Transaction execution failed:', error);
      return {
        success: false,
        error: `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        paymentExecuted: false,
        updateExecuted: false
      };
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
