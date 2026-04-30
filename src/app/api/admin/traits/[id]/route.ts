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
      earnerToken: trait.earner_token_id ? {
        id: trait.earner_token_id,
        symbol: trait.earner_token_symbol || 'UNKNOWN',
        decimals: trait.earner_token_decimals || 9,
        mintAddress: trait.earner_token_mint_address,
      } : null,
      earnerAmount: trait.earner_amount ? formatDecimalPrice(trait.earner_amount) : null,
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
    const earnerTokenId = formData.get('earnerTokenId') as string | null;
    const earnerAmount = formData.get('earnerAmount') as string | null;
    const applyLimitPerWalletRaw = formData.get('applyLimitPerWallet') as string | null;
    const applyLimitPerWallet = applyLimitPerWalletRaw && applyLimitPerWalletRaw !== ''
      ? parseInt(applyLimitPerWalletRaw)
      : null;

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

    // Handle token ID - support both main tokens and project tokens
    let finalTokenId = priceTokenId;
    
    // Check if this is a project token ID by looking it up
    const { query } = await import('@/lib/database');
    
    // First check if it's already a main token ID
    const mainTokenCheck = await query('SELECT id FROM tokens WHERE id = $1', [priceTokenId]);
    
    if (mainTokenCheck.rows.length === 0) {
      // Not a main token ID, check if it's a project token ID
      const projectTokenCheck = await query(`
        SELECT id, token_address, token_symbol 
        FROM project_tokens 
        WHERE id = $1
      `, [priceTokenId]);
      
      if (projectTokenCheck.rows.length > 0) {
        // It's a valid project token, use it directly
        finalTokenId = priceTokenId;
        console.log(`✅ Using project token ID: ${priceTokenId} (${projectTokenCheck.rows[0].token_symbol})`);
      } else {
        return NextResponse.json({ 
          error: 'Invalid token ID provided' 
        }, { status: 400 });
      }
    } else {
      console.log(`✅ Using main token ID: ${priceTokenId}`);
    }
    
    // Map category to slot ID - look up from database instead of hardcoding
    // Get the actual slot ID for this category
    const slotResult = await query(`
      SELECT id FROM trait_slots 
      WHERE LOWER(name) = LOWER($1) 
      LIMIT 1
    `, [category]);
    
    let slotId: string;
    
    if (slotResult.rows.length > 0) {
      slotId = slotResult.rows[0].id;
      console.log(`✅ Found slot ID for ${category}: ${slotId}`);
    } else {
      // Fallback: try to find any slot that might match
      const fallbackResult = await query(`
        SELECT id, name FROM trait_slots 
        ORDER BY layer_order 
        LIMIT 1
      `);
      
      if (fallbackResult.rows.length > 0) {
        slotId = fallbackResult.rows[0].id;
        console.log(`⚠️ Category "${category}" not found, using fallback slot: ${fallbackResult.rows[0].name} (${slotId})`);
      } else {
        return NextResponse.json({ 
          error: `No trait slots found in database. Please create trait slots first.` 
        }, { status: 400 });
      }
    }

    // Update trait data
    const updateData: any = {
      slot_id: slotId,
      name: traitValue || name,
      image_layer_url: imageUrl,
      rarity_tier_id: rarityTierId,
      total_supply: totalSupply ? parseInt(totalSupply) : existingTrait.total_supply,
      remaining_supply: totalSupply ? parseInt(totalSupply) : existingTrait.remaining_supply,
      price_amount: priceAmount ? priceAmount : existingTrait.price_amount,
      price_token_id: finalTokenId, // Use converted token ID
      active,
      apply_limit_per_wallet: applyLimitPerWallet,
    };

    // Handle earner fields — allow clearing them by passing empty string
    if (earnerTokenId && earnerAmount) {
      updateData.earner_token_id = earnerTokenId;
      updateData.earner_amount = earnerAmount;
    } else {
      updateData.earner_token_id = null;
      updateData.earner_amount = null;
    }

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