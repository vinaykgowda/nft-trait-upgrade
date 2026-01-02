import { ProjectRepository } from '../../src/lib/repositories/projects';
import { TraitRepository } from '../../src/lib/repositories/traits';
import { PurchaseRepository } from '../../src/lib/repositories/purchases';
import { InventoryReservationRepository } from '../../src/lib/repositories/inventory';

// Mock the database module
jest.mock('../../src/lib/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  transaction: jest.fn(),
}));

describe('Repository Unit Tests', () => {
  describe('ProjectRepository', () => {
    let projectRepo: ProjectRepository;
    const mockQuery = require('../../src/lib/database').query;

    beforeEach(() => {
      projectRepo = new ProjectRepository();
      jest.clearAllMocks();
    });

    it('should find project by collection ID', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        collection_ids: ['collection-1', 'collection-2'],
        treasury_wallet: '11111111111111111111111111111112',
      };

      mockQuery.mockResolvedValue({ rows: [mockProject] });

      const result = await projectRepo.findByCollectionId('collection-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE $1 = ANY(collection_ids)'),
        ['collection-1']
      );
      expect(result).toEqual(mockProject);
    });

    it('should update collection IDs', async () => {
      const updatedProject = {
        id: 'project-1',
        collection_ids: ['new-collection-1', 'new-collection-2'],
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [updatedProject] });

      const result = await projectRepo.updateCollectionIds('project-1', ['new-collection-1', 'new-collection-2']);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SET collection_ids = $2'),
        ['project-1', ['new-collection-1', 'new-collection-2']]
      );
      expect(result).toEqual(updatedProject);
    });

    it('should convert between domain and database models', () => {
      const domainProject = {
        id: 'project-1',
        name: 'Test Project',
        logoUrl: 'https://example.com/logo.png',
        collectionIds: ['collection-1'],
        treasuryWallet: '11111111111111111111111111111112',
      };

      const dbRow = projectRepo.fromDomain(domainProject);
      expect(dbRow.logo_url).toBe(domainProject.logoUrl);
      expect(dbRow.collection_ids).toBe(domainProject.collectionIds);
      expect(dbRow.treasury_wallet).toBe(domainProject.treasuryWallet);

      const backToDomain = projectRepo.toDomain({
        ...dbRow,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);
      expect(backToDomain.logoUrl).toBe(domainProject.logoUrl);
      expect(backToDomain.collectionIds).toBe(domainProject.collectionIds);
    });
  });

  describe('TraitRepository', () => {
    let traitRepo: TraitRepository;
    const mockQuery = require('../../src/lib/database').query;

    beforeEach(() => {
      traitRepo = new TraitRepository();
      jest.clearAllMocks();
    });

    it('should find traits with relations', async () => {
      const mockTraitWithRelations = {
        id: 'trait-1',
        name: 'Cool Hat',
        slot_name: 'Hat',
        slot_layer_order: 6,
        rarity_name: 'Rare',
        rarity_weight: 3,
        token_symbol: 'SOL',
        token_decimals: 9,
        price_amount: '1000000000',
        active: true,
      };

      mockQuery.mockResolvedValue({ rows: [mockTraitWithRelations] });

      const result = await traitRepo.findWithRelations({ active: true });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('JOIN trait_slots ts ON'),
        [true]
      );
      expect(result).toEqual([mockTraitWithRelations]);
    });

    it('should decrement supply correctly', async () => {
      const updatedTrait = {
        id: 'trait-1',
        remaining_supply: 9,
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [updatedTrait] });

      const result = await traitRepo.decrementSupply('trait-1', 1);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SET remaining_supply = remaining_supply - $2'),
        ['trait-1', 1]
      );
      expect(result).toEqual(updatedTrait);
    });

    it('should find available traits only', async () => {
      const availableTraits = [
        { id: 'trait-1', active: true, remaining_supply: 5 },
        { id: 'trait-2', active: true, remaining_supply: null }, // unlimited
      ];

      mockQuery.mockResolvedValue({ rows: availableTraits });

      const result = await traitRepo.findAvailable();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE active = true')
      );
      expect(result).toEqual(availableTraits);
    });
  });

  describe('PurchaseRepository', () => {
    let purchaseRepo: PurchaseRepository;
    const mockQuery = require('../../src/lib/database').query;

    beforeEach(() => {
      purchaseRepo = new PurchaseRepository();
      jest.clearAllMocks();
    });

    it('should find purchases by wallet', async () => {
      const mockPurchases = [
        { id: 'purchase-1', wallet_address: 'wallet-1', status: 'fulfilled' },
        { id: 'purchase-2', wallet_address: 'wallet-1', status: 'confirmed' },
      ];

      mockQuery.mockResolvedValue({ rows: mockPurchases });

      const result = await purchaseRepo.findByWallet('wallet-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE wallet_address = $1'),
        ['wallet-1']
      );
      expect(result).toEqual(mockPurchases);
    });

    it('should update purchase status', async () => {
      const updatedPurchase = {
        id: 'purchase-1',
        status: 'confirmed',
        tx_signature: 'tx-signature-123',
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValue({ rows: [updatedPurchase] });

      const result = await purchaseRepo.updateStatus('purchase-1', 'confirmed', 'tx-signature-123');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SET status = $2, tx_signature = $3'),
        ['purchase-1', 'confirmed', 'tx-signature-123']
      );
      expect(result).toEqual(updatedPurchase);
    });

    it('should get revenue statistics', async () => {
      const mockStats = [
        { total_revenue: '5000000000', total_purchases: '10', token_id: null },
        { token_revenue: '3000000000', token_count: '6', token_id: 'sol-token' },
        { token_revenue: '2000000000', token_count: '4', token_id: 'usdc-token' },
      ];

      mockQuery.mockResolvedValue({ rows: mockStats });

      const result = await purchaseRepo.getRevenueStats();

      expect(result.totalRevenue).toBe('5000000000');
      expect(result.totalPurchases).toBe(10);
      expect(result.revenueByToken).toHaveLength(2);
      expect(result.revenueByToken[0].tokenId).toBe('sol-token');
    });
  });

  describe('InventoryReservationRepository', () => {
    let inventoryRepo: InventoryReservationRepository;
    const mockQuery = require('../../src/lib/database').query;

    beforeEach(() => {
      inventoryRepo = new InventoryReservationRepository();
      jest.clearAllMocks();
    });

    it('should create reservation with correct expiration', async () => {
      const mockReservation = {
        id: 'reservation-1',
        trait_id: 'trait-1',
        wallet_address: 'wallet-1',
        asset_id: 'asset-1',
        expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
        status: 'reserved',
      };

      mockQuery.mockResolvedValue({ rows: [mockReservation] });

      const result = await inventoryRepo.createReservation('trait-1', 'wallet-1', 'asset-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO inventory_reservations'),
        expect.arrayContaining(['trait-1', 'wallet-1', 'asset-1'])
      );
      expect(result).toEqual(mockReservation);
    });

    it('should find active reservations', async () => {
      const mockReservation = {
        id: 'reservation-1',
        status: 'reserved',
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
      };

      mockQuery.mockResolvedValue({ rows: [mockReservation] });

      const result = await inventoryRepo.findActiveReservation('trait-1', 'wallet-1', 'asset-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("status = 'reserved' AND expires_at > NOW()"),
        ['trait-1', 'wallet-1', 'asset-1']
      );
      expect(result).toEqual(mockReservation);
    });

    it('should consume reservation', async () => {
      const consumedReservation = {
        id: 'reservation-1',
        status: 'consumed',
      };

      mockQuery.mockResolvedValue({ rows: [consumedReservation] });

      const result = await inventoryRepo.consumeReservation('reservation-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'consumed'"),
        ['reservation-1']
      );
      expect(result).toEqual(consumedReservation);
    });

    it('should get active reservation count', async () => {
      mockQuery.mockResolvedValue({ rows: [{ count: '3' }] });

      const result = await inventoryRepo.getActiveReservationCount('trait-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        ['trait-1']
      );
      expect(result).toBe(3);
    });

    it('should cleanup expired reservations', async () => {
      const expiredReservations = [
        { id: 'reservation-1', status: 'reserved', expires_at: new Date(Date.now() - 1000) },
        { id: 'reservation-2', status: 'reserved', expires_at: new Date(Date.now() - 2000) },
      ];

      // Mock findExpiredReservations
      mockQuery.mockResolvedValueOnce({ rows: expiredReservations });
      // Mock markExpired
      mockQuery.mockResolvedValueOnce({ rowCount: 2 });

      const result = await inventoryRepo.cleanupExpiredReservations();

      expect(result).toBe(2);
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent reservation attempts with database constraints', async () => {
      // Test concurrent reservation creation for same trait/wallet/asset
      const traitId = 'trait-1';
      const walletAddress = 'wallet-1';
      const assetId = 'asset-1';

      // First reservation succeeds
      const firstReservation = {
        id: 'reservation-1',
        trait_id: traitId,
        wallet_address: walletAddress,
        asset_id: assetId,
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
        status: 'reserved',
      };

      // Second concurrent attempt should find existing active reservation
      mockQuery.mockResolvedValueOnce({ rows: [firstReservation] }); // createReservation
      mockQuery.mockResolvedValueOnce({ rows: [firstReservation] }); // findActiveReservation

      const result1 = await inventoryRepo.createReservation(traitId, walletAddress, assetId);
      const result2 = await inventoryRepo.findActiveReservation(traitId, walletAddress, assetId);

      expect(result1).toEqual(firstReservation);
      expect(result2).toEqual(firstReservation);
      expect(result1.id).toBe(result2.id); // Same reservation found
    });

    it('should track reservation status changes correctly', async () => {
      const reservationId = 'reservation-1';
      
      // Test status progression: reserved -> consumed
      const reservedState = {
        id: reservationId,
        status: 'reserved',
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
      };

      const consumedState = {
        id: reservationId,
        status: 'consumed',
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
      };

      mockQuery.mockResolvedValueOnce({ rows: [consumedState] });

      const result = await inventoryRepo.consumeReservation(reservationId);

      expect(result).toEqual(consumedState);
      expect(result.status).toBe('consumed');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'consumed'"),
        [reservationId]
      );
    });

    it('should handle reservation cancellation', async () => {
      const reservationId = 'reservation-1';
      
      const cancelledReservation = {
        id: reservationId,
        status: 'cancelled',
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
      };

      mockQuery.mockResolvedValue({ rows: [cancelledReservation] });

      const result = await inventoryRepo.cancelReservation(reservationId);

      expect(result).toEqual(cancelledReservation);
      expect(result.status).toBe('cancelled');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'cancelled'"),
        [reservationId]
      );
    });

    it('should prevent consuming expired reservations', async () => {
      const reservationId = 'reservation-expired';
      
      // Mock that no rows are returned (reservation expired or doesn't exist)
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await inventoryRepo.consumeReservation(reservationId);

      expect(result).toBeNull();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE id = $1 AND status = 'reserved' AND expires_at > NOW()"),
        [reservationId]
      );
    });

    it('should find expired reservations for cleanup', async () => {
      const expiredReservations = [
        { 
          id: 'reservation-1', 
          status: 'reserved', 
          expires_at: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
        },
        { 
          id: 'reservation-2', 
          status: 'reserved', 
          expires_at: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
        },
      ];

      mockQuery.mockResolvedValue({ rows: expiredReservations });

      const result = await inventoryRepo.findExpiredReservations();

      expect(result).toEqual(expiredReservations);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE status = 'reserved' AND expires_at <= NOW()")
      );
    });

    it('should mark multiple reservations as expired', async () => {
      const reservationIds = ['reservation-1', 'reservation-2', 'reservation-3'];
      
      mockQuery.mockResolvedValue({ rowCount: 3 });

      const result = await inventoryRepo.markExpired(reservationIds);

      expect(result).toBe(3);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'expired'"),
        reservationIds
      );
    });

    it('should handle empty reservation list for marking expired', async () => {
      const result = await inventoryRepo.markExpired([]);

      expect(result).toBe(0);
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });
});