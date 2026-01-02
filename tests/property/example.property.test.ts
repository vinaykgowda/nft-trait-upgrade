import fc from 'fast-check';
import { formatPrice, parsePrice } from '../../src/lib/utils';

describe('Property-based tests', () => {
  describe('Price formatting round trip', () => {
    it('should maintain consistency when formatting and parsing prices', () => {
      fc.assert(
        fc.property(
          fc.bigUintN(64), // Generate random bigint values
          fc.integer({ min: 0, max: 18 }), // Generate random decimal places
          (amount, decimals) => {
            // Skip values that would overflow
            if (amount > BigInt(10) ** BigInt(decimals + 10)) return true;
            
            const formatted = formatPrice(amount, decimals);
            const parsed = parsePrice(formatted, decimals);
            
            return parsed === amount;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});