import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

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

    // Check if Vercel Blob is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: 'Vercel Blob storage not configured' },
        { status: 500 }
      );
    }

    // Generate filename with timestamp
    const timestamp = Date.now();
    const sanitizedFilename = (filename || 'image.png').replace(/[^a-zA-Z0-9.-]/g, '_');
    const blobFilename = `composed/${timestamp}_${sanitizedFilename}`;

    // Upload to Vercel Blob (handles large files better than Irys)
    const blob = await put(blobFilename, buffer, {
      access: 'public',
      contentType: contentType || 'image/png',
    });

    console.log(`✅ Image uploaded to Vercel Blob: ${blob.url}`);

    return NextResponse.json({
      success: true,
      imageUrl: blob.url,
      uploadId: blob.pathname,
      size: buffer.length
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