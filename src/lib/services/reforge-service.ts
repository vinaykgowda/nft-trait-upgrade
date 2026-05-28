import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { ReforgeOrderRepository } from '@/lib/repositories/reforge-orders';
import { ReforgePackRepository } from '@/lib/repositories/reforge-packs';
import { ReforgeCombinationRepository } from '@/lib/repositories/reforge-combinations';
import { ProjectRepository } from '@/lib/repositories/projects';
import { TraitSlotRepository } from '@/lib/repositories/trait-slots';
import { TraitSelectorService } from './trait-selector';
import { ReforgeOrderManager } from './reforge-order-manager';
import { PackManager } from './pack-manager';
import { EncryptionService } from './encryption';
import { ImageCompositionService } from './image-composition';
import { PinataUploadService } from './pinata-upload';
import { CoreAssetUpdateService } from './core-asset-update';
import {
  ReforgeOrder,
  ReforgeOrderWithPack,
  ReforgeResult,
  SelectedTrait,
  ReforgeError,
} from '@/types/reforge';
import { TraitSlot } from '@/types';
import { RPC_CONFIG } from '@/lib/constants';
import { randomUUID } from 'crypto';

const MAX_TRAIT_SELECTION_ATTEMPTS = 100;
const MAX_COMBINATION_UNIQUENESS_ATTEMPTS = 50;
const MAX_METADATA_UPDATE_RETRIES = 3;

export class ReforgeService {
  private orderRepository: ReforgeOrderRepository;
  private packRepository: ReforgePackRepository;
  private combinationRepository: ReforgeCombinationRepository;
  private projectRepository: ProjectRepository;
  private traitSlotRepository: TraitSlotRepository;
  private traitSelector: TraitSelectorService;
  private orderManager: ReforgeOrderManager;
  private packManager: PackManager;
  private encryptionService: EncryptionService;
  private imageCompositionService: ImageCompositionService;
  private pinataUploadService: PinataUploadService;

  constructor(deps?: {
    orderRepository?: ReforgeOrderRepository;
    packRepository?: ReforgePackRepository;
    combinationRepository?: ReforgeCombinationRepository;
    projectRepository?: ProjectRepository;
    traitSlotRepository?: TraitSlotRepository;
    traitSelector?: TraitSelectorService;
    orderManager?: ReforgeOrderManager;
    packManager?: PackManager;
    encryptionService?: EncryptionService;
    imageCompositionService?: ImageCompositionService;
    pinataUploadService?: PinataUploadService;
  }) {
    this.orderRepository = deps?.orderRepository || new ReforgeOrderRepository();
    this.packRepository = deps?.packRepository || new ReforgePackRepository();
    this.combinationRepository = deps?.combinationRepository || new ReforgeCombinationRepository();
    this.projectRepository = deps?.projectRepository || new ProjectRepository();
    this.traitSlotRepository = deps?.traitSlotRepository || new TraitSlotRepository();
    this.traitSelector = deps?.traitSelector || new TraitSelectorService();
    this.orderManager = deps?.orderManager || new ReforgeOrderManager();
    this.packManager = deps?.packManager || new PackManager();
    this.encryptionService = deps?.encryptionService || new EncryptionService();
    this.imageCompositionService = deps?.imageCompositionService || new ImageCompositionService();
    this.pinataUploadService = deps?.pinataUploadService || new PinataUploadService();
  }

  /**
   * Initiate a pack purchase. Validates auth, checks inventory, and builds a SOL payment transaction.
   *
   * Steps:
   * 1. Validate wallet address and discord ID are provided
   * 2. Use PackManager.validatePurchase to check pack is enabled and has inventory
   * 3. Build a SOL transfer transaction from user's wallet to treasury wallet
   * 4. Return the unsigned transaction and a temporary order ID
   */
  async initiatePurchase(
    packId: string,
    walletAddress: string,
    discordId: string
  ): Promise<{ transaction: Transaction; orderId: string }> {
    // Step 1: Validate auth - wallet and discord must be provided
    if (!walletAddress || walletAddress.trim() === '') {
      throw this.createError('AUTH_REQUIRED', 'Wallet address is required');
    }
    if (!discordId || discordId.trim() === '') {
      throw this.createError('AUTH_REQUIRED', 'Discord ID is required');
    }

    // Step 2: Validate pack is enabled and has inventory
    const pack = await this.packManager.validatePurchase(packId);

    // Step 3: Build SOL transfer transaction
    const treasuryWallet = process.env.TREASURY_WALLET;
    if (!treasuryWallet) {
      throw this.createError('CONFIGURATION_ERROR', 'Treasury wallet not configured');
    }

    const connection = new Connection(RPC_CONFIG.HELIUS_RPC_URL, 'confirmed');
    const walletPubkey = new PublicKey(walletAddress);
    const treasuryPubkey = new PublicKey(treasuryWallet);

    const lamports = Math.floor(pack.solPrice * 1e9);

    const transaction = new Transaction();
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: walletPubkey,
        toPubkey: treasuryPubkey,
        lamports,
      })
    );

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletPubkey;

    // Step 4: Generate a temporary order ID
    const orderId = randomUUID();

    return { transaction, orderId };
  }

  /**
   * Confirm a pack purchase after the user has signed and submitted the transaction.
   *
   * Steps:
   * 1. Verify the transaction signature on-chain (check it's confirmed)
   * 2. Create a ReforgeOrder with status 'bought'
   * 3. Decrement pack inventory atomically using optimistic locking
   * 4. If inventory decrement fails (returns null), the pack is sold out - return PACK_SOLD_OUT error
   * 5. Return the created order
   */
  async confirmPurchase(
    orderId: string,
    txSignature: string,
    packId: string,
    walletAddress: string,
    discordId: string
  ): Promise<ReforgeOrder> {
    // Step 1: Verify the transaction on-chain
    const connection = new Connection(RPC_CONFIG.HELIUS_RPC_URL, 'confirmed');
    const status = await connection.getSignatureStatus(txSignature);

    const isConfirmed =
      status.value?.confirmationStatus === 'confirmed' ||
      status.value?.confirmationStatus === 'finalized';

    if (!isConfirmed || status.value?.err) {
      throw this.createError(
        'TRANSACTION_NOT_CONFIRMED',
        'Payment transaction is not confirmed on-chain',
        orderId,
        true
      );
    }

    // Step 3: Decrement pack inventory atomically (do this before creating order)
    const updatedPack = await this.packManager.decrementInventory(packId);
    if (!updatedPack) {
      throw this.createError('PACK_SOLD_OUT', 'This pack is sold out', orderId, false);
    }

    // Step 2: Create a ReforgeOrder with status 'bought'
    const orderRow = await this.orderRepository.create({
      id: orderId,
      pack_id: packId,
      wallet_address: walletAddress,
      discord_id: discordId,
      status: 'bought',
      used: false,
      purchase_tx_signature: txSignature,
    });

    // Step 5: Return the created order
    return this.orderRepository.toDomain(orderRow);
  }

  /**
   * Execute the full reforge workflow for a purchased pack.
   *
   * Steps:
   * 1. Validate order exists and is in 'bought' state
   * 2. Mark order as used, set asset ID
   * 3. Transition order to 'started_reforge'
   * 4. Select traits from pool (up to 100 attempts via TraitSelectorService)
   * 5. Check combination uniqueness (up to 50 attempts, re-selecting traits each time)
   * 6. Record the unique combination
   * 7. Compose image using ImageCompositionService
   * 8. Upload image to Pinata
   * 9. Build metadata JSON
   * 10. Upload metadata to Pinata
   * 11. Decrypt project's Update Authority key
   * 12. Update on-chain metadata (up to 3 retries)
   * 13. Transition order to 'completed'
   * 14. Return ReforgeResult
   */
  async executeReforge(orderId: string, assetId: string): Promise<ReforgeResult> {
    // Step 1: Validate order exists and is in 'bought' state
    const orderRow = await this.orderRepository.findById(orderId);
    if (!orderRow) {
      throw this.createError('ORDER_NOT_FOUND', `Order ${orderId} not found`, orderId);
    }
    if (orderRow.status !== 'bought') {
      throw this.createError(
        'INVALID_ORDER_STATE',
        `Order ${orderId} is in state '${orderRow.status}', expected 'bought'`,
        orderId
      );
    }
    if (orderRow.used) {
      throw this.createError(
        'INVALID_ORDER_STATE',
        `Order ${orderId} has already been used`,
        orderId
      );
    }

    try {
      // Step 2: Mark order as used, set asset ID
      await this.orderRepository.markUsed(orderId, assetId);

      // Step 3: Transition order to 'started_reforge'
      await this.orderManager.transitionOrder(orderId, 'started_reforge');

      // Get pack details for earning range
      const packRow = await this.packRepository.findById(orderRow.pack_id);
      if (!packRow) {
        throw this.createError('PACK_NOT_FOUND', `Pack ${orderRow.pack_id} not found`, orderId);
      }
      const minLdz = parseFloat(packRow.min_ldz_earning);
      const maxLdz = parseFloat(packRow.max_ldz_earning);
      const collectionId = packRow.collection_id;

      // Steps 4 & 5: Select traits and check combination uniqueness
      const selectedTraits = await this.selectUniqueTraitCombination(
        collectionId,
        minLdz,
        maxLdz,
        orderId
      );

      // Step 6: Record the unique combination
      const traitIds = selectedTraits.map((t) => t.traitId);
      await this.combinationRepository.recordCombination(orderId, collectionId, traitIds);

      // Step 7: Compose image using ImageCompositionService
      const slots = await this.getTraitSlots();
      const traitSelection = this.buildTraitSelection(selectedTraits);
      const compositionResult = await this.imageCompositionService.composeImage(
        '', // empty base - use transparent base
        traitSelection,
        slots,
        {
          width: 1500,
          height: 1500,
          format: 'webp',
          quality: 90,
          forceTransparentBase: true,
        }
      );

      // Step 8: Upload image to Pinata
      const imageUploadResult = await this.pinataUploadService.uploadImage(
        compositionResult.imageBuffer,
        'image/webp',
        { orderId, assetId }
      );
      const imageUrl = imageUploadResult.url;

      // Steps 9 & 10: Build metadata JSON and upload to Pinata
      const metadata = this.buildMetadata(selectedTraits, imageUrl, assetId);
      const metadataUploadResult = await this.pinataUploadService.uploadMetadata(metadata);
      const metadataUrl = metadataUploadResult.url;

      // Step 11: Decrypt project's Update Authority key
      const project = await this.projectRepository.findByCollectionId(collectionId);
      if (!project) {
        throw this.createError(
          'PROJECT_NOT_FOUND',
          `No project found for collection ${collectionId}`,
          orderId
        );
      }
      const encryptedKey = (project as any).encrypted_update_authority;
      if (!encryptedKey) {
        throw this.createError(
          'ENCRYPTION_ERROR',
          'Project does not have an encrypted update authority key configured',
          orderId
        );
      }
      const privateKeyStr = this.encryptionService.decrypt(encryptedKey);
      const updateAuthorityKeypair = this.parseKeypair(privateKeyStr);

      // Step 12: Update on-chain metadata (up to 3 retries)
      const txSignature = await this.updateMetadataWithRetry(
        assetId,
        metadataUrl,
        updateAuthorityKeypair,
        orderId
      );

      // Step 13: Transition order to 'completed'
      await this.orderManager.transitionOrder(orderId, 'completed');

      // Step 14: Return ReforgeResult
      return {
        orderId,
        selectedTraits,
        imageUrl,
        metadataUrl,
        txSignature,
      };
    } catch (error) {
      // If any step fails, transition order to 'failed' with failure reason
      const failureReason = error instanceof Error ? error.message : 'Unknown error';
      try {
        await this.orderManager.transitionOrder(orderId, 'failed', failureReason);
      } catch (transitionError) {
        // Log but don't throw - the original error is more important
        console.error('Failed to transition order to failed state:', transitionError);
      }
      throw error;
    }
  }

  /**
   * Get orders for a wallet address with pack tier information for profile display.
   */
  async getOrdersByWallet(walletAddress: string): Promise<ReforgeOrderWithPack[]> {
    const rows = await this.orderRepository.findByWalletWithPack(walletAddress);
    return rows.map((row) => this.orderRepository.toDomainWithPack(row));
  }

  /**
   * Get a single order's status.
   */
  async getOrderStatus(orderId: string): Promise<ReforgeOrder> {
    const row = await this.orderRepository.findById(orderId);
    if (!row) {
      throw this.createError('ORDER_NOT_FOUND', `Order ${orderId} not found`, orderId);
    }
    return this.orderRepository.toDomain(row);
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Select a unique trait combination with retry logic.
   * - Trait selection: up to MAX_TRAIT_SELECTION_ATTEMPTS (100) attempts (handled by TraitSelectorService)
   * - Combination uniqueness: up to MAX_COMBINATION_UNIQUENESS_ATTEMPTS (50) attempts,
   *   re-selecting traits each time
   */
  private async selectUniqueTraitCombination(
    collectionId: string,
    minLdz: number,
    maxLdz: number,
    orderId: string
  ): Promise<SelectedTrait[]> {
    for (let attempt = 0; attempt < MAX_COMBINATION_UNIQUENESS_ATTEMPTS; attempt++) {
      // TraitSelectorService internally retries up to 100 times
      const selectedTraits = await this.traitSelector.selectTraits(collectionId, minLdz, maxLdz);
      const traitIds = selectedTraits.map((t) => t.traitId);

      const isUnique = await this.combinationRepository.isUnique(collectionId, traitIds);
      if (isUnique) {
        return selectedTraits;
      }
    }

    throw this.createError(
      'COMBINATION_EXHAUSTED',
      `Could not find a unique trait combination after ${MAX_COMBINATION_UNIQUENESS_ATTEMPTS} attempts`,
      orderId
    );
  }

  /**
   * Update on-chain metadata with retry logic (up to 3 retries).
   */
  private async updateMetadataWithRetry(
    assetId: string,
    metadataUrl: string,
    updateAuthorityKeypair: Keypair,
    orderId: string
  ): Promise<string> {
    const connection = new Connection(RPC_CONFIG.HELIUS_RPC_URL, 'confirmed');
    const coreAssetUpdateService = new CoreAssetUpdateService(
      connection,
      updateAuthorityKeypair
    );

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_METADATA_UPDATE_RETRIES; attempt++) {
      try {
        const result = await coreAssetUpdateService.updateAssetUri(assetId, metadataUrl);
        if (result.success) {
          return result.signature;
        }
        lastError = new Error('Metadata update returned success=false');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(
          `Metadata update attempt ${attempt}/${MAX_METADATA_UPDATE_RETRIES} failed:`,
          lastError.message
        );

        // Wait before retrying (exponential backoff)
        if (attempt < MAX_METADATA_UPDATE_RETRIES) {
          await this.delay(1000 * Math.pow(2, attempt - 1));
        }
      }
    }

    throw this.createError(
      'METADATA_UPDATE_FAILED',
      `On-chain metadata update failed after ${MAX_METADATA_UPDATE_RETRIES} retries: ${lastError?.message}`,
      orderId
    );
  }

  /**
   * Get all trait slots ordered by layer order.
   */
  private async getTraitSlots(): Promise<TraitSlot[]> {
    const rows = await this.traitSlotRepository.findAllOrdered();
    return rows.map((row) => this.traitSlotRepository.toDomain(row));
  }

  /**
   * Build a TraitSelection map (slotId → Trait-like object) for ImageCompositionService.
   */
  private buildTraitSelection(
    selectedTraits: SelectedTrait[]
  ): Record<string, { id: string; slotId: string; name: string; imageLayerUrl: string }> {
    const selection: Record<string, { id: string; slotId: string; name: string; imageLayerUrl: string }> = {};
    for (const trait of selectedTraits) {
      selection[trait.slotId] = {
        id: trait.traitId,
        slotId: trait.slotId,
        name: trait.traitName,
        imageLayerUrl: trait.imageUrl,
      };
    }
    return selection;
  }

  /**
   * Build NFT metadata from selected traits.
   */
  private buildMetadata(
    selectedTraits: SelectedTrait[],
    imageUrl: string,
    _assetId: string
  ) {
    const attributes = selectedTraits.map((trait) => ({
      trait_type: trait.slotName,
      value: trait.traitName,
    }));

    return {
      name: 'Reforged NFT',
      description: 'Reforged via PV Reforge system',
      image: imageUrl,
      attributes,
      properties: {
        files: [{ uri: imageUrl, type: 'image/webp' }],
        category: 'image',
      },
    };
  }

  /**
   * Parse a private key string into a Keypair.
   * Supports both JSON array format and base58 format.
   */
  private parseKeypair(privateKeyStr: string): Keypair {
    try {
      if (privateKeyStr.startsWith('[')) {
        const secretKey = Uint8Array.from(JSON.parse(privateKeyStr));
        return Keypair.fromSecretKey(secretKey);
      } else {
        // Assume base58 encoded
        const bs58 = require('bs58');
        const secretKey = bs58.decode(privateKeyStr);
        return Keypair.fromSecretKey(secretKey);
      }
    } catch (error) {
      throw new Error(
        `Failed to parse update authority keypair: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Utility delay function for retry backoff.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a typed ReforgeError.
   */
  private createError(
    code: string,
    message: string,
    orderId?: string,
    retryable: boolean = false
  ): ReforgeError & Error {
    const error = new Error(message) as ReforgeError & Error;
    error.error = code;
    error.message = message;
    error.orderId = orderId;
    error.retryable = retryable;
    return error;
  }
}
