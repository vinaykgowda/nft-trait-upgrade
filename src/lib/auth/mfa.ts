import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export class MFAService {
  private static readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private static readonly ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production!!';

  static generateSecret(username: string): {
    secret: string;
    qrCodeUrl: string;
    backupCodes: string[];
  } {
    const secret = speakeasy.generateSecret({
      name: username,
      issuer: process.env.MFA_ISSUER || 'NFT Trait Marketplace',
      length: 32,
    });

    const backupCodes = this.generateBackupCodes();

    return {
      secret: secret.base32,
      qrCodeUrl: secret.otpauth_url!,
      backupCodes,
    };
  }

  static async generateQRCode(otpauthUrl: string): Promise<string> {
    try {
      return await QRCode.toDataURL(otpauthUrl);
    } catch (error) {
      console.error('QR code generation failed:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  static verifyToken(secret: string, token: string, window: number = 1): boolean {
    try {
      return speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window,
      });
    } catch (error) {
      console.error('MFA token verification failed:', error);
      return false;
    }
  }

  static encryptSecret(secret: string): string {
    try {
      const iv = randomBytes(16);
      const cipher = createCipheriv(this.ENCRYPTION_ALGORITHM, Buffer.from(this.ENCRYPTION_KEY, 'utf8'), iv);
      
      let encrypted = cipher.update(secret, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      console.error('Secret encryption failed:', error);
      throw new Error('Failed to encrypt secret');
    }
  }

  static decryptSecret(encryptedSecret: string): string {
    try {
      const [ivHex, authTagHex, encrypted] = encryptedSecret.split(':');
      
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      const decipher = createDecipheriv(this.ENCRYPTION_ALGORITHM, Buffer.from(this.ENCRYPTION_KEY, 'utf8'), iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Secret decryption failed:', error);
      throw new Error('Failed to decrypt secret');
    }
  }

  private static generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  static validateBackupCode(storedCodes: string[], providedCode: string): {
    isValid: boolean;
    remainingCodes: string[];
  } {
    const normalizedCode = providedCode.toUpperCase().replace(/\s/g, '');
    const codeIndex = storedCodes.indexOf(normalizedCode);
    
    if (codeIndex === -1) {
      return {
        isValid: false,
        remainingCodes: storedCodes,
      };
    }

    // Remove the used backup code
    const remainingCodes = storedCodes.filter((_, index) => index !== codeIndex);
    
    return {
      isValid: true,
      remainingCodes,
    };
  }
}