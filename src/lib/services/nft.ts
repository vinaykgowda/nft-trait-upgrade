// NFT fetching service that uses Helius RPC for rich metadata

import { Connection, PublicKey } from '@solana/web3.js';
import { CoreAsset } from '@/types';
import { RPC_CONFIG } from '@/lib/constants';

export interface NFTService {
  fetchUserNFTs(walletAddress: string, collectionIds: string[]): Promise<CoreAsset[]>;
  verifyOwnership(walletAddress: string, assetId: string): Promise<boolean>;
}

export class HeliusNFTService implements NFTService {
  private connection: Connection;
  private heliusApiKey: string;

  constructor() {
    this.heliusApiKey = RPC_CONFIG.HELIUS_API_KEY;
    this.connection = new Connection(RPC_CONFIG.HELIUS_RPC_URL, 'confirmed');
  }

  async fetchUserNFTs(walletAddress: string, collectionIds: string[]): Promise<CoreAsset[]> {
    try {
      // If no Helius API key, fall back to basic implementation
      if (!this.heliusApiKey) {
        console.warn('No Helius API key found, using basic NFT fetching');
        return this.fetchUserNFTsBasic(walletAddress, collectionIds);
      }

      // Use the exact API format specified by user
      const response = await fetch(`https://rpc.helius.xyz/?api-key=${this.heliusApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'nft-trait-marketplace',
          method: 'getAssetsByOwner',
          params: {
            ownerAddress: walletAddress,
            page: 1,
            limit: 1000,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Helius API error: ${response.status}`);
      }

      const { result } = await response.json();
      
      if (!result || !result.items) {
        return [];
      }

      return result.items
        .filter((asset: any) => {
          // Filter by collection IDs
          if (collectionIds.length === 0) return true;
          
          return asset.grouping?.some((group: any) => 
            group.group_key === 'collection' && 
            collectionIds.includes(group.group_value)
          );
        })
        .map((asset: any) => ({
          address: asset.id,
          name: asset.content?.metadata?.name || 'Unknown NFT',
          image: asset.content?.links?.image || asset.content?.files?.[0]?.uri || '',
          collection: asset.grouping?.find((g: any) => g.group_key === 'collection')?.group_value,
          attributes: asset.content?.metadata?.attributes || [],
        }));
    } catch (error) {
      console.error('Error fetching user NFTs with Helius:', error);
      // Fall back to basic implementation on error
      return this.fetchUserNFTsBasic(walletAddress, collectionIds);
    }
  }

  async verifyOwnership(walletAddress: string, assetId: string): Promise<boolean> {
    try {
      // If no Helius API key, fall back to basic implementation
      if (!this.heliusApiKey) {
        return this.verifyOwnershipBasic(walletAddress, assetId);
      }

      // Use Helius DAS API to verify ownership
      const response = await fetch(`https://rpc.helius.xyz/?api-key=${this.heliusApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'nft-trait-marketplace',
          method: 'getAsset',
          params: {
            id: assetId,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Helius API error: ${response.status}`);
      }

      const { result } = await response.json();
      
      if (!result) {
        return false;
      }

      return result.ownership?.owner === walletAddress;
    } catch (error) {
      console.error('Error verifying ownership with Helius:', error);
      // Fall back to basic implementation on error
      return this.verifyOwnershipBasic(walletAddress, assetId);
    }
  }

  // Fallback implementation for when Helius is not available
  private async fetchUserNFTsBasic(walletAddress: string, collectionIds: string[]): Promise<CoreAsset[]> {
    try {
      const publicKey = new PublicKey(walletAddress);
      
      // Get all token accounts for the wallet
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      });

      const nfts: CoreAsset[] = [];

      // Process each token account
      for (const tokenAccount of tokenAccounts.value) {
        const tokenAmount = tokenAccount.account.data.parsed.info.tokenAmount;
        
        // Only process accounts with exactly 1 token (NFTs)
        if (tokenAmount.uiAmount === 1 && tokenAmount.decimals === 0) {
          const mintAddress = tokenAccount.account.data.parsed.info.mint;
          
          try {
            // Fetch metadata for this mint
            const nft = await this.fetchNFTMetadataBasic(mintAddress);
            
            // Filter by collection IDs if the NFT has a collection
            if (nft && (collectionIds.length === 0 || (nft.collection && collectionIds.includes(nft.collection)))) {
              nfts.push(nft);
            }
          } catch (error) {
            // Skip NFTs that fail to fetch metadata
            console.warn(`Failed to fetch metadata for mint ${mintAddress}:`, error);
            continue;
          }
        }
      }

      return nfts;
    } catch (error) {
      console.error('Error fetching user NFTs (basic):', error);
      throw new Error('Failed to fetch NFTs');
    }
  }

  private async verifyOwnershipBasic(walletAddress: string, assetId: string): Promise<boolean> {
    try {
      const publicKey = new PublicKey(walletAddress);
      const assetPublicKey = new PublicKey(assetId);

      // Get the largest token account for this mint owned by the wallet
      const largestAccount = await this.connection.getTokenLargestAccounts(assetPublicKey);
      
      if (largestAccount.value.length === 0) {
        return false;
      }

      // Check if the wallet owns the token account with the NFT
      const tokenAccountInfo = await this.connection.getParsedAccountInfo(largestAccount.value[0].address);
      
      if (!tokenAccountInfo.value || !tokenAccountInfo.value.data) {
        return false;
      }

      const parsedData = tokenAccountInfo.value.data as any;
      const owner = parsedData.parsed?.info?.owner;
      
      return owner === walletAddress;
    } catch (error) {
      console.error('Error verifying ownership (basic):', error);
      return false;
    }
  }

  private async fetchNFTMetadataBasic(mintAddress: string): Promise<CoreAsset | null> {
    try {
      // This is a simplified implementation
      // In a real implementation, you would use Metaplex SDK to fetch proper metadata
      const mintPublicKey = new PublicKey(mintAddress);
      
      // For now, return a mock NFT structure
      // In production, this would fetch from Metaplex metadata accounts
      return {
        address: mintAddress,
        name: `NFT ${mintAddress.slice(0, 8)}`,
        image: `https://via.placeholder.com/400x400?text=${mintAddress.slice(0, 8)}`,
        collection: undefined, // Would be populated from actual metadata
        attributes: [],
      };
    } catch (error) {
      console.error('Error fetching NFT metadata (basic):', error);
      return null;
    }
  }
}

// Legacy service for backward compatibility
export class SolanaNFTService extends HeliusNFTService {}

// Factory function for dependency injection
export function createNFTService(): NFTService {
  return new HeliusNFTService();
}