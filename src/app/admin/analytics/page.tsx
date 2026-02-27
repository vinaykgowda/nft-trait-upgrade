'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ActualSale {
  traitName: string;
  totalSupply: number;
  remainingSupply: number;
  unitsSold: number;
  price: string;
  tokenSymbol: string;
  totalRevenue: string;
}

interface RecentPurchase {
  id: string;
  wallet_address: string;
  trait_name: string;
  price_display: string;
  token_symbol: string;
  status: string;
  tx_signature: string | null;
  created_at: string;
}

interface AnalyticsData {
  actualSales: ActualSale[];
  totalSalesCount: number;
  revenueByToken: Array<{ tokenSymbol: string; revenue: string; count: number }>;
  traits: { totalTraits: number; activeTraits: number; traitsWithLimitedSupply: number; traitsOutOfStock: number };
  purchases: { byDay: Record<string, number>; recent: RecentPurchase[] };
  statusBreakdown: Array<{ status: string; count: number }>;
  auditActivity: Array<{ action: string; count: number }>;
  dateRange: { start: string; end: string };
}

type StatusFilter = 'successful' | 'all' | 'confirmed' | 'fulfilled' | 'failed';

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const router = useRouter();

  useEffect(() => { fetchAnalytics(); }, [dateRange, statusFilter]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ startDate: dateRange.startDate, endDate: dateRange.endDate });
      if (statusFilter !== 'successful') params.set('status', statusFilter);
      const response = await fetch(`/api/admin/analytics?${params}`);
      if (!response.ok) {
        if (response.status === 401) { router.push('/admin/login'); return; }
        throw new Error('Failed to fetch analytics');
      }
      setAnalytics(await response.json());
      setError('');
    } catch { setError('Failed to load analytics'); }
    finally { setLoading(false); }
  };

  const formatDate = (s: string) => new Date(s).toLocaleDateString();
  const truncAddr = (a: string) => a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '—';
  const statusColor = (s: string) => {
    if (s === 'fulfilled') return 'bg-emerald-500/10 text-emerald-400';
    if (s === 'confirmed') return 'bg-blue-500/10 text-blue-400';
    if (s === 'failed') return 'bg-red-500/10 text-red-400';
    return 'bg-white/5 text-white/40';
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-violet-500 border-t-transparent" />
    </div>
  );

  if (error && !analytics) return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Analytics</h1>
        <p className="mt-1 text-sm text-white/40">Performance metrics and insights</p>
      </div>
      <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
    </>
  );

  if (!analytics) return (
    <>
      <div className="mb-8"><h1 className="text-2xl font-semibold text-white">Analytics</h1></div>
      <p className="text-white/30 text-center py-12">No analytics data available.</p>
    </>
  );

  const filterButtons: { label: string; value: StatusFilter }[] = [
    { label: 'Successful', value: 'successful' },
    { label: 'All', value: 'all' },
    { label: 'Confirmed', value: 'confirmed' },
    { label: 'Fulfilled', value: 'fulfilled' },
    { label: 'Failed', value: 'failed' },
  ];

  return (
    <>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Analytics</h1>
          <p className="mt-1 text-sm text-white/40">Performance metrics and insights</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50" />
          <span className="text-white/20">to</span>
          <input type="date" value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50" />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-xs text-white/30 mb-1">Total Sales</p>
          <p className="text-xl font-semibold text-emerald-400">{analytics.totalSalesCount}</p>
        </div>
        {analytics.revenueByToken.map((t, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <p className="text-xs text-white/30 mb-1">Revenue ({t.tokenSymbol})</p>
            <p className="text-xl font-semibold text-emerald-400">{t.revenue} {t.tokenSymbol}</p>
            <p className="text-xs text-white/20 mt-1">{t.count} sales</p>
          </div>
        ))}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-xs text-white/30 mb-1">Active Traits</p>
          <p className="text-xl font-semibold text-violet-400">{analytics.traits.activeTraits} / {analytics.traits.totalTraits}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-xs text-white/30 mb-1">Out of Stock</p>
          <p className="text-xl font-semibold text-red-400">{analytics.traits.traitsOutOfStock}</p>
        </div>
      </div>

      {/* Actual Sales (from supply data) */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden mb-6">
        <div className="p-5 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white">Sales by Trait (from supply data)</h3>
          <p className="text-xs text-white/30 mt-1">Source of truth — derived from inventory supply changes</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30 uppercase">Trait</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30 uppercase">Price</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30 uppercase">Sold</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30 uppercase">Supply</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30 uppercase">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {analytics.actualSales.map((sale) => (
                <tr key={sale.traitName} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-sm text-white/80 font-medium">{sale.traitName}</td>
                  <td className="px-5 py-3 text-sm text-white/60">{sale.price} {sale.tokenSymbol}</td>
                  <td className="px-5 py-3 text-sm text-emerald-400 font-medium">{sale.unitsSold}</td>
                  <td className="px-5 py-3 text-sm text-white/40">{sale.remainingSupply} / {sale.totalSupply}</td>
                  <td className="px-5 py-3 text-sm text-emerald-400">{sale.totalRevenue} {sale.tokenSymbol}</td>
                </tr>
              ))}
              {analytics.actualSales.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-white/20">No sales yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Daily Purchases */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Daily Purchase Attempts</h3>
          <div className="space-y-2">
            {Object.keys(analytics.purchases.byDay).length === 0 ? (
              <p className="text-sm text-white/20">No data for this period.</p>
            ) : Object.entries(analytics.purchases.byDay)
              .sort(([a], [b]) => b.localeCompare(a))
              .slice(0, 10)
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
            ) : analytics.auditActivity.map((a, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-sm text-white/60 capitalize">{a.action.replace(/_/g, ' ')}</span>
                <span className="text-sm text-white">{a.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Purchase Records Table */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="p-5 border-b border-white/[0.06] flex justify-between items-center">
          <div>
            <h3 className="text-sm font-semibold text-white">Purchase Records</h3>
            <p className="text-xs text-white/30 mt-1">Raw database records — some may have incorrect status</p>
          </div>
          <div className="flex gap-2">
            {filterButtons.map((btn) => (
              <button key={btn.value} onClick={() => setStatusFilter(btn.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === btn.value
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                    : 'bg-white/[0.04] text-white/40 border border-white/[0.06] hover:text-white/60'
                }`}>{btn.label}</button>
            ))}
          </div>
        </div>

        {/* Status Breakdown */}
        {analytics.statusBreakdown.length > 0 && (
          <div className="px-5 py-3 border-b border-white/[0.06] flex gap-4">
            {analytics.statusBreakdown.map((s) => (
              <div key={s.status} className="flex items-center gap-2">
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColor(s.status)}`}>{s.status}</span>
                <span className="text-sm text-white/50">{s.count}</span>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30 uppercase">Wallet</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30 uppercase">Trait</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30 uppercase">Price</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30 uppercase">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30 uppercase">Tx</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30 uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {analytics.purchases.recent.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-white/20">No purchases found.</td></tr>
              ) : analytics.purchases.recent.map((p) => (
                <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-sm text-white/60 font-mono">{truncAddr(p.wallet_address)}</td>
                  <td className="px-5 py-3 text-sm text-white/60">{p.trait_name}</td>
                  <td className="px-5 py-3 text-sm text-white/60">{p.price_display} {p.token_symbol}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColor(p.status)}`}>{p.status}</span>
                  </td>
                  <td className="px-5 py-3 text-sm font-mono">
                    {p.tx_signature ? (
                      <a href={`https://solscan.io/tx/${p.tx_signature}`} target="_blank" rel="noopener noreferrer"
                        className="text-violet-400 hover:text-violet-300">{p.tx_signature.slice(0, 8)}...</a>
                    ) : <span className="text-white/20">—</span>}
                  </td>
                  <td className="px-5 py-3 text-sm text-white/40">{formatDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
