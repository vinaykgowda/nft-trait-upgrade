'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { CoreAsset, Trait, TraitSlot, Project } from '@/types';
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
  const [purchaseSuccess, setPurchaseSuccess] = useState<{
    txSignature: string;
    updatedImageUrl: string;
  } | null>(null);

  useEffect(() => {
    if (connected) {
      fetchData();
    }
  }, [connected]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch project config, traits and slots in parallel
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

      // Handle project data (might be wrapped in API response format)
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
    setSelectedTraits(prev => {
      const updated = { ...prev };
      if (trait) {
        // Replace any existing trait for this slot
        updated[slotId] = trait;
      } else {
        // Remove trait for this slot
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
      
      // Get current trait from NFT attributes
      const currentAttribute = selectedNFT.attributes?.find(
        attr => attr.trait_type?.toLowerCase() === slotName.toLowerCase()
      );
      
      return {
        slotName,
        oldTrait: currentAttribute?.value || 'None',
        newTrait
      };
    });
  };

  const getTotalPrice = () => {
    const traits = Object.values(selectedTraits);
    
    // Calculate totals by token type
    let solTotal = 0;
    let ldzTotal = 0;
    
    traits.forEach(trait => {
      const amount = Number(trait.priceAmount);
      
      if (trait.priceToken.symbol === 'SOL') {
        solTotal += amount;
      } else if (trait.priceToken.symbol === 'LDZ') {
        ldzTotal += amount;
      }
    });

    // Return appropriate display based on what tokens are present
    if (solTotal > 0 && ldzTotal > 0) {
      // Mixed payment - return both amounts separately
      return {
        isMixed: true,
        ldzAmount: ldzTotal,
        solAmount: solTotal,
        displayText: `${ldzTotal} LDZ + ${solTotal} SOL`
      };
    } else if (ldzTotal > 0) {
      // LDZ only
      return {
        isMixed: false,
        amount: ldzTotal,
        symbol: 'LDZ',
        displayText: `${ldzTotal} LDZ`
      };
    } else if (solTotal > 0) {
      // SOL only
      return {
        isMixed: false,
        amount: solTotal,
        symbol: 'SOL',
        displayText: `${solTotal} SOL`
      };
    } else {
      // No traits selected
      return {
        isMixed: false,
        amount: 0,
        symbol: 'SOL',
        displayText: '0 SOL'
      };
    }
  };

  const handlePurchaseStart = () => {
    if (Object.keys(selectedTraits).length > 0 && selectedNFT) {
      setShowPurchaseFlow(true);
    }
  };

  const handlePurchaseSuccess = (txSignature: string, updatedImageUrl?: string) => {
    setPurchaseSuccess({
      txSignature,
      updatedImageUrl: updatedImageUrl || selectedNFT?.image || ''
    });
    setShowPurchaseFlow(false);
    setSelectedTraits({});
  };

  const handlePurchaseCancel = () => {
    setShowPurchaseFlow(false);
  };

  const handleTweet = () => {
    if (!purchaseSuccess || !selectedNFT) return;
    
    const tweetText = `Just updated my ${selectedNFT.name} NFT with new traits! 🎨✨ #NFT #Solana`;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(tweetUrl, '_blank');
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Connect Your Wallet
          </h2>
          <p className="text-gray-600">
            Connect your Solana wallet to access the trait marketplace
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="text-blue-600 hover:text-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Success Modal */}
        {purchaseSuccess && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
              <div className="text-center">
                <div className="mb-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    NFT Updated Successfully!
                  </h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Your NFT has been updated with new traits and metadata
                  </p>
                </div>

                {/* Updated NFT Image */}
                <div className="mb-6">
                  <img
                    src={purchaseSuccess.updatedImageUrl}
                    alt="Updated NFT"
                    className="w-32 h-32 object-cover rounded-lg mx-auto border-2 border-green-200"
                  />
                </div>

                {/* Transaction Info */}
                <div className="mb-6 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Transaction ID:</p>
                  <p className="text-sm font-mono text-gray-700 break-all">
                    {purchaseSuccess.txSignature}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <button
                    onClick={handleTweet}
                    className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Tweet About It
                  </button>
                  <button
                    onClick={() => setPurchaseSuccess(null)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-screen max-h-screen">
          
          {/* Left Column - NFT Gallery */}
          <div className="bg-white rounded-lg shadow-sm p-6 overflow-hidden flex flex-col">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Your NFTs
            </h2>
            <div className="flex-1 overflow-y-auto">
              <NFTGallery
                collectionIds={collectionIds}
                onNFTSelect={handleNFTSelect}
                selectedNFT={selectedNFT || undefined}
              />
            </div>
          </div>

          {/* Center Column - Available Traits */}
          <div className="bg-white rounded-lg shadow-sm p-6 overflow-hidden flex flex-col">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Available Traits
            </h2>
            
            {!selectedNFT ? (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                {collectionIds.length === 0 ? (
                  <div className="text-center">
                    <p>No collections configured</p>
                    <p className="text-sm mt-2">Admin needs to configure collection IDs</p>
                  </div>
                ) : (
                  <p>Select an NFT to view available traits</p>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-6">
                {slots.map(slot => {
                  const slotTraits = getTraitsForSlot(slot.id);
                  if (slotTraits.length === 0) return null;

                  return (
                    <div key={slot.id} className="border-b pb-4 last:border-b-0">
                      <h3 className="font-medium text-gray-900 mb-3">
                        {slot.name}
                        {selectedTraits[slot.id] && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            Selected
                          </span>
                        )}
                        {selectedTraits[slot.id] && (
                          <button
                            onClick={() => handleTraitSelect(slot.id, null)}
                            className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                          >
                            Remove
                          </button>
                        )}
                      </h3>
                      
                      <div className="grid grid-cols-2 gap-2">
                        {slotTraits.map(trait => {
                          const isSelected = selectedTraits[slot.id]?.id === trait.id;
                          const isAvailable = !trait.totalSupply || (trait.remainingSupply && trait.remainingSupply > 0);
                          
                          return (
                            <div
                              key={trait.id}
                              className={`relative border rounded-lg p-2 cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-50'
                                  : isAvailable
                                  ? 'border-gray-200 hover:border-gray-300'
                                  : 'border-gray-100 opacity-50 cursor-not-allowed'
                              }`}
                              onClick={() => isAvailable && handleTraitSelect(slot.id, trait)}
                            >
                              <div className="aspect-square mb-2 bg-gray-100 rounded overflow-hidden">
                                <img
                                  src={trait.imageLayerUrl}
                                  alt={trait.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              
                              <div className="text-xs">
                                <div className="font-medium text-gray-900 truncate">
                                  {trait.name}
                                </div>
                                <div className="text-gray-500">
                                  {trait.rarityTier.name}
                                </div>
                                <div className="text-gray-900 font-medium">
                                  {formatDecimalPrice(trait.priceAmount.toString())} {trait.priceToken.symbol}
                                </div>
                                {trait.totalSupply && (
                                  <div className="text-gray-500">
                                    {trait.remainingSupply}/{trait.totalSupply} left
                                  </div>
                                )}
                              </div>
                              
                              {isSelected && (
                                <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">
                                  ✓
                                </div>
                              )}
                              
                              {!isAvailable && (
                                <div className="absolute inset-0 bg-gray-500 bg-opacity-50 rounded-lg flex items-center justify-center">
                                  <span className="text-white text-xs font-medium">Sold Out</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column - Preview & Purchase */}
          <div className="bg-white rounded-lg shadow-sm p-6 overflow-hidden flex flex-col">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Preview & Purchase
            </h2>
            
            {!selectedNFT ? (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                {collectionIds.length === 0 ? (
                  <div className="text-center">
                    <p>No collections configured</p>
                    <p className="text-sm mt-2">Admin needs to configure collection IDs</p>
                  </div>
                ) : (
                  <p>Select an NFT to see preview</p>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col space-y-4">
                {/* Preview Images */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Original */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Original</h4>
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={selectedNFT.image}
                        alt={selectedNFT.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  {/* With Traits */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">With Traits</h4>
                    <LivePreview
                      baseNFT={selectedNFT}
                      selectedTraits={selectedTraits}
                      slots={slots}
                    />
                  </div>
                </div>

                {/* Trait Changes */}
                {getTraitChanges().length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Changes</h4>
                    <div className="space-y-2">
                      {getTraitChanges().map((change, index) => (
                        <div key={index} className="text-sm">
                          <span className="font-medium">{change.slotName}:</span>
                          <div className="ml-2 text-gray-600">
                            <span className="line-through">{change.oldTrait}</span>
                            <span className="mx-2">→</span>
                            <span className="text-green-600 font-medium">{change.newTrait.name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pricing */}
                {Object.keys(selectedTraits).length > 0 && (
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Total ({Object.keys(selectedTraits).length} trait{Object.keys(selectedTraits).length > 1 ? 's' : ''})
                      </span>
                      <span className="text-lg font-bold text-gray-900">
                        {getTotalPrice().displayText}
                      </span>
                    </div>
                    
                    <div className="space-y-1">
                      {Object.values(selectedTraits).map(trait => (
                        <div key={trait.id} className="flex justify-between text-xs text-gray-600">
                          <span>{trait.name}</span>
                          <span>{formatDecimalPrice(trait.priceAmount.toString())} {trait.priceToken.symbol}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Purchase Button */}
                <div className="mt-auto pt-4">
                  {Object.keys(selectedTraits).length > 0 ? (
                    <button
                      onClick={handlePurchaseStart}
                      className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                      Update NFT - {getTotalPrice().displayText}
                    </button>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <p>Select traits to see pricing</p>
                    </div>
                  )}
                </div>
              </div>
            )}
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