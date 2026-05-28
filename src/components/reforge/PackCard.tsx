'use client';

import React from 'react';
import { ReforgePack } from '@/types/reforge';

interface PackCardProps {
  pack: ReforgePack;
  index: number;
  onPurchase?: (pack: ReforgePack) => void;
}

const tierConfig = {
  silver: {
    label: 'SILVER PACK',
    gradient: 'linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 50%, #D4D4D4 100%)',
    glowColor: 'rgba(192, 192, 192, 0.4)',
    glowColorIntense: 'rgba(192, 192, 192, 0.7)',
    borderColor: 'rgba(192, 192, 192, 0.5)',
    borderColorHover: 'rgba(192, 192, 192, 0.8)',
    textColor: '#E8E8E8',
    accentColor: '#C0C0C0',
    bgOverlay: 'rgba(192, 192, 192, 0.05)',
  },
  gold: {
    label: 'GOLD PACK',
    gradient: 'linear-gradient(135deg, #FFD700 0%, #DAA520 50%, #F5D060 100%)',
    glowColor: 'rgba(255, 215, 0, 0.4)',
    glowColorIntense: 'rgba(255, 215, 0, 0.7)',
    borderColor: 'rgba(255, 215, 0, 0.5)',
    borderColorHover: 'rgba(255, 215, 0, 0.8)',
    textColor: '#FFF3C4',
    accentColor: '#FFD700',
    bgOverlay: 'rgba(255, 215, 0, 0.05)',
  },
  diamond: {
    label: 'DIAMOND PACK',
    gradient: 'linear-gradient(135deg, #00BFFF 0%, #1E90FF 50%, #87CEEB 100%)',
    glowColor: 'rgba(0, 191, 255, 0.4)',
    glowColorIntense: 'rgba(0, 191, 255, 0.7)',
    borderColor: 'rgba(0, 191, 255, 0.5)',
    borderColorHover: 'rgba(0, 191, 255, 0.8)',
    textColor: '#B3E5FC',
    accentColor: '#00BFFF',
    bgOverlay: 'rgba(0, 191, 255, 0.05)',
  },
};

export function PackCard({ pack, index, onPurchase }: PackCardProps) {
  const config = tierConfig[pack.tierName] || tierConfig.silver;
  const isSoldOut = pack.remainingCount <= 0;
  const isDisabled = !pack.enabled;
  const isUnavailable = isSoldOut || isDisabled;

  const animationDelay = `${index * 150}ms`;

  return (
    <div
      className={`pack-card-entrance relative group rounded-xl overflow-hidden transition-all duration-300 ${
        isUnavailable ? 'opacity-50 saturate-[0.3]' : 'hover:scale-[1.03]'
      }`}
      style={{
        animationDelay,
        background: 'rgba(15, 15, 25, 0.9)',
        border: `1px solid ${isUnavailable ? 'rgba(100, 100, 100, 0.3)' : config.borderColor}`,
        boxShadow: isUnavailable
          ? 'none'
          : `0 0 20px ${config.glowColor}, inset 0 0 20px ${config.bgOverlay}`,
      }}
    >
      {/* Circular glow effect behind the card */}
      {!isUnavailable && (
        <div
          className="absolute inset-0 rounded-xl opacity-60 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 30%, ${config.glowColor} 0%, transparent 60%)`,
          }}
        />
      )}

      {/* Hover glow intensification */}
      {!isUnavailable && (
        <div
          className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            boxShadow: `0 0 40px ${config.glowColorIntense}, 0 0 80px ${config.glowColor}`,
          }}
        />
      )}

      {/* Card content */}
      <div className="relative z-10 p-6 flex flex-col items-center text-center">
        {/* Tier icon / emblem */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110"
          style={{
            background: isUnavailable
              ? 'rgba(100, 100, 100, 0.2)'
              : config.bgOverlay,
            border: `2px solid ${isUnavailable ? 'rgba(100, 100, 100, 0.3)' : config.borderColor}`,
            boxShadow: isUnavailable
              ? 'none'
              : `0 0 30px ${config.glowColor}, inset 0 0 15px ${config.bgOverlay}`,
          }}
        >
          <span
            className="text-2xl font-bold font-cinzel"
            style={{
              background: isUnavailable ? 'rgba(100, 100, 100, 0.5)' : config.gradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {pack.tierName === 'silver' ? '◈' : pack.tierName === 'gold' ? '◆' : '◇'}
          </span>
        </div>

        {/* Tier name */}
        <h3
          className="text-lg font-cinzel font-bold tracking-widest uppercase mb-2"
          style={{
            color: isUnavailable ? '#666' : config.textColor,
          }}
        >
          {config.label}
        </h3>

        {/* SOL Price */}
        <div
          className="text-2xl font-bold mb-3"
          style={{
            background: isUnavailable ? 'none' : config.gradient,
            WebkitBackgroundClip: isUnavailable ? undefined : 'text',
            WebkitTextFillColor: isUnavailable ? '#666' : 'transparent',
            backgroundClip: isUnavailable ? undefined : 'text',
            color: isUnavailable ? '#666' : undefined,
          }}
        >
          {pack.solPrice} SOL
        </div>

        {/* LDZ earning range */}
        <div className="text-sm text-gray-400 mb-2">
          <span className="text-xs uppercase tracking-wider text-gray-500">Earning Range</span>
          <div
            className="font-semibold mt-0.5"
            style={{ color: isUnavailable ? '#555' : config.accentColor }}
          >
            {pack.minLdzEarning}–{pack.maxLdzEarning} LDZ/day
          </div>
        </div>

        {/* Remaining count */}
        <div className="text-sm mb-4">
          <span className="text-xs uppercase tracking-wider text-gray-500">Remaining</span>
          <div
            className="font-semibold mt-0.5"
            style={{ color: isUnavailable ? '#555' : config.textColor }}
          >
            {isSoldOut ? (
              <span className="text-red-400">SOLD OUT</span>
            ) : (
              `${pack.remainingCount}/${pack.totalInventory}`
            )}
          </div>
        </div>

        {/* Purchase button */}
        <button
          onClick={() => !isUnavailable && onPurchase?.(pack)}
          disabled={isUnavailable}
          className={`w-full py-3 px-6 rounded-lg font-cinzel font-bold text-sm uppercase tracking-wider transition-all duration-300 ${
            isUnavailable
              ? 'cursor-not-allowed bg-gray-800/50 text-gray-600 border border-gray-700/50'
              : 'cursor-pointer hover:shadow-lg'
          }`}
          style={
            isUnavailable
              ? {}
              : {
                  background: config.gradient,
                  color: '#0a0a0f',
                  border: `1px solid ${config.borderColor}`,
                  boxShadow: `0 0 15px ${config.glowColor}`,
                }
          }
        >
          {isSoldOut ? 'SOLD OUT' : isDisabled ? 'UNAVAILABLE' : 'PURCHASE'}
        </button>
      </div>
    </div>
  );
}
