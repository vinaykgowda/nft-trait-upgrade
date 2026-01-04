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
    // Use devnet Irys for testing, mainnet for production
    this.irysUrl = irysUrl || process.env.IRYS_NODE_URL || 'https://devnet.irys.xyz';
  }

  /**
   * Uploads image buffer to Irys (simplified version)
   */
  async uploadImage(
    imageBuffer: Buffer,
    contentType: string = 'image/jpeg'
  ): Promise<IrysUploadResult> {
    try {
      console.log(`📤 Attempting Irys upload (${this.irysUrl})`);
      console.log(`   - Size: ${imageBuffer.length} bytes`);
      console.log(`   - Content-Type: ${contentType}`);
      console.log(`   - Public Key: ${this.keypair.publicKey.toString()}`);

      // For now, we'll use a simplified approach and throw an error
      // This will trigger the fallback to Vercel Blob in the upload-image route
      throw new Error('Irys upload temporarily disabled - using Vercel Blob fallback');

    } catch (error) {
      console.error('❌ Irys upload failed:', error);
      throw new Error(`Irys upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Uploads JSON metadata to Irys (simplified version)
   */
  async uploadMetadata(metadata: NFTMetadata): Promise<IrysUploadResult> {
    try {
      const metadataJson = JSON.stringify(metadata, null, 2);
      const metadataBuffer = Buffer.from(metadataJson, 'utf-8');

      console.log(`📤 Attempting Irys metadata upload`);
      console.log(`   - Size: ${metadataBuffer.length} bytes`);

      // For now, we'll use a simplified approach and throw an error
      // This will trigger the fallback to Vercel Blob in the upload-image route
      throw new Error('Irys metadata upload temporarily disabled - using Vercel Blob fallback');

    } catch (error) {
      console.error('❌ Irys metadata upload failed:', error);
      throw new Error(`Irys metadata upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Uploads both image and metadata, returning the metadata URI
   */
  async uploadImageAndMetadata(
    imageBuffer: Buffer,
    metadata: Omit<NFTMetadata, 'image'>,
    imageContentType: string = 'image/jpeg'
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
      console.error('❌ Error uploading image and metadata:', error);
      throw error;
    }
  }

  /**
   * Checks if a resource exists on Irys
   */
  async checkResourceExists(id: string): Promise<boolean> {
    try {
      console.log(`🔍 Checking if resource exists: ${id}`);
      const response = await fetch(`${this.irysUrl}/${id}`, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.error('❌ Error checking resource existence:', error);
      return false;
    }
  }

  /**
   * Gets the balance for the current keypair
   */
  async getBalance(): Promise<string> {
    try {
      console.log(`💰 Getting balance for: ${this.keypair.publicKey.toString()}`);
      // Return mock balance for now
      return '1000000000'; // 1 SOL in lamports
    } catch (error) {
      console.error('❌ Error getting Irys balance:', error);
      throw error;
    }
  }

  /**
   * Fund the Irys account with SOL
   */
  async fundAccount(amount: number): Promise<{ success: boolean; txId?: string; error?: string }> {
    try {
      console.log(`💸 Funding Irys account with ${amount} SOL`);
      
      // For now, return mock success
      const mockTxId = 'mock_fund_' + Date.now();
      console.log(`✅ Mock funding successful: ${mockTxId}`);
      return { success: true, txId: mockTxId };
    } catch (error) {
      console.error('❌ Error funding account:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}