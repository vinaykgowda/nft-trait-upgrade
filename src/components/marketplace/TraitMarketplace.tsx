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

function getRarityClass(name: string): string {
  switch (name.toLowerCase()) {
    case 'mythic': return 'rarity-mythic';
    case 'legendary': return 'rarity-legendary';
    case 'rare': return 'rarity-rare';
    case 'uncommon': return 'rarity-uncommon';
    default: return 'rarity-common';
  }
}

function getRarityBadgeColor(name: string): string {
  switch (name.toLowerCase()) {
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

  const tabsRef = useRef<HTMLDivElement>(null);
  const traitsRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (slots.length > 0 && !activeSlotId) setActiveSlotId(slots[0].id); }, [slots, activeSlotId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [projectRes, traitsRes, slotsRes] = await Promise.all([
        fetch('/api/project'), fetch('/api/traits?active=1'), fetch('/api/trait-slots')
      ]);
      if (!projectRes.ok || !traitsRes.ok || !slotsRes.ok) throw new Error('Failed to fetch data');
      const [projectResult, traitsResult, slotsResult] = await Promise.all([projectRes.json(), traitsRes.json(), slotsRes.json()]);
      const projectData = projectResult.data || projectResult;
      setCollectionIds(projectData.collectionIds || []);
      setTraits(traitsResult.data || []);
      setSlots(slotsResult.data || []);
    } catch (err) { console.error('Error fetching data:', err); setError('Failed to load data'); }
    finally { setLoading(false); }
  };

  const handleNFTSelect = (nft: CoreAsset) => { setSelectedNFT(nft); setSelectedTraits({}); setPurchaseSuccess(null); };

  const handleTraitSelect = (slotId: string, trait: Trait | null) => {
    if (trait && selectedNFT?.attributes) {
      const slot = slots.find(s => s.id === slotId);
      const slotName = slot?.name || '';
      const cur = selectedNFT.attributes.find(a => a.trait_type?.toLowerCase() === slotName.toLowerCase());
      if (cur && cur.value?.toLowerCase() === trait.name.toLowerCase()) {
        setDuplicateWarning(`Your NFT already has "${trait.name}" as its ${slotName}. Pick a different one!`);
        setTimeout(() => setDuplicateWarning(null), 4000);
        return;
      }
    }
    setDuplicateWarning(null);
    setSelectedTraits(prev => { const u = { ...prev }; if (trait) u[slotId] = trait; else delete u[slotId]; return u; });
  };

  const getTraitsForSlot = (slotId: string) => traits.filter(t => t.slotId === slotId);

  const getTraitChanges = (): TraitChange[] => {
    if (!selectedNFT) return [];
    return Object.entries(selectedTraits).map(([slotId, newTrait]) => {
      const slot = slots.find(s => s.id === slotId);
      const slotName = slot?.name || 'Unknown';
      const cur = selectedNFT.attributes?.find(a => a.trait_type?.toLowerCase() === slotName.toLowerCase());
      return { slotName, oldTrait: cur?.value || 'None', newTrait };
    });
  };

  const getTotalPrice = () => {
    let solTotal = 0, ldzTotal = 0;
    Object.values(selectedTraits).forEach(t => {
      const amt = Number(t.priceAmount);
      if (t.priceToken.symbol === 'SOL') solTotal += amt; else if (t.priceToken.symbol === 'LDZ') ldzTotal += amt;
    });
    if (solTotal > 0 && ldzTotal > 0) return { isMixed: true, ldzAmount: ldzTotal, solAmount: solTotal, displayText: `${ldzTotal} LDZ + ${solTotal} SOL` };
    if (ldzTotal > 0) return { isMixed: false, amount: ldzTotal, symbol: 'LDZ', displayText: `${ldzTotal} LDZ` };
    if (solTotal > 0) return { isMixed: false, amount: solTotal, symbol: 'SOL', displayText: `${solTotal} SOL` };
    return { isMixed: false, amount: 0, symbol: 'SOL', displayText: '0 SOL' };
  };

  const handlePurchaseStart = () => { if (Object.keys(selectedTraits).length > 0 && selectedNFT) setShowPurchaseFlow(true); };
  const handlePurchaseSuccess = (txSig: string, imgUrl?: string) => {
    setPurchaseSuccess({ txSignature: txSig, updatedImageUrl: imgUrl || selectedNFT?.image || '' });
    setShowPurchaseFlow(false); setSelectedTraits({}); fetchData();
  };
  const handlePurchaseCancel = () => setShowPurchaseFlow(false);
  const handleTweet = () => {
    if (!purchaseSuccess || !selectedNFT) return;
    const txt = `Just forged my ${selectedNFT.name} NFT with new traits using Pepeverse Trait Forge! 🔥⚔️ Check it out: https://magiceden.io/item-details/${selectedNFT.address}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(txt)}`, '_blank');
  };

  const scrollTabs = (dir: 'left' | 'right') => { tabsRef.current?.scrollBy({ left: dir === 'left' ? -150 : 150, behavior: 'smooth' }); };
  const scrollTraits = (dir: 'left' | 'right') => { traitsRowRef.current?.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' }); };

  const activeSlotTraits = activeSlotId ? getTraitsForSlot(activeSlotId) : [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-yellow-600 border-t-transparent mx-auto mb-3" />
          <p className="text-yellow-600/70 font-cinzel text-base tracking-widest uppercase">Loading the Forge...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}>
        <div className="text-center">
          <p className="text-red-400 mb-4 text-base">{error}</p>
          <button onClick={fetchData} className="text-yellow-500 hover:text-yellow-400 underline text-base">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-cover bg-center bg-fixed" style={{ backgroundImage: "url('/bg.webp')", backgroundColor: '#0a0a0f' }}>
      <div className="h-screen overflow-hidden" style={{ background: 'rgba(5, 5, 10, 0.75)' }}>

        {/* SUCCESS MODAL */}
        {purchaseSuccess && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="forge-panel p-8 max-w-md w-full mx-4 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)' }}>
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-xl font-cinzel text-yellow-400 mb-2">Forge Complete!</h3>
              <p className="text-gray-400 text-sm mb-4">Your champion has been transformed</p>
              <img src={purchaseSuccess.updatedImageUrl} alt="Updated NFT" className="w-48 h-48 object-cover rounded-lg mx-auto border border-yellow-600/30 mb-6" />
              <div className="flex space-x-3">
                <button onClick={handleTweet} className="flex-1 py-2 px-4 rounded-lg text-sm font-medium" style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', color: '#93c5fd' }}>Tweet About It</button>
                <button onClick={() => setPurchaseSuccess(null)} className="flex-1 py-2 px-4 rounded-lg text-sm font-medium" style={{ background: 'rgba(156,163,175,0.1)', border: '1px solid rgba(156,163,175,0.3)', color: '#9ca3af' }}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* CENTERED LOGO + WALLET */}
        <div className="flex flex-col items-center pt-2 pb-1">
          <img src="/logo.webp" alt="Pepeverse Trait Forge" className="h-20 sm:h-24 object-contain drop-shadow-2xl" />
          <div className="mt-1"><WalletMultiButton /></div>
        </div>

        {/* MAIN 2-COLUMN LAYOUT */}
        <div className="flex flex-col lg:flex-row p-2 sm:p-3 gap-3" style={{ height: 'calc(100vh - 140px)' }}>

          {/* LEFT COLUMN: NFTs */}
          <div className="lg:w-[42%] flex flex-col min-h-0">
            <div className="forge-panel p-4 flex-1 flex flex-col min-h-0">
              <h2 className="font-cinzel text-yellow-400 text-base sm:text-lg tracking-widest uppercase mb-3 text-center">
                Select Your Champion
              </h2>
              {!connected ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-gray-500 text-sm text-center">Connect wallet to view available NFTs to forge</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto min-h-0">
                  <NFTGallery collectionIds={collectionIds} onNFTSelect={handleNFTSelect} selectedNFT={selectedNFT || undefined} />
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Traits (top) + Preview (bottom) */}
          <div className="lg:w-[58%] flex flex-col gap-3 min-h-0">

            {/* TOP: CHOOSE TRAIT TO FORGE */}
            <div className="forge-panel p-4 flex flex-col" style={{ minHeight: '300px' }}>
              <h2 className="font-cinzel text-yellow-400 text-base sm:text-lg tracking-widest uppercase mb-3 text-center">
                Choose Trait to Forge
              </h2>

              {duplicateWarning && (
                <div className="mb-2 px-3 py-2 rounded text-sm flex items-center gap-2" style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', color: '#fbbf24' }}>
                  ⚠️ {duplicateWarning}
                </div>
              )}

              {!selectedNFT ? (
                <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                  {collectionIds.length === 0
                    ? <div className="text-center"><p>No collections configured</p><p className="text-xs mt-1 text-gray-600">Admin needs to configure collection IDs</p></div>
                    : <p>Select a champion to view available traits</p>}
                </div>
              ) : (
                <>
                  {/* Category Tabs */}
                  <div className="flex items-center gap-1.5 mb-3">
                    <button onClick={() => scrollTabs('left')} className="scroll-arrow" aria-label="Scroll left">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div ref={tabsRef} className="flex-1 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      {slots.map(slot => {
                        if (getTraitsForSlot(slot.id).length === 0) return null;
                        return (
                          <button key={slot.id} onClick={() => setActiveSlotId(slot.id)}
                            className={`category-tab ${activeSlotId === slot.id ? 'active' : ''}`}>
                            {slot.name}
                            {selectedTraits[slot.id] && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-yellow-400" />}
                          </button>
                        );
                      })}
                    </div>
                    <button onClick={() => scrollTabs('right')} className="scroll-arrow" aria-label="Scroll right">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>

                  {/* Horizontal scrollable trait cards */}
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => scrollTraits('left')} className="scroll-arrow" aria-label="Scroll traits left">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div ref={traitsRowRef} className="flex-1 overflow-x-auto overflow-y-hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      <div className="flex gap-3 pb-1">
                        {activeSlotTraits.map(trait => {
                          const isSelected = activeSlotId ? selectedTraits[activeSlotId]?.id === trait.id : false;
                          const isAvailable = !trait.totalSupply || (trait.remainingSupply && trait.remainingSupply > 0);
                          const rarityClass = getRarityClass(trait.rarityTier.name);
                          const badgeColor = getRarityBadgeColor(trait.rarityTier.name);

                          return (
                            <div key={trait.id}
                              className={`trait-card flex-shrink-0 ${rarityClass} ${isSelected ? 'rarity-selected' : ''} ${!isAvailable ? 'opacity-40 cursor-not-allowed' : ''}`}
                              style={{ width: '150px' }}
                              onClick={() => isAvailable && activeSlotId && handleTraitSelect(activeSlotId, isSelected ? null : trait)}
                            >
                              <div className="aspect-square bg-black/30 overflow-hidden relative">
                                <img src={trait.imageLayerUrl} alt={trait.name} className="w-full h-full object-cover" />
                                <span className={`absolute top-1.5 left-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badgeColor}`}>
                                  {trait.rarityTier.name}
                                </span>
                                {isSelected && (
                                  <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: 'rgba(201,168,76,0.9)', color: '#0a0a0f' }}>✓</div>
                                )}
                                {!isAvailable && (
                                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                    <span className="text-red-400 text-xs font-semibold">Sold Out</span>
                                  </div>
                                )}
                              </div>
                              <div className="p-2">
                                <div className="text-sm font-medium text-gray-200 truncate">{trait.name}</div>
                                <div className="flex justify-between items-center mt-1">
                                  <span className="text-xs text-gray-400">Pricing</span>
                                  <span className="text-xs text-gray-400">Stock</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-yellow-400 font-semibold">
                                    ◆ {formatDecimalPrice(trait.priceAmount.toString())} {trait.priceToken.symbol}
                                  </span>
                                  <span className="text-xs text-gray-300">
                                    {trait.totalSupply ? `${trait.remainingSupply}` : '∞'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {activeSlotTraits.length === 0 && (
                          <div className="flex-1 text-center py-6 text-gray-500 text-sm">No traits for this category</div>
                        )}
                      </div>
                    </div>
                    <button onClick={() => scrollTraits('right')} className="scroll-arrow" aria-label="Scroll traits right">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* BOTTOM: WITNESS THE TRANSFORMATION */}
            <div className="forge-panel p-4 flex flex-col">
              <h2 className="font-cinzel text-yellow-400 text-base sm:text-lg tracking-widest uppercase mb-3 text-center">
                Witness the Transformation
              </h2>

              {!selectedNFT ? (
                <div className="flex items-center justify-center text-gray-500 text-sm py-4">
                  {collectionIds.length === 0
                    ? <div className="text-center"><p>No collections configured</p><p className="text-xs mt-1 text-gray-600">Admin needs to configure collection IDs</p></div>
                    : <p>Select a champion to see preview</p>}
                </div>
              ) : (
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Original + Forged side by side */}
                  <div className="flex gap-3 flex-shrink-0">
                    <div className="w-40 lg:w-48">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Original</h4>
                      <div className="aspect-square rounded-lg overflow-hidden" style={{ border: '1px solid rgba(201,168,76,0.2)' }}>
                        <img src={selectedNFT.image} alt={selectedNFT.name} className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-gray-500 mt-1 text-center truncate">{selectedNFT.name}</p>
                    </div>
                    <div className="w-40 lg:w-48">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Forged</h4>
                      <div style={{ border: '1px solid rgba(201,168,76,0.2)', borderRadius: '0.5rem', overflow: 'hidden' }}>
                        <LivePreview baseNFT={selectedNFT} selectedTraits={selectedTraits} slots={slots} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1 text-center">Forged</p>
                    </div>
                  </div>

                  {/* Changes + Pricing + Button */}
                  <div className="flex-1 flex flex-col min-w-0">
                    {getTraitChanges().length > 0 && (
                      <div className="mb-2">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Changes</h4>
                        <div className="space-y-1">
                          {getTraitChanges().map((change, i) => (
                            <div key={i} className="text-sm flex items-center gap-2">
                              <span className="text-yellow-400/80 font-medium">{change.slotName}:</span>
                              <span className="text-gray-500 line-through">{change.oldTrait}</span>
                              <span className="text-gray-600">→</span>
                              <span className="text-green-400 font-medium">{change.newTrait.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {Object.keys(selectedTraits).length > 0 && (
                      <div className="pt-2 mb-2" style={{ borderTop: '1px solid rgba(201,168,76,0.1)' }}>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-300 font-cinzel font-semibold uppercase tracking-wider">Forge Cost</span>
                          <span className="text-base font-cinzel font-bold text-yellow-400">
                            {getTotalPrice().displayText}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="mt-1">
                      {Object.keys(selectedTraits).length > 0 ? (
                        <button onClick={handlePurchaseStart} className="forge-button">
                          FORGE UPGRADE — {getTotalPrice().displayText}
                        </button>
                      ) : (
                        <div className="text-center text-gray-600 py-2 text-sm">
                          Select traits to begin forging
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showPurchaseFlow && selectedNFT && Object.keys(selectedTraits).length > 0 && (
        <EnhancedPurchaseFlow selectedNFT={selectedNFT} selectedTraits={selectedTraits} onSuccess={handlePurchaseSuccess} onCancel={handlePurchaseCancel} />
      )}
    </div>
  );
}
