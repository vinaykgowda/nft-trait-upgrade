import { NextRequest, NextResponse } from 'next/server';
import { UserSessionService } from '@/lib/auth/user-session';
import { UserLinkedWalletRepository } from '@/lib/repositories/user-linked-wallets';
import { z } from 'zod';

const linkWalletSchema = z.object({
  walletAddress: z.string().min(32).max(44),
  label: z.string().max(100).optional(),
});

// Link a wallet
export async function POST(request: NextRequest) {
  const session = await UserSessionService.getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { walletAddress, label } = linkWalletSchema.parse(body);

    const walletRepo = new UserLinkedWalletRepository();

    // Check if wallet is already linked to another user
    const existing = await walletRepo.findByWalletAddress(walletAddress);
    if (existing) {
      if (existing.user_id === session.userId) {
        return NextResponse.json({ error: 'Wallet already linked to your profile' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Wallet is linked to another user' }, { status: 409 });
    }

    const wallet = await walletRepo.linkWallet(session.userId, walletAddress, label);

    return NextResponse.json({
      wallet: {
        id: wallet.id,
        walletAddress: wallet.wallet_address,
        label: wallet.label,
        verified: wallet.verified,
        createdAt: wallet.created_at,
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('Link wallet error:', error);
    return NextResponse.json({ error: 'Failed to link wallet' }, { status: 500 });
  }
}

// Unlink a wallet
export async function DELETE(request: NextRequest) {
  const session = await UserSessionService.getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const walletId = searchParams.get('id');
  if (!walletId) {
    return NextResponse.json({ error: 'Wallet ID required' }, { status: 400 });
  }

  const walletRepo = new UserLinkedWalletRepository();
  const removed = await walletRepo.unlinkWallet(walletId, session.userId);

  if (!removed) {
    return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
