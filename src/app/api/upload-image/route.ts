import { NextRequest, NextResponse } from 'next/server';
import { PinataSDK } from 'pinata';

/**
 * POST /api/upload-image
 * 
 * Uploads an image to Pinata IPFS network.
 * Reads PINATA_JWT and PINATA_GATEWAY directly from process.env at request time.
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

    // Read env vars directly at request time
    const jwt = process.env.PINATA_JWT;
    const gateway = process.env.PINATA_GATEWAY;

    console.log(`🔑 Pinata env check: JWT=${jwt ? 'SET(' + jwt.substring(0, 8) + '...)' : 'MISSING'}, GATEWAY=${gateway || 'MISSING'}`);

    if (!jwt || !gateway) {
      return NextResponse.json(
        { 
          error: 'PINATA_JWT and PINATA_GATEWAY environment variables are required',
          debug: {
            hasJwt: !!jwt,
            hasGateway: !!gateway,
            nodeEnv: process.env.NODE_ENV,
          }
        },
        { status: 500 }
      );
    }

    // Convert base64 back to buffer
    const buffer = Buffer.from(imageBuffer, 'base64');

    console.log(`📦 Uploading image to Pinata (${buffer.length} bytes)`);

    // Create Pinata SDK instance fresh for each request
    const pinata = new PinataSDK({ pinataJwt: jwt });

    // Create a File object from the buffer
    const blob = new Blob([new Uint8Array(buffer)], { type: contentType || 'image/webp' });
    const file = new File([blob], filename || 'image.webp', { type: contentType || 'image/webp' });

    // Upload to Pinata
    const uploadResult = await pinata.upload.public.file(file);
    const cid = uploadResult.cid;
    const cleanGateway = gateway.replace(/\/+$/, '');
    const imageUrl = `https://${cleanGateway}/ipfs/${cid}`;

    console.log(`✅ Image uploaded to Pinata IPFS: ${imageUrl}`);

    return NextResponse.json({
      success: true,
      imageUrl,
      uploadId: cid,
      size: buffer.length,
      storage: 'pinata-ipfs'
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
