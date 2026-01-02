import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getTraitRepository, getAuditLogRepository } from '@/lib/repositories';
import { query } from '@/lib/database';
import { z } from 'zod';

const bulkTraitSchema = z.object({
  traits: z.array(z.object({
    slotId: z.string().uuid('Invalid slot ID'),
    name: z.string().min(1, 'Trait name is required').max(255),
    imageLayerUrl: z.string().min(1, 'Image URL is required').refine(
      (val) => val.startsWith('/') || val.startsWith('http'),
      'Image URL must be a valid path or URL'
    ), // Accept relative paths or full URLs
    rarityTierId: z.string().uuid('Invalid rarity tier ID').refine(
      (val) => val !== 'undefined' && val !== '',
      'Rarity tier ID cannot be undefined or empty'
    ),
    totalSupply: z.number().int().positive().default(1), // Default to 1 instead of optional
    priceAmount: z.string().regex(/^\d+(\.\d+)?$/, 'Price must be a valid decimal number'),
    priceTokenId: z.string().min(1, 'Token ID is required'), // Allow both UUIDs and addresses temporarily
    active: z.boolean().default(true),
  })),
  bulkSettings: z.object({
    category: z.string().optional(),
    artistWallet: z.string().optional(),
    artistCommission: z.number().min(0).max(50).optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    
    // IMMEDIATE DEBUG: Log exactly what we received
    console.log('🔍 RAW BODY RECEIVED:', JSON.stringify(body, null, 2));
    console.log('🔍 TRAITS RECEIVED:', body.traits?.map((t: any, i: number) => ({
      index: i,
      name: t.name,
      rarityTierId: t.rarityTierId,
      rarityType: typeof t.rarityTierId
    })));
    
    const { traits, bulkSettings } = bulkTraitSchema.parse(body);

    const traitRepo = getTraitRepository();
    const auditRepo = getAuditLogRepository();

    // ENSURE RARITY TIERS EXIST
    const existingRarities = await query('SELECT id, name FROM rarity_tiers ORDER BY display_order');
    
    if (existingRarities.rows.length === 0) {
      await query(`
        INSERT INTO rarity_tiers (id, name, weight, display_order, created_at) VALUES
        ('550e8400-e29b-41d4-a716-446655440001', 'Common', 50, 1, NOW()),
        ('550e8400-e29b-41d4-a716-446655440002', 'Uncommon', 30, 2, NOW()),
        ('550e8400-e29b-41d4-a716-446655440003', 'Rare', 15, 3, NOW()),
        ('550e8400-e29b-41d4-a716-446655440004', 'Legendary', 4, 4, NOW()),
        ('550e8400-e29b-41d4-a716-446655440005', 'Mythic', 1, 5, NOW())
        ON CONFLICT (id) DO NOTHING
      `);
    }

    const createdTraits = [];
    const errors = [];

    // Process each trait
    for (let i = 0; i < traits.length; i++) {
      const traitData = traits[i];
      
      try {
        // CRITICAL FIX: Ensure rarityTierId is never undefined
        if (!traitData.rarityTierId) {
          console.error(`❌ BLOCKING UNDEFINED RARITY for trait ${i}:`, traitData.name);
          console.error('Trait data:', traitData);
          errors.push({
            index: i,
            name: traitData.name,
            error: 'Missing rarity information - please select a rarity for this trait'
          });
          continue; // Skip this trait instead of forcing to Common
        }
        
        // Convert project token ID to main token ID if needed
        let finalTokenId = traitData.priceTokenId;
        
        // Handle special case for 'sol-default' ID
        if (traitData.priceTokenId === 'sol-default') {
          // Find SOL token in database
          let solTokenResult = await query('SELECT id FROM tokens WHERE symbol = $1', ['SOL']);
          
          if (solTokenResult.rows.length === 0) {
            throw new Error('SOL token not found in database. Please ensure tokens are properly initialized.');
          } else {
            finalTokenId = solTokenResult.rows[0].id;
            console.log(`🔄 Converted 'sol-default' to actual SOL token ID: ${finalTokenId}`);
          }
        } else {
          // Check if this is already a valid UUID in the tokens table
          const mainTokenCheck = await query('SELECT id FROM tokens WHERE id = $1', [traitData.priceTokenId]);
          
          if (mainTokenCheck.rows.length === 0) {
            // Not a main token ID, check if it's a project token ID
            const projectTokenCheck = await query(`
              SELECT token_address, token_symbol 
              FROM project_tokens 
              WHERE id = $1
            `, [traitData.priceTokenId]);
            
            if (projectTokenCheck.rows.length > 0) {
              const projectToken = projectTokenCheck.rows[0];
              
              // Find corresponding main token by address/symbol
              const mainTokenLookup = await query(`
                SELECT id FROM tokens 
                WHERE mint_address = $1 OR symbol = $2
              `, [projectToken.token_address, projectToken.token_symbol]);
              
              if (mainTokenLookup.rows.length > 0) {
                finalTokenId = mainTokenLookup.rows[0].id;
                console.log(`🔄 Converted project token ${traitData.priceTokenId} to main token ${finalTokenId}`);
              } else {
                throw new Error(`Token not found in main tokens table: ${projectToken.token_symbol}`);
              }
            } else {
              // Check if it's a token address (legacy support)
              if (traitData.priceTokenId === 'So11111111111111111111111111111111111111112') {
                // This is SOL address, get the SOL token ID from database
                let solTokenResult = await query('SELECT id FROM tokens WHERE symbol = $1', ['SOL']);
                if (solTokenResult.rows.length === 0) {
                  throw new Error('SOL token not found in database. Please ensure tokens are properly initialized.');
                } else {
                  finalTokenId = solTokenResult.rows[0].id;
                }
              } else {
                // Try to look it up as a mint address
                const tokenResult = await query('SELECT id FROM tokens WHERE mint_address = $1', [traitData.priceTokenId]);
                if (tokenResult.rows.length > 0) {
                  finalTokenId = tokenResult.rows[0].id;
                } else {
                  throw new Error(`Invalid token ID or address: ${traitData.priceTokenId}`);
                }
              }
            }
          }
        }

        // Convert price string to proper format for database
        const dbData = {
          ...traitRepo.fromDomain({
            ...traitData,
            priceAmount: parseFloat(traitData.priceAmount), // Convert string to number for DECIMAL column
            priceToken: { id: finalTokenId } as any, // Create minimal token object
          }),
          remaining_supply: traitData.totalSupply,
        };

        // CRITICAL: Verify the rarity tier exists before creating
        const rarityCheck = await query('SELECT id, name FROM rarity_tiers WHERE id = $1', [dbData.rarity_tier_id]);
        console.log(`🔍 Rarity check for ${dbData.rarity_tier_id}:`, {
          query: 'SELECT id, name FROM rarity_tiers WHERE id = $1',
          param: dbData.rarity_tier_id,
          result: rarityCheck.rows,
          rowCount: rarityCheck.rows.length
        });
        
        if (rarityCheck.rows.length === 0) {
          // Let's also check what rarities DO exist
          const allRarities = await query('SELECT id, name FROM rarity_tiers ORDER BY display_order');
          console.log('❌ Available rarities in database:', allRarities.rows);
          throw new Error(`Invalid rarity tier ID: ${dbData.rarity_tier_id}`);
        }

        const newTrait = await traitRepo.create(dbData);
        createdTraits.push(traitRepo.toDomain(newTrait as any));

      } catch (error) {
        console.error(`Error processing trait ${i}:`, error);
        errors.push({
          index: i,
          name: traitData.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Audit log for bulk upload
    await auditRepo.logAction('admin', 'traits_bulk_created', {
      actorId: sessionData.userId,
      payload: {
        totalTraits: traits.length,
        successfulTraits: createdTraits.length,
        failedTraits: errors.length,
        bulkSettings,
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      created: createdTraits,
      errors,
      summary: {
        total: traits.length,
        successful: createdTraits.length,
        failed: errors.length,
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Bulk create traits API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve bulk upload templates or examples
export async function GET(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Return template structure for bulk uploads
    const template = {
      fileNamingFormats: [
        "TraitType/TraitValue.png",
        "TraitType - TraitValue.png", 
        "TraitType_TraitValue.png"
      ],
      supportedFormats: ["PNG", "JPG", "GIF"],
      maxFileSize: "10MB",
      requiredFields: {
        category: "string",
        priceAmount: "string (decimal format, e.g., '0.005')",
        priceTokenId: "uuid",
        totalSupply: "number (optional)",
        active: "boolean"
      },
      optionalFields: {
        artistWallet: "string",
        artistCommission: "number (0-50)"
      },
      example: {
        traits: [
          {
            slotId: "uuid-for-clothes-slot",
            name: "Red Hoodie",
            imageLayerUrl: "https://example.com/red-hoodie.png",
            rarityTierId: "uuid-for-common-rarity",
            totalSupply: 100,
            priceAmount: "0.005", // 0.005 SOL as decimal
            priceTokenId: "uuid-for-sol-token",
            active: true
          }
        ],
        bulkSettings: {
          category: "Clothes",
          artistWallet: "wallet-address-here",
          artistCommission: 5
        }
      }
    };

    return NextResponse.json(template);

  } catch (error) {
    console.error('Get bulk template API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}