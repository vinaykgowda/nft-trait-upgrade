import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/upload-image
 * Uploads an image to Pinata IPFS using API Key + Secret (no JWT needed).
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

    const apiKey = process.env.PINATA_API_KEY;
    const apiSecret = process.env.PINATA_API_SECRET;
    const gateway = (process.env.PINATA_GATEWAY || '').trim();

    console.log(`🔑 ENV: PINATA_API_KEY=${apiKey ? 'SET' : 'MISSING'}, PINATA_API_SECRET=${apiSecret ? 'SET' : 'MISSING'}, GATEWAY=${gateway || 'MISSING'}`);

    if (!apiKey || !apiSecret || !gateway) {
      return NextResponse.json(
        { error: `Pinata config missing: KEY=${apiKey ? 'SET' : 'MISSING'}, SECRET=${apiSecret ? 'SET' : 'MISSING'}, GATEWAY=${gateway ? 'SET' : 'MISSING'}` },
        { status: 500 }
      );
    }

    // Convert base64 back to buffer
    const buffer = Buffer.from(imageBuffer, 'base64');
    console.log(`📦 Uploading image to Pinata (${buffer.length} bytes)`);

    // Build multipart form data for Pinata REST API
    const blob = new Blob([new Uint8Array(buffer)], { type: contentType || 'image/webp' });
    const formData = new FormData();
    formData.append('file', blob, filename || 'image.webp');

    // Upload via Pinata REST API with API key + secret headers
    const pinataRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'pinata_api_key': apiKey,
        'pinata_secret_api_key': apiSecret,
      },
      body: formData,
    });

    if (!pinataRes.ok) {
      const errText = await pinataRes.text();
      console.error(`❌ Pinata upload failed (${pinataRes.status}):`, errText);
      throw new Error(`Pinata API error ${pinataRes.status}: ${errText}`);
    }

    const pinataResult = await pinataRes.json();
    const cid = pinataResult.IpfsHash;
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
      { error: 'Failed to upload image', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
