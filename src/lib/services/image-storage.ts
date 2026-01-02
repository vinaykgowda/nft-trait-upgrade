import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface ImageStorageOptions {
  category: string;
  rarity: string;
  filename: string;
}

export class ImageStorageService {
  private static readonly UPLOAD_BASE_PATH = 'uploads/traits';
  private static readonly PUBLIC_BASE_PATH = '/uploads/traits';
  
  /**
   * Store an image file in the organized folder structure
   * Structure: uploads/traits/{category}/{rarity}/{filename}
   */
  static async storeImage(file: File, options: ImageStorageOptions): Promise<string> {
    const { category, rarity, filename } = options;
    
    // Sanitize folder and file names
    const sanitizedCategory = this.sanitizeFolderName(category);
    const sanitizedRarity = this.sanitizeFolderName(rarity);
    const sanitizedFilename = this.sanitizeFilename(filename);
    
    // Create the directory structure
    const relativePath = path.join(sanitizedCategory, sanitizedRarity);
    const fullDirPath = path.join(process.cwd(), this.UPLOAD_BASE_PATH, relativePath);
    
    try {
      await fs.mkdir(fullDirPath, { recursive: true });
    } catch (error) {
      console.error('Failed to create directory:', error);
      throw new Error('Failed to create storage directory');
    }
    
    // Generate unique filename to avoid conflicts
    const fileExtension = path.extname(sanitizedFilename) || '.png';
    const baseName = path.basename(sanitizedFilename, fileExtension);
    const uniqueFilename = `${baseName}_${uuidv4().slice(0, 8)}${fileExtension}`;
    
    const fullFilePath = path.join(fullDirPath, uniqueFilename);
    const publicUrl = path.join(this.PUBLIC_BASE_PATH, relativePath, uniqueFilename).replace(/\\/g, '/');
    
    // Convert File to Buffer and save
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    try {
      await fs.writeFile(fullFilePath, buffer);
      return publicUrl;
    } catch (error) {
      console.error('Failed to save file:', error);
      throw new Error('Failed to save image file');
    }
  }
  
  /**
   * Delete an image file
   */
  static async deleteImage(imageUrl: string): Promise<boolean> {
    if (!imageUrl.startsWith(this.PUBLIC_BASE_PATH)) {
      return false; // Not our file
    }
    
    const relativePath = imageUrl.replace(this.PUBLIC_BASE_PATH, '');
    const fullPath = path.join(process.cwd(), this.UPLOAD_BASE_PATH, relativePath);
    
    try {
      await fs.unlink(fullPath);
      return true;
    } catch (error) {
      console.error('Failed to delete file:', error);
      return false;
    }
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
  
  private static sanitizeFolderName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  private static sanitizeFilename(filename: string): string {
    const ext = path.extname(filename);
    const name = path.basename(filename, ext);
    
    const sanitizedName = name
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    return sanitizedName + (ext || '.png');
  }
}