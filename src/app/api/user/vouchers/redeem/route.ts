import { NextRequest, NextResponse } from 'next/server';
import { UserSessionService } from '@/lib/auth/user-session';
import { TraitVoucherRepository } from '@/lib/repositories/trait-vouchers';
import { AuditLogRepository } from '@/lib/repositories/audit-logs';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const redeemSchema = z.object({
  voucherId: z.string().uuid(),
  purchaseId: z.string().uuid(),
});

// Redeem a voucher after successful trait upgrade
export async function POST(request: NextRequest) {
  const session = await UserSessionService.getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { voucherId, purchaseId } = redeemSchema.parse(body);

    const voucherRepo = new TraitVoucherRepository();
    const auditRepo = new AuditLogRepository();

    const voucher = await voucherRepo.findById(voucherId);
    if (!voucher) {
      return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });
    }

    if ((voucher as any).user_id !== session.userId) {
      return NextResponse.json({ error: 'Not your voucher' }, { status: 403 });
    }

    const redeemed = await voucherRepo.redeemVoucher(voucherId, purchaseId);
    if (!redeemed) {
      return NextResponse.json({ error: 'Voucher already used or revoked' }, { status: 400 });
    }

    await auditRepo.logAction('user', 'voucher_redeemed', {
      actorId: session.userId,
      payload: { voucherId, purchaseId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('Redeem voucher error:', error);
    return NextResponse.json({ error: 'Failed to redeem voucher' }, { status: 500 });
  }
}
