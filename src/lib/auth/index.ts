import { AdminUserRepository } from '../repositories/admin-users';
import { AuditLogRepository } from '../repositories/audit-logs';
import { PasswordService } from './password';
import { MFAService } from './mfa';
import { SessionService, SessionData } from './session';
import { RateLimitService } from './rate-limit';
import { CSRFService } from './csrf';
import { AdminUser } from '../../types';
import { MAX_FAILED_LOGIN_ATTEMPTS, ACCOUNT_LOCKOUT_DURATION_MINUTES } from '../constants';

export interface LoginResult {
  success: boolean;
  user?: AdminUser;
  token?: string;
  requiresMFA?: boolean;
  error?: string;
  rateLimited?: boolean;
  accountLocked?: boolean;
}

export interface MFAVerificationResult {
  success: boolean;
  token?: string;
  error?: string;
  rateLimited?: boolean;
}

export class AuthService {
  private adminUserRepo: AdminUserRepository;
  private auditLogRepo: AuditLogRepository;

  constructor() {
    this.adminUserRepo = new AdminUserRepository();
    this.auditLogRepo = new AuditLogRepository();
  }

  async login(
    username: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResult> {
    try {
      // Check rate limiting
      const rateLimit = await RateLimitService.checkLoginRateLimit(username);
      if (!rateLimit.allowed) {
        await this.auditLogRepo.logAction('system', 'login_rate_limited', {
          payload: { username, ipAddress },
          ipAddress,
          userAgent,
        });

        return {
          success: false,
          error: 'Too many login attempts. Please try again later.',
          rateLimited: true,
        };
      }

      // Find user
      const userRow = await this.adminUserRepo.findByUsername(username);
      if (!userRow) {
        await this.auditLogRepo.logAction('system', 'login_failed_user_not_found', {
          payload: { username, ipAddress },
          ipAddress,
          userAgent,
        });

        return {
          success: false,
          error: 'Invalid username or password',
        };
      }

      // Check if account is locked
      const isLocked = await this.adminUserRepo.isAccountLocked(userRow.id);
      if (isLocked) {
        await this.auditLogRepo.logAction('admin', 'login_failed_account_locked', {
          actorId: userRow.id,
          payload: { username, ipAddress },
          ipAddress,
          userAgent,
        });

        return {
          success: false,
          error: 'Account is temporarily locked due to too many failed attempts',
          accountLocked: true,
        };
      }

      // Verify password
      const passwordValid = await PasswordService.verify(userRow.password_hash, password);
      if (!passwordValid) {
        // Increment failed attempts
        await this.adminUserRepo.incrementFailedAttempts(userRow.id);
        
        // Lock account if too many failed attempts
        if (userRow.failed_attempts + 1 >= MAX_FAILED_LOGIN_ATTEMPTS) {
          await this.adminUserRepo.lockAccount(userRow.id, ACCOUNT_LOCKOUT_DURATION_MINUTES);
          
          await this.auditLogRepo.logAction('admin', 'account_locked_failed_attempts', {
            actorId: userRow.id,
            payload: { username, attempts: userRow.failed_attempts + 1, ipAddress },
            ipAddress,
            userAgent,
          });
        }

        await this.auditLogRepo.logAction('admin', 'login_failed_invalid_password', {
          actorId: userRow.id,
          payload: { username, attempts: userRow.failed_attempts + 1, ipAddress },
          ipAddress,
          userAgent,
        });

        return {
          success: false,
          error: 'Invalid username or password',
        };
      }

      // Reset rate limiting on successful password verification
      RateLimitService.resetLoginAttempts(username);

      // Update last login and reset failed attempts
      await this.adminUserRepo.updateLastLogin(userRow.id);

      const user = this.adminUserRepo.toDomain(userRow);

      // Check if MFA is required
      if (userRow.mfa_enabled) {
        // Create session without MFA verification
        const token = await SessionService.createSession(user, false);

        await this.auditLogRepo.logAction('admin', 'login_success_mfa_required', {
          actorId: user.id,
          payload: { username, ipAddress },
          ipAddress,
          userAgent,
        });

        return {
          success: true,
          user,
          token,
          requiresMFA: true,
        };
      }

      // Create full session
      const token = await SessionService.createSession(user, true);

      await this.auditLogRepo.logAction('admin', 'login_success', {
        actorId: user.id,
        payload: { username, ipAddress },
        ipAddress,
        userAgent,
      });

      return {
        success: true,
        user,
        token,
        requiresMFA: false,
      };

    } catch (error) {
      console.error('Login error:', error);
      
      await this.auditLogRepo.logAction('system', 'login_error', {
        payload: { username, error: error instanceof Error ? error.message : 'Unknown error', ipAddress },
        ipAddress,
        userAgent,
      });

      return {
        success: false,
        error: 'An error occurred during login',
      };
    }
  }

  async verifyMFA(
    sessionToken: string,
    mfaToken: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<MFAVerificationResult> {
    try {
      // Verify session
      const sessionData = await SessionService.verifySession(sessionToken);
      if (!sessionData) {
        return {
          success: false,
          error: 'Invalid session',
        };
      }

      // Check MFA rate limiting
      const rateLimit = await RateLimitService.checkMFAAttempts(sessionData.userId);
      if (!rateLimit.allowed) {
        await this.auditLogRepo.logAction('admin', 'mfa_rate_limited', {
          actorId: sessionData.userId,
          payload: { ipAddress },
          ipAddress,
          userAgent,
        });

        return {
          success: false,
          error: 'Too many MFA attempts. Please try again later.',
          rateLimited: true,
        };
      }

      // Get user's MFA secret
      const userRow = await this.adminUserRepo.findById(sessionData.userId);
      if (!userRow || !userRow.mfa_enabled || !userRow.mfa_secret_encrypted) {
        return {
          success: false,
          error: 'MFA not configured for this account',
        };
      }

      // Decrypt and verify MFA token
      const decryptedSecret = MFAService.decryptSecret(userRow.mfa_secret_encrypted);
      const isValidToken = MFAService.verifyToken(decryptedSecret, mfaToken);

      if (!isValidToken) {
        await this.auditLogRepo.logAction('admin', 'mfa_failed', {
          actorId: sessionData.userId,
          payload: { ipAddress },
          ipAddress,
          userAgent,
        });

        return {
          success: false,
          error: 'Invalid MFA token',
        };
      }

      // Reset MFA rate limiting on success
      RateLimitService.resetMFAAttempts(sessionData.userId);

      // Update session with MFA verification
      const newToken = await SessionService.updateMFAStatus(sessionToken, true);

      await this.auditLogRepo.logAction('admin', 'mfa_success', {
        actorId: sessionData.userId,
        payload: { ipAddress },
        ipAddress,
        userAgent,
      });

      return {
        success: true,
        token: newToken,
      };

    } catch (error) {
      console.error('MFA verification error:', error);
      return {
        success: false,
        error: 'An error occurred during MFA verification',
      };
    }
  }

  // Simple MFA verification for API operations
  async verifyMFAToken(userId: string, mfaToken: string): Promise<boolean> {
    try {
      // Get user's MFA secret
      const userRow = await this.adminUserRepo.findById(userId);
      if (!userRow || !userRow.mfa_enabled || !userRow.mfa_secret_encrypted) {
        return false;
      }

      // Decrypt and verify MFA token
      const decryptedSecret = MFAService.decryptSecret(userRow.mfa_secret_encrypted);
      return MFAService.verifyToken(decryptedSecret, mfaToken);
    } catch (error) {
      console.error('Simple MFA verification error:', error);
      return false;
    }
  }

  async logout(sessionToken: string, ipAddress?: string, userAgent?: string): Promise<void> {
    try {
      const sessionData = await SessionService.verifySession(sessionToken);
      if (sessionData) {
        await this.auditLogRepo.logAction('admin', 'logout', {
          actorId: sessionData.userId,
          payload: { ipAddress },
          ipAddress,
          userAgent,
        });
      }
    } catch (error) {
      console.error('Logout audit error:', error);
    }
  }

  async requireAuth(request: Request): Promise<SessionData | null> {
    try {
      // Skip CSRF validation for development
      // TODO: Re-enable CSRF validation in production
      // if (!CSRFService.validateRequest(request)) {
      //   return null;
      // }

      // Get session token from request cookies
      const cookieHeader = request.headers.get('cookie');
      if (!cookieHeader) {
        return null;
      }

      // Parse cookies manually
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);

      const sessionToken = cookies['admin-session'];
      if (!sessionToken) {
        return null;
      }

      // Verify the session token
      const sessionData = await SessionService.verifySession(sessionToken);
      if (!sessionData) {
        return null;
      }

      return sessionData;
    } catch (error) {
      console.error('Auth requirement check failed:', error);
      return null;
    }
  }

  async requireMFA(sessionData: SessionData): Promise<boolean> {
    return SessionService.requireMFA(sessionData) && sessionData.mfaVerified;
  }

  async hasPermission(sessionData: SessionData, requiredRole: string): Promise<boolean> {
    // Check if user has the required role
    return SessionService.hasRole(sessionData, requiredRole);
  }

  async setupMFA(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{
    secret: string;
    qrCodeUrl: string;
    backupCodes: string[];
  }> {
    const userRow = await this.adminUserRepo.findById(userId);
    if (!userRow) {
      throw new Error('User not found');
    }

    const mfaData = MFAService.generateSecret(userRow.username);
    
    await this.auditLogRepo.logAction('admin', 'mfa_setup_initiated', {
      actorId: userId,
      payload: { ipAddress },
      ipAddress,
      userAgent,
    });

    return mfaData;
  }

  async enableMFA(
    userId: string,
    secret: string,
    verificationToken: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<boolean> {
    // Verify the token before enabling MFA
    const isValid = MFAService.verifyToken(secret, verificationToken);
    if (!isValid) {
      return false;
    }

    // Encrypt and store the secret
    const encryptedSecret = MFAService.encryptSecret(secret);
    const updatedUser = await this.adminUserRepo.enableMFA(userId, encryptedSecret);

    if (updatedUser) {
      await this.auditLogRepo.logAction('admin', 'mfa_enabled', {
        actorId: userId,
        payload: { ipAddress },
        ipAddress,
        userAgent,
      });
      return true;
    }

    return false;
  }

  async disableMFA(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<boolean> {
    const updatedUser = await this.adminUserRepo.disableMFA(userId);

    if (updatedUser) {
      await this.auditLogRepo.logAction('admin', 'mfa_disabled', {
        actorId: userId,
        payload: { ipAddress },
        ipAddress,
        userAgent,
      });
      return true;
    }

    return false;
  }
}

// Export singleton instance
export const authService = new AuthService();

// Helper function for API routes to verify admin session
export async function verifyAdminSession(request: Request): Promise<SessionData | null> {
  try {
    return await authService.requireAuth(request);
  } catch (error) {
    console.error('Admin session verification failed:', error);
    return null;
  }
}

// Helper function for API routes that require admin authentication
export async function requireAdminAuth(request: Request): Promise<{ success: boolean; sessionData?: SessionData; error?: string }> {
  try {
    const sessionData = await verifyAdminSession(request);
    if (!sessionData) {
      return { success: false, error: 'Authentication required' };
    }
    return { success: true, sessionData };
  } catch (error) {
    console.error('Admin auth requirement failed:', error);
    return { success: false, error: 'Authentication failed' };
  }
}

// Export all auth-related services
export {
  PasswordService,
  MFAService,
  SessionService,
  RateLimitService,
  CSRFService,
  AdminUserRepository,
  AuditLogRepository,
};