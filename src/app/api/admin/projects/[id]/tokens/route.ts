import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { requireAdminAuth } from '@/lib/auth';
import { HeliusService } from '@/lib/services/helius';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;

    const result = await query(`
      SELECT 
        pt.id,
        pt.project_id,
        pt.token_address,
        pt.token_name,
        pt.token_symbol,
        pt.decimals,
        pt.enabled,
        pt.created_at,
        pt.updated_at
      FROM project_tokens pt
      WHERE pt.project_id = $1
      ORDER BY pt.created_at ASC
    `, [projectId]);

    return NextResponse.json({
      success: true,
      tokens: result.rows
    });

  } catch (error) {
    console.error('Failed to fetch project tokens:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project tokens' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;
    const { tokenAddress, enabled = true } = await request.json();

    if (!tokenAddress) {
      return NextResponse.json({ error: 'Token address is required' }, { status: 400 });
    }

    // Validate token address
    if (!HeliusService.isValidTokenAddress(tokenAddress)) {
      return NextResponse.json({ error: 'Invalid token address format' }, { status: 400 });
    }

    // Check if token already exists for this project
    const existingToken = await query(`
      SELECT id FROM project_tokens 
      WHERE project_id = $1 AND token_address = $2
    `, [projectId, tokenAddress]);

    if (existingToken.rows.length > 0) {
      return NextResponse.json({ error: 'Token already exists for this project' }, { status: 409 });
    }

    // Fetch token information
    const tokenInfo = await HeliusService.getTokenInfo(tokenAddress);
    
    if (!tokenInfo) {
      return NextResponse.json({ error: 'Could not fetch token information' }, { status: 400 });
    }

    // Insert new project token
    const result = await query(`
      INSERT INTO project_tokens (
        project_id, token_address, token_name, token_symbol, decimals, enabled
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      projectId,
      tokenInfo.address,
      tokenInfo.name,
      tokenInfo.symbol,
      tokenInfo.decimals,
      enabled
    ]);

    return NextResponse.json({
      success: true,
      token: result.rows[0]
    });

  } catch (error) {
    console.error('Failed to add project token:', error);
    return NextResponse.json(
      { error: 'Failed to add project token' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;
    const { tokenId, enabled } = await request.json();

    if (!tokenId) {
      return NextResponse.json({ error: 'Token ID is required' }, { status: 400 });
    }

    // Update token
    const result = await query(`
      UPDATE project_tokens 
      SET enabled = $1, updated_at = NOW()
      WHERE id = $2 AND project_id = $3
      RETURNING *
    `, [enabled, tokenId, projectId]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      token: result.rows[0]
    });

  } catch (error) {
    console.error('Failed to update project token:', error);
    return NextResponse.json(
      { error: 'Failed to update project token' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;
    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get('tokenId');

    if (!tokenId) {
      return NextResponse.json({ error: 'Token ID is required' }, { status: 400 });
    }

    // Delete token
    const result = await query(`
      DELETE FROM project_tokens 
      WHERE id = $1 AND project_id = $2
      RETURNING *
    `, [tokenId, projectId]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Token removed successfully'
    });

  } catch (error) {
    console.error('Failed to delete project token:', error);
    return NextResponse.json(
      { error: 'Failed to delete project token' },
      { status: 500 }
    );
  }
}