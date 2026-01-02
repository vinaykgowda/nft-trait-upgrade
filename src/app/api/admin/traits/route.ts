import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getTraitRepository, getAuditLogRepository } from '@/lib/repositories';
import { ImageStorageService } from '@/lib/services/image-storage';
import { RarityService } from '@/lib/services/rarity';
import { query } from '@/lib/database';
import { z } from 'zod';
import { formatDecimalPrice } from '@/lib/utils';

const traitSchema = z.object({
  slotId: z.string().uuid('Invalid slot ID'),
  name: z.string().min(1, 'Trait name is required').max(255),
  imageLayerUrl: z.string().url('Invalid image URL'),
  rarityTierId: z.string().uuid('Invalid rarity tier ID'),
  totalSupply: z.number().int().positive().optional(),
  remainingSupply: z.number().int().min(0).optional(),
  priceAmount: z.string().regex(/^\d+$/, 'Price must be a valid number'),
  priceTokenId: z.string().uuid('Invalid token ID'),
  active: z.boolean().default(true),
});

const updateTraitSchema = traitSchema.partial();

export async function GET(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get('slotId');
    const rarityTierId = searchParams.get('rarityTierId');
    const tokenId = searchParams.get('tokenId');
    const active = searchParams.get('active');

    const filters: any = {};
    if (slotId) filters.slotId = slotId;
    if (rarityTierId) filters.rarityTierId = rarityTierId;
    if (tokenId) filters.tokenId = tokenId;
    if (active !== null) filters.active = active === 'true';

    const traitRepo = getTraitRepository();
    const traits = await traitRepo.findWithRelations(filters);
    
    // Convert BigInt to string for JSON serialization and add proper structure
    const serializedTraits = traits.map((trait: any) => ({
      id: trait.id,
      slotId: trait.slot_id,
      slotName: trait.slot_name || 'Unknown',
      slotLayerOrder: trait.slot_layer_order || 999,
      name: trait.name,
      imageLayerUrl: trait.image_layer_url,
      rarityTier: {
        id: trait.rarity_tier_id,
        name: trait.rarity_name || 'Common', // Default to Common instead of Unknown
        weight: trait.rarity_weight || 0,
      },
      totalSupply: trait.total_supply,
      remainingSupply: trait.remaining_supply,
      priceAmount: trait.price_amount ? formatDecimalPrice(trait.price_amount) : '0', // Format decimal price
      priceToken: {
        id: trait.price_token_id,
        symbol: trait.token_symbol || 'UNKNOWN',
        decimals: trait.token_decimals || 9,
        mintAddress: trait.token_mint_address,
      },
      active: trait.active,
      createdAt: trait.created_at,
      updatedAt: trait.updated_at,
    }));
    
    return NextResponse.json({
      traits: serializedTraits
    });

  } catch (error) {
    console.error('Get traits API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
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
    const artistWallet = formData.get('artistWallet') as string;
    const artistCommission = formData.get('artistCommission') as string;
    const imageFile = formData.get('image') as File;

    // Basic validation
    if (!name || !traitValue || !priceAmount || !priceTokenId || !totalSupply || !rarityTierId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!imageFile) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 });
    }

    // Validate image
    const imageValidation = ImageStorageService.validateImage(imageFile);
    if (!imageValidation.valid) {
      return NextResponse.json({ error: imageValidation.error }, { status: 400 });
    }

    // Validate image dimensions (1500x1500)
    const dimensionValidation = await ImageStorageService.validateImageDimensions(imageFile);
    if (!dimensionValidation.valid) {
      return NextResponse.json({ error: dimensionValidation.error }, { status: 400 });
    }

    // Get rarity info for folder structure
    const rarity = RarityService.getRarityById(rarityTierId);
    if (!rarity) {
      return NextResponse.json({ error: 'Invalid rarity tier' }, { status: 400 });
    }

    // Store image with organized folder structure
    const imageUrl = await ImageStorageService.storeImage(imageFile, {
      category: category,
      rarity: rarity.name,
      filename: imageFile.name
    });

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

    // Convert project token ID to main token ID if needed
    let finalTokenId = priceTokenId;
    
    // Check if this is a project token ID by looking it up
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
        // Check if it's a token address (legacy support)
        if (priceTokenId === 'So11111111111111111111111111111111111111112') {
          // This is SOL address, get the SOL token ID from database
          const solTokenResult = await query('SELECT id FROM tokens WHERE symbol = $1', ['SOL']);
          if (solTokenResult.rows.length > 0) {
            finalTokenId = solTokenResult.rows[0].id;
          }
        } else {
          // For other tokens, look up by mint address
          const tokenResult = await query('SELECT id FROM tokens WHERE mint_address = $1', [priceTokenId]);
          if (tokenResult.rows.length > 0) {
            finalTokenId = tokenResult.rows[0].id;
          } else {
            return NextResponse.json({ 
              error: 'Invalid token ID or address provided' 
            }, { status: 400 });
          }
        }
      }
    }

    const slotId = categoryToSlotId[category] || categoryToSlotId['Body'];

    const traitRepo = getTraitRepository();
    const auditRepo = getAuditLogRepository();

    // Create trait data
    const traitData = {
      slotId,
      name: traitValue,
      imageLayerUrl: imageUrl,
      rarityTierId,
      totalSupply: parseInt(totalSupply),
      remainingSupply: parseInt(totalSupply),
      priceAmount: priceAmount, // Store as string, not BigInt
      priceTokenId: finalTokenId,
      active,
    };

    // Convert to database format
    const dbData = {
      ...traitRepo.fromDomain(traitData),
      remaining_supply: parseInt(totalSupply),
    };

    const newTrait = await traitRepo.create(dbData);

    // Audit log
    await auditRepo.logAction('admin', 'trait_created', {
      actorId: sessionData.userId,
      payload: {
        traitId: newTrait.id,
        traitName: traitValue,
        category,
        rarity: rarity.name,
        priceAmount,
        totalSupply: parseInt(totalSupply),
        imageUrl,
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    // Return serialized trait
    const serializedTrait = {
      ...traitData,
      priceAmount: formatDecimalPrice(traitData.priceAmount) // Format decimal price
    };

    return NextResponse.json({
      trait: serializedTrait,
      message: 'Trait created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Create trait API error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}