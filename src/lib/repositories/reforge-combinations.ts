import { PoolClient } from 'pg';
import { createHash } from 'crypto';
import { BaseRepository } from './base';
import { ReforgeCombination } from '@/types/reforge';
import { query } from '@/lib/database';

export interface ReforgeCombinationRow {
  id: string;
  order_id: string;
  collection_id: string;
  combination_hash: string;
  trait_ids: string[];
  created_at: Date;
}

export class ReforgeCombinationRepository extends BaseRepository<ReforgeCombinationRow> {
  constructor() {
    super('reforge_combinations');
  }

  /**
   * Generate a SHA-256 hash of sorted trait IDs for uniqueness checking.
   */
  static generateHash(traitIds: string[]): string {
    const sorted = [...traitIds].sort();
    return createHash('sha256').update(sorted.join(',')).digest('hex');
  }

  /**
   * Check if a combination of trait IDs is unique within a collection.
   * Returns true if the combination does NOT exist (is unique).
   */
  async isUnique(collectionId: string, traitIds: string[], client?: PoolClient): Promise<boolean> {
    const hash = ReforgeCombinationRepository.generateHash(traitIds);
    const queryText = `
      SELECT 1 FROM ${this.tableName}
      WHERE collection_id = $1 AND combination_hash = $2
      LIMIT 1
    `;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, [collectionId, hash]);
    return result.rows.length === 0;
  }

  /**
   * Record a new combination for an order.
   */
  async recordCombination(orderId: string, collectionId: string, traitIds: string[], client?: PoolClient): Promise<ReforgeCombinationRow> {
    const hash = ReforgeCombinationRepository.generateHash(traitIds);
    const queryText = `
      INSERT INTO ${this.tableName} (order_id, collection_id, combination_hash, trait_ids)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, [orderId, collectionId, hash, traitIds]);
    return result.rows[0];
  }

  // Convert database row to domain model
  toDomain(row: ReforgeCombinationRow): ReforgeCombination {
    return {
      id: row.id,
      orderId: row.order_id,
      collectionId: row.collection_id,
      combinationHash: row.combination_hash,
      traitIds: row.trait_ids,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }

  // Convert domain model to database row
  fromDomain(combination: Partial<ReforgeCombination>): Partial<ReforgeCombinationRow> {
    const result: Partial<ReforgeCombinationRow> = {};

    if (combination.id !== undefined) result.id = combination.id;
    if (combination.orderId !== undefined) result.order_id = combination.orderId;
    if (combination.collectionId !== undefined) result.collection_id = combination.collectionId;
    if (combination.combinationHash !== undefined) result.combination_hash = combination.combinationHash;
    if (combination.traitIds !== undefined) result.trait_ids = combination.traitIds;

    return result;
  }
}
