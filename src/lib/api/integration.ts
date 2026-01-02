/**
 * API Integration Service
 * 
 * This service provides a unified interface for integrating all backend services
 * and ensures consistent error handling, logging, and response formatting across
 * all API endpoints.
 */

import { TransactionBuilder } from '@/lib/services/transaction-builder';
import { InventoryManager } from '@/lib/services/inventory-manager';
import { ImageCompositionService } from '@/lib/services/image-composition';
import { MetadataService } from '@/lib/services/metadata';
import { IrysUploadService } from '@/lib/services/irys-upload';
import { CoreAssetUpdateService } from '@/lib/services/core-asset-update';
import { createNFTService } from '@/lib/services/nft';
import { PerformanceMonitor } from '@/lib/services/performance-monitor';
import { errorHandler } from '@/lib/services/error-handler';
import { logger } from '@/lib/services/logger';
import { Keypair, Connection } from '@solana/web3.js';
import { Trait } from '@/types';
import { 
  getProjectRepository,
  getTraitRepository,
  getTraitSlotRepository,
  getGiftBalanceRepository,
  getPurchaseRepository,
  getAuditLogRepository
} from '@/lib/repositories';

export interface ServiceContainer {
  // Core services
  transactionBuilder: TransactionBuilder;
  inventoryManager: InventoryManager;
  imageComposition: ImageCompositionService;
  metadata: MetadataService;
  irysUpload: IrysUploadService;
  coreAssetUpdate: CoreAssetUpdateService;
  nftService: ReturnType<typeof createNFTService>;
  
  // Monitoring and logging
  performanceMonitor: PerformanceMonitor;
  errorHandler: typeof errorHandler;
  logger: typeof logger;
  
  // Repositories
  repositories: {
    project: ReturnType<typeof getProjectRepository>;
    trait: ReturnType<typeof getTraitRepository>;
    traitSlot: ReturnType<typeof getTraitSlotRepository>;
    giftBalance: ReturnType<typeof getGiftBalanceRepository>;
    purchase: ReturnType<typeof getPurchaseRepository>;
    auditLog: ReturnType<typeof getAuditLogRepository>;
  };
}

  /**
   * Create a service container with all integrated services
   */
  export function createServiceContainer(): ServiceContainer {
    // Mock keypair for services that require it
    const mockKeypair = Keypair.generate();
    const mockConnection = new Connection('https://api.devnet.solana.com');
    
    return {
      // Core services
      transactionBuilder: new TransactionBuilder(),
      inventoryManager: new InventoryManager(),
      imageComposition: new ImageCompositionService(),
      metadata: new MetadataService(new IrysUploadService(mockKeypair)),
      irysUpload: new IrysUploadService(mockKeypair),
      coreAssetUpdate: new CoreAssetUpdateService(mockConnection, mockKeypair),
      nftService: createNFTService(),
      
      // Monitoring and logging
      performanceMonitor: new PerformanceMonitor(),
      errorHandler,
      logger,
      
      // Repositories
      repositories: {
        project: getProjectRepository(),
        trait: getTraitRepository(),
        traitSlot: getTraitSlotRepository(),
        giftBalance: getGiftBalanceRepository(),
        purchase: getPurchaseRepository(),
        auditLog: getAuditLogRepository(),
      },
    };
  }

/**
 * Complete trait purchase workflow integration
 */
export class TraitPurchaseWorkflow {
  private services: ServiceContainer;

  constructor(services: ServiceContainer) {
    this.services = services;
  }

  /**
   * Execute the complete trait purchase workflow
   */
  async executePurchase(params: {
    walletAddress: string;
    assetId: string;
    traitId: string;
    reservationId: string;
    userSignedTransaction: string;
  }): Promise<{
    success: boolean;
    transactionSignature?: string;
    updatedAssetUri?: string;
    error?: string;
  }> {
    const { walletAddress, assetId, traitId, reservationId, userSignedTransaction } = params;
    const requestId = `purchase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Start performance monitoring
      const monitor = this.services.performanceMonitor.startOperation('complete_purchase', 'api');

      // 1. Verify reservation is still valid
      const reservationStatus = await this.services.inventoryManager.getReservationStatus(reservationId);
      if (!reservationStatus.found || reservationStatus.isExpired) {
        throw new Error('Reservation expired or not found');
      }

      // 2. Verify asset ownership
      const isOwner = await this.services.nftService.verifyOwnership(walletAddress, assetId);
      if (!isOwner) {
        throw new Error('Asset ownership verification failed');
      }

      // 3. Submit transaction (simplified for integration)
      // In a real implementation, this would handle the transaction submission
      const transactionSignature = 'mock_signature_' + Date.now();

      // 4. Update inventory (simplified)
      // In a real implementation, this would update the database
      
      // 5. Get trait information for image composition
      const trait = await this.services.repositories.trait.findById(traitId);
      if (!trait) {
        throw new Error('Trait not found');
      }

      // 6. Compose new image with trait (simplified)
      const mockTrait: Trait = {
        id: trait.id,
        slotId: trait.slot_id,
        name: trait.name,
        imageLayerUrl: trait.image_layer_url,
        rarityTier: {
          id: trait.rarity_tier_id,
          name: 'Common',
          weight: 100,
          displayOrder: 1,
        },
        totalSupply: trait.total_supply,
        remainingSupply: trait.remaining_supply,
        priceAmount: trait.price_amount, // Keep as string
        priceToken: {
          id: trait.price_token_id,
          symbol: 'SOL',
          decimals: 9,
          enabled: true,
        },
        active: trait.active,
      };

      const compositeImageResult = await this.services.imageComposition.composeImage(
        'https://example.com/base.png',
        { [trait.slot_id]: mockTrait },
        [{ id: trait.slot_id, name: 'Trait Slot', layerOrder: 1 }],
        {
          format: 'png',
        }
      );

      // 7. Upload new image to Irys (simplified)
      const imageUploadResult = await this.services.irysUpload.uploadImage(
        Buffer.from('mock_image_data'),
        'image/png'
      );

      // 8. Create updated metadata (simplified)
      const updatedMetadata = {
        name: 'Updated NFT',
        image: imageUploadResult.url,
        attributes: [],
      };

      // 9. Upload metadata to Irys
      const metadataUploadResult = await this.services.irysUpload.uploadImage(
        Buffer.from(JSON.stringify(updatedMetadata)),
        'application/json'
      );

      // 10. Update Core asset with new metadata URI (simplified)
      const updateResult = await this.services.coreAssetUpdate.updateAssetWithTrait(
        assetId,
        metadataUploadResult.url
      );

      if (!updateResult.signature) {
        throw new Error(`Core asset update failed`);
      }

      // 11. Log successful completion
      this.services.logger.info('Purchase completed successfully', {
        requestId,
        walletAddress,
        assetId,
        traitId,
        transactionSignature,
        newMetadataUri: metadataUploadResult.url,
      });

      // End performance monitoring
      this.services.performanceMonitor.endOperation(monitor, true);

      return {
        success: true,
        transactionSignature,
        updatedAssetUri: metadataUploadResult.url,
      };

    } catch (error) {
      // Handle and categorize error
      const categorizedError = await this.services.errorHandler.handleError(
        error,
        {
          operation: 'complete_purchase',
          requestId,
          walletAddress,
          assetId,
          traitId,
          reservationId,
        }
      );

      // Log error
      this.services.logger.error('Purchase workflow failed', undefined, {
        requestId,
        errorId: categorizedError.id,
        category: categorizedError.category,
        message: categorizedError.message,
        walletAddress,
        assetId,
        traitId,
      });

      return {
        success: false,
        error: categorizedError.message,
      };
    }
  }
}

/**
 * Admin operations integration
 */
export class AdminOperationsWorkflow {
  private services: ServiceContainer;

  constructor(services: ServiceContainer) {
    this.services = services;
  }

  /**
   * Create a new trait with all required setup
   */
  async createTrait(params: {
    name: string;
    slotId: string;
    rarityTierId: string;
    imageFile: Buffer;
    priceAmount: string;
    tokenId: string;
    totalSupply?: number;
    adminId: string;
  }): Promise<{
    success: boolean;
    traitId?: string;
    error?: string;
  }> {
    const requestId = `create_trait_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // 1. Upload trait image to storage
      const imageUploadResult = await this.services.irysUpload.uploadImage(
        params.imageFile,
        'image/png'
      );

      // 2. Create trait record
      const trait = await this.services.repositories.trait.create({
        slot_id: params.slotId,
        name: params.name,
        image_layer_url: imageUploadResult.url,
        rarity_tier_id: params.rarityTierId,
        total_supply: params.totalSupply,
        remaining_supply: params.totalSupply,
        price_amount: params.priceAmount,
        price_token_id: params.tokenId,
        active: true,
      });

      // 3. Log audit trail
      await this.services.repositories.auditLog.create({
        actor_type: 'admin',
        actor_id: params.adminId,
        action: 'trait_created',
        payload_json: {
          traitId: trait.id,
          name: params.name,
          slotId: params.slotId,
          priceAmount: params.priceAmount,
          totalSupply: params.totalSupply,
        },
      });

      return {
        success: true,
        traitId: trait.id,
      };

    } catch (error) {
      const categorizedError = await this.services.errorHandler.handleError(
        error,
        {
          operation: 'create_trait',
          requestId,
          adminId: params.adminId,
        }
      );

      return {
        success: false,
        error: categorizedError.message,
      };
    }
  }

  /**
   * Gift traits to a wallet address
   */
  async giftTraits(params: {
    walletAddress: string;
    traitId: string;
    quantity: number;
    adminId: string;
  }): Promise<{
    success: boolean;
    error?: string;
  }> {
    const requestId = `gift_traits_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // 1. Create or update gift balance
      await this.services.repositories.giftBalance.create({
        wallet_address: params.walletAddress,
        trait_id: params.traitId,
        qty_available: params.quantity,
      });

      // 2. Log audit trail
      await this.services.repositories.auditLog.create({
        actor_type: 'admin',
        actor_id: params.adminId,
        action: 'traits_gifted',
        payload_json: {
          walletAddress: params.walletAddress,
          traitId: params.traitId,
          quantity: params.quantity,
        },
      });

      return { success: true };

    } catch (error) {
      const categorizedError = await this.services.errorHandler.handleError(
        error,
        {
          operation: 'gift_traits',
          requestId,
          adminId: params.adminId,
        }
      );

      return {
        success: false,
        error: categorizedError.message,
      };
    }
  }
}

/**
 * System health and monitoring integration
 */
export class SystemHealthWorkflow {
  private services: ServiceContainer;

  constructor(services: ServiceContainer) {
    this.services = services;
  }

  /**
   * Get comprehensive system health status
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, {
      status: 'up' | 'down' | 'degraded';
      responseTime?: number;
      error?: string;
    }>;
    metrics: {
      errorRate: number;
      averageResponseTime: number;
      activeReservations: number;
      pendingTransactions: number;
    };
  }> {
    const healthChecks = await Promise.allSettled([
      this.checkDatabaseHealth(),
      this.checkBlockchainHealth(),
      this.checkIrysHealth(),
      this.checkExternalServicesHealth(),
    ]);

    const services = {
      database: this.parseHealthCheck(healthChecks[0]),
      blockchain: this.parseHealthCheck(healthChecks[1]),
      irys: this.parseHealthCheck(healthChecks[2]),
      external: this.parseHealthCheck(healthChecks[3]),
    };

    // Get system metrics
    const metrics = await this.getSystemMetrics();

    // Determine overall status
    const serviceStatuses = Object.values(services).map(s => s.status);
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (serviceStatuses.includes('down')) {
      status = 'unhealthy';
    } else if (serviceStatuses.includes('degraded')) {
      status = 'degraded';
    }

    return {
      status,
      services,
      metrics,
    };
  }

  private async checkDatabaseHealth() {
    const start = Date.now();
    try {
      await this.services.repositories.project.findAll();
      return {
        status: 'up' as const,
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down' as const,
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkBlockchainHealth() {
    const start = Date.now();
    try {
      // This would check Solana RPC health
      // For now, return a mock response
      return {
        status: 'up' as const,
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down' as const,
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkIrysHealth() {
    const start = Date.now();
    try {
      // This would check Irys service health
      // For now, return a mock response
      return {
        status: 'up' as const,
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down' as const,
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkExternalServicesHealth() {
    const start = Date.now();
    try {
      // This would check external API health (Helius, etc.)
      // For now, return a mock response
      return {
        status: 'up' as const,
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down' as const,
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private parseHealthCheck(result: PromiseSettledResult<any>) {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        status: 'down' as const,
        error: result.reason?.message || 'Health check failed',
      };
    }
  }

  private async getSystemMetrics() {
    // Get error metrics from error handler
    const errorMetrics = this.services.errorHandler.getErrorMetrics();
    
    // Calculate error rate (simplified)
    const totalErrors = errorMetrics.reduce((sum, metric) => sum + metric.count, 0);
    const errorRate = totalErrors > 0 ? (totalErrors / 100) * 100 : 0; // Mock calculation

    return {
      errorRate,
      averageResponseTime: 150, // Mock value
      activeReservations: 0, // Would be calculated from database
      pendingTransactions: 0, // Would be calculated from database
    };
  }
}

// Export singleton instances
export const serviceContainer = createServiceContainer();
export const traitPurchaseWorkflow = new TraitPurchaseWorkflow(serviceContainer);
export const adminOperationsWorkflow = new AdminOperationsWorkflow(serviceContainer);
export const systemHealthWorkflow = new SystemHealthWorkflow(serviceContainer);