import { NextRequest, NextResponse } from 'next/server';
import { formatDecimalPrice } from '@/lib/utils';
import { authService } from '@/lib/auth';
import { getTraitRepository, getAuditLogRepository } from '@/lib/repositories';
import { ImageStorageService } from '@/lib/services/image-storage';
import { RarityService } from '@/lib/services/rarity';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const traitRepo = getTraitRepository();
    const traits = await traitRepo.findWithRelations({ slotId: undefined });
    const trait = traits.find(t => t.id === params.id);

    if (!trait) {
      return NextResponse.json({ error: 'Trait not found' }, { status: 404 });
    }

    // Serialize the trait
    const serializedTrait = {
      id: trait.id,
      slotId: trait.slot_id,
      slotName: trait.slot_name,
      slotLayerOrder: trait.slot_layer_order,
      name: trait.name,
      imageLayerUrl: trait.image_layer_url,
      rarityTier: {
        id: trait.rarity_tier_id,
        name: trait.rarity_name,
        weight: trait.rarity_weight,
      },
      totalSupply: trait.total_supply,
      remainingSupply: trait.remaining_supply,
      priceAmount: trait.price_amount ? formatDecimalPrice(trait.price_amount.toString()) : '0',
      priceToken: {
        id: trait.price_token_id,
        symbol: trait.token_symbol,
        decimals: trait.token_decimals,
        mintAddress: trait.token_mint_address,
      },
      active: trait.active,
      createdAt: trait.created_at,
      updatedAt: trait.updated_at,
    };

    return NextResponse.json({ trait: serializedTrait });

  } catch (error) {
    console.error('Get trait API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const traitRepo = getTraitRepository();
    const auditRepo = getAuditLogRepository();

    // Check if trait exists
    const existingTrait = await traitRepo.findById(params.id);
    if (!existingTrait) {
      return NextResponse.json({ error: 'Trait not found' }, { status: 404 });
    }

    // Handle FormData from frontend
    const formData = await request.formData();
    
    // Extract form fields
    const name = formData.get('name') as string;
    const traitValue = formData.get('traitValue') as string;
    const category = formData.get('category') as string;
    const rarityTierId = formData.get('rarityTierId') as string;
    const priceAmount = formData.get('priceAmount') as string;
    const priceTokenId = formData.get('priceTokenId') as string;
    const totalSupply = formData.get('totalSupply') as string;
    const active = formData.get('active') === 'true';
    const imageFile = formData.get('image') as File | null;

    let imageUrl = existingTrait.image_layer_url; // Keep existing image by default

    // If new image is provided, validate and store it
    if (imageFile && imageFile.size > 0) {
      const imageValidation = ImageStorageService.validateImage(imageFile);
      if (!imageValidation.valid) {
        return NextResponse.json({ error: imageValidation.error }, { status: 400 });
      }

      const dimensionValidation = await ImageStorageService.validateImageDimensions(imageFile);
      if (!dimensionValidation.valid) {
        return NextResponse.json({ error: dimensionValidation.error }, { status: 400 });
      }

      // Get rarity info for folder structure
      const rarity = RarityService.getRarityById(rarityTierId);
      if (!rarity) {
        return NextResponse.json({ error: 'Invalid rarity tier' }, { status: 400 });
      }

      // Delete old image if it exists and is our file
      if (existingTrait.image_layer_url) {
        await ImageStorageService.deleteImage(existingTrait.image_layer_url);
      }

      // Store new image
      imageUrl = await ImageStorageService.storeImage(imageFile, {
        category: category,
        rarity: rarity.name,
        filename: imageFile.name
      });
    }

    // Convert project token ID to main token ID if needed
    let finalTokenId = priceTokenId;
    
    // Check if this is a project token ID by looking it up
    const { query } = await import('@/lib/database');
    
    // First check if it's already a main token ID
    const mainTokenCheck = await query('SELECT id FROM tokens WHERE id = $1', [priceTokenId]);
    
    if (mainTokenCheck.rows.length === 0) {
      // Not a main token ID, check if it's a project token ID
      const projectTokenCheck = await query(`
        SELECT token_address, token_symbol 
        FROM project_tokens 
        WHERE id = $1
      `, [priceTokenId]);
      
      if (projectTokenCheck.rows.length > 0) {
        const projectToken = projectTokenCheck.rows[0];
        
        // Find corresponding main token by address/symbol
        const mainTokenLookup = await query(`
          SELECT id FROM tokens 
          WHERE mint_address = $1 OR symbol = $2
        `, [projectToken.token_address, projectToken.token_symbol]);
        
        if (mainTokenLookup.rows.length > 0) {
          finalTokenId = mainTokenLookup.rows[0].id;
          console.log(`🔄 Converted project token ${priceTokenId} to main token ${finalTokenId}`);
        } else {
          return NextResponse.json({ 
            error: `Token not found in main tokens table. Please contact admin to add ${projectToken.token_symbol} token.` 
          }, { status: 400 });
        }
      } else {
        return NextResponse.json({ 
          error: 'Invalid token ID provided' 
        }, { status: 400 });
      }
    }
    // Map category to slot ID - using actual database slot IDs
    const categoryToSlotId: Record<string, string> = {
      'Background': 'f66d1416-627a-4bfe-8a5d-3955c54cd7bb', // Background
      'Speciality': 'fec12edb-9d95-4bf2-a1af-ee71107ffbd6', // Speciality
      'Fur': 'd70ef5d2-32ed-45b5-b3d6-f7332b3bc9e2',        // Fur
      'Clothes': '5f718366-c5e1-4b6a-97ba-a1bb2d159c20',     // Clothes
      'Hand': 'beb44534-2c53-4472-bf15-0ac266f1082a',        // Hand
      'Mouth': '5157637f-3808-4159-8cfc-4cb3dc6cc243',       // Mouth
      'Mask': 'fcd3a481-ce27-4dfb-a1f3-1598fc3f8d40',        // Mask
      'Headwear': 'ad761fe9-e5fd-49c9-a627-5171898d1323',    // Headwear
      'Eyes': '39438a80-00e1-4328-887d-409e99684502',        // Eyes
      'Eyewear': 'cf7b87d3-4be8-4ef0-b1e1-bd6f05e20d01',     // Eyewear
      // Legacy mappings for backward compatibility
      'Body': 'd70ef5d2-32ed-45b5-b3d6-f7332b3bc9e2',        // Map to Fur
      'Hat': 'ad761fe9-e5fd-49c9-a627-5171898d1323',         // Map to Headwear
    };

    const slotId = categoryToSlotId[category] || categoryToSlotId['Fur']; // Default to Fur instead of Body

    // Update trait data
    const updateData = {
      slot_id: slotId,
      name: traitValue || name,
      image_layer_url: imageUrl,
      rarity_tier_id: rarityTierId,
      total_supply: totalSupply ? parseInt(totalSupply) : existingTrait.total_supply,
      remaining_supply: totalSupply ? parseInt(totalSupply) : existingTrait.remaining_supply,
      price_amount: priceAmount ? priceAmount : existingTrait.price_amount,
      price_token_id: finalTokenId, // Use converted token ID
      active,
    };

    const updatedTrait = await traitRepo.update(params.id, updateData);

    // Audit log
    await auditRepo.logAction('admin', 'trait_updated', {
      actorId: sessionData.userId,
      payload: {
        traitId: params.id,
        traitName: traitValue || name,
        category,
        changes: updateData,
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    // Return serialized trait
    const domainTrait = traitRepo.toDomain(updatedTrait as any);
    const serializedTrait = {
      ...domainTrait,
      priceAmount: formatDecimalPrice(domainTrait.priceAmount.toString())
    };

    return NextResponse.json({
      trait: serializedTrait,
      message: 'Trait updated successfully'
    });

  } catch (error) {
    console.error('Update trait API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const traitRepo = getTraitRepository();
    const auditRepo = getAuditLogRepository();

    // Check if trait exists
    const existingTrait = await traitRepo.findById(params.id);
    if (!existingTrait) {
      return NextResponse.json({ error: 'Trait not found' }, { status: 404 });
    }

    // Delete associated image file
    if (existingTrait.image_layer_url) {
      await ImageStorageService.deleteImage(existingTrait.image_layer_url);
    }

    // Delete trait from database
    await traitRepo.delete(params.id);

    // Audit log
    await auditRepo.logAction('admin', 'trait_deleted', {
      actorId: sessionData.userId,
      payload: {
        traitId: params.id,
        traitName: existingTrait.name,
        imageUrl: existingTrait.image_layer_url,
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      message: 'Trait deleted successfully'
    });

  } catch (error) {
    console.error('Delete trait API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}