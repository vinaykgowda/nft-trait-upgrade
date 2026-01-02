'use client';

import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function WalletButton() {
  return (
    <WalletMultiButton className="!bg-blue-600 hover:!bg-blue-700 !rounded-lg !font-medium" />
  );
}

export function WalletConnectionStatus() {
  const { connected, publicKey } = useWallet();

  if (!connected) {
    return (
      <div className="text-gray-500">
        Connect your wallet to view your NFTs
      </div>
    );
  }

  return (
    <div className="text-green-600">
      Connected: {publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-8)}
    </div>
  );
}