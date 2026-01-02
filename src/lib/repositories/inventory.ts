import { PoolClient } from 'pg';
import { BaseRepository } from './base';
import { InventoryReservation } from '@/types';
import { query } from '@/lib/database';
import { RESERVATION_TTL_MINUTES } from '@/lib/constants';

export interface InventoryReservationRow {
  id: string;
  trait_id: string;
  wallet_address: string;
  asset_id: string;
  expires_at: Date;
  status: 'reserved' | 'consumed' | 'expired' | 'cancelled';
  created_at: Date;
}

export class InventoryReservationRepository extends BaseRepository<InventoryReservationRow> {
  constructor() {
    super('inventory_reservations');
  }

  async createReservation(
    traitId: string,
    walletAddress: string,
    assetId: string,
    client?: PoolClient
  ): Promise<InventoryReservationRow> {
    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);
    
    const queryText = `
      INSERT INTO ${this.tableName} (trait_id, wallet_address, asset_id, expires_at, status)
      VALUES ($1, $2, $3, $4, 'reserved')
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [traitId, walletAddress, assetId, expiresAt]);
    return result.rows[0];
  }

  async findActiveReservation(
    traitId: string,
    walletAddress: string,
    assetId: string,
    client?: PoolClient
  ): Promise<InventoryReservationRow | null> {
    const queryText = `
      SELECT * FROM ${this.tableName}
      WHERE trait_id = $1 AND wallet_address = $2 AND asset_id = $3
      AND status = 'reserved' AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [traitId, walletAddress, assetId]);
    return result.rows[0] || null;
  }

  async findExpiredReservations(client?: PoolClient): Promise<InventoryReservationRow[]> {
    const queryText = `
      SELECT * FROM ${this.tableName}
      WHERE status = 'reserved' AND expires_at <= NOW()
      ORDER BY expires_at ASC
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText);
    return result.rows;
  }

  async markExpired(ids: string[], client?: PoolClient): Promise<number> {
    if (ids.length === 0) return 0;
    
    const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
    const queryText = `
      UPDATE ${this.tableName}
      SET status = 'expired'
      WHERE id IN (${placeholders})
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, ids);
    return result.rowCount;
  }

  async consumeReservation(id: string, client?: PoolClient): Promise<InventoryReservationRow | null> {
    const queryText = `
      UPDATE ${this.tableName}
      SET status = 'consumed'
      WHERE id = $1 AND status = 'reserved' AND expires_at > NOW()
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [id]);
    return result.rows[0] || null;
  }

  async cancelReservation(id: string, client?: PoolClient): Promise<InventoryReservationRow | null> {
    const queryText = `
      UPDATE ${this.tableName}
      SET status = 'cancelled'
      WHERE id = $1 AND status = 'reserved'
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [id]);
    return result.rows[0] || null;
  }

  async getActiveReservationCount(traitId: string, client?: PoolClient): Promise<number> {
    const queryText = `
      SELECT COUNT(*) FROM ${this.tableName}
      WHERE trait_id = $1 AND status = 'reserved' AND expires_at > NOW()
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [traitId]);
    return parseInt(result.rows[0].count);
  }

  async cleanupExpiredReservations(client?: PoolClient): Promise<number> {
    const expiredReservations = await this.findExpiredReservations(client);
    if (expiredReservations.length === 0) return 0;
    
    const ids = expiredReservations.map(r => r.id);
    return await this.markExpired(ids, client);
  }

  async findById(id: string, client?: PoolClient): Promise<InventoryReservationRow | null> {
    const queryText = `
      SELECT * FROM ${this.tableName}
      WHERE id = $1
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [id]);
    return result.rows[0] || null;
  }

  // Convert database row to domain model
  toDomain(row: InventoryReservationRow): InventoryReservation {
    return {
      id: row.id,
      traitId: row.trait_id,
      walletAddress: row.wallet_address,
      assetId: row.asset_id,
      expiresAt: row.expires_at,
      status: row.status,
    };
  }

  // Convert domain model to database row
  fromDomain(reservation: Partial<InventoryReservation>): Partial<InventoryReservationRow> {
    const result: Partial<InventoryReservationRow> = {
      trait_id: reservation.traitId,
      wallet_address: reservation.walletAddress,
      asset_id: reservation.assetId,
      expires_at: reservation.expiresAt,
      status: reservation.status,
    };

    // Only include id if it's defined (for create operations)
    if (reservation.id !== undefined) {
      result.id = reservation.id;
    }

    return result;
  }
}