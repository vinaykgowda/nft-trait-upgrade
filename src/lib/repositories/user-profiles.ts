import { PoolClient } from 'pg';
import { BaseRepository } from './base';
import { query } from '@/lib/database';

export interface UserProfileRow {
  id: string;
  discord_id: string;
  discord_username: string;
  discord_display_name?: string;
  discord_avatar?: string;
  discord_servers?: any;
  created_at: Date;
  updated_at: Date;
}

export class UserProfileRepository extends BaseRepository<UserProfileRow> {
  constructor() {
    super('user_profiles');
  }

  async findByDiscordId(discordId: string, client?: PoolClient): Promise<UserProfileRow | null> {
    const queryText = `SELECT * FROM ${this.tableName} WHERE discord_id = $1`;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, [discordId]);
    return result.rows[0] || null;
  }

  async findByDiscordUsername(username: string, client?: PoolClient): Promise<UserProfileRow | null> {
    const queryText = `SELECT * FROM ${this.tableName} WHERE discord_username = $1`;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, [username]);
    return result.rows[0] || null;
  }

  async searchByUsername(search: string, limit: number = 20, client?: PoolClient): Promise<UserProfileRow[]> {
    const queryText = `
      SELECT * FROM ${this.tableName}
      WHERE discord_username ILIKE $1
      ORDER BY discord_username
      LIMIT $2
    `;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, [`%${search}%`, limit]);
    return result.rows;
  }

  async upsertFromDiscord(data: {
    discordId: string;
    discordUsername: string;
    discordDisplayName?: string;
    discordAvatar?: string;
    discordServers?: any;
  }, client?: PoolClient): Promise<UserProfileRow> {
    const queryText = `
      INSERT INTO ${this.tableName} (discord_id, discord_username, discord_display_name, discord_avatar, discord_servers)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (discord_id) DO UPDATE SET
        discord_username = EXCLUDED.discord_username,
        discord_display_name = EXCLUDED.discord_display_name,
        discord_avatar = EXCLUDED.discord_avatar,
        discord_servers = EXCLUDED.discord_servers,
        updated_at = NOW()
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText, [
      data.discordId,
      data.discordUsername,
      data.discordDisplayName || null,
      data.discordAvatar || null,
      JSON.stringify(data.discordServers || []),
    ]);
    return result.rows[0];
  }

  async getAllUsernames(client?: PoolClient): Promise<{ id: string; discord_username: string }[]> {
    const queryText = `SELECT id, discord_username FROM ${this.tableName} ORDER BY discord_username`;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(queryText);
    return result.rows;
  }
}
