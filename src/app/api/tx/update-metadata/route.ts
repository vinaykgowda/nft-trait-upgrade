import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Connection, Keypair } from '@solana/web3.js';
import { createApiResponse, getRequestId } from '@/lib/api/response';
import { validateRequestBody } from '@/lib/api/validation';
import { HeliusService } from '@/lib/services/helius';
import { getProjectRepository } from '@/lib/repositories';
import { CoreAssetUpdateService } from '@/lib/services/core-asset-update';
import { PinataUploadService } from '@/lib/services/pinata-upload';

const metadataUpdateSchema = z.object({
  walletAddress: z.string().min(32).max(44),
  assetId: z.string().min(32).max(44),
  newImageUrl: z.string().url(),
  newAttributes: z.array(
    z.object({
      trait_type: z.string(),
      value: z.union([z.string(), z.number()]).transform((v) => String(v)),
    })
  ),
  txSignature: z.string().optional(),
});

type TraitAttr = { trait_type: string; value: string | number };

function buildCompleteAttributes(params: {
  existingAttributes: TraitAttr[];
  newAttributes: TraitAttr[];
}): TraitAttr[] {
  const allTraitSlots = [
    'Background', 'Speciality', 'Fur', 'Clothes', 'Hand',
    'Mouth', 'Mask', 'Headwear', 'Eyes', 'Eyewear',
  ];

  const existingMap = new Map<string, TraitAttr>();
  for (const a of params.existingAttributes || []) {
    if (a?.trait_type) existingMap.set(a.trait_type, a);
  }

  const newMap = new Map<string, TraitAttr>();
  for (const a of params.newAttributes || []) {
    if (a?.trait_type) newMap.set(a.trait_type, a);
  }

  const out: TraitAttr[] = [];
  for (const slot of allTraitSlots) {
    if (newMap.has(slot)) {
      out.push({ trait_type: slot, value: newMap.get(slot)!.value });
    } else if (existingMap.has(slot)) {
      out.push({ trait_type: slot, value: existingMap.get(slot)!.value });
    } else {
      out.push({ trait_type: slot, value: 'Blank' });
    }
  }

  const rarity = newMap.get('Rarity Rank') || existingMap.get('Rarity Rank');
  if (rarity) out.push({ trait_type: 'Rarity Rank', value: rarity.value });

  return out;
}

function loadUpdateAuthority(): Keypair {
  // Try UPDATE_AUTHORITY_PRIVATE_KEY first, fall back to SOLANA_DELEGATE_PRIVATE_KEY
  const raw = process.env.UPDATE_AUTHORITY_PRIVATE_KEY || process.env.SOLANA_DELEGATE_PRIVATE_KEY;
  if (!raw) throw new Error('UPDATE_AUTHORITY_PRIVATE_KEY or SOLANA_DELEGATE_PRIVATE_KEY not configured');

  const t = raw.trim();
  if (t.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(t)));
  }
  const bs58 = require('bs58');
  return Keypair.fromSecretKey(bs58.decode(t));
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const apiResponse = createApiResponse(requestId);

  try {
    let requestBody: any;
    try {
      requestBody = await request.json();
      console.log('📥 Raw request body received:', requestBody);
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
      return apiResponse.error('Invalid JSON in request body', 400);
    }

    const body = validateRequestBody(requestBody, metadataUpdateSchema);

    console.log('🎨 Metadata update request received');
    console.log('📝 Request body:', {
      walletAddress: body.walletAddress,
      assetId: body.assetId,
      hasImageUrl: !!body.newImageUrl,
      attributeCount: body.newAttributes.length,
      hasTxSignature: !!body.txSignature,
    });

    // 1) Fetch existing metadata (Helius) so we can merge attributes properly
    const heliusMeta = await HeliusService.getNFTMetadata(body.assetId);

    const existingAttributes: TraitAttr[] =
      (heliusMeta?.attributes as any)?.map((a: any) => ({
        trait_type: a?.trait_type,
        value: a?.value,
      })) || [];

    const mergedAttributes = buildCompleteAttributes({
      existingAttributes,
      newAttributes: body.newAttributes as any,
    });

    // 2) Load project settings from DB
    const projectRepo = getProjectRepository();
    const projects = await projectRepo.findAll();
    const project = projects[0];

    if (!project) {
      return apiResponse.error('No project configured in DB', 500);
    }

    const dbSymbol = project.collection_symbol;
    const dbFee = project.seller_fee_basis_points;
    const dbCreatorAddress = project.creator_address || project.treasury_wallet;

    console.log(`📋 Project from DB: symbol=${dbSymbol}, fee=${dbFee}, creator=${dbCreatorAddress}`);

    // Build OFF-CHAIN metadata JSON
    const metadataJson = {
      name: heliusMeta?.name || `${dbSymbol}`,
      description:
        heliusMeta?.description ||
        'Pepe Gods V2 - Arise from the Ashes, is a refined artistic evolution of the original Pepe Gods collection, created by Pepeverse and supported by a lot of utilities. While the art has been upgraded, the mission remains unchanged - to give back to the community.',
      symbol: dbSymbol,
      seller_fee_basis_points: dbFee,
      image: body.newImageUrl,
      external_url: heliusMeta?.external_url,
      attributes: mergedAttributes,
      properties: {
        files: [{ uri: body.newImageUrl, type: 'image/webp' }],
        category: 'image',
        creators: [{ address: dbCreatorAddress, share: 100 }],
      },
    };

    console.log('🧾 Built metadata JSON:', {
      name: metadataJson.name,
      symbol: metadataJson.symbol,
      seller_fee_basis_points: metadataJson.seller_fee_basis_points,
      totalAttributes: metadataJson.attributes.length,
      image: metadataJson.image,
    });

    // 3) Upload metadata JSON to Pinata IPFS
    const pinata = new PinataUploadService();
    const pinataResult = await pinata.uploadMetadata(metadataJson as any);
    const newMetadataUri = pinataResult.url;

    console.log('✅ Metadata JSON uploaded to Pinata IPFS:', newMetadataUri);

    // 4) Server-side: sign and submit the Core asset URI update
    //    No user wallet signature needed — update authority handles it entirely
    const rpcUrl = process.env.SOLANA_RPC_URL || process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    const updateKeypair = loadUpdateAuthority();

    console.log('🔑 Update authority loaded:', updateKeypair.publicKey.toString());

    const coreService = new CoreAssetUpdateService(connection, updateKeypair);
    const updateResult = await coreService.updateAssetUri(body.assetId, newMetadataUri);

    console.log('✅ Core asset URI updated on-chain:', updateResult.signature);

    return apiResponse.success({
      requestId,
      metadataUri: newMetadataUri,
      metadataCid: pinataResult.cid,
      signature: updateResult.signature,
      onChainUpdate: true,
    });
  } catch (error: any) {
    console.error('❌ Update metadata route failed:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestId,
    });

    return apiResponse.handleError(error, {
      operation: 'update_metadata',
      type: 'metadata_update',
    });
  }
}
