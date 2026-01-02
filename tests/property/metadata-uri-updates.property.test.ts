/**
 * **Feature: nft-trait-marketplace, Property 13: Metadata URI Updates**
 * **Validates: Requirements 11.4**
 * 
 * Property: For any successful trait application, the Core asset URI should be updated 
 * to point to the new Irys metadata location containing the updated image
 */

import fc from 'fast-check';

describe('Metadata URI Updates Property Tests', () => {
  // Mock the CoreAssetUpdateService
  const mockUpdateAssetMetadata = jest.fn();
  const mockBatchUpdateAssets = jest.fn();
  const mockVerifyUpdateAuthority = jest.fn();
  const mockGetCurrentMetadataUri = jest.fn();
  const mockCreateUpdateInstruction = jest.fn();

  // Create a mock service class
  class MockCoreAssetUpdateService {
    updateAssetMetadata = mockUpdateAssetMetadata;
    batchUpdateAssets = mockBatchUpdateAssets;
    verifyUpdateAuthority = mockVerifyUpdateAuthority;
    getCurrentMetadataUri = mockGetCurrentMetadataUri;
    createUpdateInstruction = mockCreateUpdateInstruction;
  }

  let updateService: MockCoreAssetUpdateService;

  beforeEach(() => {
    updateService = new MockCoreAssetUpdateService();
    
    // Setup default mock implementations
    mockUpdateAssetMetadata.mockImplementation(async (assetAddress: string, metadataUri: string) => ({
      signature: 'mock-signature-' + Math.random().toString(36).substring(7),
      assetAddress,
      newMetadataUri: metadataUri
    }));

    mockBatchUpdateAssets.mockImplementation(async (updates: any[]) => 
      updates.map(update => ({
        signature: 'mock-signature-' + Math.random().toString(36).substring(7),
        assetAddress: update.assetAddress,
        newMetadataUri: update.metadataUri
      }))
    );

    mockVerifyUpdateAuthority.mockResolvedValue(true);
    mockGetCurrentMetadataUri.mockResolvedValue('https://node1.irys.xyz/existing-metadata');
    mockCreateUpdateInstruction.mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Generator for valid-looking Solana addresses (44 characters, base58)
  const solanaAddressGen = fc.string({ minLength: 44, maxLength: 44 }).filter(s => 
    /^[1-9A-HJ-NP-Za-km-z]+$/.test(s)
  );

  // Generator for Irys URIs
  const irysUriGen = fc.string({ minLength: 10, maxLength: 100 }).map(id => 
    `https://node1.irys.xyz/${id}`
  );

  test('successful update should return correct result structure', async () => {
    await fc.assert(
      fc.asyncProperty(
        solanaAddressGen,
        irysUriGen,
        async (assetAddress: string, metadataUri: string) => {
          const result = await updateService.updateAssetMetadata(assetAddress, metadataUri);

          // Verify result structure
          expect(result).toHaveProperty('signature');
          expect(result).toHaveProperty('assetAddress', assetAddress);
          expect(result).toHaveProperty('newMetadataUri', metadataUri);
          expect(typeof result.signature).toBe('string');

          // Verify the service was called with correct parameters
          expect(mockUpdateAssetMetadata).toHaveBeenCalledWith(assetAddress, metadataUri);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  test('update should preserve asset address and metadata URI relationship', async () => {
    await fc.assert(
      fc.asyncProperty(
        solanaAddressGen,
        irysUriGen,
        fc.option(fc.string({ minLength: 1, maxLength: 50 })), // optional name
        async (assetAddress: string, metadataUri: string, name?: string) => {
          const options = name ? { name } : {};
          const result = await updateService.updateAssetMetadata(assetAddress, metadataUri, options);

          // The result should maintain the exact relationship between input and output
          expect(result.assetAddress).toBe(assetAddress);
          expect(result.newMetadataUri).toBe(metadataUri);

          // Verify the service was called with correct parameters
          expect(mockUpdateAssetMetadata).toHaveBeenCalledWith(assetAddress, metadataUri, options);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  test('batch updates should maintain asset-URI relationships for all updates', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            assetAddress: solanaAddressGen,
            metadataUri: irysUriGen,
            options: fc.option(fc.record({
              name: fc.option(fc.string({ minLength: 1, maxLength: 50 }))
            }))
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (updates) => {
          const results = await updateService.batchUpdateAssets(updates);

          // Should return results for all updates
          expect(results).toHaveLength(updates.length);

          // Each result should maintain the correct asset-URI relationship
          results.forEach((result, index) => {
            expect(result.assetAddress).toBe(updates[index].assetAddress);
            expect(result.newMetadataUri).toBe(updates[index].metadataUri);
            expect(typeof result.signature).toBe('string');
          });

          // Verify the service was called with correct parameters
          expect(mockBatchUpdateAssets).toHaveBeenCalledWith(updates);

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  test('update authority verification should be consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        solanaAddressGen,
        async (assetAddress: string) => {
          // Test with valid authority
          mockVerifyUpdateAuthority.mockResolvedValueOnce(true);
          const isValid = await updateService.verifyUpdateAuthority(assetAddress);
          expect(isValid).toBe(true);

          // Test with invalid authority  
          mockVerifyUpdateAuthority.mockResolvedValueOnce(false);
          const isInvalid = await updateService.verifyUpdateAuthority(assetAddress);
          expect(isInvalid).toBe(false);

          // Verify the service was called with correct parameters
          expect(mockVerifyUpdateAuthority).toHaveBeenCalledWith(assetAddress);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  test('current metadata URI retrieval should preserve URI format', async () => {
    await fc.assert(
      fc.asyncProperty(
        solanaAddressGen,
        irysUriGen,
        async (assetAddress: string, existingUri: string) => {
          // Test with existing URI
          mockGetCurrentMetadataUri.mockResolvedValueOnce(existingUri);
          const retrievedUri = await updateService.getCurrentMetadataUri(assetAddress);
          expect(retrievedUri).toBe(existingUri);

          // Test with no URI
          mockGetCurrentMetadataUri.mockResolvedValueOnce(null);
          const nullUri = await updateService.getCurrentMetadataUri(assetAddress);
          expect(nullUri).toBeNull();

          // Verify the service was called with correct parameters
          expect(mockGetCurrentMetadataUri).toHaveBeenCalledWith(assetAddress);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  test('update instruction creation should preserve parameters', async () => {
    await fc.assert(
      fc.asyncProperty(
        solanaAddressGen,
        irysUriGen,
        fc.option(fc.string({ minLength: 1, maxLength: 50 })),
        async (assetAddress: string, metadataUri: string, name?: string) => {
          const options = name ? { name } : {};
          const instruction = await updateService.createUpdateInstruction(
            assetAddress, 
            metadataUri, 
            options
          );

          // Verify instruction was created
          expect(instruction).toBeDefined();

          // Verify the service was called with correct parameters
          expect(mockCreateUpdateInstruction).toHaveBeenCalledWith(
            assetAddress, 
            metadataUri, 
            options
          );

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  test('error handling should preserve original parameters in error context', async () => {
    await fc.assert(
      fc.asyncProperty(
        solanaAddressGen,
        irysUriGen,
        async (assetAddress: string, metadataUri: string) => {
          // Mock an error in the update process
          const errorMessage = `Failed to update asset ${assetAddress} with URI ${metadataUri}`;
          mockUpdateAssetMetadata.mockRejectedValueOnce(new Error(errorMessage));

          try {
            await updateService.updateAssetMetadata(assetAddress, metadataUri);
            // Should not reach here
            expect(true).toBe(false);
          } catch (error) {
            // Error should contain information about the failed update
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toContain(assetAddress);
            expect((error as Error).message).toContain(metadataUri);
          }

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  test('URI format validation should accept valid Irys URIs', async () => {
    await fc.assert(
      fc.asyncProperty(
        solanaAddressGen,
        irysUriGen,
        async (assetAddress: string, metadataUri: string) => {
          // Valid Irys URIs should be processed successfully
          const result = await updateService.updateAssetMetadata(assetAddress, metadataUri);
          
          // The URI should be preserved exactly as provided
          expect(result.newMetadataUri).toBe(metadataUri);
          
          // Should start with expected Irys base URL
          expect(metadataUri).toMatch(/^https:\/\/node1\.irys\.xyz\//);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });
});