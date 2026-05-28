'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction } from '@solana/web3.js';
import { ReforgePack } from '@/types/reforge';

interface UserProfile {
  id: string;
  discordId: string;
  discordUsername: string;
  discordDisplayName?: string;
  discordAvatar?: string;
}

interface PurchaseModalProps {
  pack: ReforgePack;
  onClose: () => void;
  onSuccess?: (orderId: string) => void;
}

type PurchaseStep =
  | 'checking'
  | 'ready'
  | 'initiating'
  | 'signing'
  | 'confirming'
  | 'success'
  | 'error';

interface PurchaseState {
  step: PurchaseStep;
  orderId?: string;
  txSignature?: string;
  error?: string;
}

const tierConfig = {
  silver: {
    label: 'Silver Pack',
    gradient: 'linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 50%, #D4D4D4 100%)',
    glowColor: 'rgba(192, 192, 192, 0.3)',
    accentColor: '#C0C0C0',
  },
  gold: {
    label: 'Gold Pack',
    gradient: 'linear-gradient(135deg, #FFD700 0%, #DAA520 50%, #F5D060 100%)',
    glowColor: 'rgba(255, 215, 0, 0.3)',
    accentColor: '#FFD700',
  },
  diamond: {
    label: 'Diamond Pack',
    gradient: 'linear-gradient(135deg, #00BFFF 0%, #1E90FF 50%, #87CEEB 100%)',
    glowColor: 'rgba(0, 191, 255, 0.3)',
    accentColor: '#00BFFF',
  },
};

export function PurchaseModal({ pack, onClose, onSuccess }: PurchaseModalProps) {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [state, setState] = useState<PurchaseState>({ step: 'checking' });

  const config = tierConfig[pack.tierName] || tierConfig.silver;

  // Fetch Discord profile linked to the connected wallet
  const fetchProfile = useCallback(async () => {
    if (!publicKey) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    try {
      const res = await fetch(
        `/api/user/profile-by-wallet?wallet=${encodeURIComponent(publicKey.toBase58())}`
      );
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile || null);
      } else {
        setProfile(null);
      }
    } catch {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Update step based on wallet/profile state
  useEffect(() => {
    if (state.step === 'checking' || state.step === 'ready') {
      if (!profileLoading) {
        setState({ step: 'ready' });
      }
    }
  }, [profileLoading, connected, profile, state.step]);

  const isWalletConnected = connected && publicKey;
  const isDiscordLinked = profile !== null && profile.discordId !== undefined;
  const canPurchase = isWalletConnected && isDiscordLinked && signTransaction;

  const handlePurchase = async () => {
    if (!publicKey || !signTransaction || !profile) return;

    try {
      // Step 1: Initiate purchase
      setState({ step: 'initiating' });

      const initiateRes = await fetch('/api/reforge/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packId: pack.id,
          walletAddress: publicKey.toBase58(),
          discordId: profile.discordId,
        }),
      });

      if (!initiateRes.ok) {
        const errorData = await initiateRes.json();
        throw new Error(errorData.message || 'Failed to initiate purchase');
      }

      const { transaction: serializedTx, orderId } = await initiateRes.json();

      // Step 2: Sign the transaction
      setState({ step: 'signing', orderId });

      const transaction = Transaction.from(Buffer.from(serializedTx, 'base64'));
      const signedTx = await signTransaction(transaction);

      // Step 3: Submit signed transaction to Solana
      setState({ step: 'confirming', orderId });

      const txSignature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(txSignature, 'confirmed');
      if (confirmation.value.err) {
        throw new Error('Transaction failed on-chain');
      }

      // Step 4: Confirm purchase with backend
      const confirmRes = await fetch('/api/reforge/purchase/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          txSignature,
          packId: pack.id,
          walletAddress: publicKey.toBase58(),
          discordId: profile.discordId,
        }),
      });

      if (!confirmRes.ok) {
        const errorData = await confirmRes.json();
        throw new Error(errorData.message || 'Failed to confirm purchase');
      }

      setState({ step: 'success', orderId, txSignature });
      onSuccess?.(orderId);
    } catch (error: any) {
      console.error('Purchase error:', error);
      setState({
        step: 'error',
        error: error instanceof Error ? error.message : 'Purchase failed. Please try again.',
      });
    }
  };

  const canClose = state.step === 'ready' || state.step === 'checking' || state.step === 'error' || state.step === 'success';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div
        className="relative w-full max-w-md rounded-xl overflow-hidden"
        style={{
          background: 'rgba(15, 15, 25, 0.95)',
          border: `1px solid ${config.accentColor}40`,
          boxShadow: `0 0 40px ${config.glowColor}`,
        }}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-lg font-cinzel font-bold text-white tracking-wide">
            Purchase Pack
          </h2>
          {canClose && (
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white/80 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Pack Details */}
          <div
            className="rounded-lg p-4"
            style={{ background: `${config.accentColor}10`, border: `1px solid ${config.accentColor}30` }}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-sm font-cinzel font-bold uppercase tracking-wider"
                style={{ color: config.accentColor }}
              >
                {config.label}
              </span>
              <span
                className="text-lg font-bold"
                style={{
                  background: config.gradient,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {pack.solPrice} SOL
              </span>
            </div>
            <div className="text-sm text-gray-400">
              Earning Range:{' '}
              <span style={{ color: config.accentColor }}>
                {pack.minLdzEarning}–{pack.maxLdzEarning} LDZ/day
              </span>
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Remaining: {pack.remainingCount}/{pack.totalInventory}
            </div>
          </div>

          {/* Wallet Connection Check */}
          {!isWalletConnected && (
            <div className="rounded-lg p-4 bg-yellow-500/10 border border-yellow-500/30">
              <p className="text-yellow-400 text-sm mb-3 font-medium">
                Connect your Solana wallet to continue
              </p>
              <WalletMultiButton className="!bg-yellow-600 !rounded-lg !h-10 !text-sm !font-medium" />
            </div>
          )}

          {/* Discord Link Check */}
          {isWalletConnected && !profileLoading && !isDiscordLinked && (
            <div className="rounded-lg p-4 bg-violet-500/10 border border-violet-500/30">
              <p className="text-violet-400 text-sm mb-2 font-medium">
                Discord account not linked
              </p>
              <p className="text-gray-400 text-xs mb-3">
                You need to link your Discord account to this wallet before purchasing.
                Go to your profile to connect Discord and link your wallet.
              </p>
              <a
                href="/profile/login"
                className="inline-block px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium text-white transition-colors"
              >
                Link Discord Account
              </a>
            </div>
          )}

          {/* Loading state for profile check */}
          {isWalletConnected && profileLoading && (
            <div className="flex items-center gap-3 text-gray-400 text-sm">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent" />
              Checking Discord link...
            </div>
          )}

          {/* Ready state - Discord linked */}
          {isWalletConnected && isDiscordLinked && state.step === 'ready' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white">
                  {profile.discordUsername?.[0]?.toUpperCase() || 'D'}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">
                    {profile.discordDisplayName || profile.discordUsername}
                  </p>
                  <p className="text-gray-400 text-xs">Discord linked ✓</p>
                </div>
              </div>

              <button
                onClick={handlePurchase}
                disabled={!canPurchase}
                className="w-full py-3 px-6 rounded-lg font-cinzel font-bold text-sm uppercase tracking-wider transition-all duration-300 cursor-pointer hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: config.gradient,
                  color: '#0a0a0f',
                  boxShadow: `0 0 20px ${config.glowColor}`,
                }}
              >
                Confirm Purchase — {pack.solPrice} SOL
              </button>
            </div>
          )}

          {/* Processing states */}
          {state.step === 'initiating' && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent mx-auto mb-3" style={{ borderColor: config.accentColor }} />
              <p className="text-gray-300 text-sm">Preparing transaction...</p>
            </div>
          )}

          {state.step === 'signing' && (
            <div className="text-center py-4">
              <div className="animate-pulse mb-3">
                <svg className="w-10 h-10 mx-auto" style={{ color: config.accentColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
              </div>
              <p className="text-gray-300 text-sm">Please sign the transaction in your wallet</p>
              <p className="text-gray-500 text-xs mt-1">Check your wallet for the approval prompt</p>
            </div>
          )}

          {state.step === 'confirming' && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent mx-auto mb-3" style={{ borderColor: config.accentColor }} />
              <p className="text-gray-300 text-sm">Confirming transaction on-chain...</p>
              <p className="text-gray-500 text-xs mt-1">This may take a few seconds</p>
            </div>
          )}

          {/* Success state */}
          {state.step === 'success' && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-1">Purchase Successful!</h3>
              <p className="text-gray-400 text-sm mb-4">
                Your {config.label} has been purchased. You can start the reforge from your profile.
              </p>
              {state.txSignature && (
                <a
                  href={`https://explorer.solana.com/tx/${state.txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 underline"
                >
                  View transaction on Solana Explorer →
                </a>
              )}
              <button
                onClick={onClose}
                className="w-full mt-4 py-2.5 px-4 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {/* Error state */}
          {state.step === 'error' && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-1">Purchase Failed</h3>
              <p className="text-red-400 text-sm mb-4">{state.error}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setState({ step: 'ready' })}
                  className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: config.gradient, color: '#0a0a0f' }}
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
