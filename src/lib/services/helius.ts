// Helius API service for token information
export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}

export class HeliusService {
  private static readonly HELIUS_API_URL = 'https://api.helius.xyz/v0';
  private static readonly FALLBACK_RPC_URL = 'https://api.mainnet-beta.solana.com';

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