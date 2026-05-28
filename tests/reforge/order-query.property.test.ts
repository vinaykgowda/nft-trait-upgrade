import fc from 'fast-check';
import { ReforgeOrderStatus, ReforgeOrderWithPack } from '../../src/types/reforge';

// Feature: pv-reforge, Property 12: Order query completeness

/**
 * Property 12: Order query completeness
 *
 * For any wallet address with N reforge orders, querying orders by that wallet
 * should return exactly N orders, each with correct pack_id, status, and timestamps.
 *
 * **Validates: Requirements 12.1**
 */

// Mock the database module
jest.mock('../../src/lib/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

// Mock @solana/web3.js
jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn().mockImplementation(() => ({
    getSignatureStatus: jest.fn(),
    getLatestBlockhash: jest.fn().mockResolvedValue({
      blockhash: 'mock-blockhash-111111111111111111111111111111111111111',
      lastValidBlockHeight: 100,
    }),
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
import { ReforgeOrderRepository, ReforgeOrderRow, ReforgeOrderWithPackRow } from '../../src/lib/repositories/reforge-orders';

// Valid order statuses
const ORDER_STATUSES: ReforgeOrderStatus[] = ['bought', 'started_reforge', 'failed', 'completed'];

// Arbitrary for valid wallet addresses (base58-like strings)
const arbWalletAddress = fc.stringOf(
  fc.constantFrom(...'123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'.split('')),
  { minLength: 32, maxLength: 44 }
);

// Arbitrary for UUIDs
const arbUUID = fc.uuid();

// Arbitrary for discord IDs
const arbDiscordId = fc.stringOf(fc.constantFrom(...'0123456789'.split('')), { minLength: 17, maxLength: 20 });

// Arbitrary for pack tier names
const arbTierName = fc.constantFrom('silver', 'gold', 'diamond');

// Arbitrary for order status
const arbOrderStatus = fc.constantFrom(...ORDER_STATUSES);

// Arbitrary for a single order row with pack info
const arbOrderWithPack = (walletAddress: string) =>
  fc.record({
    id: arbUUID,
    pack_id: arbUUID,
    wallet_address: fc.constant(walletAddress),
    discord_id: arbDiscordId,
    asset_id: fc.option(arbUUID, { nil: null }),
    status: arbOrderStatus,
    used: fc.boolean(),
    purchase_tx_signature: fc.option(
      fc.stringOf(
        fc.constantFrom(...'123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'.split('')),
        { minLength: 64, maxLength: 88 }
      ),
      { nil: null }
    ),
    failure_reason: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
    created_at: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
    updated_at: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
    tier_name: fc.oneof(arbTierName, fc.constant(null)),
  }) as fc.Arbitrary<ReforgeOrderWithPackRow>;

describe('Order Query Completeness Property Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      TREASURY_WALLET: '11111111111111111111111111111112',
      ENCRYPTION_KEY: 'a'.repeat(64),
    };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Property 12: Order query completeness', () => {
    it('querying orders by wallet returns exactly N orders with correct pack_id, status, and timestamps', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbWalletAddress,
          fc.integer({ min: 0, max: 20 }),
          async (walletAddress, orderCount) => {
            // Generate N order rows for this wallet
            const orderRows: ReforgeOrderWithPackRow[] = [];
            for (let i = 0; i < orderCount; i++) {
              const row = fc.sample(arbOrderWithPack(walletAddress), 1)[0];
              orderRows.push(row);
            }

            // Create a mock repository that returns these rows
            const mockOrderRepo = {
              findByWalletWithPack: jest.fn(async (wallet: string): Promise<ReforgeOrderWithPackRow[]> => {
                return orderRows.filter((r) => r.wallet_address === wallet);
              }),
              toDomainWithPack: jest.fn((row: ReforgeOrderWithPackRow): ReforgeOrderWithPack => {
                return {
                  id: row.id,
                  packId: row.pack_id,
                  walletAddress: row.wallet_address,
                  discordId: row.discord_id,
                  assetId: row.asset_id,
                  status: row.status as ReforgeOrderStatus,
                  used: row.used,
                  purchaseTxSignature: row.purchase_tx_signature,
                  failureReason: row.failure_reason,
                  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
                  updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
                  tierName: row.tier_name || null,
                };
              }),
            } as unknown as ReforgeOrderRepository;

            const service = new ReforgeService({
              orderRepository: mockOrderRepo,
            });

            const results = await service.getOrdersByWallet(walletAddress);

            // Property: exactly N orders returned
            expect(results.length).toBe(orderCount);

            // Property: each order has correct pack_id, status, and timestamps
            for (let i = 0; i < orderCount; i++) {
              const result = results[i];
              const sourceRow = orderRows[i];

              expect(result.packId).toBe(sourceRow.pack_id);
              expect(result.status).toBe(sourceRow.status);
              expect(result.createdAt).toBe(
                sourceRow.created_at instanceof Date
                  ? sourceRow.created_at.toISOString()
                  : String(sourceRow.created_at)
              );
              expect(result.updatedAt).toBe(
                sourceRow.updated_at instanceof Date
                  ? sourceRow.updated_at.toISOString()
                  : String(sourceRow.updated_at)
              );
              // Also verify tierName is included from the join
              expect(result.tierName).toBe(sourceRow.tier_name || null);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('querying orders for a wallet with no orders returns an empty array', async () => {
      await fc.assert(
        fc.asyncProperty(arbWalletAddress, async (walletAddress) => {
          // Mock repository returns empty for any wallet
          const mockOrderRepo = {
            findByWalletWithPack: jest.fn(async (): Promise<ReforgeOrderWithPackRow[]> => []),
            toDomainWithPack: jest.fn(),
          } as unknown as ReforgeOrderRepository;

          const service = new ReforgeService({
            orderRepository: mockOrderRepo,
          });

          const results = await service.getOrdersByWallet(walletAddress);

          expect(results).toEqual([]);
          expect(results.length).toBe(0);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('orders from different wallets are not mixed in query results', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbWalletAddress,
          arbWalletAddress,
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 10 }),
          async (wallet1, wallet2, count1, count2) => {
            // Ensure wallets are different for a meaningful test
            fc.pre(wallet1 !== wallet2);

            // Generate orders for both wallets
            const wallet1Orders: ReforgeOrderWithPackRow[] = [];
            const wallet2Orders: ReforgeOrderWithPackRow[] = [];

            for (let i = 0; i < count1; i++) {
              wallet1Orders.push(fc.sample(arbOrderWithPack(wallet1), 1)[0]);
            }
            for (let i = 0; i < count2; i++) {
              wallet2Orders.push(fc.sample(arbOrderWithPack(wallet2), 1)[0]);
            }

            const allOrders = [...wallet1Orders, ...wallet2Orders];

            const mockOrderRepo = {
              findByWalletWithPack: jest.fn(async (wallet: string): Promise<ReforgeOrderWithPackRow[]> => {
                return allOrders.filter((r) => r.wallet_address === wallet);
              }),
              toDomainWithPack: jest.fn((row: ReforgeOrderWithPackRow): ReforgeOrderWithPack => {
                return {
                  id: row.id,
                  packId: row.pack_id,
                  walletAddress: row.wallet_address,
                  discordId: row.discord_id,
                  assetId: row.asset_id,
                  status: row.status as ReforgeOrderStatus,
                  used: row.used,
                  purchaseTxSignature: row.purchase_tx_signature,
                  failureReason: row.failure_reason,
                  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
                  updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
                  tierName: row.tier_name || null,
                };
              }),
            } as unknown as ReforgeOrderRepository;

            const service = new ReforgeService({
              orderRepository: mockOrderRepo,
            });

            const results1 = await service.getOrdersByWallet(wallet1);
            const results2 = await service.getOrdersByWallet(wallet2);

            // Property: wallet1 query returns exactly count1 orders
            expect(results1.length).toBe(count1);
            // Property: wallet2 query returns exactly count2 orders
            expect(results2.length).toBe(count2);

            // Property: all results for wallet1 belong to wallet1
            for (const order of results1) {
              expect(order.walletAddress).toBe(wallet1);
            }
            // Property: all results for wallet2 belong to wallet2
            for (const order of results2) {
              expect(order.walletAddress).toBe(wallet2);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
