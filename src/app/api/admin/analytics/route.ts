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

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // === ACTUAL SALES from supply data (source of truth) ===
    const salesResult = await query(`
      SELECT 
        t.id, t.name, t.total_supply, t.remaining_supply,
        (t.total_supply - t.remaining_supply) as units_sold,
        t.price_amount,
        COALESCE(pt.token_symbol, 'Unknown') as token_symbol
      FROM traits t
      LEFT JOIN project_tokens pt ON t.price_token_id = pt.id
      WHERE t.total_supply IS NOT NULL AND t.remaining_supply IS NOT NULL
        AND t.total_supply > t.remaining_supply
      ORDER BY (t.total_supply - t.remaining_supply) DESC
    `);

    const actualSales = salesResult.rows.map((r: any) => ({
      traitName: r.name,
      totalSupply: parseInt(r.total_supply),
      remainingSupply: parseInt(r.remaining_supply),
      unitsSold: parseInt(r.units_sold),
      price: parseFloat(r.price_amount).toString(),
      tokenSymbol: r.token_symbol,
      totalRevenue: (parseFloat(r.price_amount) * parseInt(r.units_sold)).toString(),
    }));

    const totalSalesCount = actualSales.reduce((sum: number, s: any) => sum + s.unitsSold, 0);

    // Revenue by token from actual sales
    const revenueByToken: Record<string, { revenue: number; count: number }> = {};
    for (const sale of actualSales) {
      if (!revenueByToken[sale.tokenSymbol]) {
        revenueByToken[sale.tokenSymbol] = { revenue: 0, count: 0 };
      }
      revenueByToken[sale.tokenSymbol].revenue += parseFloat(sale.totalRevenue);
      revenueByToken[sale.tokenSymbol].count += sale.unitsSold;
    }

    const byToken = Object.entries(revenueByToken).map(([symbol, data]) => ({
      tokenSymbol: symbol,
      revenue: data.revenue.toString(),
      count: data.count,
    }));

    // === TRAIT STATS ===
    const allTraits = await traitRepo.findAll();
    const traitStats = {
      totalTraits: allTraits.length,
      activeTraits: allTraits.filter((t: any) => t.active).length,
      traitsWithLimitedSupply: allTraits.filter((t: any) => t.total_supply !== null).length,
      traitsOutOfStock: allTraits.filter((t: any) => t.remaining_supply === 0).length,
    };

    // === PURCHASE RECORDS (for the table view with filters) ===
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
      statusClause = "p.status IN ('confirmed', 'fulfilled')";
    }

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
      LIMIT 100
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

    // === STATUS BREAKDOWN ===
    const statusBreakdown = await query(`
      SELECT status, COUNT(*) as count
      FROM purchases
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY status ORDER BY count DESC
    `, [start, end]);

    // === AUDIT STATS ===
    const auditStats = await auditRepo.getActionStats(start, end);

    return NextResponse.json({
      // Actual sales from supply (source of truth)
      actualSales,
      totalSalesCount,
      revenueByToken: byToken,
      // Trait stats
      traits: traitStats,
      // Purchase records (may have bad data)
      purchases: {
        byDay: purchasesByDay,
        recent: recentPurchases,
      },
      statusBreakdown: statusBreakdown.rows.map((r: any) => ({
        status: r.status, count: parseInt(r.count),
      })),
      auditActivity: auditStats,
      dateRange: { start: start.toISOString(), end: end.toISOString() },
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
