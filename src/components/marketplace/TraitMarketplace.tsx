'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { CoreAsset, Trait, TraitSlot } from '@/types';
import { TraitSelection } from '@/lib/services/preview';
import { formatDecimalPrice } from '@/lib/utils';
import { NFTGallery } from '../nft/NFTGallery';
import { LivePreview } from '../traits/LivePreview';
import { EnhancedPurchaseFlow } from '../purchase/EnhancedPurchaseFlow';

interface TraitChange {
  slotName: string;
  oldTrait: string;
  newTrait: Trait;
}

function getRarityClass(rarityName: string): string {
  switch (rarityName.toLowerCase()) {
    case 'mythic': return 'rarity-mythic';
    case 'legendary': return 'rarity-legendary';
    case 'rare': return 'rarity-rare';
    case 'uncommon': return 'rarity-uncommon';
    default: return 'rarity-common';
  }
}

function getRarityBadgeColor(rarityName: string): string {
  switch (rarityName.toLowerCase()) {
    case 'mythic': return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    case 'legendary': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'rare': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'uncommon': return 'bg-green-500/20 text-green-300 border-green-500/40';
    default: return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
  }
}

export function TraitMarketplace() {
  const { connected } = useWallet();
  const [selectedNFT, setSelectedNFT] = useState<CoreAsset | null>(null);
  const [traits, setTraits] = useState<Trait[]>([]);
  const [slots, setSlots] = useState<TraitSlot[]>([]);
  const [selectedTraits, setSelectedTraits] = useState<TraitSelection>({});
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showPurchaseFlow, setShowPurchaseFlow] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<{
    txSignature: string;
    updatedImageUrl: string;
  } | null>(null);

  const tabsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (slots.length > 0 && !activeSlotId) {
      setActiveSlotId(slots[0].id);
    }
  }, [slots, activeSlotId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [projectResponse, traitsResponse, slotsResponse] = await Promise.all([
        fetch('/api/project'),
        fetch('/api/traits?active=1'),
        fetch('/api/trait-slots')
      ]);

      if (!projectResponse.ok || !traitsResponse.ok || !slotsResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const [projectResult, traitsResult, slotsResult] = await Promise.all([
        projectResponse.json(),
        traitsResponse.json(),
        slotsResponse.json()
      ]);

      const projectData = projectResult.data || projectResult;
      setCollectionIds(projectData.collectionIds || []);
      setTraits(traitsResult.data || []);
      setSlots(slotsResult.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleNFTSelect = (nft: CoreAsset) => {
    setSelectedNFT(nft);
    setSelectedTraits({});
    setPurchaseSuccess(null);
  };

  const handleTraitSelect = (slotId: string, trait: Trait | null) => {
    if (trait && selectedNFT?.attributes) {
      const slot = slots.find(s => s.id === slotId);
      const slotName = slot?.name || '';
      const currentAttribute = selectedNFT.attributes.find(
        attr => attr.trait_type?.toLowerCase() === slotName.toLowerCase()
      );
      if (currentAttribute && currentAttribute.value?.toLowerCase() === trait.name.toLowerCase()) {
        setDuplicateWarning(`Your NFT already has "${trait.name}" as its ${slotName}. Pick a different one!`);
        setTimeout(() => setDuplicateWarning(null), 4000);
        return;
      }
    }
    setDuplicateWarning(null);
    setSelectedTraits(prev => {
      const updated = { ...prev };
      if (trait) {
        updated[slotId] = trait;
      } else {
        delete updated[slotId];
      }
      return updated;
    });
  };

  const getTraitsForSlot = (slotId: string): Trait[] => {
    return traits.filter(trait => trait.slotId === slotId);
  };

  const getTraitChanges = (): TraitChange[] => {
    if (!selectedNFT) return [];
    return Object.entries(selectedTraits).map(([slotId, newTrait]) => {
      const slot = slots.find(s => s.id === slotId);
      const slotName = slot?.name || 'Unknown';
      const currentAttribute = selectedNFT.attributes?.find(
        attr => attr.trait_type?.toLowerCase() === slotName.toLowerCase()
      );
      return { slotName, oldTrait: currentAttribute?.value || 'None', newTrait };
    });
  };

  const getTotalPrice = () => {
    const traitValues = Object.values(selectedTraits);
    let solTotal = 0;
    let ldzTotal = 0;
    traitValues.forEach(trait => {
      const amount = Number(trait.priceAmount);
      if (trait.priceToken.symbol === 'SOL') solTotal += amount;
      else if (trait.priceToken.symbol === 'LDZ') ldzTotal += amount;
    });
    if (solTotal > 0 && ldzTotal > 0) {
      return { isMixed: true, ldzAmount: ldzTotal, solAmount: solTotal, displayText: `${ldzTotal} LDZ + ${solTotal} SOL` };
    } else if (ldzTotal > 0) {
      return { isMixed: false, amount: ldzTotal, symbol: 'LDZ', displayText: `${ldzTotal} LDZ` };
    } else if (solTotal > 0) {
      return { isMixed: false, amount: solTotal, symbol: 'SOL', displayText: `${solTotal} SOL` };
    }
    return { isMixed: false, amount: 0, symbol: 'SOL', displayText: '0 SOL' };
  };

  const handlePurchaseStart = () => {
    if (Object.keys(selectedTraits).length > 0 && selectedNFT) {
      setShowPurchaseFlow(true);
    }
  };

  const handlePurchaseSuccess = (txSignature: string, updatedImageUrl?: string) => {
    setPurchaseSuccess({ txSignature, updatedImageUrl: updatedImageUrl || selectedNFT?.image || '' });
    setShowPurchaseFlow(false);
    setSelectedTraits({});
    fetchData();
  };

  const handlePurchaseCancel = () => { setShowPurchaseFlow(false); };

  const handleTweet = () => {
    if (!purchaseSuccess || !selectedNFT) return;
    const tweetText = `Just forged my ${selectedNFT.name} NFT with new traits using Pepeverse Trait Forge! 🔥⚔️ Check it out: https://magiceden.io/item-details/${selectedNFT.address}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank');
  };

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsContainerRef.current) {
      const scrollAmount = 150;
      tabsContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Active slot traits
  const activeSlotTraits = activeSlotId ? getTraitsForSlot(activeSlotId) : [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-yellow-600 border-t-transparent mx-auto mb-3"></div>
          <p className="text-yellow-600/70 font-cinzel text-sm tracking-widest uppercase">Loading the Forge...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}>
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={fetchData} className="text-yellow-500 hover:text-yellow-400 underline">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed"
      style={{ backgroundImage: "url('/bg.webp')", backgroundColor: '#0a0a0f' }}
    >
      {/* Dark overlay */}
      <div className="min-h-screen" style={{ background: 'rgba(5, 5, 10, 0.75)' }}>

        {/* Success Modal */}
        {purchaseSuccess && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="forge-panel p-8 max-w-md w-full mx-4">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)' }}>
                  <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-cinzel text-yellow-400 mb-2">Forge Complete!</h3>
                <p className="text-gray-400 text-sm mb-4">Your champion has been transformed</p>
                <div className="mb-6">
                  <img src={purchaseSuccess.updatedImageUrl} alt="Updated NFT" className="w-48 h-48 object-cover rounded-lg mx-auto border border-yellow-600/30" />
                </div>
                <div className="flex space-x-3">
                  <button onClick={handleTweet} className="flex-1 py-2 px-4 rounded-lg text-sm font-medium" style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)', color: '#93c5fd' }}>
                    Tweet About It
                  </button>
                  <button onClick={() => setPurchaseSuccess(null)} className="flex-1 py-2 px-4 rounded-lg text-sm font-medium" style={{ background: 'rgba(156, 163, 175, 0.1)', border: '1px solid rgba(156, 163, 175, 0.3)', color: '#9ca3af' }}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== HEADER: Logo + Wallet ===== */}
        <div className="flex flex-col items-center pt-6 pb-2 px-4">
          <img src="/logo.webp" alt="Pepeverse Trait Forge" className="h-28 sm:h-36 object-contain mb-3 drop-shadow-2xl" />
          {!connected && (
            <div className="mt-2">
              <WalletMultiButton />
            </div>
          )}
          {connected && (
            <div className="mt-1">
              <WalletMultiButton />
            </div>
          )}
        </div>

        {/* ===== MAIN 3-COLUMN LAYOUT ===== */}
        <div className="px-2 sm:px-4 pb-6 pt-2">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:h-[calc(100vh-220px)]">

            {/* ===== LEFT: SELECT YOUR CHAMPION ===== */}
            <div className="lg:col-span-4 forge-panel p-4 flex flex-col lg:overflow-hidden">
              <h2 className="font-cinzel text-yellow-400 text-sm tracking-widest uppercase mb-3 flex items-center gap-2">
                <span className="text-lg">⚔️</span> Select Your Champion
              </h2>

              {!connected ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-gray-500 text-sm mb-2">Connect wallet to view available NFTs to forge</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 lg:overflow-y-auto">
                  <NFTGallery
                    collectionIds={collectionIds}
                    onNFTSelect={handleNFTSelect}
                    selectedNFT={selectedNFT || undefined}
                  />
                </div>
              )}
            </div>

            {/* ===== CENTER: CHOOSE TRAIT TO FORGE ===== */}
            <div className="lg:col-span-4 forge-panel p-4 flex flex-col lg:overflow-hidden">
              <h2 className="font-cinzel text-yellow-400 text-sm tracking-widest uppercase mb-3 flex items-center gap-2">
                <span className="text-lg">🔮</span> Choose Trait to Forge
              </h2>

              {duplicateWarning && (
                <div className="mb-3 px-3 py-2 rounded-lg text-sm flex items-center gap-2" style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', color: '#fbbf24' }}>
                  <span>⚠️</span>
                  <span>{duplicateWarning}</span>
                </div>
              )}

              {!selectedNFT ? (
                <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                  {collectionIds.length === 0 ? (
                    <div className="text-center">
                      <p>No collections configured</p>
                      <p className="text-xs mt-2 text-gray-600">Admin needs to configure collection IDs</p>
                    </div>
                  ) : (
                    <p>Select a champion to view available traits</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col flex-1 min-h-0">
                  {/* Category Tabs with scroll arrows */}
                  <div className="flex items-center gap-1 mb-3">
                    <button onClick={() => scrollTabs('left')} className="scroll-arrow" aria-label="Scroll categories left">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div ref={tabsContainerRef} className="flex-1 flex gap-1.5 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      {slots.map(slot => {
                        const count = getTraitsForSlot(slot.id).length;
                        if (count === 0) return null;
                        return (
                          <button
                            key={slot.id}
                            onClick={() => setActiveSlotId(slot.id)}
                            className={`category-tab ${activeSlotId === slot.id ? 'active' : ''}`}
                          >
                            {slot.name}
                            {selectedTraits[slot.id] && (
                              <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <button onClick={() => scrollTabs('right')} className="scroll-arrow" aria-label="Scroll categories right">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>

                  {/* Traits Grid - scrollable */}
                  <div className="flex-1 overflow-y-auto pr-1">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {activeSlotTraits.map(trait => {
                        const isSelected = activeSlotId ? selectedTraits[activeSlotId]?.id === trait.id : false;
                        const isAvailable = !trait.totalSupply || (trait.remainingSupply && trait.remainingSupply > 0);
                        const rarityClass = getRarityClass(trait.rarityTier.name);
                        const badgeColor = getRarityBadgeColor(trait.rarityTier.name);

                        return (
                          <div
                            key={trait.id}
                            className={`trait-card ${rarityClass} ${isSelected ? 'rarity-selected' : ''} ${!isAvailable ? 'opacity-40 cursor-not-allowed' : ''}`}
                            onClick={() => isAvailable && activeSlotId && handleTraitSelect(activeSlotId, isSelected ? null : trait)}
                          >
                            <div className="aspect-square bg-black/30 overflow-hidden relative">
                              <img src={trait.imageLayerUrl} alt={trait.name} className="w-full h-full object-cover" />
                              {/* Rarity badge */}
                              <span className={`absolute top-1 left-1 text-[9px] font-semibold px-1.5 py-0.5 rounded border ${badgeColor}`}>
                                {trait.rarityTier.name}
                              </span>
                              {isSelected && (
                                <div className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: 'rgba(201, 168, 76, 0.9)', color: '#0a0a0f' }}>✓</div>
                              )}
                              {!isAvailable && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                  <span className="text-red-400 text-xs font-semibold">Sold Out</span>
                                </div>
                              )}
                            </div>
                            <div className="p-2">
                              <div className="text-xs font-medium text-gray-200 truncate">{trait.name}</div>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-[10px] text-yellow-400 font-semibold">
                                  {formatDecimalPrice(trait.priceAmount.toString())} {trait.priceToken.symbol}
                                </span>
                                {trait.totalSupply && (
                                  <span className="text-[10px] text-gray-500">
                                    {trait.remainingSupply}/{trait.totalSupply}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {activeSlotTraits.length === 0 && (
                        <div className="col-span-full text-center py-8 text-gray-500 text-sm">
                          No traits available for this category
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ===== RIGHT: WITNESS THE TRANSFORMATION ===== */}
            <div className="lg:col-span-4 forge-panel p-4 flex flex-col lg:overflow-hidden">
              <h2 className="font-cinzel text-yellow-400 text-sm tracking-widest uppercase mb-3 flex items-center gap-2">
                <span className="text-lg">🔥</span> Witness the Transformation
              </h2>

              {!selectedNFT ? (
                <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                  {collectionIds.length === 0 ? (
                    <div className="text-center">
                      <p>No collections configured</p>
                      <p className="text-xs mt-2 text-gray-600">Admin needs to configure collection IDs</p>
                    </div>
                  ) : (
                    <p>Select a champion to see preview</p>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col space-y-3 lg:overflow-y-auto">
                  {/* Preview Images */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Original</h4>
                      <div className="aspect-square rounded-lg overflow-hidden" style={{ border: '1px solid rgba(201, 168, 76, 0.2)' }}>
                        <img src={selectedNFT.image} alt={selectedNFT.name} className="w-full h-full object-cover" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">With Traits</h4>
                      <div style={{ border: '1px solid rgba(201, 168, 76, 0.2)', borderRadius: '0.5rem', overflow: 'hidden' }}>
                        <LivePreview baseNFT={selectedNFT} selectedTraits={selectedTraits} slots={slots} />
                      </div>
                    </div>
                  </div>

                  {/* Trait Changes */}
                  {getTraitChanges().length > 0 && (
                    <div className="pt-2" style={{ borderTop: '1px solid rgba(201, 168, 76, 0.1)' }}>
                      <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Changes</h4>
                      <div className="space-y-1.5">
                        {getTraitChanges().map((change, index) => (
                          <div key={index} className="text-xs flex items-center gap-2">
                            <span className="text-yellow-400/70 font-medium">{change.slotName}:</span>
                            <span className="text-gray-500 line-through">{change.oldTrait}</span>
                            <span className="text-gray-600">→</span>
                            <span className="text-green-400 font-medium">{change.newTrait.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pricing */}
                  {Object.keys(selectedTraits).length > 0 && (
                    <div className="pt-2" style={{ borderTop: '1px solid rgba(201, 168, 76, 0.1)' }}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs text-gray-400">
                          Total ({Object.keys(selectedTraits).length} trait{Object.keys(selectedTraits).length > 1 ? 's' : ''})
                        </span>
                        <span className="text-base font-cinzel font-bold text-yellow-400">
                          {getTotalPrice().displayText}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {Object.values(selectedTraits).map(trait => (
                          <div key={trait.id} className="flex justify-between text-[10px] text-gray-500">
                            <span>{trait.name}</span>
                            <span>{formatDecimalPrice(trait.priceAmount.toString())} {trait.priceToken.symbol}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Forge Button */}
                  <div className="mt-auto pt-3">
                    {Object.keys(selectedTraits).length > 0 ? (
                      <button onClick={handlePurchaseStart} className="forge-button">
                        ⚔️ Forge Upgrade — {getTotalPrice().displayText}
                      </button>
                    ) : (
                      <div className="text-center text-gray-600 py-4 text-xs">
                        Select traits to begin forging
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Purchase Flow Modal */}
      {showPurchaseFlow && selectedNFT && Object.keys(selectedTraits).length > 0 && (
        <EnhancedPurchaseFlow
          selectedNFT={selectedNFT}
          selectedTraits={selectedTraits}
          onSuccess={handlePurchaseSuccess}
          onCancel={handlePurchaseCancel}
        />
      )}
    </div>
  );
}
