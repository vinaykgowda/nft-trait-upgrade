import { query } from '../database';

interface RateLimitEntry {
  key: string;
  count: number;
  resetTime: number;
}

export class RateLimitService {
  private static cache = new Map<string, RateLimitEntry>();
  private static readonly CLEANUP_INTERVAL = 60 * 1000; // 1 minute
  private static cleanupTimer: NodeJS.Timeout | null = null;

  static async checkRateLimit(
    key: string,
    maxAttempts: number,
    windowMs: number
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    this.startCleanupTimer();

    const now = Date.now();
    const entry = this.cache.get(key);

    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired entry
      const newEntry: RateLimitEntry = {
        key,
        count: 1,
        resetTime: now + windowMs,
      };
      this.cache.set(key, newEntry);

      return {
        allowed: true,
        remaining: maxAttempts - 1,
        resetTime: newEntry.resetTime,
      };
    }

    // Increment existing entry
    entry.count++;
    this.cache.set(key, entry);

    const remaining = Math.max(0, maxAttempts - entry.count);
    const allowed = entry.count <= maxAttempts;

    return {
      allowed,
      remaining,
      resetTime: entry.resetTime,
    };
  }

  static async checkLoginRateLimit(identifier: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    // 5 attempts per 15 minutes
    return this.checkRateLimit(`login:${identifier}`, 5, 15 * 60 * 1000);
  }

  static async checkAPIRateLimit(ip: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    // 100 requests per minute
    return this.checkRateLimit(`api:${ip}`, 100, 60 * 1000);
  }

  static async checkMFAAttempts(userId: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    // 3 MFA attempts per 5 minutes
    return this.checkRateLimit(`mfa:${userId}`, 3, 5 * 60 * 1000);
  }

  static resetRateLimit(key: string): void {
    this.cache.delete(key);
  }

  static resetLoginAttempts(identifier: string): void {
    this.resetRateLimit(`login:${identifier}`);
  }

  static resetMFAAttempts(userId: string): void {
    this.resetRateLimit(`mfa:${userId}`);
  }

  private static startCleanupTimer(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.resetTime) {
          this.cache.delete(key);
        }
      }

      // Stop cleanup timer if cache is empty
      if (this.cache.size === 0) {
        clearInterval(this.cleanupTimer!);
        this.cleanupTimer = null;
      }
    }, this.CLEANUP_INTERVAL);
  }

  static getStats(): {
    totalEntries: number;
    activeEntries: number;
  } {
    const now = Date.now();
    let activeEntries = 0;

    for (const entry of this.cache.values()) {
      if (now <= entry.resetTime) {
        activeEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      activeEntries,
    };
  }

  // For testing purposes
  static clearCache(): void {
    this.cache.clear();
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}