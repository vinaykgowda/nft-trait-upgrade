import { NextRequest, NextResponse } from 'next/server';
import { TraitVoucherRepository } from '@/lib/repositories/trait-vouchers';
import { UserLinkedWalletRepository } from '@/lib/repositories/user-linked-wallets';
import { UserSessionService } from '@/lib/auth/user-session';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const schema = z.object({
  voucherId: z.string().uuid(),
  walletAddress: z.string().min(32).max(44),
  voucherCode: z.string().length(12).optional(),
});

// Redeem a voucher after successful trait upgrade — works with session, wallet-based auth, or code knowledge
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { voucherId, walletAddress, voucherCode } = schema.parse(body);

    const voucherRepo = new TraitVoucherRepository();
    const voucher = await voucherRepo.findById(voucherId);
    if (!voucher) {
      return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });
    }

    // Auth: check session first, then wallet ownership, then code knowledge
    let authorized = false;
    const session = await UserSessionService.getSessionFromCookies();
    if (session && session.userId === (voucher as any).user_id) {
      authorized = true;
    }

    if (!authorized) {
      const walletRepo = new UserLinkedWalletRepository();
      const linked = await walletRepo.findByWalletAddress(walletAddress);
      if (linked && linked.user_id === (voucher as any).user_id) {
        authorized = true;
      }
    }

    // If the caller knows the voucher code, they already proved ownership at apply time
    if (!authorized && voucherCode) {
      if ((voucher as any).code === voucherCode) {
        authorized = true;
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: 'Not authorized to redeem this voucher' }, { status: 403 });
    }

    const redeemed = await voucherRepo.redeemVoucher(voucherId, voucherId);
    if (!redeemed) {
      return NextResponse.json({ error: 'Voucher already used or revoked' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('Redeem voucher by code error:', error);
    return NextResponse.json({ error: 'Failed to redeem voucher' }, { status: 500 });
  }
}
