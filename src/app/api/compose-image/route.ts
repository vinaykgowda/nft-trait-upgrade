import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { ImageCompositionService } from '@/lib/services/image-composition';
import { HeliusService } from '@/lib/services/helius';

import { TraitRepository } from '@/lib/repositories/traits';
import { getTraitSlotRepository } from '@/lib/repositories';

import type { Trait, TraitSlot } from '@/types';

// In your codebase, TraitSelection is basically slotId -> Trait
type TraitSelection = Record<string, Trait>;

const schema = z.object({
  baseImageUrl: z.string().url(),
  assetId: z.string().min(32),
  // can be either TraitSelection object or array of trait IDs
  selectedTraits: z.union([z.record(z.any()), z.array(z.string())]),
  width: z.number().optional(),
  height: z.number().optional(),
  format: z.enum(['png', 'jpeg', 'webp']).optional(),
  quality: z.number().optional(),
  forceTransparentBase: z.boolean().optional(),
});

async function getAllSlots(slotRepo: any): Promise<TraitSlot[]> {
  // Try common method names without breaking TS
  const candidates = [
    'findAll',
    'getAll',
    'listAll',
    'getAllSlots',
    'findAllSlots',
    'findActiveSlots',
    'listSlots',
  ];

  for (const m of candidates) {
    if (typeof slotRepo?.[m] === 'function') {
      const result = await slotRepo[m]();
      if (Array.isArray(result)) return result;
    }
  }

  throw new Error(
    'TraitSlotRepository does not expose a supported method to list slots. Expected one of: ' +
      candidates.join(', ')
  );
}

async function resolveTraitsByIds(traitRepo: any, ids: string[]): Promise<Trait[]> {
  // Prefer bulk methods if available
  const traits: Trait[] = [];
  const bulkCandidates = ['findByIds', 'getByIds', 'findManyByIds', 'listByIds'];
  for (const m of bulkCandidates) {
    if (typeof traitRepo?.[m] === 'function') {
      const result = await traitRepo[m](ids);
      if (Array.isArray(result)) return result;
    }
  }

  // Fallback to single lookup
  const singleCandidates = ['findById', 'getById', 'findOneById'];
  for (const id of ids) {
    let trait: Trait | null = null;
    for (const m of singleCandidates) {
      if (typeof traitRepo?.[m] === 'function') {
        trait = await traitRepo[m](id);
        if (trait) break;
      }
    }
    if (trait) traits.push(trait);
  }

  // eslint-disable-next-line no-undef
  return traits;
}

async function findTraitByTypeAndValue(traitRepo: any, traitType: string, value: string): Promise<Trait | null> {
  // Try the new method first
  if (typeof traitRepo?.findBySlotNameAndTraitName === 'function') {
    const row = await traitRepo.findBySlotNameAndTraitName(traitType, value);
    if (row) {
      // Convert row to domain object
      return traitRepo.toDomain({
        ...row,
        slot_name: traitType,
        slot_layer_order: null,
        rarity_name: null,
        rarity_weight: null,
        token_symbol: null,
        token_decimals: null,
      });
    }
  }

  // Fallback to other methods
  const candidates = [
    'findByTraitTypeAndValue',
    'findByTypeAndValue',
    'findBySlotAndValue',
    'findBySlotNameAndValue',
    'findByTraitTypeAndName',
    'findByTypeAndName',
    'findBySlotAndName',
    'findBySlotNameAndName',
    'findByTraitTypeValue', // sometimes compact
  ];

  for (const m of candidates) {
    if (typeof traitRepo?.[m] === 'function') {
      const res = await traitRepo[m](traitType, value);
      if (res) return res;
    }
  }

  // As a last resort, try a generic search API if present
  if (typeof traitRepo?.search === 'function') {
    const res = await traitRepo.search({ traitType, value });
    if (Array.isArray(res) && res.length) return res[0];
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());

    console.log('🎨 Compose-image API received:', {
      baseImageUrl: body.baseImageUrl,
      selectedTraits: Array.isArray(body.selectedTraits) ? body.selectedTraits : Object.keys(body.selectedTraits),
      assetId: body.assetId,
      traitCount: Array.isArray(body.selectedTraits) ? body.selectedTraits.length : Object.keys(body.selectedTraits).length,
    });

    const traitRepo: any = new TraitRepository();
    const slotRepo: any = getTraitSlotRepository();

    // 1) load slot order
    const slots = await getAllSlots(slotRepo);

    // 2) resolve override traits
    let overrideTraits: TraitSelection = {};

    if (Array.isArray(body.selectedTraits)) {
      // resolve IDs -> Trait[]
      const traitIds = body.selectedTraits;
      const resolved = await resolveTraitsByIds(traitRepo, traitIds);

      overrideTraits = {};
      for (const t of resolved) {
        overrideTraits[t.slotId] = t;
      }
      console.log('✅ Resolved override traits from IDs:', Object.keys(overrideTraits));
    } else {
      // already TraitSelection-ish
      overrideTraits = body.selectedTraits as TraitSelection;
      console.log('✅ Using TraitSelection object directly');
    }

    console.log('🎨 Final trait selection for composition:', {
      slotIds: Object.keys(overrideTraits),
      traits: Object.values(overrideTraits).map((t) => ({ name: t.name, slotId: t.slotId })),
    });

    // 3) fetch base traits from Helius (STATIC method!)
    const nft = await HeliusService.getNFTMetadata(body.assetId);
    if (!nft?.attributes?.length) {
      throw new Error(`Unable to fetch NFT metadata attributes for assetId=${body.assetId}`);
    }

    // 4) convert NFT attributes -> baseTraits (slotId -> Trait)
    const baseTraits: TraitSelection = {};

    console.log('🔍 Looking up base traits from NFT attributes:', nft.attributes.map(a => `${a.trait_type}=${a.value}`));

    for (const attr of nft.attributes) {
      const traitType = attr?.trait_type;
      const value = attr?.value;

      if (!traitType || value === undefined || value === null) continue;

      // Skip non-visual attributes
      if (traitType === 'Rarity Rank' || traitType === 'Special') continue;

      const found = await findTraitByTypeAndValue(traitRepo, traitType, String(value));
      if (found) {
        baseTraits[found.slotId] = found;
        console.log(`  ✅ Found base trait: ${traitType}=${value} -> slotId=${found.slotId}, imageUrl=${found.imageLayerUrl}`);
      } else {
        console.log(`  ⚠️ No DB trait found for: ${traitType}=${value} (will be missing from composition)`);
      }
    }

    console.log(`📊 Base traits resolved: ${Object.keys(baseTraits).length} of ${nft.attributes.length} attributes`);

    // 5) compose with baseTraits + overrideTraits
    const composer = new ImageCompositionService();

    const options: any = {
      width: body.width || 1500,  // Default to 1500 for final NFT images
      height: body.height || 1500,  // Default to 1500 for final NFT images
      format: body.format || 'webp',  // Default to 'webp' if not specified
      quality: body.quality || 90,  // Default quality 90
      forceTransparentBase: body.forceTransparentBase ?? true,

      // ✅ this is the key fix your logs asked for
      baseTraits,
    };

    const result = await composer.composeImage(body.baseImageUrl, overrideTraits, slots, options);

    return NextResponse.json({
      success: true,
      width: result.width,
      height: result.height,
      format: result.format,
      imageBuffer: result.imageBuffer.toString('base64'),  // Changed from imageBase64 to imageBuffer
    });
  } catch (e: any) {
    console.error('❌ compose-image failed:', e);
    return NextResponse.json(
      { success: false, error: e?.message || 'compose-image failed' },
      { status: 500 }
    );
  }
}
