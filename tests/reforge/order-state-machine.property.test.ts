import fc from 'fast-check';
import { ReforgeOrderManager } from '../../src/lib/services/reforge-order-manager';
import { ReforgeOrderStatus } from '../../src/types/reforge';

// Feature: pv-reforge, Property 7: Order state machine validity

/**
 * Property 7: Order state machine validity
 *
 * For any Reforge_Order, the only valid state transitions are:
 * - bought → started_reforge
 * - started_reforge → completed
 * - started_reforge → failed
 * - bought → failed
 *
 * No other transitions should be permitted.
 *
 * Validates: Requirements 5.1
 */

// Mock the database module to avoid real DB connections
jest.mock('../../src/lib/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

const ALL_STATES: ReforgeOrderStatus[] = ['bought', 'started_reforge', 'failed', 'completed'];

const VALID_TRANSITIONS: Array<[ReforgeOrderStatus, ReforgeOrderStatus]> = [
  ['bought', 'started_reforge'],
  ['started_reforge', 'completed'],
  ['started_reforge', 'failed'],
  ['bought', 'failed'],
];

// Generate all invalid transitions (all pairs not in VALID_TRANSITIONS)
const INVALID_TRANSITIONS: Array<[ReforgeOrderStatus, ReforgeOrderStatus]> = [];
for (const from of ALL_STATES) {
  for (const to of ALL_STATES) {
    const isValid = VALID_TRANSITIONS.some(([f, t]) => f === from && t === to);
    if (!isValid) {
      INVALID_TRANSITIONS.push([from, to]);
    }
  }
}

// Arbitraries
const arbValidTransition = fc.constantFrom(...VALID_TRANSITIONS);
const arbInvalidTransition = fc.constantFrom(...INVALID_TRANSITIONS);
const arbState = fc.constantFrom(...ALL_STATES);

describe('Order State Machine Property Tests', () => {
  let manager: ReforgeOrderManager;
  const mockQuery = require('../../src/lib/database').query;

  beforeEach(() => {
    manager = new ReforgeOrderManager();
    jest.clearAllMocks();
  });

  describe('Property 7: Order state machine validity', () => {
    it('valid transitions are accepted by isValidTransition', () => {
      fc.assert(
        fc.property(
          arbValidTransition,
          ([fromState, toState]) => {
            const result = manager.isValidTransition(fromState, toState);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('invalid transitions are rejected by isValidTransition', () => {
      fc.assert(
        fc.property(
          arbInvalidTransition,
          ([fromState, toState]) => {
            const result = manager.isValidTransition(fromState, toState);
            expect(result).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('valid transitions succeed via transitionOrder', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbValidTransition,
          fc.uuid(),
          async ([fromState, toState], orderId) => {
            // Mock findById returning an order in the fromState
            mockQuery.mockResolvedValueOnce({
              rows: [{
                id: orderId,
                pack_id: 'pack-1',
                wallet_address: 'wallet-1',
                discord_id: 'discord-1',
                asset_id: null,
                status: fromState,
                used: false,
                purchase_tx_signature: null,
                failure_reason: null,
                created_at: new Date(),
                updated_at: new Date(),
              }],
            });

            // Mock updateStatus returning the updated order
            mockQuery.mockResolvedValueOnce({
              rows: [{
                id: orderId,
                pack_id: 'pack-1',
                wallet_address: 'wallet-1',
                discord_id: 'discord-1',
                asset_id: null,
                status: toState,
                used: false,
                purchase_tx_signature: null,
                failure_reason: null,
                created_at: new Date(),
                updated_at: new Date(),
              }],
            });

            const result = await manager.transitionOrder(orderId, toState);
            expect(result.status).toBe(toState);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('invalid transitions throw INVALID_ORDER_STATE error via transitionOrder', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbInvalidTransition,
          fc.uuid(),
          async ([fromState, toState], orderId) => {
            // Mock findById returning an order in the fromState
            mockQuery.mockResolvedValueOnce({
              rows: [{
                id: orderId,
                pack_id: 'pack-1',
                wallet_address: 'wallet-1',
                discord_id: 'discord-1',
                asset_id: null,
                status: fromState,
                used: false,
                purchase_tx_signature: null,
                failure_reason: null,
                created_at: new Date(),
                updated_at: new Date(),
              }],
            });

            try {
              await manager.transitionOrder(orderId, toState);
              // Should not reach here
              expect(true).toBe(false);
            } catch (error: any) {
              expect(error.error).toBe('INVALID_ORDER_STATE');
              expect(error.message).toContain(fromState);
              expect(error.message).toContain(toState);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('terminal states (completed, failed) have no valid outgoing transitions', () => {
      fc.assert(
        fc.property(
          arbState,
          (targetState) => {
            expect(manager.isValidTransition('completed', targetState)).toBe(false);
            expect(manager.isValidTransition('failed', targetState)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
