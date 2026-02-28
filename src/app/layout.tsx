import type { Metadata } from "next";
import "./globals.css";
import { AppWalletProvider } from "@/components/wallet/WalletProvider";

export const metadata: Metadata = {
  title: "Pepeverse Trait Forge",
  description: "Secure in-house trait swap store aka Trait Forge built by and for Pepeverse!",
  icons: {
    icon: "/trait-forge-logo.png",
    apple: "/trait-forge-logo.png",
  },
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