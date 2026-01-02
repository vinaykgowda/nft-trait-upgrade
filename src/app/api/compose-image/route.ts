import { NextRequest, NextResponse } from 'next/server';
import { ImageCompositionService } from '@/lib/services/image-composition';
import { getTraitSlotRepository } from '@/lib/repositories';
import { Trait } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { baseImageUrl, selectedTraits, assetId } = await request.json();

    if (!baseImageUrl || !selectedTraits || !Array.isArray(selectedTraits)) {
      return NextResponse.json(
        { error: 'Missing required fields: baseImageUrl, selectedTraits' },
        { status: 400 }
      );
    }

    // Get the base URL from the request headers
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    // Get trait slots for proper layering
    const traitSlotRepo = getTraitSlotRepository();
    const slots = await traitSlotRepo.findAllOrdered();
    const domainSlots = slots.map(slot => traitSlotRepo.toDomain(slot));

    // Convert traits array to TraitSelection format
    const traitSelection: Record<string, Trait> = {};
    selectedTraits.forEach((trait: Trait) => {
      traitSelection[trait.slotId] = trait;
    });

    // Compose the image
    const compositionService = new ImageCompositionService();
    const result = await compositionService.createFinalComposition(
      baseImageUrl,
      traitSelection,
      domainSlots,
      1500, // High quality 1500x1500 for final NFT
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