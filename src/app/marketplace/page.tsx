'use client';

import { TraitMarketplace } from '@/components/marketplace/TraitMarketplace';
import { WalletProvider } from '@/components/wallet/WalletProvider';

export default function MarketplacePage() {
  return (
    <WalletProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <h1 className="text-xl font-semibold text-gray-900">
                NFT Trait Marketplace
              </h1>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <TraitMarketplace />
      </div>
    </WalletProvider>
  );
}