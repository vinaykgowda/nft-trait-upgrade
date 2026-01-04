import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { IrysUploadService } from '@/lib/services/irys-upload';
import { Keypair } from '@solana/web3.js';

export async function POST(request: NextRequest) {
  try {
    const { imageBuffer, contentType, filename, permanent = false } = await request.json();

    if (!imageBuffer) {
      return NextResponse.json(
        { error: 'Missing required field: imageBuffer' },
        { status: 400 }
      );
    }

    // Convert base64 back to buffer
    const buffer = Buffer.from(imageBuffer, 'base64');

    if (permanent) {
      // Use Irys for permanent storage (NFT metadata images)
      console.log('📦 Uploading to Irys for permanent storage...');
      
      const uploadPrivateKey = process.env.IRYS_PRIVATE_KEY;
      if (!uploadPrivateKey) {
        throw new Error('IRYS_PRIVATE_KEY not configured');
      }

      // Check buffer size - if too large, compress or reject
      if (buffer.length > 10 * 1024 * 1024) { // 10MB limit
        return NextResponse.json(
          { error: 'Image too large for permanent storage. Maximum size is 10MB.' },
          { status: 413 }
        );
      }

      const keypair = (() => {
        if (uploadPrivateKey.startsWith('[') && uploadPrivateKey.endsWith(']')) {
          // JSON array format: [123, 45, 67, ...]
          return Keypair.fromSecretKey(new Uint8Array(JSON.parse(uploadPrivateKey)));
        } else {
          // Base58 string format
          const bs58 = require('bs58');
          return Keypair.fromSecretKey(bs58.decode(uploadPrivateKey));
        }
      })();

      try {
        // Upload to Irys for permanent blockchain storage
        const irysService = new IrysUploadService(keypair);
        const uploadResult = await irysService.uploadImage(buffer, contentType || 'image/png');

        console.log(`✅ Image uploaded to Irys (permanent): ${uploadResult.url}`);

        return NextResponse.json({
          success: true,
          imageUrl: uploadResult.url,
          uploadId: uploadResult.id,
          size: uploadResult.size,
          storage: 'irys'
        });
      } catch (irysError) {
        console.error('❌ Irys upload failed, falling back to Vercel Blob:', irysError);
        
        // Fallback to Vercel Blob if Irys fails
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
          throw new Error('Both Irys and Vercel Blob are unavailable');
        }

        const timestamp = Date.now();
        const sanitizedFilename = (filename || 'image.png').replace(/[^a-zA-Z0-9.-]/g, '_');
        const blobFilename = `fallback/${timestamp}_${sanitizedFilename}`;

        const blob = await put(blobFilename, buffer, {
          access: 'public',
          contentType: contentType || 'image/png',
        });

        console.log(`⚠️ Fallback: Image uploaded to Vercel Blob: ${blob.url}`);

        return NextResponse.json({
          success: true,
          imageUrl: blob.url,
          uploadId: blob.pathname,
          size: buffer.length,
          storage: 'vercel-blob-fallback'
        });
      }

    } else {
      // Use Vercel Blob for temporary/intermediate storage
      console.log('📦 Uploading to Vercel Blob for temporary storage...');
      
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return NextResponse.json(
          { error: 'Vercel Blob storage not configured' },
          { status: 500 }
        );
      }

      // Generate filename with timestamp
      const timestamp = Date.now();
      const sanitizedFilename = (filename || 'image.png').replace(/[^a-zA-Z0-9.-]/g, '_');
      const blobFilename = `temp/${timestamp}_${sanitizedFilename}`;

      // Upload to Vercel Blob (for temporary use)
      const blob = await put(blobFilename, buffer, {
        access: 'public',
        contentType: contentType || 'image/png',
      });

      console.log(`✅ Image uploaded to Vercel Blob (temporary): ${blob.url}`);

      return NextResponse.json({
        success: true,
        imageUrl: blob.url,
        uploadId: blob.pathname,
        size: buffer.length,
        storage: 'vercel-blob'
      });
    }

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