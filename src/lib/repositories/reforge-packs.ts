import { PoolClient } from 'pg';
import { BaseRepository } from './base';
import { ReforgePack } from '@/types/reforge';
import { query } from '@/lib/database';

export interface ReforgePackRow {
  id: string;
  collection_id: string;
  tier_name: string;
  sol_price: string; // numeric stored as string
  min_ldz_earning: string;
  max_ldz_earning: string;
  total_inventory: number;
  remaining_count: number;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export class ReforgePackRepository extends BaseRepository<ReforgePackRow> {
  constructor() {
    super('reforge_packs');
  }

  async findByCollection(collectionId: string, activeOnly?: boolean, client?: PoolClient): Promise<ReforgePackRow[]> {
    let queryText = `
      SELECT * FROM ${this.tableName}
      WHERE collection_id = $1
    `;
    const params: any[] = [collectionId];

    if (activeOnly) {
      queryText += ` AND enabled = true`;
    }

    queryText += ` ORDER BY sol_price ASC`;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, params);
    return result.rows;
  }

  /**
   * Decrement pack inventory using optimistic locking.
   * Returns the updated pack if successful, null if inventory is exhausted.
   */
  async decrementInventory(id: string, client?: PoolClient): Promise<ReforgePackRow | null> {
    const queryText = `
      UPDATE ${this.tableName}
      SET remaining_count = remaining_count - 1, updated_at = NOW()
      WHERE id = $1 AND remaining_count > 0
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, [id]);
    return result.rows[0] || null;
  }

  /**
   * Enable or disable a pack.
   */
  async setEnabled(id: string, enabled: boolean, client?: PoolClient): Promise<ReforgePackRow | null> {
    const queryText = `
      UPDATE ${this.tableName}
      SET enabled = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, [id, enabled]);
    return result.rows[0] || null;
  }

  // Convert database row to domain model
  toDomain(row: ReforgePackRow): ReforgePack {
    return {
      id: row.id,
      collectionId: row.collection_id,
      tierName: row.tier_name as ReforgePack['tierName'],
      solPrice: parseFloat(row.sol_price),
      minLdzEarning: parseFloat(row.min_ldz_earning),
      maxLdzEarning: parseFloat(row.max_ldz_earning),
      totalInventory: row.total_inventory,
      remainingCount: row.remaining_count,
      enabled: row.enabled,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }

  // Convert domain model to database row
  fromDomain(pack: Partial<ReforgePack>): Partial<ReforgePackRow> {
    const result: Partial<ReforgePackRow> = {};

    if (pack.id !== undefined) result.id = pack.id;
    if (pack.collectionId !== undefined) result.collection_id = pack.collectionId;
    if (pack.tierName !== undefined) result.tier_name = pack.tierName;
    if (pack.solPrice !== undefined) result.sol_price = pack.solPrice.toString();
    if (pack.minLdzEarning !== undefined) result.min_ldz_earning = pack.minLdzEarning.toString();
    if (pack.maxLdzEarning !== undefined) result.max_ldz_earning = pack.maxLdzEarning.toString();
    if (pack.totalInventory !== undefined) result.total_inventory = pack.totalInventory;
    if (pack.remainingCount !== undefined) result.remaining_count = pack.remainingCount;
    if (pack.enabled !== undefined) result.enabled = pack.enabled;

    return result;
  }
}
