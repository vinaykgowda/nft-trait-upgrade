'use client';

import React, { useState, useEffect } from 'react';
import { Trait, TraitSlot } from '@/types';
import { TraitSelection } from '@/lib/services/preview';
import { formatDecimalPrice } from '@/lib/utils';

interface TraitSelectorProps {
  slots: TraitSlot[];
  selectedTraits: TraitSelection;
  onTraitSelect: (slotId: string, trait: Trait | null) => void;
  disabled?: boolean;
}

export function TraitSelector({
  slots,
  selectedTraits,
  onTraitSelect,
  disabled = false
}: TraitSelectorProps) {
  const [traits, setTraits] = useState<Trait[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [activeSlot, setActiveSlot] = useState<string>('');

  useEffect(() => {
    fetchTraits();
  }, []);

  const fetchTraits = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/traits?active=1');
      if (!response.ok) {
        throw new Error('Failed to fetch traits');
      }
      const result = await response.json();
      setTraits(result.data || []);
    } catch (err) {
      console.error('Error fetching traits:', err);
      setError('Failed to load traits');
    } finally {
      setLoading(false);
    }
  };

  const getTraitsForSlot = (slotId: string): Trait[] => {
    return traits.filter(trait => trait.slotId === slotId);
  };

  const handleTraitSelect = (slotId: string, trait: Trait | null) => {
    if (disabled) return;
    onTraitSelect(slotId, trait);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={fetchTraits}
          className="text-blue-600 hover:text-blue-700 text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b pb-4">
        {Array.isArray(slots) && slots.map(slot => {
          const slotTraits = getTraitsForSlot(slot.id);
          if (slotTraits.length === 0) return null;
          
          return (
            <button
              key={slot.id}
              onClick={() => setActiveSlot(activeSlot === slot.id ? '' : slot.id)}
              className={`px-3 py-2 text-sm rounded-md transition-colors ${
                activeSlot === slot.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {slot.name}
              {selectedTraits[slot.id] && (
                <span className="ml-1 text-xs">✓</span>
              )}
            </button>
          );
        })}
      </div>

      {activeSlot && Array.isArray(slots) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">
              {slots.find(s => s.id === activeSlot)?.name} Traits
            </h3>
            {selectedTraits[activeSlot] && (
              <button
                onClick={() => handleTraitSelect(activeSlot, null)}
                className="text-sm text-red-600 hover:text-red-700"
                disabled={disabled}
              >
                Remove
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {getTraitsForSlot(activeSlot).map(trait => {
              const isSelected = selectedTraits[activeSlot]?.id === trait.id;
              const isAvailable = !trait.totalSupply || (trait.remainingSupply && trait.remainingSupply > 0);
              
              return (
                <div
                  key={trait.id}
                  className={`relative border rounded-lg p-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : isAvailable
                      ? 'border-gray-200 hover:border-gray-300'
                      : 'border-gray-100 opacity-50 cursor-not-allowed'
                  }`}
                  onClick={() => isAvailable && handleTraitSelect(activeSlot, trait)}
                >
                  <div className="aspect-square mb-2 bg-gray-100 rounded overflow-hidden">
                    <img
                      src={trait.imageLayerUrl}
                      alt={trait.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  <div className="text-sm">
                    <div className="font-medium text-gray-900 truncate">
                      {trait.name}
                    </div>
                    <div className="text-gray-500 text-xs">
                      {trait.rarityTier.name}
                    </div>
                    <div className="text-gray-900 font-medium">
                      {formatDecimalPrice(trait.priceAmount.toString())} {trait.priceToken.symbol}
                    </div>
                    {trait.totalSupply && (
                      <div className="text-xs text-gray-500">
                        {trait.remainingSupply}/{trait.totalSupply} left
                      </div>
                    )}
                  </div>
                  
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
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
      )}
    </div>
  );
}