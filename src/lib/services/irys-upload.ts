import { Keypair } from '@solana/web3.js';

export interface IrysUploadResult {
  id: string;
  url: string;
  size: number;
}

export interface NFTMetadata {
  name: string;
  description: string;
  symbol?: string;
  seller_fee_basis_points?: number;
  image: string;
  external_url?: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  properties: {
    files: Array<{
      uri: string;
      type: string;
    }>;
    category: string;
    creators: Array<{
      address: string;
      share: number;
    }>;
  };
}

export class IrysUploadService {
  private irysUrl: string;
  private keypair: Keypair;

  constructor(keypair: Keypair, irysUrl?: string) {
    this.keypair = keypair;
    // Use devnet Irys for testing
    this.irysUrl = irysUrl || process.env.IRYS_NODE_URL || 'https://devnet.irys.xyz';
  }

  /**
   * Uploads image buffer to Irys
   */
  async uploadImage(
    imageBuffer: Buffer,
    contentType: string = 'image/png'
  ): Promise<IrysUploadResult> {
    try {
      console.log(`📤 Uploading image to Irys (${this.irysUrl})`);
      console.log(`   - Size: ${imageBuffer.length} bytes`);
      console.log(`   - Content-Type: ${contentType}`);
      console.log(`   - Public Key: ${this.keypair.publicKey.toString()}`);

      // For testing purposes, we'll simulate the upload
      // In production, you would use the actual Irys SDK
      const mockId = 'mock_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const mockUrl = `${this.irysUrl}/${mockId}`;

      console.log(`✅ Mock upload successful`);
      console.log(`   - ID: ${mockId}`);
      console.log(`   - URL: ${mockUrl}`);
      
      return {
        id: mockId,
        url: mockUrl,
        size: imageBuffer.length
      };
    } catch (error) {
      console.error('Error uploading image to Irys:', error);
      throw new Error(`Image upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Uploads JSON metadata to Irys
   */
  async uploadMetadata(metadata: NFTMetadata): Promise<IrysUploadResult> {
    try {
      const metadataJson = JSON.stringify(metadata, null, 2);
      const metadataBuffer = Buffer.from(metadataJson, 'utf-8');

      console.log(`📤 Uploading metadata to Irys`);
      console.log(`   - Size: ${metadataBuffer.length} bytes`);
      console.log(`   - Metadata:`, metadata);

      // For testing purposes, we'll simulate the upload
      const mockId = 'metadata_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const mockUrl = `${this.irysUrl}/${mockId}`;

      console.log(`✅ Mock metadata upload successful`);
      console.log(`   - ID: ${mockId}`);
      console.log(`   - URL: ${mockUrl}`);
      
      return {
        id: mockId,
        url: mockUrl,
        size: metadataBuffer.length
      };
    } catch (error) {
      console.error('Error uploading metadata to Irys:', error);
      throw new Error(`Metadata upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Uploads both image and metadata, returning the metadata URI
   */
  async uploadImageAndMetadata(
    imageBuffer: Buffer,
    metadata: Omit<NFTMetadata, 'image'>,
    imageContentType: string = 'image/png'
  ): Promise<{ imageResult: IrysUploadResult; metadataResult: IrysUploadResult }> {
    try {
      // Upload image first
      const imageResult = await this.uploadImage(imageBuffer, imageContentType);

      // Update metadata with image URL
      const completeMetadata: NFTMetadata = {
        ...metadata,
        image: imageResult.url,
        properties: {
          ...metadata.properties,
          files: [
            {
              uri: imageResult.url,
              type: imageContentType
            },
            ...metadata.properties.files
          ],
          creators: metadata.properties.creators || []
        }
      };

      // Upload metadata
      const metadataResult = await this.uploadMetadata(completeMetadata);

      return {
        imageResult,
        metadataResult
      };
    } catch (error) {
      console.error('Error uploading image and metadata:', error);
      throw error;
    }
  }

  /**
   * Checks if a resource exists on Irys
   */
  async checkResourceExists(id: string): Promise<boolean> {
    try {
      console.log(`🔍 Checking if resource exists: ${id}`);
      // For testing, always return true for mock IDs
      return id.startsWith('mock_') || id.startsWith('metadata_');
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets the balance for the current keypair
   */
  async getBalance(): Promise<number> {
    try {
      console.log(`💰 Getting balance for: ${this.keypair.publicKey.toString()}`);
      // For testing, return a mock balance
      return 1000000; // 1 SOL in lamports
    } catch (error) {
      console.error('Error getting Irys balance:', error);
      throw error;
    }
  }
}