import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getPurchaseRepository, getTraitRepository, getAuditLogRepository } from '@/lib/repositories';
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

    const purchaseRepo = getPurchaseRepository();
    const traitRepo = getTraitRepository();
    const auditRepo = getAuditLogRepository();

    // Parse dates
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Get revenue stats with project_tokens join for proper token info
    const revenueResult = await query(`
      SELECT 
        COALESCE(pt.token_symbol, 'Unknown') as token_symbol,
        COALESCE(pt.decimals, 9) as decimals,
        p.token_id,
        SUM(p.price_amount::bigint) as total_revenue,
        COUNT(*) as total_count
      FROM purchases p
      LEFT JOIN project_tokens pt ON p.token_id = pt.id
      WHERE p.status IN ('confirmed', 'fulfilled')
        AND p.created_at >= $1
        AND p.created_at <= $2
      GROUP BY p.token_id, pt.token_symbol, pt.decimals
      ORDER BY total_revenue DESC
    `, [start, end]);

    let grandTotalPurchases = 0;
    const byToken = revenueResult.rows.map((row: any) => {
      const count = parseInt(row.total_count);
      grandTotalPurchases += count;
      return {
        tokenId: row.token_id,
        tokenSymbol: row.token_symbol,
        decimals: parseInt(row.decimals),
        revenue: row.total_revenue || '0',
        count,
      };
    });

    // Get trait statistics
    const allTraits = await traitRepo.findAll();
    const traitStats = {
      totalTraits: allTraits.length,
      activeTraits: allTraits.filter((t: any) => t.active).length,
      traitsWithLimitedSupply: allTraits.filter((t: any) => t.total_supply !== null).length,
      traitsOutOfStock: allTraits.filter((t: any) => t.remaining_supply === 0).length,
    };

    // Get recent purchases with trait names and token info
    const recentResult = await query(`
      SELECT 
        p.id, p.wallet_address, p.trait_id, p.price_amount, p.status,
        p.tx_signature, p.created_at, p.token_id,
        t.name as trait_name,
        COALESCE(pt.token_symbol, 'Unknown') as token_symbol,
        COALESCE(pt.decimals, 9) as decimals
      FROM purchases p
      LEFT JOIN traits t ON p.trait_id = t.id
      LEFT JOIN project_tokens pt ON p.token_id = pt.id
      WHERE p.status IN ('confirmed', 'fulfilled')
        AND p.created_at >= $1
        AND p.created_at <= $2
      ORDER BY p.created_at DESC
      LIMIT 50
    `, [start, end]);

    const recentPurchases = recentResult.rows;

    const purchasesByDay = recentPurchases.reduce((acc: Record<string, number>, purchase: any) => {
      const day = purchase.created_at.toISOString().split('T')[0];
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get audit statistics
    const auditStats = await auditRepo.getActionStats(start, end);

    // Get top performing traits with names
    const topTraitsResult = await query(`
      SELECT 
        p.trait_id,
        t.name as trait_name,
        COUNT(*) as purchase_count
      FROM purchases p
      LEFT JOIN traits t ON p.trait_id = t.id
      WHERE p.status IN ('confirmed', 'fulfilled')
        AND p.created_at >= $1
        AND p.created_at <= $2
      GROUP BY p.trait_id, t.name
      ORDER BY purchase_count DESC
      LIMIT 10
    `, [start, end]);

    const topTraits = topTraitsResult.rows.map((row: any) => ({
      traitId: row.trait_id,
      traitName: row.trait_name || 'Unknown',
      purchaseCount: parseInt(row.purchase_count),
    }));

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
