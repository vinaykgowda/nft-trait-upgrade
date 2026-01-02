'use client';

import React, { useState, useEffect } from 'react';
import { Trait, TraitSlot, RarityTier } from '@/types';
import { formatDecimalPrice } from '@/lib/utils';

interface TraitBrowserProps {
  className?: string;
}

interface FilterState {
  slotId?: string;
  rarityTierId?: string;
  priceRange?: 'all' | 'free' | 'low' | 'medium' | 'high';
}

export function TraitBrowser({ className = '' }: TraitBrowserProps) {
  const [traits, setTraits] = useState<Trait[]>([]);
  const [slots, setSlots] = useState<TraitSlot[]>([]);
  const [rarityTiers, setRarityTiers] = useState<RarityTier[]>([]);
  const [filters, setFilters] = useState<FilterState>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    Promise.all([
      fetchTraits(),
      fetchSlots(),
      fetchRarityTiers()
    ]);
  }, []);

  useEffect(() => {
    fetchTraits();
  }, [filters]);

  const fetchTraits = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.slotId) params.append('slotId', filters.slotId);
      if (filters.rarityTierId) params.append('rarityTierId', filters.rarityTierId);
      params.append('active', 'true');

      const response = await fetch(`/api/traits?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch traits');
      }
      
      let response_data = await response.json();
      
      // Handle both paginated and simple array responses
      const traitsArray = Array.isArray(response_data) 
        ? response_data 
        : (response_data.data || response_data.traits || []);
      
      // Apply price range filter
      let filteredTraits = traitsArray;
      if (filters.priceRange && filters.priceRange !== 'all') {
        filteredTraits = traitsArray.filter((trait: Trait) => {
          const price = Number(trait.priceAmount);
          switch (filters.priceRange) {
            case 'free':
              return price === 0;
            case 'low':
              return price > 0 && price <= 0.1;
            case 'medium':
              return price > 0.1 && price <= 1;
            case 'high':
              return price > 1;
            default:
              return true;
          }
        });
      }
      
      setTraits(filteredTraits);
    } catch (err) {
      console.error('Error fetching traits:', err);
      setError('Failed to load traits');
      setTraits([]); // Ensure traits is always an array
    } finally {
      setLoading(false);
    }
  };

  const fetchSlots = async () => {
    try {
      const response = await fetch('/api/trait-slots');
      if (response.ok) {
        const data = await response.json();
        // Handle both paginated and simple array responses
        const slotsArray = Array.isArray(data) 
          ? data 
          : (data.data || data.slots || []);
        setSlots(slotsArray);
      }
    } catch (err) {
      console.error('Error fetching slots:', err);
      setSlots([]); // Ensure slots is always an array
    }
  };

  const fetchRarityTiers = async () => {
    try {
      // This would need to be implemented in the API
      // For now, we'll derive from traits
      const uniqueRarities = new Set<string>();
      traits.forEach(trait => {
        if (trait.rarityTier) {
          uniqueRarities.add(trait.rarityTier.name);
        }
      });
      // Convert to proper structure when API is available
    } catch (err) {
      console.error('Error fetching rarity tiers:', err);
    }
  };

  const handleFilterChange = (key: keyof FilterState, value: string | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === 'all' ? undefined : value
    }));
  };

  const getTraitsBySlot = () => {
    const grouped: Record<string, Trait[]> = {};
    
    // Ensure both traits and slots are arrays before processing
    if (!Array.isArray(traits)) {
      console.warn('Traits is not an array:', traits);
      return grouped;
    }
    
    if (!Array.isArray(slots)) {
      console.warn('Slots is not an array:', slots);
      return grouped;
    }
    
    traits.forEach(trait => {
      // Find the slot name from the slots array using slotId
      const slot = slots.find(s => s.id === trait.slotId);
      const slotName = slot?.name || 'Other';
      if (!grouped[slotName]) {
        grouped[slotName] = [];
      }
      grouped[slotName].push(trait);
    });
    return grouped;
  };

  const getRarityColor = (rarityName: string) => {
    switch (rarityName.toLowerCase()) {
      case 'common':
        return 'bg-gray-100 text-gray-800';
      case 'rare':
        return 'bg-blue-100 text-blue-800';
      case 'epic':
        return 'bg-purple-100 text-purple-800';
      case 'legendary':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className}`}>
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => fetchTraits()}
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const groupedTraits = getTraitsBySlot();

  return (
    <div className={`${className}`}>
      {/* Filters */}
      <div className="mb-8 bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Browse Traits</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Slot Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trait Slot
            </label>
            <select
              value={filters.slotId || 'all'}
              onChange={(e) => handleFilterChange('slotId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Slots</option>
              {slots.map(slot => (
                <option key={slot.id} value={slot.id}>
                  {slot.name}
                </option>
              ))}
            </select>
          </div>

          {/* Price Range Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price Range
            </label>
            <select
              value={filters.priceRange || 'all'}
              onChange={(e) => handleFilterChange('priceRange', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Prices</option>
              <option value="free">Free</option>
              <option value="low">0.01 - 0.1 SOL</option>
              <option value="medium">0.1 - 1 SOL</option>
              <option value="high">1+ SOL</option>
            </select>
          </div>

          {/* Results Count */}
          <div className="flex items-end">
            <div className="text-sm text-gray-600">
              {traits.length} trait{traits.length !== 1 ? 's' : ''} found
            </div>
          </div>
        </div>
      </div>

      {/* Traits Grid */}
      {Object.keys(groupedTraits).length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <p className="text-gray-500">No traits found matching your filters</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedTraits).map(([slotName, slotTraits]) => (
            <div key={slotName} className="bg-white rounded-lg shadow-sm p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                {slotName} ({slotTraits.length})
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {slotTraits.map(trait => (
                  <div
                    key={trait.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    {/* Trait Image */}
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-3">
                      <img
                        src={trait.imageLayerUrl}
                        alt={trait.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/placeholder-trait.png';
                        }}
                      />
                    </div>

                    {/* Trait Info */}
                    <div className="space-y-2">
                      <h5 className="font-medium text-gray-900 truncate">
                        {trait.name}
                      </h5>
                      
                      {/* Rarity Badge */}
                      {trait.rarityTier && (
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getRarityColor(trait.rarityTier.name)}`}>
                          {trait.rarityTier.name}
                        </span>
                      )}

                      {/* Price */}
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-900">
                          {formatDecimalPrice(trait.priceAmount.toString())} {trait.priceToken.symbol}
                        </span>
                        
                        {/* Supply Info */}
                        {trait.totalSupply && (
                          <span className="text-xs text-gray-500">
                            {trait.remainingSupply}/{trait.totalSupply} left
                          </span>
                        )}
                      </div>

                      {/* Availability Status */}
                      <div className="text-xs">
                        {trait.remainingSupply === 0 ? (
                          <span className="text-red-600">Sold Out</span>
                        ) : trait.totalSupply && trait.remainingSupply && trait.remainingSupply <= 5 ? (
                          <span className="text-orange-600">Low Stock</span>
                        ) : (
                          <span className="text-green-600">Available</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}