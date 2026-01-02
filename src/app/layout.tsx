import type { Metadata } from "next";
import "./globals.css";
import { AppWalletProvider } from "@/components/wallet/WalletProvider";

export const metadata: Metadata = {
  title: "NFT Trait Marketplace",
  description: "Secure trait commerce for Metaplex Core NFTs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppWalletProvider>
          {children}
        </AppWalletProvider>
      </body>
    </html>
  );
}