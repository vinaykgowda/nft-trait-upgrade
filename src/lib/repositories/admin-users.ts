import { PoolClient } from 'pg';
import { BaseRepository } from './base';
import { AdminUser } from '../../types';
import { query } from '../database';

export interface AdminUserRow {
  id: string;
  username: string;
  password_hash: string;
  roles: string[];
  mfa_enabled: boolean;
  mfa_secret_encrypted?: string;
  last_login_at?: Date;
  failed_attempts: number;
  locked_until?: Date;
  created_at: Date;
}

export class AdminUserRepository extends BaseRepository<AdminUserRow> {
  constructor() {
    super('admin_users');
  }

  async findByUsername(username: string, client?: PoolClient): Promise<AdminUserRow | null> {
    const queryText = `
      SELECT * FROM ${this.tableName} 
      WHERE username = $1
      LIMIT 1
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [username]);
    return result.rows[0] || null;
  }

  async updateLastLogin(id: string, client?: PoolClient): Promise<AdminUserRow | null> {
    const queryText = `
      UPDATE ${this.tableName}
      SET last_login_at = NOW(), failed_attempts = 0, locked_until = NULL
      WHERE id = $1
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [id]);
    return result.rows[0] || null;
  }

  async incrementFailedAttempts(id: string, client?: PoolClient): Promise<AdminUserRow | null> {
    const queryText = `
      UPDATE ${this.tableName}
      SET failed_attempts = failed_attempts + 1
      WHERE id = $1
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [id]);
    return result.rows[0] || null;
  }

  async lockAccount(id: string, lockDurationMinutes: number, client?: PoolClient): Promise<AdminUserRow | null> {
    const queryText = `
      UPDATE ${this.tableName}
      SET locked_until = NOW() + INTERVAL '${lockDurationMinutes} minutes'
      WHERE id = $1
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [id]);
    return result.rows[0] || null;
  }

  async enableMFA(id: string, encryptedSecret: string, client?: PoolClient): Promise<AdminUserRow | null> {
    const queryText = `
      UPDATE ${this.tableName}
      SET mfa_enabled = true, mfa_secret_encrypted = $2
      WHERE id = $1
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [id, encryptedSecret]);
    return result.rows[0] || null;
  }

  async disableMFA(id: string, client?: PoolClient): Promise<AdminUserRow | null> {
    const queryText = `
      UPDATE ${this.tableName}
      SET mfa_enabled = false, mfa_secret_encrypted = NULL
      WHERE id = $1
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [id]);
    return result.rows[0] || null;
  }

  async updatePassword(id: string, passwordHash: string, client?: PoolClient): Promise<AdminUserRow | null> {
    const queryText = `
      UPDATE ${this.tableName}
      SET password_hash = $2
      WHERE id = $1
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [id, passwordHash]);
    return result.rows[0] || null;
  }

  async isAccountLocked(id: string, client?: PoolClient): Promise<boolean> {
    const queryText = `
      SELECT locked_until FROM ${this.tableName}
      WHERE id = $1 AND locked_until > NOW()
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [id]);
    return result.rows.length > 0;
  }

  async unlockAccount(id: string, client?: PoolClient): Promise<AdminUserRow | null> {
    const queryText = `
      UPDATE ${this.tableName}
      SET locked_until = NULL, failed_attempts = 0
      WHERE id = $1
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [id]);
    return result.rows[0] || null;
  }

  // Convert database row to domain model
  toDomain(row: AdminUserRow): AdminUser {
    return {
      id: row.id,
      username: row.username,
      roles: row.roles,
      mfaEnabled: row.mfa_enabled,
      lastLoginAt: row.last_login_at,
    };
  }

  // Convert domain model to database row (excluding sensitive fields)
  fromDomain(user: Partial<AdminUser>): Partial<AdminUserRow> {
    const result: Partial<AdminUserRow> = {
      username: user.username,
      roles: user.roles,
      mfa_enabled: user.mfaEnabled,
      last_login_at: user.lastLoginAt,
    };

    // Only include id if it's defined (for create operations)
    if (user.id !== undefined) {
      result.id = user.id;
    }

    return result;
  }
}