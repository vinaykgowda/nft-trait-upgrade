'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminNavigation from '@/components/admin/AdminNavigation';

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
  const router = useRouter();

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

  if (!data) return null;

  return (
    <div className="min-h-screen bg-black text-green-400">
      <AdminNavigation />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-green-400">🏥 System Health Dashboard</h1>
          <div className="flex items-center space-x-4">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400 text-sm"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
            <button
              onClick={fetchHealthData}
              className="bg-green-600 text-black px-4 py-2 rounded-md hover:bg-green-500 font-bold transition-colors text-sm"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded">
            ⚠️ {error}
          </div>
        )}

        {/* System Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">System Status</p>
                <p className={`text-lg font-semibold ${getStatusColor(data.systemHealth.status)}`}>
                  {getStatusIcon(data.systemHealth.status)} {data.systemHealth.status.toUpperCase()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Database</p>
                <p className={`text-lg font-semibold ${getStatusColor(data.database.status)}`}>
                  {getStatusIcon(data.database.status)} {data.database.status.toUpperCase()}
                </p>
                <p className="text-xs text-gray-500">{data.database.responseTime}ms</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">API Status</p>
                <p className={`text-lg font-semibold ${getStatusColor(data.api.status)}`}>
                  {getStatusIcon(data.api.status)} {data.api.status.toUpperCase()}
                </p>
                <p className="text-xs text-gray-500">{data.api.responseTime}ms</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Storage</p>
                <p className="text-lg font-semibold text-green-400">
                  {data.storage.used}GB / {data.storage.total}GB
                </p>
                <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${data.storage.percentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-green-400 mb-4">📊 Performance Metrics</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Uptime</span>
                <span className="text-green-400 font-semibold">{data.systemHealth.uptime}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Database Response</span>
                <span className="text-green-400 font-semibold">{data.database.responseTime}ms</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">API Response</span>
                <span className="text-green-400 font-semibold">{data.api.responseTime}ms</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Storage Usage</span>
                <span className="text-green-400 font-semibold">{data.storage.percentage}%</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-green-400 mb-4">🔧 System Actions</h2>
            <div className="space-y-3">
              <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-500 font-medium transition-colors">
                🔄 Restart Services
              </button>
              <button className="w-full bg-yellow-600 text-black px-4 py-2 rounded-md hover:bg-yellow-500 font-medium transition-colors">
                🧹 Clear Cache
              </button>
              <button className="w-full bg-green-600 text-black px-4 py-2 rounded-md hover:bg-green-500 font-medium transition-colors">
                📊 Generate Report
              </button>
              <button className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-500 font-medium transition-colors">
                🚨 Emergency Stop
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 text-xs text-gray-500 text-center">
          Last updated: {new Date(data.systemHealth.lastUpdated).toLocaleString()}
        </div>
      </div>
    </div>
  );
}