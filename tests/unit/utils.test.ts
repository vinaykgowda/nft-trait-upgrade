import { formatPrice, parsePrice, shortenAddress, isValidSolanaAddress } from '../../src/lib/utils';

describe('Utils', () => {
  describe('formatPrice', () => {
    it('should format price with decimals correctly', () => {
      expect(formatPrice(1000000000n, 9)).toBe('1');
      expect(formatPrice(1500000000n, 9)).toBe('1.5');
      expect(formatPrice(123456789n, 9)).toBe('0.123456789');
    });

    it('should handle zero price', () => {
      expect(formatPrice(0n, 9)).toBe('0');
    });
  });

  describe('parsePrice', () => {
    it('should parse price string to bigint correctly', () => {
      expect(parsePrice('1', 9)).toBe(1000000000n);
      expect(parsePrice('1.5', 9)).toBe(1500000000n);
      expect(parsePrice('0.123456789', 9)).toBe(123456789n);
    });

    it('should handle zero price', () => {
      expect(parsePrice('0', 9)).toBe(0n);
    });
  });

  describe('shortenAddress', () => {
    it('should shorten address correctly', () => {
      const address = '11111111111111111111111111111111';
      expect(shortenAddress(address)).toBe('1111...1111');
      expect(shortenAddress(address, 6)).toBe('111111...111111');
    });
  });

  describe('isValidSolanaAddress', () => {
    it('should validate Solana addresses', () => {
      expect(isValidSolanaAddress('11111111111111111111111111111112')).toBe(true);
      expect(isValidSolanaAddress('invalid')).toBe(false);
      expect(isValidSolanaAddress('')).toBe(false);
    });
  });
});