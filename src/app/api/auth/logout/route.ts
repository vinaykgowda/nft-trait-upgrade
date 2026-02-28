import { NextResponse } from 'next/server';
import { UserSessionService } from '@/lib/auth/user-session';

export async function POST() {
  UserSessionService.clearSessionCookie();
  return NextResponse.json({ success: true });
}
