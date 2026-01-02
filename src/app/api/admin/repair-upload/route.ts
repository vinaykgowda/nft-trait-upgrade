import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getTraitRepository } from '@/lib/repositories';
import { query } from '@/lib/database';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get database IDs
    const rarityResult = await query('SELECT id, name FROM rarity_tiers WHERE name = $1', ['Common']);
    const slotResult = await query('SELECT id, name FROM trait_slots WHERE name = $1', ['Background']);
    const tokenResult = await query('SELECT id, symbol FROM tokens WHERE symbol = $1', ['SOL']);

    if (rarityResult.rows.length === 0 || slotResult.rows.length === 0 || tokenResult.rows.length === 0) {
      return NextResponse.json({ error: 'Missing required database records' }, { status: 400 });
    }

    const commonRarityId = rarityResult.rows[0].id;
    const backgroundSlotId = slotResult.rows[0].id;
    const solTokenId = tokenResult.rows[0].id;

    // Check for existing images in uploads folder
    const uploadsPath = path.join(process.cwd(), 'uploads/traits/background/common');
    
    let imageFiles = [];
    try {
      const files = await fs.readdir(uploadsPath);
      imageFiles = files.filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'));
    } catch (error) {
      return NextResponse.json({ 
        message: 'No images found in uploads folder',
        path: uploadsPath 
      });
    }

    if (imageFiles.length === 0) {
      return NextResponse.json({ 
        message: 'No image files found',
        path: uploadsPath 
      });
    }

    const traitRepo = getTraitRepository();
    const createdTraits = [];

    // Create traits for each image
    for (const imageFile of imageFiles) {
      const traitName = imageFile.replace(/\.[^/.]+$/, '').replace(/_[a-f0-9]{8}$/, ''); // Remove extension and UUID
      const imageUrl = `/uploads/traits/background/common/${imageFile}`;

      const traitData = {
        slot_id: backgroundSlotId,
        name: traitName,
        image_layer_url: imageUrl,
        rarity_tier_id: commonRarityId,
        total_supply: 100,
        remaining_supply: 100,
        price_amount: '0.005',
        price_token_id: solTokenId,
        active: true
      };

      const newTrait = await traitRepo.create(traitData);
      createdTraits.push(newTrait);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully created ${createdTraits.length} traits from existing images`,
      createdTraits: createdTraits.map(t => ({
        id: t.id,
        name: t.name,
        imageUrl: t.image_layer_url
      }))
    });

  } catch (error) {
    console.error('Repair upload error:', error);
    return NextResponse.json({ error: 'Failed to repair upload' }, { status: 500 });
  }
}