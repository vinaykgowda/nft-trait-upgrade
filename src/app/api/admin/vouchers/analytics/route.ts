import { NextRequest, NextResponse } from 'next/server';
import { SessionService } from '@/lib/auth/session';
import { TraitVoucherRepository } from '@/lib/repositories/trait-vouchers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await SessionService.getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const voucherRepo = new TraitVoucherRepository();
  const analytics = await voucherRepo.getAnalytics();

  return NextResponse.json(analytics);
}
