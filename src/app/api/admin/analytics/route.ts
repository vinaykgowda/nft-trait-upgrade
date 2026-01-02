import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getPurchaseRepository, getTraitRepository, getAuditLogRepository } from '@/lib/repositories';

export async function GET(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'analyst')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const purchaseRepo = getPurchaseRepository();
    const traitRepo = getTraitRepository();
    const auditRepo = getAuditLogRepository();

    // Parse dates
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = endDate ? new Date(endDate) : new Date();

    // Get revenue statistics
    const revenueStats = await purchaseRepo.getRevenueStats(start, end);

    // Get trait statistics
    const allTraits = await traitRepo.findAll();
    const traitStats = {
      totalTraits: allTraits.length,
      activeTraits: allTraits.filter((t: any) => t.active).length,
      traitsWithLimitedSupply: allTraits.filter((t: any) => t.total_supply !== null).length,
      traitsOutOfStock: allTraits.filter((t: any) => t.remaining_supply === 0).length,
    };

    // Get recent purchases
    const recentPurchases = await purchaseRepo.findByStatus('fulfilled');
    const purchasesByDay = recentPurchases.reduce((acc: Record<string, number>, purchase: any) => {
      const day = purchase.created_at.toISOString().split('T')[0];
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get audit statistics
    const auditStats = await auditRepo.getActionStats(start, end);

    // Get top performing traits (most purchased)
    const traitPurchaseCounts = recentPurchases.reduce((acc: Record<string, number>, purchase: any) => {
      acc[purchase.trait_id] = (acc[purchase.trait_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topTraits = Object.entries(traitPurchaseCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([traitId, count]) => ({ traitId, purchaseCount: count }));

    return NextResponse.json({
      revenue: {
        total: revenueStats.totalRevenue,
        totalPurchases: revenueStats.totalPurchases,
        byToken: revenueStats.revenueByToken,
      },
      traits: traitStats,
      purchases: {
        byDay: purchasesByDay,
        recent: recentPurchases.slice(0, 20), // Last 20 purchases
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