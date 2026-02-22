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

    // Read env vars directly - same way TREASURY_WALLET, DATABASE_URL etc. are read
    const jwt = (process.env.PINATA_JWT || '').trim();
    const gateway = (process.env.PINATA_GATEWAY || '').trim();

    // Debug logging
    const allPinataKeys = Object.keys(process.env).filter(k => k.includes('PINATA'));
    console.log(`🔑 ENV DEBUG:`);
    console.log(`  - PINATA_JWT: ${jwt ? 'SET (length=' + jwt.length + ', starts=' + jwt.substring(0, 8) + '...)' : 'MISSING'}`);
    console.log(`  - PINATA_GATEWAY: ${gateway || 'MISSING'}`);
    console.log(`  - All PINATA keys in process.env: [${allPinataKeys.join(', ')}]`);
    console.log(`  - TREASURY_WALLET: ${process.env.TREASURY_WALLET ? 'SET' : 'MISSING'}`);
    console.log(`  - DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'MISSING'}`);
    console.log(`  - NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`  - Total env keys: ${Object.keys(process.env).length}`);

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
