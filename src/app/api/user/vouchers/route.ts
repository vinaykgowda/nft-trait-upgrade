import { NextRequest, NextResponse } from 'next/server';
import { UserSessionService } from '@/lib/auth/user-session';
import { TraitVoucherRepository } from '@/lib/repositories/trait-vouchers';

// Get user's vouchers
export async function GET(request: NextRequest) {
  const session = await UserSessionService.getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const voucherRepo = new TraitVoucherRepository();
  const vouchers = await voucherRepo.findWithDetails({ userId: session.userId });

  return NextResponse.json({
    vouchers: vouchers.map(v => ({
      id: v.id,
      code: v.code,
      traitName: v.trait_name,
      slotName: v.slot_name,
      rarityName: v.rarity_name,
      status: v.status,
      redeemedAt: v.redeemed_at,
      createdAt: v.created_at,
    })),
  });
}
