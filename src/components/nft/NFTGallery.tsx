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

  useEffect(() => {
    if (connected && publicKey && collectionIds.length > 0) {
      fetchNFTs();
    } else {
      setNfts([]);
    }
  }, [connected, publicKey, collectionIds]);

  const fetchNFTs = async () => {
    if (!publicKey) return;

    setLoading(true);
    setError(null);

    try {
      // Use the API endpoint instead of direct service call
      const response = await fetch(`/api/user/nfts?wallet=${publicKey.toBase58()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch NFTs');
      }

      const userNFTs = await response.json();
      setNfts(userNFTs);
    } catch (err) {
      setError('Failed to load NFTs. Please try again.');
      console.error('Error fetching NFTs:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">Connect your wallet to view your NFTs</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-500">Loading your NFTs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={fetchNFTs}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (nfts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No eligible NFTs found in your wallet</p>
        <p className="text-sm text-gray-400 mt-2">
          Make sure you own NFTs from the supported collections
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {nfts.map((nft) => (
        <NFTCard
          key={nft.address}
          nft={nft}
          selected={selectedNFT?.address === nft.address}
          onClick={() => onNFTSelect?.(nft)}
        />
      ))}
    </div>
  );
}

interface NFTCardProps {
  nft: CoreAsset;
  selected?: boolean;
  onClick?: () => void;
}

function NFTCard({ nft, selected, onClick }: NFTCardProps) {
  return (
    <div
      className={`
        border-2 rounded-lg p-3 cursor-pointer transition-all
        ${selected 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
        }
      `}
      onClick={onClick}
    >
      <div className="aspect-square mb-3 overflow-hidden rounded-lg bg-gray-100">
        <img
          src={nft.image}
          alt={nft.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = `https://via.placeholder.com/400x400?text=${encodeURIComponent(nft.name)}`;
          }}
        />
      </div>
      
      <div>
        <h3 className="font-medium text-sm truncate mb-1">{nft.name}</h3>
        <p className="text-xs text-gray-500 truncate">
          {nft.address.slice(0, 8)}...{nft.address.slice(-8)}
        </p>
        
        {nft.attributes && nft.attributes.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-gray-400">
              {nft.attributes.length} trait{nft.attributes.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}