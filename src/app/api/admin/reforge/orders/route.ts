import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { query } from '@/lib/database';
import { ReforgeOrderStatus } from '@/types/reforge';

/**
 * GET /api/admin/reforge/orders
 * List all reforge orders with optional filters:
 *   - collectionId: filter by pack's collection
 *   - status: filter by order status (bought, started_reforge, failed, completed)
 *   - walletAddress: filter by wallet
 *   - packId: filter by pack
 *   - limit: max results (default 50)
 *   - offset: pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const collectionId = searchParams.get('collectionId');
    const status = searchParams.get('status') as ReforgeOrderStatus | null;
    const walletAddress = searchParams.get('walletAddress');
    const packId = searchParams.get('packId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Validate status if provided
    const validStatuses: ReforgeOrderStatus[] = ['bought', 'started_reforge', 'failed', 'completed'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`, retryable: false },
        { status: 400 }
      );
    }

    // Build dynamic query with filters
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (collectionId) {
      conditions.push(`p.collection_id = $${paramIndex}`);
      params.push(collectionId);
      paramIndex++;
    }

    if (status) {
      conditions.push(`o.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (walletAddress) {
      conditions.push(`o.wallet_address = $${paramIndex}`);
      params.push(walletAddress);
      paramIndex++;
    }

    if (packId) {
      conditions.push(`o.pack_id = $${paramIndex}`);
      params.push(packId);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM reforge_orders o
      LEFT JOIN reforge_packs p ON o.pack_id = p.id
      ${whereClause}
    `;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // Get orders with pack info
    const ordersQuery = `
      SELECT 
        o.id,
        o.pack_id,
        o.wallet_address,
        o.discord_id,
        o.asset_id,
        o.status,
        o.used,
        o.purchase_tx_signature,
        o.failure_reason,
        o.created_at,
        o.updated_at,
        p.tier_name,
        p.collection_id,
        p.sol_price
      FROM reforge_orders o
      LEFT JOIN reforge_packs p ON o.pack_id = p.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const ordersResult = await query(ordersQuery, params);

    const orders = ordersResult.rows.map((row: any) => ({
      id: row.id,
      packId: row.pack_id,
      walletAddress: row.wallet_address,
      discordId: row.discord_id,
      assetId: row.asset_id,
      status: row.status,
      used: row.used,
      purchaseTxSignature: row.purchase_tx_signature,
      failureReason: row.failure_reason,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      tierName: row.tier_name || null,
      collectionId: row.collection_id || null,
      solPrice: row.sol_price ? parseFloat(row.sol_price) : null,
    }));

    return NextResponse.json({
      orders,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Admin GET reforge orders error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
