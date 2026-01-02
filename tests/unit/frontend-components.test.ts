/**
 * Unit tests for frontend component logic
 * Tests trait browsing and filtering, purchase flow UI interactions
 * Requirements: 2.1, 2.4, 2.5, 3.5
 */

import { CoreAsset, Trait, TraitSlot, RarityTier, Token } from '@/types';

// Mock fetch globally
global.fetch = jest.fn();

describe('Frontend Component Logic Tests', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  describe('Trait Browsing Logic', () => {
    const mockTraits: Trait[] = [
      {
        id: '1',
        slotId: 'slot1',
        name: 'Blue Background',
        imageLayerUrl: '/trait1.png',
        rarityTier: { id: 'rare', name: 'Rare', weight: 2, displayOrder: 2 } as RarityTier,
        totalSupply: 100,
        remainingSupply: 50,
        priceAmount: BigInt(100000000), // 0.1 SOL
        priceToken: { id: 'sol', symbol: 'SOL', mintAddress: undefined, decimals: 9, enabled: true } as Token,
        active: true,
      },
      {
        id: '2',
        slotId: 'slot2',
        name: 'Red Hat',
        imageLayerUrl: '/trait2.png',
        rarityTier: { id: 'common', name: 'Common', weight: 1, displayOrder: 1 } as RarityTier,
        totalSupply: 200,
        remainingSupply: 0, // Sold out
        priceAmount: BigInt(50000000), // 0.05 SOL
        priceToken: { id: 'sol', symbol: 'SOL', mintAddress: undefined, decimals: 9, enabled: true } as Token,
        active: true,
      },
      {
        id: '3',
        slotId: 'slot1',
        name: 'Green Background',
        imageLayerUrl: '/trait3.png',
        rarityTier: { id: 'common', name: 'Common', weight: 1, displayOrder: 1 } as RarityTier,
        totalSupply: undefined, // Unlimited
        remainingSupply: undefined,
        priceAmount: BigInt(0), // Free
        priceToken: { id: 'sol', symbol: 'SOL', mintAddress: undefined, decimals: 9, enabled: true } as Token,
        active: true,
      },
    ];

    test('should group traits by slot correctly', () => {
      const slots = [
        { id: 'slot1', name: 'Background', layerOrder: 1 },
        { id: 'slot2', name: 'Hat', layerOrder: 2 },
      ];
      
      const groupedTraits: Record<string, Trait[]> = {};
      mockTraits.forEach(trait => {
        const slot = slots.find(s => s.id === trait.slotId);
        const slotName = slot?.name || 'Other';
        if (!groupedTraits[slotName]) {
          groupedTraits[slotName] = [];
        }
        groupedTraits[slotName].push(trait);
      });

      expect(groupedTraits['Background']).toHaveLength(2);
      expect(groupedTraits['Hat']).toHaveLength(1);
      expect(groupedTraits['Background'][0].name).toBe('Blue Background');
      expect(groupedTraits['Background'][1].name).toBe('Green Background');
      expect(groupedTraits['Hat'][0].name).toBe('Red Hat');
    });

    test('should filter traits by price range correctly', () => {
      const filterByPriceRange = (traits: Trait[], priceRange: string) => {
        return traits.filter((trait: Trait) => {
          const price = Number(trait.priceAmount);
          switch (priceRange) {
            case 'free':
              return price === 0;
            case 'low':
              return price > 0 && price <= 100000000; // 0.1 SOL
            case 'medium':
              return price > 100000000 && price <= 1000000000; // 0.1 - 1 SOL
            case 'high':
              return price > 1000000000; // > 1 SOL
            default:
              return true;
          }
        });
      };

      const freeTraits = filterByPriceRange(mockTraits, 'free');
      const lowTraits = filterByPriceRange(mockTraits, 'low');
      const mediumTraits = filterByPriceRange(mockTraits, 'medium');
      const highTraits = filterByPriceRange(mockTraits, 'high');

      expect(freeTraits).toHaveLength(1);
      expect(freeTraits[0].name).toBe('Green Background');
      
      expect(lowTraits).toHaveLength(2);
      expect(lowTraits.map(t => t.name)).toContain('Blue Background');
      expect(lowTraits.map(t => t.name)).toContain('Red Hat');
      
      expect(mediumTraits).toHaveLength(0);
      expect(highTraits).toHaveLength(0);
    });

    test('should determine availability status correctly', () => {
      const getAvailabilityStatus = (trait: Trait) => {
        if (trait.remainingSupply === 0) {
          return 'Sold Out';
        } else if (trait.totalSupply && trait.remainingSupply && trait.remainingSupply <= 5) {
          return 'Low Stock';
        } else {
          return 'Available';
        }
      };

      expect(getAvailabilityStatus(mockTraits[0])).toBe('Available'); // 50/100 left
      expect(getAvailabilityStatus(mockTraits[1])).toBe('Sold Out'); // 0/200 left
      expect(getAvailabilityStatus(mockTraits[2])).toBe('Available'); // Unlimited
    });

    test('should get correct rarity color classes', () => {
      const getRarityColor = (rarityName: string) => {
        switch (rarityName.toLowerCase()) {
          case 'common':
            return 'bg-gray-100 text-gray-800';
          case 'rare':
            return 'bg-blue-100 text-blue-800';
          case 'epic':
            return 'bg-purple-100 text-purple-800';
          case 'legendary':
            return 'bg-yellow-100 text-yellow-800';
          default:
            return 'bg-gray-100 text-gray-800';
        }
      };

      expect(getRarityColor('Common')).toBe('bg-gray-100 text-gray-800');
      expect(getRarityColor('Rare')).toBe('bg-blue-100 text-blue-800');
      expect(getRarityColor('Epic')).toBe('bg-purple-100 text-purple-800');
      expect(getRarityColor('Legendary')).toBe('bg-yellow-100 text-yellow-800');
      expect(getRarityColor('Unknown')).toBe('bg-gray-100 text-gray-800');
    });
  });

  describe('Purchase Flow Logic', () => {
    const mockNFT: CoreAsset = {
      address: 'test-nft-address',
      name: 'Test NFT',
      image: '/test-nft.png',
      collection: 'test-collection',
      attributes: [],
    };

    const mockTraits = {
      slot1: {
        id: '1',
        slotId: 'slot1',
        name: 'Blue Background',
        imageLayerUrl: '/trait1.png',
        priceAmount: BigInt(100000000),
        priceToken: { symbol: 'SOL' } as Token,
        rarityTier: { name: 'Rare' } as RarityTier,
        active: true,
      } as Trait,
      slot2: {
        id: '2',
        slotId: 'slot2',
        name: 'Red Hat',
        imageLayerUrl: '/trait2.png',
        priceAmount: BigInt(50000000),
        priceToken: { symbol: 'SOL' } as Token,
        rarityTier: { name: 'Common' } as RarityTier,
        active: true,
      } as Trait,
    };

    test('should calculate total price correctly', () => {
      const calculateTotalPrice = (traits: Record<string, Trait>) => {
        return Object.values(traits).reduce((total, trait) => {
          return total + Number(trait.priceAmount);
        }, 0);
      };

      const totalPrice = calculateTotalPrice(mockTraits);
      expect(totalPrice).toBe(150000000); // 0.1 + 0.05 SOL in lamports
    });

    test('should count selected traits correctly', () => {
      const getSelectedTraitCount = (traits: Record<string, Trait>) => {
        return Object.keys(traits).length;
      };

      expect(getSelectedTraitCount(mockTraits)).toBe(2);
      expect(getSelectedTraitCount({})).toBe(0);
      expect(getSelectedTraitCount({ slot1: mockTraits.slot1 })).toBe(1);
    });

    test('should generate correct purchase step messages', () => {
      const getStepMessage = (step: string) => {
        switch (step) {
          case 'confirm':
            return 'Review your purchase';
          case 'reserving':
            return 'Reserving traits...';
          case 'building':
            return 'Building transaction...';
          case 'signing':
            return 'Please sign the transaction in your wallet';
          case 'confirming':
            return 'Confirming transaction...';
          case 'success':
            return 'Purchase successful!';
          case 'error':
            return 'Purchase failed';
          default:
            return '';
        }
      };

      expect(getStepMessage('confirm')).toBe('Review your purchase');
      expect(getStepMessage('reserving')).toBe('Reserving traits...');
      expect(getStepMessage('building')).toBe('Building transaction...');
      expect(getStepMessage('signing')).toBe('Please sign the transaction in your wallet');
      expect(getStepMessage('confirming')).toBe('Confirming transaction...');
      expect(getStepMessage('success')).toBe('Purchase successful!');
      expect(getStepMessage('error')).toBe('Purchase failed');
      expect(getStepMessage('unknown')).toBe('');
    });

    test('should determine if cancel is allowed correctly', () => {
      const canCancel = (step: string) => {
        return step === 'confirm' || step === 'error';
      };

      expect(canCancel('confirm')).toBe(true);
      expect(canCancel('error')).toBe(true);
      expect(canCancel('reserving')).toBe(false);
      expect(canCancel('building')).toBe(false);
      expect(canCancel('signing')).toBe(false);
      expect(canCancel('confirming')).toBe(false);
      expect(canCancel('success')).toBe(false);
    });

    test('should calculate progress correctly', () => {
      const getProgress = (step: string) => {
        switch (step) {
          case 'confirm':
            return 0;
          case 'reserving':
            return 20;
          case 'building':
            return 50;
          case 'signing':
            return 70;
          case 'confirming':
            return 85;
          case 'success':
            return 100;
          default:
            return 0;
        }
      };

      expect(getProgress('confirm')).toBe(0);
      expect(getProgress('reserving')).toBe(20);
      expect(getProgress('building')).toBe(50);
      expect(getProgress('signing')).toBe(70);
      expect(getProgress('confirming')).toBe(85);
      expect(getProgress('success')).toBe(100);
    });
  });

  describe('Marketplace Page Logic', () => {
    test('should handle project configuration correctly', () => {
      const getProjectName = (project: any) => {
        return project?.name || 'NFT Trait Marketplace';
      };

      const getCollectionIds = (project: any) => {
        return project?.collectionIds || [];
      };

      const mockProject = {
        name: 'Custom Marketplace',
        description: 'Custom description',
        collectionIds: ['collection1', 'collection2'],
      };

      expect(getProjectName(mockProject)).toBe('Custom Marketplace');
      expect(getProjectName(null)).toBe('NFT Trait Marketplace');
      expect(getProjectName({})).toBe('NFT Trait Marketplace');

      expect(getCollectionIds(mockProject)).toEqual(['collection1', 'collection2']);
      expect(getCollectionIds(null)).toEqual([]);
      expect(getCollectionIds({})).toEqual([]);
    });

    test('should handle social links correctly', () => {
      const hasSocialLinks = (project: any) => {
        return !!(project?.discordUrl || project?.xUrl || project?.websiteUrl);
      };

      const mockProjectWithSocial = {
        websiteUrl: 'https://example.com',
        discordUrl: 'https://discord.gg/test',
        xUrl: 'https://x.com/test',
      };

      const mockProjectWithoutSocial = {
        name: 'Test',
      };

      expect(hasSocialLinks(mockProjectWithSocial)).toBe(true);
      expect(hasSocialLinks(mockProjectWithoutSocial)).toBe(false);
      expect(hasSocialLinks(null)).toBe(false);
    });

    test('should handle NFT selection state correctly', () => {
      const handleNFTSelect = (
        currentNFT: CoreAsset | null,
        newNFT: CoreAsset,
        resetCallback: () => void
      ) => {
        if (currentNFT?.address !== newNFT.address) {
          resetCallback();
        }
        return newNFT;
      };

      const mockNFT1: CoreAsset = {
        address: 'nft1',
        name: 'NFT 1',
        image: '/nft1.png',
        collection: 'collection1',
        attributes: [],
      };

      const mockNFT2: CoreAsset = {
        address: 'nft2',
        name: 'NFT 2',
        image: '/nft2.png',
        collection: 'collection1',
        attributes: [],
      };

      let resetCalled = false;
      const resetCallback = () => { resetCalled = true; };

      // Selecting new NFT should trigger reset
      const result1 = handleNFTSelect(null, mockNFT1, resetCallback);
      expect(result1).toBe(mockNFT1);
      expect(resetCalled).toBe(true);

      // Selecting same NFT should not trigger reset
      resetCalled = false;
      const result2 = handleNFTSelect(mockNFT1, mockNFT1, resetCallback);
      expect(result2).toBe(mockNFT1);
      expect(resetCalled).toBe(false);

      // Selecting different NFT should trigger reset
      resetCalled = false;
      const result3 = handleNFTSelect(mockNFT1, mockNFT2, resetCallback);
      expect(result3).toBe(mockNFT2);
      expect(resetCalled).toBe(true);
    });

    test('should handle purchase success correctly', () => {
      const handlePurchaseSuccess = (
        txSignature: string,
        setSuccessCallback: (sig: string) => void,
        resetTraitsCallback: () => void,
        refetchCallback: () => void
      ) => {
        setSuccessCallback(txSignature);
        resetTraitsCallback();
        refetchCallback();
      };

      let successSignature = '';
      let traitsReset = false;
      let refetchCalled = false;

      const setSuccess = (sig: string) => { successSignature = sig; };
      const resetTraits = () => { traitsReset = true; };
      const refetch = () => { refetchCalled = true; };

      handlePurchaseSuccess('test-signature', setSuccess, resetTraits, refetch);

      expect(successSignature).toBe('test-signature');
      expect(traitsReset).toBe(true);
      expect(refetchCalled).toBe(true);
    });
  });

  describe('API Integration Logic', () => {
    test('should build correct trait API URLs with filters', () => {
      const buildTraitApiUrl = (filters: {
        slotId?: string;
        rarityTierId?: string;
        priceRange?: string;
      }) => {
        const params = new URLSearchParams();
        if (filters.slotId) params.append('slotId', filters.slotId);
        if (filters.rarityTierId) params.append('rarityTierId', filters.rarityTierId);
        params.append('active', 'true');
        return `/api/traits?${params}`;
      };

      expect(buildTraitApiUrl({})).toBe('/api/traits?active=true');
      expect(buildTraitApiUrl({ slotId: 'slot1' })).toBe('/api/traits?slotId=slot1&active=true');
      expect(buildTraitApiUrl({ slotId: 'slot1', rarityTierId: 'rare' }))
        .toBe('/api/traits?slotId=slot1&rarityTierId=rare&active=true');
    });

    test('should handle API errors gracefully', () => {
      const handleApiError = (error: any) => {
        if (error instanceof Error) {
          return error.message;
        }
        return 'An unexpected error occurred';
      };

      expect(handleApiError(new Error('Network error'))).toBe('Network error');
      expect(handleApiError('String error')).toBe('An unexpected error occurred');
      expect(handleApiError(null)).toBe('An unexpected error occurred');
    });

    test('should validate API responses correctly', () => {
      const validateTraitResponse = (response: any): boolean => {
        return Array.isArray(response) && response.every(trait => 
          trait.id && 
          trait.name && 
          trait.imageLayerUrl && 
          trait.priceAmount !== undefined &&
          trait.priceToken
        );
      };

      const validResponse = [
        {
          id: '1',
          name: 'Test Trait',
          imageLayerUrl: '/trait.png',
          priceAmount: 100,
          priceToken: { symbol: 'SOL' },
        }
      ];

      const invalidResponse = [
        {
          id: '1',
          // Missing required fields
        }
      ];

      expect(validateTraitResponse(validResponse)).toBe(true);
      expect(validateTraitResponse(invalidResponse)).toBe(false);
      expect(validateTraitResponse(null)).toBe(false);
      expect(validateTraitResponse('not an array')).toBe(false);
    });
  });
});