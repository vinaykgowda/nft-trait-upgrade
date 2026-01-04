import { IrysUploadService } from './irys-upload';
import { Keypair } from '@solana/web3.js';
import { put } from '@vercel/blob';

export interface ImageStorageOptions {
  category: string;
  rarity: string;
  filename: string;
  permanent?: boolean; // true = Irys (blockchain permanent), false = Vercel Blob (persistent, cheaper)
}

export class ImageStorageService {
  /**
   * Store an image file using either Vercel Blob (persistent, cheaper) or Irys (blockchain permanent)
   * Returns the public URL of the uploaded image
   * 
   * DEFAULT: Vercel Blob - Perfect for trait images that need to be accessible for NFT composition
   */
  static async storeImage(file: File, options: ImageStorageOptions): Promise<string> {
    const { permanent = false } = options; // Default to Vercel Blob (persistent & cheaper)
    
    if (permanent) {
      return this.storeImageIrys(file, options);
    } else {
      return this.storeImageVercelBlob(file, options);
    }
  }
  
  /**
   * Store image permanently on blockchain via Irys (~$0.001-0.005 per image)
   * Use for: Final NFT images, metadata that needs blockchain permanence
   */
  private static async storeImageIrys(file: File, options: ImageStorageOptions): Promise<string> {
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
      
      console.log(`✅ Image uploaded to Irys (blockchain permanent): ${result.url}`);
      return result.url;
      
    } catch (error) {
      console.error('Failed to upload image to Irys:', error);
      throw new Error('Failed to upload image to blockchain storage');
    }
  }
  
  /**
   * Store image persistently on Vercel Blob (~$0.15/GB/month)
   * Use for: Trait images, assets that need to be accessible for composition
   * 
   * PERFECT FOR YOUR USE CASE: Trait images that are used to build final NFTs
   */
  private static async storeImageVercelBlob(file: File, options: ImageStorageOptions): Promise<string> {
    try {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        throw new Error('BLOB_READ_WRITE_TOKEN environment variable not set');
      }
      
      const { category, rarity, filename } = options;
      
      // Create a structured filename
      const timestamp = Date.now();
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const blobFilename = `traits/${category}/${rarity}/${timestamp}_${sanitizedFilename}`;
      
      // Upload to Vercel Blob
      const blob = await put(blobFilename, file, {
        access: 'public',
        contentType: file.type,
      });
      
      console.log(`✅ Image uploaded to Vercel Blob (persistent): ${blob.url}`);
      return blob.url;
      
    } catch (error) {
      console.error('Failed to upload image to Vercel Blob:', error);
      throw new Error('Failed to upload image to persistent storage');
    }
  }
  
  /**
   * Delete an image file
   */
  static async deleteImage(imageUrl: string): Promise<boolean> {
    if (imageUrl.includes('irys.xyz') || imageUrl.includes('arweave.net')) {
      // Irys/Arweave files are permanent - cannot delete
      console.log(`Note: Irys/Arweave files are permanent, cannot delete: ${imageUrl}`);
      return true;
    }
    
    if (imageUrl.includes('vercel-storage.com')) {
      // TODO: Implement Vercel Blob deletion if needed
      console.log(`Note: Vercel Blob deletion not implemented: ${imageUrl}`);
      return true;
    }
    
    return false;
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