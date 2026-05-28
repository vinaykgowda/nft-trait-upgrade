'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SelectedTrait } from '@/types/reforge';

interface ReforgeSpinnerProps {
  /** All available traits for the current layer/slot being spun */
  availableTraits: SelectedTrait[];
  /** The pre-selected winning trait (determined server-side) */
  selectedTrait: SelectedTrait;
  /** Whether the spinner should be actively spinning */
  spinning: boolean;
  /** Called when the spin animation completes and the trait is revealed */
  onReveal?: (trait: SelectedTrait) => void;
  /** Duration of the spin animation in ms (default 3000) */
  duration?: number;
  /** Accent color for glow effects */
  accentColor?: string;
}

const ITEM_HEIGHT = 80;
const VISIBLE_ITEMS = 5;
const SPIN_DURATION = 3000;

export function ReforgeSpinner({
  availableTraits,
  selectedTrait,
  spinning,
  onReveal,
  duration = SPIN_DURATION,
  accentColor = '#00BFFF',
}: ReforgeSpinnerProps) {
  const [revealed, setRevealed] = useState(false);
  const [offset, setOffset] = useState(0);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build a long list of traits to scroll through (repeat to create seamless loop)
  const spinItems = useCallback(() => {
    if (availableTraits.length === 0) return [];
    const items: SelectedTrait[] = [];
    // Create enough items for a smooth spin (at least 30 items)
    const repeatCount = Math.max(30, Math.ceil(60 / availableTraits.length));
    for (let i = 0; i < repeatCount; i++) {
      // Shuffle each batch for visual variety
      const shuffled = [...availableTraits].sort(() => Math.random() - 0.5);
      items.push(...shuffled);
    }
    // Ensure the selected trait is at the final position
    items.push(selectedTrait);
    return items;
  }, [availableTraits, selectedTrait]);

  const [items, setItems] = useState<SelectedTrait[]>([]);

  useEffect(() => {
    if (spinning) {
      setRevealed(false);
      setItems(spinItems());
    }
  }, [spinning, spinItems]);

  useEffect(() => {
    if (!spinning || items.length === 0) return;

    const totalDistance = (items.length - Math.floor(VISIBLE_ITEMS / 2) - 1) * ITEM_HEIGHT;
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Easing: cubic ease-out for deceleration effect
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentOffset = eased * totalDistance;

      setOffset(currentOffset);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete - reveal the trait
        setRevealed(true);
        onReveal?.(selectedTrait);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [spinning, items, duration, selectedTrait, onReveal]);

  // Reset when not spinning
  useEffect(() => {
    if (!spinning) {
      setOffset(0);
    }
  }, [spinning]);

  const containerHeight = VISIBLE_ITEMS * ITEM_HEIGHT;

  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* Spinner container */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl"
        style={{
          height: `${containerHeight}px`,
          background: 'rgba(10, 10, 20, 0.9)',
          border: `1px solid ${accentColor}40`,
          boxShadow: spinning
            ? `0 0 30px ${accentColor}30, inset 0 0 20px rgba(0,0,0,0.5)`
            : `0 0 10px ${accentColor}15`,
        }}
      >
        {/* Top fade gradient */}
        <div
          className="absolute top-0 left-0 right-0 z-10 pointer-events-none"
          style={{
            height: `${ITEM_HEIGHT * 1.5}px`,
            background: 'linear-gradient(to bottom, rgba(10, 10, 20, 0.95) 0%, transparent 100%)',
          }}
        />

        {/* Bottom fade gradient */}
        <div
          className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none"
          style={{
            height: `${ITEM_HEIGHT * 1.5}px`,
            background: 'linear-gradient(to top, rgba(10, 10, 20, 0.95) 0%, transparent 100%)',
          }}
        />

        {/* Center highlight line */}
        <div
          className="absolute left-0 right-0 z-20 pointer-events-none"
          style={{
            top: `${Math.floor(VISIBLE_ITEMS / 2) * ITEM_HEIGHT}px`,
            height: `${ITEM_HEIGHT}px`,
            borderTop: `2px solid ${accentColor}80`,
            borderBottom: `2px solid ${accentColor}80`,
            background: `${accentColor}10`,
            boxShadow: `0 0 20px ${accentColor}20`,
          }}
        />

        {/* Scrolling items */}
        <div
          className="absolute left-0 right-0 transition-none"
          style={{
            transform: `translateY(-${offset}px)`,
          }}
        >
          {items.map((trait, idx) => (
            <SpinnerItem
              key={`${trait.traitId}-${idx}`}
              trait={trait}
              height={ITEM_HEIGHT}
              isCenter={revealed && idx === items.length - 1}
              accentColor={accentColor}
            />
          ))}
        </div>
      </div>

      {/* Revealed trait label */}
      {revealed && (
        <div
          className="mt-3 text-center animate-fade-in"
          style={{ animation: 'fadeIn 0.5s ease-out' }}
        >
          <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">
            {selectedTrait.slotName}
          </p>
          <p
            className="text-lg font-cinzel font-bold"
            style={{ color: accentColor }}
          >
            {selectedTrait.traitName}
          </p>
        </div>
      )}
    </div>
  );
}

function SpinnerItem({
  trait,
  height,
  isCenter,
  accentColor,
}: {
  trait: SelectedTrait;
  height: number;
  isCenter: boolean;
  accentColor: string;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 transition-all duration-200"
      style={{
        height: `${height}px`,
        background: isCenter ? `${accentColor}15` : 'transparent',
        transform: isCenter ? 'scale(1.05)' : 'scale(1)',
      }}
    >
      {/* Trait image thumbnail */}
      <div
        className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0"
        style={{
          border: isCenter ? `2px solid ${accentColor}` : '1px solid rgba(255,255,255,0.1)',
          boxShadow: isCenter ? `0 0 12px ${accentColor}50` : 'none',
        }}
      >
        <img
          src={trait.imageUrl}
          alt={trait.traitName}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://via.placeholder.com/56x56?text=${encodeURIComponent(trait.traitName.charAt(0))}`;
          }}
        />
      </div>

      {/* Trait name */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium truncate ${isCenter ? 'text-white' : 'text-gray-400'}`}
        >
          {trait.traitName}
        </p>
        <p className="text-xs text-gray-600 truncate">{trait.slotName}</p>
      </div>

      {/* LDZ earning badge */}
      {trait.ldzEarning > 0 && (
        <span
          className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
          style={{
            background: isCenter ? `${accentColor}20` : 'rgba(255,255,255,0.05)',
            color: isCenter ? accentColor : '#888',
          }}
        >
          +{trait.ldzEarning}
        </span>
      )}
    </div>
  );
}
