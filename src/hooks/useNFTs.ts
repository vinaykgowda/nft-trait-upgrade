'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { CoreAsset } from '@/types';

export function useNFTs() {
  const { connected, publicKey } = useWallet();
  const [nfts, setNfts] = useState<CoreAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (connected && publicKey) {
      fetchNFTs();
    } else {
      setNfts([]);
      setError(null);
    }
  }, [connected, publicKey]);

  const fetchNFTs = async () => {
    if (!publicKey) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/user/nfts?wallet=${publicKey.toBase58()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch NFTs');
      }

      const data = await response.json();
      setNfts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load NFTs');
      console.error('Error fetching NFTs:', err);
    } finally {
      setLoading(false);
    }
  };

  const verifyOwnership = async (assetId: string): Promise<boolean> => {
    if (!publicKey) return false;

    try {
      const response = await fetch('/api/user/nfts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toBase58(),
          assetId,
        }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.isOwner;
    } catch (error) {
      console.error('Error verifying ownership:', error);
      return false;
    }
  };

  return {
    nfts,
    loading,
    error,
    refetch: fetchNFTs,
    verifyOwnership,
  };
}