import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export interface UserSessionData {
  userId: string;
  discordId: string;
  discordUsername: string;
  discordDisplayName?: string;
  discordAvatar?: string;
  loginTime: number;
  expiresAt: number;
}

export class UserSessionService {
  private static readonly JWT_SECRET = new TextEncoder().encode(
    process.env.NEXTAUTH_SECRET || 'default-secret-change-in-production'
  );
  private static readonly SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
  private static readonly COOKIE_NAME = 'user-session';

  static async createSession(data: Omit<UserSessionData, 'loginTime' | 'expiresAt'>): Promise<string> {
    const now = Date.now();
    const expiresAt = now + this.SESSION_DURATION;

    const sessionData: UserSessionData = {
      ...data,
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

  static async verifySession(token: string): Promise<UserSessionData | null> {
    try {
      const { payload } = await jwtVerify(token, this.JWT_SECRET);
      const sessionData = payload as unknown as UserSessionData;
      if (Date.now() > sessionData.expiresAt) return null;
      return sessionData;
    } catch {
      return null;
    }
  }

  static async getSessionFromCookies(): Promise<UserSessionData | null> {
    try {
      const cookieStore = cookies();
      const sessionCookie = cookieStore.get(this.COOKIE_NAME);
      if (!sessionCookie?.value) return null;
      return await this.verifySession(sessionCookie.value);
    } catch {
      return null;
    }
  }

  static setSessionCookie(token: string): void {
    const cookieStore = cookies();
    cookieStore.set(this.COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // lax for OAuth redirect
      maxAge: this.SESSION_DURATION / 1000,
      path: '/',
    });
  }

  static clearSessionCookie(): void {
    const cookieStore = cookies();
    cookieStore.set(this.COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
  }
}
