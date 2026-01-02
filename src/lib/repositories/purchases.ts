import { PoolClient } from 'pg';
import { BaseRepository } from './base';
import { Purchase, PurchaseStatus } from '@/types';
import { query } from '@/lib/database';

export interface PurchaseRow {
  id: string;
  wallet_address: string;
  asset_id: string;
  trait_id: string;
  price_amount: string; // bigint stored as string
  token_id: string;
  treasury_wallet: string;
  status: PurchaseStatus;
  tx_signature?: string;
  created_at: Date;
  updated_at: Date;
}

export class PurchaseRepository extends BaseRepository<PurchaseRow> {
  constructor() {
    super('purchases');
  }

  async findByWallet(walletAddress: string, client?: PoolClient): Promise<PurchaseRow[]> {
    const queryText = `
      SELECT * FROM ${this.tableName} 
      WHERE wallet_address = $1
      ORDER BY created_at DESC
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [walletAddress]);
    return result.rows;
  }

  async findByStatus(status: PurchaseStatus, client?: PoolClient): Promise<PurchaseRow[]> {
    const queryText = `
      SELECT * FROM ${this.tableName} 
      WHERE status = $1
      ORDER BY created_at ASC
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [status]);
    return result.rows;
  }

  async findByTxSignature(txSignature: string, client?: PoolClient): Promise<PurchaseRow | null> {
    const queryText = `
      SELECT * FROM ${this.tableName} 
      WHERE tx_signature = $1
      LIMIT 1
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [txSignature]);
    return result.rows[0] || null;
  }

  async updateStatus(id: string, status: PurchaseStatus, txSignature?: string, client?: PoolClient): Promise<PurchaseRow | null> {
    const queryText = `
      UPDATE ${this.tableName}
      SET status = $2, tx_signature = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [id, status, txSignature]);
    return result.rows[0] || null;
  }

  async findPendingPurchases(olderThanMinutes: number = 30, client?: PoolClient): Promise<PurchaseRow[]> {
    const queryText = `
      SELECT * FROM ${this.tableName} 
      WHERE status IN ('created', 'tx_built') 
      AND created_at < NOW() - INTERVAL '${olderThanMinutes} minutes'
      ORDER BY created_at ASC
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText);
    return result.rows;
  }

  async getRevenueStats(startDate?: Date, endDate?: Date, client?: PoolClient): Promise<{
    totalRevenue: string;
    totalPurchases: number;
    revenueByToken: { tokenId: string; revenue: string; count: number }[];
  }> {
    let whereClause = "WHERE status = 'fulfilled'";
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    const queryText = `
      SELECT 
        SUM(price_amount::bigint) as total_revenue,
        COUNT(*) as total_purchases,
        token_id,
        SUM(price_amount::bigint) as token_revenue,
        COUNT(*) as token_count
      FROM ${this.tableName}
      ${whereClause}
      GROUP BY ROLLUP(token_id)
      ORDER BY token_id NULLS FIRST
    `;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, params);

    const totalRow = result.rows.find((row: any) => row.token_id === null);
    const tokenRows = result.rows.filter((row: any) => row.token_id !== null);

    return {
      totalRevenue: totalRow?.total_revenue || '0',
      totalPurchases: parseInt(totalRow?.total_purchases || '0'),
      revenueByToken: tokenRows.map((row: any) => ({
        tokenId: row.token_id,
        revenue: row.token_revenue,
        count: parseInt(row.token_count),
      })),
    };
  }

  // Convert database row to domain model
  toDomain(row: PurchaseRow): Purchase {
    return {
      id: row.id,
      walletAddress: row.wallet_address,
      assetId: row.asset_id,
      traitId: row.trait_id,
      priceAmount: row.price_amount, // Keep as string
      tokenId: row.token_id,
      status: row.status,
      txSignature: row.tx_signature,
    };
  }

  // Convert domain model to database row
  fromDomain(purchase: Partial<Purchase>): Partial<PurchaseRow> {
    const result: Partial<PurchaseRow> = {
      wallet_address: purchase.walletAddress,
      asset_id: purchase.assetId,
      trait_id: purchase.traitId,
      price_amount: purchase.priceAmount?.toString(),
      token_id: purchase.tokenId,
      status: purchase.status,
      tx_signature: purchase.txSignature,
    };

    // Only include id if it's defined (for create operations)
    if (purchase.id !== undefined) {
      result.id = purchase.id;
    }

    return result;
  }
}