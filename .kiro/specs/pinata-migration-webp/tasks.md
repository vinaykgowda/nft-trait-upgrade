# Implementation Plan: Pinata Migration with WebP Support

## Overview

This implementation plan migrates the NFT trait marketplace from Irys to Pinata for IPFS storage while upgrading image format from JPEG to WebP. The migration involves creating a new PinataUploadService, updating ImageCompositionService for WebP support, modifying API endpoints, and updating all dependent services. The implementation follows an incremental approach to ensure each component is tested before integration.

## Tasks

- [x] 1. Set up Pinata integration and dependencies
  - Install `pinata` npm package
  - Add PINATA_JWT and PINATA_GATEWAY to environment variable files (.env.local.example, .env.production.example)
  - Create types for Pinata upload results
  - _Requirements: 2.1, 5.1, 5.2, 11.1_

- [ ]* 1.1 Write property test for environment configuration
  - **Property 11: API Responses Include CIDs**
  - **Validates: Requirements 6.4**

- [ ] 2. Implement PinataUploadService class
  - [x] 2.1 Create src/lib/services/pinata-upload.ts with PinataUploadService class
    - Implement constructor with JWT and gateway validation
    - Throw errors when PINATA_JWT or PINATA_GATEWAY are missing
    - _Requirements: 2.1, 2.2, 5.3, 5.4_

  - [ ]* 2.2 Write property test for service initialization
    - **Property 4: Pinata Upload Returns CID and URL**
    - **Validates: Requirements 2.3, 2.4, 3.3, 4.3**

  - [x] 2.3 Implement uploadImage method
    - Accept Buffer, contentType, and optional metadata parameters
    - Use Pinata SDK to upload file
    - Return PinataUploadResult with cid, url, size, contentType
    - Include authentication headers
    - _Requirements: 2.3, 3.1, 3.2, 3.5_

  - [ ]* 2.4 Write property test for image uploads
    - **Property 4: Pinata Upload Returns CID and URL**
    - **Property 6: Uploaded Content is Retrievable**
    - **Property 7: Content Type Preservation**
    - **Validates: Requirements 2.3, 3.1, 3.2**

  - [x] 2.5 Implement uploadMetadata method
    - Accept NFTMetadata object
    - Serialize to JSON
    - Upload to Pinata with content-type "application/json"
    - Return PinataUploadResult with cid and url
    - _Requirements: 2.4, 4.1, 4.2_

  - [ ]* 2.6 Write property test for metadata uploads
    - **Property 4: Pinata Upload Returns CID and URL**
    - **Property 9: Metadata JSON Round Trip**
    - **Validates: Requirements 2.4, 4.1, 4.2**

  - [x] 2.7 Implement constructGatewayUrl private method
    - Validate CID is non-empty
    - Construct URL as https://{gateway}/ipfs/{cid}
    - Ensure no trailing slashes
    - _Requirements: 3.4, 4.4, 14.1, 14.2, 14.3_

  - [ ]* 2.8 Write property test for gateway URL construction
    - **Property 8: Gateway URL Format**
    - **Property 16: Gateway URL No Trailing Slash**
    - **Validates: Requirements 3.4, 14.1, 14.2**

  - [x] 2.9 Implement error handling for all upload methods
    - Catch authentication errors (401) and throw "Invalid Pinata JWT credentials"
    - Catch network errors and throw "Pinata upload failed: network error"
    - Catch rate limiting (429) and throw "Pinata rate limit exceeded"
    - Include original error message in all exceptions
    - _Requirements: 2.5, 10.1, 10.2, 10.3, 10.5_

  - [ ]* 2.10 Write unit tests for error scenarios
    - Test authentication failure
    - Test network failure
    - Test rate limiting
    - Test empty CID validation
    - _Requirements: 10.1, 10.2, 10.3, 14.3_

- [x] 3. Checkpoint - Verify PinataUploadService works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Update ImageCompositionService for WebP support
  - [x] 4.1 Add 'webp' to format type in CompositionOptions and CompositionResult
    - Update TypeScript types
    - _Requirements: 13.2, 13.5_

  - [x] 4.2 Update composeImage method to handle WebP format
    - Add conditional for format === 'webp'
    - Use sharp().webp({ quality }) for WebP output
    - Maintain existing PNG and JPEG support
    - _Requirements: 1.1, 13.3, 13.4_

  - [ ]* 4.3 Write property test for WebP generation
    - **Property 1: WebP Final Composition Format**
    - **Property 18: WebP Image Validity**
    - **Validates: Requirements 1.1, 15.3**

  - [x] 4.4 Update createFinalComposition method
    - Change format from 'jpeg' to 'webp'
    - Keep dimensions at 1500x1500
    - Keep quality at 90
    - _Requirements: 1.1, 1.2, 13.1_

  - [ ]* 4.5 Write property test for final composition
    - **Property 1: WebP Final Composition Format**
    - **Property 2: Final Composition Dimensions**
    - **Validates: Requirements 1.1, 1.2**

  - [x] 4.6 Verify createPreview still uses PNG format
    - Ensure preview method continues to use format: 'png'
    - _Requirements: 1.4_

  - [ ]* 4.7 Write property test for preview format
    - **Property 3: Preview PNG Format Support**
    - **Validates: Requirements 1.4**

  - [ ]* 4.8 Write property test for backward compatibility
    - **Property 20: Backward Compatible Image Formats**
    - **Validates: Requirements 13.4**

- [x] 5. Checkpoint - Verify WebP image generation works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Update MetadataService to use Pinata
  - [x] 6.1 Replace IrysUploadService with PinataUploadService in constructor
    - Update constructor parameter type
    - Update all method calls to use pinataService
    - _Requirements: 7.2_

  - [x] 6.2 Update uploadMetadata method
    - Change image content type from 'image/jpeg' to 'image/webp'
    - Update properties.files array to use 'image/webp'
    - Use pinataService.uploadImage and pinataService.uploadMetadata
    - _Requirements: 7.1, 7.4_

  - [ ]* 6.3 Write property test for metadata image URLs
    - **Property 10: Metadata Contains Image Gateway URL**
    - **Property 13: Metadata Files Array Contains WebP**
    - **Validates: Requirements 4.5, 7.1, 7.4**

  - [x] 6.4 Update updateMetadata method
    - Change image content type to 'image/webp'
    - Update properties.files array to use 'image/webp'
    - Ensure IPFS gateway URLs are used
    - _Requirements: 7.3_

  - [ ]* 6.5 Write property test for metadata preservation
    - **Property 14: Metadata Preserves Required Fields**
    - **Validates: Requirements 7.5**

  - [x] 6.6 Update SSRF protection allowlist
    - Add 'gateway.pinata.cloud' to ALLOWED_METADATA_DOMAINS
    - Add process.env.PINATA_GATEWAY to ALLOWED_METADATA_DOMAINS
    - Filter out undefined values
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 6.7 Write property test for SSRF protection
    - **Property 15: SSRF Protection Allows Pinata Domains**
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [ ]* 6.8 Write unit tests for SSRF edge cases
    - Test HTTP URLs are blocked
    - Test non-allowlisted domains are blocked
    - Test Pinata domains are allowed
    - _Requirements: 8.4, 8.5_

- [ ] 7. Update API endpoints to use Pinata
  - [x] 7.1 Update /api/upload-image route
    - Remove Vercel Blob fallback logic
    - Create PinataUploadService instance
    - Use pinataService.uploadImage for all uploads
    - Return CID as uploadId in response
    - Return 'pinata-ipfs' as storage type
    - _Requirements: 6.1_

  - [ ]* 7.2 Write unit test for upload-image endpoint
    - Test successful upload returns CID
    - Test response includes 'pinata-ipfs' storage type
    - _Requirements: 6.1, 6.4_

  - [x] 7.3 Update /api/compose-image route
    - Set default format to 'webp' if not specified
    - Ensure format parameter supports 'webp'
    - _Requirements: 6.2_

  - [ ]* 7.4 Write unit test for compose-image endpoint
    - Test default format is 'webp'
    - Test response format matches request
    - _Requirements: 6.2_

  - [x] 7.5 Update /api/update-nft-metadata route
    - Create PinataUploadService instance
    - Change properties.files type to 'image/webp'
    - Use pinataService.uploadMetadata instead of IrysUploadService
    - Include metadataCid in response
    - _Requirements: 6.3, 6.4_

  - [ ]* 7.6 Write unit test for update-nft-metadata endpoint
    - Test metadata URI is IPFS gateway URL
    - Test response includes metadataCid
    - _Requirements: 6.3, 6.4_

  - [ ]* 7.7 Write property test for API response compatibility
    - **Property 12: API Response Backward Compatibility**
    - **Validates: Requirements 6.5**

- [ ] 8. Verify CoreAssetUpdateService compatibility
  - [x] 8.1 Test updateAssetUri with IPFS gateway URLs
    - Verify method accepts Pinata gateway URLs
    - Verify on-chain update succeeds
    - _Requirements: 9.1, 9.3_

  - [ ]* 8.2 Write integration test for Core asset updates
    - Test full flow: compose → upload → update Core asset
    - Verify metadata is accessible via IPFS
    - _Requirements: 9.1, 15.5_

- [ ] 9. Add consistency checks
  - [ ]* 9.1 Write property test for gateway domain consistency
    - **Property 17: Consistent Gateway Domain**
    - **Validates: Requirements 14.4**

  - [ ]* 9.2 Write property test for metadata JSON validity
    - **Property 19: Metadata JSON Validity**
    - **Validates: Requirements 15.4**

- [ ] 10. Integration testing and cleanup
  - [x] 10.1 Run full integration test suite
    - Test complete trait purchase flow
    - Test image composition → upload → metadata update → Core update
    - Verify NFT displays correctly with WebP images
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [x] 10.2 Update environment variable documentation
    - Document PINATA_JWT in README.md
    - Document PINATA_GATEWAY in README.md
    - Update deployment guides
    - _Requirements: 5.1, 5.2_

  - [x] 10.3 Remove Irys dependencies (after confirming migration works)
    - Remove @irys/sdk from package.json
    - Remove IrysUploadService file (or mark as deprecated)
    - Remove IRYS_PRIVATE_KEY from environment examples
    - _Requirements: 11.2_

  - [x] 10.4 Update logging throughout services
    - Log buffer size, content type, upload duration in PinataUploadService
    - Log IPFS CID and gateway URL on successful uploads
    - Log error type, message, and request details on failures
    - Log Pinata service initialization with gateway config
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based and unit tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties across random inputs
- Unit tests validate specific examples and edge cases
- Integration tests verify end-to-end functionality
- The migration maintains backward compatibility while adding new Pinata functionality
- Irys dependencies are removed only after confirming Pinata migration works correctly
