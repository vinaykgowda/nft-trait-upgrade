import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { AdminUser } from '../../types';

export interface SessionData {
  userId: string;
  username: string;
  roles: string[];
  mfaVerified: boolean;
  loginTime: number;
  expiresAt: number;
}

export class SessionService {
  private static readonly JWT_SECRET = new TextEncoder().encode(
    process.env.NEXTAUTH_SECRET || 'default-secret-change-in-production'
  );
  private static readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly COOKIE_NAME = 'admin-session';

  static async createSession(user: AdminUser, mfaVerified: boolean = false): Promise<string> {
    const now = Date.now();
    const expiresAt = now + this.SESSION_DURATION;

    const sessionData: SessionData = {
      userId: user.id,
      username: user.username,
      roles: user.roles,
      mfaVerified,
      loginTime: now,
      expiresAt,
    };

    const token = await new SignJWT(sessionData as any)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(new Date(expiresAt))
      .sign(this.JWT_SECRET);

    return token;
  }

  static async verifySession(token: string): Promise<SessionData | null> {
    try {
      const { payload } = await jwtVerify(token, this.JWT_SECRET);
      
      const sessionData = payload as unknown as SessionData;
      
      // Check if session is expired
      if (Date.now() > sessionData.expiresAt) {
        return null;
      }

      return sessionData;
    } catch (error) {
      console.error('Session verification failed:', error);
      return null;
    }
  }

  static async getSessionFromCookies(): Promise<SessionData | null> {
    try {
      const cookieStore = cookies();
      const sessionCookie = cookieStore.get(this.COOKIE_NAME);
      
      if (!sessionCookie?.value) {
        return null;
      }

      return await this.verifySession(sessionCookie.value);
    } catch (error) {
      console.error('Failed to get session from cookies:', error);
      return null;
    }
  }

  static setSessionCookie(token: string): void {
    const cookieStore = cookies();
    
    cookieStore.set(this.COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: this.SESSION_DURATION / 1000, // Convert to seconds
      path: '/',
    });
  }

  static clearSessionCookie(): void {
    const cookieStore = cookies();
    
    cookieStore.set(this.COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    });
  }

  static async updateMFAStatus(token: string, mfaVerified: boolean): Promise<string> {
    const sessionData = await this.verifySession(token);
    
    if (!sessionData) {
      throw new Error('Invalid session');
    }

    const updatedSessionData: SessionData = {
      ...sessionData,
      mfaVerified,
    };

    const newToken = await new SignJWT(updatedSessionData as any)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(new Date(sessionData.expiresAt))
      .sign(this.JWT_SECRET);

    return newToken;
  }

  static requireMFA(sessionData: SessionData): boolean {
    // Require MFA for sensitive operations
    const sensitiveRoles = ['owner', 'admin'];
    return sessionData.roles.some(role => sensitiveRoles.includes(role));
  }

  static hasRole(sessionData: SessionData, requiredRole: string): boolean {
    return sessionData.roles.includes(requiredRole);
  }

  static hasAnyRole(sessionData: SessionData, requiredRoles: string[]): boolean {
    return requiredRoles.some(role => sessionData.roles.includes(role));
  }
}