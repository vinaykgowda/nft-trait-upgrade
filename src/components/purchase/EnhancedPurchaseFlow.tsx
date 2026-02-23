'use client';

import React, { useState } from 'react';
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

interface PaymentGroup {
  token: 'SOL' | 'LDZ';
  amount: number;
  traits: Trait[];
}

export function EnhancedPurchaseFlow({ selectedNFT, selectedTraits, onSuccess, onCancel }: EnhancedPurchaseFlowProps) {
  const { publicKey, signTransaction } = useWallet();
  const [state, setState] = useState<PurchaseState>({
    step: 'confirm', progress: 0, paymentToken: 'SOL', totalAmount: 0
  });

  const traits = Object.values(selectedTraits);

  // Group traits by payment token
  const getPaymentGroups = (): PaymentGroup[] => {
    const groups: Record<string, PaymentGroup> = {};
    traits.forEach(trait => {
      const sym = trait.priceToken.symbol;
      if (!groups[sym]) groups[sym] = { token: sym as 'SOL' | 'LDZ', amount: 0, traits: [] };
      groups[sym].amount += Number(trait.priceAmount);
      groups[sym].traits.push(trait);
    });
    return Object.values(groups);
  };

  const paymentGroups = getPaymentGroups();
  const isMixed = paymentGroups.length > 1;
  const totalDisplay = paymentGroups.map(g => `${g.amount} ${g.token}`).join(' + ');

  const updateState = (updates: Partial<PurchaseState>) => setState(prev => ({ ...prev, ...updates }));

  // Build, sign, and confirm a single payment transaction
  const processPayment = async (reservationId: string, token: 'SOL' | 'LDZ', amount: number): Promise<string> => {
    if (!publicKey || !signTransaction) throw new Error('Wallet not connected');

    const buildResponse = await fetch('/api/tx/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservationId,
        walletAddress: publicKey.toString(),
        assetId: selectedNFT.address,
        paymentToken: token,
        totalAmount: amount,
        transactionType: 'payment'
      })
    });

    if (!buildResponse.ok) {
      const error = await buildResponse.json();
      throw new Error(error.message || `Failed to build ${token} transaction`);
    }

    const buildResult = await buildResponse.json();
    const serializedTx = buildResult.data?.transaction || buildResult.transaction;
    if (!serializedTx) throw new Error(`No transaction data received for ${token} payment`);

    const { Transaction } = await import('@solana/web3.js');
    const transaction = Transaction.from(Buffer.from(serializedTx, 'base64'));
    const signedTx = await signTransaction(transaction);

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
      throw new Error(error.message || `${token} payment validation failed`);
    }

    const { txSignature } = await confirmResponse.json();
    return txSignature;
  };

  const handlePurchase = async () => {
    if (!publicKey || !signTransaction) {
      updateState({ step: 'error', error: 'Wallet not connected' });
      return;
    }

    try {
      updateState({
        step: 'payment_approved', progress: 10,
        paymentToken: paymentGroups[0].token,
        totalAmount: paymentGroups[0].amount,
        secondaryToken: paymentGroups[1]?.token,
        secondaryAmount: paymentGroups[1]?.amount
      });

      // Reserve traits
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
      if (!reservationId) throw new Error('No reservation ID returned from server');
      updateState({ reservationId });

      // Process ALL payment groups sequentially
      updateState({ step: 'payment_validating', progress: 20 });
      let lastTxSignature = '';

      for (let i = 0; i < paymentGroups.length; i++) {
        const group = paymentGroups[i];
        console.log(`💰 Processing payment ${i + 1}/${paymentGroups.length}: ${group.amount} ${group.token}`);
        const progressBase = 20 + (i * 30 / paymentGroups.length);
        updateState({ progress: Math.round(progressBase) });

        lastTxSignature = await processPayment(reservationId, group.token, group.amount);
        console.log(`✅ Payment ${i + 1} confirmed: ${lastTxSignature}`);
      }

      updateState({ txSignature: lastTxSignature, step: 'payment_validated', progress: 50 });
      await new Promise(r => setTimeout(r, 1500));

      // Metadata update
      updateState({ step: 'metadata_updating', progress: 70 });
      console.log('💰 All payments successful! Starting image composition and metadata update...');

      const composeResponse = await fetch('/api/compose-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseImageUrl: selectedNFT.image,
          selectedTraits: selectedTraits,
          assetId: selectedNFT.address,
          width: 1500, height: 1500, format: 'webp', quality: 90
        })
      });

      let newImageUrl = selectedNFT.image;
      if (composeResponse.ok) {
        const { imageBuffer } = await composeResponse.json();
        const uploadResponse = await fetch('/api/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBuffer, contentType: 'image/webp', assetId: selectedNFT.address, traits: Object.values(selectedTraits) })
        });
        if (uploadResponse.ok) {
          const { imageUrl } = await uploadResponse.json();
          newImageUrl = imageUrl;
          console.log('📸 Image uploaded to Pinata IPFS:', imageUrl);
        } else {
          const errorData = await uploadResponse.json();
          throw new Error(`Image upload failed: ${errorData.error || 'Unknown error'}`);
        }
      }

      updateState({ updatedImageUrl: newImageUrl });

      const slotMappingResponse = await fetch('/api/trait-slots');
      let slotMapping: Record<string, string> = {};
      if (slotMappingResponse.ok) {
        const slotsData = await slotMappingResponse.json();
        slotMapping = slotsData.data?.reduce((acc: Record<string, string>, slot: any) => { acc[slot.id] = slot.name; return acc; }, {}) || {};
      }

      const metadataResponse = await fetch('/api/tx/update-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          assetId: selectedNFT.address,
          newImageUrl,
          newAttributes: Object.values(selectedTraits).map(trait => ({
            trait_type: slotMapping[trait.slotId] || trait.slotId,
            value: trait.name
          })),
          txSignature: lastTxSignature
        })
      });

      if (!metadataResponse.ok) {
        const errData = await metadataResponse.json();
        throw new Error(errData.message || errData.error || 'Failed to update metadata on-chain');
      }

      const metadataResult = await metadataResponse.json();
      console.log('✅ Metadata updated on-chain!', metadataResult.data?.signature || metadataResult.signature);

      updateState({ step: 'metadata_updated', progress: 90 });
      if (onSuccess) onSuccess(lastTxSignature, newImageUrl);
      await new Promise(r => setTimeout(r, 1500));
      updateState({ step: 'success', progress: 100 });

    } catch (error) {
      console.error('Purchase error:', error);
      updateState({ step: 'error', error: error instanceof Error ? error.message : 'Purchase failed' });
    }
  };

  const getStepMessage = () => {
    switch (state.step) {
      case 'confirm': return 'Review your purchase';
      case 'payment_approved': return 'Payment approved.. validating..';
      case 'payment_validating': return isMixed ? 'Processing payments (multiple tokens)...' : 'Payment approved.. validating..';
      case 'payment_validated': return 'Payment validated.. composing and uploading image..';
      case 'metadata_updating': return 'Image uploaded.. updating metadata..';
      case 'metadata_updated': return 'Metadata updated..';
      case 'success': return 'Congrats, your NFT Upgrade completed.';
      case 'error': return 'Purchase failed';
      default: return '';
    }
  };

  const isProcessing = ['payment_approved', 'payment_validating', 'payment_validated', 'metadata_updating', 'metadata_updated'].includes(state.step);
  const canCancel = state.step === 'confirm' || state.step === 'error';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      {isProcessing && <div className="absolute inset-0 bg-gray-900 bg-opacity-75 z-10" />}

      <div className={`bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto relative z-20 ${isProcessing ? 'pointer-events-none' : ''}`}>
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">
              {state.step === 'success' ? 'NFT Upgrade Complete!' : 'Purchase Traits'}
            </h2>
            {canCancel && onCancel && (
              <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {isProcessing && (
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>{getStepMessage()}</span><span>{state.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${state.progress}%` }} />
              </div>
            </div>
          )}

          {state.step === 'confirm' && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <img src={selectedNFT.image} alt={selectedNFT.name} className="w-16 h-16 rounded-lg object-cover" />
                <div>
                  <h3 className="font-medium text-gray-900">{selectedNFT.name}</h3>
                  <p className="text-sm text-gray-600">{selectedNFT.address.slice(0, 8)}...{selectedNFT.address.slice(-8)}</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-3">Selected Traits ({traits.length})</h4>
                <div className="space-y-2">
                  {traits.map(trait => (
                    <div key={trait.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <img src={trait.imageLayerUrl} alt={trait.name} className="w-10 h-10 rounded object-cover" />
                        <div>
                          <p className="font-medium text-gray-900">{trait.name}</p>
                          <p className="text-sm text-gray-600">{trait.rarityTier?.name}</p>
                        </div>
                      </div>
                      <p className="font-medium text-gray-900">{formatDecimalPrice(trait.priceAmount.toString())} {trait.priceToken.symbol}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Summary */}
              <div className="border-t border-gray-200 pt-4 space-y-2">
                {paymentGroups.map((group, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-gray-600">{group.token} Payment ({group.traits.length} trait{group.traits.length > 1 ? 's' : ''})</span>
                    <span className="font-medium text-gray-900">{group.amount} {group.token}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="text-lg font-semibold text-gray-900">Total</span>
                  <span className="text-lg font-semibold text-gray-900">{totalDisplay}</span>
                </div>
                {isMixed && (
                  <p className="text-sm text-amber-600">
                    You will be asked to sign {paymentGroups.length} separate transactions (one per token type)
                  </p>
                )}
              </div>

              <button onClick={handlePurchase} className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                Purchase for {totalDisplay}
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">{getStepMessage()}</p>
              <p className="text-sm text-gray-600">
                {state.step === 'payment_validating' && isMixed && 'Processing multiple token payments sequentially...'}
                {state.step === 'payment_validating' && !isMixed && `Confirming ${state.totalAmount} ${state.paymentToken} payment on blockchain...`}
                {state.step === 'payment_validated' && 'Payment confirmed! Composing image and uploading to IPFS...'}
                {state.step === 'metadata_updating' && 'Uploading composed image to IPFS and updating NFT metadata...'}
                {state.step === 'metadata_updated' && 'Finalizing your NFT upgrade...'}
              </p>
            </div>
          )}

          {state.step === 'success' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">🎉 Congrats, your NFT Upgrade completed!</h3>
              {state.updatedImageUrl && (
                <div className="mb-6">
                  <div className="relative inline-block">
                    <img src={state.updatedImageUrl} alt="Upgraded NFT" className="w-48 h-48 rounded-lg object-cover mx-auto shadow-lg" />
                    <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">UPGRADED</div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">Your NFT has been upgraded with {traits.length} new trait{traits.length > 1 ? 's' : ''}!</p>
                </div>
              )}
              {state.txSignature && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Payment:</span>
                      <span className="font-medium">{totalDisplay}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Traits Applied:</span>
                      <span className="font-medium">{traits.length}</span>
                    </div>
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Transaction Signature:</p>
                      <p className="text-xs font-mono text-gray-800 break-all">{state.txSignature}</p>
                      <a href={`https://explorer.solana.com/tx/${state.txSignature}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 text-xs mt-1 inline-block">
                        View on Solana Explorer →
                      </a>
                    </div>
                  </div>
                </div>
              )}
              <button onClick={onCancel} className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors">Continue Shopping</button>
            </div>
          )}

          {state.step === 'error' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Purchase Failed</h3>
              <p className="text-red-600 mb-4">{state.error}</p>
              <div className="space-y-2">
                <button onClick={handlePurchase} className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors">Try Again</button>
                {onCancel && <button onClick={onCancel} className="w-full bg-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-400 transition-colors">Cancel</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
