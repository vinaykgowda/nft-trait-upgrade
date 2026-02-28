import { NextRequest, NextResponse } from 'next/server';
import { UserSessionService } from '@/lib/auth/user-session';
import { TraitVoucherRepository } from '@/lib/repositories/trait-vouchers';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const applyVoucherSchema = z.object({
  code: z.string().length(12),
  traitId: z.string().uuid(),
});

// Validate and apply a voucher code during checkout — requires Discord session
export async function POST(request: NextRequest) {
  const session = await UserSessionService.getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'You need to login with Discord to proceed' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { code, traitId } = applyVoucherSchema.parse(body);

    const voucherRepo = new TraitVoucherRepository();
    const voucher = await voucherRepo.findByCode(code.toUpperCase());

    if (!voucher) {
      return NextResponse.json({ error: 'Invalid Code' }, { status: 404 });
    }

    if (voucher.status !== 'active') {
      return NextResponse.json({ error: `Voucher has already been ${voucher.status}` }, { status: 400 });
    }

    if (voucher.user_id !== session.userId) {
      return NextResponse.json({ error: 'This voucher is not assigned to your account' }, { status: 403 });
    }

    if (voucher.trait_id !== traitId) {
      return NextResponse.json({
        error: 'This voucher is for a different trait',
        voucherTrait: voucher.trait_name,
        voucherSlot: voucher.slot_name,
      }, { status: 400 });
    }

    return NextResponse.json({
      valid: true,
      voucher: {
        id: voucher.id,
        code: voucher.code,
        traitName: voucher.trait_name,
        slotName: voucher.slot_name,
        rarityName: voucher.rarity_name,
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid Code' }, { status: 400 });
    }
    console.error('Apply voucher error:', error);
    return NextResponse.json({ error: 'Failed to validate voucher' }, { status: 500 });
  }
}
