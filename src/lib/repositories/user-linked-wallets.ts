import { PoolClient } from 'pg';
import { BaseRepository } from './base';
import { query } from '@/lib/database';

export interface UserLinkedWalletRow {
  id: string;
  user_id: string;
  wallet_address: string;
  label?: string;
  verified: boolean;
  created_at: Date;
}

export class UserLinkedWalletRepository extends BaseRepository<UserLinkedWalletRow> {
  constructor() {
    super('user_linked_wallets');
  }

  async findByUserId(userId: string, client?: PoolClient): Promise<UserLinkedWalletRow[]> {
    const queryText = `SELECT * FROM ${this.tableName} WHERE user_id = $1 ORDER BY created_at`;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, [userId]);
    return result.rows;
  }

  async findByWalletAddress(walletAddress: string, client?: PoolClient): Promise<UserLinkedWalletRow | null> {
    const queryText = `SELECT * FROM ${this.tableName} WHERE wallet_address = $1`;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, [walletAddress]);
    return result.rows[0] || null;
  }

  async linkWallet(userId: string, walletAddress: string, label?: string, client?: PoolClient): Promise<UserLinkedWalletRow> {
    const queryText = `
      INSERT INTO ${this.tableName} (user_id, wallet_address, label, verified)
      VALUES ($1, $2, $3, false)
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, [userId, walletAddress, label || null]);
    return result.rows[0];
  }

  async verifyWallet(id: string, client?: PoolClient): Promise<UserLinkedWalletRow | null> {
    const queryText = `
      UPDATE ${this.tableName} SET verified = true WHERE id = $1 RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, [id]);
    return result.rows[0] || null;
  }

  async unlinkWallet(id: string, userId: string, client?: PoolClient): Promise<boolean> {
    const queryText = `DELETE FROM ${this.tableName} WHERE id = $1 AND user_id = $2`;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, [id, userId]);
    return (result.rowCount || 0) > 0;
  }
}
