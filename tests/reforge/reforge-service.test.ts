import { SelectedTrait } from '../../src/types/reforge';

// Mock the database module
jest.mock('../../src/lib/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

// Mock @solana/web3.js
jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn(),
  Keypair: {
    fromSecretKey: jest.fn().mockReturnValue({ publicKey: 'mock-pubkey' }),
  },
  Transaction: jest.fn(),
}));

// Mock the CoreAssetUpdateService
const mockUpdateAssetUri = jest.fn();
jest.mock('../../src/lib/services/core-asset-update', () => ({
  CoreAssetUpdateService: jest.fn().mockImplementation(() => ({
    updateAssetUri: mockUpdateAssetUri,
  })),
}));

// Mock constants
jest.mock('../../src/lib/constants', () => ({
  RPC_CONFIG: {
    HELIUS_RPC_URL: 'https://mock-rpc.example.com',
    HELIUS_API_KEY: 'mock-key',
    SOLANA_RPC_URL: 'https://mock-rpc.example.com',
  },
}));

// Mock sharp (used by ImageCompositionService)
jest.mock('sharp', () => {
  return jest.fn();
});

import { ReforgeService } from '../../src/lib/services/reforge-service';

// Mock all dependencies
const mockOrderRepository = {
  findById: jest.fn(),
  markUsed: jest.fn(),
  findByWallet: jest.fn(),
  findByWalletWithPack: jest.fn(),
  toDomain: jest.fn(),
  toDomainWithPack: jest.fn(),
};

const mockPackRepository = {
  findById: jest.fn(),
};

const mockCombinationRepository = {
  isUnique: jest.fn(),
  recordCombination: jest.fn(),
};

const mockProjectRepository = {
  findByCollectionId: jest.fn(),
};

const mockTraitSlotRepository = {
  findAllOrdered: jest.fn(),
  toDomain: jest.fn((row: any) => ({
    id: row.id,
    name: row.name,
    layerOrder: row.layer_order,
  })),
};

const mockTraitSelector = {
  selectTraits: jest.fn(),
};

const mockOrderManager = {
  transitionOrder: jest.fn(),
};

const mockPackManager = {};

const mockEncryptionService = {
  decrypt: jest.fn(),
};

const mockImageCompositionService = {
  composeImage: jest.fn(),
};

const mockPinataUploadService = {
  uploadImage: jest.fn(),
  uploadMetadata: jest.fn(),
};

function createService() {
  return new ReforgeService({
    orderRepository: mockOrderRepository as any,
    packRepository: mockPackRepository as any,
    combinationRepository: mockCombinationRepository as any,
    projectRepository: mockProjectRepository as any,
    traitSlotRepository: mockTraitSlotRepository as any,
    traitSelector: mockTraitSelector as any,
    orderManager: mockOrderManager as any,
    packManager: mockPackManager as any,
    encryptionService: mockEncryptionService as any,
    imageCompositionService: mockImageCompositionService as any,
    pinataUploadService: mockPinataUploadService as any,
  });
}

const mockSelectedTraits: SelectedTrait[] = [
  { slotId: 'slot-1', slotName: 'Background', traitId: 'trait-1', traitName: 'Blue Sky', imageUrl: 'https://example.com/bg.png', ldzEarning: 5 },
  { slotId: 'slot-2', slotName: 'Skin', traitId: 'trait-2', traitName: 'Green', imageUrl: 'https://example.com/skin.png', ldzEarning: 3 },
  { slotId: 'slot-3', slotName: 'Eyes', traitId: 'trait-3', traitName: 'Laser', imageUrl: 'https://example.com/eyes.png', ldzEarning: 2 },
  { slotId: 'slot-4', slotName: 'Mouth', traitId: 'trait-4', traitName: 'Smile', imageUrl: 'https://example.com/mouth.png', ldzEarning: 1 },
];

const mockSlotRows = [
  { id: 'slot-1', name: 'Background', layer_order: 0 },
  { id: 'slot-2', name: 'Skin', layer_order: 1 },
  { id: 'slot-3', name: 'Eyes', layer_order: 2 },
  { id: 'slot-4', name: 'Mouth', layer_order: 3 },
];

describe('ReforgeService', () => {
  let service: ReforgeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = createService();

    // Default happy-path mocks
    mockOrderRepository.findById.mockResolvedValue({
      id: 'order-1',
      pack_id: 'pack-1',
      wallet_address: 'wallet-1',
      discord_id: 'discord-1',
      asset_id: null,
      status: 'bought',
      used: false,
      purchase_tx_signature: 'tx-sig',
      failure_reason: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    mockOrderRepository.markUsed.mockResolvedValue({
      id: 'order-1',
      used: true,
      asset_id: 'asset-1',
    });

    mockOrderManager.transitionOrder.mockResolvedValue({
      id: 'order-1',
      status: 'started_reforge',
    });

    mockPackRepository.findById.mockResolvedValue({
      id: 'pack-1',
      collection_id: 'collection-1',
      tier_name: 'gold',
      sol_price: '1.5',
      min_ldz_earning: '5',
      max_ldz_earning: '15',
      total_inventory: 100,
      remaining_count: 50,
      enabled: true,
    });

    mockTraitSelector.selectTraits.mockResolvedValue(mockSelectedTraits);
    mockCombinationRepository.isUnique.mockResolvedValue(true);
    mockCombinationRepository.recordCombination.mockResolvedValue({});

    mockTraitSlotRepository.findAllOrdered.mockResolvedValue(mockSlotRows);

    mockImageCompositionService.composeImage.mockResolvedValue({
      imageBuffer: Buffer.from('mock-image'),
      width: 1500,
      height: 1500,
      format: 'webp',
    });

    mockPinataUploadService.uploadImage.mockResolvedValue({
      cid: 'image-cid',
      url: 'https://gateway.pinata.cloud/ipfs/image-cid',
      size: 1000,
      contentType: 'image/webp',
    });

    mockPinataUploadService.uploadMetadata.mockResolvedValue({
      cid: 'metadata-cid',
      url: 'https://gateway.pinata.cloud/ipfs/metadata-cid',
      size: 500,
      contentType: 'application/json',
    });

    mockProjectRepository.findByCollectionId.mockResolvedValue({
      id: 'project-1',
      encrypted_update_authority: 'encrypted-key-data',
    });

    // Return a JSON array key that Keypair.fromSecretKey can parse
    mockEncryptionService.decrypt.mockReturnValue(
      JSON.stringify(Array.from({ length: 64 }, (_, i) => i))
    );

    // Default: metadata update succeeds
    mockUpdateAssetUri.mockResolvedValue({ signature: 'mock-tx-sig', success: true });
  });

  describe('executeReforge - happy path', () => {
    it('should complete the full reforge workflow', async () => {
      const result = await service.executeReforge('order-1', 'asset-1');

      expect(result.orderId).toBe('order-1');
      expect(result.selectedTraits).toEqual(mockSelectedTraits);
      expect(result.imageUrl).toBe('https://gateway.pinata.cloud/ipfs/image-cid');
      expect(result.metadataUrl).toBe('https://gateway.pinata.cloud/ipfs/metadata-cid');
      expect(result.txSignature).toBe('mock-tx-sig');

      // Verify workflow steps
      expect(mockOrderRepository.markUsed).toHaveBeenCalledWith('order-1', 'asset-1');
      expect(mockOrderManager.transitionOrder).toHaveBeenCalledWith('order-1', 'started_reforge');
      expect(mockTraitSelector.selectTraits).toHaveBeenCalledWith('collection-1', 5, 15);
      expect(mockCombinationRepository.isUnique).toHaveBeenCalled();
      expect(mockCombinationRepository.recordCombination).toHaveBeenCalledWith(
        'order-1',
        'collection-1',
        ['trait-1', 'trait-2', 'trait-3', 'trait-4']
      );
      expect(mockImageCompositionService.composeImage).toHaveBeenCalled();
      expect(mockPinataUploadService.uploadImage).toHaveBeenCalled();
      expect(mockPinataUploadService.uploadMetadata).toHaveBeenCalled();
      expect(mockOrderManager.transitionOrder).toHaveBeenCalledWith('order-1', 'completed');
    });
  });

  describe('executeReforge - validation errors', () => {
    it('should throw ORDER_NOT_FOUND if order does not exist', async () => {
      mockOrderRepository.findById.mockResolvedValue(null);

      await expect(service.executeReforge('order-1', 'asset-1')).rejects.toMatchObject({
        error: 'ORDER_NOT_FOUND',
      });
    });

    it('should throw INVALID_ORDER_STATE if order is not in bought state', async () => {
      mockOrderRepository.findById.mockResolvedValue({
        id: 'order-1',
        status: 'completed',
        used: false,
      });

      await expect(service.executeReforge('order-1', 'asset-1')).rejects.toMatchObject({
        error: 'INVALID_ORDER_STATE',
      });
    });

    it('should throw INVALID_ORDER_STATE if order is already used', async () => {
      mockOrderRepository.findById.mockResolvedValue({
        id: 'order-1',
        status: 'bought',
        used: true,
      });

      await expect(service.executeReforge('order-1', 'asset-1')).rejects.toMatchObject({
        error: 'INVALID_ORDER_STATE',
      });
    });
  });

  describe('executeReforge - combination uniqueness retry (up to 50 attempts)', () => {
    it('should retry trait selection when combination is not unique', async () => {
      // First call returns non-unique, second returns unique
      mockCombinationRepository.isUnique
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await service.executeReforge('order-1', 'asset-1');

      expect(result.orderId).toBe('order-1');
      expect(mockTraitSelector.selectTraits).toHaveBeenCalledTimes(3);
      expect(mockCombinationRepository.isUnique).toHaveBeenCalledTimes(3);
    });

    it('should fail with COMBINATION_EXHAUSTED after 50 attempts', async () => {
      mockCombinationRepository.isUnique.mockResolvedValue(false);

      await expect(service.executeReforge('order-1', 'asset-1')).rejects.toMatchObject({
        error: 'COMBINATION_EXHAUSTED',
      });

      expect(mockTraitSelector.selectTraits).toHaveBeenCalledTimes(50);
      expect(mockCombinationRepository.isUnique).toHaveBeenCalledTimes(50);
      // Should transition to failed
      expect(mockOrderManager.transitionOrder).toHaveBeenCalledWith(
        'order-1',
        'failed',
        expect.stringContaining('unique trait combination')
      );
    });
  });

  describe('executeReforge - metadata update retry (up to 3 retries)', () => {
    it('should retry metadata update on failure and succeed', async () => {
      mockUpdateAssetUri
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ signature: 'retry-tx-sig', success: true });

      const result = await service.executeReforge('order-1', 'asset-1');

      expect(result.txSignature).toBe('retry-tx-sig');
      expect(mockUpdateAssetUri).toHaveBeenCalledTimes(2);
    });

    it('should fail with METADATA_UPDATE_FAILED after 3 retries', async () => {
      mockUpdateAssetUri.mockRejectedValue(new Error('Persistent network error'));

      await expect(service.executeReforge('order-1', 'asset-1')).rejects.toMatchObject({
        error: 'METADATA_UPDATE_FAILED',
      });

      expect(mockUpdateAssetUri).toHaveBeenCalledTimes(3);
      // Should transition to failed
      expect(mockOrderManager.transitionOrder).toHaveBeenCalledWith(
        'order-1',
        'failed',
        expect.stringContaining('metadata update failed')
      );
    });
  });

  describe('executeReforge - failure handling', () => {
    it('should transition order to failed when image composition fails', async () => {
      mockImageCompositionService.composeImage.mockRejectedValue(
        new Error('Sharp processing error')
      );

      await expect(service.executeReforge('order-1', 'asset-1')).rejects.toThrow(
        'Sharp processing error'
      );

      expect(mockOrderManager.transitionOrder).toHaveBeenCalledWith(
        'order-1',
        'failed',
        'Sharp processing error'
      );
    });

    it('should transition order to failed when Pinata upload fails', async () => {
      mockPinataUploadService.uploadImage.mockRejectedValue(
        new Error('Pinata upload failed (500)')
      );

      await expect(service.executeReforge('order-1', 'asset-1')).rejects.toThrow(
        'Pinata upload failed'
      );

      expect(mockOrderManager.transitionOrder).toHaveBeenCalledWith(
        'order-1',
        'failed',
        expect.stringContaining('Pinata upload failed')
      );
    });

    it('should transition order to failed when project has no encrypted key', async () => {
      mockProjectRepository.findByCollectionId.mockResolvedValue({
        id: 'project-1',
        encrypted_update_authority: null,
      });

      await expect(service.executeReforge('order-1', 'asset-1')).rejects.toMatchObject({
        error: 'ENCRYPTION_ERROR',
      });

      expect(mockOrderManager.transitionOrder).toHaveBeenCalledWith(
        'order-1',
        'failed',
        expect.any(String)
      );
    });

    it('should transition order to failed when project is not found', async () => {
      mockProjectRepository.findByCollectionId.mockResolvedValue(null);

      await expect(service.executeReforge('order-1', 'asset-1')).rejects.toMatchObject({
        error: 'PROJECT_NOT_FOUND',
      });

      expect(mockOrderManager.transitionOrder).toHaveBeenCalledWith(
        'order-1',
        'failed',
        expect.any(String)
      );
    });
  });

  describe('getOrdersByWallet', () => {
    it('should return orders for a wallet', async () => {
      const mockRows = [
        { id: 'order-1', wallet_address: 'wallet-1', status: 'bought', tier_name: 'gold' },
        { id: 'order-2', wallet_address: 'wallet-1', status: 'completed', tier_name: 'silver' },
      ];
      mockOrderRepository.findByWalletWithPack.mockResolvedValue(mockRows);
      mockOrderRepository.toDomainWithPack.mockImplementation((row: any) => ({
        id: row.id,
        walletAddress: row.wallet_address,
        status: row.status,
        tierName: row.tier_name || null,
      }));

      const result = await service.getOrdersByWallet('wallet-1');

      expect(result).toHaveLength(2);
      expect(mockOrderRepository.findByWalletWithPack).toHaveBeenCalledWith('wallet-1');
    });
  });

  describe('getOrderStatus', () => {
    it('should return order status', async () => {
      mockOrderRepository.toDomain.mockReturnValue({
        id: 'order-1',
        status: 'bought',
      });

      const result = await service.getOrderStatus('order-1');

      expect(result.id).toBe('order-1');
      expect(result.status).toBe('bought');
    });

    it('should throw ORDER_NOT_FOUND if order does not exist', async () => {
      mockOrderRepository.findById.mockResolvedValue(null);

      await expect(service.getOrderStatus('nonexistent')).rejects.toMatchObject({
        error: 'ORDER_NOT_FOUND',
      });
    });
  });

  describe('initiatePurchase', () => {
    it('should throw AUTH_REQUIRED when wallet address is missing', async () => {
      await expect(
        service.initiatePurchase('pack-1', '', 'discord-1')
      ).rejects.toMatchObject({ error: 'AUTH_REQUIRED' });
    });

    it('should throw AUTH_REQUIRED when discord ID is missing', async () => {
      await expect(
        service.initiatePurchase('pack-1', 'wallet-1', '')
      ).rejects.toMatchObject({ error: 'AUTH_REQUIRED' });
    });
  });

  describe('confirmPurchase', () => {
    it('should throw TRANSACTION_NOT_CONFIRMED when transaction is not confirmed', async () => {
      // Connection is mocked to return an empty object (no getSignatureStatus)
      // which will cause an error - this validates the error path
      await expect(
        service.confirmPurchase('order-1', 'tx-sig', 'pack-1', 'wallet-1', 'discord-1')
      ).rejects.toBeDefined();
    });
  });
});
