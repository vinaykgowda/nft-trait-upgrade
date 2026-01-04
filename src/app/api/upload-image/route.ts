import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { IrysUploadService } from '@/lib/services/irys-upload';
import { Keypair } from '@solana/web3.js';

export async function POST(request: NextRequest) {
  try {
    const { imageBuffer, contentType, filename, permanent = true } = await request.json();

    if (!imageBuffer) {
      return NextResponse.json(
        { error: 'Missing required field: imageBuffer' },
        { status: 400 }
      );
    }

    // Convert base64 back to buffer
    const buffer = Buffer.from(imageBuffer, 'base64');

    console.log(`📦 Uploading image (${buffer.length} bytes, permanent: ${permanent})`);

    // For large images or if Irys fails, use Vercel Blob as primary
    // Vercel Blob handles large files much better than Irys
    if (buffer.length > 5 * 1024 * 1024 || !permanent) { // 5MB threshold or non-permanent
      console.log('📦 Using Vercel Blob for large/temporary image...');
      
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return NextResponse.json(
          { error: 'Vercel Blob storage not configured' },
          { status: 500 }
        );
      }

      const timestamp = Date.now();
      const sanitizedFilename = (filename || 'image.jpg').replace(/[^a-zA-Z0-9.-]/g, '_');
      const blobFilename = permanent ? `nft/${timestamp}_${sanitizedFilename}` : `temp/${timestamp}_${sanitizedFilename}`;

      const blob = await put(blobFilename, buffer, {
        access: 'public',
        contentType: contentType || 'image/jpeg',
      });

      console.log(`✅ Image uploaded to Vercel Blob: ${blob.url}`);

      return NextResponse.json({
        success: true,
        imageUrl: blob.url,
        uploadId: blob.pathname,
        size: buffer.length,
        storage: 'vercel-blob'
      });
    }

    // Try Irys for smaller images only
    console.log('📦 Attempting Irys upload for smaller image...');
    
    const uploadPrivateKey = process.env.IRYS_PRIVATE_KEY;
    if (!uploadPrivateKey) {
      console.warn('⚠️ IRYS_PRIVATE_KEY not configured, falling back to Vercel Blob');
      
      // Fallback to Vercel Blob
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        throw new Error('Both Irys and Vercel Blob are unavailable');
      }

      const timestamp = Date.now();
      const sanitizedFilename = (filename || 'image.jpg').replace(/[^a-zA-Z0-9.-]/g, '_');
      const blobFilename = `nft/${timestamp}_${sanitizedFilename}`;

      const blob = await put(blobFilename, buffer, {
        access: 'public',
        contentType: contentType || 'image/jpeg',
      });

      console.log(`✅ Fallback: Image uploaded to Vercel Blob: ${blob.url}`);

      return NextResponse.json({
        success: true,
        imageUrl: blob.url,
        uploadId: blob.pathname,
        size: buffer.length,
        storage: 'vercel-blob-fallback'
      });
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
      const uploadResult = await irysService.uploadImage(buffer, contentType || 'image/jpeg');

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
      const sanitizedFilename = (filename || 'image.jpg').replace(/[^a-zA-Z0-9.-]/g, '_');
      const blobFilename = `nft/${timestamp}_${sanitizedFilename}`;

      const blob = await put(blobFilename, buffer, {
        access: 'public',
        contentType: contentType || 'image/jpeg',
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