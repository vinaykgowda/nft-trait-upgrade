import { PoolClient } from 'pg';
import { BaseRepository } from './base';
import { Trait } from '@/types';
import { query } from '@/lib/database';
import { formatDecimalPrice } from '@/lib/utils';

export interface TraitRow {
  id: string;
  slot_id: string;
  name: string;
  image_layer_url: string;
  rarity_tier_id: string;
  total_supply?: number;
  remaining_supply?: number;
  price_amount: string; // decimal stored as string
  price_token_id: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TraitWithRelations extends TraitRow {
  slot_name: string | null;
  slot_layer_order: number | null;
  rarity_name: string | null;
  rarity_weight: number | null;
  token_symbol: string | null;
  token_decimals: number | null;
  token_mint_address?: string | null;
}

export class TraitRepository extends BaseRepository<TraitRow> {
  constructor() {
    super('traits');
  }

  async findWithRelations(filters?: {
    slotId?: string;
    rarityTierId?: string;
    tokenId?: string;
    active?: boolean;
    hasAvailableSupply?: boolean;
    limit?: number;
    offset?: number;
  }, client?: PoolClient): Promise<TraitWithRelations[]> {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.slotId) {
      whereClause += ` AND t.slot_id = $${paramIndex}`;
      params.push(filters.slotId);
      paramIndex++;
    }

    if (filters?.rarityTierId) {
      whereClause += ` AND t.rarity_tier_id = $${paramIndex}`;
      params.push(filters.rarityTierId);
      paramIndex++;
    }

    if (filters?.tokenId) {
      whereClause += ` AND t.price_token_id = $${paramIndex}`;
      params.push(filters.tokenId);
      paramIndex++;
    }

    if (filters?.active !== undefined) {
      whereClause += ` AND t.active = $${paramIndex}`;
      params.push(filters.active);
      paramIndex++;
    }

    if (filters?.hasAvailableSupply) {
      whereClause += ` AND (t.total_supply IS NULL OR t.remaining_supply > 0)`;
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
        t.*,
        ts.name as slot_name,
        ts.layer_order as slot_layer_order,
        rt.name as rarity_name,
        rt.weight as rarity_weight,
        tok.symbol as token_symbol,
        tok.decimals as token_decimals,
        tok.mint_address as token_mint_address
      FROM ${this.tableName} t
      LEFT JOIN trait_slots ts ON t.slot_id = ts.id
      LEFT JOIN rarity_tiers rt ON t.rarity_tier_id = rt.id
      LEFT JOIN tokens tok ON t.price_token_id = tok.id
      ${whereClause}
      ORDER BY COALESCE(ts.layer_order, 999), COALESCE(rt.display_order, 999), t.name
      ${limitClause}
    `;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, params);
    return result.rows;
  }

  async countWithFilters(filters?: {
    slotId?: string;
    rarityTierId?: string;
    tokenId?: string;
    active?: boolean;
    hasAvailableSupply?: boolean;
  }, client?: PoolClient): Promise<number> {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.slotId) {
      whereClause += ` AND slot_id = $${paramIndex}`;
      params.push(filters.slotId);
      paramIndex++;
    }

    if (filters?.rarityTierId) {
      whereClause += ` AND rarity_tier_id = $${paramIndex}`;
      params.push(filters.rarityTierId);
      paramIndex++;
    }

    if (filters?.tokenId) {
      whereClause += ` AND price_token_id = $${paramIndex}`;
      params.push(filters.tokenId);
      paramIndex++;
    }

    if (filters?.active !== undefined) {
      whereClause += ` AND active = $${paramIndex}`;
      params.push(filters.active);
      paramIndex++;
    }

    if (filters?.hasAvailableSupply) {
      whereClause += ` AND (total_supply IS NULL OR remaining_supply > 0)`;
    }

    const queryText = `
      SELECT COUNT(*) as count
      FROM ${this.tableName}
      ${whereClause}
    `;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, params);
    return parseInt(result.rows[0].count);
  }

  async findBySlot(slotId: string, client?: PoolClient): Promise<TraitRow[]> {
    const queryText = `
      SELECT * FROM ${this.tableName} 
      WHERE slot_id = $1 AND active = true
      ORDER BY name
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [slotId]);
    return result.rows;
  }

  async findAvailable(client?: PoolClient): Promise<TraitRow[]> {
    const queryText = `
      SELECT * FROM ${this.tableName} 
      WHERE active = true 
      AND (total_supply IS NULL OR remaining_supply > 0)
      ORDER BY name
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText);
    return result.rows;
  }

  async updateSupply(id: string, remainingSupply: number, client?: PoolClient): Promise<TraitRow | null> {
    const queryText = `
      UPDATE ${this.tableName}
      SET remaining_supply = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [id, remainingSupply]);
    return result.rows[0] || null;
  }

  async decrementSupply(id: string, amount: number = 1, client?: PoolClient): Promise<TraitRow | null> {
    const queryText = `
      UPDATE ${this.tableName}
      SET remaining_supply = remaining_supply - $2, updated_at = NOW()
      WHERE id = $1 AND remaining_supply >= $2
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [id, amount]);
    return result.rows[0] || null;
  }

  async deleteAll(client?: PoolClient): Promise<number> {
    const queryText = `DELETE FROM ${this.tableName}`;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText);
    return result.rowCount || 0;
  }

  // Convert database row to domain model
  toDomain(row: TraitWithRelations): Trait {
    return {
      id: row.id,
      slotId: row.slot_id,
      name: row.name,
      imageLayerUrl: row.image_layer_url,
      rarityTier: {
        id: row.rarity_tier_id,
        name: row.rarity_name || 'Common',
        weight: row.rarity_weight || 50,
        displayOrder: 0, // Would need to join to get this
      },
      totalSupply: row.total_supply,
      remainingSupply: row.remaining_supply,
      priceAmount: row.price_amount ? formatDecimalPrice(row.price_amount) : '0', // Format decimal price
      priceToken: {
        id: row.price_token_id,
        symbol: row.token_symbol || 'UNKNOWN',
        mintAddress: row.token_mint_address || undefined,
        decimals: row.token_decimals || 9,
        enabled: true, // Would need to join to get this
      },
      active: row.active,
    };
  }

  // Convert domain model to database row
  fromDomain(trait: Partial<Trait>): Partial<TraitRow> {
    const result: Partial<TraitRow> = {
      slot_id: trait.slotId,
      name: trait.name,
      image_layer_url: trait.imageLayerUrl,
      rarity_tier_id: trait.rarityTier?.id || (trait as any).rarityTierId, // Handle both nested and flat structure
      total_supply: trait.totalSupply,
      remaining_supply: trait.remainingSupply,
      price_amount: trait.priceAmount?.toString(), // Keep as string
      price_token_id: trait.priceToken?.id || (trait as any).priceTokenId, // Handle both nested and flat structure
      active: trait.active,
    };

    // Only include id if it's defined (for create operations)
    if (trait.id !== undefined) {
      result.id = trait.id;
    }

    return result;
  }
}