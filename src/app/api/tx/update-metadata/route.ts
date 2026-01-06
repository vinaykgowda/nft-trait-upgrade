import { NextRequest } from 'next/server';
import { z } from 'zod';
import { TransactionBuilder } from '@/lib/services/transaction-builder';
import { createApiResponse, getRequestId } from '@/lib/api/response';
import { validateRequestBody } from '@/lib/api/validation';
import { HeliusService } from '@/lib/services/helius';
import { IrysUploadService } from '@/lib/services/irys-upload';

const metadataUpdateSchema = z.object({
  walletAddress: z.string().min(32).max(44),
  assetId: z.string().min(32).max(44),

  // This is your newly composed image (can be Irys or Vercel Blob fallback)
  newImageUrl: z.string().url(),

  // Only changed attrs from UI (route will merge with existing into full set)
  newAttributes: z.array(
    z.object({
      trait_type: z.string(),
      value: z.union([z.string(), z.number()]).transform((v) => String(v)),
    })
  ),

  // optional payment signature (you already have this in logs)
  txSignature: z.string().optional(),
});

type TraitAttr = { trait_type: string; value: string | number };

function buildCompleteAttributes(params: {
  existingAttributes: TraitAttr[];
  newAttributes: TraitAttr[];
}): TraitAttr[] {
  const allTraitSlots = [
    'Background',
    'Speciality',
    'Fur',
    'Clothes',
    'Hand',
    'Mouth',
    'Mask',
    'Headwear',
    'Eyes',
    'Eyewear',
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
      continue;
    }
    if (existingMap.has(slot)) {
      out.push({ trait_type: slot, value: existingMap.get(slot)!.value });
      continue;
    }
    out.push({ trait_type: slot, value: 'Blank' });
  }

  const rarity = newMap.get('Rarity Rank') || existingMap.get('Rarity Rank');
  if (rarity) out.push({ trait_type: 'Rarity Rank', value: rarity.value });

  return out;
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const apiResponse = createApiResponse(requestId);

  try {
    const body = await validateRequestBody(request, metadataUpdateSchema);

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

    // 2) Build OFF-CHAIN metadata JSON (your expected format)
    const metadataJson = {
      name: heliusMeta?.name || 'PGV2',
      description:
        heliusMeta?.description ||
        'Pepe Gods V2 - Arise from the Ashes, is a refined artistic evolution of the original Pepe Gods collection, created by Pepeverse and supported by a lot of utilities. While the art has been upgraded, the mission remains unchanged - to give back to the community.',
      symbol: heliusMeta?.symbol || 'PGV2',
      seller_fee_basis_points: heliusMeta?.seller_fee_basis_points ?? 690,
      image: body.newImageUrl,
      external_url: heliusMeta?.external_url,
      attributes: mergedAttributes,
      properties: {
        files: [
          {
            uri: body.newImageUrl,
            type: 'image/jpeg',
          },
        ],
        category: 'image',
        creators:
          (heliusMeta as any)?.properties?.creators ||
          [
            {
              address:
                process.env.NFT_CREATOR_ADDRESS ||
                '6ByScvE5szYLNfVtrgPFEeRvyP5BYuBVUvBSLPxmkNxT',
              share: 100,
            },
          ],
      },
    };

    console.log('🧾 Built metadata JSON:', {
      name: metadataJson.name,
      symbol: metadataJson.symbol,
      totalAttributes: metadataJson.attributes.length,
      image: metadataJson.image,
    });

    // 3) Upload metadata JSON to Irys (THIS is the key fix for tx size)
    const irys = new IrysUploadService();
    const uploaded = await irys.uploadMetadata(metadataJson as any, {
      'X-Request-Id': requestId,
      'X-Asset-Id': body.assetId,
    });

    const newMetadataUri = uploaded.url; // https://gateway.irys.xyz/<id>

    console.log('✅ Metadata JSON uploaded to Irys:', newMetadataUri);

    // 4) Build transaction that updates ONLY the Core asset URI to this metadata URL
    const txBuilder = new TransactionBuilder();

    // NOTE:
    // - We pass newMetadataUri here.
    // - If your TransactionBuilder is not yet updated to accept it,
    //   casting to any avoids TS break.
    const result = await (txBuilder as any).buildMetadataUpdateTransaction({
      walletAddress: body.walletAddress,
      assetId: body.assetId,
      newImageUrl: body.newImageUrl,
      newAttributes: body.newAttributes,
      newMetadataUri, // ✅ critical new field
      txSignature: body.txSignature,
    });

    // Your builder likely returns { transaction, requiresDelegateSignature, delegatePublicKey }
    const tx = result.transaction;
    const serialized = tx
      .serialize({ requireAllSignatures: false })
      .toString('base64');

    return apiResponse.success({
      requestId,
      metadataUri: newMetadataUri,
      transaction: serialized,
      requiresDelegateSignature: result.requiresDelegateSignature ?? true,
      delegatePublicKey: result.delegatePublicKey ?? undefined,
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
