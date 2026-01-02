import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const size = parseInt(url.searchParams.get('size') || '1500');
    
    // Create a transparent PNG image
    const transparentImage = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .png()
    .toBuffer();

    return new Response(new Uint8Array(transparentImage), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    });
  } catch (error) {
    console.error('Error creating transparent base:', error);
    return NextResponse.json(
      { error: 'Failed to create transparent base' },
      { status: 500 }
    );
  }
}