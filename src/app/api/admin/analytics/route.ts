import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getTraitRepository, getAuditLogRepository } from '@/lib/repositories';
import { query } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'analyst') && !await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const statusFilter = searchParams.get('status'); // 'all', 'confirmed', 'fulfilled', 'failed'

    const traitRepo = getTraitRepository();
    const auditRepo = getAuditLogRepository();

    // Parse dates - default 90 days
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Build status filter
    let statusClause: string;
    if (statusFilter === 'failed') {
      statusClause = "p.status = 'failed'";
    } else if (statusFilter === 'confirmed') {
      statusClause = "p.status = 'confirmed'";
    } else if (statusFilter === 'fulfilled') {
      statusClause = "p.status = 'fulfilled'";
    } else if (statusFilter === 'all') {
      statusClause = "1=1";
    } else {
      // Default: successful purchases only
      statusClause = "p.status IN ('confirmed', 'fulfilled')";
    }

    // Revenue by token - use trait price as source of truth for display
    // purchases.price_amount is BIGINT (truncated), traits.price_amount is NUMERIC(20,9)
    const revenueResult = await query(`
      SELECT 
        COALESCE(pt.token_symbol, 'Unknown') as token_symbol,
        COALESCE(pt.decimals, 9) as decimals,
        p.token_id,
        COUNT(*) as total_count,
        SUM(tr.price_amount) as total_revenue_from_traits
      FROM purchases p
      LEFT JOIN project_tokens pt ON p.token_id = pt.id
      LEFT JOIN traits tr ON p.trait_id = tr.id
      WHERE ${statusClause}
        AND p.created_at >= $1
        AND p.created_at <= $2
      GROUP BY p.token_id, pt.token_symbol, pt.decimals
      ORDER BY total_count DESC
    `, [start, end]);

    let grandTotalPurchases = 0;
    const byToken = revenueResult.rows.map((row: any) => {
      const count = parseInt(row.total_count);
      grandTotalPurchases += count;
      return {
        tokenSymbol: row.token_symbol,
        revenue: row.total_revenue_from_traits ? parseFloat(row.total_revenue_from_traits).toString() : '0',
        count,
      };
    });

    // Trait statistics
    const allTraits = await traitRepo.findAll();
    const traitStats = {
      totalTraits: allTraits.length,
      activeTraits: allTraits.filter((t: any) => t.active).length,
      traitsWithLimitedSupply: allTraits.filter((t: any) => t.total_supply !== null).length,
      traitsOutOfStock: allTraits.filter((t: any) => t.remaining_supply === 0).length,
    };

    // Recent purchases with trait names and correct prices from traits table
    const recentResult = await query(`
      SELECT 
        p.id, p.wallet_address, p.trait_id, p.status,
        p.tx_signature, p.created_at, p.token_id,
        t.name as trait_name,
        t.price_amount as trait_price,
        COALESCE(pt.token_symbol, 'Unknown') as token_symbol
      FROM purchases p
      LEFT JOIN traits t ON p.trait_id = t.id
      LEFT JOIN project_tokens pt ON p.token_id = pt.id
      WHERE ${statusClause}
        AND p.created_at >= $1
        AND p.created_at <= $2
      ORDER BY p.created_at DESC
      LIMIT 50
    `, [start, end]);

    const recentPurchases = recentResult.rows.map((row: any) => ({
      id: row.id,
      wallet_address: row.wallet_address,
      trait_id: row.trait_id,
      trait_name: row.trait_name || 'Unknown',
      price_display: row.trait_price ? parseFloat(row.trait_price).toString() : '0',
      token_symbol: row.token_symbol,
      status: row.status,
      tx_signature: row.tx_signature,
      created_at: row.created_at,
    }));

    const purchasesByDay = recentPurchases.reduce((acc: Record<string, number>, p: any) => {
      const day = new Date(p.created_at).toISOString().split('T')[0];
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Audit statistics
    const auditStats = await auditRepo.getActionStats(start, end);

    // Top traits with names
    const topTraitsResult = await query(`
      SELECT 
        p.trait_id,
        t.name as trait_name,
        COALESCE(pt.token_symbol, 'Unknown') as token_symbol,
        t.price_amount as trait_price,
        COUNT(*) as purchase_count
      FROM purchases p
      LEFT JOIN traits t ON p.trait_id = t.id
      LEFT JOIN project_tokens pt ON p.token_id = pt.id
      WHERE ${statusClause}
        AND p.created_at >= $1
        AND p.created_at <= $2
      GROUP BY p.trait_id, t.name, pt.token_symbol, t.price_amount
      ORDER BY purchase_count DESC
      LIMIT 10
    `, [start, end]);

    const topTraits = topTraitsResult.rows.map((row: any) => ({
      traitId: row.trait_id,
      traitName: row.trait_name || 'Unknown',
      tokenSymbol: row.token_symbol,
      priceDisplay: row.trait_price ? parseFloat(row.trait_price).toString() : '0',
      purchaseCount: parseInt(row.purchase_count),
    }));

    // Status breakdown
    const statusBreakdown = await query(`
      SELECT status, COUNT(*) as count
      FROM purchases
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY status
      ORDER BY count DESC
    `, [start, end]);

    return NextResponse.json({
      revenue: {
        totalPurchases: grandTotalPurchases,
        byToken,
      },
      traits: traitStats,
      purchases: {
        byDay: purchasesByDay,
        recent: recentPurchases,
      },
      topTraits,
      auditActivity: auditStats,
      statusBreakdown: statusBreakdown.rows.map((r: any) => ({
        status: r.status,
        count: parseInt(r.count),
      })),
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
