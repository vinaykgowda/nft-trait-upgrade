# NFT Image Specifications

## Standard Dimensions
- **Final NFT Images**: 1500x1500 pixels (fixed)
- **Preview Images**: 512x512 pixels (for performance)
- **Format**: PNG (supports transparency)
- **Quality**: Lossless compression

## File Size Estimates (1500x1500px)

### PNG Format (Recommended for NFTs)
- **Typical Size**: 2-8 MB
- **Maximum Size**: ~18 MB (complex artwork)
- **Advantages**: 
  - Lossless quality
  - Transparency support
  - Industry standard for NFTs

### JPEG Format (Alternative)
- **Typical Size**: 500KB-2MB
- **Quality Setting**: 90%
- **Limitations**: No transparency support

## Irys Upload Limits
- **Maximum File Size**: 100 MB per upload
- **Network**: Solana Devnet/Mainnet
- **Cost**: ~0.001 SOL per MB (approximate)

## Implementation Details

### Image Composition Service
```typescript
// Fixed dimensions for consistency
const STANDARD_DIMENSIONS = {
  preview: { width: 512, height: 512 },
  final: { width: 1500, height: 1500 }
};
```

### API Endpoints
- `/api/compose-image` - Creates final 1500x1500 NFT image
- `/api/nft-preview` - Creates 512x512 preview image
- `/api/upload-image` - Uploads to Irys storage

### Layer Composition
1. Base image (1500x1500)
2. Trait layers (ordered by layerOrder)
3. Final PNG output with transparency

## Storage Considerations
- All images stored on Irys (decentralized)
- Metadata includes image URLs
- Backup storage recommended for production
- CDN integration for faster loading

## Performance Optimization
- Preview images for UI (512x512)
- Final images only generated on purchase
- Lazy loading for trait galleries
- Image caching strategies