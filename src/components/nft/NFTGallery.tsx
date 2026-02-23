'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { CoreAsset } from '@/types';

interface NFTGalleryProps {
  collectionIds: string[];
  onNFTSelect?: (nft: CoreAsset) => void;
  selectedNFT?: CoreAsset;
}

export function NFTGallery({ collectionIds, onNFTSelect, selectedNFT }: NFTGalleryProps) {
  const { connected, publicKey } = useWallet();
  const [nfts, setNfts] = useState<CoreAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (connected && publicKey && collectionIds.length > 0) fetchNFTs();
    else setNfts([]);
  }, [connected, publicKey, collectionIds]);

  const fetchNFTs = async () => {
    if (!publicKey) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/user/nfts?wallet=${publicKey.toBase58()}`);
      if (!res.ok) throw new Error('Failed to fetch NFTs');
      setNfts(await res.json());
    } catch (err) { setError('Failed to load NFTs. Please try again.'); console.error('Error fetching NFTs:', err); }
    finally { setLoading(false); }
  };

  if (!connected) return <div className="text-center py-8"><p className="text-gray-500 text-sm">Connect your wallet to view your NFTs</p></div>;
  if (loading) return (
    <div className="text-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-yellow-600 border-t-transparent mx-auto mb-3" />
      <p className="text-gray-500 text-sm">Loading your champions...</p>
    </div>
  );
  if (error) return (
    <div className="text-center py-8">
      <p className="text-red-400 text-sm mb-3">{error}</p>
      <button onClick={fetchNFTs} className="text-yellow-500 hover:text-yellow-400 text-sm underline">Retry</button>
    </div>
  );
  if (nfts.length === 0) return (
    <div className="text-center py-8">
      <p className="text-gray-500 text-sm">No eligible NFTs found in your wallet</p>
      <p className="text-xs text-gray-600 mt-2">Make sure you own NFTs from the supported collections</p>
    </div>
  );

  const filtered = nfts.filter(nft => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return nft.name.toLowerCase().includes(q) || nft.address.toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="relative mb-3">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-600/50"
          style={{ background: 'rgba(10,10,15,0.6)', border: '1px solid rgba(201,168,76,0.15)', color: '#e2d9c8' }}
        />
      </div>
      <div className="overflow-y-auto pr-1 flex-1 min-h-0">
        <div className="grid grid-cols-4 gap-2.5">
          {filtered.map((nft) => (
            <NFTCard key={nft.address} nft={nft} selected={selectedNFT?.address === nft.address} onClick={() => onNFTSelect?.(nft)} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-4 text-center py-4 text-gray-500 text-sm">No NFTs match &quot;{searchQuery}&quot;</div>
          )}
        </div>
      </div>
    </div>
  );
}

function NFTCard({ nft, selected, onClick }: { nft: CoreAsset; selected?: boolean; onClick?: () => void }) {
  return (
    <div className="rounded-lg cursor-pointer transition-all duration-200 overflow-hidden"
      style={{
        background: selected ? 'rgba(201,168,76,0.08)' : 'rgba(10,10,15,0.5)',
        border: selected ? '1.5px solid rgba(201,168,76,0.7)' : '1px solid rgba(201,168,76,0.1)',
        boxShadow: selected ? '0 0 16px rgba(201,168,76,0.2)' : 'none',
      }}
      onClick={onClick}
      onMouseEnter={(e) => { if (!selected) { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.35)'; e.currentTarget.style.boxShadow = '0 0 10px rgba(201,168,76,0.1)'; }}}
      onMouseLeave={(e) => { if (!selected) { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.1)'; e.currentTarget.style.boxShadow = 'none'; }}}
    >
      <div className="aspect-square overflow-hidden bg-black/30">
        <img src={nft.image} alt={nft.name} className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = `https://via.placeholder.com/400x400?text=${encodeURIComponent(nft.name)}`; }}
        />
      </div>
      <div className="px-2 py-1.5">
        <h3 className="text-xs font-medium text-gray-200 truncate">{nft.name}</h3>
        <p className="text-[10px] text-gray-500 truncate mt-0.5">
          {nft.address.slice(0, 8)}...{nft.address.slice(-4)}
        </p>
      </div>
    </div>
  );
}
