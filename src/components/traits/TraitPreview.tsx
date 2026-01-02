'use client';

import React, { useRef, useEffect, useState } from 'react';
import { CoreAsset, Trait, TraitSlot } from '@/types';
import { PreviewService, CanvasPreviewRenderer, TraitSelection, RuleViolation } from '@/lib/services/preview';

interface TraitPreviewProps {
  baseNFT: CoreAsset;
  selectedTraits: TraitSelection;
  slots: TraitSlot[];
  width?: number;
  height?: number;
  onValidationChange?: (isValid: boolean, violations: RuleViolation[]) => void;
}

export function TraitPreview({
  baseNFT,
  selectedTraits,
  slots,
  width = 512,
  height = 512,
  onValidationChange
}: TraitPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [violations, setViolations] = useState<RuleViolation[]>([]);

  const previewService = new PreviewService();

  useEffect(() => {
    renderPreview();
  }, [baseNFT, selectedTraits, slots, width, height]);

  const renderPreview = async () => {
    if (!canvasRef.current) return;

    setIsLoading(true);
    setError('');

    try {
      // Validate and order traits
      const previewResult = previewService.generatePreview(selectedTraits, slots);
      setViolations(previewResult.violations);
      
      // Notify parent of validation changes
      if (onValidationChange) {
        onValidationChange(previewResult.isValid, previewResult.violations);
      }

      // Render preview
      const renderer = new CanvasPreviewRenderer(canvasRef.current);
      const dataUrl = await renderer.renderPreview(
        baseNFT.image,
        previewResult.layeredTraits,
        width,
        height
      );
      
      setPreviewUrl(dataUrl);
    } catch (err) {
      console.error('Preview rendering error:', err);
      setError('Failed to render preview');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative">
      {/* Canvas (hidden, used for rendering) */}
      <canvas
        ref={canvasRef}
        className="hidden"
        width={width}
        height={height}
      />
      
      {/* Preview Display */}
      <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-center text-red-600">
              <p className="text-sm">{error}</p>
              <button
                onClick={renderPreview}
                className="mt-2 text-xs text-blue-600 hover:text-blue-700"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        
        {previewUrl && !isLoading && (
          <img
            src={previewUrl}
            alt="NFT Preview"
            className="w-full h-full object-cover"
          />
        )}
        
        {/* Validation Overlay */}
        {violations.length > 0 && (
          <div className="absolute inset-0 bg-red-500 bg-opacity-20 border-2 border-red-500 rounded-lg">
            <div className="absolute top-2 right-2">
              <div className="bg-red-500 text-white text-xs px-2 py-1 rounded">
                {violations.length} conflict{violations.length > 1 ? 's' : ''}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Validation Messages */}
      {violations.length > 0 && (
        <div className="mt-3 space-y-2">
          {violations.map((violation, index) => (
            <div
              key={index}
              className="flex items-start space-x-2 text-sm text-red-600 bg-red-50 p-2 rounded"
            >
              <div className="flex-shrink-0 mt-0.5">
                {violation.type === 'exclusion' ? '⚠️' : '❗'}
              </div>
              <div>{violation.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}