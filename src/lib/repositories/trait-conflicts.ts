import { Pool } from 'pg';

export class TraitConflictsRepository {
  constructor(private pool: Pool) {}

  /**
   * Add a conflict relationship between two traits (bidirectional)
   */
  async addConflict(traitId: string, conflictsWithTraitId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Add both directions of the conflict
      await client.query(
        `INSERT INTO trait_conflicts (trait_id, conflicts_with_trait_id)
         VALUES ($1, $2), ($2, $1)
         ON CONFLICT (trait_id, conflicts_with_trait_id) DO NOTHING`,
        [traitId, conflictsWithTraitId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Remove a conflict relationship between two traits (bidirectional)
   */
  async removeConflict(traitId: string, conflictsWithTraitId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM trait_conflicts
       WHERE (trait_id = $1 AND conflicts_with_trait_id = $2)
          OR (trait_id = $2 AND conflicts_with_trait_id = $1)`,
      [traitId, conflictsWithTraitId]
    );
  }

  /**
   * Get all traits that conflict with a given trait
   */
  async getConflictsForTrait(traitId: string): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT conflicts_with_trait_id
       FROM trait_conflicts
       WHERE trait_id = $1`,
      [traitId]
    );

    return result.rows.map((row: { conflicts_with_trait_id: string }) => row.conflicts_with_trait_id);
  }

  /**
   * Check if two traits conflict with each other
   */
  async checkConflict(traitId: string, otherTraitId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT EXISTS(
         SELECT 1 FROM trait_conflicts
         WHERE trait_id = $1 AND conflicts_with_trait_id = $2
       ) as conflicts`,
      [traitId, otherTraitId]
    );

    return result.rows[0]?.conflicts || false;
  }

  /**
   * Set all conflicts for a trait (replaces existing conflicts)
   */
  async setConflictsForTrait(traitId: string, conflictingTraitIds: string[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Remove all existing conflicts for this trait
      await client.query(
        `DELETE FROM trait_conflicts
         WHERE trait_id = $1 OR conflicts_with_trait_id = $1`,
        [traitId]
      );

      // Add new conflicts (bidirectional)
      if (conflictingTraitIds.length > 0) {
        const values: string[] = [];
        const params: string[] = [];
        let paramIndex = 1;

        conflictingTraitIds.forEach(conflictId => {
          // Add both directions
          values.push(`($${paramIndex}, $${paramIndex + 1})`);
          values.push(`($${paramIndex + 1}, $${paramIndex})`);
          params.push(traitId, conflictId);
          paramIndex += 2;
        });

        await client.query(
          `INSERT INTO trait_conflicts (trait_id, conflicts_with_trait_id)
           VALUES ${values.join(', ')}
           ON CONFLICT (trait_id, conflicts_with_trait_id) DO NOTHING`,
          params
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if a trait conflicts with any traits in an NFT's current attributes
   */
  async checkConflictWithNFT(
    traitId: string,
    nftTraitIds: string[]
  ): Promise<{ hasConflict: boolean; conflictingTraitId?: string }> {
    if (nftTraitIds.length === 0) {
      return { hasConflict: false };
    }

    const result = await this.pool.query(
      `SELECT conflicts_with_trait_id
       FROM trait_conflicts
       WHERE trait_id = $1 AND conflicts_with_trait_id = ANY($2)
       LIMIT 1`,
      [traitId, nftTraitIds]
    );

    if (result.rows.length > 0) {
      return {
        hasConflict: true,
        conflictingTraitId: result.rows[0].conflicts_with_trait_id
      };
    }

    return { hasConflict: false };
  }
}
