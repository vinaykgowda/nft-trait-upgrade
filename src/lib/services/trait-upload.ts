import { z } from 'zod';

export interface TraitUploadFile {
  file: File;
  traitType: string;
  value: string;
  preview: string;
}

export interface BulkUploadSettings {
  category: string;
  priceSpegod: string;
  priceSldz: string;
  totalQuantity: string;
  artistWallet?: string;
  artistCommission?: string;
  forSale: boolean;
}

export interface ParsedTraitData {
  name: string;
  traitType: string;
  value: string;
  imageUrl: string;
  category: string;
  priceAmount: string;
  priceTokenId: string;
  totalSupply?: number;
  active: boolean;
  artistWallet?: string;
  artistCommission?: number;
  rarityTierId?: string; // Add rarity tier ID
}

export class TraitUploadService {
  /**
   * Parse filenames to extract trait information
   * Supports formats:
   * - "TraitType/TraitValue.png"
   * - "TraitType - TraitValue.png"
   * - "TraitType_TraitValue.png"
   */
  static parseFileName(fileName: string, defaultCategory: string = 'Unknown'): { traitType: string; value: string } {
    // Remove file extension
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
    
    let traitType = '';
    let value = '';
    
    if (nameWithoutExt.includes('/')) {
      [traitType, value] = nameWithoutExt.split('/');
    } else if (nameWithoutExt.includes(' - ')) {
      [traitType, value] = nameWithoutExt.split(' - ');
    } else if (nameWithoutExt.includes('_')) {
      [traitType, value] = nameWithoutExt.split('_');
    } else {
      // Default to filename as value
      traitType = defaultCategory;
      value = nameWithoutExt;
    }
    
    return {
      traitType: traitType.trim(),
      value: value.trim()
    };
  }

  /**
   * Process multiple files for bulk upload
   */
  static async processFiles(files: FileList, defaultCategory: string = 'Unknown'): Promise<TraitUploadFile[]> {
    const fileArray = Array.from(files);
    const processed: TraitUploadFile[] = [];
    
    for (const file of fileArray) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        console.warn(`Skipping non-image file: ${file.name}`);
        continue;
      }
      
      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        console.warn(`Skipping large file: ${file.name} (${file.size} bytes)`);
        continue;
      }
      
      const { traitType, value } = this.parseFileName(file.name, defaultCategory);
      const preview = URL.createObjectURL(file);
      
      processed.push({
        file,
        traitType,
        value,
        preview
      });
    }
    
    return processed;
  }

  /**
   * Upload a single image file (mock implementation)
   * In production, this would upload to your storage service (AWS S3, IPFS, etc.)
   */
  static async uploadImage(file: File): Promise<string> {
    // Mock upload - replace with actual implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockUrl = `https://example.com/trait-images/${Date.now()}-${file.name}`;
        resolve(mockUrl);
      }, 1000);
    });
  }

  /**
   * Convert bulk upload data to API format
   */
  static prepareBulkUploadData(
    files: TraitUploadFile[],
    settings: BulkUploadSettings,
    slotMapping: Record<string, string>, // traitType -> slotId
    tokenMapping: Record<string, string>, // token symbol -> tokenId
    rarityTierMapping: Record<string, string> // rarity name -> rarityTierId
  ): ParsedTraitData[] {
    return files.map(file => {
      // Determine slot ID based on trait type
      const slotId = slotMapping[file.traitType] || slotMapping[settings.category] || Object.values(slotMapping)[0];
      
      // Determine token ID (prefer SLDZ if price > 0, otherwise SPEGOD)
      const useSpegod = settings.priceSpegod !== '0' && settings.priceSldz === '0';
      const tokenSymbol = useSpegod ? 'SPEGOD' : 'SLDZ';
      const priceAmount = useSpegod ? settings.priceSpegod : settings.priceSldz;
      const tokenId = tokenMapping[tokenSymbol];
      
      return {
        name: file.value,
        traitType: file.traitType,
        value: file.value,
        imageUrl: file.preview, // This would be the uploaded URL in production
        category: settings.category,
        priceAmount,
        priceTokenId: tokenId,
        totalSupply: settings.totalQuantity ? parseInt(settings.totalQuantity) : undefined,
        active: settings.forSale,
        artistWallet: settings.artistWallet || undefined,
        artistCommission: settings.artistCommission ? parseFloat(settings.artistCommission) : undefined,
      };
    });
  }

  /**
   * Validate trait data before upload
   */
  static validateTraitData(data: ParsedTraitData[]): { valid: ParsedTraitData[]; invalid: Array<{ data: ParsedTraitData; errors: string[] }> } {
    const valid: ParsedTraitData[] = [];
    const invalid: Array<{ data: ParsedTraitData; errors: string[] }> = [];
    
    for (const trait of data) {
      const errors: string[] = [];
      
      if (!trait.name || trait.name.trim().length === 0) {
        errors.push('Trait name is required');
      }
      
      if (!trait.imageUrl) {
        errors.push('Image URL is required');
      }
      
      if (!trait.priceTokenId) {
        errors.push('Price token is required');
      }
      
      if (!trait.priceAmount || isNaN(parseFloat(trait.priceAmount))) {
        errors.push('Valid price amount is required');
      }
      
      if (trait.totalSupply && trait.totalSupply <= 0) {
        errors.push('Total supply must be positive');
      }
      
      if (trait.artistCommission && (trait.artistCommission < 0 || trait.artistCommission > 50)) {
        errors.push('Artist commission must be between 0 and 50%');
      }
      
      if (errors.length === 0) {
        valid.push(trait);
      } else {
        invalid.push({ data: trait, errors });
      }
    }
    
    return { valid, invalid };
  }

  /**
   * Generate preview data for UI display
   */
  static generatePreviewData(files: TraitUploadFile[], settings: BulkUploadSettings) {
    return {
      totalFiles: files.length,
      categories: [...new Set(files.map(f => f.traitType))],
      estimatedCost: this.calculateEstimatedCost(files, settings),
      summary: {
        forSale: settings.forSale,
        totalQuantity: settings.totalQuantity,
        pricePerTrait: settings.priceSldz !== '0' ? `${settings.priceSldz} SLDZ` : `${settings.priceSpegod} SPEGOD`,
        artistCommission: settings.artistCommission ? `${settings.artistCommission}%` : 'None',
      }
    };
  }

  /**
   * Calculate estimated costs for bulk upload
   */
  private static calculateEstimatedCost(files: TraitUploadFile[], settings: BulkUploadSettings): {
    totalTraits: number;
    totalSupply: number;
    estimatedRevenue: string;
  } {
    const totalTraits = files.length;
    const quantityPerTrait = parseInt(settings.totalQuantity) || 1;
    const totalSupply = totalTraits * quantityPerTrait;
    
    const pricePerUnit = parseFloat(settings.priceSldz !== '0' ? settings.priceSldz : settings.priceSpegod) || 0;
    const estimatedRevenue = (totalSupply * pricePerUnit).toFixed(2);
    const tokenSymbol = settings.priceSldz !== '0' ? 'SLDZ' : 'SPEGOD';
    
    return {
      totalTraits,
      totalSupply,
      estimatedRevenue: `${estimatedRevenue} ${tokenSymbol}`,
    };
  }
}

// Validation schemas
export const traitUploadSchema = z.object({
  name: z.string().min(1).max(255),
  traitType: z.string().min(1).max(100),
  value: z.string().min(1).max(255),
  imageUrl: z.string().url(),
  category: z.string().min(1),
  priceAmount: z.string().regex(/^\d+(\.\d+)?$/),
  priceTokenId: z.string().uuid(),
  totalSupply: z.number().int().positive().optional(),
  active: z.boolean(),
  artistWallet: z.string().optional(),
  artistCommission: z.number().min(0).max(50).optional(),
});

export const bulkUploadSettingsSchema = z.object({
  category: z.string().min(1),
  priceSpegod: z.string().regex(/^\d+(\.\d+)?$/),
  priceSldz: z.string().regex(/^\d+(\.\d+)?$/),
  totalQuantity: z.string().regex(/^\d+$/),
  artistWallet: z.string().optional(),
  artistCommission: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  forSale: z.boolean(),
});