# Testing the Enhanced NFT Preview System

## Current Status
✅ **NFT Preview API is working** - Successfully tested with real NFT data
✅ **Image composition is working** - Generating proper layered images  
✅ **Trait mapping is working** - Successfully mapping NFT attributes to traits
✅ **Component is updated** - LivePreview component now uses new API

## Issue
The browser may be showing cached version of the old component.

## Testing Steps

### 1. Refresh Browser
**IMPORTANT**: Hard refresh the browser (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows) to clear component cache.

### 2. Select an NFT
- Go to the marketplace page
- Select an NFT from the left column (Your NFTs)
- The preview should show the original NFT image initially

### 3. Select a Trait
- Choose a trait from the center column (Available Traits)
- Click on any trait to select it
- **This should trigger the enhanced preview generation**

### 4. Watch for Loading State
- You should see "Composing NFT..." loading message
- The preview should update to show the composed image with new traits

### 5. Check Browser Console
- Open browser developer tools (F12)
- Look for console logs:
  - `🎨 LivePreview v2.0 mounted with NFT: [name] Address: [address]`
  - `🔄 Generating NFT preview for: [address] with traits: [trait_ids]`
  - `🔍 NFT Preview API response status: 200`

### 6. Check Network Tab
- In browser dev tools, go to Network tab
- Look for POST request to `/api/nft-preview`
- Should return 200 status with base64 image data

## Expected Result
The preview should show a **completely new composed NFT image** with:
- All existing traits from the original NFT
- Selected new traits replacing the corresponding existing ones
- Proper layer ordering (background, fur, clothes, etc.)

## If Still Not Working

### Check Server Logs
Look for these logs in the server console:
```
🔍 NFT Preview API called with: {nftAddress: "...", selectedTraitsCount: 1}
Mapped NFT trait: background = Cyan -> Cyan
Complete trait selection: Background: Cyan, Fur: Magma, etc.
```

### Manual API Test
Test the API directly:
```bash
curl -X POST http://localhost:3003/api/nft-preview \
  -H "Content-Type: application/json" \
  -d '{"nftAddress":"DywWYUmW9yHbTWBPEKu66WUjvQHSqRTaHCwt21LFiktQ"}'
```

Should return success with base64 image data.

## Troubleshooting

1. **Hard refresh browser** (most common issue)
2. **Check browser console** for JavaScript errors
3. **Check network requests** to see if API is being called
4. **Verify NFT address** is correct Solana asset ID
5. **Check Helius API key** is configured in .env.local

The enhanced preview system is working at the API level - the issue is likely browser caching of the old component.