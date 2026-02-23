'use client';

import { TraitMarketplace } from '@/components/marketplace/TraitMarketplace';
import { AppWalletProvider } from '@/components/wallet/WalletProvider';

export default function MarketplacePage() {
  return (
    <AppWalletProvider>
      <TraitMarketplace />
    </AppWalletProvider>
  );
}
