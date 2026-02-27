'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => setLoading(false), 500);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-white/40">System-wide configuration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-white mb-4">General</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">System Name</label>
              <input
                type="text"
                defaultValue="NFT Trait Marketplace"
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Maintenance Mode</label>
              <select className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors">
                <option value="false">Disabled</option>
                <option value="true">Enabled</option>
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Payment</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Default Token</label>
              <select className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors">
                <option value="SOL">SOL</option>
                <option value="USDC">USDC</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Transaction Fee (%)</label>
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                defaultValue="2.5"
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button className="px-5 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-violet-500/20">
          Save Settings
        </button>
      </div>
    </>
  );
}