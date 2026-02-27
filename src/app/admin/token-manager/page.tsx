'use client';

import { useState, useEffect } from 'react';

interface Project {
  id: string;
  name: string;
  tokens?: ProjectToken[];
}

interface ProjectToken {
  id: string;
  projectId: string;
  tokenAddress: string;
  tokenName?: string;
  tokenSymbol?: string;
  decimals: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}

export default function TokenManagerPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenForm, setTokenForm] = useState({
    tokenAddress: '',
    tokenInfo: null as TokenInfo | null,
    loading: false
  });

  useEffect(() => { fetchProjects(); }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/projects', { credentials: 'include' });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const data = await response.json();
      setProjects(data.projects || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchTokenInfo = async (tokenAddress: string) => {
    if (!tokenAddress.trim()) {
      setTokenForm(prev => ({ ...prev, tokenInfo: null }));
      return;
    }
    setTokenForm(prev => ({ ...prev, loading: true }));
    try {
      const response = await fetch('/api/admin/tokens/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tokenAddress: tokenAddress.trim() })
      });
      if (response.ok) {
        const data = await response.json();
        setTokenForm(prev => ({ ...prev, tokenInfo: data.tokenInfo, loading: false }));
      } else {
        setTokenForm(prev => ({ ...prev, tokenInfo: null, loading: false }));
      }
    } catch {
      setTokenForm(prev => ({ ...prev, tokenInfo: null, loading: false }));
    }
  };

  const addToken = async () => {
    if (!selectedProject) { alert('Please select a project first'); return; }
    if (!tokenForm.tokenInfo) { alert('Please enter a valid token address first'); return; }
    try {
      const response = await fetch(`/api/admin/projects/${selectedProject}/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tokenAddress: tokenForm.tokenInfo.address, enabled: true })
      });
      if (response.ok) {
        await fetchProjects();
        setTokenForm({ tokenAddress: '', tokenInfo: null, loading: false });
        alert('Token added successfully');
      } else {
        const errorData = await response.json();
        alert(`Failed to add token: ${errorData.error}`);
      }
    } catch { alert('Failed to add token'); }
  };

  const removeToken = async (projectId: string, tokenId: string, tokenSymbol: string) => {
    if (tokenSymbol === 'SOL') { alert('Cannot remove SOL — it is the default payment token'); return; }
    if (!confirm(`Remove ${tokenSymbol} token?`)) return;
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/tokens?tokenId=${tokenId}`, {
        method: 'DELETE', credentials: 'include'
      });
      if (response.ok) { await fetchProjects(); alert('Token removed'); }
      else { const d = await response.json(); alert(`Failed: ${d.error}`); }
    } catch { alert('Failed to remove token'); }
  };

  const selectedProjectData = projects.find(p => p.id === selectedProject);

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
        <h1 className="text-2xl font-semibold text-white tracking-tight">Token Manager</h1>
        <p className="mt-1 text-sm text-white/40">Manage payment tokens for your projects. SOL is included by default.</p>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      {/* Project Selection */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
        <label className="block text-xs font-medium text-white/50 mb-1.5">Select Project</label>
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="w-full max-w-md px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
        >
          <option value="">-- Select a Project --</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name} ({project.tokens?.length || 0} tokens)
            </option>
          ))}
        </select>
        <p className="text-xs text-white/20 mt-2">{projects.length} project{projects.length !== 1 ? 's' : ''} available</p>
      </div>

      {/* Current Tokens */}
      {selectedProjectData && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <h2 className="text-sm font-semibold text-white mb-4">
            Tokens for &ldquo;{selectedProjectData.name}&rdquo;
          </h2>
          {selectedProjectData.tokens && selectedProjectData.tokens.length > 0 ? (
            <div className="space-y-2">
              {selectedProjectData.tokens.map((token) => (
                <div key={token.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold text-white">{token.tokenSymbol || 'UNKNOWN'}</span>
                    <span className="text-sm text-white/40">{token.tokenName || 'Unknown Token'}</span>
                    {token.tokenSymbol === 'SOL' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">DEFAULT</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/20 font-mono hidden md:inline">{token.tokenAddress}</span>
                    {token.tokenSymbol !== 'SOL' && (
                      <button
                        onClick={() => removeToken(selectedProjectData.id, token.id, token.tokenSymbol || 'TOKEN')}
                        className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/20 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/20 text-center py-6">No tokens configured</p>
          )}
        </div>
      )}

      {/* Add New Token */}
      {selectedProject && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Add Payment Token</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">SPL Token Mint Address</label>
              <input
                type="text"
                value={tokenForm.tokenAddress}
                onChange={(e) => {
                  setTokenForm(prev => ({ ...prev, tokenAddress: e.target.value }));
                  fetchTokenInfo(e.target.value);
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors"
                placeholder="Enter SPL token mint address"
              />
            </div>

            {tokenForm.loading && (
              <div className="flex items-center gap-2 text-sm text-white/40">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-violet-500 border-t-transparent" />
                Fetching token info...
              </div>
            )}

            {tokenForm.tokenInfo && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-sm font-semibold text-emerald-400">{tokenForm.tokenInfo.symbol}</div>
                <div className="text-xs text-white/40">{tokenForm.tokenInfo.name} · Decimals: {tokenForm.tokenInfo.decimals}</div>
                <div className="text-xs text-white/20 font-mono mt-1">{tokenForm.tokenInfo.address}</div>
              </div>
            )}

            <button
              onClick={addToken}
              disabled={!tokenForm.tokenInfo || tokenForm.loading}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Add Token
            </button>
          </div>

          <div className="mt-5 p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]">
            <p className="text-xs font-medium text-white/30 mb-2">Popular Token Addresses</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs text-white/20 font-mono">
              <div>USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v</div>
              <div>USDT: Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB</div>
              <div>BONK: DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263</div>
              <div>WIF: EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm</div>
              <div>LDZ: E5ZVeBMazQAYq4UEiSNRLxfMeRds9SKL31yPan7j5GJK</div>
            </div>
          </div>
        </div>
      )}

      {!selectedProject && (
        <div className="text-center py-12">
          <p className="text-white/30">Select a project above to manage its tokens</p>
        </div>
      )}
    </>
  );
}
