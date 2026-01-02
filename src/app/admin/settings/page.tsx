'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminNavigation from '@/components/admin/AdminNavigation';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Mock loading
    setTimeout(() => setLoading(false), 1000);
  }, []);

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

  return (
    <div className="min-h-screen bg-black text-green-400">
      <AdminNavigation />
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-green-400">⚙️ System Settings</h1>
          <p className="mt-2 text-gray-400">
            Configure system-wide settings and operational parameters
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded">
            ⚠️ {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-green-400 mb-4">🔧 General Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-green-400 mb-1">
                  System Name
                </label>
                <input
                  type="text"
                  defaultValue="NFT Trait Marketplace"
                  className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400 focus:outline-none focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-green-400 mb-1">
                  Maintenance Mode
                </label>
                <select className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400 focus:outline-none focus:ring-green-500 focus:border-green-500">
                  <option value="false">Disabled</option>
                  <option value="true">Enabled</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-green-400 mb-4">💰 Payment Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-green-400 mb-1">
                  Default Token
                </label>
                <select className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400 focus:outline-none focus:ring-green-500 focus:border-green-500">
                  <option value="SOL">SOL</option>
                  <option value="USDC">USDC</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-green-400 mb-1">
                  Transaction Fee (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  defaultValue="2.5"
                  className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400 focus:outline-none focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button className="bg-green-600 text-black px-6 py-2 rounded-md hover:bg-green-500 font-bold transition-colors">
            💾 Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}