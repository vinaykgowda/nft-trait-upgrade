# Enhanced NFT Preview System

## Problem
The preview system was only showing the original NFT image with selected traits overlaid, instead of showing a complete NFT composition with existing traits replaced by new ones.

## Solution
Created a comprehensive NFT preview system that:

1. **Fetches NFT traits from Helius** - Gets the current trait attributes from the NFT metadata
2. **Maps traits to our system** - Matches NFT attributes to our trait database
3. **Builds complete composition** - Creates a full trait set with replacements
4. **Generates layered preview** - Composes all traits in proper layer order

## New Components

### 1. NFT Preview API (`/api/nft-preview`)
- Fetches NFT metadata from Helius using `getAsset` method
- Maps NFT attributes to our trait system by matching trait types and values
- Builds complete trait selection (existing + new traits)
- Generates composed preview image with all layers

**Key Features:**
- Intelligent trait matching between NFT attributes and database traits
- Proper trait replacement (new traits override existing ones)
- Complete trait composition with proper layering
- Detailed logging for debugging trait mapping

### 2. Transparent Base API (`/api/transparent-base`)
- Provides transparent PNG base for proper trait layering
- Eliminates background artifacts from original NFT image
- Allows clean composition of all trait layers
- Cached for performance (1 year cache)

### 3. Enhanced LivePreview Component
- Uses new NFT preview API instead of simple overlay
- Shows complete NFT composition with trait replacements
- Includes trait composition details in development mode
- Better error handling and loading states

### 4. Enhanced Image Composition Service
- Handles transparent base images for clean layering
- Improved trait ordering and layer management
- Better error handling for missing trait images
- Detailed logging for composition debugging

## How It Works

### 1. NFT Trait Fetching
```typescript
// Fetch NFT from Helius
const response = await fetch(`https://rpc.helius.xyz/?api-key=${heliusApiKey}`, {
  method: 'POST',
  body: JSON.stringify({
    method: 'getAsset',
    params: { id: nftAddress }
  })
});

// Extract attributes
const nftAttributes = nftData.content?.metadata?.attributes || [];
```

### 2. Trait Mapping
```typescript
// Map NFT attributes to our trait system
for (const attribute of nftAttributes) {
  const traitType = attribute.trait_type?.toLowerCase();
  const traitValue = attribute.value;
  
  // Find matching slot and trait in our database
  const matchingSlot = domainSlots.find(slot => 
    slot.name.toLowerCase() === traitType
  );
  
  const matchingTrait = existingTraits.find(trait => 
    trait.name.toLowerCase() === traitValue.toLowerCase()
  );
}
```

### 3. Complete Composition
```typescript
// Start with NFT's existing traits
const completeTraitSelection = { /* existing traits */ };

// Override with selected new traits
Object.entries(selectedTraits).forEach(([slotId, trait]) => {
  completeTraitSelection[slotId] = trait; // Replace existing
});

// Compose with transparent base + all traits
const result = await compositionService.createPreview(
  '/api/transparent-base', // Clean base
  completeTraitSelection,  // All traits
  domainSlots,            // Proper ordering
  512                     // Preview size
);
```

## Benefits

### ✅ Accurate Previews
- Shows exactly how the NFT will look after trait updates
- Proper trait replacement instead of simple overlay
- Complete composition with all layers

### ✅ Intelligent Mapping
- Automatically maps NFT attributes to trait database
- Handles variations in trait naming
- Robust matching algorithm

### ✅ Performance Optimized
- Cached transparent base images
- Efficient trait composition
- Debounced preview generation

### ✅ Developer Friendly
- Detailed logging for debugging
- Trait composition details in dev mode
- Clear error messages

## Usage

The enhanced preview system is automatically used in the TraitMarketplace component:

```tsx
<LivePreview
  baseNFT={selectedNFT}      // NFT with address for Helius lookup
  selectedTraits={selectedTraits} // New traits to apply
  slots={slots}              // Trait slots for ordering
/>
```

The preview will now show a complete NFT composition with the selected traits properly replacing the existing ones, giving users an accurate preview of their updated NFT.