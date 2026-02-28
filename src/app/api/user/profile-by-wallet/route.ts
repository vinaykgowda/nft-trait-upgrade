import { NextRequest, NextResponse } from 'next/server';
import { UserProfileRepository } from '@/lib/repositories/user-profiles';
import { UserLinkedWalletRepository } from '@/lib/repositories/user-linked-wallets';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get('wallet');
  if (!walletAddress) {
    return NextResponse.json({ error: 'wallet param required' }, { status: 400 });
  }

  const walletRepo = new UserLinkedWalletRepository();
  const linked = await walletRepo.findByWalletAddress(walletAddress);
  if (!linked) {
    return NextResponse.json({ profile: null });
  }

  const profileRepo = new UserProfileRepository();
  const profile = await profileRepo.findById(linked.user_id);
  if (!profile) {
    return NextResponse.json({ profile: null });
  }

  const wallets = await walletRepo.findByUserId(profile.id);

  return NextResponse.json({
    profile: {
      id: profile.id,
      discordId: profile.discord_id,
      discordUsername: profile.discord_username,
      discordDisplayName: profile.discord_display_name,
      discordAvatar: profile.discord_avatar,
      discordServers: profile.discord_servers || [],
    },
    wallets: wallets.map(w => ({
      id: w.id,
      walletAddress: w.wallet_address,
      label: w.label,
    })),
  });
}
