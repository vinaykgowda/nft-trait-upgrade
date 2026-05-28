'use client';

import { useState, useEffect } from 'react';
import { ReforgePack, PackTier } from '@/types/reforge';

interface PackFormProps {
  collectionId: string;
  editingPack: ReforgePack | null;
  onSaved: () => void;
  onCancel: () => void;
}

export default function PackForm({ collectionId, editingPack, onSaved, onCancel }: PackFormProps) {
  const [formData, setFormData] = useState({
    tierName: 'silver' as PackTier,
    solPrice: '',
    minLdzEarning: '',
    maxLdzEarning: '',
    totalInventory: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingPack) {
      setFormData({
        tierName: editingPack.tierName,
        solPrice: editingPack.solPrice.toString(),
        minLdzEarning: editingPack.minLdzEarning.toString(),
        maxLdzEarning: editingPack.maxLdzEarning.toString(),
        totalInventory: editingPack.totalInventory.toString(),
      });
    }
  }, [editingPack]);

  const validate = (): string | null => {
    const price = parseFloat(formData.solPrice);
    const minLdz = parseFloat(formData.minLdzEarning);
    const maxLdz = parseFloat(formData.maxLdzEarning);
    const inventory = parseInt(formData.totalInventory);

    if (!formData.solPrice || isNaN(price) || price <= 0) {
      return 'SOL price must be a positive number';
    }
    if (!formData.minLdzEarning || isNaN(minLdz) || minLdz < 0) {
      return 'Min LDZ earning must be a non-negative number';
    }
    if (!formData.maxLdzEarning || isNaN(maxLdz) || maxLdz < 0) {
      return 'Max LDZ earning must be a non-negative number';
    }
    if (minLdz > maxLdz) {
      return 'Min LDZ earning must be less than or equal to Max LDZ earning';
    }
    if (!formData.totalInventory || isNaN(inventory) || inventory <= 0 || !Number.isInteger(inventory)) {
      return 'Total inventory must be a positive integer';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        collectionId,
        tierName: formData.tierName,
        solPrice: parseFloat(formData.solPrice),
        minLdzEarning: parseFloat(formData.minLdzEarning),
        maxLdzEarning: parseFloat(formData.maxLdzEarning),
        totalInventory: parseInt(formData.totalInventory),
      };

      const url = editingPack
        ? `/api/admin/reforge/packs/${editingPack.id}`
        : '/api/admin/reforge/packs';
      const method = editingPack ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editingPack ? {
          tierName: payload.tierName,
          solPrice: payload.solPrice,
          minLdzEarning: payload.minLdzEarning,
          maxLdzEarning: payload.maxLdzEarning,
          totalInventory: payload.totalInventory,
        } : payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || 'Failed to save pack');
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pack');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
      <h3 className="text-lg font-semibold text-white mb-4">
        {editingPack ? 'Edit Pack' : 'Create New Pack'}
      </h3>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tier */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Tier *</label>
            <select
              value={formData.tierName}
              onChange={(e) => setFormData({ ...formData, tierName: e.target.value as PackTier })}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
            >
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="diamond">Diamond</option>
            </select>
          </div>

          {/* SOL Price */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">SOL Price *</label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={formData.solPrice}
              onChange={(e) => setFormData({ ...formData, solPrice: e.target.value })}
              placeholder="e.g. 0.5"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Min LDZ */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Min LDZ Earning *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.minLdzEarning}
              onChange={(e) => setFormData({ ...formData, minLdzEarning: e.target.value })}
              placeholder="e.g. 5"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors"
              required
            />
          </div>

          {/* Max LDZ */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Max LDZ Earning *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.maxLdzEarning}
              onChange={(e) => setFormData({ ...formData, maxLdzEarning: e.target.value })}
              placeholder="e.g. 15"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors"
              required
            />
          </div>

          {/* Total Inventory */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Total Inventory *</label>
            <input
              type="number"
              step="1"
              min="1"
              value={formData.totalInventory}
              onChange={(e) => setFormData({ ...formData, totalInventory: e.target.value })}
              placeholder="e.g. 100"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors"
              required
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium hover:from-violet-500 hover:to-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : editingPack ? 'Update Pack' : 'Create Pack'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/60 text-sm hover:bg-white/[0.08] transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
