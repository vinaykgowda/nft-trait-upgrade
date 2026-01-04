# NFT Image Specifications

## Standard Dimensions
- **Final NFT Images**: 1500x1500 pixels (fixed)
- **Preview Images**: 512x512 pixels (for performance)
- **Format**: JPEG 90% quality (optimized file size)
- **Quality**: High quality with efficient compression

## File Size Estimates (1500x1500px)

### JPEG Format (Recommended - Current Setting)
- **Typical Size**: 500KB-2MB
- **Quality Setting**: 90%
- **Advantages**: 
  - Much smaller file sizes
  - Faster uploads to Irys
  - Better performance
  - Industry standard for photos

### PNG Format (Alternative)
- **Typical Size**: 2-8 MB
- **Maximum Size**: ~18 MB (complex artwork)
- **Use Case**: Only when transparency is required

## Irys Upload Limits
- **Maximum File Size**: 100 MB per upload
- **Network**: Solana Devnet/Mainnet
- **Cost**: ~0.001 SOL per MB (approximate)
- **JPEG Advantage**: 4-8x smaller files = lower costs

## Implementation Details

### Image Composition Service
```typescript
// Fixed dimensions and format for consistency
const STANDARD_DIMENSIONS = {
  preview: { width: 512, height: 512, format: 'png' },
  final: { width: 1500, height: 1500, format: 'jpeg', quality: 90 }
};
```

### API Endpoints
- `/api/compose-image` - Creates final 1500x1500 JPEG NFT image
- `/api/nft-preview` - Creates 512x512 PNG preview image
- `/api/upload-image` - Uploads to Irys storage (JPEG optimized)

### Layer Composition
1. Base image (1500x1500)
2. Trait layers (ordered by layerOrder)
3. Final JPEG output at 90% quality

## Storage Considerations
- All images stored on Irys (decentralized)
- Metadata includes image URLs
- JPEG format reduces storage costs significantly
- CDN integration for faster loading

## Performance Optimization
- Preview images for UI (512x512 PNG)
- Final images only generated on purchase (1500x1500 JPEG)
- Lazy loading for trait galleries
- Image caching strategies
- 4-8x smaller file sizes with JPEG