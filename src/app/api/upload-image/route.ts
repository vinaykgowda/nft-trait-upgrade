import { NextRequest, NextResponse } from 'next/server';
import { PinataSDK } from 'pinata';

/**
 * POST /api/upload-image
 * Uploads an image to Pinata IPFS network.
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

    // Read env vars - try both PINATA_JWT and PINATA_API_TOKEN (fallback name)
    const jwt = (process.env.PINATA_JWT || process.env.PINATA_API_TOKEN || '').trim();
    const gateway = (process.env.PINATA_GATEWAY || '').trim();

    // Debug logging
    const allPinataKeys = Object.keys(process.env).filter(k => k.includes('PINATA'));
    console.log(`🔑 ENV DEBUG:`);
    console.log(`  - PINATA_JWT: ${process.env.PINATA_JWT ? 'SET' : 'MISSING'}`);
    console.log(`  - PINATA_API_TOKEN: ${process.env.PINATA_API_TOKEN ? 'SET' : 'MISSING'}`);
    console.log(`  - jwt resolved: ${jwt ? 'YES (length=' + jwt.length + ')' : 'NO'}`);
    console.log(`  - PINATA_GATEWAY: ${gateway || 'MISSING'}`);
    console.log(`  - All PINATA keys: [${allPinataKeys.join(', ')}]`);

    if (!jwt || !gateway) {
      return NextResponse.json(
        { 
          error: `Pinata config missing: JWT=${jwt ? 'SET' : 'MISSING'}, GATEWAY=${gateway ? 'SET' : 'MISSING'}`,
          debug: {
            hasJwt: !!jwt,
            hasGateway: !!gateway,
            pinataKeysFound: allPinataKeys,
            totalEnvKeys: Object.keys(process.env).length,
          }
        },
        { status: 500 }
      );
    }

    // Convert base64 back to buffer
    const buffer = Buffer.from(imageBuffer, 'base64');
    console.log(`📦 Uploading image to Pinata (${buffer.length} bytes)`);

    // Create Pinata SDK instance
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
