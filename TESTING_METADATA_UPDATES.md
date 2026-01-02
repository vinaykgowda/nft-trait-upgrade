# Testing NFT Metadata Updates & Irys Uploads

This guide will help you test the complete NFT metadata update flow, including image composition, Irys uploads, and Core Asset updates.

## Prerequisites

1. **Solana Keypair**: You need a Solana keypair (keypair.json file) with some devnet SOL
2. **Running Development Server**: Your Next.js app should be running on localhost
3. **Database**: PostgreSQL database should be running with trait data

## Step 1: Configure Your Keypair

### Option A: Use the Setup Script

```bash
# Place your keypair.json in the project root, then run:
node scripts/setup-keypair.js ./keypair.json

# Or specify a custom path:
node scripts/setup-keypair.js /path/to/your/keypair.json
```

This will output the environment variables you need to add to your `.env.local` file.

### Option B: Manual Configuration

1. Convert your keypair.json to the required format:
   ```bash
   # If your keypair.json contains an array like [1,2,3,...]
   # Copy that array and use it as the value for the environment variables
   ```

2. Add these lines to your `.env.local` file:
   ```bash
   # Solana Keypair Configuration
   SOLANA_DELEGATE_PRIVATE_KEY=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64]
   IRYS_PRIVATE_KEY=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64]
   UPDATE_AUTHORITY_PRIVATE_KEY=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64]
   ```

   Replace the array with your actual keypair values.

## Step 2: Restart Your Development Server

After updating your `.env.local` file:

```bash
# Stop your current server (Ctrl+C)
# Then restart it
npm run dev
```

## Step 3: Run the Complete Test Suite

```bash
# Run the comprehensive metadata update test
node scripts/test-metadata-update.js
```

This test will:
1. ✅ Generate NFT preview with all 5 traits (1500x1500)
2. ✅ Compose final image with trait layers
3. ✅ Upload image to Irys (mock for testing)
4. ✅ Update NFT metadata with new traits
5. ✅ Verify the complete flow

## Step 4: Test Individual Components

### Test NFT Preview Generation
```bash
curl -X POST http://localhost:3001/api/nft-preview \
  -H "Content-Type: application/json" \
  -d '{"nftAddress": "test123"}' | jq
```

### Test Image Composition
```bash
curl -X POST http://localhost:3001/api/compose-image \
  -H "Content-Type: application/json" \
  -d '{
    "baseImageUrl": "/api/transparent-base",
    "selectedTraits": []
  }' | jq
```

### Test Image Upload to Irys
```bash
# First get a composed image, then upload it
curl -X POST http://localhost:3001/api/upload-image \
  -H "Content-Type: application/json" \
  -d '{
    "imageBuffer": "base64-encoded-image-data",
    "contentType": "image/png"
  }' | jq
```

### Test Metadata Update
```bash
curl -X POST http://localhost:3001/api/update-nft-metadata \
  -H "Content-Type: application/json" \
  -d '{
    "assetId": "test123",
    "newImageUrl": "https://devnet.irys.xyz/mock_image_id",
    "newTraits": [],
    "txSignature": "test_signature"
  }' | jq
```

## Expected Results

### With Keypair Configured:
- ✅ NFT Preview: 1500x1500 image with all 5 trait layers
- ✅ Image Composition: High-quality layered image
- ✅ Irys Upload: Mock upload with generated URLs
- ✅ Metadata Update: Complete metadata with trait attributes

### Without Keypair:
- ✅ NFT Preview: Works (no keypair needed)
- ✅ Image Composition: Works (no keypair needed)
- ❌ Irys Upload: Fails with "IRYS_PRIVATE_KEY not configured"
- ❌ Metadata Update: Fails with "UPDATE_AUTHORITY_PRIVATE_KEY not configured"

## Troubleshooting

### Common Issues:

1. **"IRYS_PRIVATE_KEY not configured"**
   - Solution: Add your keypair to `.env.local` and restart the server

2. **"Invalid keypair format"**
   - Solution: Ensure your keypair is an array of 64 numbers

3. **"Connection refused"**
   - Solution: Make sure your development server is running on the correct port

4. **"Database connection error"**
   - Solution: Ensure PostgreSQL is running and the database exists

### Debug Mode:

To see detailed logs, check your development server console while running tests. The services will log:
- 📤 Upload attempts to Irys
- 🔍 Trait mapping process
- 🎨 Image composition steps
- 💰 Balance checks
- ✅ Success/failure messages

## Production Considerations

When moving to production:

1. **Real Irys Integration**: Replace mock uploads with actual Irys SDK
2. **Core Asset Updates**: Implement real Metaplex Core asset updates
3. **Error Handling**: Add comprehensive error handling and retries
4. **Security**: Secure keypair storage and access
5. **Monitoring**: Add logging and monitoring for upload success rates

## Next Steps

Once testing is complete:
1. Integrate with your frontend marketplace
2. Add transaction building for actual purchases
3. Implement real Core Asset updates
4. Add comprehensive error handling
5. Deploy to production with proper security measures