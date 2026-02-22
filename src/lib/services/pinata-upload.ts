import { PinataUploadResult, NFTMetadata } from '@/types';
import { PinataSDK } from 'pinata';

/**
 * PinataUploadService - Handles uploads to Pinata IPFS network
 * 
 * This service replaces IrysUploadService for decentralized storage via IPFS.
 * It uploads images and metadata to Pinata and returns IPFS CIDs with gateway URLs.
 * 
 * Requirements: 2.1, 2.2, 5.3, 5.4
 */
export class PinataUploadService {
  private jwt: string;
  private gateway: string;
  private pinata: PinataSDK;

  /**
   * Initialize Pinata upload service with JWT authentication and gateway configuration.
   * 
   * @throws {Error} When PINATA_JWT environment variable is missing (only in production)
   * @throws {Error} When PINATA_GATEWAY environment variable is missing (only in production)
   * 
   * Requirements: 2.2, 5.3, 5.4
   */
  constructor() {
    // Validate PINATA_JWT
    const jwt = process.env.PINATA_JWT;
    if (!jwt) {
      // Only throw during runtime, not during build
      if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV) {
        throw new Error('PINATA_JWT environment variable is required');
      }
      // Use placeholder for build time
      this.jwt = 'build-time-placeholder';
      this.gateway = 'build-time-placeholder';
      this.pinata = null as any; // Will fail if actually used during build
      console.warn('⚠️  Pinata service initialized without credentials (build time)');
      return;
    }
    this.jwt = jwt;

    // Validate PINATA_GATEWAY
    const gateway = process.env.PINATA_GATEWAY;
    if (!gateway) {
      throw new Error('PINATA_GATEWAY environment variable is required');
    }
    this.gateway = gateway;

    // Initialize Pinata SDK
    this.pinata = new PinataSDK({
      pinataJwt: this.jwt,
    });

    // Log service initialization with gateway config (Requirement 12.4)
    console.log('🔑 Pinata service initialized');
    console.log(`- Gateway configured: ${this.gateway}`);
    console.log(`- Authentication: JWT configured`);
  }

  /**
   * Upload an image buffer to Pinata IPFS
   * 
   * @param imageBuffer - Image data as Buffer
   * @param contentType - MIME type (e.g., "image/webp")
   * @param metadata - Optional metadata for the upload
   * @returns Upload result with CID and gateway URL
   * 
   * Requirements: 2.3, 3.1, 3.2, 3.5
   */
  async uploadImage(
    imageBuffer: Buffer,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<PinataUploadResult> {
    const startTime = Date.now();
    
    try {
      console.log(`📤 Uploading image to Pinata...`);
      console.log(`- Buffer size: ${imageBuffer.length} bytes`);
      console.log(`- Content type: ${contentType}`);

      // Create a File object from the buffer
      const blob = new Blob([new Uint8Array(imageBuffer)], { type: contentType });
      const file = new File([blob], 'image', { type: contentType });

      // Upload to Pinata with authentication headers (Requirement 3.5)
      // The SDK automatically includes JWT authentication
      // Access the public upload API (public is a property name, not a keyword here)
      let uploadBuilder = this.pinata.upload.public.file(file);
      
      // Add optional metadata as keyvalues if provided
      if (metadata) {
        uploadBuilder = uploadBuilder.keyvalues(metadata);
      }
      
      const uploadResult = await uploadBuilder;

      const duration = Date.now() - startTime;
      const cid = uploadResult.cid;
      const url = this.constructGatewayUrl(cid);

      // Log success (Requirement 12.2)
      console.log(`✅ Image uploaded successfully`);
      console.log(`- CID: ${cid}`);
      console.log(`- Gateway URL: ${url}`);
      console.log(`- Upload duration: ${duration}ms`);

      return {
        cid,
        url,
        size: imageBuffer.length,
        contentType,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // Log error (Requirement 12.3)
      console.error(`❌ Image upload failed after ${duration}ms`);
      console.error(`- Error type: ${error?.name || 'Unknown'}`);
      console.error(`- Error message: ${error?.message || 'Unknown error'}`);
      console.error(`- Buffer size: ${imageBuffer.length} bytes`);
      console.error(`- Content type: ${contentType}`);

      // Handle specific error types (Requirements 10.1, 10.2, 10.3, 10.5)
      if (error?.response?.status === 401 || error?.message?.includes('auth')) {
        throw new Error(`Invalid Pinata JWT credentials: ${error.message}`);
      }
      
      if (error?.response?.status === 429 || error?.message?.includes('rate limit')) {
        throw new Error(`Pinata rate limit exceeded: ${error.message}`);
      }
      
      if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT' || error?.message?.includes('network')) {
        throw new Error(`Pinata upload failed: network error - ${error.message}`);
      }

      // Generic error with original message (Requirement 10.5)
      throw new Error(`Pinata upload failed: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Upload metadata JSON to Pinata IPFS
   * 
   * @param metadata - NFT metadata object
   * @returns Upload result with CID and gateway URL
   * 
   * Requirements: 2.4, 4.1, 4.2
   */
  async uploadMetadata(
    metadata: NFTMetadata
  ): Promise<PinataUploadResult> {
    const startTime = Date.now();
    
    try {
      console.log(`📤 Uploading metadata to Pinata...`);
      console.log(`- Metadata name: ${metadata.name}`);
      console.log(`- Attributes count: ${metadata.attributes?.length || 0}`);

      // Serialize metadata to JSON (Requirement 4.1)
      const metadataJson = JSON.stringify(metadata);
      const metadataSize = Buffer.byteLength(metadataJson, 'utf8');
      
      console.log(`- JSON size: ${metadataSize} bytes`);

      // Upload to Pinata with content-type "application/json" (Requirement 4.2)
      // The SDK automatically includes JWT authentication
      const uploadResult = await this.pinata.upload.public.json(metadata);

      const duration = Date.now() - startTime;
      const cid = uploadResult.cid;
      const url = this.constructGatewayUrl(cid);

      // Log success (Requirement 12.2)
      console.log(`✅ Metadata uploaded successfully`);
      console.log(`- CID: ${cid}`);
      console.log(`- Gateway URL: ${url}`);
      console.log(`- Upload duration: ${duration}ms`);

      return {
        cid,
        url,
        size: metadataSize,
        contentType: 'application/json',
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // Log error (Requirement 12.3)
      console.error(`❌ Metadata upload failed after ${duration}ms`);
      console.error(`- Error type: ${error?.name || 'Unknown'}`);
      console.error(`- Error message: ${error?.message || 'Unknown error'}`);
      console.error(`- Metadata name: ${metadata.name}`);

      // Handle specific error types (Requirements 10.1, 10.2, 10.3, 10.5)
      if (error?.response?.status === 401 || error?.message?.includes('auth')) {
        throw new Error(`Invalid Pinata JWT credentials: ${error.message}`);
      }
      
      if (error?.response?.status === 429 || error?.message?.includes('rate limit')) {
        throw new Error(`Pinata rate limit exceeded: ${error.message}`);
      }
      
      if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT' || error?.message?.includes('network')) {
        throw new Error(`Pinata upload failed: network error - ${error.message}`);
      }

      // Generic error with original message (Requirement 10.5)
      throw new Error(`Pinata metadata upload failed: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Construct gateway URL from CID
   * 
   * @param cid - IPFS Content Identifier
   * @returns Full HTTPS gateway URL
   * 
   * Requirements: 3.4, 4.4, 14.1, 14.2, 14.3
   */
  private constructGatewayUrl(cid: string): string {
    // Validate CID is non-empty (Requirement 14.3)
    if (!cid || cid.trim().length === 0) {
      throw new Error('CID must be non-empty');
    }

    // Remove any trailing slashes from gateway (Requirement 14.2)
    const cleanGateway = this.gateway.replace(/\/+$/, '');

    // Construct URL as https://{gateway}/ipfs/{cid} (Requirement 14.1)
    const url = `https://${cleanGateway}/ipfs/${cid}`;

    return url;
  }
}
