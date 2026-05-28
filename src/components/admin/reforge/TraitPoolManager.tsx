'use client';

import { useState, useEffect } from 'react';

interface PoolTrait {
  id: string;
  slotId: string;
  slotName: string;
  name: string;
  imageLayerUrl: string;
  ldzEarning: number;
  layerOrder: number;
}

interface AllTrait {
  id: string;
  slotName: string;
  name: string;
  imageLayerUrl: string;
  swapPoolOnly: boolean;
  ldzEarning: number;
}

interface TraitPoolManagerProps {
  collectionId: string;
}

export default function TraitPoolManager({ collectionId }: TraitPoolManagerProps) {
  const [traits, setTraits] = useState<AllTrait[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingTraitId, setUpdatingTraitId] = useState<string | null>(null);
  const [filterSlot, setFilterSlot] = useState<string>('all');
  const [filterPool, setFilterPool] = useState<'all' | 'pool' | 'marketplace'>('all');

  useEffect(() => {
    if (collectionId) {
      fetchTraits();
    }
  }, [collectionId]);

  const fetchTraits = async () => {
    try {
      setLoading(true);
      // Fetch all traits for the collection (not just pool traits)
      const res = await fetch('/api/admin/traits', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch traits');
      const data = await res.json();
      const allTraits: AllTrait[] = (data.traits || []).map((t: any) => ({
        id: t.id,
        slotName: t.slotName,
        name: t.name,
        imageLayerUrl: t.imageLayerUrl,
        swapPoolOnly: t.swapPoolOnly ?? false,
        ldzEarning: t.ldzEarning ?? 0,
      }));
      setTraits(allTraits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch traits');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSwapPool = async (trait: AllTrait) => {
    setUpdatingTraitId(trait.id);
    setError(null);
    try {
      const newSwapPoolOnly = !trait.swapPoolOnly;
      const res = await fetch('/api/admin/reforge/traits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          traitId: trait.id,
          swapPoolOnly: newSwapPoolOnly,
          ldzEarning: trait.ldzEarning,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || 'Failed to update trait');
      }

      // Update local state
      setTraits((prev) =>
        prev.map((t) =>
          t.id === trait.id ? { ...t, swapPoolOnly: newSwapPoolOnly } : t
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update trait');
    } finally {
      setUpdatingTraitId(null);
    }
  };

  const handleLdzChange = async (trait: AllTrait, newValue: string) => {
    const ldzEarning = parseFloat(newValue);
    if (isNaN(ldzEarning) || ldzEarning < 0) return;

    // Update local state immediately for responsiveness
    setTraits((prev) =>
      prev.map((t) =>
        t.id === trait.id ? { ...t, ldzEarning } : t
      )
    );
  };

  const handleLdzSave = async (trait: AllTrait) => {
    setUpdatingTraitId(trait.id);
    setError(null);
    try {
      const res = await fetch('/api/admin/reforge/traits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          traitId: trait.id,
          swapPoolOnly: trait.swapPoolOnly,
          ldzEarning: trait.ldzEarning,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || 'Failed to update LDZ earning');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update LDZ earning');
      // Revert on error
      await fetchTraits();
    } finally {
      setUpdatingTraitId(null);
    }
  };

  // Get unique slot names for filter
  const slotNames = Array.from(new Set(traits.map((t) => t.slotName))).sort();

  // Filter traits
  const filteredTraits = traits.filter((t) => {
    if (filterSlot !== 'all' && t.slotName !== filterSlot) return false;
    if (filterPool === 'pool' && !t.swapPoolOnly) return false;
    if (filterPool === 'marketplace' && t.swapPoolOnly) return false;
    return true;
  });

  const poolCount = traits.filter((t) => t.swapPoolOnly).length;
  const marketplaceCount = traits.filter((t) => !t.swapPoolOnly).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-medium text-white">Trait Pool Manager</h2>
          <p className="text-sm text-white/40 mt-0.5">
            {poolCount} in swap pool · {marketplaceCount} in marketplace
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-3 text-red-300 hover:text-red-200">✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          value={filterSlot}
          onChange={(e) => setFilterSlot(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50"
        >
          <option value="all">All Slots</option>
          {slotNames.map((slot) => (
            <option key={slot} value={slot}>{slot}</option>
          ))}
        </select>

        <select
          value={filterPool}
          onChange={(e) => setFilterPool(e.target.value as 'all' | 'pool' | 'marketplace')}
          className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50"
        >
          <option value="all">All Traits</option>
          <option value="pool">Swap Pool Only</option>
          <option value="marketplace">Marketplace Only</option>
        </select>
      </div>

      {/* Traits Table */}
      {filteredTraits.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <p className="text-white/40">No traits found matching filters</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Trait</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Slot</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Swap Pool</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">LDZ Earning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredTraits.map((trait) => (
                <tr key={trait.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {trait.imageLayerUrl && (
                        <img
                          src={trait.imageLayerUrl}
                          alt={trait.name}
                          className="w-8 h-8 rounded object-cover bg-white/[0.04]"
                        />
                      )}
                      <span className="text-sm text-white/80">{trait.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-white/50">{trait.slotName}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggleSwapPool(trait)}
                      disabled={updatingTraitId === trait.id}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        trait.swapPoolOnly ? 'bg-violet-600' : 'bg-white/[0.1]'
                      } ${updatingTraitId === trait.id ? 'opacity-50' : ''}`}
                      aria-label={`Toggle swap pool for ${trait.name}`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          trait.swapPoolOnly ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                        style={{ transform: trait.swapPoolOnly ? 'translateX(18px)' : 'translateX(3px)' }}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={trait.ldzEarning}
                        onChange={(e) => handleLdzChange(trait, e.target.value)}
                        onBlur={() => handleLdzSave(trait)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleLdzSave(trait); }}
                        disabled={updatingTraitId === trait.id}
                        className="w-20 px-2 py-1 rounded bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 disabled:opacity-50"
                      />
                      <span className="text-xs text-white/30">LDZ/day</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
