import { NextRequest, NextResponse } from 'next/server';
import { ImageCompositionService } from '@/lib/services/image-composition';
import { getTraitSlotRepository } from '@/lib/repositories';
import { Trait } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { baseImageUrl, selectedTraits, assetId } = await request.json();

    if (!baseImageUrl || !selectedTraits) {
      return NextResponse.json(
        { error: 'Missing required fields: baseImageUrl, selectedTraits' },
        { status: 400 }
      );
    }

    console.log('🎨 Compose-image API received:', {
      baseImageUrl,
      selectedTraits: typeof selectedTraits === 'object' ? Object.keys(selectedTraits) : selectedTraits,
      assetId,
      traitCount: typeof selectedTraits === 'object' ? Object.keys(selectedTraits).length : 0
    });

    // Get the base URL from the request headers
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    // Get trait slots for proper layering
    const traitSlotRepo = getTraitSlotRepository();
    const slots = await traitSlotRepo.findAllOrdered();
    const domainSlots = slots.map(slot => traitSlotRepo.toDomain(slot));

    // Handle both TraitSelection object and array formats
    let traitSelection: Record<string, Trait>;
    
    if (Array.isArray(selectedTraits)) {
      // Convert traits array to TraitSelection format (legacy support)
      traitSelection = {};
      selectedTraits.forEach((trait: Trait) => {
        traitSelection[trait.slotId] = trait;
      });
      console.log('🔄 Converted array to TraitSelection object');
    } else {
      // Already in TraitSelection format
      traitSelection = selectedTraits;
      console.log('✅ Using TraitSelection object directly');
    }

    console.log('🎨 Final trait selection for composition:', {
      slotIds: Object.keys(traitSelection),
      traits: Object.values(traitSelection).map(t => ({ name: t.name, slotId: t.slotId }))
    });

    // Compose the image at fixed 1500x1500 dimensions
    const compositionService = new ImageCompositionService();
    const result = await compositionService.createFinalComposition(
      baseImageUrl,
      traitSelection,
      domainSlots,
      baseUrl // Pass the base URL for relative path resolution
    );

    // Convert buffer to base64 for JSON response
    const imageBase64 = result.imageBuffer.toString('base64');

    return NextResponse.json({
      success: true,
      imageBuffer: imageBase64,
      width: result.width,
      height: result.height,
      format: result.format,
      size: result.imageBuffer.length
    });

  } catch (error) {
    console.error('Error composing image:', error);
    return NextResponse.json(
      { 
        error: 'Failed to compose image',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}