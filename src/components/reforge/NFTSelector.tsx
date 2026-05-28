'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { CoreAsset } from '@/types';
import { PackTier } from '@/types/reforge';

interface NFTSelectorProps {
  orderId: string;
  tierName?: PackTier;
  onReforgeStarted?: (result: { orderId: string; assetId: string }) => void;
  onCancel?: () => void;
}

type SelectorStep = 'loading' | 'selecting' | 'confirming' | 'submitting' | 'success' | 'error';

const tierConfig: Record<PackTier, { label: string; accentColor: string; glowColor: string; gradient: string }> = {
  silver: {
    label: 'Silver',
    accentColor: '#C0C0C0',
    glowColor: 'rgba(192, 192, 192, 0.3)',
    gradient: 'linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 50%, #D4D4D4 100%)',
  },
  gold: {
    label: 'Gold',
    accentColor: '#FFD700',
    glowColor: 'rgba(255, 215, 0, 0.3)',
    gradient: 'linear-gradient(135deg, #FFD700 0%, #DAA520 50%, #F5D060 100%)',
  },
  diamond: {
    label: 'Diamond',
    accentColor: '#00BFFF',
    glowColor: 'rgba(0, 191, 255, 0.3)',
    gradient: 'linear-gradient(135deg, #00BFFF 0%, #1E90FF 50%, #87CEEB 100%)',
  },
};

export function NFTSelector({ orderId, tierName = 'silver', onReforgeStarted, onCancel }: NFTSelectorProps) {
  const { publicKey, connected } = useWallet();
  const [nfts, setNfts] = useState<CoreAsset[]>([]);
  const [selectedNFT, setSelectedNFT] = useState<CoreAsset | null>(null);
  const [step, setStep] = useState<SelectorStep>('loading');
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const config = tierConfig[tierName];

  const fetchNFTs = useCallback(async () => {
    if (!publicKey) return;
    setStep('loading');
    setError(null);

    try {
      const res = await fetch(`/api/user/nfts?wallet=${publicKey.toBase58()}`);
      if (!res.ok) {
        throw new Error('Failed to fetch NFTs');
      }
      const data: CoreAsset[] = await res.json();
      setNfts(data);
      setStep('selecting');
    } catch (err) {
      console.error('Error fetching NFTs:', err);
      setError('Failed to load your NFTs. Please try again.');
      setStep('error');
    }
  }, [publicKey]);

  useEffect(() => {
    if (connected && publicKey) {
      fetchNFTs();
    }
  }, [connected, publicKey, fetchNFTs]);

  const handleSelectNFT = (nft: CoreAsset) => {
    setSelectedNFT(nft);
  };

  const handleProceedToReforge = () => {
    if (!selectedNFT) return;
    setStep('confirming');
  };

  const handleConfirmReforge = async () => {
    if (!selectedNFT || !publicKey) return;

    setStep('submitting');
    setError(null);

    try {
      const res = await fetch('/api/reforge/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          assetId: selectedNFT.address,
          walletAddress: publicKey.toBase58(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to start reforge');
      }

      setStep('success');
      onReforgeStarted?.({ orderId, assetId: selectedNFT.address });
    } catch (err: any) {
      console.error('Reforge execution error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start reforge. Please try again.');
      setStep('error');
    }
  };

  const handleBackToSelection = () => {
    setStep('selecting');
    setError(null);
  };

  const filteredNFTs = nfts.filter((nft) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return nft.name.toLowerCase().includes(q) || nft.address.toLowerCase().includes(q);
  });

  // Not connected state
  if (!connected || !publicKey) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-sm">Connect your wallet to view your NFTs</p>
      </div>
    );
  }

  // Loading state
  if (step === 'loading') {
    return (
      <div className="text-center py-12">
        <div
          className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent mx-auto mb-3"
          style={{ borderColor: config.accentColor }}
        />
        <p className="text-gray-400 text-sm">Loading your NFTs...</p>
      </div>
    );
  }

  // Error state
  if (step === 'error') {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="text-red-400 text-sm mb-4">{error}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={fetchNFTs}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: `${config.accentColor}20`, color: config.accentColor, border: `1px solid ${config.accentColor}40` }}
          >
            Retry
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  // Confirmation dialog
  if (step === 'confirming' && selectedNFT) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-cinzel font-bold text-white mb-2">Confirm Reforge</h3>
          <p className="text-gray-400 text-sm">
            You are about to reforge the following NFT. This action cannot be undone.
          </p>
        </div>

        {/* Selected NFT preview */}
        <div
          className="mx-auto max-w-xs rounded-xl overflow-hidden"
          style={{
            background: 'rgba(15, 15, 25, 0.9)',
            border: `1px solid ${config.accentColor}50`,
            boxShadow: `0 0 30px ${config.glowColor}`,
          }}
        >
          <div className="aspect-square overflow-hidden">
            <img
              src={selectedNFT.image}
              alt={selectedNFT.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://via.placeholder.com/400x400?text=${encodeURIComponent(selectedNFT.name)}`;
              }}
            />
          </div>
          <div className="p-4 text-center">
            <h4 className="text-white font-semibold text-sm">{selectedNFT.name}</h4>
            <p className="text-gray-500 text-xs mt-1">
              {selectedNFT.address.slice(0, 8)}...{selectedNFT.address.slice(-4)}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleBackToSelection}
            className="flex-1 py-3 px-4 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleConfirmReforge}
            className="flex-1 py-3 px-4 rounded-lg font-cinzel font-bold text-sm uppercase tracking-wider transition-all duration-300 cursor-pointer hover:opacity-90"
            style={{
              background: config.gradient,
              color: '#0a0a0f',
              boxShadow: `0 0 20px ${config.glowColor}`,
            }}
          >
            Proceed to Reforge
          </button>
        </div>
      </div>
    );
  }

  // Submitting state
  if (step === 'submitting') {
    return (
      <div className="text-center py-12">
        <div
          className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent mx-auto mb-3"
          style={{ borderColor: config.accentColor }}
        />
        <p className="text-gray-300 text-sm">Starting reforge...</p>
        <p className="text-gray-500 text-xs mt-1">Please wait while we lock your NFT for reforging</p>
      </div>
    );
  }

  // Success state
  if (step === 'success') {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-white font-semibold mb-1">Reforge Started!</h3>
        <p className="text-gray-400 text-sm">
          Your NFT has been locked for reforging. The process will begin shortly.
        </p>
      </div>
    );
  }

  // NFT Selection grid (step === 'selecting')
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-cinzel font-bold text-white">Select an NFT</h3>
        <span className="text-xs text-gray-500">{nfts.length} NFT{nfts.length !== 1 ? 's' : ''} found</span>
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search by name or address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
          style={{
            background: 'rgba(10, 10, 15, 0.6)',
            border: `1px solid ${config.accentColor}20`,
            color: '#e2d9c8',
          }}
        />
      </div>

      {/* Empty state */}
      {nfts.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">No eligible NFTs found in your wallet</p>
          <p className="text-xs text-gray-600 mt-2">
            Make sure you own NFTs from the supported collection
          </p>
        </div>
      )}

      {/* NFT Grid */}
      {nfts.length > 0 && (
        <div className="overflow-y-auto max-h-[400px] pr-1">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {filteredNFTs.map((nft) => (
              <NFTSelectCard
                key={nft.address}
                nft={nft}
                selected={selectedNFT?.address === nft.address}
                accentColor={config.accentColor}
                glowColor={config.glowColor}
                onClick={() => handleSelectNFT(nft)}
              />
            ))}
          </div>
          {filteredNFTs.length === 0 && searchQuery && (
            <div className="text-center py-6 text-gray-500 text-sm">
              No NFTs match &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="flex gap-3 pt-2 border-t border-white/[0.06]">
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleProceedToReforge}
          disabled={!selectedNFT}
          className="flex-1 py-3 px-4 rounded-lg font-cinzel font-bold text-sm uppercase tracking-wider transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:opacity-90"
          style={{
            background: selectedNFT ? config.gradient : 'rgba(100, 100, 100, 0.3)',
            color: selectedNFT ? '#0a0a0f' : '#666',
            boxShadow: selectedNFT ? `0 0 20px ${config.glowColor}` : 'none',
          }}
        >
          {selectedNFT ? 'Proceed to Reforge' : 'Select an NFT'}
        </button>
      </div>
    </div>
  );
}

/** Individual NFT card for selection */
function NFTSelectCard({
  nft,
  selected,
  accentColor,
  glowColor,
  onClick,
}: {
  nft: CoreAsset;
  selected: boolean;
  accentColor: string;
  glowColor: string;
  onClick: () => void;
}) {
  return (
    <div
      className="relative rounded-lg cursor-pointer transition-all duration-200 overflow-hidden"
      style={{
        background: selected ? `${accentColor}10` : 'rgba(10, 10, 15, 0.5)',
        border: selected ? `2px solid ${accentColor}` : `1px solid ${accentColor}15`,
        boxShadow: selected ? `0 0 16px ${glowColor}` : 'none',
        transform: selected ? 'scale(1.02)' : 'scale(1)',
      }}
      onClick={onClick}
      role="button"
      aria-pressed={selected}
      aria-label={`Select ${nft.name}`}
    >
      <div className="aspect-square overflow-hidden bg-black/30">
        <img
          src={nft.image}
          alt={nft.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://via.placeholder.com/400x400?text=${encodeURIComponent(nft.name)}`;
          }}
        />
      </div>
      <div className="px-2 py-1.5">
        <h4 className="text-xs font-medium text-gray-200 truncate">{nft.name}</h4>
        <p className="text-[10px] text-gray-500 truncate mt-0.5">
          {nft.address.slice(0, 6)}...{nft.address.slice(-4)}
        </p>
      </div>
      {/* Selection indicator */}
      {selected && (
        <div
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: accentColor }}
        >
          <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  );
}
