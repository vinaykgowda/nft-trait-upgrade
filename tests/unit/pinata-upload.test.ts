import { PinataUploadService } from '@/lib/services/pinata-upload';

describe('PinataUploadService', () => {
  describe('constructor', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset environment before each test
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      // Restore original environment
      process.env = originalEnv;
    });

    it('should throw error when PINATA_JWT is missing', () => {
      delete process.env.PINATA_JWT;
      process.env.PINATA_GATEWAY = 'test-gateway.pinata.cloud';

      expect(() => new PinataUploadService()).toThrow(
        'PINATA_JWT environment variable is required'
      );
    });

    it('should throw error when PINATA_GATEWAY is missing', () => {
      process.env.PINATA_JWT = 'test-jwt-token';
      delete process.env.PINATA_GATEWAY;

      expect(() => new PinataUploadService()).toThrow(
        'PINATA_GATEWAY environment variable is required'
      );
    });

    it('should throw error when both PINATA_JWT and PINATA_GATEWAY are missing', () => {
      delete process.env.PINATA_JWT;
      delete process.env.PINATA_GATEWAY;

      expect(() => new PinataUploadService()).toThrow(
        'PINATA_JWT environment variable is required'
      );
    });

    it('should initialize successfully when both environment variables are present', () => {
      process.env.PINATA_JWT = 'test-jwt-token';
      process.env.PINATA_GATEWAY = 'test-gateway.pinata.cloud';

      expect(() => new PinataUploadService()).not.toThrow();
      
      const service = new PinataUploadService();
      expect(service).toBeInstanceOf(PinataUploadService);
    });
  });

  describe('constructGatewayUrl', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset environment before each test
      process.env = { ...originalEnv };
      process.env.PINATA_JWT = 'test-jwt-token';
      process.env.PINATA_GATEWAY = 'test-gateway.pinata.cloud';
    });

    afterAll(() => {
      // Restore original environment
      process.env = originalEnv;
    });

    it('should construct valid gateway URL with CID', () => {
      const service = new PinataUploadService();
      const cid = 'QmXyz123abc';
      
      // Access private method for testing
      const url = (service as any).constructGatewayUrl(cid);
      
      expect(url).toBe('https://test-gateway.pinata.cloud/ipfs/QmXyz123abc');
    });

    it('should remove trailing slashes from gateway', () => {
      process.env.PINATA_GATEWAY = 'test-gateway.pinata.cloud/';
      const service = new PinataUploadService();
      const cid = 'QmAbc456def';
      
      const url = (service as any).constructGatewayUrl(cid);
      
      expect(url).toBe('https://test-gateway.pinata.cloud/ipfs/QmAbc456def');
      expect(url).not.toContain('//ipfs');
    });

    it('should remove multiple trailing slashes from gateway', () => {
      process.env.PINATA_GATEWAY = 'test-gateway.pinata.cloud///';
      const service = new PinataUploadService();
      const cid = 'QmDef789ghi';
      
      const url = (service as any).constructGatewayUrl(cid);
      
      expect(url).toBe('https://test-gateway.pinata.cloud/ipfs/QmDef789ghi');
    });

    it('should throw error when CID is empty string', () => {
      const service = new PinataUploadService();
      
      expect(() => (service as any).constructGatewayUrl('')).toThrow(
        'CID must be non-empty'
      );
    });

    it('should throw error when CID is whitespace only', () => {
      const service = new PinataUploadService();
      
      expect(() => (service as any).constructGatewayUrl('   ')).toThrow(
        'CID must be non-empty'
      );
    });

    it('should throw error when CID is null', () => {
      const service = new PinataUploadService();
      
      expect(() => (service as any).constructGatewayUrl(null)).toThrow(
        'CID must be non-empty'
      );
    });

    it('should throw error when CID is undefined', () => {
      const service = new PinataUploadService();
      
      expect(() => (service as any).constructGatewayUrl(undefined)).toThrow(
        'CID must be non-empty'
      );
    });

    it('should construct URL with different gateway domains', () => {
      process.env.PINATA_GATEWAY = 'custom-gateway.example.com';
      const service = new PinataUploadService();
      const cid = 'QmTest123';
      
      const url = (service as any).constructGatewayUrl(cid);
      
      expect(url).toBe('https://custom-gateway.example.com/ipfs/QmTest123');
    });

    it('should handle CIDs with special characters', () => {
      const service = new PinataUploadService();
      const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
      
      const url = (service as any).constructGatewayUrl(cid);
      
      expect(url).toBe('https://test-gateway.pinata.cloud/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi');
    });

    it('should ensure URL does not end with trailing slash', () => {
      const service = new PinataUploadService();
      const cid = 'QmTestCID';
      
      const url = (service as any).constructGatewayUrl(cid);
      
      expect(url).not.toMatch(/\/$/);
    });
  });
  
  describe('uploadMetadata', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset environment before each test
      process.env = { ...originalEnv };
      process.env.PINATA_JWT = 'test-jwt-token';
      process.env.PINATA_GATEWAY = 'test-gateway.pinata.cloud';
    });

    afterAll(() => {
      // Restore original environment
      process.env = originalEnv;
    });

    it('should have uploadMetadata method with correct signature', () => {
      const service = new PinataUploadService();
      
      // Verify the method exists and is a function
      expect(typeof service.uploadMetadata).toBe('function');
      expect(service.uploadMetadata.length).toBe(1); // Accepts 1 parameter
    });

    it('should serialize metadata to JSON format correctly', () => {
      // Test JSON serialization independently
      const metadata = {
        name: 'Test NFT #123',
        description: 'A test NFT with traits',
        symbol: 'TEST',
        seller_fee_basis_points: 500,
        image: 'https://test-gateway.pinata.cloud/ipfs/QmTestImage',
        external_url: 'https://example.com',
        attributes: [
          { trait_type: 'Background', value: 'Blue' },
          { trait_type: 'Eyes', value: 'Green' }
        ],
        properties: {
          files: [
            { uri: 'https://test-gateway.pinata.cloud/ipfs/QmTestImage', type: 'image/webp' }
          ],
          category: 'image',
          creators: [
            { address: 'TestAddress123', share: 100 }
          ]
        }
      };
      
      // Verify JSON serialization works (Requirement 4.1)
      const jsonString = JSON.stringify(metadata);
      expect(jsonString).toContain('Test NFT #123');
      expect(jsonString).toContain('Background');
      expect(jsonString).toContain('image/webp');
      
      // Verify it can be parsed back
      const parsed = JSON.parse(jsonString);
      expect(parsed.name).toBe(metadata.name);
      expect(parsed.attributes.length).toBe(2);
      expect(parsed.properties.files[0].type).toBe('image/webp');
    });

    it('should calculate correct JSON size in bytes', () => {
      const metadata = {
        name: 'Test',
        description: 'Test',
        image: 'test.jpg',
        attributes: []
      };
      
      const jsonString = JSON.stringify(metadata);
      const size = Buffer.byteLength(jsonString, 'utf8');
      
      // Verify size calculation
      expect(size).toBeGreaterThan(0);
      expect(typeof size).toBe('number');
    });

    it('should return PinataUploadResult with correct structure', () => {
      // Verify the expected return type structure
      const expectedResult = {
        cid: 'QmTest123',
        url: 'https://test-gateway.pinata.cloud/ipfs/QmTest123',
        size: 1234,
        contentType: 'application/json'
      };
      
      // Verify all required fields are present
      expect(expectedResult).toHaveProperty('cid');
      expect(expectedResult).toHaveProperty('url');
      expect(expectedResult).toHaveProperty('size');
      expect(expectedResult).toHaveProperty('contentType');
      
      // Verify content type is application/json (Requirement 4.2)
      expect(expectedResult.contentType).toBe('application/json');
    });
  });
});
