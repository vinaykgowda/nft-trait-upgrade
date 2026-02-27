'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AnalyticsData {
  revenue: {
    total: string;
    totalPurchases: number;
    byToken: Array<{
      tokenId: string;
      revenue: string;
      count: number;
    }>;
  };
  traits: {
    totalTraits: number;
    activeTraits: number;
    traitsWithLimitedSupply: number;
    traitsOutOfStock: number;
  };
  purchases: {
    byDay: Record<string, number>;
    recent: Array<{
      id: string;
      wallet_address: string;
      trait_id: string;
      created_at: string;
    }>;
  };
  topTraits: Array<{
    traitId: string;
    purchaseCount: number;
  }>;
  auditActivity: Array<{
    action: string;
    count: number;
  }>;
  dateRange: {
    start: string;
    end: string;
  };
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const router = useRouter();

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });

      const response = await fetch(`/api/admin/analytics?${params}`);
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login');
          return;
        }
        throw new Error('Failed to fetch analytics');
      }
      const data = await response.json();
      setAnalytics(data);
      setError('');
    } catch {
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatSOL = (lamports: string) => {
    const value = BigInt(lamports);
    const sol = value / BigInt(1000000000);
    const remainder = value % BigInt(1000000000);
    if (remainder === 0n) return `${sol} SOL`;
    const decimal = remainder.toString().padStart(9, '0').replace(/0+$/, '');
    return `${sol}.${decimal} SOL`;
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <>
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-white/40">Performance metrics and insights</p>
        </div>
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      </>
    );
  }

  if (!analytics) {
    return (
      <>
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white tracking-tight">Analytics</h1>
        </div>
        <p className="text-white/30 text-center py-12">No analytics data available.</p>
      </>
    );
  }

  return (
    <>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-white/40">Performance metrics and insights</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
          />
          <span className="text-white/20">to</span>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
          />
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
          {error} — showing cached data
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Revenue', value: formatSOL(analytics.revenue.total), color: 'text-emerald-400' },
          { label: 'Total Purchases', value: analytics.revenue.totalPurchases.toString(), color: 'text-blue-400' },
          { label: 'Active Traits', value: `${analytics.traits.activeTraits} / ${analytics.traits.totalTraits}`, color: 'text-violet-400' },
          { label: 'Out of Stock', value: analytics.traits.traitsOutOfStock.toString(), color: 'text-red-400' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <p className="text-xs text-white/30 mb-1">{stat.label}</p>
            <p className={`text-xl font-semibold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Revenue by Token */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Revenue by Token</h3>
          <div className="space-y-3">
            {analytics.revenue.byToken.length === 0 ? (
              <p className="text-sm text-white/20">No revenue data for this period.</p>
            ) : analytics.revenue.byToken.map((token, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-sm text-white/60">Token {token.tokenId}</span>
                <div className="text-right">
                  <span className="text-sm text-white">{formatSOL(token.revenue)}</span>
                  <span className="text-xs text-white/30 ml-2">{token.count} purchases</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Traits */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Top Traits</h3>
          <div className="space-y-3">
            {analytics.topTraits.length === 0 ? (
              <p className="text-sm text-white/20">No purchase data for this period.</p>
            ) : analytics.topTraits.slice(0, 5).map((trait, i) => (
              <div key={trait.traitId} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/20 w-5">#{i + 1}</span>
                  <span className="text-sm text-white/60 font-mono">{trait.traitId.slice(0, 8)}...</span>
                </div>
                <span className="text-sm text-white/40">{trait.purchaseCount} purchases</span>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Purchases */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Daily Purchases</h3>
          <div className="space-y-2">
            {Object.keys(analytics.purchases.byDay).length === 0 ? (
              <p className="text-sm text-white/20">No purchase data for this period.</p>
            ) : Object.entries(analytics.purchases.byDay)
              .sort(([a], [b]) => b.localeCompare(a))
              .slice(0, 7)
              .map(([date, count]) => (
                <div key={date} className="flex justify-between items-center">
                  <span className="text-sm text-white/60">{formatDate(date)}</span>
                  <span className="text-sm text-white">{count}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Admin Activity */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Admin Activity</h3>
          <div className="space-y-3">
            {analytics.auditActivity.length === 0 ? (
              <p className="text-sm text-white/20">No admin activity for this period.</p>
            ) : analytics.auditActivity.map((activity, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-sm text-white/60 capitalize">{activity.action.replace('_', ' ')}</span>
                <span className="text-sm text-white">{activity.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Purchases Table */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="p-5 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white">Recent Purchases</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30 uppercase tracking-wider">Wallet</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30 uppercase tracking-wider">Trait ID</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody>
              {analytics.purchases.recent.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-sm text-white/20">No recent purchases.</td>
                </tr>
              ) : analytics.purchases.recent.map((purchase) => (
                <tr key={purchase.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-sm text-white/60 font-mono">
                    {purchase.wallet_address.slice(0, 8)}...{purchase.wallet_address.slice(-4)}
                  </td>
                  <td className="px-5 py-3 text-sm text-white/60 font-mono">
                    {purchase.trait_id.slice(0, 8)}...
                  </td>
                  <td className="px-5 py-3 text-sm text-white/40">
                    {formatDate(purchase.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
