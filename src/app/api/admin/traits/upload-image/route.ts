import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { ImageStorageService } from '@/lib/services/image-storage';

export async function POST(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const category = formData.get('category') as string || 'unknown';
    const rarity = formData.get('rarity') as string || 'common';
    const filename = formData.get('filename') as string || imageFile.name;

    if (!imageFile) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 });
    }

    // Validate image
    const imageValidation = ImageStorageService.validateImage(imageFile);
    if (!imageValidation.valid) {
      return NextResponse.json({ error: imageValidation.error }, { status: 400 });
    }

    // Validate image dimensions (optional for bulk upload)
    try {
      const dimensionValidation = await ImageStorageService.validateImageDimensions(imageFile);
      if (!dimensionValidation.valid) {
        console.warn('Image dimension validation failed:', dimensionValidation.error);
        // Don't fail the upload, just warn
      }
    } catch (error) {
      console.warn('Could not validate image dimensions:', error);
    }

    // Store image
    const imageUrl = await ImageStorageService.storeImage(imageFile, {
      category,
      rarity,
      filename
    });

    return NextResponse.json({
      success: true,
      imageUrl
    });

  } catch (error) {
    console.error('Image upload API error:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}