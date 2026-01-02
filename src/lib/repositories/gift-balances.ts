import { BaseRepository } from './base';
import { query } from '../database';

export interface GiftBalanceRow {
  id: string;
  wallet_address: string;
  trait_id: string;
  qty_available: number;
  created_at: Date;
  // Joined fields from trait
  trait_name?: string;
  slot_name?: string;
  rarity_tier_name?: string;
}

export interface GiftBalance {
  id: string;
  walletAddress: string;
  traitId: string;
  traitName?: string;
  qtyAvailable: number;
  createdAt: string;
}

export class GiftBalanceRepository extends BaseRepository<GiftBalanceRow> {
  constructor() {
    super('gift_balances');
  }
  async findWithTraitDetails(filters: {
    walletAddress?: string;
    traitId?: string;
  } = {}): Promise<GiftBalanceRow[]> {
    let queryText = `
      SELECT 
        gb.*,
        t.name as trait_name,
        ts.name as slot_name,
        rt.name as rarity_tier_name
      FROM gift_balances gb
      JOIN traits t ON gb.trait_id = t.id
      JOIN trait_slots ts ON t.slot_id = ts.id
      JOIN rarity_tiers rt ON t.rarity_tier_id = rt.id
      WHERE gb.qty_available > 0
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.walletAddress) {
      queryText += ` AND gb.wallet_address = $${paramIndex}`;
      params.push(filters.walletAddress);
      paramIndex++;
    }

    if (filters.traitId) {
      queryText += ` AND gb.trait_id = $${paramIndex}`;
      params.push(filters.traitId);
      paramIndex++;
    }

    queryText += ' ORDER BY gb.created_at DESC';

    const result = await query(queryText, params);
    return result.rows;
  }

  async findByWalletAndTrait(walletAddress: string, traitId: string): Promise<GiftBalanceRow | null> {
    const result = await query(
      'SELECT * FROM gift_balances WHERE wallet_address = $1 AND trait_id = $2',
      [walletAddress, traitId]
    );
    return result.rows[0] || null;
  }

  async updateQuantity(id: string, newQuantity: number): Promise<GiftBalanceRow> {
    const result = await query(
      `UPDATE gift_balances 
       SET qty_available = $2, updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [id, newQuantity]
    );
    return result.rows[0];
  }

  async decrementQuantity(walletAddress: string, traitId: string, amount: number = 1): Promise<boolean> {
    const result = await query(
      `UPDATE gift_balances 
       SET qty_available = qty_available - $3 
       WHERE wallet_address = $1 AND trait_id = $2 AND qty_available >= $3
       RETURNING *`,
      [walletAddress, traitId, amount]
    );
    return result.rows.length > 0;
  }

  async getTotalGiftBalance(walletAddress: string): Promise<number> {
    const result = await query(
      'SELECT COALESCE(SUM(qty_available), 0) as total FROM gift_balances WHERE wallet_address = $1',
      [walletAddress]
    );
    return parseInt(result.rows[0].total);
  }

  fromDomain(gift: Partial<GiftBalance>): Partial<GiftBalanceRow> {
    return {
      wallet_address: gift.walletAddress,
      trait_id: gift.traitId,
      qty_available: gift.qtyAvailable,
    };
  }

  toDomain(row: GiftBalanceRow): GiftBalance {
    return {
      id: row.id,
      walletAddress: row.wallet_address,
      traitId: row.trait_id,
      traitName: row.trait_name,
      qtyAvailable: row.qty_available,
      createdAt: row.created_at.toISOString(),
    };
  }
}