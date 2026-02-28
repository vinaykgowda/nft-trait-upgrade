import { NextRequest, NextResponse } from 'next/server';
import { SessionService } from '@/lib/auth/session';
import { UserProfileRepository } from '@/lib/repositories/user-profiles';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await SessionService.getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';

  const profileRepo = new UserProfileRepository();
  const users = q
    ? await profileRepo.searchByUsername(q, 20)
    : await profileRepo.getAllUsernames();

  return NextResponse.json({
    users: users.map(u => ({
      id: (u as any).id,
      discordUsername: (u as any).discord_username,
    })),
  });
}
