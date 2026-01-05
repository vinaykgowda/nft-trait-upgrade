// Helius API service for token information and NFT metadata
export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}

export interface NFTMetadata {
  name: string;
  description: string;
  symbol?: string;
  seller_fee_basis_points?: number;
  image: string;
  external_url?: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  properties?: {
    files?: Array<{
      uri: string;
      type: string;
    }>;
    category?: string;
    creators?: Array<{
      address: string;
      share: number;
    }>;
  };
}

export class HeliusService {
  private static readonly HELIUS_API_URL = 'https://api.helius.xyz/v0';
  private static readonly FALLBACK_RPC_URL = 'https://api.mainnet-beta.solana.com';

  /**
   * Fetch NFT metadata from Helius API
   */
  static async getNFTMetadata(assetAddress: string): Promise<NFTMetadata | null> {
    try {
      const heliusKey = process.env.HELIUS_API_KEY;
      if (!heliusKey) {
        console.warn('⚠️ HELIUS_API_KEY not configured, cannot fetch NFT metadata');
        return null;
      }

      console.log('🔍 Fetching NFT metadata from Helius:', assetAddress);

      const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'nft-metadata-request',
          method: 'getAsset',
          params: {
            id: assetAddress
          }
        })
      });

      if (!response.ok) {
        console.error('❌ Helius API request failed:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      
      if (data.error) {
        console.error('❌ Helius API error:', data.error);
        return null;
      }

      if (!data.result) {
        console.warn('⚠️ No asset data returned from Helius');
        return null;
      }

      const asset = data.result;
      const content = asset.content;
      const metadata = content?.metadata;

      if (!metadata) {
        console.warn('⚠️ No metadata found in asset');
        return null;
      }

      // Parse attributes
      const attributes = [];
      if (metadata.attributes && Array.isArray(metadata.attributes)) {
        attributes.push(...metadata.attributes);
      }

      // Build NFT metadata object
      const nftMetadata: NFTMetadata = {
        name: metadata.name || 'Unknown NFT',
        description: metadata.description || '',
        symbol: metadata.symbol || 'NFT',
        seller_fee_basis_points: asset.royalty?.basis_points || 0,
        image: content?.links?.image || metadata.image || '',
        external_url: metadata.external_url,
        attributes,
        properties: {
          files: content?.files || [],
          category: 'image',
          creators: asset.creators || []
        }
      };

      console.log('✅ NFT metadata fetched successfully:', {
        name: nftMetadata.name,
        symbol: nftMetadata.symbol,
        attributeCount: nftMetadata.attributes.length,
        hasImage: !!nftMetadata.image
      });

      return nftMetadata;

    } catch (error) {
      console.error('❌ Error fetching NFT metadata:', error);
      return null;
    }
  }

  /**
   * Fetch token information from Helius API
   */
  static async getTokenInfo(tokenAddress: string): Promise<TokenInfo | null> {
    try {
      // First try Helius API if key is available
      const heliusKey = process.env.HELIUS_API_KEY;
      if (heliusKey) {
        // Use getAsset method for better token metadata
        const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'token-info-request',
            method: 'getAsset',
            params: {
              id: tokenAddress
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.result && data.result.content && data.result.content.metadata) {
            const metadata = data.result.content.metadata;
            const tokenInfo = data.result.token_info;
            
            return {
              address: tokenAddress,
              name: metadata.name || 'Unknown Token',
              symbol: metadata.symbol || 'UNKNOWN',
              decimals: tokenInfo?.decimals || 9,
              logoURI: data.result.content.links?.image
            };
          }
        }
      }

      // Fallback to direct RPC call
      return await this.getTokenInfoFromRPC(tokenAddress);
    } catch (error) {
      console.error('Error fetching token info:', error);
      return null;
    }
  }

  /**
   * Fallback method using direct RPC calls
   */
  private static async getTokenInfoFromRPC(tokenAddress: string): Promise<TokenInfo | null> {
    try {
      const response = await fetch(this.FALLBACK_RPC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getAccountInfo',
          params: [
            tokenAddress,
            {
              encoding: 'jsonParsed'
            }
          ]
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result?.value?.data?.parsed?.info) {
          const info = data.result.value.data.parsed.info;
          return {
            address: tokenAddress,
            name: info.name || 'Unknown Token',
            symbol: info.symbol || 'UNKNOWN',
            decimals: info.decimals || 9
          };
        }
      }

      // If all else fails, return basic info
      return {
        address: tokenAddress,
        name: 'Unknown Token',
        symbol: 'UNKNOWN',
        decimals: 9
      };
    } catch (error) {
      console.error('Error fetching token info from RPC:', error);
      return null;
    }
  }

  /**
   * Validate if a token address is valid
   */
  static isValidTokenAddress(address: string): boolean {
    // Basic Solana address validation (base58, 32-44 characters)
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(address);
  }

  /**
   * Get well-known token information
   */
  static getWellKnownTokens(): TokenInfo[] {
    return [
      {
        address: 'So11111111111111111111111111111111111111112',
        name: 'Solana',
        symbol: 'SOL',
        decimals: 9
      },
      {
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6
      },
      {
        address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        name: 'Tether USD',
        symbol: 'USDT',
        decimals: 6
      }
    ];
  }
}