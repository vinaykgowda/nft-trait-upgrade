import { NextRequest, NextResponse } from 'next/server';
import { SessionService } from '@/lib/auth/session';
import { TraitVoucherRepository } from '@/lib/repositories/trait-vouchers';
import { UserProfileRepository } from '@/lib/repositories/user-profiles';
import { AuditLogRepository } from '@/lib/repositories/audit-logs';
import { z } from 'zod';

const createVoucherSchema = z.object({
  userId: z.string().uuid(),
  traitId: z.string().uuid(),
  slotId: z.string().uuid(),
  rarityTierId: z.string().uuid(),
});

// List vouchers
export async function GET(request: NextRequest) {
  const session = await SessionService.getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const voucherRepo = new TraitVoucherRepository();
  const [vouchers, total] = await Promise.all([
    voucherRepo.findWithDetails({ status, limit, offset }),
    voucherRepo.countWithFilters({ status }),
  ]);

  return NextResponse.json({ vouchers, total, limit, offset });
}

// Create voucher
export async function POST(request: NextRequest) {
  const session = await SessionService.getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { userId, traitId, slotId, rarityTierId } = createVoucherSchema.parse(body);

    const voucherRepo = new TraitVoucherRepository();
    const auditRepo = new AuditLogRepository();

    // Generate unique 12-char code
    let code: string;
    let attempts = 0;
    do {
      code = TraitVoucherRepository.generateCode();
      const existing = await voucherRepo.findByCode(code);
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return NextResponse.json({ error: 'Failed to generate unique code' }, { status: 500 });
    }

    const voucher = await voucherRepo.create({
      code,
      user_id: userId,
      trait_id: traitId,
      slot_id: slotId,
      rarity_tier_id: rarityTierId,
      status: 'active',
      created_by: session.userId,
    } as any);

    await auditRepo.logAction('admin', 'voucher_created', {
      actorId: session.userId,
      payload: { voucherId: voucher.id, code, userId, traitId },
    });

    // Fetch with details for response
    const detailed = await voucherRepo.findByCode(code);

    return NextResponse.json({ voucher: detailed }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('Create voucher error:', error);
    return NextResponse.json({ error: 'Failed to create voucher' }, { status: 500 });
  }
}
