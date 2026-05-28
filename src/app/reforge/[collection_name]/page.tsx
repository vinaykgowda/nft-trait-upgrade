'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { ReforgePack } from '@/types/reforge';
import { PackCard } from '@/components/reforge/PackCard';
import { PurchaseModal } from '@/components/reforge/PurchaseModal';

const POLL_INTERVAL_MS = 15000; // 15 seconds

export default function ReforgeCollectionPage() {
  const params = useParams();
  const collectionName = params.collection_name as string;

  const [packs, setPacks] = useState<ReforgePack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedPack, setSelectedPack] = useState<ReforgePack | null>(null);

  // Resolve collection slug to collection ID via API
  const resolveCollection = useCallback(async () => {
    try {
      const res = await fetch(`/api/reforge/resolve?slug=${encodeURIComponent(collectionName)}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Collection not found');
          return null;
        }
        throw new Error('Failed to resolve collection');
      }
      const data = await res.json();
      setCollectionId(data.collectionId);
      setProjectName(data.projectName || '');
      return data.collectionId;
    } catch (err) {
      console.error('Error resolving collection:', err);
      setError('Failed to load collection');
      return null;
    }
  }, [collectionName]);

  // Fetch packs for the collection
  const fetchPacks = useCallback(async (colId?: string) => {
    const id = colId || collectionId;
    if (!id) return;

    try {
      const res = await fetch(`/api/reforge/packs?collectionId=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error('Failed to fetch packs');
      const data = await res.json();
      setPacks(data.packs || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching packs:', err);
      setError('Failed to load reforge packs');
    }
  }, [collectionId]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const colId = await resolveCollection();
      if (colId) {
        await fetchPacks(colId);
      }
      setLoading(false);
    };
    init();
  }, [resolveCollection, fetchPacks]);

  // Polling for real-time remaining count updates
  useEffect(() => {
    if (!collectionId) return;

    pollIntervalRef.current = setInterval(() => {
      fetchPacks();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [collectionId, fetchPacks]);

  const handlePurchase = (pack: ReforgePack) => {
    setSelectedPack(pack);
  };

  const handlePurchaseSuccess = (_orderId: string) => {
    fetchPacks();
  };

  const handleModalClose = () => {
    setSelectedPack(null);
    fetchPacks();
  };

  // Format the collection name for display (replace underscores with spaces, title case)
  const displayName = projectName || collectionName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-yellow-600 border-t-transparent mx-auto mb-3" />
          <p className="text-yellow-600/70 font-cinzel text-base tracking-widest uppercase">
            Loading Reforge Packs...
          </p>
        </div>
      </div>
    );
  }

  if (error && packs.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}>
        <div className="text-center">
          <p className="text-red-400 mb-4 text-base">{error}</p>
          <button
            onClick={() => resolveCollection().then((id) => id && fetchPacks(id))}
            className="text-yellow-500 hover:text-yellow-400 underline text-base"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed"
      style={{ backgroundImage: "url('/bg.webp')", backgroundColor: '#0a0a0f' }}
    >
      <div className="min-h-screen" style={{ background: 'rgba(5, 5, 10, 0.85)' }}>
        {/* Header */}
        <div className="pt-8 pb-4 px-4 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-cinzel font-bold tracking-widest uppercase mb-3 text-yellow-400">
            {displayName} Reforge
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto">
            Purchase a reforge pack to transform your NFT with new traits from the swap pool.
            Each pack tier offers different earning ranges and rarity potential.
          </p>
        </div>

        {/* Pack Cards Grid */}
        <div className="max-w-5xl mx-auto px-4 py-8">
          {packs.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500 text-lg font-cinzel">No packs available at this time</p>
              <p className="text-gray-600 text-sm mt-2">Check back later for new reforge opportunities</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {packs.map((pack, index) => (
                <PackCard
                  key={pack.id}
                  pack={pack}
                  index={index}
                  onPurchase={handlePurchase}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center pb-8 px-4">
          <p className="text-gray-600 text-xs">
            Remaining counts update automatically. No page refresh needed.
          </p>
        </div>
      </div>

      {/* Purchase Modal */}
      {selectedPack && (
        <PurchaseModal
          pack={selectedPack}
          onClose={handleModalClose}
          onSuccess={handlePurchaseSuccess}
        />
      )}
    </div>
  );
}
