/**
 * @jest-environment node
 */

import { SolanaNFTService } from '../../src/lib/services/nft';
import { GET, POST } from '../../src/app/api/user/nfts/route';
import { NextRequest } from 'next/server';

// Mock dependencies
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

jest.mock('../../src/lib/repositories', () => ({
  getProjectRepository: jest.fn(),
}));

describe('Wallet Integration Tests', () => {
  let mockConnection: any;
  let nftService: SolanaNFTService;
  let mockProjectRepo: any;

  beforeEach(() => {
    jest.clearAllMocks();
    const { Connection } = require('@solana/web3.js');
    mockConnection = new Connection();
    nftService = new SolanaNFTService();
    (nftService as any).connection = mockConnection;

    mockProjectRepo = {
      findAll: jest.fn(),
    };
    require('../../src/lib/repositories').getProjectRepository.mockReturnValue(mockProjectRepo);
  });

  describe('NFT Service', () => {
    it('should fetch NFTs for a wallet with collection filtering', async () => {
      const walletAddress = 'TestWallet123456789';
      const collectionIds = ['Collection1', 'Collection2'];
      
      // Mock token accounts
      mockConnection.getParsedTokenAccountsByOwner.mockResolvedValue({
        value: [
          {
            account: {
              data: {
                parsed: {
                  info: {
                    mint: 'mint1',
                    tokenAmount: { uiAmount: 1, decimals: 0 }
                  }
                }
              }
            }
          },
          {
            account: {
              data: {
                parsed: {
                  info: {
                    mint: 'mint2',
                    tokenAmount: { uiAmount: 1, decimals: 0 }
                  }
                }
              }
            }
          }
        ]
      });

      // Mock NFT metadata
      const originalFetchNFTMetadata = (nftService as any).fetchNFTMetadata;
      (nftService as any).fetchNFTMetadata = jest.fn()
        .mockResolvedValueOnce({
          address: 'mint1',
          name: 'NFT 1',
          image: 'https://example.com/1.png',
          collection: 'Collection1',
          attributes: []
        })
        .mockResolvedValueOnce({
          address: 'mint2',
          name: 'NFT 2',
          image: 'https://example.com/2.png',
          collection: 'Collection3', // Not in allowed collections
          attributes: []
        });

      const result = await nftService.fetchUserNFTs(walletAddress, collectionIds);

      expect(result).toHaveLength(1);
      expect(result[0].address).toBe('mint1');
      expect(result[0].collection).toBe('Collection1');
      expect(mockConnection.getParsedTokenAccountsByOwner).toHaveBeenCalledWith(
        expect.any(Object),
        { programId: expect.any(Object) }
      );

      (nftService as any).fetchNFTMetadata = originalFetchNFTMetadata;
    });

    it('should verify ownership correctly', async () => {
      const walletAddress = 'TestWallet123456789';
      const assetId = 'TestAsset123456789';

      mockConnection.getTokenLargestAccounts.mockResolvedValue({
        value: [{ address: 'token-account' }]
      });

      mockConnection.getParsedAccountInfo.mockResolvedValue({
        value: {
          data: {
            parsed: {
              info: {
                owner: walletAddress
              }
            }
          }
        }
      });

      const result = await nftService.verifyOwnership(walletAddress, assetId);
      expect(result).toBe(true);
    });

    it('should return false for non-owned assets', async () => {
      const walletAddress = 'TestWallet123456789';
      const assetId = 'TestAsset123456789';

      mockConnection.getTokenLargestAccounts.mockResolvedValue({
        value: [{ address: 'token-account' }]
      });

      mockConnection.getParsedAccountInfo.mockResolvedValue({
        value: {
          data: {
            parsed: {
              info: {
                owner: 'DifferentWallet123456789'
              }
            }
          }
        }
      });

      const result = await nftService.verifyOwnership(walletAddress, assetId);
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const walletAddress = 'TestWallet123456789';
      const collectionIds = ['Collection1'];

      mockConnection.getParsedTokenAccountsByOwner.mockRejectedValue(
        new Error('Network error')
      );

      await expect(nftService.fetchUserNFTs(walletAddress, collectionIds))
        .rejects.toThrow('Failed to fetch NFTs');
    });
  });

  describe('API Endpoints', () => {
    it('should return NFTs for valid wallet address', async () => {
      mockProjectRepo.findAll.mockResolvedValue([{
        id: 'project1',
        collectionIds: ['Collection1', 'Collection2']
      }]);

      const request = new NextRequest('http://localhost/api/user/nfts?wallet=TestWallet123456789');
      
      // Mock the NFT service
      const mockFetchUserNFTs = jest.fn().mockResolvedValue([
        {
          address: 'nft1',
          name: 'Test NFT',
          image: 'https://example.com/nft.png',
          collection: 'Collection1'
        }
      ]);

      // Replace the service creation
      const originalCreateNFTService = require('../../src/lib/services/nft').createNFTService;
      require('../../src/lib/services/nft').createNFTService = jest.fn().mockReturnValue({
        fetchUserNFTs: mockFetchUserNFTs
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(mockFetchUserNFTs).toHaveBeenCalledWith('TestWallet123456789', ['Collection1', 'Collection2']);

      // Restore original
      require('../../src/lib/services/nft').createNFTService = originalCreateNFTService;
    });

    it('should return 400 for missing wallet address', async () => {
      const request = new NextRequest('http://localhost/api/user/nfts');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Wallet address is required');
    });

    it('should verify ownership via POST endpoint', async () => {
      const request = new NextRequest('http://localhost/api/user/nfts', {
        method: 'POST',
        body: JSON.stringify({
          walletAddress: 'TestWallet123456789',
          assetId: 'TestAsset123456789'
        })
      });

      const mockVerifyOwnership = jest.fn().mockResolvedValue(true);
      
      const originalCreateNFTService = require('../../src/lib/services/nft').createNFTService;
      require('../../src/lib/services/nft').createNFTService = jest.fn().mockReturnValue({
        verifyOwnership: mockVerifyOwnership
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isOwner).toBe(true);
      expect(mockVerifyOwnership).toHaveBeenCalledWith('TestWallet123456789', 'TestAsset123456789');

      require('../../src/lib/services/nft').createNFTService = originalCreateNFTService;
    });

    it('should return 400 for invalid POST request', async () => {
      const request = new NextRequest('http://localhost/api/user/nfts', {
        method: 'POST',
        body: JSON.stringify({
          walletAddress: 'TestWallet123456789'
          // Missing assetId
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Wallet address and asset ID are required');
    });
  });
});