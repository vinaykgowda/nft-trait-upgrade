'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ReforgeOrderWithPack, ReforgeOrderStatus, PackTier } from '@/types/reforge';
import { NFTSelector } from './NFTSelector';

const tierColors: Record<string, { accent: string; bg: string; border: string; gradient: string }> = {
  silver: {
    accent: '#C0C0C0',
    bg: 'rgba(192, 192, 192, 0.08)',
    border: 'rgba(192, 192, 192, 0.25)',
    gradient: 'linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 50%, #D4D4D4 100%)',
  },
  gold: {
    accent: '#FFD700',
    bg: 'rgba(255, 215, 0, 0.08)',
    border: 'rgba(255, 215, 0, 0.25)',
    gradient: 'linear-gradient(135deg, #FFD700 0%, #DAA520 50%, #F5D060 100%)',
  },
  diamond: {
    accent: '#00BFFF',
    bg: 'rgba(0, 191, 255, 0.08)',
    border: 'rgba(0, 191, 255, 0.25)',
    gradient: 'linear-gradient(135deg, #00BFFF 0%, #1E90FF 50%, #87CEEB 100%)',
  },
};

const statusConfig: Record<ReforgeOrderStatus, { label: string; color: string; bg: string }> = {
  bought: { label: 'Purchased', color: '#EAB308', bg: 'rgba(234, 179, 8, 0.15)' },
  started_reforge: { label: 'In Progress', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' },
  completed: { label: 'Completed', color: '#22C55E', bg: 'rgba(34, 197, 94, 0.15)' },
  failed: { label: 'Failed', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function OrderHistory() {
  const { publicKey, connected } = useWallet();
  const [orders, setOrders] = useState<ReforgeOrderWithPack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/reforge/orders?walletAddress=${publicKey.toBase58()}`);
      if (!res.ok) {
        throw new Error('Failed to fetch orders');
      }
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err) {
      console.error('Error fetching reforge orders:', err);
      setError('Failed to load reforge orders.');
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (connected && publicKey) {
      fetchOrders();
    }
  }, [connected, publicKey, fetchOrders]);

  const handleReforgeStarted = () => {
    setSelectedOrderId(null);
    fetchOrders();
  };

  if (!connected || !publicKey) {
    return (
      <div className="text-center py-8">
        <p className="text-white/30 text-sm">Connect your wallet to view reforge orders.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-violet-500 border-t-transparent mx-auto mb-2" />
        <p className="text-white/40 text-sm">Loading reforge orders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400 text-sm mb-3">{error}</p>
        <button
          onClick={fetchOrders}
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition"
        >
          Retry
        </button>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-white/30 text-sm">No reforge orders yet.</p>
        <a
          href="/reforge"
          className="inline-block mt-3 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition"
        >
          Browse Packs
        </a>
      </div>
    );
  }

  // If an order is selected for reforge, show the NFT selector
  if (selectedOrderId) {
    const order = orders.find((o) => o.id === selectedOrderId);
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedOrderId(null)}
          className="flex items-center gap-2 text-white/60 hover:text-white transition text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Orders
        </button>
        <div className="bg-white/[0.04] rounded-xl p-5 border border-white/[0.06]">
          <NFTSelector
            orderId={selectedOrderId}
            tierName={(order?.tierName as PackTier) || 'silver'}
            onReforgeStarted={handleReforgeStarted}
            onCancel={() => setSelectedOrderId(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const tier = tierColors[order.tierName || 'silver'] || tierColors.silver;
        const status = statusConfig[order.status];
        const canStartReforge = order.status === 'bought' && !order.used;

        return (
          <div
            key={order.id}
            className="bg-white/[0.04] rounded-xl p-4 border border-white/[0.06] flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* Tier badge */}
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: tier.bg, border: `1px solid ${tier.border}` }}
              >
                <span
                  className="text-xs font-bold uppercase"
                  style={{ color: tier.accent }}
                >
                  {(order.tierName || 'N/A').slice(0, 1).toUpperCase()}
                </span>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-semibold capitalize"
                    style={{ color: tier.accent }}
                  >
                    {order.tierName || 'Unknown'} Pack
                  </span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ color: status.color, background: status.bg }}
                  >
                    {status.label}
                  </span>
                </div>
                <p className="text-white/40 text-xs mt-0.5">
                  {formatDate(order.createdAt)}
                  {order.assetId && (
                    <span className="ml-2 text-white/25">
                      NFT: {order.assetId.slice(0, 6)}...{order.assetId.slice(-4)}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Action / Status */}
            <div className="shrink-0">
              {canStartReforge ? (
                <button
                  onClick={() => setSelectedOrderId(order.id)}
                  className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 hover:opacity-90"
                  style={{
                    background: tier.gradient,
                    color: '#0a0a0f',
                    boxShadow: `0 0 12px ${tier.bg}`,
                  }}
                >
                  Start Reforge
                </button>
              ) : order.status === 'failed' && order.failureReason ? (
                <span className="text-xs text-red-400/70 max-w-[140px] truncate block" title={order.failureReason}>
                  {order.failureReason}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
