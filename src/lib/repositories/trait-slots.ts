import { PoolClient } from 'pg';
import { BaseRepository } from './base';
import { TraitSlot } from '@/types';
import { query } from '@/lib/database';

export interface TraitSlotRow {
  id: string;
  name: string;
  layer_order: number;
  rules_json?: any;
  created_at: Date;
}

export class TraitSlotRepository extends BaseRepository<TraitSlotRow> {
  constructor() {
    super('trait_slots');
  }

  async findAllOrdered(client?: PoolClient): Promise<TraitSlotRow[]> {
    const queryText = `
      SELECT * FROM ${this.tableName}
      ORDER BY layer_order ASC
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText);
    return result.rows;
  }

  async findByLayerOrder(layerOrder: number, client?: PoolClient): Promise<TraitSlotRow | null> {
    const queryText = `
      SELECT * FROM ${this.tableName}
      WHERE layer_order = $1
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [layerOrder]);
    return result.rows[0] || null;
  }

  // Convert database row to domain model
  toDomain(row: TraitSlotRow): TraitSlot {
    return {
      id: row.id,
      name: row.name,
      layerOrder: row.layer_order,
      rulesJson: row.rules_json,
    };
  }

  // Convert domain model to database row
  fromDomain(slot: Partial<TraitSlot>): Partial<TraitSlotRow> {
    const result: Partial<TraitSlotRow> = {
      name: slot.name,
      layer_order: slot.layerOrder,
      rules_json: slot.rulesJson,
    };

    // Only include id if it's defined (for create operations)
    if (slot.id !== undefined) {
      result.id = slot.id;
    }

    return result;
  }
}