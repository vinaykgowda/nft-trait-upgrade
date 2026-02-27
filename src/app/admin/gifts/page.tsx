'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface GiftBalance {
  id: string;
  walletAddress: string;
  traitId: string;
  traitName: string;
  qtyAvailable: number;
  createdAt: string;
}

interface Trait {
  id: string;
  name: string;
  slotName: string;
  rarityTierName: string;
  active: boolean;
}

export default function GiftsPage() {
  const [gifts, setGifts] = useState<GiftBalance[]>([]);
  const [traits, setTraits] = useState<Trait[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showGiftForm, setShowGiftForm] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const router = useRouter();

  const [formData, setFormData] = useState({ walletAddress: '', traitId: '', quantity: 1 });
  const [filters, setFilters] = useState({ walletAddress: '', traitId: '' });

  useEffect(() => { fetchGifts(); fetchTraits(); }, []);
  useEffect(() => { fetchGifts(); }, [filters]);

  const fetchGifts = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => { if (value) params.append(key, value); });
      const response = await fetch(`/api/admin/gifts?${params}`);
      if (!response.ok) {
        if (response.status === 401) { router.push('/admin/login'); return; }
        throw new Error('Failed to fetch gifts');
      }
      const data = await response.json();
      setGifts(data.gifts || []);
    } catch { setError('Failed to load gifts'); }
    finally { setLoading(false); }
  };

  const fetchTraits = async () => {
    try {
      const response = await fetch('/api/admin/traits?active=true');
      if (response.ok) { const data = await response.json(); setTraits(data.traits || []); }
    } catch {}
  };

  const handleGiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!mfaRequired) { setMfaRequired(true); return; }
    try {
      const response = await fetch('/api/admin/gifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, mfaToken }),
      });
      if (!response.ok) { const d = await response.json(); throw new Error(d.error || 'Failed to create gift'); }
      await fetchGifts();
      resetGiftForm();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to create gift'); }
  };

  const handleRevokeGift = async (giftId: string) => {
    if (!confirm('Revoke this gift? This cannot be undone.')) return;
    try {
      const response = await fetch(`/api/admin/gifts/${giftId}`, { method: 'DELETE' });
      if (!response.ok) { const d = await response.json(); throw new Error(d.error || 'Failed to revoke'); }
      await fetchGifts();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to revoke gift'); }
  };

  const resetGiftForm = () => {
    setFormData({ walletAddress: '', traitId: '', quantity: 1 });
    setMfaToken('');
    setMfaRequired(false);
    setShowGiftForm(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Gifts</h1>
          <p className="mt-1 text-sm text-white/40">Manage trait gifts and community rewards</p>
        </div>
        <button
          onClick={() => setShowGiftForm(true)}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-violet-500/20"
        >
          + Create Gift
        </button>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      {/* Filters */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Wallet Address</label>
            <input
              type="text"
              value={filters.walletAddress}
              onChange={(e) => setFilters({ ...filters, walletAddress: e.target.value })}
              placeholder="Filter by wallet"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Trait</label>
            <select
              value={filters.traitId}
              onChange={(e) => setFilters({ ...filters, traitId: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
            >
              <option value="">All Traits</option>
              {traits.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.slotName})</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Gifts Table */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30 uppercase tracking-wider">Wallet</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30 uppercase tracking-wider">Trait</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30 uppercase tracking-wider">Qty</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30 uppercase tracking-wider">Created</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {gifts.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-white/20">No gifts found.</td></tr>
              ) : gifts.map((gift) => (
                <tr key={gift.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-sm text-white/60 font-mono">{gift.walletAddress.slice(0, 8)}...{gift.walletAddress.slice(-4)}</td>
                  <td className="px-5 py-3 text-sm text-white/60">{gift.traitName}</td>
                  <td className="px-5 py-3 text-sm text-white">{gift.qtyAvailable}</td>
                  <td className="px-5 py-3 text-sm text-white/40">{new Date(gift.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <button onClick={() => handleRevokeGift(gift.id)} className="text-red-400 hover:text-red-300 text-xs">Revoke</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Gift Modal */}
      {showGiftForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/[0.08] bg-[#14161d] p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              {mfaRequired ? 'MFA Verification' : 'Create Gift'}
            </h3>

            {!mfaRequired ? (
              <form onSubmit={handleGiftSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Wallet Address *</label>
                  <input type="text" required value={formData.walletAddress} onChange={(e) => setFormData({ ...formData, walletAddress: e.target.value })} placeholder="Recipient wallet" className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Trait *</label>
                  <select required value={formData.traitId} onChange={(e) => setFormData({ ...formData, traitId: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors">
                    <option value="">Select Trait</option>
                    {traits.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.slotName} - {t.rarityTierName})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Quantity *</label>
                  <input type="number" min="1" required value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors" />
                </div>
                <p className="text-xs text-amber-400/60 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">MFA verification required. This action is logged.</p>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={resetGiftForm} className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/60 text-sm hover:bg-white/[0.08] transition-colors">Cancel</button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium hover:from-violet-500 hover:to-indigo-500 transition-all">Continue</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleGiftSubmit} className="space-y-4">
                <p className="text-xs text-white/40 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
                  Gift: {formData.quantity}x {traits.find(t => t.id === formData.traitId)?.name} to {formData.walletAddress.slice(0, 8)}...
                </p>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">MFA Code *</label>
                  <input type="text" required maxLength={6} pattern="[0-9]{6}" value={mfaToken} onChange={(e) => setMfaToken(e.target.value)} placeholder="000000" className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm text-center tracking-[0.3em] placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors" />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setMfaRequired(false)} className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/60 text-sm hover:bg-white/[0.08] transition-colors">Back</button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium hover:from-violet-500 hover:to-indigo-500 transition-all">Create Gift</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
