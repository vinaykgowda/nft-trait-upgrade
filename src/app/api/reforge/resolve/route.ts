import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

/**
 * GET /api/reforge/resolve?slug=pepe_goddess
 * Resolves a collection slug (derived from project name) to a collection ID.
 * The slug is the project name lowercased with spaces replaced by underscores.
 *
 * Returns: { collectionId, projectName }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: 'slug query parameter is required', retryable: false },
        { status: 400 }
      );
    }

    // Convert slug back to a pattern for matching:
    // "pepe_goddess" -> match project name "Pepe Goddess" (case-insensitive, underscores = spaces)
    const namePattern = slug.replace(/_/g, ' ');

    const result = await query(
      `SELECT id, name, collection_ids FROM projects WHERE LOWER(REPLACE(name, ' ', '_')) = LOWER($1) LIMIT 1`,
      [slug]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `No collection found for slug "${slug}"`, retryable: false },
        { status: 404 }
      );
    }

    const project = result.rows[0];
    const collectionIds: string[] = project.collection_ids || [];

    if (collectionIds.length === 0) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Project has no collection IDs configured', retryable: false },
        { status: 404 }
      );
    }

    return NextResponse.json({
      collectionId: collectionIds[0],
      projectName: project.name,
      projectId: project.id,
    });
  } catch (error) {
    console.error('GET /api/reforge/resolve error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', retryable: true },
      { status: 500 }
    );
  }
}
