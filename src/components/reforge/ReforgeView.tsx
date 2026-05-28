'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SelectedTrait, ReforgeResult } from '@/types/reforge';
import { ReforgeSpinner } from './ReforgeSpinner';
import { ReforgeProgress, buildReforgeStages } from './ReforgeProgress';

interface ReforgeViewProps {
  /** URL of the old NFT image (before reforge) */
  oldNftImage: string;
  /** Name of the old NFT */
  oldNftName: string;
  /** Pre-selected traits from server, ordered by layer order */
  selectedTraits: SelectedTrait[];
  /** Final composed image URL */
  imageUrl: string;
  /** Final metadata URL */
  metadataUrl: string;
  /** On-chain transaction signature */
  txSignature: string;
  /** Called when the entire reforge animation + metadata update completes */
  onComplete?: () => void;
}

type ReforgePhase =
  | 'spinning'       // Currently spinning through layers
  | 'image_upload'   // Image upload in progress
  | 'metadata_update' // Metadata update in progress
  | 'completed';     // All done

const SPIN_DURATION = 3000; // 3 seconds per layer
const PHASE_DELAY = 1500;   // Delay between phases for visual pacing
const ACCENTCOLOR = '#00BFFF';

export function ReforgeView({
  oldNftImage,
  oldNftName,
  selectedTraits,
  imageUrl,
  metadataUrl,
  txSignature,
  onComplete,
}: ReforgeViewProps) {
  const [phase, setPhase] = useState<ReforgePhase>('spinning');
  const [currentLayerIndex, setCurrentLayerIndex] = useState(0);
  const [revealedTraits, setRevealedTraits] = useState<SelectedTrait[]>([]);
  const [isSpinning, setIsSpinning] = useState(true);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const phaseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const totalLayers = selectedTraits.length;
  const slotNames = selectedTraits.map((t) => t.slotName);

  // Handle trait reveal after spinner completes
  const handleTraitRevealed = useCallback(
    (trait: SelectedTrait) => {
      setRevealedTraits((prev) => [...prev, trait]);
      setIsSpinning(false);

      // Move to next layer or next phase after a short delay
      phaseTimerRef.current = setTimeout(() => {
        const nextIndex = currentLayerIndex + 1;

        if (nextIndex < totalLayers) {
          // More layers to spin
          setCurrentLayerIndex(nextIndex);
          setCurrentStageIndex(nextIndex);
          setIsSpinning(true);
        } else {
          // All layers revealed, move to image upload phase
          setPhase('image_upload');
          setCurrentStageIndex(totalLayers); // image_upload stage index

          // Simulate image upload completion (already done server-side)
          phaseTimerRef.current = setTimeout(() => {
            setPhase('metadata_update');
            setCurrentStageIndex(totalLayers + 1); // metadata_update stage index

            // Simulate metadata update completion (already done server-side)
            phaseTimerRef.current = setTimeout(() => {
              setPhase('completed');
              setCurrentStageIndex(totalLayers + 2); // complete stage index
              setShowCompletionPopup(true);
              onComplete?.();
            }, PHASE_DELAY * 2);
          }, PHASE_DELAY);
        }
      }, 800);
    },
    [currentLayerIndex, totalLayers, onComplete]
  );

  // Start spinning on mount
  useEffect(() => {
    setIsSpinning(true);
    return () => {
      if (phaseTimerRef.current) {
        clearTimeout(phaseTimerRef.current);
      }
    };
  }, []);

  // Build available traits for the current layer's spinner
  // Use all traits from the same slot to show variety
  const currentTrait = selectedTraits[currentLayerIndex];
  const availableTraitsForSlot = selectedTraits.filter(
    (t) => t.slotId === currentTrait?.slotId
  );
  // If only one trait for this slot, duplicate with other traits for visual effect
  const spinnerTraits =
    availableTraitsForSlot.length > 2
      ? availableTraitsForSlot
      : selectedTraits.length > 0
      ? selectedTraits
      : [];

  const progressStages = buildReforgeStages(slotNames, currentStageIndex);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-8">
      {/* Top section: Old NFT (left) and Progressive Result (right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Old NFT */}
        <div className="flex flex-col items-center">
          <h3 className="text-sm uppercase tracking-wider text-gray-500 mb-3 font-cinzel">
            Original NFT
          </h3>
          <div
            className="relative w-full max-w-[280px] aspect-square rounded-xl overflow-hidden"
            style={{
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(10, 10, 20, 0.8)',
            }}
          >
            <img
              src={oldNftImage}
              alt={oldNftName}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://via.placeholder.com/280x280?text=${encodeURIComponent(oldNftName)}`;
              }}
            />
            {/* Dimming overlay to indicate "old" */}
            <div className="absolute inset-0 bg-black/20 pointer-events-none" />
          </div>
          <p className="text-gray-400 text-sm mt-2">{oldNftName}</p>
        </div>

        {/* Progressive Reforge Result */}
        <div className="flex flex-col items-center">
          <h3 className="text-sm uppercase tracking-wider text-gray-500 mb-3 font-cinzel">
            Reforged NFT
          </h3>
          <div
            className="relative w-full max-w-[280px] aspect-square rounded-xl overflow-hidden"
            style={{
              border: `1px solid ${ACCENTCOLOR}40`,
              background: 'rgba(10, 10, 20, 0.8)',
              boxShadow: `0 0 20px ${ACCENTCOLOR}20`,
            }}
          >
            {/* Layer-by-layer reveal: stack revealed trait images */}
            {revealedTraits.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-gray-600 text-sm text-center px-4">
                  Traits will appear here as they are revealed...
                </p>
              </div>
            )}
            {revealedTraits.map((trait, idx) => (
              <img
                key={`${trait.traitId}-${idx}`}
                src={trait.imageUrl}
                alt={trait.traitName}
                className="absolute inset-0 w-full h-full object-cover"
                style={{
                  zIndex: idx + 1,
                  animation: 'fadeIn 0.5s ease-out',
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ))}

            {/* Show final composed image once all layers are revealed */}
            {phase === 'completed' && (
              <img
                src={imageUrl}
                alt="Reforged NFT"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ zIndex: totalLayers + 1 }}
              />
            )}

            {/* Glow border animation while spinning */}
            {phase === 'spinning' && isSpinning && (
              <div
                className="absolute inset-0 pointer-events-none rounded-xl"
                style={{
                  boxShadow: `inset 0 0 30px ${ACCENTCOLOR}20`,
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              />
            )}
          </div>
          <p className="text-gray-400 text-sm mt-2">
            {revealedTraits.length}/{totalLayers} layers revealed
          </p>
        </div>
      </div>

      {/* Spinner section - only visible during spinning phase */}
      {phase === 'spinning' && currentTrait && (
        <div className="space-y-3">
          <h4 className="text-center text-sm text-gray-400">
            Revealing:{' '}
            <span style={{ color: ACCENTCOLOR }} className="font-semibold">
              {currentTrait.slotName}
            </span>
            <span className="text-gray-600 ml-2">
              (Layer {currentLayerIndex + 1}/{totalLayers})
            </span>
          </h4>
          <ReforgeSpinner
            availableTraits={spinnerTraits}
            selectedTrait={currentTrait}
            spinning={isSpinning}
            onReveal={handleTraitRevealed}
            duration={SPIN_DURATION}
            accentColor={ACCENTCOLOR}
          />
        </div>
      )}

      {/* Metadata update message (Task 19.5) */}
      {phase === 'metadata_update' && (
        <MetadataUpdateMessage accentColor={ACCENTCOLOR} />
      )}

      {/* Image upload message */}
      {phase === 'image_upload' && (
        <div className="text-center py-4">
          <div
            className="animate-spin rounded-full h-6 w-6 border-2 border-t-transparent mx-auto mb-2"
            style={{ borderColor: ACCENTCOLOR }}
          />
          <p className="text-gray-400 text-sm">Uploading composed image...</p>
        </div>
      )}

      {/* Progress bar (Task 19.2) */}
      <div className="pt-4 border-t border-white/[0.06]">
        <ReforgeProgress stages={progressStages} accentColor={ACCENTCOLOR} />
      </div>

      {/* Completion popup (Task 19.4) */}
      {showCompletionPopup && (
        <CompletionPopup
          imageUrl={imageUrl}
          txSignature={txSignature}
          selectedTraits={selectedTraits}
          accentColor={ACCENTCOLOR}
          onClose={() => setShowCompletionPopup(false)}
        />
      )}
    </div>
  );
}


/** Task 19.5: "metadata update in progress, do not refresh" message */
function MetadataUpdateMessage({ accentColor }: { accentColor: string }) {
  return (
    <div
      className="text-center py-6 px-4 rounded-xl mx-auto max-w-md"
      style={{
        background: 'rgba(10, 10, 20, 0.9)',
        border: `1px solid ${accentColor}30`,
        boxShadow: `0 0 20px ${accentColor}15`,
      }}
    >
      <div
        className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent mx-auto mb-3"
        style={{ borderColor: accentColor }}
      />
      <p className="text-white font-semibold text-sm mb-1">
        Metadata update in progress
      </p>
      <p
        className="text-xs font-medium"
        style={{ color: '#f59e0b' }}
      >
        ⚠️ Do not refresh this page
      </p>
      <p className="text-gray-500 text-xs mt-2">
        Your NFT&apos;s on-chain metadata is being updated. This may take a moment.
      </p>
    </div>
  );
}

/** Task 19.4: Completion popup with final NFT and tweet button */
function CompletionPopup({
  imageUrl,
  txSignature,
  selectedTraits,
  accentColor,
  onClose,
}: {
  imageUrl: string;
  txSignature: string;
  selectedTraits: SelectedTrait[];
  accentColor: string;
  onClose: () => void;
}) {
  const totalLdz = selectedTraits.reduce(
    (sum, t) => sum + (t.ldzEarning || 0),
    0
  );

  const tweetText = encodeURIComponent(
    `Just reforged my NFT! 🔥 New traits earning ${totalLdz} LDZ/day. #PVReforge #Solana`
  );
  const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.85)' }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(15, 15, 25, 0.98)',
          border: `1px solid ${accentColor}50`,
          boxShadow: `0 0 60px ${accentColor}30, 0 0 120px ${accentColor}10`,
          animation: 'fadeIn 0.4s ease-out',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center pt-6 pb-4 px-6">
          <div className="text-3xl mb-2">🎉</div>
          <h2
            className="text-xl font-cinzel font-bold"
            style={{ color: accentColor }}
          >
            Reforge Complete!
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Your NFT has been successfully reforged
          </p>
        </div>

        {/* Final NFT image */}
        <div className="px-6 pb-4">
          <div
            className="relative w-full aspect-square rounded-xl overflow-hidden mx-auto max-w-[280px]"
            style={{
              border: `2px solid ${accentColor}60`,
              boxShadow: `0 0 30px ${accentColor}30`,
            }}
          >
            <img
              src={imageUrl}
              alt="Reforged NFT"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Traits summary */}
        <div className="px-6 pb-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {selectedTraits.map((trait) => (
              <span
                key={trait.traitId}
                className="text-xs px-2 py-1 rounded-full"
                style={{
                  background: `${accentColor}15`,
                  color: accentColor,
                  border: `1px solid ${accentColor}30`,
                }}
              >
                {trait.slotName}: {trait.traitName}
              </span>
            ))}
          </div>
          {totalLdz > 0 && (
            <p className="text-center text-sm mt-3" style={{ color: accentColor }}>
              Total Earning: {totalLdz} LDZ/day
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-6 pb-6 space-y-3">
          {/* Tweet button */}
          <a
            href={tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 hover:opacity-90"
            style={{
              background: '#1DA1F2',
              color: '#fff',
            }}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
            </svg>
            Share on X (Twitter)
          </a>

          {/* View transaction */}
          {txSignature && (
            <a
              href={`https://solscan.io/tx/${txSignature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg text-sm font-medium transition-colors hover:bg-white/10"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#ccc',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              View Transaction on Solscan
            </a>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full py-3 px-4 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
