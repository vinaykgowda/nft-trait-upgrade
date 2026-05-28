import fc from 'fast-check';
import { PackTier, ReforgePack } from '../../src/types/reforge';

// Feature: pv-reforge, Property 5: Purchase atomicity

/**
 * Property 5: Purchase atomicity
 *
 * For any pack purchase attempt, a Reforge_Order is created and inventory is decremented
 * if and only if the payment transaction is confirmed on-chain. If the transaction fails
 * or is not confirmed, no order exists and inventory is unchanged.
 *
 * **Validates: Requirements 4.3, 4.4**
 */

// Mock the database module
jest.mock('../../src/lib/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

// Mock @solana/web3.js - fully mock to avoid ESM issues
const mockGetSignatureStatus = jest.fn();
const mockGetLatestBlockhash = jest.fn().mockResolvedValue({
  blockhash: 'mock-blockhash-111111111111111111111111111111111111111',
  lastValidBlockHeight: 100,
});

jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn().mockImplementation(() => ({
    getSignatureStatus: mockGetSignatureStatus,
    getLatestBlockhash: mockGetLatestBlockhash,
  })),
  PublicKey: jest.fn().mockImplementation((key: string) => ({ toBase58: () => key, toString: () => key })),
  SystemProgram: {
    transfer: jest.fn().mockReturnValue({ programId: 'system', keys: [], data: Buffer.from([]) }),
  },
  Transaction: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    recentBlockhash: null,
    feePayer: null,
  })),
  Keypair: { fromSecretKey: jest.fn() },
}));

// Mock constants
jest.mock('../../src/lib/constants', () => ({
  RPC_CONFIG: {
    HELIUS_RPC_URL: 'https://mock-rpc.example.com',
    HELIUS_API_KEY: 'mock-key',
    SOLANA_RPC_URL: 'https://mock-rpc.example.com',
  },
}));

// Mock sharp
jest.mock('sharp', () => jest.fn());

import { ReforgeService } from '../../src/lib/services/reforge-service';
import { ReforgeOrderRepository, ReforgeOrderRow } from '../../src/lib/repositories/reforge-orders';
import { ReforgePackRepository, ReforgePackRow } from '../../src/lib/repositories/reforge-packs';
import { PackManager } from '../../src/lib/services/pack-manager';

/**
 * Create mock repositories and pack manager for testing purchase atomicity.
 */
function createMockDeps() {
  const orderStore = new Map<string, ReforgeOrderRow>();
  const packStore = new Map<string, ReforgePackRow>();

  const orderRepo = {
    create: jest.fn(async (data: Partial<ReforgeOrderRow>): Promise<ReforgeOrderRow> => {
      const id = data.id || `order-${Date.now()}`;
      const now = new Date();
      const row: ReforgeOrderRow = {
        id,
        pack_id: data.pack_id || '',
        wallet_address: data.wallet_address || '',
        discord_id: data.discord_id || '',
        asset_id: data.asset_id || null,
        status: data.status || 'bought',
        used: data.used ?? false,
        purchase_tx_signature: data.purchase_tx_signature || null,
        failure_reason: data.failure_reason || null,
        created_at: now,
        updated_at: now,
      };
      orderStore.set(id, row);
      return row;
    }),
    findById: jest.fn(async (id: string) => orderStore.get(id) || null),
    toDomain: jest.fn((row: ReforgeOrderRow) => ({
      id: row.id,
      packId: row.pack_id,
      walletAddress: row.wallet_address,
      discordId: row.discord_id,
      assetId: row.asset_id,
      status: row.status as any,
      used: row.used,
      purchaseTxSignature: row.purchase_tx_signature,
      failureReason: row.failure_reason,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    })),
  } as unknown as ReforgeOrderRepository;

  const packRepo = {
    findById: jest.fn(async (id: string) => packStore.get(id) || null),
    decrementInventory: jest.fn(async (id: string) => {
      const row = packStore.get(id);
      if (!row || row.remaining_count <= 0) return null;
      row.remaining_count -= 1;
      row.updated_at = new Date();
      packStore.set(id, row);
      return { ...row };
    }),
    toDomain: jest.fn((row: ReforgePackRow): ReforgePack => ({
      id: row.id,
      collectionId: row.collection_id,
      tierName: row.tier_name as PackTier,
      solPrice: parseFloat(row.sol_price),
      minLdzEarning: parseFloat(row.min_ldz_earning),
      maxLdzEarning: parseFloat(row.max_ldz_earning),
      totalInventory: row.total_inventory,
      remainingCount: row.remaining_count,
      enabled: row.enabled,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    })),
  } as unknown as ReforgePackRepository;

  const packManager = new PackManager(packRepo);

  return { orderRepo, packRepo, packManager, orderStore, packStore };
}

/**
 * Helper to add a pack to the mock store.
 */
function addPackToStore(
  packStore: Map<string, ReforgePackRow>,
  overrides: Partial<ReforgePackRow> = {}
): ReforgePackRow {
  const id = overrides.id || 'test-pack-1';
  const row: ReforgePackRow = {
    id,
    collection_id: 'collection-1',
    tier_name: 'gold',
    sol_price: '1.5',
    min_ldz_earning: '10',
    max_ldz_earning: '50',
    total_inventory: 100,
    remaining_count: 50,
    enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
  packStore.set(id, row);
  return row;
}

// Arbitrary for valid wallet addresses (base58-like strings)
const arbWalletAddress = fc.stringOf(
  fc.constantFrom(...'123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'.split('')),
  { minLength: 32, maxLength: 44 }
);

// Arbitrary for discord IDs
const arbDiscordId = fc.stringOf(fc.constantFrom(...'0123456789'.split('')), { minLength: 17, maxLength: 20 });

// Arbitrary for transaction signatures (base58-like)
const arbTxSignature = fc.stringOf(
  fc.constantFrom(...'123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'.split('')),
  { minLength: 64, maxLength: 88 }
);

describe('Purchase Atomicity Property Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      TREASURY_WALLET: '11111111111111111111111111111112',
      ENCRYPTION_KEY: 'a'.repeat(64), // 64-char hex string for EncryptionService
    };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Property 5: Purchase atomicity', () => {
    it('order is created and inventory decremented if and only if transaction is confirmed', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbWalletAddress,
          arbDiscordId,
          arbTxSignature,
          fc.boolean(), // whether the transaction is confirmed
          async (walletAddress, discordId, txSignature, isConfirmed) => {
            const { orderRepo, packRepo, packManager, orderStore, packStore } = createMockDeps();

            // Set up a pack with inventory
            const initialRemaining = 50;
            addPackToStore(packStore, { remaining_count: initialRemaining });

            // Mock the Connection's getSignatureStatus based on isConfirmed
            mockGetSignatureStatus.mockResolvedValue({
              value: isConfirmed
                ? { confirmationStatus: 'confirmed', err: null }
                : { confirmationStatus: 'processed', err: null },
            });

            const service = new ReforgeService({
              orderRepository: orderRepo,
              packRepository: packRepo,
              packManager,
            });

            if (isConfirmed) {
              // Transaction confirmed: order should be created and inventory decremented
              const order = await service.confirmPurchase(
                'order-id-1',
                txSignature,
                'test-pack-1',
                walletAddress,
                discordId
              );

              expect(order).toBeDefined();
              expect(order.status).toBe('bought');
              expect(order.purchaseTxSignature).toBe(txSignature);
              expect(orderStore.size).toBe(1);

              const pack = packStore.get('test-pack-1')!;
              expect(pack.remaining_count).toBe(initialRemaining - 1);
            } else {
              // Transaction NOT confirmed: no order, inventory unchanged
              await expect(
                service.confirmPurchase(
                  'order-id-1',
                  txSignature,
                  'test-pack-1',
                  walletAddress,
                  discordId
                )
              ).rejects.toMatchObject({ error: 'TRANSACTION_NOT_CONFIRMED' });

              expect(orderStore.size).toBe(0);

              const pack = packStore.get('test-pack-1')!;
              expect(pack.remaining_count).toBe(initialRemaining);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('no order is created when transaction has an error', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbWalletAddress,
          arbDiscordId,
          arbTxSignature,
          async (walletAddress, discordId, txSignature) => {
            const { orderRepo, packRepo, packManager, orderStore, packStore } = createMockDeps();

            const initialRemaining = 50;
            addPackToStore(packStore, { remaining_count: initialRemaining });

            // Mock transaction as confirmed but with an error
            mockGetSignatureStatus.mockResolvedValue({
              value: { confirmationStatus: 'confirmed', err: { InstructionError: [0, 'Custom'] } },
            });

            const service = new ReforgeService({
              orderRepository: orderRepo,
              packRepository: packRepo,
              packManager,
            });

            await expect(
              service.confirmPurchase('order-id-2', txSignature, 'test-pack-1', walletAddress, discordId)
            ).rejects.toMatchObject({ error: 'TRANSACTION_NOT_CONFIRMED' });

            // No order should exist
            expect(orderStore.size).toBe(0);

            // Inventory should be unchanged
            const pack = packStore.get('test-pack-1')!;
            expect(pack.remaining_count).toBe(initialRemaining);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
