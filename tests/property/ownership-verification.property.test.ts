/**
 * @jest-environment node
 */

import fc from 'fast-check';
import { SolanaNFTService } from '../../src/lib/services/nft';

/**
 * **Feature: nft-trait-marketplace, Property 9: Ownership Verification**
 * **Validates: Requirements 1.4, 8.5**
 * 
 * For any transaction building request, the system should verify current wallet ownership 
 * of the specified asset before proceeding
 */

// Mock the Solana connection
jest.mock('@solana/web3.js', () => {
  const actual = jest.requireActual('@solana/web3.js');
  return {
    ...actual,
    Connection: jest.fn().mockImplementation(() => ({
      getTokenLargestAccounts: jest.fn(),
      getParsedAccountInfo: jest.fn(),
    })),
    PublicKey: actual.PublicKey,
  };
});

describe('Property Test: Ownership Verification', () => {
  let mockConnection: any;
  let nftService: SolanaNFTService;

  beforeEach(() => {
    jest.clearAllMocks();
    const { Connection } = require('@solana/web3.js');
    mockConnection = new Connection();
    nftService = new SolanaNFTService();
    (nftService as any).connection = mockConnection;
  });

  const walletAddressGenerator = fc.string({ minLength: 32, maxLength: 44 })
    .filter(s => /^[1-9A-HJ-NP-Za-km-z]+$/.test(s));

  const assetIdGenerator = fc.string({ minLength: 32, maxLength: 44 })
    .filter(s => /^[1-9A-HJ-NP-Za-km-z]+$/.test(s));

  it('should return true when wallet owns the asset', async () => {
    await fc.assert(
      fc.asyncProperty(
        walletAddressGenerator,
        assetIdGenerator,
        async (walletAddress, assetId) => {
          // Mock successful ownership verification
          mockConnection.getTokenLargestAccounts.mockResolvedValue({
            value: [{ address: 'token-account-address' }]
          });

          mockConnection.getParsedAccountInfo.mockResolvedValue({
            value: {
              data: {
                parsed: {
                  info: {
                    owner: walletAddress // Same wallet owns the token
                  }
                }
              }
            }
          });

          const result = await nftService.verifyOwnership(walletAddress, assetId);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return false when wallet does not own the asset', async () => {
    await fc.assert(
      fc.asyncProperty(
        walletAddressGenerator,
        walletAddressGenerator,
        assetIdGenerator,
        async (walletAddress, differentWallet, assetId) => {
          fc.pre(walletAddress !== differentWallet); // Ensure different wallets

          mockConnection.getTokenLargestAccounts.mockResolvedValue({
            value: [{ address: 'token-account-address' }]
          });

          mockConnection.getParsedAccountInfo.mockResolvedValue({
            value: {
              data: {
                parsed: {
                  info: {
                    owner: differentWallet // Different wallet owns the token
                  }
                }
              }
            }
          });

          const result = await nftService.verifyOwnership(walletAddress, assetId);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return false when asset does not exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        walletAddressGenerator,
        assetIdGenerator,
        async (walletAddress, assetId) => {
          // Mock no token accounts found
          mockConnection.getTokenLargestAccounts.mockResolvedValue({
            value: []
          });

          const result = await nftService.verifyOwnership(walletAddress, assetId);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should return false when account info is invalid', async () => {
    await fc.assert(
      fc.asyncProperty(
        walletAddressGenerator,
        assetIdGenerator,
        async (walletAddress, assetId) => {
          mockConnection.getTokenLargestAccounts.mockResolvedValue({
            value: [{ address: 'token-account-address' }]
          });

          // Mock invalid account info
          mockConnection.getParsedAccountInfo.mockResolvedValue({
            value: null
          });

          const result = await nftService.verifyOwnership(walletAddress, assetId);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle errors gracefully and return false', async () => {
    await fc.assert(
      fc.asyncProperty(
        walletAddressGenerator,
        assetIdGenerator,
        async (walletAddress, assetId) => {
          // Mock connection error
          mockConnection.getTokenLargestAccounts.mockRejectedValue(
            new Error('Network error')
          );

          const result = await nftService.verifyOwnership(walletAddress, assetId);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 30 }
    );
  });
});