import { PoolClient } from 'pg';
import { BaseRepository } from './base';
import { ReforgeOrder, ReforgeOrderStatus, ReforgeOrderWithPack } from '@/types/reforge';
import { query } from '@/lib/database';

export interface ReforgeOrderRow {
  id: string;
  pack_id: string;
  wallet_address: string;
  discord_id: string;
  asset_id: string | null;
  status: string;
  used: boolean;
  purchase_tx_signature: string | null;
  failure_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ReforgeOrderWithPackRow extends ReforgeOrderRow {
  tier_name: string | null;
}

export class ReforgeOrderRepository extends BaseRepository<ReforgeOrderRow> {
  constructor() {
    super('reforge_orders');
  }

  async findByWallet(walletAddress: string, client?: PoolClient): Promise<ReforgeOrderRow[]> {
    const queryText = `
      SELECT * FROM ${this.tableName}
      WHERE wallet_address = $1
      ORDER BY created_at DESC
    `;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, [walletAddress]);
    return result.rows;
  }

  /**
   * Find orders by wallet address with a LEFT JOIN to reforge_packs to include the pack tier name.
   * Used for profile display where the tier name is needed alongside order data.
   */
  async findByWalletWithPack(walletAddress: string, client?: PoolClient): Promise<ReforgeOrderWithPackRow[]> {
    const queryText = `
      SELECT o.*, p.tier_name
      FROM ${this.tableName} o
      LEFT JOIN reforge_packs p ON o.pack_id = p.id
      WHERE o.wallet_address = $1
      ORDER BY o.created_at DESC
    `;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, [walletAddress]);
    return result.rows;
  }

  /**
   * Update the status of an order, optionally setting a failure reason.
   */
  async updateStatus(id: string, status: ReforgeOrderStatus, failureReason?: string, client?: PoolClient): Promise<ReforgeOrderRow | null> {
    const queryText = `
      UPDATE ${this.tableName}
      SET status = $2, failure_reason = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, [id, status, failureReason || null]);
    return result.rows[0] || null;
  }

  /**
   * Mark an order as used and set the asset ID for the NFT being reforged.
   */
  async markUsed(id: string, assetId: string, client?: PoolClient): Promise<ReforgeOrderRow | null> {
    const queryText = `
      UPDATE ${this.tableName}
      SET used = true, asset_id = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, [id, assetId]);
    return result.rows[0] || null;
  }

  // Convert database row to domain model
  toDomain(row: ReforgeOrderRow): ReforgeOrder {
    return {
      id: row.id,
      packId: row.pack_id,
      walletAddress: row.wallet_address,
      discordId: row.discord_id,
      assetId: row.asset_id,
      status: row.status as ReforgeOrderStatus,
      used: row.used,
      purchaseTxSignature: row.purchase_tx_signature,
      failureReason: row.failure_reason,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }

  // Convert database row with pack info to domain model
  toDomainWithPack(row: ReforgeOrderWithPackRow): ReforgeOrderWithPack {
    return {
      ...this.toDomain(row),
      tierName: row.tier_name || null,
    };
  }

  // Convert domain model to database row
  fromDomain(order: Partial<ReforgeOrder>): Partial<ReforgeOrderRow> {
    const result: Partial<ReforgeOrderRow> = {};

    if (order.id !== undefined) result.id = order.id;
    if (order.packId !== undefined) result.pack_id = order.packId;
    if (order.walletAddress !== undefined) result.wallet_address = order.walletAddress;
    if (order.discordId !== undefined) result.discord_id = order.discordId;
    if (order.assetId !== undefined) result.asset_id = order.assetId;
    if (order.status !== undefined) result.status = order.status;
    if (order.used !== undefined) result.used = order.used;
    if (order.purchaseTxSignature !== undefined) result.purchase_tx_signature = order.purchaseTxSignature;
    if (order.failureReason !== undefined) result.failure_reason = order.failureReason;

    return result;
  }
}
