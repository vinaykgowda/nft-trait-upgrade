'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminNavigation from '@/components/admin/AdminNavigation';

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
    } catch (err) {
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatSOL = (lamports: string) => {
    const value = BigInt(lamports);
    const sol = value / BigInt(1000000000);
    const remainder = value % BigInt(1000000000);
    
    if (remainder === 0n) {
      return `${sol} SOL`;
    }
    
    const decimal = remainder.toString().padStart(9, '0').replace(/0+$/, '');
    return `${sol}.${decimal} SOL`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-green-400">
        <AdminNavigation />
        <div className="p-6">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-green-400">
        <AdminNavigation />
        <div className="p-6">
          <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen bg-black text-green-400">
        <AdminNavigation />
        <div className="p-6">
          <div className="text-center py-12">
            <p className="text-gray-400">No analytics data available.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-green-400">
      <AdminNavigation />
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-green-400">Analytics</h1>
          <p className="mt-2 text-green-300">
            View performance metrics and system insights
          </p>
        </div>

      {/* Date Range Selector */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="flex items-center space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Revenue Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Revenue
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {formatSOL(analytics.revenue.total)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Purchases
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {analytics.revenue.totalPurchases}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Traits
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {analytics.traits.activeTraits} / {analytics.traits.totalTraits}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Out of Stock
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {analytics.traits.traitsOutOfStock}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue by Token */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Revenue by Token
            </h3>
            <div className="space-y-3">
              {analytics.revenue.byToken.map((token, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-900">
                    Token {token.tokenId}
                  </span>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {formatSOL(token.revenue)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {token.count} purchases
                    </div>
                  </div>
                </div>
              ))}
              {analytics.revenue.byToken.length === 0 && (
                <p className="text-sm text-gray-500">No revenue data available for this period.</p>
              )}
            </div>
          </div>
        </div>

        {/* Top Traits */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Top Performing Traits
            </h3>
            <div className="space-y-3">
              {analytics.topTraits.slice(0, 5).map((trait, index) => (
                <div key={trait.traitId} className="flex justify-between items-center">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-500 w-6">
                      #{index + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-900 ml-2">
                      Trait {trait.traitId.slice(0, 8)}...
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {trait.purchaseCount} purchases
                  </span>
                </div>
              ))}
              {analytics.topTraits.length === 0 && (
                <p className="text-sm text-gray-500">No purchase data available for this period.</p>
              )}
            </div>
          </div>
        </div>

        {/* Purchases by Day */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Daily Purchases
            </h3>
            <div className="space-y-2">
              {Object.entries(analytics.purchases.byDay)
                .sort(([a], [b]) => b.localeCompare(a))
                .slice(0, 7)
                .map(([date, count]) => (
                  <div key={date} className="flex justify-between items-center">
                    <span className="text-sm text-gray-900">
                      {formatDate(date)}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {count} purchases
                    </span>
                  </div>
                ))}
              {Object.keys(analytics.purchases.byDay).length === 0 && (
                <p className="text-sm text-gray-500">No purchase data available for this period.</p>
              )}
            </div>
          </div>
        </div>

        {/* Audit Activity */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Admin Activity
            </h3>
            <div className="space-y-3">
              {analytics.auditActivity.map((activity, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm text-gray-900 capitalize">
                    {activity.action.replace('_', ' ')}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {activity.count}
                  </span>
                </div>
              ))}
              {analytics.auditActivity.length === 0 && (
                <p className="text-sm text-gray-500">No admin activity for this period.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Purchases */}
      <div className="mt-8 bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Recent Purchases
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Wallet
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trait ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analytics.purchases.recent.map((purchase) => (
                  <tr key={purchase.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {purchase.wallet_address.slice(0, 8)}...{purchase.wallet_address.slice(-4)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {purchase.trait_id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(purchase.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {analytics.purchases.recent.length === 0 && (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500">No recent purchases.</p>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}