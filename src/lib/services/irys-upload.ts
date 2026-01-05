import { Keypair } from '@solana/web3.js';
import Irys from '@irys/sdk';

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
  private irysClient: Irys | null = null;

  constructor(keypair: Keypair, irysUrl?: string) {
    this.keypair = keypair;
    // Use devnet Irys for testing, mainnet for production
    this.irysUrl = irysUrl || process.env.IRYS_NODE_URL || 'https://devnet.irys.xyz';
  }

  private async getIrysClient(): Promise<Irys> {
    if (!this.irysClient) {
      try {
        this.irysClient = new Irys({
          url: this.irysUrl,
          token: 'solana',
          key: this.keypair.secretKey,
        });
        console.log(`🔗 Connected to Irys: ${this.irysUrl}`);
      } catch (error) {
        console.error('❌ Failed to initialize Irys client:', error);
        throw new Error(`Irys initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    return this.irysClient;
  }

  /**
   * Uploads image buffer to Irys
   */
  async uploadImage(
    imageBuffer: Buffer,
    contentType: string = 'image/jpeg'
  ): Promise<IrysUploadResult> {
    try {
      console.log(`📤 Uploading image to Irys (${this.irysUrl})`);
      console.log(`   - Size: ${imageBuffer.length} bytes`);
      console.log(`   - Content-Type: ${contentType}`);
      console.log(`   - Public Key: ${this.keypair.publicKey.toString()}`);

      const irys = await this.getIrysClient();

      // Check balance before upload
      const balance = await irys.getLoadedBalance();
      console.log(`💰 Current Irys balance: ${balance} atomic units`);

      // Estimate cost
      const price = await irys.getPrice(imageBuffer.length);
      console.log(`💸 Upload cost estimate: ${price} atomic units`);

      // Convert balance and price to BigInt for proper comparison
      const balanceBigInt = BigInt(balance.toString());
      const priceBigInt = BigInt(price.toString());

      if (balanceBigInt < priceBigInt) {
        console.warn('⚠️ Insufficient balance for upload, attempting anyway...');
        console.warn(`⚠️ Balance: ${balanceBigInt.toString()}, Required: ${priceBigInt.toString()}`);
      } else {
        console.log(`✅ Sufficient balance for upload: ${balanceBigInt.toString()} >= ${priceBigInt.toString()}`);
      }

      // Upload the image
      const response = await irys.upload(imageBuffer, {
        tags: [
          { name: 'Content-Type', value: contentType },
          { name: 'Application', value: 'NFT-Trait-Marketplace' },
          { name: 'Type', value: 'image' },
          { name: 'Timestamp', value: Date.now().toString() }
        ]
      });

      const uploadUrl = `${this.irysUrl}/${response.id}`;

      console.log(`✅ Image uploaded to Irys successfully`);
      console.log(`   - ID: ${response.id}`);
      console.log(`   - URL: ${uploadUrl}`);
      
      return {
        id: response.id,
        url: uploadUrl,
        size: imageBuffer.length
      };
    } catch (error) {
      console.error('❌ Error uploading image to Irys:', error);
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

      const irys = await this.getIrysClient();

      // Upload the metadata
      const response = await irys.upload(metadataBuffer, {
        tags: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Application', value: 'NFT-Trait-Marketplace' },
          { name: 'Type', value: 'metadata' },
          { name: 'Timestamp', value: Date.now().toString() }
        ]
      });

      const uploadUrl = `${this.irysUrl}/${response.id}`;

      console.log(`✅ Metadata uploaded to Irys successfully`);
      console.log(`   - ID: ${response.id}`);
      console.log(`   - URL: ${uploadUrl}`);
      
      return {
        id: response.id,
        url: uploadUrl,
        size: metadataBuffer.length
      };
    } catch (error) {
      console.error('❌ Error uploading metadata to Irys:', error);
      throw new Error(`Metadata upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      const irys = await this.getIrysClient();
      const balance = await irys.getLoadedBalance();
      return balance.toString();
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
      const irys = await this.getIrysClient();
      
      // Convert SOL to lamports (1 SOL = 1,000,000,000 lamports)
      const lamports = Math.floor(amount * 1_000_000_000);
      
      const response = await irys.fund(lamports);
      
      console.log(`✅ Account funded successfully: ${response.id}`);
      return { success: true, txId: response.id };
    } catch (error) {
      console.error('❌ Error funding account:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}