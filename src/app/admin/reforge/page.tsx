'use client';

import { useState, useEffect } from 'react';
import PackForm from '@/components/admin/reforge/PackForm';
import TraitPoolManager from '@/components/admin/reforge/TraitPoolManager';
import { ReforgePack } from '@/types/reforge';

type Tab = 'packs' | 'traits' | 'settings';

export default function AdminReforgePage() {
  const [activeTab, setActiveTab] = useState<Tab>('packs');
  const [packs, setPacks] = useState<ReforgePack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPackForm, setShowPackForm] = useState(false);
  const [editingPack, setEditingPack] = useState<ReforgePack | null>(null);
  const [collectionId, setCollectionId] = useState<string>('');

  // Settings state
  const [updateAuthorityKey, setUpdateAuthorityKey] = useState('');
  const [hasUpdateAuthority, setHasUpdateAuthority] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [projectId, setProjectId] = useState<string>('');

  useEffect(() => {
    fetchProjectAndPacks();
  }, []);

  const fetchProjectAndPacks = async () => {
    try {
      setLoading(true);
      // Fetch projects to get the collection ID
      const projectsRes = await fetch('/api/admin/projects', { credentials: 'include' });
      if (!projectsRes.ok) throw new Error('Failed to fetch projects');
      const projectsData = await projectsRes.json();
      const projects = projectsData.projects || [];

      if (projects.length > 0) {
        const project = projects[0];
        setProjectId(project.id);
        const firstCollectionId = project.collectionIds?.[0] || '';
        setCollectionId(firstCollectionId);

        if (firstCollectionId) {
          await fetchPacks(firstCollectionId);
        }

        // Check if update authority is configured
        const projectRes = await fetch(`/api/admin/projects/${project.id}`, { credentials: 'include' });
        if (projectRes.ok) {
          const projectDetail = await projectRes.json();
          setHasUpdateAuthority(projectDetail.project?.hasUpdateAuthority || false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPacks = async (colId: string) => {
    try {
      const res = await fetch(`/api/admin/reforge/packs?collectionId=${colId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch packs');
      const data = await res.json();
      setPacks(data.packs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch packs');
    }
  };

  const handleToggleEnabled = async (pack: ReforgePack) => {
    try {
      const res = await fetch(`/api/admin/reforge/packs/${pack.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: !pack.enabled }),
      });
      if (!res.ok) throw new Error('Failed to toggle pack');
      await fetchPacks(collectionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle pack');
    }
  };

  const handleDeletePack = async (packId: string) => {
    if (!confirm('Are you sure you want to delete this pack? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/admin/reforge/packs/${packId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete pack');
      await fetchPacks(collectionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pack');
    }
  };

  const handlePackSaved = () => {
    setShowPackForm(false);
    setEditingPack(null);
    fetchPacks(collectionId);
  };

  const handleSaveUpdateAuthority = async () => {
    if (!updateAuthorityKey.trim()) {
      setSettingsMessage({ type: 'error', text: 'Please enter the Update Authority private key' });
      return;
    }
    if (!projectId) {
      setSettingsMessage({ type: 'error', text: 'No project found' });
      return;
    }

    setSettingsLoading(true);
    setSettingsMessage(null);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ updateAuthority: updateAuthorityKey }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || 'Failed to save');
      }

      setHasUpdateAuthority(true);
      setUpdateAuthorityKey('');
      setSettingsMessage({ type: 'success', text: 'Update Authority key saved and encrypted successfully' });
    } catch (err) {
      setSettingsMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save key' });
    } finally {
      setSettingsLoading(false);
    }
  };

  const tierColors: Record<string, string> = {
    silver: 'text-gray-300',
    gold: 'text-yellow-400',
    diamond: 'text-cyan-400',
  };

  const tierBgColors: Record<string, string> = {
    silver: 'bg-gray-500/10 border-gray-500/20',
    gold: 'bg-yellow-500/10 border-yellow-500/20',
    diamond: 'bg-cyan-500/10 border-cyan-500/20',
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
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Reforge Management</h1>
          <p className="mt-1 text-sm text-white/40">Manage packs, trait pools, and reforge settings</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-3 text-red-300 hover:text-red-200">✕</button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg bg-white/[0.02] border border-white/[0.06] w-fit">
        {(['packs', 'traits', 'settings'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Packs Tab */}
      {activeTab === 'packs' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-white">Reforge Packs</h2>
            <button
              onClick={() => { setEditingPack(null); setShowPackForm(true); }}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-violet-500/20"
            >
              + New Pack
            </button>
          </div>

          {showPackForm && (
            <div className="mb-6">
              <PackForm
                collectionId={collectionId}
                editingPack={editingPack}
                onSaved={handlePackSaved}
                onCancel={() => { setShowPackForm(false); setEditingPack(null); }}
              />
            </div>
          )}

          {packs.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <p className="text-white/40">No packs created yet</p>
              <p className="text-white/20 text-sm mt-1">Create your first reforge pack to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {packs.map((pack) => (
                <div key={pack.id} className={`rounded-xl border p-5 ${tierBgColors[pack.tierName] || 'bg-white/[0.02] border-white/[0.06]'}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-semibold capitalize ${tierColors[pack.tierName] || 'text-white'}`}>
                        {pack.tierName}
                      </span>
                      {!pack.enabled && (
                        <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400 border border-red-500/30">
                          Disabled
                        </span>
                      )}
                      {pack.remainingCount === 0 && (
                        <span className="px-2 py-0.5 rounded text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30">
                          Sold Out
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingPack(pack); setShowPackForm(true); }}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/60 text-xs hover:bg-white/[0.08] transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleEnabled(pack)}
                        className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                          pack.enabled
                            ? 'bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20'
                            : 'bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20'
                        }`}
                      >
                        {pack.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => handleDeletePack(pack.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/20 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                    <div>
                      <span className="text-white/30">Price:</span>
                      <span className="ml-2 text-white/70">{pack.solPrice} SOL</span>
                    </div>
                    <div>
                      <span className="text-white/30">LDZ Range:</span>
                      <span className="ml-2 text-white/70">{pack.minLdzEarning} – {pack.maxLdzEarning}</span>
                    </div>
                    <div>
                      <span className="text-white/30">Inventory:</span>
                      <span className="ml-2 text-white/70">{pack.remainingCount} / {pack.totalInventory}</span>
                    </div>
                    <div>
                      <span className="text-white/30">Status:</span>
                      <span className={`ml-2 ${pack.enabled ? 'text-green-400' : 'text-red-400'}`}>
                        {pack.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Traits Tab */}
      {activeTab === 'traits' && (
        <TraitPoolManager collectionId={collectionId} />
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl">
          <h2 className="text-lg font-medium text-white mb-4">Reforge Settings</h2>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h3 className="text-base font-medium text-white mb-2">Update Authority Key</h3>
            <p className="text-sm text-white/40 mb-4">
              The Update Authority private key is required to update on-chain NFT metadata during reforge.
              This key is encrypted server-side before storage.
            </p>

            {/* Warning */}
            <div className="mb-4 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p className="text-sm text-amber-300 font-medium">Sensitive Data</p>
                  <p className="text-xs text-amber-400/70 mt-0.5">
                    This private key grants authority to modify NFT metadata. It will be encrypted with AES-256-GCM before storage and never exposed in API responses or logs.
                  </p>
                </div>
              </div>
            </div>

            {/* Status indicator */}
            {hasUpdateAuthority && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-green-300">Key configured ✓</span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">
                  Update Authority Private Key {hasUpdateAuthority && '(enter new key to replace)'}
                </label>
                <input
                  type="password"
                  value={updateAuthorityKey}
                  onChange={(e) => setUpdateAuthorityKey(e.target.value)}
                  placeholder={hasUpdateAuthority ? '••••••••••••••••' : 'Enter base58-encoded private key'}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>

              {settingsMessage && (
                <div className={`px-4 py-3 rounded-lg text-sm ${
                  settingsMessage.type === 'success'
                    ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
                }`}>
                  {settingsMessage.text}
                </div>
              )}

              <button
                onClick={handleSaveUpdateAuthority}
                disabled={settingsLoading || !updateAuthorityKey.trim()}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium hover:from-violet-500 hover:to-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {settingsLoading ? 'Saving...' : 'Save & Encrypt Key'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
