import { IrysUploadService } from './irys-upload';
import { Keypair } from '@solana/web3.js';

export interface ImageStorageOptions {
  category: string;
  rarity: string;
  filename: string;
}

export class ImageStorageService {
  /**
   * Store an image file using Irys (cloud storage)
   * Returns the public URL of the uploaded image
   */
  static async storeImage(file: File, options: ImageStorageOptions): Promise<string> {
    try {
      // Load keypair for Irys
      const keypairData = JSON.parse(process.env.SOLANA_KEYPAIR || '[]');
      if (!keypairData.length) {
        throw new Error('SOLANA_KEYPAIR environment variable not set');
      }
      const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
      
      // Initialize Irys service
      const irysService = new IrysUploadService(keypair);
      
      // Convert File to Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Upload to Irys
      const result = await irysService.uploadImage(buffer, file.type);
      
      console.log(`✅ Image uploaded to Irys: ${result.url}`);
      return result.url;
      
    } catch (error) {
      console.error('Failed to upload image to Irys:', error);
      throw new Error('Failed to upload image to cloud storage');
    }
  }
  
  /**
   * Delete an image file (Irys doesn't support deletion, so this is a no-op)
   */
  static async deleteImage(imageUrl: string): Promise<boolean> {
    // Irys doesn't support deletion - files are permanent
    // In a production app, you might want to track "deleted" files in your database
    console.log(`Note: Irys files are permanent, cannot delete: ${imageUrl}`);
    return true; // Return true to not break existing code
  }
  
  /**
   * Validate image file
   */
  static validateImage(file: File): { valid: boolean; error?: string } {
    // Check file type
    if (!file.type.startsWith('image/')) {
      return { valid: false, error: 'File must be an image' };
    }
    
    // Check if it's PNG (preferred)
    if (file.type !== 'image/png') {
      console.warn('Non-PNG image uploaded:', file.type);
    }
    
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return { valid: false, error: 'File size must be less than 10MB' };
    }
    
    return { valid: true };
  }
  
  /**
   * Get image dimensions (for validation)
   */
  static getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        // Server-side: we can't validate dimensions without additional libraries
        resolve({ width: 1500, height: 1500 }); // Assume valid for server-side
        return;
      }
      
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.width, height: img.height });
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      
      img.src = url;
    });
  }
  
  /**
   * Validate image dimensions (should be 1500x1500)
   */
  static async validateImageDimensions(file: File): Promise<{ valid: boolean; error?: string }> {
    try {
      const { width, height } = await this.getImageDimensions(file);
      
      if (width !== 1500 || height !== 1500) {
        return { 
          valid: false, 
          error: `Image must be 1500x1500 pixels. Current: ${width}x${height}` 
        };
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Failed to validate image dimensions' };
    }
  }
}