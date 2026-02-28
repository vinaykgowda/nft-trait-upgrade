import { NextResponse } from 'next/server';
import { SessionService } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await SessionService.getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
