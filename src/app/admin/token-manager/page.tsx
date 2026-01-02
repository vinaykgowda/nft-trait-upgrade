'use client';

import { useState, useEffect } from 'react';
import AdminNavigation from '@/components/admin/AdminNavigation';

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

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/projects', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setProjects(data.projects || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
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
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ tokenAddress: tokenAddress.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        setTokenForm(prev => ({ 
          ...prev, 
          tokenInfo: data.tokenInfo,
          loading: false 
        }));
      } else {
        setTokenForm(prev => ({ 
          ...prev, 
          tokenInfo: null,
          loading: false 
        }));
      }
    } catch (err) {
      console.error('Failed to fetch token info:', err);
      setTokenForm(prev => ({ 
        ...prev, 
        tokenInfo: null,
        loading: false 
      }));
    }
  };

  const addToken = async () => {
    if (!selectedProject) {
      alert('Please select a project first');
      return;
    }

    if (!tokenForm.tokenInfo) {
      alert('Please enter a valid token address first');
      return;
    }

    try {
      const response = await fetch(`/api/admin/projects/${selectedProject}/tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ 
          tokenAddress: tokenForm.tokenInfo.address,
          enabled: true 
        })
      });

      if (response.ok) {
        await fetchProjects();
        setTokenForm({ tokenAddress: '', tokenInfo: null, loading: false });
        alert('Token added successfully');
      } else {
        const errorData = await response.json();
        alert(`Failed to add token: ${errorData.error}`);
      }
    } catch (err) {
      console.error('Failed to add token:', err);
      alert('Failed to add token');
    }
  };

  const removeToken = async (projectId: string, tokenId: string, tokenSymbol: string) => {
    if (tokenSymbol === 'SOL') {
      alert('Cannot remove SOL - it is the default payment token');
      return;
    }

    if (!confirm(`Are you sure you want to remove ${tokenSymbol} token?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/projects/${projectId}/tokens?tokenId=${tokenId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        await fetchProjects();
        alert('Token removed successfully');
      } else {
        const errorData = await response.json();
        alert(`Failed to remove token: ${errorData.error}`);
      }
    } catch (err) {
      console.error('Failed to remove token:', err);
      alert('Failed to remove token');
    }
  };

  const selectedProjectData = projects.find(p => p.id === selectedProject);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-green-400">
        <AdminNavigation />
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-xl">Loading projects...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-green-400">
      <AdminNavigation />
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-green-400 mb-2">🪙 Token Manager</h1>
            <p className="text-gray-300">Manage payment tokens for your projects. SOL is included by default.</p>
          </div>

          {error && (
            <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded mb-6">
              Error: {error}
            </div>
          )}

          {/* Project Selection */}
          <div className="bg-gray-900 border border-green-600 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-green-400 mb-4">📋 Select Project</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Choose Project:</label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full bg-black border border-green-600 rounded px-3 py-2 text-green-400 focus:outline-none focus:border-green-400"
                >
                  <option value="">-- Select a Project --</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} ({project.tokens?.length || 0} tokens)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <div className="text-sm text-gray-400">
                  {projects.length} project{projects.length !== 1 ? 's' : ''} available
                </div>
              </div>
            </div>
          </div>

          {/* Current Tokens Display */}
          {selectedProjectData && (
            <div className="bg-gray-900 border border-green-600 rounded-lg p-6 mb-8">
              <h2 className="text-2xl font-bold text-green-400 mb-4">
                💰 Current Tokens for "{selectedProjectData.name}"
              </h2>
              
              {selectedProjectData.tokens && selectedProjectData.tokens.length > 0 ? (
                <div className="space-y-3">
                  {selectedProjectData.tokens.map((token) => (
                    <div key={token.id} className="bg-green-900 border border-green-500 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold text-green-200">
                              {token.tokenSymbol || 'UNKNOWN'}
                            </span>
                            <span className="text-green-100 text-lg">
                              {token.tokenName || 'Unknown Token'}
                            </span>
                            {token.tokenSymbol === 'SOL' && (
                              <span className="bg-yellow-600 text-black px-2 py-1 rounded text-xs font-bold">
                                DEFAULT
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-green-300 mt-1">
                            <span className="font-mono">{token.tokenAddress}</span>
                            <span className="ml-4">Decimals: {token.decimals}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {token.tokenSymbol !== 'SOL' && (
                            <button
                              onClick={() => removeToken(selectedProjectData.id, token.id, token.tokenSymbol || 'TOKEN')}
                              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors font-semibold"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-lg">No tokens configured</div>
                  <div className="text-gray-500 text-sm mt-2">SOL should be added automatically</div>
                </div>
              )}
            </div>
          )}

          {/* Add New Token */}
          {selectedProject && (
            <div className="bg-blue-900 border border-blue-500 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-blue-200 mb-4">➕ Add New Payment Token</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-blue-300">
                    SPL Token Mint Address:
                  </label>
                  <input
                    type="text"
                    value={tokenForm.tokenAddress}
                    onChange={(e) => {
                      setTokenForm(prev => ({ ...prev, tokenAddress: e.target.value }));
                      fetchTokenInfo(e.target.value);
                    }}
                    className="w-full bg-black border border-blue-500 rounded px-3 py-2 text-blue-200 focus:outline-none focus:border-blue-400"
                    placeholder="Enter SPL token mint address (e.g., EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v for USDC)"
                  />
                </div>
                
                {tokenForm.loading && (
                  <div className="text-yellow-300 text-sm flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-300"></div>
                    Fetching token information from Helius API...
                  </div>
                )}
                
                {tokenForm.tokenInfo && (
                  <div className="bg-green-900 border border-green-500 p-4 rounded">
                    <div className="text-green-300 font-bold text-lg">✅ {tokenForm.tokenInfo.symbol}</div>
                    <div className="text-green-200">{tokenForm.tokenInfo.name}</div>
                    <div className="text-green-200 text-sm">Decimals: {tokenForm.tokenInfo.decimals}</div>
                    <div className="text-green-300 text-xs mt-2 font-mono">{tokenForm.tokenInfo.address}</div>
                  </div>
                )}
                
                <button
                  onClick={addToken}
                  disabled={!tokenForm.tokenInfo || tokenForm.loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors font-bold text-lg"
                >
                  {tokenForm.loading ? 'Loading...' : 'Add Payment Token'}
                </button>
              </div>

              <div className="mt-6 p-4 bg-gray-800 rounded border border-gray-600">
                <h3 className="text-lg font-semibold text-gray-300 mb-2">💡 Popular Token Addresses:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-400">
                    <strong>USDC:</strong> EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
                  </div>
                  <div className="text-gray-400">
                    <strong>USDT:</strong> Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
                  </div>
                  <div className="text-gray-400">
                    <strong>BONK:</strong> DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
                  </div>
                  <div className="text-gray-400">
                    <strong>WIF:</strong> EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm
                  </div>
                  <div className="text-gray-400">
                    <strong>LDZ (Voodoo):</strong> E5ZVeBMazQAYq4UEiSNRLxfMeRds9SKL31yPan7j5GJK
                  </div>
                </div>
              </div>
            </div>
          )}

          {!selectedProject && (
            <div className="text-center py-12">
              <div className="text-2xl text-gray-400 mb-4">👆 Select a project above to manage its tokens</div>
              <div className="text-gray-500">You can add multiple SPL tokens for trait purchases</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}