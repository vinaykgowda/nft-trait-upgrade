'use client';

import React, { useState, useEffect } from 'react';
import { CoreAsset, TraitSlot } from '@/types';
import { TraitSelection } from '@/lib/services/preview';

interface LivePreviewProps {
  baseNFT: CoreAsset;
  selectedTraits: TraitSelection;
  slots: TraitSlot[];
}

export function LivePreview({ baseNFT, selectedTraits, slots }: LivePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string>(baseNFT.image);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [traitDetails, setTraitDetails] = useState<any[]>([]);

  console.log('🎨 LivePreview v2.0 mounted with NFT:', baseNFT.name, 'Address:', baseNFT.address);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      generateNFTPreview();
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [selectedTraits, baseNFT.address]);

  const generateNFTPreview = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('🔄 Generating NFT preview for:', baseNFT.address, 'with traits:', Object.keys(selectedTraits));

      const response = await fetch('/api/nft-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nftAddress: baseNFT.address,
          selectedTraits: Object.keys(selectedTraits).length > 0 ? selectedTraits : null
        })
      });

      console.log('🔍 NFT Preview API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ NFT Preview API error:', errorText);
        throw new Error(`Failed to generate NFT preview: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ NFT Preview API result:', result);
      
      if (result.success) {
        console.log('✅ Setting preview URL, length:', result.previewUrl?.length);
        setPreviewUrl(result.previewUrl);
        setTraitDetails(result.traitDetails || []);
        console.log('🎨 Preview updated with:', {
          mappedTraits: result.mappedTraits,
          traitDetails: result.traitDetails,
          previewUrlLength: result.previewUrl?.length,
          previewUrlStart: result.previewUrl?.substring(0, 50)
        });
      } else {
        throw new Error(result.error || 'NFT preview generation failed');
      }
    } catch (err) {
      console.error('NFT Preview error:', err);
      setError('Failed to generate preview');
      setPreviewUrl(baseNFT.image); // Fallback to original
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
              <p className="text-sm">Composing NFT...</p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="absolute top-2 left-2 right-2 bg-red-100 border border-red-300 rounded px-2 py-1 text-xs text-red-700 z-10">
            {error}
          </div>
        )}
        
        <img
          key={previewUrl} // Force re-render when URL changes
          src={previewUrl}
          alt="NFT Preview"
          className="w-full h-full object-cover"
          onLoad={() => console.log('🖼️ Image loaded successfully! Preview size:', previewUrl.length, 'bytes')}
          onError={(e) => {
            console.error('❌ Image failed to load. Preview size:', previewUrl.length, 'bytes', e);
            setPreviewUrl(baseNFT.image);
            setError('Preview failed, showing original');
          }}
        />
      </div>

      {/* Trait composition details (for debugging) */}
      {traitDetails.length > 0 && process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500 space-y-1">
          <p className="font-medium">Composed Traits:</p>
          {traitDetails.map((detail, index) => (
            <div key={index} className="flex justify-between">
              <span>{detail.slotName}:</span>
              <span className={detail.isNew ? 'text-green-600 font-medium' : ''}>
                {detail.traitName} {detail.isNew && '(NEW)'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}