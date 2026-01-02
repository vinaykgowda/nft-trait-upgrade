/**
 * @jest-environment node
 */

import fc from 'fast-check';
import { SolanaNFTService } from '../../src/lib/services/nft';
import { CoreAsset } from '../../src/types';

/**
 * **Feature: nft-trait-marketplace, Property 1: Collection-Filtered NFT Ownership**
 * **Validates: Requirements 1.2, 1.3**
 * 
 * For any connected wallet address, all returned NFTs should be owned by that wallet 
 * and belong exclusively to admin-configured collection IDs from the allowlist
 */

// Mock the Solana connection
jest.mock('@solana/web3.js', () => {
  const actual = jest.requireActual('@solana/web3.js');
  return {
    ...actual,
    Connection: jest.fn().mockImplementation(() => ({
      getParsedTokenAccountsByOwner: jest.fn(),
      getTokenLargestAccounts: jest.fn(),
      getParsedAccountInfo: jest.fn(),
    })),
    PublicKey: actual.PublicKey,
  };
});

describe('Property Test: Collection-Filtered NFT Ownership', () => {
  let mockConnection: any;
  let nftService: SolanaNFTService;

  beforeEach(() => {
    jest.clearAllMocks();
    const { Connection } = require('@solana/web3.js');
    mockConnection = new Connection();
    nftService = new SolanaNFTService();
    // Replace the connection with our mock
    (nftService as any).connection = mockConnection;
  });

  // Generator for wallet addresses (Solana base58 format)
  const walletAddressGenerator = fc.string({ minLength: 32, maxLength: 44 })
    .filter(s => /^[1-9A-HJ-NP-Za-km-z]+$/.test(s));

  // Generator for collection IDs
  const collectionIdGenerator = fc.string({ minLength: 32, maxLength: 44 })
    .filter(s => /^[1-9A-HJ-NP-Za-km-z]+$/.test(s));

  // Generator for NFT data
  const nftDataGenerator = fc.record({
    address: walletAddressGenerator,
    name: fc.string({ minLength: 1, maxLength: 100 }),
    image: fc.webUrl(),
    collection: fc.option(collectionIdGenerator),
    attributes: fc.option(fc.array(fc.record({
      trait_type: fc.string({ minLength: 1, maxLength: 50 }),
      value: fc.string({ minLength: 1, maxLength: 100 }),
    }))),
  });

  // Generator for token account data
  const tokenAccountGenerator = fc.record({
    account: fc.record({
      data: fc.record({
        parsed: fc.record({
          info: fc.record({
            mint: walletAddressGenerator,
            tokenAmount: fc.record({
              uiAmount: fc.constant(1), // NFTs have amount 1
              decimals: fc.constant(0), // NFTs have 0 decimals
            }),
          }),
        }),
      }),
    }),
  });

  it('should return only NFTs owned by the wallet and from allowed collections', async () => {
    await fc.assert(
      fc.asyncProperty(
        walletAddressGenerator,
        fc.array(collectionIdGenerator, { minLength: 1, maxLength: 5 }),
        fc.array(nftDataGenerator, { minLength: 0, maxLength: 20 }),
        fc.array(tokenAccountGenerator, { minLength: 0, maxLength: 20 }),
        async (walletAddress, allowedCollections, allNFTs, tokenAccounts) => {
          // Filter NFTs to only include those from allowed collections
          const expectedNFTs = allNFTs.filter(nft => 
            nft.collection && allowedCollections.includes(nft.collection)
          );

          // Mock the token accounts response
          mockConnection.getParsedTokenAccountsByOwner.mockResolvedValue({
            value: tokenAccounts
          });

          // Mock the NFT metadata fetching
          const originalFetchNFTMetadata = (nftService as any).fetchNFTMetadata;
          (nftService as any).fetchNFTMetadata = jest.fn().mockImplementation(async (mintAddress: string) => {
            // Find the NFT that matches this mint address
            const nft = allNFTs.find(n => n.address === mintAddress);
            return nft || null;
          });

          // Call the service
          const result = await nftService.fetchUserNFTs(walletAddress, allowedCollections);

          // Verify all returned NFTs are from allowed collections
          result.forEach(nft => {
            expect(nft.collection).toBeDefined();
            expect(allowedCollections).toContain(nft.collection);
          });

          // Verify no NFTs from disallowed collections are returned
          const disallowedNFTs = allNFTs.filter(nft => 
            nft.collection && !allowedCollections.includes(nft.collection)
          );
          
          disallowedNFTs.forEach(disallowedNFT => {
            expect(result.find(r => r.address === disallowedNFT.address)).toBeUndefined();
          });

          // Restore original method
          (nftService as any).fetchNFTMetadata = originalFetchNFTMetadata;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return empty array when no collections are allowed', async () => {
    await fc.assert(
      fc.asyncProperty(
        walletAddressGenerator,
        fc.array(nftDataGenerator, { minLength: 1, maxLength: 10 }),
        fc.array(tokenAccountGenerator, { minLength: 1, maxLength: 10 }),
        async (walletAddress, allNFTs, tokenAccounts) => {
          const allowedCollections: string[] = []; // Empty allowlist

          mockConnection.getParsedTokenAccountsByOwner.mockResolvedValue({
            value: tokenAccounts
          });

          const originalFetchNFTMetadata = (nftService as any).fetchNFTMetadata;
          (nftService as any).fetchNFTMetadata = jest.fn().mockImplementation(async (mintAddress: string) => {
            const nft = allNFTs.find(n => n.address === mintAddress);
            return nft || null;
          });

          const result = await nftService.fetchUserNFTs(walletAddress, allowedCollections);

          // Should return empty array when no collections are allowed
          expect(result).toEqual([]);

          (nftService as any).fetchNFTMetadata = originalFetchNFTMetadata;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle NFTs without collection metadata correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        walletAddressGenerator,
        fc.array(collectionIdGenerator, { minLength: 1, maxLength: 3 }),
        fc.array(tokenAccountGenerator, { minLength: 1, maxLength: 5 }),
        async (walletAddress, allowedCollections, tokenAccounts) => {
          // Create NFTs without collection metadata
          const nftsWithoutCollection = tokenAccounts.map((_, index) => ({
            address: `mint${index}`,
            name: `NFT ${index}`,
            image: `https://example.com/image${index}.png`,
            collection: undefined, // No collection
            attributes: [],
          }));

          mockConnection.getParsedTokenAccountsByOwner.mockResolvedValue({
            value: tokenAccounts
          });

          const originalFetchNFTMetadata = (nftService as any).fetchNFTMetadata;
          (nftService as any).fetchNFTMetadata = jest.fn().mockImplementation(async (mintAddress: string) => {
            const index = parseInt(mintAddress.replace('mint', ''));
            return nftsWithoutCollection[index] || null;
          });

          const result = await nftService.fetchUserNFTs(walletAddress, allowedCollections);

          // NFTs without collection should not be returned
          expect(result).toEqual([]);

          (nftService as any).fetchNFTMetadata = originalFetchNFTMetadata;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain consistency across multiple calls with same parameters', async () => {
    await fc.assert(
      fc.asyncProperty(
        walletAddressGenerator,
        fc.array(collectionIdGenerator, { minLength: 1, maxLength: 3 }),
        fc.array(nftDataGenerator, { minLength: 0, maxLength: 10 }),
        fc.array(tokenAccountGenerator, { minLength: 0, maxLength: 10 }),
        async (walletAddress, allowedCollections, allNFTs, tokenAccounts) => {
          mockConnection.getParsedTokenAccountsByOwner.mockResolvedValue({
            value: tokenAccounts
          });

          const originalFetchNFTMetadata = (nftService as any).fetchNFTMetadata;
          (nftService as any).fetchNFTMetadata = jest.fn().mockImplementation(async (mintAddress: string) => {
            const nft = allNFTs.find(n => n.address === mintAddress);
            return nft || null;
          });

          // Call the service multiple times with same parameters
          const result1 = await nftService.fetchUserNFTs(walletAddress, allowedCollections);
          const result2 = await nftService.fetchUserNFTs(walletAddress, allowedCollections);

          // Results should be identical
          expect(result1).toEqual(result2);
          expect(result1.length).toBe(result2.length);

          // Each NFT should be identical
          for (let i = 0; i < result1.length; i++) {
            expect(result1[i].address).toBe(result2[i].address);
            expect(result1[i].collection).toBe(result2[i].collection);
          }

          (nftService as any).fetchNFTMetadata = originalFetchNFTMetadata;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle errors gracefully and not return invalid data', async () => {
    await fc.assert(
      fc.asyncProperty(
        walletAddressGenerator,
        fc.array(collectionIdGenerator, { minLength: 1, maxLength: 3 }),
        async (walletAddress, allowedCollections) => {
          // Mock connection to throw an error
          mockConnection.getParsedTokenAccountsByOwner.mockRejectedValue(
            new Error('Network error')
          );

          // Should throw an error, not return invalid data
          await expect(nftService.fetchUserNFTs(walletAddress, allowedCollections))
            .rejects.toThrow('Failed to fetch NFTs');
        }
      ),
      { numRuns: 30 }
    );
  });
});