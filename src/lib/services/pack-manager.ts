import { ReforgePackRepository, ReforgePackRow } from '@/lib/repositories/reforge-packs';
import { ReforgePack, PackTier, ReforgeError } from '@/types/reforge';

export interface CreatePackInput {
  collectionId: string;
  tierName: PackTier;
  solPrice: number;
  minLdzEarning: number;
  maxLdzEarning: number;
  totalInventory: number;
}

export interface UpdatePackInput {
  tierName?: PackTier;
  solPrice?: number;
  minLdzEarning?: number;
  maxLdzEarning?: number;
  totalInventory?: number;
}

const VALID_TIERS: PackTier[] = ['silver', 'gold', 'diamond'];

export class PackManager {
  private repository: ReforgePackRepository;

  constructor(repository?: ReforgePackRepository) {
    this.repository = repository || new ReforgePackRepository();
  }

  /**
   * Validate pack configuration. Throws a ReforgeError if invalid.
   */
  private validatePackConfig(input: { minLdzEarning: number; maxLdzEarning: number; totalInventory: number; tierName: PackTier; solPrice: number }): void {
    if (!VALID_TIERS.includes(input.tierName)) {
      throw this.createError('INVALID_PACK_CONFIG', `Invalid tier name: ${input.tierName}. Must be one of: ${VALID_TIERS.join(', ')}`);
    }

    if (input.solPrice <= 0) {
      throw this.createError('INVALID_PACK_CONFIG', 'SOL price must be positive');
    }

    if (input.totalInventory <= 0) {
      throw this.createError('INVALID_PACK_CONFIG', 'Total inventory must be a positive integer');
    }

    if (!Number.isInteger(input.totalInventory)) {
      throw this.createError('INVALID_PACK_CONFIG', 'Total inventory must be an integer');
    }

    if (input.minLdzEarning > input.maxLdzEarning) {
      throw this.createError('INVALID_PACK_CONFIG', 'Minimum LDZ earning must be less than or equal to maximum LDZ earning');
    }
  }

  /**
   * Create a new reforge pack with validation.
   */
  async createPack(input: CreatePackInput): Promise<ReforgePack> {
    this.validatePackConfig({
      minLdzEarning: input.minLdzEarning,
      maxLdzEarning: input.maxLdzEarning,
      totalInventory: input.totalInventory,
      tierName: input.tierName,
      solPrice: input.solPrice,
    });

    if (!input.collectionId || input.collectionId.trim() === '') {
      throw this.createError('INVALID_PACK_CONFIG', 'Collection ID is required');
    }

    const row = await this.repository.create({
      collection_id: input.collectionId,
      tier_name: input.tierName,
      sol_price: input.solPrice.toString(),
      min_ldz_earning: input.minLdzEarning.toString(),
      max_ldz_earning: input.maxLdzEarning.toString(),
      total_inventory: input.totalInventory,
      remaining_count: input.totalInventory,
      enabled: true,
    } as Partial<ReforgePackRow>);

    return this.repository.toDomain(row);
  }

  /**
   * Update an existing pack's configuration.
   */
  async updatePack(id: string, input: UpdatePackInput): Promise<ReforgePack> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw this.createError('PACK_NOT_FOUND', `Pack with id ${id} not found`);
    }

    // Merge existing values with updates for validation
    const merged = {
      tierName: input.tierName ?? (existing.tier_name as PackTier),
      solPrice: input.solPrice ?? parseFloat(existing.sol_price),
      minLdzEarning: input.minLdzEarning ?? parseFloat(existing.min_ldz_earning),
      maxLdzEarning: input.maxLdzEarning ?? parseFloat(existing.max_ldz_earning),
      totalInventory: input.totalInventory ?? existing.total_inventory,
    };

    this.validatePackConfig(merged);

    const updateData: Partial<ReforgePackRow> = {};
    if (input.tierName !== undefined) updateData.tier_name = input.tierName;
    if (input.solPrice !== undefined) updateData.sol_price = input.solPrice.toString();
    if (input.minLdzEarning !== undefined) updateData.min_ldz_earning = input.minLdzEarning.toString();
    if (input.maxLdzEarning !== undefined) updateData.max_ldz_earning = input.maxLdzEarning.toString();
    if (input.totalInventory !== undefined) {
      updateData.total_inventory = input.totalInventory;
      // Adjust remaining count proportionally if total inventory changes
      const diff = input.totalInventory - existing.total_inventory;
      updateData.remaining_count = Math.max(0, existing.remaining_count + diff);
    }

    const updatedRow = await this.repository.update(id, updateData);
    if (!updatedRow) {
      throw this.createError('PACK_NOT_FOUND', `Pack with id ${id} not found`);
    }

    return this.repository.toDomain(updatedRow);
  }

  /**
   * Get a pack by ID.
   */
  async getPackById(id: string): Promise<ReforgePack | null> {
    const row = await this.repository.findById(id);
    if (!row) return null;
    return this.repository.toDomain(row);
  }

  /**
   * Get all packs for a collection.
   */
  async getPacksByCollection(collectionId: string, activeOnly?: boolean): Promise<ReforgePack[]> {
    const rows = await this.repository.findByCollection(collectionId, activeOnly);
    return rows.map((row) => this.repository.toDomain(row));
  }

  /**
   * Enable a pack, making it available for purchase.
   */
  async enablePack(id: string): Promise<ReforgePack> {
    const row = await this.repository.setEnabled(id, true);
    if (!row) {
      throw this.createError('PACK_NOT_FOUND', `Pack with id ${id} not found`);
    }
    return this.repository.toDomain(row);
  }

  /**
   * Disable a pack, preventing new purchases.
   */
  async disablePack(id: string): Promise<ReforgePack> {
    const row = await this.repository.setEnabled(id, false);
    if (!row) {
      throw this.createError('PACK_NOT_FOUND', `Pack with id ${id} not found`);
    }
    return this.repository.toDomain(row);
  }

  /**
   * Attempt to purchase a pack. Validates the pack is enabled and has inventory.
   * Returns the pack if purchase is allowed, throws otherwise.
   */
  async validatePurchase(packId: string): Promise<ReforgePack> {
    const row = await this.repository.findById(packId);
    if (!row) {
      throw this.createError('PACK_NOT_FOUND', `Pack with id ${packId} not found`);
    }

    const pack = this.repository.toDomain(row);

    if (!pack.enabled) {
      throw this.createError('PACK_DISABLED', 'This pack is currently disabled and not available for purchase', false);
    }

    if (pack.remainingCount <= 0) {
      throw this.createError('PACK_SOLD_OUT', 'This pack is sold out', false);
    }

    return pack;
  }

  /**
   * Decrement pack inventory using optimistic locking.
   * Returns the updated pack or null if sold out.
   */
  async decrementInventory(packId: string): Promise<ReforgePack | null> {
    const row = await this.repository.decrementInventory(packId);
    if (!row) return null;
    return this.repository.toDomain(row);
  }

  private createError(code: string, message: string, retryable: boolean = false): ReforgeError & Error {
    const error = new Error(message) as ReforgeError & Error;
    error.error = code;
    error.message = message;
    error.retryable = retryable;
    return error;
  }
}
