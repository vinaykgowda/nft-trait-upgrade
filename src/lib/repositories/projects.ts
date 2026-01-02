import { PoolClient } from 'pg';
import { BaseRepository } from './base';
import { Project } from '@/types';
import { query } from '@/lib/database';

export interface ProjectRow {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  background_url?: string;
  discord_url?: string;
  x_url?: string;
  magiceden_url?: string;
  website_url?: string;
  collection_ids: string[];
  treasury_wallet: string;
  created_at: Date;
  updated_at: Date;
}

export class ProjectRepository extends BaseRepository<ProjectRow> {
  constructor() {
    super('projects');
  }

  async findByCollectionId(collectionId: string, client?: PoolClient): Promise<ProjectRow | null> {
    const queryText = `
      SELECT * FROM ${this.tableName} 
      WHERE $1 = ANY(collection_ids)
      LIMIT 1
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [collectionId]);
    return result.rows[0] || null;
  }

  async updateCollectionIds(id: string, collectionIds: string[], client?: PoolClient): Promise<ProjectRow | null> {
    const queryText = `
      UPDATE ${this.tableName}
      SET collection_ids = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [id, collectionIds]);
    return result.rows[0] || null;
  }

  async updateTreasuryWallet(id: string, treasuryWallet: string, client?: PoolClient): Promise<ProjectRow | null> {
    const queryText = `
      UPDATE ${this.tableName}
      SET treasury_wallet = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(queryText, [id, treasuryWallet]);
    return result.rows[0] || null;
  }

  // Convert database row to domain model
  toDomain(row: ProjectRow): Project {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      logoUrl: row.logo_url,
      backgroundUrl: row.background_url,
      discordUrl: row.discord_url,
      xUrl: row.x_url,
      magicedenUrl: row.magiceden_url,
      websiteUrl: row.website_url,
      collectionIds: row.collection_ids,
      treasuryWallet: row.treasury_wallet,
    };
  }

  // Convert domain model to database row
  fromDomain(project: Partial<Project>): Partial<ProjectRow> {
    const result: Partial<ProjectRow> = {
      name: project.name,
      description: project.description,
      logo_url: project.logoUrl,
      background_url: project.backgroundUrl,
      discord_url: project.discordUrl,
      x_url: project.xUrl,
      magiceden_url: project.magicedenUrl,
      website_url: project.websiteUrl,
      collection_ids: project.collectionIds,
      treasury_wallet: project.treasuryWallet,
    };

    // Only include id if it's defined (for create operations)
    if (project.id !== undefined) {
      result.id = project.id;
    }

    return result;
  }
}