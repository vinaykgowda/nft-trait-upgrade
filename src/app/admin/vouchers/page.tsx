'use client';

import { useState, useEffect, useCallback } from 'react';

interface Voucher {
  id: string;
  code: string;
  user_id: string;
  discord_username: string;
  trait_name: string;
  slot_name: string;
  rarity_name: string;
  status: string;
  created_at: string;
  redeemed_at?: string;
}

interface Analytics {
  total: number;
  active: number;
  redeemed: number;
  revoked: number;
  bySlot: { slot_name: string; count: number }[];
  byRarity: { rarity_name: string; count: number }[];
}

interface TraitSlot { id: string; name: string; }
interface RarityTier { id: string; name: string; }
interface TraitOption { id: string; name: string; slot_id: string; rarity_tier_id: string; }
interface UserOption { id: string; discordUsername: string; }

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'list' | 'create' | 'analytics'>('list');
  const [statusFilter, setStatusFilter] = useState('');

  // Create form state
  const [slots, setSlots] = useState<TraitSlot[]>([]);
  const [rarities, setRarities] = useState<RarityTier[]>([]);
  const [traits, setTraits] = useState<TraitOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [form, setForm] = useState({ slotId: '', rarityTierId: '', traitId: '', userId: '' });
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ slotId: '', rarityTierId: '', traitId: '', userId: '' });

  const fetchVouchers = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/admin/vouchers?${params}`);
    const data = await res.json();
    setVouchers(data.vouchers || []);
  }, [statusFilter]);

  const fetchAnalytics = async () => {
    const res = await fetch('/api/admin/vouchers/analytics');
    const data = await res.json();
    setAnalytics(data);
  };

  const fetchFormData = async () => {
    const [slotsRes, raritiesRes, traitsRes] = await Promise.all([
      fetch('/api/trait-slots'),
      fetch('/api/admin/rarities'),
      fetch('/api/admin/traits?limit=1000'),
    ]);
    const slotsData = await slotsRes.json();
    const raritiesData = await raritiesRes.json();
    const traitsData = await traitsRes.json();
    // /api/trait-slots returns { success: true, data: [...] }
    setSlots(slotsData.data || slotsData.slots || slotsData || []);
    // /api/admin/rarities returns { rarities: [...] }
    setRarities(raritiesData.rarities || raritiesData || []);
    // /api/admin/traits returns { traits: [...] } with camelCase fields
    setTraits((traitsData.traits || []).map((t: any) => ({
      id: t.id, name: t.name, slot_id: t.slotId || t.slot_id, rarity_tier_id: t.rarityTier?.id || t.rarity_tier_id,
    })));
  };

  const searchUsers = useCallback(async (q: string) => {
    const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setUsers(data.users || []);
  }, []);

  useEffect(() => {
    Promise.all([fetchVouchers(), fetchAnalytics(), fetchFormData()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchVouchers(); }, [statusFilter, fetchVouchers]);

  useEffect(() => {
    const timer = setTimeout(() => searchUsers(userSearch), 300);
    return () => clearTimeout(timer);
  }, [userSearch, searchUsers]);

  // Filtered traits based on selected slot + rarity
  const filteredTraits = traits.filter(t =>
    (!form.slotId || t.slot_id === form.slotId) &&
    (!form.rarityTierId || t.rarity_tier_id === form.rarityTierId)
  );

  const editFilteredTraits = traits.filter(t =>
    (!editForm.slotId || t.slot_id === editForm.slotId) &&
    (!editForm.rarityTierId || t.rarity_tier_id === editForm.rarityTierId)
  );

  const handleCreate = async () => {
    if (!form.userId || !form.traitId || !form.slotId || !form.rarityTierId) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ slotId: '', rarityTierId: '', traitId: '', userId: '' });
        setUserSearch('');
        await fetchVouchers();
        await fetchAnalytics();
        setTab('list');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Revoke this voucher?')) return;
    await fetch(`/api/admin/vouchers/${id}`, { method: 'DELETE' });
    await fetchVouchers();
    await fetchAnalytics();
  };

  const startEdit = (v: Voucher) => {
    const trait = traits.find(t => t.name === v.trait_name);
    setEditingId(v.id);
    setEditForm({
      slotId: trait?.slot_id || '',
      rarityTierId: trait?.rarity_tier_id || '',
      traitId: trait?.id || '',
      userId: v.user_id,
    });
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    await fetch(`/api/admin/vouchers/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setEditingId(null);
    await fetchVouchers();
  };

  if (loading) {
    return <div className="text-white/50 p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Trait Vouchers</h1>
        <div className="flex gap-2">
          {(['list', 'create', 'analytics'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === t ? 'bg-violet-600 text-white' : 'bg-white/[0.06] text-white/60 hover:text-white'
              }`}>
              {t === 'list' ? 'All Vouchers' : t === 'create' ? 'Create' : 'Analytics'}
            </button>
          ))}
        </div>
      </div>

      {/* Analytics Tab */}
      {tab === 'analytics' && analytics && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total', value: analytics.total, color: 'text-white' },
            { label: 'Active', value: analytics.active, color: 'text-green-400' },
            { label: 'Redeemed', value: analytics.redeemed, color: 'text-blue-400' },
            { label: 'Revoked', value: analytics.revoked, color: 'text-red-400' },
          ].map(s => (
            <div key={s.label} className="bg-white/[0.04] rounded-xl p-5 border border-white/[0.06]">
              <p className="text-white/40 text-sm">{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
          <div className="col-span-2 bg-white/[0.04] rounded-xl p-5 border border-white/[0.06]">
            <p className="text-white/60 text-sm font-medium mb-3">By Category</p>
            {analytics.bySlot.map(s => (
              <div key={s.slot_name} className="flex justify-between text-sm py-1">
                <span className="text-white/70">{s.slot_name}</span>
                <span className="text-white font-medium">{s.count}</span>
              </div>
            ))}
          </div>
          <div className="col-span-2 bg-white/[0.04] rounded-xl p-5 border border-white/[0.06]">
            <p className="text-white/60 text-sm font-medium mb-3">By Rarity</p>
            {analytics.byRarity.map(r => (
              <div key={r.rarity_name} className="flex justify-between text-sm py-1">
                <span className="text-white/70">{r.rarity_name}</span>
                <span className="text-white font-medium">{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Tab */}
      {tab === 'create' && (
        <div className="bg-white/[0.04] rounded-xl p-6 border border-white/[0.06] max-w-xl space-y-4">
          <h2 className="text-lg font-semibold text-white">Create Voucher</h2>

          <div>
            <label className="block text-sm text-white/60 mb-1">Category (Trait Slot)</label>
            <select value={form.slotId} onChange={e => setForm({ ...form, slotId: e.target.value, traitId: '' })}
              className="w-full bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm">
              <option value="">Select category...</option>
              {slots.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1">Rarity</label>
            <select value={form.rarityTierId} onChange={e => setForm({ ...form, rarityTierId: e.target.value, traitId: '' })}
              className="w-full bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm">
              <option value="">Select rarity...</option>
              {rarities.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1">Trait</label>
            <select value={form.traitId} onChange={e => setForm({ ...form, traitId: e.target.value })}
              className="w-full bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm"
              disabled={!form.slotId}>
              <option value="">Select trait...</option>
              {filteredTraits.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1">Discord User</label>
            <input type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)}
              placeholder="Search by username..."
              className="w-full bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm" />
            {users.length > 0 && userSearch && !form.userId && (
              <div className="mt-1 bg-[#1a1d27] border border-white/[0.1] rounded-lg max-h-40 overflow-y-auto">
                {users.map(u => (
                  <button key={u.id} onClick={() => { setForm({ ...form, userId: u.id }); setUserSearch(u.discordUsername); }}
                    className="w-full text-left px-3 py-2 text-sm text-white/70 hover:bg-white/[0.06]">
                    {u.discordUsername}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleCreate} disabled={creating || !form.userId || !form.traitId}
            className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition">
            {creating ? 'Creating...' : 'Create Voucher'}
          </button>
        </div>
      )}

      {/* List Tab */}
      {tab === 'list' && (
        <>
          <div className="flex gap-2 mb-4">
            {['', 'active', 'redeemed', 'revoked'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  statusFilter === s ? 'bg-violet-600 text-white' : 'bg-white/[0.06] text-white/50 hover:text-white'
                }`}>
                {s || 'All'}
              </button>
            ))}
          </div>

          <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 text-white/40 font-medium">Code</th>
                  <th className="text-left px-4 py-3 text-white/40 font-medium">User</th>
                  <th className="text-left px-4 py-3 text-white/40 font-medium">Trait</th>
                  <th className="text-left px-4 py-3 text-white/40 font-medium">Category</th>
                  <th className="text-left px-4 py-3 text-white/40 font-medium">Rarity</th>
                  <th className="text-left px-4 py-3 text-white/40 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-white/40 font-medium">Created</th>
                  <th className="text-right px-4 py-3 text-white/40 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map(v => (
                  <tr key={v.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    {editingId === v.id ? (
                      <>
                        <td className="px-4 py-3 text-white font-mono">{v.code}</td>
                        <td className="px-4 py-3 text-white/70">{v.discord_username}</td>
                        <td className="px-4 py-3">
                          <select value={editForm.traitId} onChange={e => setEditForm({ ...editForm, traitId: e.target.value })}
                            className="bg-white/[0.06] border border-white/[0.1] rounded px-2 py-1 text-white text-xs">
                            {editFilteredTraits.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select value={editForm.slotId} onChange={e => setEditForm({ ...editForm, slotId: e.target.value, traitId: '' })}
                            className="bg-white/[0.06] border border-white/[0.1] rounded px-2 py-1 text-white text-xs">
                            {slots.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select value={editForm.rarityTierId} onChange={e => setEditForm({ ...editForm, rarityTierId: e.target.value, traitId: '' })}
                            className="bg-white/[0.06] border border-white/[0.1] rounded px-2 py-1 text-white text-xs">
                            {rarities.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-green-400 text-xs">{v.status}</span>
                        </td>
                        <td className="px-4 py-3 text-white/40">{new Date(v.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button onClick={handleUpdate} className="text-green-400 hover:text-green-300 text-xs">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-white/40 hover:text-white text-xs">Cancel</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-white font-mono text-xs">{v.code}</td>
                        <td className="px-4 py-3 text-white/70">{v.discord_username}</td>
                        <td className="px-4 py-3 text-white/70">{v.trait_name}</td>
                        <td className="px-4 py-3 text-white/50">{v.slot_name}</td>
                        <td className="px-4 py-3 text-white/50">{v.rarity_name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            v.status === 'active' ? 'bg-green-500/20 text-green-400' :
                            v.status === 'redeemed' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>{v.status}</span>
                        </td>
                        <td className="px-4 py-3 text-white/40 text-xs">{new Date(v.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right space-x-2">
                          {v.status === 'active' && (
                            <>
                              <button onClick={() => startEdit(v)} className="text-violet-400 hover:text-violet-300 text-xs">Edit</button>
                              <button onClick={() => handleDelete(v.id)} className="text-red-400 hover:text-red-300 text-xs">Revoke</button>
                            </>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {vouchers.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-white/30">No vouchers found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
