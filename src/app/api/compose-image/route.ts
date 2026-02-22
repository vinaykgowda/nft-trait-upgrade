import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { ImageCompositionService } from '@/lib/services/image-composition';
import { HeliusService } from '@/lib/services/helius';

import { TraitRepository } from '@/lib/repositories/traits';
import { getTraitSlotRepository } from '@/lib/repositories';

import type { Trait, TraitSlot } from '@/types';

type TraitSelection = Record<string, Trait>;

const schema = z.object({
  baseImageUrl: z.string().url(),
  assetId: z.string().min(32),
  selectedTraits: z.union([z.record(z.any()), z.array(z.string())]),
  width: z.number().optional(),
  height: z.number().optional(),
  format: z.enum(['png', 'jpeg', 'webp']).optional(),
  quality: z.number().optional(),
  forceTransparentBase: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());

    console.log('🎨 Compose-image API received:', {
      baseImageUrl: body.baseImageUrl,
      selectedTraits: Array.isArray(body.selectedTraits) ? body.selectedTraits : Object.keys(body.selectedTraits),
      assetId: body.assetId,
    });

    const traitRepo = new TraitRepository();
    const slotRepo = getTraitSlotRepository();

    // 1) Load all slots ordered by layer
    const slotRows = await slotRepo.findAllOrdered();
    const slots: TraitSlot[] = slotRows.map(r => slotRepo.toDomain(r));
    console.log('📋 Slots loaded:', slots.map(s => `${s.name}(order=${s.layerOrder})`));

    // 2) Load ALL traits from DB with relations (so we have slot_name, image_layer_url etc.)
    const allTraitRows = await traitRepo.findWithRelations({});
    const allTraits = allTraitRows.map(r => traitRepo.toDomain(r));
    console.log(`📦 Total traits in DB: ${allTraits.length}`);

    // Build lookup: slotName -> traitName -> Trait
    const traitLookup = new Map<string, Map<string, Trait>>();
    for (const trait of allTraits) {
      const slotRow = allTraitRows.find(r => r.id === trait.id);
      const slotName = slotRow?.slot_name || '';
      if (!slotName) continue;
      if (!traitLookup.has(slotName)) traitLookup.set(slotName, new Map());
      traitLookup.get(slotName)!.set(trait.name, trait);
    }

    // 3) Resolve override traits (the newly selected ones)
    let overrideTraits: TraitSelection = {};

    if (Array.isArray(body.selectedTraits)) {
      const traitIds = body.selectedTraits;
      for (const id of traitIds) {
        const found = allTraits.find(t => t.id === id);
        if (found) overrideTraits[found.slotId] = found;
      }
      console.log('✅ Resolved override traits from IDs:', Object.keys(overrideTraits).length);
    } else {
      overrideTraits = body.selectedTraits as TraitSelection;
      console.log('✅ Using TraitSelection object directly');
    }

    // 4) Fetch NFT's current attributes from Helius
    const nft = await HeliusService.getNFTMetadata(body.assetId);
    if (!nft?.attributes?.length) {
      throw new Error(`Unable to fetch NFT metadata attributes for assetId=${body.assetId}`);
    }

    // 5) Build baseTraits from NFT attributes by looking up in our full trait list
    const baseTraits: TraitSelection = {};
    const overrideSlotIds = new Set(Object.keys(overrideTraits));

    for (const attr of nft.attributes) {
      const traitType = attr?.trait_type;
      const value = String(attr?.value ?? '');

      if (!traitType || !value) continue;
      if (traitType === 'Rarity Rank' || traitType === 'Special') continue;
      if (value === 'Blank') continue;

      // Find the slot for this trait type
      const slot = slots.find(s => s.name === traitType);
      if (!slot) {
        console.log(`  ⚠️ No slot found for trait_type: ${traitType}`);
        continue;
      }

      // Skip if user is overriding this slot
      if (overrideSlotIds.has(slot.id)) {
        console.log(`  ⏭️ Skipping ${traitType}=${value} (being overridden)`);
        continue;
      }

      // Look up trait in our DB
      const slotTraits = traitLookup.get(traitType);
      const found = slotTraits?.get(value);

      if (found) {
        baseTraits[found.slotId] = found;
        console.log(`  ✅ Base trait: ${traitType}=${value} -> ${found.imageLayerUrl}`);
      } else {
        console.log(`  ⚠️ Trait not in DB: ${traitType}=${value} (available in ${traitType}: ${slotTraits ? [...slotTraits.keys()].join(', ') : 'none'})`);
      }
    }

    console.log(`📊 Base traits: ${Object.keys(baseTraits).length}, Override traits: ${Object.keys(overrideTraits).length}`);

    // 6) Compose image with baseTraits + overrideTraits
    const composer = new ImageCompositionService();

    const result = await composer.composeImage(
      body.baseImageUrl,
      overrideTraits,
      slots,
      {
        width: body.width || 1500,
        height: body.height || 1500,
        format: body.format || 'webp',
        quality: body.quality || 90,
        forceTransparentBase: body.forceTransparentBase ?? true,
        baseTraits,
      }
    );

    return NextResponse.json({
      success: true,
      width: result.width,
      height: result.height,
      format: result.format,
      imageBuffer: result.imageBuffer.toString('base64'),
    });
  } catch (e: any) {
    console.error('❌ compose-image failed:', e);
    return NextResponse.json(
      { success: false, error: e?.message || 'compose-image failed' },
      { status: 500 }
    );
  }
}
