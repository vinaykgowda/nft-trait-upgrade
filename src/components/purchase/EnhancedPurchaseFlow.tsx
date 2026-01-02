'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { CoreAsset, Trait } from '@/types';
import { TraitSelection } from '@/lib/services/preview';
import { formatDecimalPrice } from '@/lib/utils';

interface EnhancedPurchaseFlowProps {
  selectedNFT: CoreAsset;
  selectedTraits: TraitSelection;
  onSuccess?: (txSignature: string, updatedImageUrl?: string) => void;
  onCancel?: () => void;
}

type PurchaseStep = 
  | 'confirm' 
  | 'payment_approved' 
  | 'payment_validating' 
  | 'payment_validated' 
  | 'metadata_updating' 
  | 'metadata_updated' 
  | 'success' 
  | 'error';

interface PurchaseState {
  step: PurchaseStep;
  reservationId?: string;
  txSignature?: string;
  updatedImageUrl?: string;
  error?: string;
  progress: number;
  paymentToken: 'SOL' | 'LDZ';
  totalAmount: number;
  secondaryToken?: 'SOL' | 'LDZ';
  secondaryAmount?: number;
}

export function EnhancedPurchaseFlow({ selectedNFT, selectedTraits, onSuccess, onCancel }: EnhancedPurchaseFlowProps) {
  const { publicKey, signTransaction } = useWallet();
  const [state, setState] = useState<PurchaseState>({
    step: 'confirm',
    progress: 0,
    paymentToken: 'SOL',
    totalAmount: 0
  });

  const traits = Object.values(selectedTraits);

  // Calculate total price and determine payment tokens
  const calculatePayment = () => {
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

    // Handle different payment scenarios
    if (solTotal > 0 && ldzTotal > 0) {
      // Mixed payment - prioritize the token with higher count of traits
      const solTraits = traits.filter(t => t.priceToken.symbol === 'SOL').length;
      const ldzTraits = traits.filter(t => t.priceToken.symbol === 'LDZ').length;
      
      if (ldzTraits >= solTraits) {
        return { token: 'LDZ' as const, amount: ldzTotal, hasMultipleTokens: true, secondaryAmount: solTotal, secondaryToken: 'SOL' as const };
      } else {
        return { token: 'SOL' as const, amount: solTotal, hasMultipleTokens: true, secondaryAmount: ldzTotal, secondaryToken: 'LDZ' as const };
      }
    } else if (ldzTotal > 0) {
      return { token: 'LDZ' as const, amount: ldzTotal, hasMultipleTokens: false };
    } else {
      return { token: 'SOL' as const, amount: solTotal, hasMultipleTokens: false };
    }
  };

  const paymentInfo = calculatePayment();

  const updateState = (updates: Partial<PurchaseState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const handlePurchase = async () => {
    if (!publicKey || !signTransaction) {
      updateState({ step: 'error', error: 'Wallet not connected' });
      return;
    }

    try {
      // Step 1: Payment Approved
      updateState({ 
        step: 'payment_approved', 
        progress: 10,
        paymentToken: paymentInfo.token,
        totalAmount: paymentInfo.amount,
        secondaryToken: paymentInfo.secondaryToken,
        secondaryAmount: paymentInfo.secondaryAmount
      });

      // Reserve traits first
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

      const reservationResult = await reservationResponse.json();
      const reservationId = reservationResult.data?.reservations?.[0]?.id || reservationResult.reservationId;
      
      if (!reservationId) {
        throw new Error('No reservation ID returned from server');
      }
      
      updateState({ reservationId });

      // Step 2: Payment Validating
      updateState({ step: 'payment_validating', progress: 25 });

      // Build payment-only transaction
      const buildResponse = await fetch('/api/tx/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId,
          walletAddress: publicKey.toString(),
          assetId: selectedNFT.address,
          paymentToken: paymentInfo.token,
          totalAmount: paymentInfo.amount,
          transactionType: 'payment'
        })
      });

      if (!buildResponse.ok) {
        const error = await buildResponse.json();
        console.error('❌ Build transaction failed:', {
          status: buildResponse.status,
          error,
          requestData: {
            reservationId,
            walletAddress: publicKey.toString(),
            assetId: selectedNFT.address,
            paymentToken: paymentInfo.token,
            totalAmount: paymentInfo.amount,
            transactionType: 'payment'
          }
        });
        throw new Error(error.message || 'Failed to build transaction');
      }

      const buildResult = await buildResponse.json();
      console.log('✅ Build response received:', buildResult);
      
      const serializedTx = buildResult.data?.transaction || buildResult.transaction;
      if (!serializedTx) {
        console.error('❌ No transaction data in response:', buildResult);
        throw new Error('No transaction data received from server');
      }

      console.log('📝 Transaction data received, length:', serializedTx.length);

      // Sign transaction
      const { Transaction } = await import('@solana/web3.js');
      const transaction = Transaction.from(Buffer.from(serializedTx, 'base64'));
      const signedTx = await signTransaction(transaction);

      // Submit transaction
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
        throw new Error(error.message || 'Payment validation failed');
      }

      const { txSignature } = await confirmResponse.json();
      updateState({ txSignature });

      // Step 3: Payment Validated
      updateState({ step: 'payment_validated', progress: 50 });
      
      // Wait a moment to show the validation step
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Step 4: Metadata Updating (after payment success)
      updateState({ step: 'metadata_updating', progress: 70 });

      console.log('💰 Payment successful! Starting image composition and metadata update...');

      // Compose new image with traits
      const composeResponse = await fetch('/api/compose-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseImageUrl: selectedNFT.image,
          selectedTraits: Object.values(selectedTraits),
          assetId: selectedNFT.address
        })
      });

      let newImageUrl = selectedNFT.image; // fallback to original
      if (composeResponse.ok) {
        const { imageBuffer } = await composeResponse.json();
        
        // Upload composed image to Irys
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
          newImageUrl = imageUrl;
          console.log('📸 Image uploaded to Irys:', imageUrl);
        }
      }

      updateState({ updatedImageUrl: newImageUrl });

      // Update NFT metadata with new image and traits
      const metadataResponse = await fetch('/api/tx/update-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          assetId: selectedNFT.address,
          newImageUrl: newImageUrl,
          newAttributes: Object.values(selectedTraits).map(trait => ({
            trait_type: trait.slotId, // Use slotId since slotName is not available
            value: trait.name
          })),
          txSignature: txSignature
        })
      });

      if (!metadataResponse.ok) {
        const error = await metadataResponse.json();
        throw new Error(error.message || 'Failed to update NFT metadata');
      }

      const metadataResult = await metadataResponse.json();
      console.log('🎨 Metadata updated successfully:', metadataResult.signature);

      // Step 5: Metadata Updated
      updateState({ 
        step: 'metadata_updated', 
        progress: 90
      });

      // Wait a moment to show the update step
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Step 6: Success
      updateState({ 
        step: 'success', 
        progress: 100 
      });

      if (onSuccess) {
        onSuccess(txSignature, state.updatedImageUrl);
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
      case 'payment_approved':
        return 'Payment approved.. validating..';
      case 'payment_validating':
        return 'Payment approved.. validating..';
      case 'payment_validated':
        return 'Payment validated.. uploading image to Irys..';
      case 'metadata_updating':
        return 'Image uploaded.. updating metadata..';
      case 'metadata_updated':
        return 'Metadata updated..';
      case 'success':
        return 'Congrats, your NFT Upgrade completed.';
      case 'error':
        return 'Purchase failed';
      default:
        return '';
    }
  };

  const isProcessing = ['payment_approved', 'payment_validating', 'payment_validated', 'metadata_updating', 'metadata_updated'].includes(state.step);
  const canCancel = state.step === 'confirm' || state.step === 'error';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      {/* Gray overlay for processing states */}
      {isProcessing && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-75 z-10" />
      )}
      
      <div className={`bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto relative z-20 ${isProcessing ? 'pointer-events-none' : ''}`}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">
              {state.step === 'success' ? 'NFT Upgrade Complete!' : 'Purchase Traits'}
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
          {/* Progress Bar for Processing States */}
          {isProcessing && (
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>{getStepMessage()}</span>
                <span>{state.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
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
                  Selected Traits ({traits.length})
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
                          <p className="text-sm text-gray-600">{trait.rarityTier?.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          {formatDecimalPrice(trait.priceAmount.toString())} {trait.priceToken.symbol}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Summary */}
              <div className="border-t border-gray-200 pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Payment Method</span>
                    <span className="font-medium text-gray-900">{paymentInfo.token}</span>
                  </div>
                  {paymentInfo.hasMultipleTokens ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Primary Payment</span>
                        <span className="font-medium text-gray-900">
                          {paymentInfo.amount} {paymentInfo.token}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Secondary Payment</span>
                        <span className="font-medium text-gray-900">
                          {paymentInfo.secondaryAmount} {paymentInfo.secondaryToken}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2">
                        <span className="text-lg font-semibold text-gray-900">Total</span>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-gray-900">
                            {paymentInfo.amount} {paymentInfo.token}
                          </div>
                          <div className="text-sm text-gray-600">
                            + {paymentInfo.secondaryAmount} {paymentInfo.secondaryToken}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-gray-900">Total</span>
                      <span className="text-lg font-semibold text-gray-900">
                        {paymentInfo.amount} {paymentInfo.token}
                      </span>
                    </div>
                  )}
                  {paymentInfo.hasMultipleTokens && (
                    <p className="text-sm text-amber-600">
                      Note: Mixed token payments will be processed in sequence
                    </p>
                  )}
                </div>
              </div>

              {/* Purchase Button */}
              <button
                onClick={handlePurchase}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                {paymentInfo.hasMultipleTokens 
                  ? `Purchase for ${paymentInfo.amount} ${paymentInfo.token} + ${paymentInfo.secondaryAmount} ${paymentInfo.secondaryToken}`
                  : `Purchase for ${paymentInfo.amount} ${paymentInfo.token}`
                }
              </button>
            </div>
          )}

          {/* Processing States */}
          {isProcessing && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-lg font-medium text-gray-900 mb-2">{getStepMessage()}</p>
              {state.step === 'payment_approved' && (
                <p className="text-sm text-gray-600">
                  Processing your {state.paymentToken} payment...
                  {state.secondaryToken && (
                    <span> and {state.secondaryToken} payment...</span>
                  )}
                </p>
              )}
              {state.step === 'payment_validating' && (
                <p className="text-sm text-gray-600">
                  Confirming {state.totalAmount} {state.paymentToken} payment on blockchain...
                  {state.secondaryToken && state.secondaryAmount && (
                    <span> and {state.secondaryAmount} {state.secondaryToken}...</span>
                  )}
                </p>
              )}
              {state.step === 'payment_validated' && (
                <p className="text-sm text-gray-600">
                  Payment confirmed! Starting image composition and upload to Irys...
                </p>
              )}
              {state.step === 'metadata_updating' && (
                <p className="text-sm text-gray-600">
                  Uploading composed image to Irys and updating NFT metadata...
                </p>
              )}
              {state.step === 'metadata_updated' && (
                <p className="text-sm text-gray-600">
                  Finalizing your NFT upgrade...
                </p>
              )}
            </div>
          )}

          {/* Success State */}
          {state.step === 'success' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                🎉 Congrats, your NFT Upgrade completed!
              </h3>
              
              {/* Show upgraded NFT image */}
              {state.updatedImageUrl && (
                <div className="mb-6">
                  <div className="relative inline-block">
                    <img
                      src={state.updatedImageUrl}
                      alt="Upgraded NFT"
                      className="w-48 h-48 rounded-lg object-cover mx-auto shadow-lg"
                    />
                    <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                      UPGRADED
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Your NFT has been successfully upgraded with {traits.length} new trait{traits.length > 1 ? 's' : ''}!
                  </p>
                </div>
              )}

              {/* Transaction Details */}
              {state.txSignature && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Payment:</span>
                      <div className="text-right">
                        <div className="font-medium">{state.totalAmount} {state.paymentToken}</div>
                        {state.secondaryToken && state.secondaryAmount && (
                          <div className="font-medium">+ {state.secondaryAmount} {state.secondaryToken}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Traits Applied:</span>
                      <span className="font-medium">{traits.length}</span>
                    </div>
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Transaction Signature:</p>
                      <p className="text-xs font-mono text-gray-800 break-all">
                        {state.txSignature}
                      </p>
                      <a
                        href={`https://explorer.solana.com/tx/${state.txSignature}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 text-xs mt-1 inline-block"
                      >
                        View on Solana Explorer →
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={onCancel}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Continue Shopping
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