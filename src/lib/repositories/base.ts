import { PoolClient } from 'pg';
import { query, getClient } from '@/lib/database';
import { randomUUID } from 'crypto';

export abstract class BaseRepository<T> {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  async findById(id: string, client?: PoolClient): Promise<T | null> {
    const queryText = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [id]);
    return result.rows[0] || null;
  }

  async findAll(client?: PoolClient): Promise<T[]> {
    const queryText = `SELECT * FROM ${this.tableName} ORDER BY created_at DESC`;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText);
    return result.rows;
  }

  async create(data: Partial<T>, client?: PoolClient): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    
    // Generate UUID if id is not provided
    if (!data.hasOwnProperty('id')) {
      keys.unshift('id');
      values.unshift(randomUUID());
    }
    
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
    const columns = keys.join(', ');

    const queryText = `
      INSERT INTO ${this.tableName} (${columns})
      VALUES (${placeholders})
      RETURNING *
    `;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, values);
    return result.rows[0];
  }

  async update(id: string, data: Partial<T>, client?: PoolClient): Promise<T | null> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');

    const queryText = `
      UPDATE ${this.tableName}
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, [id, ...values]);
    return result.rows[0] || null;
  }

  async delete(id: string, client?: PoolClient): Promise<boolean> {
    const queryText = `DELETE FROM ${this.tableName} WHERE id = $1`;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [id]);
    return result.rowCount > 0;
  }

  async count(client?: PoolClient): Promise<number> {
    const queryText = `SELECT COUNT(*) FROM ${this.tableName}`;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText);
    return parseInt(result.rows[0].count);
  }
}