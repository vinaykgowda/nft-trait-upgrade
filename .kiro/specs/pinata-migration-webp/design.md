# Design Document: Pinata Migration with WebP Support

## Overview

This design specifies the migration of the NFT trait marketplace's image and metadata upload system from Irys to Pinata (IPFS), while upgrading the image format from JPEG to WebP. The migration involves creating a new `PinataUploadService` to replace `IrysUploadService`, updating the `ImageCompositionService` to support WebP output, and modifying all dependent services and API endpoints to work with IPFS content identifiers (CIDs) and Pinata gateway URLs.

### Key Changes

1. **New Service**: `PinataUploadService` class for IPFS uploads via Pinata API
2. **Image Format**: WebP instead of JPEG for final compositions (1500x1500, quality 90)
3. **Storage Backend**: Pinata IPFS instead of Irys permanent storage
4. **URL Format**: IPFS gateway URLs (`https://{gateway}/ipfs/{cid}`) instead of Irys URLs
5. **Dependencies**: Add `pinata` npm package, remove `@irys/sdk` after migration

### Migration Benefits

- **Decentralization**: IPFS provides truly decentralized content storage
- **Efficiency**: WebP reduces file sizes by 25-35% compared to JPEG at equivalent quality
- **Cost**: Pinata offers competitive pricing for IPFS pinning
- **Compatibility**: IPFS is widely supported across NFT marketplaces and wallets

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     API Layer                                │
│  /api/upload-image  /api/compose-image  /api/update-nft-metadata │
└────────────┬────────────────┬────────────────┬──────────────┘
             │                │                │
             ▼                ▼                ▼
┌────────────────────┐  ┌──────────────────┐  ┌──────────────┐
│ PinataUploadService│  │ImageComposition  │  │MetadataService│
│                    │  │Service           │  │              │
│ - uploadImage()    │  │ - composeImage() │  │ - buildMeta()│
│ - uploadMetadata() │  │ - createFinal()  │  │ - uploadMeta()│
└────────┬───────────┘  └────────┬─────────┘  └──────┬───────┘
         │                       │                    │
         │                       │                    │
         ▼                       ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Pinata IPFS Network                       │
│  - File Upload API                                           │
│  - JSON Upload API                                           │
│  - Gateway (https://{gateway}/ipfs/{cid})                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Metaplex Core (Solana Blockchain)               │
│  CoreAssetUpdateService.updateAssetUri(metadataUri)          │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Image Composition**: User purchases trait → `ImageCompositionService` creates WebP image
2. **Image Upload**: WebP buffer → `PinataUploadService.uploadImage()` → IPFS CID + gateway URL
3. **Metadata Creation**: `MetadataService` builds JSON with image gateway URL
4. **Metadata Upload**: Metadata JSON → `PinataUploadService.uploadMetadata()` → metadata CID + gateway URL
5. **On-Chain Update**: `CoreAssetUpdateService` updates Metaplex Core asset with metadata gateway URL
6. **NFT Display**: Wallets/marketplaces fetch metadata from IPFS → display updated NFT

## Components and Interfaces

### PinataUploadService

New service class for uploading content to Pinata's IPFS network.

```typescript
export interface PinataUploadResult {
  cid: string;           // IPFS Content Identifier
  url: string;           // Full gateway URL
  size: number;          // File size in bytes
  contentType: string;   // MIME type
}

export class PinataUploadService {
  private jwt: string;
  private gateway: string;

  constructor() {
    // Load from environment variables
    this.jwt = process.env.PINATA_JWT;
    this.gateway = process.env.PINATA_GATEWAY;
    
    if (!this.jwt) {
      throw new Error('PINATA_JWT environment variable is required');
    }
    if (!this.gateway) {
      throw new Error('PINATA_GATEWAY environment variable is required');
    }
  }

  /**
   * Upload an image buffer to Pinata IPFS
   * @param imageBuffer - Image data as Buffer
   * @param contentType - MIME type (e.g., "image/webp")
   * @param metadata - Optional metadata for the upload
   * @returns Upload result with CID and gateway URL
   */
  async uploadImage(
    imageBuffer: Buffer,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<PinataUploadResult>;

  /**
   * Upload metadata JSON to Pinata IPFS
   * @param metadata - NFT metadata object
   * @returns Upload result with CID and gateway URL
   */
  async uploadMetadata(
    metadata: NFTMetadata
  ): Promise<PinataUploadResult>;

  /**
   * Construct gateway URL from CID
   * @param cid - IPFS Content Identifier
   * @returns Full HTTPS gateway URL
   */
  private constructGatewayUrl(cid: string): string;
}
```

#### Implementation Details

**Pinata API Integration**:
- Use the official `pinata` npm SDK for uploads
- Authentication via JWT token in `Authorization: Bearer {jwt}` header
- File upload endpoint: SDK handles multipart/form-data encoding
- JSON upload: SDK handles JSON serialization and upload

**Gateway URL Construction**:
- Format: `https://{PINATA_GATEWAY}/ipfs/{cid}`
- Example: `https://fun-llama-300.mypinata.cloud/ipfs/QmXyz...`
- No trailing slashes
- Validate CID is non-empty before construction

**Error Handling**:
- Authentication errors (401): Throw with message "Invalid Pinata JWT credentials"
- Network errors: Throw with message "Pinata upload failed: network error"
- Rate limiting (429): Throw with message "Pinata rate limit exceeded"
- Include original error message in all thrown exceptions

### ImageCompositionService Updates

Extend existing service to support WebP output format.

```typescript
export interface CompositionOptions {
  width?: number;
  height?: number;
  format?: 'png' | 'jpeg' | 'webp';  // Add 'webp' option
  quality?: number;
  baseTraits?: TraitSelection;
  forceTransparentBase?: boolean;
  fetchTimeoutMs?: number;
}

export interface CompositionResult {
  imageBuffer: Buffer;
  width: number;
  height: number;
  format: 'png' | 'jpeg' | 'webp';  // Add 'webp' to union type
}

export class ImageCompositionService {
  /**
   * Creates a final high-quality image composition for metadata.
   * NOW GENERATES WEBP FORMAT (1500x1500, quality 90)
   */
  async createFinalComposition(
    baseImageUrl: string,
    selectedTraits: TraitSelection,
    slots: TraitSlot[],
    baseUrl?: string,
    baseTraits?: TraitSelection
  ): Promise<CompositionResult> {
    return this.composeImage(
      baseImageUrl,
      selectedTraits,
      slots,
      {
        width: 1500,
        height: 1500,
        format: 'webp',      // Changed from 'jpeg'
        quality: 90,
        baseTraits,
        forceTransparentBase: true
      },
      baseUrl
    );
  }

  /**
   * Core composition method - add WebP support
   */
  async composeImage(
    baseImageUrl: string,
    selectedTraits: TraitSelection,
    slots: TraitSlot[],
    options: CompositionOptions = {},
    baseUrl?: string
  ): Promise<CompositionResult> {
    // ... existing composition logic ...

    // Add WebP output handling
    if (format === 'webp') {
      imageBuffer = await compositeImage.webp({ quality }).toBuffer();
    } else if (format === 'jpeg') {
      imageBuffer = await compositeImage.jpeg({ quality }).toBuffer();
    } else {
      imageBuffer = await compositeImage.png().toBuffer();
    }

    return { imageBuffer, width, height, format };
  }
}
```

#### WebP Implementation

**Sharp Library Integration**:
- Sharp natively supports WebP encoding via `sharp().webp(options)`
- Quality parameter: 1-100 (90 recommended for high quality)
- Compression: Lossy by default (suitable for photos/artwork)
- Alpha channel: Fully supported for transparency

**Format Selection Logic**:
- Final compositions: Always WebP (1500x1500, quality 90)
- Previews: Continue using PNG for compatibility
- Backward compatibility: Keep JPEG/PNG support for existing code

### MetadataService Updates

Update to work with Pinata URLs and WebP content type.

```typescript
export class MetadataService {
  private pinataService: PinataUploadService;  // Changed from IrysUploadService

  constructor(pinataService: PinataUploadService) {
    this.pinataService = pinataService;
  }

  /**
   * Uploads metadata to Pinata and returns the URI
   * UPDATED: Uses Pinata instead of Irys, WebP content type
   */
  async uploadMetadata(
    imageBuffer: Buffer,
    baseAsset: CoreAsset,
    appliedTraits: Trait[],
    traitSlots: TraitSlot[] = [],
    options: MetadataBuilderOptions = {}
  ): Promise<{ imageUri: string; metadataUri: string }> {
    // Build metadata
    const metadata = this.buildMetadata(baseAsset, appliedTraits, traitSlots, options);

    // Upload image to Pinata (WebP format)
    const imageResult = await this.pinataService.uploadImage(
      imageBuffer,
      'image/webp'  // Changed from 'image/jpeg'
    );
    
    // Update metadata with image URL
    const completeMetadata = {
      ...metadata,
      image: imageResult.url,  // IPFS gateway URL
      properties: {
        ...(metadata.properties || {}),
        files: [
          {
            uri: imageResult.url,
            type: 'image/webp'  // Changed from 'image/jpeg'
          },
          ...(metadata.properties?.files || [])
        ]
      }
    };
    
    // Upload metadata JSON to Pinata
    const metadataResult = await this.pinataService.uploadMetadata(completeMetadata);

    return {
      imageUri: imageResult.url,
      metadataUri: metadataResult.url
    };
  }

  /**
   * SSRF Protection: Add Pinata domains to allowlist
   */
  private validateMetadataUrl(url: string): boolean {
    const ALLOWED_METADATA_DOMAINS = [
      'gateway.irys.xyz',
      'arweave.net',
      'gateway.pinata.cloud',           // Add Pinata
      process.env.PINATA_GATEWAY,       // Add configured gateway
      'adznwylv2j3tfcl7.public.blob.vercel-storage.com'
    ].filter(Boolean);  // Remove undefined values

    try {
      const parsedUrl = new URL(url);
      
      if (parsedUrl.protocol !== 'https:') {
        return false;
      }

      return ALLOWED_METADATA_DOMAINS.some(domain => 
        parsedUrl.hostname === domain || parsedUrl.hostname.endsWith('.' + domain)
      );
    } catch {
      return false;
    }
  }
}
```

### API Endpoint Updates

#### /api/upload-image

```typescript
export async function POST(request: NextRequest) {
  try {
    const { imageBuffer, contentType, filename } = await request.json();
    const buffer = Buffer.from(imageBuffer, 'base64');

    // Use Pinata for all uploads (remove Vercel Blob fallback logic)
    const pinataService = new PinataUploadService();
    const uploadResult = await pinataService.uploadImage(
      buffer,
      contentType || 'image/webp'
    );

    return NextResponse.json({
      success: true,
      imageUrl: uploadResult.url,
      uploadId: uploadResult.cid,  // Return CID instead of Irys ID
      size: uploadResult.size,
      storage: 'pinata-ipfs'
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json(
      { 
        error: 'Failed to upload image',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
```

#### /api/compose-image

```typescript
export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());

    // ... existing trait resolution logic ...

    const composer = new ImageCompositionService();
    const options: any = {
      width: body.width || 1500,
      height: body.height || 1500,
      format: body.format || 'webp',  // Default to WebP
      quality: body.quality || 90,
      forceTransparentBase: body.forceTransparentBase ?? true,
      baseTraits,
    };

    const result = await composer.composeImage(
      body.baseImageUrl,
      overrideTraits,
      slots,
      options
    );

    return NextResponse.json({
      success: true,
      width: result.width,
      height: result.height,
      format: result.format,
      imageBase64: result.imageBuffer.toString('base64'),
    });
  } catch (e: any) {
    console.error('❌ compose-image failed:', e);
    return NextResponse.json(
      { success: false, error: e?.message || 'compose-image failed' },
      { status: 500 }
    );
  }
}
```

#### /api/update-nft-metadata

```typescript
export async function POST(request: NextRequest) {
  try {
    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { assetId, newImageUrl, newTraits, originalTraits, txSignature } = parsed.data;

    // ... existing setup and trait resolution ...

    const metadata: NFTMetadata = {
      name: `PGV2 #${assetId.slice(0, 6)}`,
      description: `Pepe Gods V2 - Arise from the Ashes...`,
      symbol: collectionSymbol,
      seller_fee_basis_points: sellerFeeBasisPoints,
      image: newImageUrl,
      external_url: process.env.NEXT_PUBLIC_APP_URL || '',
      attributes: completeAttributes,
      properties: {
        files: [{ uri: newImageUrl, type: 'image/webp' }],  // Changed to webp
        category: 'image',
        creators: [{ address: creatorAddress, share: 100 }],
      },
    };

    // Upload metadata JSON to Pinata (not Irys)
    const pinata = new PinataUploadService();
    const metadataResult = await pinata.uploadMetadata(metadata);

    // Update Core asset URI
    const core = new CoreAssetUpdateService(connection, updateKeypair);
    const updateResult = await core.updateAssetUri(assetId, metadataResult.url);

    return NextResponse.json({
      success: true,
      assetId,
      metadataUri: metadataResult.url,
      metadataCid: metadataResult.cid,  // Include CID in response
      updateSignature: updateResult.signature,
      totalAttributes: completeAttributes.length,
      updatedSlotIds: Array.from(updatedTraitsBySlotId.keys()),
    });
  } catch (error: any) {
    console.error('❌ Update metadata route failed:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed', details: String(error) },
      { status: 500 }
    );
  }
}
```

## Data Models

### PinataUploadResult

```typescript
export interface PinataUploadResult {
  cid: string;           // IPFS Content Identifier (e.g., "QmXyz...")
  url: string;           // Full gateway URL (e.g., "https://gateway.../ipfs/QmXyz...")
  size: number;          // File size in bytes
  contentType: string;   // MIME type (e.g., "image/webp", "application/json")
}
```

### NFTMetadata (Updated)

```typescript
export interface NFTMetadata {
  name: string;
  description: string;
  symbol?: string;
  seller_fee_basis_points?: number;
  image: string;  // IPFS gateway URL
  external_url?: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  properties?: {
    files?: Array<{
      uri: string;        // IPFS gateway URL
      type: string;       // "image/webp" instead of "image/jpeg"
    }>;
    category?: string;
    creators?: Array<{
      address: string;
      share: number;
    }>;
  };
}
```

### Environment Variables

```typescript
// Required for Pinata
PINATA_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
PINATA_GATEWAY=fun-llama-300.mypinata.cloud

// Existing (keep)
UPDATE_AUTHORITY_PRIVATE_KEY=[123,45,67,...]
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NFT_CREATOR_ADDRESS=6ByScvE5szYLNfVtrgPFEeRvyP5BYuBVUvBSLPxmkNxT
NFT_COLLECTION_SYMBOL=PGV2
NFT_SELLER_FEE_BASIS_POINTS=690
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: WebP Final Composition Format

*For any* trait selection and base image, when createFinalComposition is called, the returned format SHALL be 'webp' and the image buffer SHALL be valid WebP data.

**Validates: Requirements 1.1, 13.1**

### Property 2: Final Composition Dimensions

*For any* trait selection, when createFinalComposition is called, the returned width and height SHALL both equal 1500 pixels.

**Validates: Requirements 1.2**

### Property 3: Preview PNG Format Support

*For any* trait selection, when createPreview is called, the returned format SHALL be 'png' and the image buffer SHALL be valid PNG data.

**Validates: Requirements 1.4**

### Property 4: Pinata Upload Returns CID and URL

*For any* image buffer or metadata object uploaded to Pinata, the upload result SHALL contain both a non-empty CID string and a gateway URL string.

**Validates: Requirements 2.3, 2.4, 3.3, 4.3**

### Property 5: Upload Error Messages Include Reason

*For any* upload failure (authentication, network, rate limit), the thrown exception message SHALL contain a description of the failure reason.

**Validates: Requirements 2.5, 10.5**

### Property 6: Uploaded Content is Retrievable

*For any* content uploaded to Pinata, fetching the returned gateway URL SHALL successfully retrieve the original content.

**Validates: Requirements 3.1, 15.2**

### Property 7: Content Type Preservation

*For any* upload with a specified content type, the returned PinataUploadResult SHALL have a contentType field matching the input content type.

**Validates: Requirements 3.2, 4.2**

### Property 8: Gateway URL Format

*For any* successful Pinata upload, the returned gateway URL SHALL match the pattern `https://{gateway}/ipfs/{cid}` where gateway is the configured PINATA_GATEWAY and cid is the returned CID.

**Validates: Requirements 3.4, 4.4, 14.1**

### Property 9: Metadata JSON Round Trip

*For any* metadata object uploaded to Pinata, fetching and parsing the gateway URL SHALL return a JSON object equivalent to the original metadata.

**Validates: Requirements 4.1**

### Property 10: Metadata Contains Image Gateway URL

*For any* metadata built by MetadataService after image upload, the metadata.image field SHALL contain an IPFS gateway URL from the configured Pinata gateway.

**Validates: Requirements 4.5, 7.1**

### Property 11: API Responses Include CIDs

*For any* successful upload through /api/upload-image or /api/update-nft-metadata, the response SHALL include a CID field (uploadId or metadataCid).

**Validates: Requirements 6.4**

### Property 12: API Response Backward Compatibility

*For any* API endpoint response after migration, all fields present in the pre-migration response SHALL still be present (new fields may be added).

**Validates: Requirements 6.5**

### Property 13: Metadata Files Array Contains WebP

*For any* metadata built by MetadataService with a WebP image, the properties.files array SHALL contain an entry with type 'image/webp'.

**Validates: Requirements 7.4**

### Property 14: Metadata Preserves Required Fields

*For any* metadata built by MetadataService, the metadata SHALL contain all required fields: name, description, symbol, seller_fee_basis_points, image, attributes, and properties.creators.

**Validates: Requirements 7.5**

### Property 15: SSRF Protection Allows Pinata Domains

*For any* URL with hostname matching the configured PINATA_GATEWAY or 'gateway.pinata.cloud', the validateMetadataUrl method SHALL return true if the protocol is HTTPS.

**Validates: Requirements 8.1, 8.2, 8.3**

### Property 16: Gateway URL No Trailing Slash

*For any* gateway URL constructed by PinataUploadService, the URL SHALL not end with a trailing slash character.

**Validates: Requirements 14.2**

### Property 17: Consistent Gateway Domain

*For any* pair of image and metadata uploads in the same operation, both gateway URLs SHALL use the same gateway domain.

**Validates: Requirements 14.4**

### Property 18: WebP Image Validity

*For any* WebP image buffer generated by ImageCompositionService, parsing the buffer with Sharp SHALL succeed without errors.

**Validates: Requirements 15.3**

### Property 19: Metadata JSON Validity

*For any* metadata JSON uploaded to Pinata, parsing the fetched content as JSON SHALL succeed and contain all required NFT metadata fields.

**Validates: Requirements 15.4**

### Property 20: Backward Compatible Image Formats

*For any* format parameter ('png', 'jpeg', 'webp') passed to composeImage, the method SHALL successfully generate an image in the requested format.

**Validates: Requirements 13.4**

## Error Handling

### Pinata Upload Errors

**Authentication Errors (401)**:
- Thrown when: JWT token is invalid or expired
- Error message: "Invalid Pinata JWT credentials"
- Recovery: Update PINATA_JWT environment variable with valid token

**Network Errors**:
- Thrown when: Network connection fails or times out
- Error message: "Pinata upload failed: network error - {original error}"
- Recovery: Retry upload, check network connectivity

**Rate Limiting (429)**:
- Thrown when: Pinata API rate limit exceeded
- Error message: "Pinata rate limit exceeded"
- Recovery: Implement exponential backoff, upgrade Pinata plan

**Invalid Input**:
- Thrown when: Empty buffer, invalid content type, empty CID
- Error message: Descriptive message indicating the invalid input
- Recovery: Fix input validation in calling code

### Configuration Errors

**Missing JWT**:
- Thrown when: PINATA_JWT environment variable not set
- Error message: "PINATA_JWT environment variable is required"
- Recovery: Set environment variable before service initialization

**Missing Gateway**:
- Thrown when: PINATA_GATEWAY environment variable not set
- Error message: "PINATA_GATEWAY environment variable is required"
- Recovery: Set environment variable before service initialization

### Image Composition Errors

**Invalid Format**:
- Thrown when: Unsupported format parameter provided
- Error message: "Unsupported image format: {format}"
- Recovery: Use 'png', 'jpeg', or 'webp'

**Trait Loading Failure**:
- Thrown when: Trait image URL cannot be fetched
- Error message: "Failed to load trait {name}: {error}"
- Recovery: Verify trait image URLs are accessible

### Metadata Service Errors

**SSRF Protection Violation**:
- Thrown when: Attempting to fetch metadata from non-allowlisted domain
- Error message: "SSRF Protection: Domain not allowlisted: {domain}"
- Recovery: Add domain to allowlist or use allowed domain

**Invalid Metadata Structure**:
- Thrown when: Required metadata fields are missing
- Error message: "Invalid metadata: {validation errors}"
- Recovery: Ensure all required fields are provided

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests**: Verify specific examples, edge cases, and error conditions
- Specific trait combinations
- Error scenarios (missing JWT, invalid CID)
- API endpoint integration
- SSRF protection edge cases

**Property Tests**: Verify universal properties across all inputs
- Upload operations with random buffers
- Metadata generation with random trait sets
- URL construction with random CIDs
- Format conversion with random images

### Property-Based Testing Configuration

**Library**: Use `fast-check` for TypeScript property-based testing

**Configuration**:
- Minimum 100 iterations per property test
- Each test must reference its design document property
- Tag format: `Feature: pinata-migration-webp, Property {number}: {property_text}`

**Example Property Test**:
```typescript
import fc from 'fast-check';

// Feature: pinata-migration-webp, Property 4: Pinata Upload Returns CID and URL
test('Pinata uploads return both CID and gateway URL', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.uint8Array({ minLength: 100, maxLength: 10000 }), // Random image buffer
      fc.constantFrom('image/webp', 'image/png', 'image/jpeg'), // Random content type
      async (bufferArray, contentType) => {
        const buffer = Buffer.from(bufferArray);
        const pinata = new PinataUploadService();
        
        const result = await pinata.uploadImage(buffer, contentType);
        
        // Property: Result must have both CID and URL
        expect(result.cid).toBeTruthy();
        expect(result.cid.length).toBeGreaterThan(0);
        expect(result.url).toBeTruthy();
        expect(result.url).toMatch(/^https:\/\/.+\/ipfs\/.+$/);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Test Examples

**WebP Format Test**:
```typescript
test('createFinalComposition generates WebP format', async () => {
  const service = new ImageCompositionService();
  const result = await service.createFinalComposition(
    baseImageUrl,
    selectedTraits,
    slots
  );
  
  expect(result.format).toBe('webp');
  expect(result.width).toBe(1500);
  expect(result.height).toBe(1500);
});
```

**Configuration Error Test**:
```typescript
test('PinataUploadService throws when JWT is missing', () => {
  delete process.env.PINATA_JWT;
  
  expect(() => new PinataUploadService()).toThrow(
    'PINATA_JWT environment variable is required'
  );
});
```

**SSRF Protection Test**:
```typescript
test('validateMetadataUrl allows Pinata gateway', () => {
  const service = new MetadataService(pinataService);
  const url = `https://${process.env.PINATA_GATEWAY}/ipfs/QmXyz`;
  
  expect(service['validateMetadataUrl'](url)).toBe(true);
});

test('validateMetadataUrl blocks non-allowlisted domain', () => {
  const service = new MetadataService(pinataService);
  const url = 'https://evil.com/ipfs/QmXyz';
  
  expect(service['validateMetadataUrl'](url)).toBe(false);
});
```

### Integration Testing

**Full Upload Flow**:
1. Generate WebP image via ImageCompositionService
2. Upload image to Pinata
3. Build metadata with image URL
4. Upload metadata to Pinata
5. Update Metaplex Core asset with metadata URL
6. Verify NFT metadata is accessible via IPFS gateway

**Test Environment**:
- Use Pinata test/development account
- Set up test environment variables
- Use Solana devnet for Core asset updates
- Clean up test uploads after tests complete

### Manual Testing Checklist

- [ ] Verify WebP images display correctly in browsers
- [ ] Verify WebP images display in Solana wallets (Phantom, Solflare)
- [ ] Verify metadata is accessible via multiple IPFS gateways
- [ ] Verify on-chain metadata URI updates succeed
- [ ] Verify file sizes are reduced compared to JPEG
- [ ] Test with various trait combinations
- [ ] Test error scenarios (invalid JWT, network failures)
- [ ] Verify logging output is informative
- [ ] Test performance (upload times, image generation times)
- [ ] Verify no Irys dependencies remain in production build
