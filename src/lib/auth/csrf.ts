import { randomBytes, createHmac } from 'crypto';
import { cookies } from 'next/headers';

export class CSRFService {
  private static readonly SECRET = process.env.NEXTAUTH_SECRET || 'default-secret-change-in-production';
  private static readonly TOKEN_LENGTH = 32;
  private static readonly COOKIE_NAME = 'csrf-token';
  private static readonly HEADER_NAME = 'x-csrf-token';

  static generateToken(): string {
    const randomToken = randomBytes(this.TOKEN_LENGTH).toString('hex');
    const timestamp = Date.now().toString();
    const payload = `${randomToken}:${timestamp}`;
    
    const signature = createHmac('sha256', this.SECRET)
      .update(payload)
      .digest('hex');
    
    return `${payload}:${signature}`;
  }

  static verifyToken(token: string, maxAge: number = 24 * 60 * 60 * 1000): boolean {
    try {
      const parts = token.split(':');
      if (parts.length !== 3) {
        return false;
      }

      const [randomToken, timestamp, signature] = parts;
      const payload = `${randomToken}:${timestamp}`;
      
      // Verify signature
      const expectedSignature = createHmac('sha256', this.SECRET)
        .update(payload)
        .digest('hex');
      
      if (signature !== expectedSignature) {
        return false;
      }

      // Check if token is expired
      const tokenTime = parseInt(timestamp);
      const now = Date.now();
      
      if (now - tokenTime > maxAge) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('CSRF token verification failed:', error);
      return false;
    }
  }

  static setCSRFCookie(token: string): void {
    const cookieStore = cookies();
    
    cookieStore.set(this.COOKIE_NAME, token, {
      httpOnly: false, // Needs to be accessible by JavaScript
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60, // 24 hours in seconds
      path: '/',
    });
  }

  static getCSRFTokenFromCookies(): string | null {
    try {
      const cookieStore = cookies();
      const csrfCookie = cookieStore.get(this.COOKIE_NAME);
      return csrfCookie?.value || null;
    } catch (error) {
      console.error('Failed to get CSRF token from cookies:', error);
      return null;
    }
  }

  static getCSRFTokenFromHeaders(request: Request): string | null {
    return request.headers.get(this.HEADER_NAME);
  }

  static validateRequest(request: Request): boolean {
    // Skip CSRF validation for GET, HEAD, OPTIONS requests
    const method = request.method.toUpperCase();
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return true;
    }

    const cookieToken = this.getCSRFTokenFromCookies();
    const headerToken = this.getCSRFTokenFromHeaders(request);

    if (!cookieToken || !headerToken) {
      return false;
    }

    // Verify both tokens are valid and match
    if (!this.verifyToken(cookieToken) || !this.verifyToken(headerToken)) {
      return false;
    }

    return cookieToken === headerToken;
  }

  static generateTokenPair(): { token: string; cookie: string } {
    const token = this.generateToken();
    return {
      token,
      cookie: token,
    };
  }

  static clearCSRFCookie(): void {
    const cookieStore = cookies();
    
    cookieStore.set(this.COOKIE_NAME, '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    });
  }
}