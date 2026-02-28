'use client';

import { AppWalletProvider } from '@/components/wallet/WalletProvider';

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <AppWalletProvider>{children}</AppWalletProvider>;
}
