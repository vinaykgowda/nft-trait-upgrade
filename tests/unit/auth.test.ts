import { PasswordService } from '../../src/lib/auth/password';
import { MFAService } from '../../src/lib/auth/mfa';
import { SessionService } from '../../src/lib/auth/session';
import { RateLimitService } from '../../src/lib/auth/rate-limit';
import { CSRFService } from '../../src/lib/auth/csrf';

// Mock external dependencies
jest.mock('argon2');
jest.mock('speakeasy');
jest.mock('qrcode');
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
}));

describe('Authentication Unit Tests', () => {
  describe('PasswordService', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should validate password strength correctly', () => {
      // Strong password
      const strongPassword = 'MyStr0ng!P@ssw0rd123';
      const strongResult = PasswordService.validatePasswordStrength(strongPassword);
      expect(strongResult.isValid).toBe(true);
      expect(strongResult.errors).toHaveLength(0);

      // Weak password - too short
      const shortPassword = 'short';
      const shortResult = PasswordService.validatePasswordStrength(shortPassword);
      expect(shortResult.isValid).toBe(false);
      expect(shortResult.errors).toContain('Password must be at least 12 characters long');

      // Weak password - no uppercase
      const noUpperPassword = 'mystr0ng!p@ssw0rd123';
      const noUpperResult = PasswordService.validatePasswordStrength(noUpperPassword);
      expect(noUpperResult.isValid).toBe(false);
      expect(noUpperResult.errors).toContain('Password must contain at least one uppercase letter');

      // Weak password - common pattern
      const commonPassword = 'Password123!';
      const commonResult = PasswordService.validatePasswordStrength(commonPassword);
      expect(commonResult.isValid).toBe(false);
      expect(commonResult.errors).toContain('Password cannot contain common patterns');
    });

    it('should hash and verify passwords correctly', async () => {
      const argon2 = require('argon2');
      const password = 'TestPassword123!';
      const hashedPassword = 'hashed_password_string';

      argon2.hash.mockResolvedValue(hashedPassword);
      argon2.verify.mockResolvedValue(true);

      // Test hashing
      const hash = await PasswordService.hash(password);
      expect(hash).toBe(hashedPassword);
      expect(argon2.hash).toHaveBeenCalledWith(password, expect.any(Object));

      // Test verification
      const isValid = await PasswordService.verify(hashedPassword, password);
      expect(isValid).toBe(true);
      expect(argon2.verify).toHaveBeenCalledWith(hashedPassword, password);
    });

    it('should handle password hashing errors gracefully', async () => {
      const argon2 = require('argon2');
      argon2.hash.mockRejectedValue(new Error('Hashing failed'));

      await expect(PasswordService.hash('password')).rejects.toThrow('Failed to hash password');
    });

    it('should handle password verification errors gracefully', async () => {
      const argon2 = require('argon2');
      argon2.verify.mockRejectedValue(new Error('Verification failed'));

      const isValid = await PasswordService.verify('hash', 'password');
      expect(isValid).toBe(false);
    });
  });

  describe('MFAService', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should generate MFA secret with correct format', () => {
      const speakeasy = require('speakeasy');
      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/test?secret=JBSWY3DPEHPK3PXP&issuer=Test',
      };

      speakeasy.generateSecret.mockReturnValue(mockSecret);

      const result = MFAService.generateSecret('testuser');

      expect(result.secret).toBe(mockSecret.base32);
      expect(result.qrCodeUrl).toBe(mockSecret.otpauth_url);
      expect(result.backupCodes).toHaveLength(10);
      expect(speakeasy.generateSecret).toHaveBeenCalledWith({
        name: 'testuser',
        issuer: expect.any(String),
        length: 32,
      });
    });

    it('should verify MFA tokens correctly', () => {
      const speakeasy = require('speakeasy');
      const secret = 'JBSWY3DPEHPK3PXP';
      const token = '123456';

      speakeasy.totp.verify.mockReturnValue(true);

      const isValid = MFAService.verifyToken(secret, token);

      expect(isValid).toBe(true);
      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret,
        encoding: 'base32',
        token,
        window: 1,
      });
    });

    it('should handle MFA verification errors gracefully', () => {
      const speakeasy = require('speakeasy');
      speakeasy.totp.verify.mockImplementation(() => {
        throw new Error('Verification failed');
      });

      const isValid = MFAService.verifyToken('secret', 'token');
      expect(isValid).toBe(false);
    });

    it('should encrypt and decrypt secrets correctly', () => {
      const originalSecret = 'JBSWY3DPEHPK3PXP';
      
      const encrypted = MFAService.encryptSecret(originalSecret);
      expect(encrypted).toContain(':'); // Should contain IV, auth tag, and encrypted data
      
      const decrypted = MFAService.decryptSecret(encrypted);
      expect(decrypted).toBe(originalSecret);
    });

    it('should validate backup codes correctly', () => {
      const storedCodes = ['ABC123', 'DEF456', 'GHI789'];
      
      // Valid backup code
      const validResult = MFAService.validateBackupCode(storedCodes, 'abc123'); // case insensitive
      expect(validResult.isValid).toBe(true);
      expect(validResult.remainingCodes).toHaveLength(2);
      expect(validResult.remainingCodes).not.toContain('ABC123');

      // Invalid backup code
      const invalidResult = MFAService.validateBackupCode(storedCodes, 'INVALID');
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.remainingCodes).toEqual(storedCodes);
    });
  });

  describe('SessionService', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should create and verify sessions correctly', async () => {
      const user = {
        id: 'user-123',
        username: 'testuser',
        roles: ['admin'],
        mfaEnabled: true,
        lastLoginAt: new Date(),
      };

      const token = await SessionService.createSession(user, true);
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);

      const sessionData = await SessionService.verifySession(token);
      expect(sessionData).toBeTruthy();
      expect(sessionData!.userId).toBe(user.id);
      expect(sessionData!.username).toBe(user.username);
      expect(sessionData!.roles).toEqual(user.roles);
      expect(sessionData!.mfaVerified).toBe(true);
    });

    it('should handle expired sessions', async () => {
      // Mock an expired token by creating one with past expiration
      const user = {
        id: 'user-123',
        username: 'testuser',
        roles: ['admin'],
        mfaEnabled: true,
        lastLoginAt: new Date(),
      };

      const token = await SessionService.createSession(user, true);
      
      // Mock Date.now to simulate time passing
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 25 * 60 * 60 * 1000); // 25 hours later

      const sessionData = await SessionService.verifySession(token);
      expect(sessionData).toBeNull();

      // Restore Date.now
      Date.now = originalNow;
    });

    it('should update MFA status correctly', async () => {
      const user = {
        id: 'user-123',
        username: 'testuser',
        roles: ['admin'],
        mfaEnabled: true,
        lastLoginAt: new Date(),
      };

      const initialToken = await SessionService.createSession(user, false);
      const updatedToken = await SessionService.updateMFAStatus(initialToken, true);

      const sessionData = await SessionService.verifySession(updatedToken);
      expect(sessionData!.mfaVerified).toBe(true);
    });

    it('should check roles correctly', async () => {
      const sessionData = {
        userId: 'user-123',
        username: 'testuser',
        roles: ['admin', 'analyst'],
        mfaVerified: true,
        loginTime: Date.now(),
        expiresAt: Date.now() + 86400000,
      };

      expect(SessionService.hasRole(sessionData, 'admin')).toBe(true);
      expect(SessionService.hasRole(sessionData, 'owner')).toBe(false);
      expect(SessionService.hasAnyRole(sessionData, ['owner', 'admin'])).toBe(true);
      expect(SessionService.hasAnyRole(sessionData, ['owner', 'viewer'])).toBe(false);
    });

    it('should determine MFA requirements correctly', async () => {
      const adminSession = {
        userId: 'user-123',
        username: 'admin',
        roles: ['admin'],
        mfaVerified: true,
        loginTime: Date.now(),
        expiresAt: Date.now() + 86400000,
      };

      const analystSession = {
        userId: 'user-456',
        username: 'analyst',
        roles: ['analyst'],
        mfaVerified: false,
        loginTime: Date.now(),
        expiresAt: Date.now() + 86400000,
      };

      expect(SessionService.requireMFA(adminSession)).toBe(true);
      expect(SessionService.requireMFA(analystSession)).toBe(false);
    });
  });

  describe('RateLimitService', () => {
    beforeEach(() => {
      RateLimitService.clearCache();
      jest.clearAllMocks();
    });

    it('should allow requests within rate limit', async () => {
      const result1 = await RateLimitService.checkRateLimit('test-key', 5, 60000);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(4);

      const result2 = await RateLimitService.checkRateLimit('test-key', 5, 60000);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(3);
    });

    it('should block requests exceeding rate limit', async () => {
      // Use up all attempts
      for (let i = 0; i < 5; i++) {
        await RateLimitService.checkRateLimit('test-key', 5, 60000);
      }

      // Next request should be blocked
      const result = await RateLimitService.checkRateLimit('test-key', 5, 60000);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset rate limit after window expires', async () => {
      // Use up all attempts
      for (let i = 0; i < 5; i++) {
        await RateLimitService.checkRateLimit('test-key', 5, 1000); // 1 second window
      }

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be allowed again
      const result = await RateLimitService.checkRateLimit('test-key', 5, 1000);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should handle different rate limit types', async () => {
      const loginResult = await RateLimitService.checkLoginRateLimit('user123');
      expect(loginResult.allowed).toBe(true);

      const apiResult = await RateLimitService.checkAPIRateLimit('192.168.1.1');
      expect(apiResult.allowed).toBe(true);

      const mfaResult = await RateLimitService.checkMFAAttempts('user123');
      expect(mfaResult.allowed).toBe(true);
    });

    it('should reset specific rate limits', async () => {
      // Use up login attempts
      for (let i = 0; i < 5; i++) {
        await RateLimitService.checkLoginRateLimit('user123');
      }

      // Should be blocked
      let result = await RateLimitService.checkLoginRateLimit('user123');
      expect(result.allowed).toBe(false);

      // Reset and try again
      RateLimitService.resetLoginAttempts('user123');
      result = await RateLimitService.checkLoginRateLimit('user123');
      expect(result.allowed).toBe(true);
    });
  });

  describe('CSRFService', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should generate and verify CSRF tokens', () => {
      const token = CSRFService.generateToken();
      expect(typeof token).toBe('string');
      expect(token.split(':')).toHaveLength(3); // randomToken:timestamp:signature

      const isValid = CSRFService.verifyToken(token);
      expect(isValid).toBe(true);
    });

    it('should reject invalid CSRF tokens', () => {
      expect(CSRFService.verifyToken('invalid-token')).toBe(false);
      expect(CSRFService.verifyToken('invalid:token:format:extra')).toBe(false);
      expect(CSRFService.verifyToken('')).toBe(false);
    });

    it('should reject expired CSRF tokens', () => {
      const token = CSRFService.generateToken();
      
      // Token should be valid initially
      expect(CSRFService.verifyToken(token)).toBe(true);
      
      // Token should be invalid with very short max age
      expect(CSRFService.verifyToken(token, 1)).toBe(false); // 1ms max age
    });

    it('should validate requests correctly', () => {
      const token = CSRFService.generateToken();
      
      // Mock cookies
      const mockCookies = require('next/headers').cookies;
      mockCookies.mockReturnValue({
        get: jest.fn().mockReturnValue({ value: token }),
        set: jest.fn(),
      });

      // GET request should pass without CSRF check
      const getRequest = new Request('http://localhost/api/test', { method: 'GET' });
      expect(CSRFService.validateRequest(getRequest)).toBe(true);

      // POST request with matching tokens should pass
      const postRequest = new Request('http://localhost/api/test', {
        method: 'POST',
        headers: { 'x-csrf-token': token },
      });
      expect(CSRFService.validateRequest(postRequest)).toBe(true);

      // POST request without header token should fail
      const postRequestNoHeader = new Request('http://localhost/api/test', { method: 'POST' });
      expect(CSRFService.validateRequest(postRequestNoHeader)).toBe(false);
    });

    it('should generate token pairs correctly', () => {
      const { token, cookie } = CSRFService.generateTokenPair();
      expect(token).toBe(cookie);
      expect(CSRFService.verifyToken(token)).toBe(true);
    });
  });
});