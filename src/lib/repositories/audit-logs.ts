import { PoolClient } from 'pg';
import { BaseRepository } from './base';
import { AuditLog } from '../../types';
import { query } from '../database';

export interface AuditLogRow {
  id: string;
  actor_type: 'admin' | 'user' | 'system';
  actor_id?: string;
  action: string;
  payload_json?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export class AuditLogRepository extends BaseRepository<AuditLogRow> {
  constructor() {
    super('audit_logs');
  }

  async logAction(
    actorType: 'admin' | 'user' | 'system',
    action: string,
    options: {
      actorId?: string;
      payload?: any;
      ipAddress?: string;
      userAgent?: string;
    } = {},
    client?: PoolClient
  ): Promise<AuditLogRow> {
    const queryText = `
      INSERT INTO ${this.tableName} (actor_type, actor_id, action, payload_json, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [
      actorType,
      options.actorId || null,
      action,
      options.payload ? JSON.stringify(options.payload) : null,
      options.ipAddress || null,
      options.userAgent || null,
    ]);

    return result.rows[0];
  }

  async findByActor(
    actorType: 'admin' | 'user' | 'system',
    actorId?: string,
    limit: number = 100,
    client?: PoolClient
  ): Promise<AuditLogRow[]> {
    let queryText = `
      SELECT * FROM ${this.tableName}
      WHERE actor_type = $1
    `;
    const params: any[] = [actorType];

    if (actorId) {
      queryText += ` AND actor_id = $2`;
      params.push(actorId);
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, params);
    return result.rows;
  }

  async findByAction(
    action: string,
    limit: number = 100,
    client?: PoolClient
  ): Promise<AuditLogRow[]> {
    const queryText = `
      SELECT * FROM ${this.tableName}
      WHERE action = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [action, limit]);
    return result.rows;
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    limit: number = 1000,
    client?: PoolClient
  ): Promise<AuditLogRow[]> {
    const queryText = `
      SELECT * FROM ${this.tableName}
      WHERE created_at >= $1 AND created_at <= $2
      ORDER BY created_at DESC
      LIMIT $3
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [startDate, endDate, limit]);
    return result.rows;
  }

  async getActionStats(
    startDate?: Date,
    endDate?: Date,
    client?: PoolClient
  ): Promise<{ action: string; count: number }[]> {
    let queryText = `
      SELECT action, COUNT(*) as count
      FROM ${this.tableName}
    `;
    const params: any[] = [];

    if (startDate && endDate) {
      queryText += ` WHERE created_at >= $1 AND created_at <= $2`;
      params.push(startDate, endDate);
    } else if (startDate) {
      queryText += ` WHERE created_at >= $1`;
      params.push(startDate);
    } else if (endDate) {
      queryText += ` WHERE created_at <= $1`;
      params.push(endDate);
    }

    queryText += ` GROUP BY action ORDER BY count DESC`;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, params);
    
    return result.rows.map((row: any) => ({
      action: row.action,
      count: parseInt(row.count),
    }));
  }

  async getActorStats(
    actorType?: 'admin' | 'user' | 'system',
    startDate?: Date,
    endDate?: Date,
    client?: PoolClient
  ): Promise<{ actorId: string; actorType: string; count: number }[]> {
    let queryText = `
      SELECT actor_id, actor_type, COUNT(*) as count
      FROM ${this.tableName}
      WHERE actor_id IS NOT NULL
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (actorType) {
      queryText += ` AND actor_type = $${paramIndex}`;
      params.push(actorType);
      paramIndex++;
    }

    if (startDate) {
      queryText += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      queryText += ` AND created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    queryText += ` GROUP BY actor_id, actor_type ORDER BY count DESC`;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, params);
    
    return result.rows.map((row: any) => ({
      actorId: row.actor_id,
      actorType: row.actor_type,
      count: parseInt(row.count),
    }));
  }

  async findPaginated(
    filters: {
      actorType?: string;
      action?: string;
      startDate?: Date;
      endDate?: Date;
    } = {},
    page: number = 1,
    limit: number = 50,
    client?: PoolClient
  ): Promise<{ logs: AuditLogRow[]; total: number }> {
    let whereClause = '';
    const params: any[] = [];
    let paramIndex = 1;

    const conditions: string[] = [];

    if (filters.actorType) {
      conditions.push(`actor_type = $${paramIndex}`);
      params.push(filters.actorType);
      paramIndex++;
    }

    if (filters.action) {
      conditions.push(`action = $${paramIndex}`);
      params.push(filters.action);
      paramIndex++;
    }

    if (filters.startDate) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(filters.endDate);
      paramIndex++;
    }

    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }

    const queryFn = client ? client.query.bind(client) : query;

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`;
    const countResult = await queryFn(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const offset = (page - 1) * limit;
    const dataQuery = `
      SELECT * FROM ${this.tableName} 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const dataResult = await queryFn(dataQuery, params);

    return {
      logs: dataResult.rows,
      total,
    };
  }

  async searchLogs(
    searchTerm: string,
    limit: number = 100,
    client?: PoolClient
  ): Promise<AuditLogRow[]> {
    const queryText = `
      SELECT * FROM ${this.tableName}
      WHERE action ILIKE $1 
         OR payload_json::text ILIKE $1
         OR actor_id ILIKE $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const searchPattern = `%${searchTerm}%`;
    const result = await queryFn(queryText, [searchPattern, limit]);
    return result.rows;
  }

  // Convert database row to domain model
  toDomain(row: AuditLogRow): AuditLog {
    return {
      id: row.id,
      actorType: row.actor_type,
      actorId: row.actor_id,
      action: row.action,
      payloadJson: row.payload_json,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
    };
  }

  // Convert domain model to database row
  fromDomain(log: Partial<AuditLog>): Partial<AuditLogRow> {
    const result: Partial<AuditLogRow> = {
      actor_type: log.actorType,
      actor_id: log.actorId,
      action: log.action,
      payload_json: log.payloadJson,
      ip_address: log.ipAddress,
      user_agent: log.userAgent,
      created_at: log.createdAt,
    };

    // Only include id if it's defined (for create operations)
    if (log.id !== undefined) {
      result.id = log.id;
    }

    return result;
  }
}