import { NextRequest, NextResponse } from 'next/server';
import { IrysUploadService } from '@/lib/services/irys-upload';
import { Keypair } from '@solana/web3.js';

export async function POST(request: NextRequest) {
  try {
    const { imageBuffer, contentType } = await request.json();

    if (!imageBuffer) {
      return NextResponse.json(
        { error: 'Missing required field: imageBuffer' },
        { status: 400 }
      );
    }

    // Convert base64 back to buffer
    const buffer = Buffer.from(imageBuffer, 'base64');

    // Get upload keypair from environment
    const uploadPrivateKey = process.env.IRYS_PRIVATE_KEY;
    if (!uploadPrivateKey) {
      throw new Error('IRYS_PRIVATE_KEY not configured');
    }

    const keypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(uploadPrivateKey))
    );

    // Upload to Irys
    const irysService = new IrysUploadService(keypair);
    const uploadResult = await irysService.uploadImage(buffer, contentType || 'image/png');

    return NextResponse.json({
      success: true,
      imageUrl: uploadResult.url,
      uploadId: uploadResult.id,
      size: uploadResult.size
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