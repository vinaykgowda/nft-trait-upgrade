/**
 * **Feature: nft-trait-marketplace, Property 15: Error Categorization**
 * **Validates: Requirements 12.1, 12.4**
 */

import fc from 'fast-check';
import { ErrorHandler, ErrorCategory, ErrorSeverity } from '@/lib/services/error-handler';

describe('Error Categorization Property Tests', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    // Create a new error handler for each test to avoid cross-test pollution
    errorHandler = new ErrorHandler();
  });

  test('Property 15: Error Categorization - For any system error, the error should be categorized with specific reason codes and stored with detailed information for admin review', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate various types of errors and contexts
        fc.record({
          errorType: fc.constantFrom(
            'validation',
            'authentication', 
            'authorization',
            'blockchain_rpc',
            'transaction_build',
            'transaction_confirm',
            'irys_upload',
            'database',
            'external_api',
            'system',
            'unknown'
          ),
          message: fc.string({ minLength: 1, maxLength: 200 }),
          context: fc.record({
            type: fc.option(fc.string()),
            service: fc.option(fc.string()),
            operation: fc.option(fc.string()),
            userId: fc.option(fc.string()),
            requestId: fc.option(fc.string()),
          }),
          requestId: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
          userId: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
        }),
        async ({ errorType, message, context, requestId, userId }) => {
          // Create an error based on the error type
          const error = createErrorForType(errorType, message);
          const errorContext = { ...context, type: errorType };

          // Categorize the error
          const categorizedError = await errorHandler.handleError(
            error,
            errorContext,
            requestId,
            userId
          );

          // Verify the error has been categorized
          expect(categorizedError).toBeDefined();
          expect(categorizedError.id).toBeDefined();
          expect(typeof categorizedError.id).toBe('string');
          expect(categorizedError.id.length).toBeGreaterThan(0);

          // Verify category is assigned
          expect(Object.values(ErrorCategory)).toContain(categorizedError.category);

          // Verify severity is assigned
          expect(Object.values(ErrorSeverity)).toContain(categorizedError.severity);

          // Verify message is preserved (may be modified by error handler)
          expect(categorizedError.message).toBeDefined();
          expect(typeof categorizedError.message).toBe('string');
          expect(categorizedError.message.length).toBeGreaterThan(0);

          // Verify context is preserved
          expect(categorizedError.context).toEqual(errorContext);

          // Verify timestamp is set
          expect(categorizedError.timestamp).toBeInstanceOf(Date);
          expect(categorizedError.timestamp.getTime()).toBeLessThanOrEqual(Date.now());

          // Verify optional fields are preserved
          expect(categorizedError.requestId).toBe(requestId);
          expect(categorizedError.userId).toBe(userId);

          // Verify original error is preserved
          expect(categorizedError.originalError).toBe(error);

          // Verify error categorization logic
          const expectedCategory = getExpectedCategory(errorType);
          if (expectedCategory !== ErrorCategory.UNKNOWN) {
            expect(categorizedError.category).toBe(expectedCategory);
          }

          // Verify error can be retrieved for admin review
          const recentErrors = errorHandler.getRecentErrors(100);
          expect(recentErrors).toContainEqual(categorizedError);

          // Verify error can be retrieved by category
          const categoryErrors = errorHandler.getErrorsByCategory(categorizedError.category, 50);
          expect(categoryErrors).toContainEqual(categorizedError);

          // Verify error metrics can be generated
          const metrics = errorHandler.getErrorMetrics();
          expect(metrics).toBeDefined();
          expect(Array.isArray(metrics)).toBe(true);

          // Find the metric for this error's category
          const categoryMetric = metrics.find(m => m.category === categorizedError.category);
          expect(categoryMetric).toBeDefined();
          expect(categoryMetric!.count).toBeGreaterThan(0);
          expect(categoryMetric!.lastOccurrence).toBeInstanceOf(Date);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Error categorization consistency - same error types should always get same categories', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'validation',
          'authentication',
          'authorization',
          'blockchain_rpc',
          'transaction_build',
          'transaction_confirm',
          'irys_upload',
          'database',
          'external_api',
          'system'
        ),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (errorType, message) => {
          // Create a fresh error handler for this test
          const testErrorHandler = new ErrorHandler();
          
          const error1 = createErrorForType(errorType, message);
          const error2 = createErrorForType(errorType, message);
          const context = { type: errorType };

          const categorized1 = await testErrorHandler.handleError(error1, context);
          const categorized2 = await testErrorHandler.handleError(error2, context);

          // Same error type should always get same category
          expect(categorized1.category).toBe(categorized2.category);
          expect(categorized1.severity).toBe(categorized2.severity);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Error metrics aggregation works correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            errorType: fc.constantFrom('validation', 'database', 'blockchain_rpc'),
            message: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (errorSpecs) => {
          // Create a fresh error handler for this test
          const testErrorHandler = new ErrorHandler();
          
          // Generate multiple errors
          for (const spec of errorSpecs) {
            const error = createErrorForType(spec.errorType, spec.message);
            await testErrorHandler.handleError(error, { type: spec.errorType });
          }

          // Get metrics
          const metrics = testErrorHandler.getErrorMetrics();

          // Verify metrics structure
          expect(Array.isArray(metrics)).toBe(true);

          for (const metric of metrics) {
            expect(Object.values(ErrorCategory)).toContain(metric.category);
            expect(typeof metric.count).toBe('number');
            expect(metric.count).toBeGreaterThan(0);
            expect(metric.lastOccurrence).toBeInstanceOf(Date);
            expect(typeof metric.averageFrequency).toBe('number');
          }

          // Verify counts match actual errors generated
          const errorTypeCount = new Map<string, number>();
          for (const spec of errorSpecs) {
            const expectedCategory = getExpectedCategory(spec.errorType);
            errorTypeCount.set(expectedCategory, (errorTypeCount.get(expectedCategory) || 0) + 1);
          }

          for (const [category, expectedCount] of errorTypeCount) {
            const metric = metrics.find(m => m.category === category);
            expect(metric).toBeDefined();
            expect(metric!.count).toBe(expectedCount);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});

// Helper functions
function createErrorForType(errorType: string, message: string): Error {
  const error = new Error(message);
  
  // Add specific properties based on error type
  switch (errorType) {
    case 'validation':
      error.name = 'ValidationError';
      break;
    case 'authentication':
      // Keep original message, just set context
      break;
    case 'authorization':
      // Keep original message, just set context
      break;
    case 'blockchain_rpc':
      // Keep original message, just set context
      break;
    case 'transaction_build':
      // Keep original message, just set context
      break;
    case 'transaction_confirm':
      // Keep original message, just set context
      break;
    case 'irys_upload':
      // Keep original message, just set context
      break;
    case 'database':
      // Keep original message, just set context
      (error as any).code = '23505'; // PostgreSQL constraint violation
      break;
    case 'external_api':
      // Keep original message, just set context
      break;
    case 'system':
      // Keep original message, just set context
      break;
  }
  
  return error;
}

function getExpectedCategory(errorType: string): ErrorCategory {
  switch (errorType) {
    case 'validation':
      return ErrorCategory.VALIDATION;
    case 'authentication':
      return ErrorCategory.AUTHENTICATION;
    case 'authorization':
      return ErrorCategory.AUTHORIZATION;
    case 'blockchain_rpc':
      return ErrorCategory.BLOCKCHAIN_RPC;
    case 'transaction_build':
      return ErrorCategory.TRANSACTION_BUILD;
    case 'transaction_confirm':
      return ErrorCategory.TRANSACTION_CONFIRM;
    case 'irys_upload':
      return ErrorCategory.IRYS_UPLOAD;
    case 'database':
      return ErrorCategory.DATABASE;
    case 'external_api':
      return ErrorCategory.EXTERNAL_API;
    case 'system':
      return ErrorCategory.SYSTEM;
    default:
      return ErrorCategory.UNKNOWN;
  }
}