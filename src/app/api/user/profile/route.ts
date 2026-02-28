import { NextRequest, NextResponse } from 'next/server';
import { UserSessionService } from '@/lib/auth/user-session';
import { UserProfileRepository } from '@/lib/repositories/user-profiles';
import { UserLinkedWalletRepository } from '@/lib/repositories/user-linked-wallets';

export async function GET(request: NextRequest) {
  const session = await UserSessionService.getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const profileRepo = new UserProfileRepository();
  const walletRepo = new UserLinkedWalletRepository();

  const profile = await profileRepo.findById(session.userId);
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const wallets = await walletRepo.findByUserId(session.userId);

  return NextResponse.json({
    profile: {
      id: profile.id,
      discordId: profile.discord_id,
      discordUsername: profile.discord_username,
      discordDisplayName: profile.discord_display_name,
      discordAvatar: profile.discord_avatar,
      discordServers: profile.discord_servers || [],
      createdAt: profile.created_at,
    },
    wallets: wallets.map(w => ({
      id: w.id,
      walletAddress: w.wallet_address,
      label: w.label,
      verified: w.verified,
      createdAt: w.created_at,
    })),
  });
}
