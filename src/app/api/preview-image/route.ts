import { NextRequest, NextResponse } from 'next/server';
import { ImageCompositionService } from '@/lib/services/image-composition';
import { getTraitSlotRepository } from '@/lib/repositories';
import { Trait } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { baseImageUrl, selectedTraits } = await request.json();

    if (!baseImageUrl || !selectedTraits) {
      return NextResponse.json(
        { error: 'Missing required fields: baseImageUrl, selectedTraits' },
        { status: 400 }
      );
    }

    // Get the base URL from the request headers
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    
    console.log(`Preview API - Base URL: ${baseUrl}`);
    console.log(`Preview API - Selected traits count: ${Object.keys(selectedTraits).length}`);

    // Get trait slots for proper layering
    const traitSlotRepo = getTraitSlotRepository();
    const slots = await traitSlotRepo.findAllOrdered();
    const domainSlots = slots.map(slot => traitSlotRepo.toDomain(slot));

    // Convert traits array to TraitSelection format
    const traitSelection: Record<string, Trait> = {};
    Object.entries(selectedTraits).forEach(([slotId, trait]: [string, any]) => {
      traitSelection[slotId] = trait;
    });

    // Compose the preview image (smaller size for faster loading)
    const compositionService = new ImageCompositionService();
    const result = await compositionService.createPreview(
      baseImageUrl,
      traitSelection,
      domainSlots,
      512, // Keep smaller size for faster preview loading
      baseUrl // Pass the base URL for relative path resolution
    );

    // Convert buffer to base64 for JSON response
    const imageBase64 = `data:image/${result.format};base64,${result.imageBuffer.toString('base64')}`;

    return NextResponse.json({
      success: true,
      previewUrl: imageBase64,
      width: result.width,
      height: result.height
    });

  } catch (error) {
    console.error('Error creating preview:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create preview',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}