# Requirements Document: Pinata Migration with WebP Support

## Introduction

This specification defines the requirements for migrating the NFT trait marketplace's image and metadata upload system from Irys to Pinata (IPFS), while simultaneously upgrading the image format from JPEG to WebP. The migration will maintain all existing functionality while improving storage efficiency through WebP compression and leveraging Pinata's IPFS infrastructure for decentralized content delivery.

## Glossary

- **System**: The NFT trait marketplace backend services
- **Pinata**: IPFS pinning service provider (pinata.cloud)
- **IPFS**: InterPlanetary File System - decentralized storage protocol
- **CID**: Content Identifier - unique hash identifying content on IPFS
- **WebP**: Modern image format providing superior compression
- **Gateway**: HTTP endpoint for retrieving IPFS content
- **Irys**: Current permanent storage provider (being replaced)
- **Metaplex_Core**: Solana NFT standard for asset management
- **Image_Composition_Service**: Service that layers trait images
- **Pinata_Upload_Service**: New service for uploading to Pinata
- **Metadata_Service**: Service that builds NFT metadata JSON
- **Core_Asset_Update_Service**: Service that updates Metaplex Core assets
- **SSRF**: Server-Side Request Forgery attack vector

## Requirements

### Requirement 1: WebP Image Generation

**User Story:** As a system operator, I want NFT images generated in WebP format, so that I can reduce file sizes while maintaining visual quality.

#### Acceptance Criteria

1. WHEN the Image_Composition_Service creates a final composition, THE System SHALL generate the image in WebP format
2. WHEN generating WebP images, THE System SHALL use 1500x1500 pixel dimensions
3. WHEN generating WebP images, THE System SHALL apply quality setting of 90
4. WHEN the Image_Composition_Service creates preview images, THE System SHALL continue supporting PNG format for previews
5. THE System SHALL use the Sharp library's native WebP encoding capabilities

### Requirement 2: Pinata Service Integration

**User Story:** As a developer, I want a dedicated Pinata upload service, so that I can upload images and metadata to IPFS through Pinata's infrastructure.

#### Acceptance Criteria

1. THE System SHALL create a Pinata_Upload_Service class with methods for uploading images and metadata
2. WHEN the Pinata_Upload_Service is initialized, THE System SHALL authenticate using JWT from environment variables
3. WHEN uploading an image, THE Pinata_Upload_Service SHALL return both the IPFS CID and the full gateway URL
4. WHEN uploading metadata JSON, THE Pinata_Upload_Service SHALL return both the IPFS CID and the full gateway URL
5. WHEN any upload fails, THE Pinata_Upload_Service SHALL throw descriptive errors including the failure reason

### Requirement 3: Image Upload to Pinata

**User Story:** As a system operator, I want images uploaded to Pinata's IPFS network, so that NFT images are stored on decentralized infrastructure.

#### Acceptance Criteria

1. WHEN uploading an image buffer, THE Pinata_Upload_Service SHALL send the buffer to Pinata's file upload API
2. WHEN uploading WebP images, THE Pinata_Upload_Service SHALL set content-type to "image/webp"
3. WHEN an image upload succeeds, THE System SHALL receive an IPFS CID from Pinata
4. WHEN an image upload succeeds, THE System SHALL construct the gateway URL using the configured gateway domain
5. THE Pinata_Upload_Service SHALL include authentication headers in all upload requests

### Requirement 4: Metadata Upload to Pinata

**User Story:** As a system operator, I want NFT metadata JSON uploaded to Pinata, so that metadata is stored alongside images on IPFS.

#### Acceptance Criteria

1. WHEN uploading metadata, THE Pinata_Upload_Service SHALL serialize the metadata object to JSON
2. WHEN uploading metadata JSON, THE Pinata_Upload_Service SHALL set content-type to "application/json"
3. WHEN metadata upload succeeds, THE System SHALL receive an IPFS CID from Pinata
4. WHEN metadata upload succeeds, THE System SHALL construct the gateway URL using the configured gateway domain
5. THE metadata JSON SHALL include the image IPFS gateway URL in the "image" field

### Requirement 5: Environment Configuration

**User Story:** As a deployment engineer, I want Pinata credentials configured via environment variables, so that I can securely manage API access across environments.

#### Acceptance Criteria

1. THE System SHALL read Pinata JWT token from PINATA_JWT environment variable
2. THE System SHALL read Pinata gateway domain from PINATA_GATEWAY environment variable
3. WHEN PINATA_JWT is missing, THE System SHALL throw a configuration error on service initialization
4. WHEN PINATA_GATEWAY is missing, THE System SHALL throw a configuration error on service initialization
5. THE System SHALL continue reading UPDATE_AUTHORITY_PRIVATE_KEY and SOLANA_RPC_URL for Metaplex operations

### Requirement 6: API Endpoint Updates

**User Story:** As a frontend developer, I want existing API endpoints to work with Pinata, so that the migration is transparent to API consumers.

#### Acceptance Criteria

1. WHEN the /api/upload-image endpoint receives an image, THE System SHALL use Pinata_Upload_Service instead of Irys or Vercel Blob
2. WHEN the /api/compose-image endpoint generates a final composition, THE System SHALL produce WebP format
3. WHEN the /api/update-nft-metadata endpoint processes a request, THE System SHALL upload metadata to Pinata
4. WHEN any API endpoint returns upload results, THE System SHALL include IPFS CIDs in the response
5. THE System SHALL maintain backward-compatible response formats for all endpoints

### Requirement 7: Metadata Service Integration

**User Story:** As a system operator, I want the Metadata_Service to work with Pinata URLs, so that NFT metadata references IPFS content correctly.

#### Acceptance Criteria

1. WHEN building metadata JSON, THE Metadata_Service SHALL use Pinata gateway URLs for image references
2. WHEN uploading metadata, THE Metadata_Service SHALL call Pinata_Upload_Service instead of Irys
3. WHEN updating metadata, THE Metadata_Service SHALL fetch existing metadata from IPFS gateways
4. THE Metadata_Service SHALL include WebP content type in the properties.files array
5. THE Metadata_Service SHALL preserve all existing metadata fields including symbol, seller_fee_basis_points, and creators

### Requirement 8: SSRF Protection Updates

**User Story:** As a security engineer, I want Pinata gateway domains allowlisted for SSRF protection, so that the system can safely fetch metadata from IPFS.

#### Acceptance Criteria

1. WHEN validating metadata URLs, THE System SHALL include Pinata gateway domains in the allowlist
2. THE System SHALL allow HTTPS URLs from the configured PINATA_GATEWAY domain
3. THE System SHALL allow HTTPS URLs from gateway.pinata.cloud
4. THE System SHALL continue blocking non-HTTPS URLs
5. THE System SHALL continue blocking URLs from non-allowlisted domains

### Requirement 9: Core Asset Updates

**User Story:** As a system operator, I want Metaplex Core assets updated with IPFS metadata URIs, so that NFTs reference the new Pinata-hosted metadata.

#### Acceptance Criteria

1. WHEN updating a Core asset, THE Core_Asset_Update_Service SHALL accept IPFS gateway URLs as metadata URIs
2. THE Core_Asset_Update_Service SHALL not require changes to its updateAssetUri method
3. WHEN a metadata URI starts with the Pinata gateway domain, THE System SHALL treat it as valid
4. THE System SHALL continue supporting all existing Metaplex Core update functionality
5. THE System SHALL log the IPFS CID and gateway URL for each metadata update

### Requirement 10: Error Handling and Fallbacks

**User Story:** As a system operator, I want robust error handling for Pinata uploads, so that failures are logged and reported clearly.

#### Acceptance Criteria

1. WHEN a Pinata upload fails with authentication error, THE System SHALL log the error and throw an exception indicating invalid credentials
2. WHEN a Pinata upload fails with network error, THE System SHALL log the error and throw an exception indicating network failure
3. WHEN a Pinata upload fails with rate limiting, THE System SHALL log the error and throw an exception indicating rate limit exceeded
4. THE System SHALL not implement automatic fallback to Irys or Vercel Blob
5. WHEN any upload error occurs, THE System SHALL include the original error message in the thrown exception

### Requirement 11: Dependency Management

**User Story:** As a developer, I want Pinata SDK installed and Irys dependencies removed, so that the codebase reflects the new architecture.

#### Acceptance Criteria

1. THE System SHALL include the "pinata" npm package in package.json dependencies
2. THE System SHALL remove "@irys/sdk" from package.json dependencies after migration is complete
3. THE System SHALL continue including "sharp" for image processing
4. THE System SHALL continue including "@metaplex-foundation/mpl-core" for NFT updates
5. THE System SHALL continue including "@solana/web3.js" for Solana operations

### Requirement 12: Logging and Observability

**User Story:** As a system operator, I want detailed logging for Pinata operations, so that I can monitor upload performance and troubleshoot issues.

#### Acceptance Criteria

1. WHEN uploading an image, THE System SHALL log the buffer size, content type, and upload duration
2. WHEN an upload succeeds, THE System SHALL log the IPFS CID and gateway URL
3. WHEN an upload fails, THE System SHALL log the error type, message, and request details
4. THE System SHALL log Pinata service initialization including gateway configuration
5. THE System SHALL maintain existing log format and verbosity levels

### Requirement 13: Image Composition Service Updates

**User Story:** As a developer, I want the Image_Composition_Service to support WebP output, so that final compositions use the new format.

#### Acceptance Criteria

1. WHEN createFinalComposition is called, THE Image_Composition_Service SHALL generate WebP format instead of JPEG
2. THE Image_Composition_Service SHALL add a "webp" option to the format parameter type
3. WHEN format is "webp", THE System SHALL use Sharp's .webp() method with the specified quality
4. THE Image_Composition_Service SHALL maintain backward compatibility for PNG and JPEG formats
5. THE System SHALL update the CompositionResult type to include "webp" as a valid format value

### Requirement 14: Gateway URL Construction

**User Story:** As a developer, I want consistent IPFS gateway URL construction, so that all content is accessible through the configured gateway.

#### Acceptance Criteria

1. WHEN constructing a gateway URL, THE System SHALL use the format "https://{PINATA_GATEWAY}/ipfs/{CID}"
2. THE System SHALL not include trailing slashes in gateway URLs
3. WHEN a CID is provided, THE System SHALL validate it is non-empty before constructing the URL
4. THE System SHALL use the same gateway domain for both image and metadata URLs
5. THE System SHALL log the constructed gateway URL for each upload

### Requirement 15: Testing and Validation

**User Story:** As a quality assurance engineer, I want the ability to test Pinata uploads, so that I can verify the migration works correctly.

#### Acceptance Criteria

1. THE System SHALL provide a method to test Pinata connectivity and authentication
2. WHEN testing uploads, THE System SHALL verify that uploaded content is retrievable via the gateway
3. THE System SHALL validate that WebP images are properly formatted and displayable
4. THE System SHALL verify that metadata JSON is valid and contains all required fields
5. THE System SHALL confirm that Metaplex Core updates succeed with IPFS metadata URIs
