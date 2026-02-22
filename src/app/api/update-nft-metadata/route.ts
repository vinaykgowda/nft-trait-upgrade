import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

import { CoreAssetUpdateService } from '@/lib/services/core-asset-update';
import { PinataUploadService } from '@/lib/services/pinata-upload';
import { NFTMetadata } from '@/types';
import { getTraitSlotRepository, getProjectRepository } from '@/lib/repositories';

const BodySchema = z.object({
  assetId: z.string().min(32),
  newImageUrl: z.string().url(),
  newTraits: z.array(z.any()), // expects items with { slotId, name } at least
  originalTraits: z.array(z.any()).optional(), // expects items like { trait_type, value }
  txSignature: z.string().optional(),
});

function loadUpdateAuthority(): Keypair {
  const raw = process.env.UPDATE_AUTHORITY_PRIVATE_KEY;
  if (!raw) throw new Error('UPDATE_AUTHORITY_PRIVATE_KEY not configured');

  const t = raw.trim();
  if (t.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(t)));
  }
  return Keypair.fromSecretKey(bs58.decode(t));
}

export async function POST(request: NextRequest) {
  try {
    let bodyJson: unknown;
    try {
      bodyJson = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body. Send Content-Type: application/json' },
        { status: 400 }
      );
    }

    const parsed = BodySchema.safeParse(bodyJson);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { assetId, newImageUrl, newTraits, originalTraits, txSignature } = parsed.data;

    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    const updateKeypair = loadUpdateAuthority();

    // Load trait slots (ordered) for consistent attributes
    const traitSlotRepo = getTraitSlotRepository();
    const slots = await traitSlotRepo.findAllOrdered();
    const domainSlots = slots.map(slot => traitSlotRepo.toDomain(slot));

    // Map: slotId -> updatedTrait
    const updatedTraitsBySlotId = new Map<string, any>();
    for (const t of newTraits) {
      if (t?.slotId) updatedTraitsBySlotId.set(t.slotId, t);
    }

    // Map: trait_type -> value (from helius/originalTraits)
    const originalByTraitType = new Map<string, any>();
    if (Array.isArray(originalTraits)) {
      for (const a of originalTraits) {
        if (a?.trait_type) originalByTraitType.set(a.trait_type, a.value);
      }
    }

    // Build complete attributes for ALL slots
    const completeAttributes: Array<{ trait_type: string; value: string }> = [];
    for (const slot of domainSlots) {
      const slotName = slot.name;
      let val = 'Blank';

      const updated = updatedTraitsBySlotId.get(slot.id);
      if (updated?.name) {
        val = updated.name;
      } else if (originalByTraitType.has(slotName)) {
        val = originalByTraitType.get(slotName) ?? 'Blank';
      }

      completeAttributes.push({ trait_type: slotName, value: String(val) });
    }

    // Load project settings from DB (first project — single-project setup)
    const projectRepo = getProjectRepository();
    const projects = await projectRepo.findAll();
    const project = projects[0]; // Use first project

    if (!project) {
      return NextResponse.json(
        { error: 'No project configured. Set up a project in admin first.' },
        { status: 500 }
      );
    }

    const sellerFeeBasisPoints = project.seller_fee_basis_points;
    const collectionSymbol = project.collection_symbol;
    const creatorAddress = project.creator_address || project.treasury_wallet;

    console.log(`📋 Project settings from DB: symbol=${collectionSymbol}, fee=${sellerFeeBasisPoints}, creator=${creatorAddress}`);

    // ✅ Build metadata JSON in your desired format
    const metadata: NFTMetadata = {
      name: `${collectionSymbol} #${assetId.slice(0, 6)}`,
      description:
        `Pepe Gods V2 - Arise from the Ashes, is a refined artistic evolution of the original Pepe Gods collection, created by Pepeverse and supported by a lot of utilities. ` +
        (txSignature ? `Payment Tx: ${txSignature}` : ''),
      symbol: collectionSymbol,
      seller_fee_basis_points: sellerFeeBasisPoints,
      image: newImageUrl,
      external_url: process.env.NEXT_PUBLIC_APP_URL || '',
      attributes: completeAttributes,
      properties: {
        files: [{ uri: newImageUrl, type: 'image/webp' }],
        category: 'image',
        creators: [{ address: creatorAddress, share: 100 }],
      },
    };

    // ✅ Upload metadata JSON to Pinata (returns metadata URI)
    const pinata = new PinataUploadService();
    const metadataResult = await pinata.uploadMetadata(metadata);

    // ✅ Update Core asset URI to the Pinata metadata URL (small tx)
    const core = new CoreAssetUpdateService(connection, updateKeypair);
    const updateResult = await core.updateAssetUri(assetId, metadataResult.url);

    return NextResponse.json({
      success: true,
      assetId,
      metadataUri: metadataResult.url,
      metadataCid: metadataResult.cid,
      updateSignature: updateResult.signature,
      totalAttributes: completeAttributes.length,
      updatedSlotIds: Array.from(updatedTraitsBySlotId.keys()),
    });
  } catch (error: any) {
    console.error('❌ Update metadata route failed:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed', details: String(error) },
      { status: 500 }
    );
  }
}
