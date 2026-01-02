import { InventoryReservationRepository } from '@/lib/repositories/inventory';
import { TraitRepository } from '@/lib/repositories/traits';
import { PurchaseRepository } from '@/lib/repositories/purchases';
import { transaction } from '@/lib/database';
import { InventoryReservation, Purchase } from '@/types';

export interface ReservationRequest {
  walletAddress: string;
  assetId: string;
  traitId: string;
}

export interface InventoryCheckResult {
  available: boolean;
  remainingSupply?: number;
  activeReservations: number;
  reason?: string;
}

export class InventoryManager {
  private inventoryRepo: InventoryReservationRepository;
  private traitRepo: TraitRepository;
  private purchaseRepo: PurchaseRepository;

  constructor() {
    this.inventoryRepo = new InventoryReservationRepository();
    this.traitRepo = new TraitRepository();
    this.purchaseRepo = new PurchaseRepository();
  }

  /**
   * Check inventory availability for a trait
   */
  async checkInventoryAvailability(traitId: string): Promise<InventoryCheckResult> {
    try {
      return await transaction(async (client) => {
        const trait = await this.traitRepo.findById(traitId, client);
        
        if (!trait || !trait.active) {
          return {
            available: false,
            activeReservations: 0,
            reason: 'Trait not found or inactive',
          };
        }

        const activeReservations = await this.inventoryRepo.getActiveReservationCount(traitId, client);

        // Handle unlimited supply traits
        if (trait.total_supply === null) {
          return {
            available: true,
            remainingSupply: undefined, // Unlimited
            activeReservations,
          };
        }

        // Handle limited supply traits
        const remainingSupply = trait.remaining_supply || 0;
        const availableSupply = Math.max(0, remainingSupply - activeReservations);

        return {
          available: availableSupply > 0,
          remainingSupply,
          activeReservations,
          reason: availableSupply <= 0 ? 'Insufficient inventory' : undefined,
        };
      });
    } catch (error) {
      console.error('Inventory check error:', error);
      return {
        available: false,
        activeReservations: 0,
        reason: 'Error checking inventory',
      };
    }
  }

  /**
   * Create a reservation with concurrent request handling
   */
  async createReservation(request: ReservationRequest): Promise<{
    success: boolean;
    reservation?: InventoryReservation;
    error?: string;
  }> {
    try {
      return await transaction(async (client) => {
        const { walletAddress, assetId, traitId } = request;

        // Check for existing active reservation first
        const existingReservation = await this.inventoryRepo.findActiveReservation(
          traitId,
          walletAddress,
          assetId,
          client
        );

        if (existingReservation) {
          return {
            success: true,
            reservation: this.inventoryRepo.toDomain(existingReservation),
          };
        }

        // Check inventory availability within transaction
        const inventoryCheck = await this.checkInventoryAvailability(traitId);
        
        if (!inventoryCheck.available) {
          return {
            success: false,
            error: inventoryCheck.reason || 'Inventory not available',
          };
        }

        // Create reservation
        const reservationRow = await this.inventoryRepo.createReservation(
          traitId,
          walletAddress,
          assetId,
          client
        );

        return {
          success: true,
          reservation: this.inventoryRepo.toDomain(reservationRow),
        };
      });
    } catch (error) {
      console.error('Create reservation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create reservation',
      };
    }
  }

  /**
   * Consume a reservation (convert to purchase)
   */
  async consumeReservation(
    reservationId: string,
    purchaseData: Partial<Purchase>
  ): Promise<{
    success: boolean;
    purchase?: Purchase;
    error?: string;
  }> {
    try {
      return await transaction(async (client) => {
        // Consume the reservation
        const consumedReservation = await this.inventoryRepo.consumeReservation(reservationId, client);
        
        if (!consumedReservation) {
          return {
            success: false,
            error: 'Reservation not found, expired, or already consumed',
          };
        }

        // Create purchase record
        const purchase = await this.purchaseRepo.create({
          ...purchaseData,
          wallet_address: consumedReservation.wallet_address,
          asset_id: consumedReservation.asset_id,
          trait_id: consumedReservation.trait_id,
          status: 'created',
        }, client);

        return {
          success: true,
          purchase: this.purchaseRepo.toDomain(purchase),
        };
      });
    } catch (error) {
      console.error('Consume reservation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to consume reservation',
      };
    }
  }

  /**
   * Handle concurrent reservation attempts with proper locking
   */
  async handleConcurrentReservation(
    requests: ReservationRequest[]
  ): Promise<{
    successful: InventoryReservation[];
    failed: Array<{ request: ReservationRequest; error: string }>;
  }> {
    const successful: InventoryReservation[] = [];
    const failed: Array<{ request: ReservationRequest; error: string }> = [];

    // Process requests sequentially to avoid race conditions
    for (const request of requests) {
      const result = await this.createReservation(request);
      
      if (result.success && result.reservation) {
        successful.push(result.reservation);
      } else {
        failed.push({
          request,
          error: result.error || 'Unknown error',
        });
      }
    }

    return { successful, failed };
  }

  /**
   * Get reservation status and tracking information
   */
  async getReservationStatus(reservationId: string): Promise<{
    found: boolean;
    reservation?: InventoryReservation;
    isExpired?: boolean;
    timeRemaining?: number; // milliseconds
  }> {
    try {
      const reservation = await this.inventoryRepo.findById(reservationId);
      
      if (!reservation) {
        return { found: false };
      }

      const now = new Date();
      const isExpired = reservation.expires_at <= now;
      const timeRemaining = isExpired ? 0 : reservation.expires_at.getTime() - now.getTime();

      return {
        found: true,
        reservation: this.inventoryRepo.toDomain(reservation),
        isExpired,
        timeRemaining,
      };
    } catch (error) {
      console.error('Get reservation status error:', error);
      return { found: false };
    }
  }

  /**
   * Bulk cancel reservations
   */
  async bulkCancelReservations(reservationIds: string[]): Promise<{
    cancelledCount: number;
    errors: string[];
  }> {
    let cancelledCount = 0;
    const errors: string[] = [];

    for (const id of reservationIds) {
      try {
        const cancelled = await this.inventoryRepo.cancelReservation(id);
        if (cancelled) {
          cancelledCount++;
        }
      } catch (error) {
        errors.push(`Failed to cancel reservation ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { cancelledCount, errors };
  }
}