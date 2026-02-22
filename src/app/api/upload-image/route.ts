import { NextRequest, NextResponse } from 'next/server';
import { PinataUploadService } from '@/lib/services/pinata-upload';

/**
 * POST /api/upload-image
 * 
 * Uploads an image to Pinata IPFS network.
 * Replaces previous Irys/Vercel Blob implementation.
 * 
 * Requirements: 6.1
 */
export async function POST(request: NextRequest) {
  try {
    const { imageBuffer, contentType, filename } = await request.json();

    if (!imageBuffer) {
      return NextResponse.json(
        { error: 'Missing required field: imageBuffer' },
        { status: 400 }
      );
    }

    // Convert base64 back to buffer
    const buffer = Buffer.from(imageBuffer, 'base64');

    console.log(`📦 Uploading image to Pinata (${buffer.length} bytes)`);

    // Use Pinata for all uploads (Requirement 6.1)
    const pinataService = new PinataUploadService();
    const uploadResult = await pinataService.uploadImage(
      buffer,
      contentType || 'image/webp'
    );

    console.log(`✅ Image uploaded to Pinata IPFS: ${uploadResult.url}`);

    // Return CID as uploadId (Requirement 6.1)
    return NextResponse.json({
      success: true,
      imageUrl: uploadResult.url,
      uploadId: uploadResult.cid,  // Return CID instead of Irys ID
      size: uploadResult.size,
      storage: 'pinata-ipfs'  // Return 'pinata-ipfs' as storage type
    });

  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json(
      { 
        error: 'Failed to upload image',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}