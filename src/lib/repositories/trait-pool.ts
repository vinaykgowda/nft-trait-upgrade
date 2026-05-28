import { PoolClient } from 'pg';
import { PoolTrait } from '@/types/reforge';
import { query } from '@/lib/database';

export interface TraitPoolRow {
  id: string;
  slot_id: string;
  slot_name: string;
  name: string;
  image_layer_url: string;
  ldz_earning: string; // numeric stored as string
  layer_order: number;
}

export class TraitPoolRepository {
  /**
   * Find all swap-pool traits for a given collection.
   * Queries traits where swap_pool_only = true, joined with their slot info.
   */
  async findByCollection(collectionId: string, client?: PoolClient): Promise<TraitPoolRow[]> {
    const queryText = `
      SELECT 
        t.id,
        t.slot_id,
        ts.name AS slot_name,
        t.name,
        t.image_layer_url,
        COALESCE(t.ldz_earning, 0) AS ldz_earning,
        ts.layer_order
      FROM traits t
      INNER JOIN trait_slots ts ON t.slot_id = ts.id
      WHERE t.swap_pool_only = true
        AND t.active = true
        AND ts.project_id = $1
      ORDER BY ts.layer_order ASC, t.name ASC
    `;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, [collectionId]);
    return result.rows;
  }

  /**
   * Find swap-pool traits for a specific slot within a collection.
   */
  async findBySlot(collectionId: string, slotId: string, client?: PoolClient): Promise<TraitPoolRow[]> {
    const queryText = `
      SELECT 
        t.id,
        t.slot_id,
        ts.name AS slot_name,
        t.name,
        t.image_layer_url,
        COALESCE(t.ldz_earning, 0) AS ldz_earning,
        ts.layer_order
      FROM traits t
      INNER JOIN trait_slots ts ON t.slot_id = ts.id
      WHERE t.swap_pool_only = true
        AND t.active = true
        AND ts.project_id = $1
        AND t.slot_id = $2
      ORDER BY t.name ASC
    `;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, [collectionId, slotId]);
    return result.rows;
  }

  /**
   * Convert database row to domain model.
   */
  toDomain(row: TraitPoolRow): PoolTrait {
    return {
      id: row.id,
      slotId: row.slot_id,
      slotName: row.slot_name,
      name: row.name,
      imageLayerUrl: row.image_layer_url,
      ldzEarning: parseFloat(row.ldz_earning),
      layerOrder: row.layer_order,
    };
  }
}
