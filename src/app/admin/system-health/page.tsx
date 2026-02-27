'use client';

import { useState, useEffect } from 'react';

interface SystemHealthData {
  systemHealth: {
    status: 'healthy' | 'warning' | 'critical';
    uptime: number;
    lastUpdated: string;
  };
  database: {
    status: 'connected' | 'disconnected';
    responseTime: number;
  };
  api: {
    status: 'operational' | 'degraded' | 'down';
    responseTime: number;
  };
  storage: {
    used: number;
    total: number;
    percentage: number;
  };
}

export default function SystemHealthPage() {
  const [data, setData] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => {
    fetchHealthData();
    const interval = setInterval(fetchHealthData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchHealthData = async () => {
    try {
      // Mock data for now
      const mockData: SystemHealthData = {
        systemHealth: {
          status: 'healthy',
          uptime: 99.9,
          lastUpdated: new Date().toISOString(),
        },
        database: {
          status: 'connected',
          responseTime: 45,
        },
        api: {
          status: 'operational',
          responseTime: 120,
        },
        storage: {
          used: 2.4,
          total: 10,
          percentage: 24,
        },
      };
      
      setData(mockData);
    } catch (err) {
      setError('Failed to fetch system health data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
      case 'operational':
        return 'text-green-400';
      case 'warning':
      case 'degraded':
        return 'text-yellow-400';
      case 'critical':
      case 'disconnected':
      case 'down':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
      case 'operational':
        return '✅';
      case 'warning':
      case 'degraded':
        return '⚠️';
      case 'critical':
      case 'disconnected':
      case 'down':
        return '❌';
      default:
        return '❓';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">System Health</h1>
          <p className="mt-1 text-sm text-white/40">Monitor system status and performance</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button
            onClick={fetchHealthData}
            className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/60 text-sm hover:bg-white/[0.08] transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-xs text-white/30 mb-1">System Status</p>
          <p className={`text-lg font-semibold ${getStatusColor(data.systemHealth.status)}`}>
            {getStatusIcon(data.systemHealth.status)} {data.systemHealth.status.toUpperCase()}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-xs text-white/30 mb-1">Database</p>
          <p className={`text-lg font-semibold ${getStatusColor(data.database.status)}`}>
            {getStatusIcon(data.database.status)} {data.database.status.toUpperCase()}
          </p>
          <p className="text-xs text-white/20 mt-1">{data.database.responseTime}ms</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-xs text-white/30 mb-1">API Status</p>
          <p className={`text-lg font-semibold ${getStatusColor(data.api.status)}`}>
            {getStatusIcon(data.api.status)} {data.api.status.toUpperCase()}
          </p>
          <p className="text-xs text-white/20 mt-1">{data.api.responseTime}ms</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-xs text-white/30 mb-1">Storage</p>
          <p className="text-lg font-semibold text-white">{data.storage.used}GB / {data.storage.total}GB</p>
          <div className="w-full bg-white/[0.06] rounded-full h-1.5 mt-2">
            <div className="bg-violet-500 h-1.5 rounded-full" style={{ width: `${data.storage.percentage}%` }} />
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Performance Metrics</h2>
          <div className="space-y-3">
            {[
              { label: 'Uptime', value: `${data.systemHealth.uptime}%` },
              { label: 'Database Response', value: `${data.database.responseTime}ms` },
              { label: 'API Response', value: `${data.api.responseTime}ms` },
              { label: 'Storage Usage', value: `${data.storage.percentage}%` },
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="text-sm text-white/40">{item.label}</span>
                <span className="text-sm text-white font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-white mb-4">System Actions</h2>
          <div className="space-y-2">
            <button className="w-full px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm hover:bg-blue-500/20 transition-colors">Restart Services</button>
            <button className="w-full px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm hover:bg-amber-500/20 transition-colors">Clear Cache</button>
            <button className="w-full px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm hover:bg-emerald-500/20 transition-colors">Generate Report</button>
            <button className="w-full px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm hover:bg-red-500/20 transition-colors">Emergency Stop</button>
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-white/20 text-center">
        Last updated: {new Date(data.systemHealth.lastUpdated).toLocaleString()}
      </p>
    </>
  );
}