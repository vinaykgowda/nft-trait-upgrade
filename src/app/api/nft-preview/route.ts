import { NextRequest, NextResponse } from 'next/server';
import { ImageCompositionService } from '@/lib/services/image-composition';
import { getTraitSlotRepository, getTraitRepository } from '@/lib/repositories';
import { HeliusNFTService } from '@/lib/services/nft';
import { Trait, TraitSlot } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { nftAddress, selectedTraits } = await request.json();
    
    console.log('🔍 NFT Preview API called with:', { nftAddress, selectedTraitsCount: Object.keys(selectedTraits || {}).length });
    console.log('🔍 Enhanced trait mapping v2.0 starting...');

    if (!nftAddress) {
      console.error('❌ Missing nftAddress');
      return NextResponse.json(
        { error: 'Missing required field: nftAddress' },
        { status: 400 }
      );
    }

    // Get the base URL from the request headers
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    
    console.log(`NFT Preview API - Base URL: ${baseUrl}`);
    console.log(`NFT Preview API - NFT Address: ${nftAddress}`);
    console.log(`NFT Preview API - Selected traits count: ${Object.keys(selectedTraits || {}).length}`);

    // Fetch NFT metadata from Helius
    const nftService = new HeliusNFTService();
    const heliusApiKey = process.env.HELIUS_API_KEY;
    
    if (!heliusApiKey) {
      return NextResponse.json(
        { error: 'Helius API key not configured' },
        { status: 500 }
      );
    }

    let nftData;
    
    // Handle test case
    if (nftAddress === 'test123' || nftAddress === 'test') {
      nftData = {
        content: {
          metadata: {
            attributes: [
              { "value": "Cyan", "trait_type": "Background" },
              { "value": "Magma", "trait_type": "Fur" },
              { "value": "Hoodie", "trait_type": "Clothes" },
              { "value": "Supernova", "trait_type": "Eyes" },
              { "value": "Not Amused", "trait_type": "Mouth" }
            ]
          }
        }
      };
    } else {
      // Fetch NFT details from Helius
      const response = await fetch(`https://rpc.helius.xyz/?api-key=${heliusApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'nft-trait-preview',
          method: 'getAsset',
          params: {
            id: nftAddress,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Helius API error: ${response.status}`);
      }

      const { result } = await response.json();
      nftData = result;
      
      if (!nftData) {
        return NextResponse.json(
          { error: 'NFT not found' },
          { status: 404 }
        );
      }
    }

    // Get trait slots for proper layering
    const traitSlotRepo = getTraitSlotRepository();
    const traitRepo = getTraitRepository();
    const slots = await traitSlotRepo.findAllOrdered();
    const domainSlots = slots.map(slot => traitSlotRepo.toDomain(slot));

    // Build complete trait composition
    const completeTraitSelection: Record<string, Trait> = {};

    // First, map NFT's current attributes to our trait system
    const nftAttributes = nftData.content?.metadata?.attributes || [];
    
    console.log('🔍 NFT Attributes found:', nftAttributes.length);
    
    for (const attribute of nftAttributes) {
      const traitType = attribute.trait_type?.toLowerCase();
      const traitValue = attribute.value;
      
      console.log(`🔍 Processing attribute: ${traitType} = ${traitValue}`);
      
      // Skip blank traits and rarity rank as they're not visual traits
      if (!traitType || !traitValue || traitValue === 'Blank' || traitType === 'rarity rank') {
        console.log(`⏭️ Skipping non-visual trait: ${traitType} = ${traitValue}`);
        continue;
      }

      // Find matching slot
      const matchingSlot = domainSlots.find(slot => 
        slot.name.toLowerCase() === traitType ||
        slot.name.toLowerCase().includes(traitType) ||
        traitType.includes(slot.name.toLowerCase())
      );

      console.log(`🎯 Slot match for "${traitType}":`, matchingSlot?.name);

      if (matchingSlot) {
        // Find matching trait in our database (don't filter by active since user already owns these traits)
        const existingTraits = await traitRepo.findWithRelations({
          slotId: matchingSlot.id
          // Note: No active filter here - user already owns these traits regardless of marketplace status
        });

        console.log(`🔍 All traits in ${matchingSlot.name} slot:`, existingTraits.map(t => t.name));

        const matchingTrait = existingTraits.find(trait => 
          trait.name.toLowerCase() === traitValue.toLowerCase()
        ) || existingTraits.find(trait => {
          // Only use fuzzy matching if exact match fails
          // But require the LONGER string to contain the shorter one,
          // AND the lengths must be similar (within 50% difference) to avoid
          // "Crown" matching "Special Crown" or "Dragonbone Crown"
          const traitNameLower = trait.name.toLowerCase();
          const valueLower = traitValue.toLowerCase();
          if (traitNameLower === valueLower) return true;
          
          // Check if one is a substring of the other
          const isSubstring = traitNameLower.includes(valueLower) || valueLower.includes(traitNameLower);
          if (!isSubstring) return false;
          
          // Only allow fuzzy match if lengths are very similar (within 3 chars)
          // This prevents "Crown" from matching "Special Crown" or "Dragonbone Crown"
          const lengthDiff = Math.abs(traitNameLower.length - valueLower.length);
          return lengthDiff <= 3;
        });

        if (matchingTrait) {
          completeTraitSelection[matchingSlot.id] = traitRepo.toDomain(matchingTrait);
          console.log(`✅ Mapped NFT trait: ${traitType} = ${traitValue} -> ${matchingTrait.name}`);
        } else {
          console.log(`❌ No matching trait found for: ${traitType} = ${traitValue}`);
          console.log(`Available traits:`, existingTraits.map(t => t.name));
        }
      } else {
        console.log(`❌ No matching slot found for trait type: ${traitType}`);
      }
    }

    // Override with selected new traits
    if (selectedTraits) {
      Object.entries(selectedTraits).forEach(([slotId, trait]: [string, any]) => {
        completeTraitSelection[slotId] = trait;
        console.log(`Overriding trait for slot ${slotId}: ${trait.name}`);
      });
    }

    console.log(`Complete trait selection:`, Object.keys(completeTraitSelection).map(slotId => {
      const slot = domainSlots.find(s => s.id === slotId);
      const trait = completeTraitSelection[slotId];
      return `${slot?.name}: ${trait.name}`;
    }));

    // Get base image URL - use a transparent base or the original NFT image
    // For proper layering, we should use a transparent base and layer all traits
    const baseImageUrl = '/api/transparent-base'; // We'll create this endpoint for a transparent base

    // Compose the preview image with all traits
    const compositionService = new ImageCompositionService();
    const result = await compositionService.createPreview(
      baseImageUrl,
      completeTraitSelection,
      domainSlots,
      1500, // Final image size
      baseUrl
    );

    // Convert buffer to base64 for JSON response
    const imageBase64 = `data:image/${result.format};base64,${result.imageBuffer.toString('base64')}`;

    return NextResponse.json({
      success: true,
      previewUrl: imageBase64,
      width: result.width,
      height: result.height,
      nftAttributes: nftAttributes,
      mappedTraits: Object.keys(completeTraitSelection).length,
      traitDetails: Object.entries(completeTraitSelection).map(([slotId, trait]) => ({
        slotId,
        slotName: domainSlots.find(s => s.id === slotId)?.name,
        traitName: trait.name,
        isNew: selectedTraits && selectedTraits[slotId] ? true : false
      }))
    });

  } catch (error) {
    console.error('Error creating NFT preview:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create NFT preview',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}