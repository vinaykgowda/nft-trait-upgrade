'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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

interface UserProfile {
  id: string;
  discordId: string;
  discordUsername: string;
  discordDisplayName?: string;
  discordAvatar?: string;
  discordServers?: { id: string; name: string; icon?: string }[];
}

interface LinkedWallet {
  id: string;
  walletAddress: string;
  label?: string;
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
  const { connected, publicKey } = useWallet();
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

  // Profile state
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [hasDiscordSession, setHasDiscordSession] = useState(false);
  const [linkedWallets, setLinkedWallets] = useState<LinkedWallet[]>([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const tabsRef = useRef<HTMLDivElement>(null);
  const traitsRowRef = useRef<HTMLDivElement>(null);

  // Close profile menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-fetch profile when wallet connects or user is logged in
  const fetchProfile = useCallback(async (walletAddress?: string) => {
    setProfileLoading(true);
    try {
      // First try session-based lookup (user already logged in via Discord)
      const sessionRes = await fetch('/api/user/profile');
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        if (sessionData.profile) {
          setUserProfile(sessionData.profile);
          setHasDiscordSession(true);
          setLinkedWallets(sessionData.wallets || []);
          setProfileLoading(false);
          return;
        }
      }

      // Fallback: try wallet-based lookup
      if (walletAddress) {
        const res = await fetch(`/api/user/profile-by-wallet?wallet=${walletAddress}`);
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            setUserProfile(data.profile);
            setHasDiscordSession(false);
            setLinkedWallets(data.wallets || []);
            return;
          }
        }
      }

      setUserProfile(null);
      setHasDiscordSession(false);
      setLinkedWallets([]);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connected && publicKey) {
      fetchProfile(publicKey.toString());
    } else {
      // Still check session even without wallet (user might be logged in)
      fetchProfile();
    }
  }, [connected, publicKey, fetchProfile]);

  const handleDiscordConnect = () => {
    // Store the current wallet address in a cookie so the callback can auto-link it
    if (publicKey) {
      document.cookie = `pending-link-wallet=${publicKey.toString()};path=/;max-age=300;samesite=lax`;
    }
    const returnUrl = window.location.href;
    window.location.href = `/api/auth/discord?returnUrl=${encodeURIComponent(returnUrl)}`;
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (slots.length > 0 && !activeSlotId) setActiveSlotId(slots[0].id); }, [slots, activeSlotId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [projectRes, traitsRes, slotsRes] = await Promise.all([
        fetch('/api/project'), 
        fetch('/api/traits'), // Remove ?active=1 to get ALL traits
        fetch('/api/trait-slots')
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

  const handleTraitSelect = async (slotId: string, trait: Trait | null) => {
    if (trait && selectedNFT?.attributes) {
      const slot = slots.find(s => s.id === slotId);
      const slotName = slot?.name || '';
      const cur = selectedNFT.attributes.find(a => 
        a.trait_type && slotName && a.trait_type.toLowerCase() === slotName.toLowerCase()
      );
      
      // Check for duplicate
      if (cur && cur.value && trait.name && cur.value.toLowerCase() === trait.name.toLowerCase()) {
        setDuplicateWarning(`Your NFT already has "${trait.name}" as its ${slotName}. Pick a different one!`);
        setTimeout(() => setDuplicateWarning(null), 4000);
        return;
      }

      // Check for conflicts with NFT's current traits
      try {
        console.log('=== CONFLICT CHECK START ===');
        console.log('Selected trait:', trait.name, 'ID:', trait.id);
        console.log('NFT attributes:', selectedNFT.attributes);
        
        // Get trait IDs from NFT's current attributes by matching trait names
        const nftTraitIds: string[] = [];
        for (const attr of selectedNFT.attributes) {
          if (!attr.value || !attr.trait_type) continue;
          
          console.log(`Trying to match NFT attribute: ${attr.trait_type} = ${attr.value}`);
          
          const matchingTrait = traits.find(t => {
            if (!t.name || !t.slotId) {
              return false;
            }
            const slotMatch = slots.find(s => 
              s.name && attr.trait_type && s.name.toLowerCase() === attr.trait_type.toLowerCase()
            );
            if (!slotMatch) {
              console.log(`  No slot match for ${attr.trait_type}`);
              return false;
            }
            const nameMatch = t.name.toLowerCase() === attr.value.toLowerCase();
            const slotIdMatch = t.slotId === slotMatch.id;
            console.log(`  Checking trait: ${t.name} (slotId: ${t.slotId}, slot: ${slotMatch.name}), nameMatch: ${nameMatch}, slotIdMatch: ${slotIdMatch}`);
            return nameMatch && slotIdMatch;
          });
          
          if (matchingTrait) {
            console.log('Found matching trait:', matchingTrait.name, 'ID:', matchingTrait.id);
            nftTraitIds.push(matchingTrait.id);
          } else {
            console.log(`  No matching trait found for ${attr.trait_type} = ${attr.value}`);
          }
        }

        console.log('NFT trait IDs:', nftTraitIds);

        // Only check conflicts if we have trait IDs
        if (nftTraitIds.length > 0) {
          console.log('Checking conflicts for trait:', trait.id, 'against:', nftTraitIds);
          const conflictResponse = await fetch('/api/traits/check-conflict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ traitId: trait.id, nftTraitIds })
          });

          console.log('Conflict response status:', conflictResponse.status);
          if (conflictResponse.ok) {
            const conflictData = await conflictResponse.json();
            console.log('Conflict data:', conflictData);
            if (conflictData.hasConflict) {
              console.log('CONFLICT DETECTED!');
              setDuplicateWarning(
                `⚠️ Conflict detected! "${trait.name}" cannot be applied because your NFT has "${conflictData.conflictingTrait.name}" (${conflictData.conflictingTrait.slotName}). These traits are incompatible.`
              );
              setTimeout(() => setDuplicateWarning(null), 6000);
              return;
            } else {
              console.log('No conflict found');
            }
          }
        } else {
          console.log('No NFT trait IDs found, skipping conflict check');
        }
        console.log('=== CONFLICT CHECK END ===');
      } catch (error) {
        console.error('Error checking trait conflict:', error);
        // Continue anyway if conflict check fails
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
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-cover bg-center bg-fixed" style={{ backgroundImage: "url('/bg.webp')", backgroundColor: '#0a0a0f' }}>
      <div className="min-h-screen lg:h-screen lg:overflow-hidden" style={{ background: 'rgba(5, 5, 10, 0.75)' }}>

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

        {/* TOP BAR: Logo left, Profile + Wallet right */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2">
          <img src="/logo.webp" alt="Pepeverse Trait Forge" className="h-14 sm:h-16 object-contain drop-shadow-2xl" />
          <div className="flex items-center gap-2">
            {/* Profile section - shows after wallet connects */}
            {connected && (
              <div className="relative" ref={profileMenuRef}>
                {userProfile && hasDiscordSession ? (
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg transition"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {profileLoading ? (
                      <div className="w-7 h-7 rounded-full bg-white/10 animate-pulse" />
                    ) : userProfile.discordAvatar ? (
                      <img src={userProfile.discordAvatar} alt="" className="w-7 h-7 rounded-full" />
                    ) : (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: 'rgba(139,92,246,0.5)', color: '#fff' }}>
                        {userProfile.discordUsername[0].toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm text-white/70 hidden sm:inline">
                      {userProfile.discordDisplayName || userProfile.discordUsername}
                    </span>
                    <svg className="w-3.5 h-3.5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={handleDiscordConnect}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition"
                    style={{ background: '#5865F2', color: '#fff' }}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
                    </svg>
                    <span className="hidden sm:inline">Connect Discord</span>
                  </button>
                )}

                {/* Profile Dropdown - only when logged in */}
                {showProfileMenu && userProfile && hasDiscordSession && (
                  <div className="absolute right-0 top-full mt-2 w-72 rounded-xl overflow-hidden shadow-2xl z-50"
                    style={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <>
                        {/* Profile header */}
                        <div className="p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="flex items-center gap-3">
                            {userProfile.discordAvatar ? (
                              <img src={userProfile.discordAvatar} alt="" className="w-10 h-10 rounded-full" />
                            ) : (
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                                style={{ background: 'rgba(139,92,246,0.5)', color: '#fff' }}>
                                {userProfile.discordUsername[0].toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-white text-sm font-medium truncate">
                                {userProfile.discordDisplayName || userProfile.discordUsername}
                              </p>
                              <p className="text-white/40 text-xs truncate">@{userProfile.discordUsername}</p>
                            </div>
                          </div>
                        </div>

                        {/* Menu items */}
                        <div className="py-1">
                          <a href="/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:bg-white/[0.04] transition">
                            <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            My Profile
                          </a>
                        </div>
                      </>
                  </div>
                )}
              </div>
            )}
            <WalletMultiButton />
          </div>
        </div>

        {/* MAIN 2-COLUMN LAYOUT */}
        <div className="flex flex-col lg:flex-row p-2 sm:p-3 gap-3 lg:h-[calc(100vh-80px)]">

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
                                {trait.earnerToken && trait.earnerAmount && (
                                  <span className="absolute top-1.5 right-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                                    {trait.earnerAmount} ${trait.earnerToken.symbol}
                                  </span>
                                )}
                                {isSelected && !trait.earnerToken && (
                                  <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: 'rgba(201,168,76,0.9)', color: '#0a0a0f' }}>✓</div>
                                )}
                                {isSelected && trait.earnerToken && (
                                  <div className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: 'rgba(201,168,76,0.9)', color: '#0a0a0f' }}>✓</div>
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
