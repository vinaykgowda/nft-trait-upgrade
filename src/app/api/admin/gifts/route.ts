import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getGiftBalanceRepository, getTraitRepository, getAuditLogRepository } from '@/lib/repositories';
import { z } from 'zod';

const giftSchema = z.object({
  walletAddress: z.string().min(32).max(44, 'Invalid wallet address'),
  traitId: z.string().uuid('Invalid trait ID'),
  quantity: z.number().int().positive('Quantity must be positive'),
  mfaToken: z.string().length(6, 'MFA token must be 6 digits'),
});

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
    const walletAddress = searchParams.get('walletAddress');
    const traitId = searchParams.get('traitId');

    const filters: any = {};
    if (walletAddress) filters.walletAddress = walletAddress;
    if (traitId) filters.traitId = traitId;

    const giftRepo = getGiftBalanceRepository();
    const gifts = await giftRepo.findWithTraitDetails(filters);
    
    return NextResponse.json({
      gifts: gifts.map((gift: any) => giftRepo.toDomain(gift))
    });

  } catch (error) {
    console.error('Get gifts API error:', error);
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

    const body = await request.json();
    const giftData = giftSchema.parse(body);

    // Verify MFA for sensitive operation
    const mfaValid = await authService.verifyMFAToken(sessionData.userId, giftData.mfaToken);
    if (!mfaValid) {
      return NextResponse.json({ error: 'Invalid MFA token' }, { status: 400 });
    }

    // Verify trait exists and is active
    const traitRepo = getTraitRepository();
    const trait = await traitRepo.findById(giftData.traitId);
    if (!trait || !trait.active) {
      return NextResponse.json({ error: 'Trait not found or inactive' }, { status: 400 });
    }

    const giftRepo = getGiftBalanceRepository();
    const auditRepo = getAuditLogRepository();

    // Check if gift balance already exists for this wallet/trait combination
    const existingGift = await giftRepo.findByWalletAndTrait(giftData.walletAddress, giftData.traitId);
    
    let result;
    if (existingGift) {
      // Update existing gift balance
      result = await giftRepo.updateQuantity(
        existingGift.id, 
        existingGift.qty_available + giftData.quantity
      );
    } else {
      // Create new gift balance
      const dbData = giftRepo.fromDomain({
        walletAddress: giftData.walletAddress,
        traitId: giftData.traitId,
        qtyAvailable: giftData.quantity,
      });
      result = await giftRepo.create(dbData);
    }

    // Audit log
    await auditRepo.logAction('admin', 'gift_created', {
      actorId: sessionData.userId,
      payload: {
        walletAddress: giftData.walletAddress,
        traitId: giftData.traitId,
        traitName: trait.name,
        quantity: giftData.quantity,
        action: existingGift ? 'updated' : 'created',
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      gift: giftRepo.toDomain(result)
    }, { status: 201 });

  } catch (error) {
    console.error('Create gift API error:', error);
    
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