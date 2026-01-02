'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { CoreAsset, Trait } from '@/types';
import { TraitSelection } from '@/lib/services/preview';
import { formatDecimalPrice } from '@/lib/utils';

interface PurchaseFlowProps {
  selectedNFT: CoreAsset;
  selectedTraits: TraitSelection;
  onSuccess?: (txSignature: string, updatedImageUrl?: string) => void;
  onCancel?: () => void;
}

type PurchaseStep = 'confirm' | 'reserving' | 'building' | 'signing' | 'confirming' | 'composing' | 'uploading' | 'updating' | 'success' | 'error';

interface PurchaseState {
  step: PurchaseStep;
  reservationId?: string;
  txSignature?: string;
  updatedImageUrl?: string;
  error?: string;
  progress: number;
}

export function PurchaseFlow({ selectedNFT, selectedTraits, onSuccess, onCancel }: PurchaseFlowProps) {
  const { publicKey, signTransaction } = useWallet();
  const [state, setState] = useState<PurchaseState>({
    step: 'confirm',
    progress: 0
  });

  const traits = Object.values(selectedTraits);
  const totalPrice = traits.reduce((sum, trait) => sum + Number(trait.priceAmount), 0);
  const traitCount = traits.length;

  const updateState = (updates: Partial<PurchaseState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const handlePurchase = async () => {
    if (!publicKey || !signTransaction) {
      updateState({ step: 'error', error: 'Wallet not connected' });
      return;
    }

    try {
      // Step 1: Reserve traits
      updateState({ step: 'reserving', progress: 20 });
      const reservationResponse = await fetch('/api/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          assetId: selectedNFT.address,
          traitIds: traits.map(t => t.id)
        })
      });

      if (!reservationResponse.ok) {
        const error = await reservationResponse.json();
        throw new Error(error.message || 'Failed to reserve traits');
      }

      const { reservationId } = await reservationResponse.json();
      updateState({ reservationId, progress: 40 });

      // Step 2: Build transaction
      updateState({ step: 'building', progress: 50 });
      
      // Calculate payment details
      const traits = Object.values(selectedTraits);
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
      
      // Determine primary payment token
      let paymentToken: 'SOL' | 'LDZ';
      let totalAmount: number;
      
      if (ldzTotal > 0) {
        paymentToken = 'LDZ';
        totalAmount = ldzTotal;
      } else {
        paymentToken = 'SOL';
        totalAmount = solTotal;
      }
      
      const buildResponse = await fetch('/api/tx/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId,
          walletAddress: publicKey.toString(),
          assetId: selectedNFT.address,
          paymentToken,
          totalAmount,
          transactionType: 'payment'
        })
      });

      if (!buildResponse.ok) {
        const error = await buildResponse.json();
        throw new Error(error.message || 'Failed to build transaction');
      }

      const { transaction: serializedTx } = await buildResponse.json();
      updateState({ progress: 60 });

      // Step 3: Sign transaction
      updateState({ step: 'signing', progress: 70 });
      
      // Deserialize and sign transaction
      const { Transaction } = await import('@solana/web3.js');
      const transaction = Transaction.from(Buffer.from(serializedTx, 'base64'));
      const signedTx = await signTransaction(transaction);
      updateState({ progress: 80 });

      // Step 4: Confirm transaction
      updateState({ step: 'confirming', progress: 85 });
      const confirmResponse = await fetch('/api/tx/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId,
          signedTransaction: Buffer.from(signedTx.serialize()).toString('base64')
        })
      });

      if (!confirmResponse.ok) {
        const error = await confirmResponse.json();
        throw new Error(error.message || 'Failed to confirm transaction');
      }

      const { txSignature } = await confirmResponse.json();
      updateState({ 
        txSignature, 
        progress: 90 
      });

      // Step 5: Compose new image with traits
      updateState({ step: 'composing', progress: 92 });
      const composeResponse = await fetch('/api/compose-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseImageUrl: selectedNFT.image,
          selectedTraits: Object.values(selectedTraits),
          assetId: selectedNFT.address
        })
      });

      if (!composeResponse.ok) {
        console.warn('Image composition failed, continuing without updated image');
      }

      // Step 6: Upload to Irys
      updateState({ step: 'uploading', progress: 95 });
      let updatedImageUrl = selectedNFT.image; // fallback to original

      if (composeResponse.ok) {
        const { imageBuffer } = await composeResponse.json();
        
        const uploadResponse = await fetch('/api/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBuffer,
            assetId: selectedNFT.address,
            traits: Object.values(selectedTraits)
          })
        });

        if (uploadResponse.ok) {
          const { imageUrl } = await uploadResponse.json();
          updatedImageUrl = imageUrl;
        }
      }

      // Step 7: Update NFT metadata
      updateState({ step: 'updating', progress: 98 });
      const updateResponse = await fetch('/api/update-nft-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: selectedNFT.address,
          newImageUrl: updatedImageUrl,
          newTraits: Object.values(selectedTraits),
          txSignature
        })
      });

      if (!updateResponse.ok) {
        console.warn('Metadata update failed, but transaction was successful');
      }

      updateState({ 
        step: 'success', 
        updatedImageUrl,
        progress: 100 
      });

      if (onSuccess) {
        onSuccess(txSignature, updatedImageUrl);
      }

    } catch (error) {
      console.error('Purchase error:', error);
      updateState({ 
        step: 'error', 
        error: error instanceof Error ? error.message : 'Purchase failed' 
      });
    }
  };

  const getStepMessage = () => {
    switch (state.step) {
      case 'confirm':
        return 'Review your purchase';
      case 'reserving':
        return 'Reserving traits...';
      case 'building':
        return 'Building transaction...';
      case 'signing':
        return 'Please sign the transaction in your wallet';
      case 'confirming':
        return 'Confirming transaction...';
      case 'composing':
        return 'Composing new NFT image...';
      case 'uploading':
        return 'Uploading to Irys...';
      case 'updating':
        return 'Updating NFT metadata...';
      case 'success':
        return 'Purchase successful!';
      case 'error':
        return 'Purchase failed';
      default:
        return '';
    }
  };

  const canCancel = state.step === 'confirm' || state.step === 'error';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">
              {state.step === 'success' ? 'Purchase Complete' : 'Purchase Traits'}
            </h2>
            {canCancel && onCancel && (
              <button
                onClick={onCancel}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Progress Bar */}
          {state.step !== 'confirm' && state.step !== 'error' && (
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>{getStepMessage()}</span>
                <span>{state.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Step Content */}
          {state.step === 'confirm' && (
            <div className="space-y-6">
              {/* NFT Info */}
              <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <img
                  src={selectedNFT.image}
                  alt={selectedNFT.name}
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <div>
                  <h3 className="font-medium text-gray-900">{selectedNFT.name}</h3>
                  <p className="text-sm text-gray-600">
                    {selectedNFT.address.slice(0, 8)}...{selectedNFT.address.slice(-8)}
                  </p>
                </div>
              </div>

              {/* Traits List */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">
                  Selected Traits ({traitCount})
                </h4>
                <div className="space-y-2">
                  {traits.map(trait => (
                    <div key={trait.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <img
                          src={trait.imageLayerUrl}
                          alt={trait.name}
                          className="w-10 h-10 rounded object-cover"
                        />
                        <div>
                          <p className="font-medium text-gray-900">{trait.name}</p>
                          <p className="text-sm text-gray-600">Slot ID: {trait.slotId}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          {formatDecimalPrice(trait.priceAmount.toString())} {trait.priceToken.symbol}
                        </p>
                        {trait.rarityTier && (
                          <p className="text-sm text-gray-600">{trait.rarityTier.name}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Total</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {totalPrice} SOL
                  </span>
                </div>
              </div>

              {/* Purchase Button */}
              <button
                onClick={handlePurchase}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Purchase for {totalPrice} SOL
              </button>
            </div>
          )}

          {/* Processing States */}
          {['reserving', 'building', 'signing', 'confirming', 'composing', 'uploading', 'updating'].includes(state.step) && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">{getStepMessage()}</p>
              {state.step === 'signing' && (
                <p className="text-sm text-gray-500 mt-2">
                  Check your wallet for the transaction approval
                </p>
              )}
            </div>
          )}

          {/* Success State */}
          {state.step === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Traits Applied Successfully!
              </h3>
              <p className="text-gray-600 mb-4">
                Your NFT has been updated with {traitCount} new trait{traitCount > 1 ? 's' : ''}.
              </p>
              
              {state.txSignature && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-600 mb-2">Transaction Signature:</p>
                  <p className="text-xs font-mono text-gray-800 break-all">
                    {state.txSignature}
                  </p>
                  <a
                    href={`https://explorer.solana.com/tx/${state.txSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 text-sm mt-2 inline-block"
                  >
                    View on Solana Explorer →
                  </a>
                </div>
              )}

              <button
                onClick={onCancel}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {/* Error State */}
          {state.step === 'error' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Purchase Failed
              </h3>
              <p className="text-red-600 mb-4">
                {state.error}
              </p>
              
              <div className="space-y-2">
                <button
                  onClick={handlePurchase}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
                {onCancel && (
                  <button
                    onClick={onCancel}
                    className="w-full bg-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}