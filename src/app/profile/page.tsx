'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useRouter } from 'next/navigation';

interface Profile {
  id: string;
  discordId: string;
  discordUsername: string;
  discordDisplayName?: string;
  discordAvatar?: string;
  discordServers: { id: string; name: string; icon?: string }[];
}

interface LinkedWallet {
  id: string;
  walletAddress: string;
  label?: string;
  verified: boolean;
}

interface Voucher {
  id: string;
  code: string;
  traitName: string;
  slotName: string;
  rarityName: string;
  status: string;
  redeemedAt?: string;
}

interface NFT {
  address: string;
  name: string;
  image: string;
  collection?: string;
  attributes?: { trait_type: string; value: string }[];
}

export default function ProfilePage() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallets, setWallets] = useState<LinkedWallet[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'wallets' | 'nfts' | 'vouchers' | 'servers'>('wallets');
  const [walletLabel, setWalletLabel] = useState('');
  const [linkingWallet, setLinkingWallet] = useState(false);
  const [nftsLoading, setNftsLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    const res = await fetch('/api/user/profile');
    if (res.status === 401) {
      router.push('/profile/login');
      return;
    }
    const data = await res.json();
    setProfile(data.profile);
    setWallets(data.wallets);
  }, [router]);

  const fetchVouchers = async () => {
    const res = await fetch('/api/user/vouchers');
    if (res.ok) {
      const data = await res.json();
      setVouchers(data.vouchers);
    }
  };

  const fetchNFTs = async () => {
    setNftsLoading(true);
    try {
      const res = await fetch('/api/user/collection-nfts');
      if (res.ok) {
        const data = await res.json();
        setNfts(data.nfts);
      }
    } finally {
      setNftsLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([fetchProfile(), fetchVouchers()]).finally(() => setLoading(false));
  }, [fetchProfile]);

  useEffect(() => {
    if (tab === 'nfts' && nfts.length === 0 && wallets.length > 0) {
      fetchNFTs();
    }
  }, [tab, wallets.length]);

  const handleLinkWallet = async () => {
    if (!publicKey) return;
    setLinkingWallet(true);
    try {
      const res = await fetch('/api/user/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: publicKey.toString(), label: walletLabel || undefined }),
      });
      if (res.ok) {
        setWalletLabel('');
        await fetchProfile();
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } finally {
      setLinkingWallet(false);
    }
  };

  const handleUnlinkWallet = async (id: string) => {
    if (!confirm('Remove this wallet?')) return;
    await fetch(`/api/user/wallets?id=${id}`, { method: 'DELETE' });
    await fetchProfile();
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/profile/login');
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0f1117] flex items-center justify-center text-white/50">Loading...</div>;
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-[#0f1117] text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {profile.discordAvatar ? (
              <img src={profile.discordAvatar} alt="" className="w-14 h-14 rounded-full" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-violet-600 flex items-center justify-center text-xl font-bold">
                {profile.discordUsername[0].toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold">{profile.discordDisplayName || profile.discordUsername}</h1>
              <p className="text-white/40 text-sm">@{profile.discordUsername}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-sm text-white/40 hover:text-red-400 transition">Logout</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white/[0.04] rounded-lg p-1 w-fit">
          {(['wallets', 'nfts', 'vouchers', 'servers'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                tab === t ? 'bg-violet-600 text-white' : 'text-white/50 hover:text-white'
              }`}>
              {t === 'wallets' ? `Wallets (${wallets.length})` :
               t === 'nfts' ? `Collection NFTs (${nfts.length})` :
               t === 'vouchers' ? `Vouchers (${vouchers.length})` :
               `Servers (${profile.discordServers?.length || 0})`}
            </button>
          ))}
        </div>

        {/* Wallets Tab */}
        {tab === 'wallets' && (
          <div className="space-y-4">
            <div className="bg-white/[0.04] rounded-xl p-5 border border-white/[0.06]">
              <h2 className="text-sm font-medium text-white/60 mb-3">Link a Wallet</h2>
              <div className="flex items-center gap-3">
                <WalletMultiButton className="!bg-violet-600 !rounded-lg !h-10 !text-sm" />
                {publicKey && (
                  <>
                    <input type="text" value={walletLabel} onChange={e => setWalletLabel(e.target.value)}
                      placeholder="Label (optional)" className="bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white flex-1" />
                    <button onClick={handleLinkWallet} disabled={linkingWallet}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 rounded-lg text-sm font-medium transition">
                      {linkingWallet ? 'Linking...' : 'Link Wallet'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {wallets.map(w => (
              <div key={w.id} className="bg-white/[0.04] rounded-xl p-4 border border-white/[0.06] flex items-center justify-between">
                <div>
                  <p className="text-white font-mono text-sm">{w.walletAddress}</p>
                  {w.label && <p className="text-white/40 text-xs mt-0.5">{w.label}</p>}
                </div>
                <button onClick={() => handleUnlinkWallet(w.id)} className="text-red-400 hover:text-red-300 text-xs">Remove</button>
              </div>
            ))}
            {wallets.length === 0 && (
              <p className="text-white/30 text-sm text-center py-8">No wallets linked yet. Connect your wallet above to get started.</p>
            )}
          </div>
        )}

        {/* NFTs Tab */}
        {tab === 'nfts' && (
          <div>
            {nftsLoading ? (
              <p className="text-white/40 text-center py-8">Loading NFTs from {wallets.length} wallet(s)...</p>
            ) : nfts.length === 0 ? (
              <p className="text-white/30 text-center py-8">
                {wallets.length === 0 ? 'Link a wallet first to see your NFTs.' : 'No matching collection NFTs found.'}
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {nfts.map(nft => (
                  <div key={nft.address} className="bg-white/[0.04] rounded-xl border border-white/[0.06] overflow-hidden">
                    <img src={nft.image} alt={nft.name} className="w-full aspect-square object-cover" />
                    <div className="p-3">
                      <p className="text-white text-sm font-medium truncate">{nft.name}</p>
                      {nft.attributes && nft.attributes.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {nft.attributes.slice(0, 3).map((a, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 bg-white/[0.06] rounded text-white/50">
                              {a.trait_type}: {a.value}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Vouchers Tab */}
        {tab === 'vouchers' && (
          <div className="space-y-3">
            {vouchers.length === 0 ? (
              <p className="text-white/30 text-center py-8">No vouchers assigned to your account.</p>
            ) : vouchers.map(v => (
              <div key={v.id} className="bg-white/[0.04] rounded-xl p-4 border border-white/[0.06] flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white text-sm">{v.code}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      v.status === 'active' ? 'bg-green-500/20 text-green-400' :
                      v.status === 'redeemed' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>{v.status}</span>
                  </div>
                  <p className="text-white/50 text-xs mt-1">{v.slotName} → {v.traitName} ({v.rarityName})</p>
                </div>
                {v.status === 'active' && (
                  <span className="text-xs text-violet-400">Ready to use at checkout</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Servers Tab */}
        {tab === 'servers' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(profile.discordServers || []).map(s => (
              <div key={s.id} className="bg-white/[0.04] rounded-xl p-4 border border-white/[0.06] flex items-center gap-3">
                {s.icon ? (
                  <img src={`https://cdn.discordapp.com/icons/${s.id}/${s.icon}.png`} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-white/[0.1] flex items-center justify-center text-xs text-white/40">
                    {s.name[0]}
                  </div>
                )}
                <span className="text-white text-sm truncate">{s.name}</span>
              </div>
            ))}
            {(!profile.discordServers || profile.discordServers.length === 0) && (
              <p className="text-white/30 text-sm col-span-full text-center py-8">No servers found.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
