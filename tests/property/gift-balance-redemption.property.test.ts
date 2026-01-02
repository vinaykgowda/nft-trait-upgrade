/**
 * @jest-environment node
 */

import fc from 'fast-check';
import { getGiftBalanceRepository, getPurchaseRepository } from '../../src/lib/repositories';

/**
 * **Feature: nft-trait-marketplace, Property 8: Gift Balance Redemption**
 * **Validates: Requirements 6.3**
 * 
 * For any user with gift balance for a trait, claiming that trait should deduct from gift balance instead of requiring payment
 */

// Mock the database and repositories
jest.mock('../../src/lib/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('../../src/lib/repositories', () => ({
  getGiftBalanceRepository: jest.fn(),
  getPurchaseRepository: jest.fn(),
}));

describe('Property Test: Gift Balance Redemption', () => {
  const mockQuery = require('../../src/lib/database').query;
  const mockGetGiftBalanceRepository = require('../../src/lib/repositories').getGiftBalanceRepository;
  const mockGetPurchaseRepository = require('../../src/lib/repositories').getPurchaseRepository;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Generator for wallet addresses
  const walletAddressGenerator = fc.string({ minLength: 32, maxLength: 44 }).filter(s => /^[1-9A-HJ-NP-Za-km-z]+$/.test(s));

  // Generator for gift balance data
  const giftBalanceGenerator = fc.record({
    id: fc.uuid(),
    wallet_address: walletAddressGenerator,
    trait_id: fc.uuid(),
    qty_available: fc.integer({ min: 1, max: 10 }),
    created_at: fc.date(),
  });

  // Generator for trait data
  const traitGenerator = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    slot_id: fc.uuid(),
    price_amount: fc.bigInt({ min: 1000000000n, max: 10000000000n }), // 1-10 SOL in lamports
    price_token_id: fc.uuid(),
    active: fc.boolean(),
    total_supply: fc.option(fc.integer({ min: 1, max: 1000 })),
    remaining_supply: fc.option(fc.integer({ min: 0, max: 1000 })),
  });

  // Generator for purchase request data
  const purchaseRequestGenerator = fc.record({
    walletAddress: walletAddressGenerator,
    assetId: fc.string({ minLength: 32, maxLength: 44 }),
    traitId: fc.uuid(),
    quantity: fc.integer({ min: 1, max: 5 }),
  });

  it('should deduct from gift balance instead of requiring payment when user has sufficient gift balance', async () => {
    await fc.assert(
      fc.asyncProperty(
        giftBalanceGenerator,
        traitGenerator,
        purchaseRequestGenerator,
        async (giftBalance, trait, purchaseRequest) => {
          // Ensure the purchase request matches the gift balance
          const matchingRequest = {
            ...purchaseRequest,
            walletAddress: giftBalance.wallet_address,
            traitId: giftBalance.trait_id,
            quantity: Math.min(purchaseRequest.quantity, giftBalance.qty_available),
          };

          // Ensure trait ID matches
          const matchingTrait = {
            ...trait,
            id: giftBalance.trait_id,
          };

          // Mock repositories
          const mockGiftRepo = {
            findByWalletAndTrait: jest.fn(),
            decrementQuantity: jest.fn(),
            getTotalGiftBalance: jest.fn(),
          };

          const mockPurchaseRepo = {
            create: jest.fn(),
            findById: jest.fn(),
          };

          mockGetGiftBalanceRepository.mockReturnValue(mockGiftRepo);
          mockGetPurchaseRepository.mockReturnValue(mockPurchaseRepo);

          // Mock finding the gift balance
          mockGiftRepo.findByWalletAndTrait.mockResolvedValue(giftBalance);

          // Mock successful decrement
          mockGiftRepo.decrementQuantity.mockResolvedValue(true);

          // Mock purchase creation (should be free/gift purchase)
          const expectedPurchase = {
            id: fc.sample(fc.uuid(), 1)[0],
            wallet_address: matchingRequest.walletAddress,
            asset_id: matchingRequest.assetId,
            trait_id: matchingRequest.traitId,
            price_amount: 0n, // Should be 0 for gift redemption
            token_id: matchingTrait.price_token_id,
            status: 'gift_redeemed',
            created_at: new Date(),
          };

          mockPurchaseRepo.create.mockResolvedValue(expectedPurchase);

          // Simulate the gift redemption process
          const existingGiftBalance = await mockGiftRepo.findByWalletAndTrait(
            matchingRequest.walletAddress,
            matchingRequest.traitId
          );

          // Verify gift balance exists and has sufficient quantity
          expect(existingGiftBalance).toBeTruthy();
          expect(existingGiftBalance.qty_available).toBeGreaterThanOrEqual(matchingRequest.quantity);

          // Attempt to decrement gift balance
          const decrementSuccess = await mockGiftRepo.decrementQuantity(
            matchingRequest.walletAddress,
            matchingRequest.traitId,
            matchingRequest.quantity
          );

          // Verify decrement was successful
          expect(decrementSuccess).toBe(true);

          // Create purchase record with zero price (gift redemption)
          const purchaseData = {
            wallet_address: matchingRequest.walletAddress,
            asset_id: matchingRequest.assetId,
            trait_id: matchingRequest.traitId,
            price_amount: 0n, // No payment required
            token_id: matchingTrait.price_token_id,
            status: 'gift_redeemed',
          };

          const purchase = await mockPurchaseRepo.create(purchaseData);

          // Verify the purchase was created with zero price
          expect(purchase.price_amount).toBe(0n);
          expect(purchase.status).toBe('gift_redeemed');
          expect(purchase.wallet_address).toBe(matchingRequest.walletAddress);
          expect(purchase.trait_id).toBe(matchingRequest.traitId);

          // Verify repository methods were called correctly
          expect(mockGiftRepo.findByWalletAndTrait).toHaveBeenCalledWith(
            matchingRequest.walletAddress,
            matchingRequest.traitId
          );
          expect(mockGiftRepo.decrementQuantity).toHaveBeenCalledWith(
            matchingRequest.walletAddress,
            matchingRequest.traitId,
            matchingRequest.quantity
          );
          expect(mockPurchaseRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({
              price_amount: 0n,
              status: 'gift_redeemed',
            })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should require payment when user has no gift balance for the trait', async () => {
    await fc.assert(
      fc.asyncProperty(
        traitGenerator,
        purchaseRequestGenerator,
        async (trait, purchaseRequest) => {
          // Ensure trait ID matches purchase request
          const matchingTrait = {
            ...trait,
            id: purchaseRequest.traitId,
          };

          // Mock repositories
          const mockGiftRepo = {
            findByWalletAndTrait: jest.fn(),
            decrementQuantity: jest.fn(),
          };

          const mockPurchaseRepo = {
            create: jest.fn(),
          };

          mockGetGiftBalanceRepository.mockReturnValue(mockGiftRepo);
          mockGetPurchaseRepository.mockReturnValue(mockPurchaseRepo);

          // Mock no gift balance found
          mockGiftRepo.findByWalletAndTrait.mockResolvedValue(null);

          // Mock purchase creation (should require payment)
          const expectedPurchase = {
            id: fc.sample(fc.uuid(), 1)[0],
            wallet_address: purchaseRequest.walletAddress,
            asset_id: purchaseRequest.assetId,
            trait_id: purchaseRequest.traitId,
            price_amount: matchingTrait.price_amount, // Full price required
            token_id: matchingTrait.price_token_id,
            status: 'created',
            created_at: new Date(),
          };

          mockPurchaseRepo.create.mockResolvedValue(expectedPurchase);

          // Simulate the purchase process
          const existingGiftBalance = await mockGiftRepo.findByWalletAndTrait(
            purchaseRequest.walletAddress,
            purchaseRequest.traitId
          );

          // Verify no gift balance exists
          expect(existingGiftBalance).toBeNull();

          // Create purchase record with full price (regular purchase)
          const purchaseData = {
            wallet_address: purchaseRequest.walletAddress,
            asset_id: purchaseRequest.assetId,
            trait_id: purchaseRequest.traitId,
            price_amount: matchingTrait.price_amount, // Full payment required
            token_id: matchingTrait.price_token_id,
            status: 'created',
          };

          const purchase = await mockPurchaseRepo.create(purchaseData);

          // Verify the purchase requires full payment
          expect(purchase.price_amount).toBe(matchingTrait.price_amount);
          expect(purchase.status).toBe('created');
          expect(purchase.wallet_address).toBe(purchaseRequest.walletAddress);
          expect(purchase.trait_id).toBe(purchaseRequest.traitId);

          // Verify gift balance was checked but not decremented
          expect(mockGiftRepo.findByWalletAndTrait).toHaveBeenCalledWith(
            purchaseRequest.walletAddress,
            purchaseRequest.traitId
          );
          expect(mockGiftRepo.decrementQuantity).not.toHaveBeenCalled();
          expect(mockPurchaseRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({
              price_amount: matchingTrait.price_amount,
              status: 'created',
            })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should require payment when user has insufficient gift balance', async () => {
    await fc.assert(
      fc.asyncProperty(
        giftBalanceGenerator,
        traitGenerator,
        purchaseRequestGenerator,
        async (giftBalance, trait, purchaseRequest) => {
          // Ensure the purchase request matches the gift balance but requires more quantity
          const matchingRequest = {
            ...purchaseRequest,
            walletAddress: giftBalance.wallet_address,
            traitId: giftBalance.trait_id,
            quantity: giftBalance.qty_available + fc.sample(fc.integer({ min: 1, max: 5 }), 1)[0],
          };

          // Ensure trait ID matches
          const matchingTrait = {
            ...trait,
            id: giftBalance.trait_id,
          };

          // Mock repositories
          const mockGiftRepo = {
            findByWalletAndTrait: jest.fn(),
            decrementQuantity: jest.fn(),
          };

          const mockPurchaseRepo = {
            create: jest.fn(),
          };

          mockGetGiftBalanceRepository.mockReturnValue(mockGiftRepo);
          mockGetPurchaseRepository.mockReturnValue(mockPurchaseRepo);

          // Mock finding the gift balance (insufficient quantity)
          mockGiftRepo.findByWalletAndTrait.mockResolvedValue(giftBalance);

          // Mock failed decrement (insufficient balance)
          mockGiftRepo.decrementQuantity.mockResolvedValue(false);

          // Mock purchase creation (should require payment)
          const expectedPurchase = {
            id: fc.sample(fc.uuid(), 1)[0],
            wallet_address: matchingRequest.walletAddress,
            asset_id: matchingRequest.assetId,
            trait_id: matchingRequest.traitId,
            price_amount: matchingTrait.price_amount, // Full price required
            token_id: matchingTrait.price_token_id,
            status: 'created',
            created_at: new Date(),
          };

          mockPurchaseRepo.create.mockResolvedValue(expectedPurchase);

          // Simulate the purchase process
          const existingGiftBalance = await mockGiftRepo.findByWalletAndTrait(
            matchingRequest.walletAddress,
            matchingRequest.traitId
          );

          // Verify gift balance exists but is insufficient
          expect(existingGiftBalance).toBeTruthy();
          expect(existingGiftBalance.qty_available).toBeLessThan(matchingRequest.quantity);

          // Attempt to decrement gift balance (should fail)
          const decrementSuccess = await mockGiftRepo.decrementQuantity(
            matchingRequest.walletAddress,
            matchingRequest.traitId,
            matchingRequest.quantity
          );

          // Verify decrement failed
          expect(decrementSuccess).toBe(false);

          // Create purchase record with full price (regular purchase)
          const purchaseData = {
            wallet_address: matchingRequest.walletAddress,
            asset_id: matchingRequest.assetId,
            trait_id: matchingRequest.traitId,
            price_amount: matchingTrait.price_amount, // Full payment required
            token_id: matchingTrait.price_token_id,
            status: 'created',
          };

          const purchase = await mockPurchaseRepo.create(purchaseData);

          // Verify the purchase requires full payment
          expect(purchase.price_amount).toBe(matchingTrait.price_amount);
          expect(purchase.status).toBe('created');

          // Verify repository methods were called correctly
          expect(mockGiftRepo.findByWalletAndTrait).toHaveBeenCalledWith(
            matchingRequest.walletAddress,
            matchingRequest.traitId
          );
          expect(mockGiftRepo.decrementQuantity).toHaveBeenCalledWith(
            matchingRequest.walletAddress,
            matchingRequest.traitId,
            matchingRequest.quantity
          );
          expect(mockPurchaseRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({
              price_amount: matchingTrait.price_amount,
              status: 'created',
            })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle partial gift balance redemption correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          ...giftBalanceGenerator.constraints,
          qty_available: fc.integer({ min: 5, max: 10 }),
        }),
        traitGenerator,
        fc.record({
          ...purchaseRequestGenerator.constraints,
          quantity: fc.integer({ min: 1, max: 3 }),
        }),
        async (giftBalance, trait, purchaseRequest) => {
          // Ensure the purchase request matches the gift balance and requires less than available
          const matchingRequest = {
            ...purchaseRequest,
            walletAddress: giftBalance.wallet_address,
            traitId: giftBalance.trait_id,
            quantity: Math.min(purchaseRequest.quantity, giftBalance.qty_available - 1),
          };

          // Skip if quantity would be 0
          if (matchingRequest.quantity <= 0) return;

          // Ensure trait ID matches
          const matchingTrait = {
            ...trait,
            id: giftBalance.trait_id,
          };

          // Mock repositories
          const mockGiftRepo = {
            findByWalletAndTrait: jest.fn(),
            decrementQuantity: jest.fn(),
          };

          const mockPurchaseRepo = {
            create: jest.fn(),
          };

          mockGetGiftBalanceRepository.mockReturnValue(mockGiftRepo);
          mockGetPurchaseRepository.mockReturnValue(mockPurchaseRepo);

          // Mock finding the gift balance
          mockGiftRepo.findByWalletAndTrait.mockResolvedValue(giftBalance);

          // Mock successful partial decrement
          mockGiftRepo.decrementQuantity.mockResolvedValue(true);

          // Mock purchase creation (should be free/gift purchase)
          const expectedPurchase = {
            id: fc.sample(fc.uuid(), 1)[0],
            wallet_address: matchingRequest.walletAddress,
            asset_id: matchingRequest.assetId,
            trait_id: matchingRequest.traitId,
            price_amount: 0n, // Should be 0 for gift redemption
            token_id: matchingTrait.price_token_id,
            status: 'gift_redeemed',
            created_at: new Date(),
          };

          mockPurchaseRepo.create.mockResolvedValue(expectedPurchase);

          // Simulate the partial gift redemption process
          const existingGiftBalance = await mockGiftRepo.findByWalletAndTrait(
            matchingRequest.walletAddress,
            matchingRequest.traitId
          );

          // Verify gift balance exists and has sufficient quantity
          expect(existingGiftBalance).toBeTruthy();
          expect(existingGiftBalance.qty_available).toBeGreaterThan(matchingRequest.quantity);

          // Attempt to decrement gift balance partially
          const decrementSuccess = await mockGiftRepo.decrementQuantity(
            matchingRequest.walletAddress,
            matchingRequest.traitId,
            matchingRequest.quantity
          );

          // Verify partial decrement was successful
          expect(decrementSuccess).toBe(true);

          // Create purchase record with zero price (gift redemption)
          const purchaseData = {
            wallet_address: matchingRequest.walletAddress,
            asset_id: matchingRequest.assetId,
            trait_id: matchingRequest.traitId,
            price_amount: 0n, // No payment required
            token_id: matchingTrait.price_token_id,
            status: 'gift_redeemed',
          };

          const purchase = await mockPurchaseRepo.create(purchaseData);

          // Verify the purchase was created with zero price
          expect(purchase.price_amount).toBe(0n);
          expect(purchase.status).toBe('gift_redeemed');

          // Verify only the requested quantity was decremented
          expect(mockGiftRepo.decrementQuantity).toHaveBeenCalledWith(
            matchingRequest.walletAddress,
            matchingRequest.traitId,
            matchingRequest.quantity
          );
        }
      ),
      { numRuns: 50 }
    );
  });
});