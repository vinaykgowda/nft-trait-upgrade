import { NextRequest, NextResponse } from 'next/server';
import { getTraitSlotRepository, getTraitRepository } from '@/lib/repositories';

export async function POST(request: NextRequest) {
  try {
    const { nftAddress } = await request.json();
    
    // Simulate NFT attributes
    const nftAttributes = [
      { "value": "Cyan", "trait_type": "Background" },
      { "value": "Magma", "trait_type": "Fur" },
      { "value": "Hoodie", "trait_type": "Clothes" },
      { "value": "Supernova", "trait_type": "Eyes" },
      { "value": "Not Amused", "trait_type": "Mouth" }
    ];

    const traitSlotRepo = getTraitSlotRepository();
    const traitRepo = getTraitRepository();
    const slots = await traitSlotRepo.findAllOrdered();
    const domainSlots = slots.map(slot => traitSlotRepo.toDomain(slot));

    console.log('Available slots:', domainSlots.map(s => s.name));

    const results = [];

    for (const attribute of nftAttributes) {
      const traitType = attribute.trait_type?.toLowerCase();
      const traitValue = attribute.value;
      
      console.log(`\n🔍 Processing: ${traitType} = ${traitValue}`);
      
      // Find matching slot
      const matchingSlot = domainSlots.find(slot => 
        slot.name.toLowerCase() === traitType
      );

      console.log(`Slot match:`, matchingSlot?.name);

      if (matchingSlot) {
        // Find matching trait in our database (don't filter by active for preview composition)
        const existingTraits = await traitRepo.findWithRelations({
          slotId: matchingSlot.id
          // No active filter - we want to find all traits for preview composition
        });

        console.log(`Available traits in ${matchingSlot.name}:`, existingTraits.map(t => t.name));

        const matchingTrait = existingTraits.find(trait => 
          trait.name.toLowerCase() === traitValue.toLowerCase()
        );

        const result = {
          nftTrait: `${traitType} = ${traitValue}`,
          slotFound: !!matchingSlot,
          slotName: matchingSlot?.name,
          availableTraits: existingTraits.map(t => t.name),
          traitFound: !!matchingTrait,
          matchedTrait: matchingTrait?.name
        };

        results.push(result);
        console.log(`Result:`, result);
      }
    }

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}