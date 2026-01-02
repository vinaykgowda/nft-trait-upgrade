import { InventoryReservationRepository } from '@/lib/repositories/inventory';
import { AuditLogRepository } from '@/lib/repositories/audit-logs';
import { ACTOR_TYPE } from '@/lib/constants';

export class ReservationCleanupService {
  private inventoryRepo: InventoryReservationRepository;
  private auditRepo: AuditLogRepository;

  constructor() {
    this.inventoryRepo = new InventoryReservationRepository();
    this.auditRepo = new AuditLogRepository();
  }

  /**
   * Clean up expired reservations and log the operation
   */
  async cleanupExpiredReservations(): Promise<{
    cleanedCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let cleanedCount = 0;

    try {
      // Find and mark expired reservations
      cleanedCount = await this.inventoryRepo.cleanupExpiredReservations();

      // Log the cleanup operation
      if (cleanedCount > 0) {
        await this.auditRepo.create({
          actor_type: ACTOR_TYPE.SYSTEM,
          actor_id: 'reservation-cleanup-service',
          action: 'cleanup_expired_reservations',
          payload_json: {
            cleanedCount,
            timestamp: new Date().toISOString(),
          },
        });
      }

      console.log(`Cleaned up ${cleanedCount} expired reservations`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Cleanup failed: ${errorMessage}`);
      console.error('Reservation cleanup error:', error);

      // Log the error
      try {
        await this.auditRepo.create({
          actor_type: ACTOR_TYPE.SYSTEM,
          actor_id: 'reservation-cleanup-service',
          action: 'cleanup_expired_reservations_error',
          payload_json: {
            error: errorMessage,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (auditError) {
        console.error('Failed to log cleanup error:', auditError);
      }
    }

    return { cleanedCount, errors };
  }

  /**
   * Get statistics about current reservations
   */
  async getReservationStats(): Promise<{
    totalActive: number;
    totalExpired: number;
    byTrait: Record<string, number>;
  }> {
    try {
      // This would require additional repository methods
      // For now, return basic stats
      const expiredReservations = await this.inventoryRepo.findExpiredReservations();
      
      return {
        totalActive: 0, // Would need additional query
        totalExpired: expiredReservations.length,
        byTrait: {}, // Would need additional aggregation query
      };
    } catch (error) {
      console.error('Failed to get reservation stats:', error);
      return {
        totalActive: 0,
        totalExpired: 0,
        byTrait: {},
      };
    }
  }

  /**
   * Force cleanup of specific reservations by ID
   */
  async forceCleanupReservations(reservationIds: string[]): Promise<{
    cleanedCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let cleanedCount = 0;

    try {
      if (reservationIds.length === 0) {
        return { cleanedCount: 0, errors: [] };
      }

      cleanedCount = await this.inventoryRepo.markExpired(reservationIds);

      // Log the forced cleanup
      await this.auditRepo.create({
        actor_type: ACTOR_TYPE.SYSTEM,
        actor_id: 'reservation-cleanup-service',
        action: 'force_cleanup_reservations',
        payload_json: {
          reservationIds,
          cleanedCount,
          timestamp: new Date().toISOString(),
        },
      });

      console.log(`Force cleaned ${cleanedCount} reservations`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Force cleanup failed: ${errorMessage}`);
      console.error('Force cleanup error:', error);
    }

    return { cleanedCount, errors };
  }
}