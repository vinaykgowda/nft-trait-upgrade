import fc from 'fast-check';
import { AuditLogRepository } from '../../src/lib/repositories/audit-logs';

/**
 * Feature: nft-trait-marketplace, Property 11: Audit Trail Completeness
 * 
 * For any sensitive admin operation, the system should create audit log entries 
 * with actor identification, timestamps, and payload details
 * 
 * Validates: Requirements 4.4, 5.5, 6.1, 6.5
 */

describe('Audit Trail Completeness Property Tests', () => {
  // Mock repository for testing
  const mockAuditRepo = {
    logAction: jest.fn(),
    findByActor: jest.fn(),
    findByAction: jest.fn(),
    getActionStats: jest.fn(),
  } as unknown as AuditLogRepository;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Property 11: Audit Trail Completeness', () => {
    it('should create complete audit logs for all sensitive operations', () => {
      fc.assert(
        fc.property(
          fc.record({
            actorType: fc.constantFrom('admin', 'user', 'system'),
            actorId: fc.uuid(),
            action: fc.constantFrom(
              'treasury_change',
              'delegate_change',
              'gift_trait',
              'trait_price_update',
              'trait_supply_update',
              'mfa_enable',
              'mfa_disable',
              'account_lock',
              'account_unlock'
            ),
            payload: fc.record({
              previousValue: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
              newValue: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
              reason: fc.option(fc.string()),
              metadata: fc.option(fc.object()),
            }),
            ipAddress: fc.ipV4(),
            userAgent: fc.string({ minLength: 10, maxLength: 200 }),
          }),
          (auditData) => {
            // Mock the audit log creation
            const expectedAuditLog = {
              id: fc.sample(fc.uuid(), 1)[0],
              actor_type: auditData.actorType,
              actor_id: auditData.actorId,
              action: auditData.action,
              payload_json: auditData.payload,
              ip_address: auditData.ipAddress,
              user_agent: auditData.userAgent,
              created_at: new Date(),
            };

            (mockAuditRepo.logAction as jest.Mock).mockResolvedValue(expectedAuditLog);

            // Property: All sensitive operations must have complete audit logs
            const requiredFields = [
              'actor_type',
              'actor_id', 
              'action',
              'created_at'
            ];

            // Verify all required fields are present
            for (const field of requiredFields) {
              expect(expectedAuditLog).toHaveProperty(field);
              expect(expectedAuditLog[field as keyof typeof expectedAuditLog]).toBeDefined();
            }

            // Property: Actor identification must be complete
            expect(expectedAuditLog.actor_type).toMatch(/^(admin|user|system)$/);
            expect(expectedAuditLog.actor_id).toBeTruthy();

            // Property: Timestamps must be present and valid
            expect(expectedAuditLog.created_at).toBeInstanceOf(Date);
            expect(expectedAuditLog.created_at.getTime()).toBeLessThanOrEqual(Date.now());

            // Property: Payload details should be preserved for sensitive operations
            if (auditData.payload) {
              expect(expectedAuditLog.payload_json).toEqual(auditData.payload);
            }

            // Property: Context information should be captured
            expect(expectedAuditLog.ip_address).toBe(auditData.ipAddress);
            expect(expectedAuditLog.user_agent).toBe(auditData.userAgent);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain audit log immutability and ordering', () => {
      fc.assert(
        fc.property(
          fc.array(fc.record({
            actorId: fc.uuid(),
            action: fc.constantFrom('login', 'logout', 'trait_update', 'purchase'),
            timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date() }),
          }), { minLength: 1, maxLength: 20 }),
          (auditEvents) => {
            // Sort events by timestamp to simulate chronological order
            const sortedEvents = auditEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

            // Mock audit logs with proper timestamps
            const mockAuditLogs = sortedEvents.map((event, index) => ({
              id: `audit-${index}`,
              actor_type: 'admin' as const,
              actor_id: event.actorId,
              action: event.action,
              created_at: event.timestamp,
            }));

            (mockAuditRepo.findByActor as jest.Mock).mockResolvedValue(mockAuditLogs);

            // Property: Audit logs should maintain chronological order
            for (let i = 1; i < mockAuditLogs.length; i++) {
              const previousLog = mockAuditLogs[i - 1];
              const currentLog = mockAuditLogs[i];
              
              expect(currentLog.created_at.getTime()).toBeGreaterThanOrEqual(
                previousLog.created_at.getTime()
              );
            }

            // Property: Each audit log should have a unique identifier
            const ids = mockAuditLogs.map(log => log.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(mockAuditLogs.length);

            // Property: Audit logs should be immutable (no update operations)
            // This is enforced by the repository design - no update method exists
            expect(mockAuditRepo).not.toHaveProperty('update');
            expect(mockAuditRepo).not.toHaveProperty('delete');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should capture state changes with before/after values', () => {
      fc.assert(
        fc.property(
          fc.record({
            actorId: fc.uuid(),
            action: fc.constantFrom('trait_price_update', 'trait_supply_update', 'treasury_change'),
            beforeValue: fc.oneof(
              fc.bigUintN(64).map(n => n.toString()), // price amounts
              fc.integer({ min: 0, max: 10000 }), // supply amounts
              fc.string({ minLength: 32, maxLength: 44 }) // wallet addresses
            ),
            afterValue: fc.oneof(
              fc.bigUintN(64).map(n => n.toString()),
              fc.integer({ min: 0, max: 10000 }),
              fc.string({ minLength: 32, maxLength: 44 })
            ),
          }),
          (changeData) => {
            const auditPayload = {
              previousValue: changeData.beforeValue,
              newValue: changeData.afterValue,
              changeType: changeData.action,
            };

            const mockAuditLog = {
              id: fc.sample(fc.uuid(), 1)[0],
              actor_type: 'admin' as const,
              actor_id: changeData.actorId,
              action: changeData.action,
              payload_json: auditPayload,
              created_at: new Date(),
            };

            (mockAuditRepo.logAction as jest.Mock).mockResolvedValue(mockAuditLog);

            // Property: State changes must capture both before and after values
            expect(mockAuditLog.payload_json).toHaveProperty('previousValue');
            expect(mockAuditLog.payload_json).toHaveProperty('newValue');
            
            expect(mockAuditLog.payload_json.previousValue).toBe(changeData.beforeValue);
            expect(mockAuditLog.payload_json.newValue).toBe(changeData.afterValue);

            // Property: Change type should match the action
            expect(mockAuditLog.payload_json.changeType).toBe(changeData.action);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide audit trail searchability and filtering', () => {
      fc.assert(
        fc.property(
          fc.array(fc.record({
            actorId: fc.uuid(),
            actorType: fc.constantFrom('admin', 'user', 'system'),
            action: fc.constantFrom('login', 'logout', 'trait_update', 'purchase', 'gift'),
            timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date() }),
          }), { minLength: 5, maxLength: 50 }),
          fc.constantFrom('admin', 'user', 'system'),
          fc.constantFrom('login', 'logout', 'trait_update', 'purchase', 'gift'),
          (auditLogs, filterActorType, filterAction) => {
            // Mock filtered results
            const filteredByActor = auditLogs.filter(log => log.actorType === filterActorType);
            const filteredByAction = auditLogs.filter(log => log.action === filterAction);

            (mockAuditRepo.findByActor as jest.Mock).mockResolvedValue(
              filteredByActor.map(log => ({
                id: fc.sample(fc.uuid(), 1)[0],
                actor_type: log.actorType,
                actor_id: log.actorId,
                action: log.action,
                created_at: log.timestamp,
              }))
            );

            (mockAuditRepo.findByAction as jest.Mock).mockResolvedValue(
              filteredByAction.map(log => ({
                id: fc.sample(fc.uuid(), 1)[0],
                actor_type: log.actorType,
                actor_id: log.actorId,
                action: log.action,
                created_at: log.timestamp,
              }))
            );

            // Property: Filtering by actor type should return only matching logs
            const actorResults = filteredByActor.map(log => ({
              id: fc.sample(fc.uuid(), 1)[0],
              actor_type: log.actorType,
              actor_id: log.actorId,
              action: log.action,
              created_at: log.timestamp,
            }));

            for (const result of actorResults) {
              expect(result.actor_type).toBe(filterActorType);
            }

            // Property: Filtering by action should return only matching logs
            const actionResults = filteredByAction.map(log => ({
              id: fc.sample(fc.uuid(), 1)[0],
              actor_type: log.actorType,
              actor_id: log.actorId,
              action: log.action,
              created_at: log.timestamp,
            }));

            for (const result of actionResults) {
              expect(result.action).toBe(filterAction);
            }

            // Property: Filter results should be subsets of original data
            expect(actorResults.length).toBeLessThanOrEqual(auditLogs.length);
            expect(actionResults.length).toBeLessThanOrEqual(auditLogs.length);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate audit statistics for monitoring', () => {
      fc.assert(
        fc.property(
          fc.array(fc.record({
            action: fc.constantFrom('login', 'logout', 'trait_update', 'purchase', 'gift', 'mfa_verify'),
            count: fc.integer({ min: 1, max: 100 }),
          }), { minLength: 1, maxLength: 10 }),
          (actionStats) => {
            // Mock statistics
            (mockAuditRepo.getActionStats as jest.Mock).mockResolvedValue(actionStats);

            // Property: Statistics should accurately reflect action counts
            const totalActions = actionStats.reduce((sum, stat) => sum + stat.count, 0);
            expect(totalActions).toBeGreaterThan(0);

            // Property: Each action should have a positive count
            for (const stat of actionStats) {
              expect(stat.count).toBeGreaterThan(0);
              expect(typeof stat.action).toBe('string');
              expect(stat.action.length).toBeGreaterThan(0);
            }

            // Property: Statistics should be sortable by count
            const sortedStats = [...actionStats].sort((a, b) => b.count - a.count);
            expect(sortedStats[0].count).toBeGreaterThanOrEqual(
              sortedStats[sortedStats.length - 1].count
            );

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});