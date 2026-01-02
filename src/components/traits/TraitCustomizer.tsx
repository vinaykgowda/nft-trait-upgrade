'use client';

import React, { useState, useEffect } from 'react';
import { CoreAsset, Trait, TraitSlot } from '@/types';
import { TraitSelection, RuleViolation } from '@/lib/services/preview';
import { TraitPreview } from './TraitPreview';
import { TraitSelector } from './TraitSelector';
import { formatDecimalPrice } from '@/lib/utils';

interface TraitCustomizerProps {
  selectedNFT: CoreAsset;
  onPurchaseReady?: (traits: TraitSelection, isValid: boolean) => void;
}

export function TraitCustomizer({ selectedNFT, onPurchaseReady }: TraitCustomizerProps) {
  const [slots, setSlots] = useState<TraitSlot[]>([]);
  const [selectedTraits, setSelectedTraits] = useState<TraitSelection>({});
  const [isValid, setIsValid] = useState(true);
  const [violations, setViolations] = useState<RuleViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchSlots();
  }, []);

  useEffect(() => {
    if (onPurchaseReady) {
      onPurchaseReady(selectedTraits, isValid);
    }
  }, [selectedTraits, isValid, onPurchaseReady]);

  const fetchSlots = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/trait-slots');
      if (!response.ok) {
        throw new Error('Failed to fetch trait slots');
      }
      const result = await response.json();
      setSlots(result.data || []);
    } catch (err) {
      console.error('Error fetching slots:', err);
      setError('Failed to load trait slots');
    } finally {
      setLoading(false);
    }
  };

  const handleTraitSelect = (slotId: string, trait: Trait | null) => {
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

  const handleValidationChange = (valid: boolean, ruleViolations: RuleViolation[]) => {
    setIsValid(valid);
    setViolations(ruleViolations);
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
      // Mixed payment
      return `${ldzTotal} LDZ + ${solTotal} SOL`;
    } else if (ldzTotal > 0) {
      // LDZ only
      return `${ldzTotal} LDZ`;
    } else if (solTotal > 0) {
      // SOL only
      return `${solTotal} SOL`;
    } else {
      // No traits selected
      return '0 SOL';
    }
  };

  const getSelectedTraitCount = () => {
    return Object.keys(selectedTraits).length;
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
          onClick={fetchSlots}
          className="text-blue-600 hover:text-blue-700 text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Preview Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Original NFT */}
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

          {/* Preview with Traits */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              With Traits {!isValid && <span className="text-red-600">(Invalid)</span>}
            </h4>
            <TraitPreview
              baseNFT={selectedNFT}
              selectedTraits={selectedTraits}
              slots={slots}
              onValidationChange={handleValidationChange}
            />
          </div>
        </div>

        {/* Selection Summary */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Selected Traits: {getSelectedTraitCount()}
            </span>
            <span className="text-sm font-medium text-gray-900">
              Total: {getTotalPrice()}
            </span>
          </div>
          
          {getSelectedTraitCount() > 0 && (
            <div className="space-y-1">
              {Object.values(selectedTraits).map(trait => (
                <div key={trait.id} className="flex justify-between text-xs text-gray-600">
                  <span>{trait.name}</span>
                  <span>{formatDecimalPrice(trait.priceAmount.toString())} {trait.priceToken.symbol}</span>
                </div>
              ))}
            </div>
          )}

          {!isValid && (
            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-700 font-medium mb-1">
                Cannot proceed with purchase:
              </p>
              <ul className="text-xs text-red-600 space-y-1">
                {violations.map((violation, index) => (
                  <li key={index}>• {violation.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Trait Selection */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Traits</h3>
        <TraitSelector
          slots={slots}
          selectedTraits={selectedTraits}
          onTraitSelect={handleTraitSelect}
          disabled={!isValid && getSelectedTraitCount() > 0}
        />
      </div>

      {/* Purchase Button */}
      {getSelectedTraitCount() > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-center text-sm text-gray-600">
            Purchase button will appear in the main interface
          </div>
        </div>
      )}
    </div>
  );
}