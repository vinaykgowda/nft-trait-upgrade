import { NextRequest, NextResponse } from 'next/server';
import { UserProfileRepository } from '@/lib/repositories/user-profiles';
import { UserSessionService } from '@/lib/auth/user-session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const storedState = request.cookies.get('discord-oauth-state')?.value;

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(new URL('/profile/login?error=invalid_state', request.url));
  }

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/auth/discord/callback`;

    // Exchange code for token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Discord token exchange failed:', await tokenResponse.text());
      return NextResponse.redirect(new URL('/profile/login?error=token_exchange', request.url));
    }

    const tokenData = await tokenResponse.json();

    // Fetch user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userResponse.json();

    // Fetch user guilds (servers)
    const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const guildsData = await guildsResponse.json();

    const servers = Array.isArray(guildsData)
      ? guildsData.map((g: any) => ({ id: g.id, name: g.name, icon: g.icon }))
      : [];

    // Upsert user profile
    const profileRepo = new UserProfileRepository();
    const profile = await profileRepo.upsertFromDiscord({
      discordId: userData.id,
      discordUsername: userData.username,
      discordDisplayName: userData.global_name || userData.username,
      discordAvatar: userData.avatar
        ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
        : undefined,
      discordServers: servers,
    });

    // Create user session
    const token = await UserSessionService.createSession({
      userId: profile.id,
      discordId: profile.discord_id,
      discordUsername: profile.discord_username,
      discordDisplayName: profile.discord_display_name,
      discordAvatar: profile.discord_avatar,
    });

    const response = NextResponse.redirect(new URL('/profile', request.url));
    UserSessionService.setSessionCookie(token);
    // Clear OAuth state cookie
    response.cookies.set('discord-oauth-state', '', { maxAge: 0, path: '/' });
    return response;
  } catch (error) {
    console.error('Discord OAuth callback error:', error);
    return NextResponse.redirect(new URL('/profile/login?error=server_error', request.url));
  }
}
