import { PoolClient } from 'pg';
import { BaseRepository } from './base';
import { query } from '@/lib/database';
import { randomBytes } from 'crypto';

export interface TraitVoucherRow {
  id: string;
  code: string;
  user_id: string;
  trait_id: string;
  slot_id: string;
  rarity_tier_id: string;
  status: string;
  redeemed_at?: Date;
  redeemed_purchase_id?: string;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
  // Joined
  discord_username?: string;
  trait_name?: string;
  slot_name?: string;
  rarity_name?: string;
}

export class TraitVoucherRepository extends BaseRepository<TraitVoucherRow> {
  constructor() {
    super('trait_vouchers');
  }

  static generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I,O,0,1 to avoid confusion
    let code = '';
    const bytes = randomBytes(12);
    for (let i = 0; i < 12; i++) {
      code += chars[bytes[i] % chars.length];
    }
    return code;
  }

  async findWithDetails(filters?: {
    userId?: string;
    status?: string;
    slotId?: string;
    traitId?: string;
    limit?: number;
    offset?: number;
  }, client?: PoolClient): Promise<TraitVoucherRow[]> {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.userId) {
      whereClause += ` AND v.user_id = $${paramIndex}`;
      params.push(filters.userId);
      paramIndex++;
    }
    if (filters?.status) {
      whereClause += ` AND v.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }
    if (filters?.slotId) {
      whereClause += ` AND v.slot_id = $${paramIndex}`;
      params.push(filters.slotId);
      paramIndex++;
    }
    if (filters?.traitId) {
      whereClause += ` AND v.trait_id = $${paramIndex}`;
      params.push(filters.traitId);
      paramIndex++;
    }

    let limitClause = '';
    if (filters?.limit) {
      limitClause += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
      paramIndex++;
    }
    if (filters?.offset) {
      limitClause += ` OFFSET $${paramIndex}`;
      params.push(filters.offset);
      paramIndex++;
    }

    const queryText = `
      SELECT 
        v.*,
        up.discord_username,
        t.name as trait_name,
        ts.name as slot_name,
        rt.name as rarity_name
      FROM ${this.tableName} v
      JOIN user_profiles up ON v.user_id = up.id
      JOIN traits t ON v.trait_id = t.id
      JOIN trait_slots ts ON v.slot_id = ts.id
      JOIN rarity_tiers rt ON v.rarity_tier_id = rt.id
      ${whereClause}
      ORDER BY v.created_at DESC
      ${limitClause}
    `;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, params);
    return result.rows;
  }

  async findByCode(code: string, client?: PoolClient): Promise<TraitVoucherRow | null> {
    const queryText = `
      SELECT 
        v.*,
        up.discord_username,
        t.name as trait_name,
        ts.name as slot_name,
        rt.name as rarity_name
      FROM ${this.tableName} v
      JOIN user_profiles up ON v.user_id = up.id
      JOIN traits t ON v.trait_id = t.id
      JOIN trait_slots ts ON v.slot_id = ts.id
      JOIN rarity_tiers rt ON v.rarity_tier_id = rt.id
      WHERE v.code = $1
    `;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, [code]);
    return result.rows[0] || null;
  }

  async findByUserIdActive(userId: string, client?: PoolClient): Promise<TraitVoucherRow[]> {
    return this.findWithDetails({ userId, status: 'active' }, client);
  }

  async redeemVoucher(id: string, purchaseId: string | null, client?: PoolClient): Promise<TraitVoucherRow | null> {
    const queryText = `
      UPDATE ${this.tableName}
      SET status = 'redeemed', redeemed_at = NOW(), redeemed_purchase_id = $2, updated_at = NOW()
      WHERE id = $1 AND status = 'active'
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, [id, purchaseId]);
    return result.rows[0] || null;
  }

  async revokeVoucher(id: string, client?: PoolClient): Promise<TraitVoucherRow | null> {
    const queryText = `
      UPDATE ${this.tableName}
      SET status = 'revoked', updated_at = NOW()
      WHERE id = $1 AND status = 'active'
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, [id]);
    return result.rows[0] || null;
  }

  async getAnalytics(client?: PoolClient): Promise<{
    total: number;
    active: number;
    redeemed: number;
    revoked: number;
    bySlot: { slot_name: string; count: number }[];
    byRarity: { rarity_name: string; count: number }[];
  }> {
    const queryFn = client ? client.query.bind(client) : query;

    const statusResult = await queryFn(`
      SELECT status, COUNT(*)::int as count FROM ${this.tableName} GROUP BY status
    `);
    const statusMap: Record<string, number> = {};
    statusResult.rows.forEach((r: any) => { statusMap[r.status] = r.count; });

    const bySlotResult = await queryFn(`
      SELECT ts.name as slot_name, COUNT(*)::int as count
      FROM ${this.tableName} v
      JOIN trait_slots ts ON v.slot_id = ts.id
      GROUP BY ts.name ORDER BY count DESC
    `);

    const byRarityResult = await queryFn(`
      SELECT rt.name as rarity_name, COUNT(*)::int as count
      FROM ${this.tableName} v
      JOIN rarity_tiers rt ON v.rarity_tier_id = rt.id
      GROUP BY rt.name ORDER BY count DESC
    `);

    const total = (statusMap['active'] || 0) + (statusMap['redeemed'] || 0) + (statusMap['revoked'] || 0);

    return {
      total,
      active: statusMap['active'] || 0,
      redeemed: statusMap['redeemed'] || 0,
      revoked: statusMap['revoked'] || 0,
      bySlot: bySlotResult.rows,
      byRarity: byRarityResult.rows,
    };
  }

  async countWithFilters(filters?: { status?: string }, client?: PoolClient): Promise<number> {
    let queryText = `SELECT COUNT(*)::int as count FROM ${this.tableName}`;
    const params: any[] = [];
    if (filters?.status) {
      queryText += ` WHERE status = $1`;
      params.push(filters.status);
    }
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, params);
    return result.rows[0].count;
  }
}
