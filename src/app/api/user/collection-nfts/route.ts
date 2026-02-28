import { NextRequest, NextResponse } from 'next/server';
import { UserSessionService } from '@/lib/auth/user-session';
import { UserLinkedWalletRepository } from '@/lib/repositories/user-linked-wallets';
import { ProjectRepository } from '@/lib/repositories/projects';
import { createNFTService } from '@/lib/services/nft';

// Fetch NFTs from all linked wallets matching project collections
export async function GET(request: NextRequest) {
  const session = await UserSessionService.getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const walletRepo = new UserLinkedWalletRepository();
    const projectRepo = new ProjectRepository();
    const nftService = createNFTService();

    const wallets = await walletRepo.findByUserId(session.userId);
    if (wallets.length === 0) {
      return NextResponse.json({ nfts: [], walletCount: 0 });
    }

    // Get all project collection IDs
    const projects = await projectRepo.findAll();
    const collectionIds = projects.flatMap(p => p.collection_ids || []);

    // Fetch NFTs from all wallets in parallel
    const nftResults = await Promise.allSettled(
      wallets.map(w => nftService.fetchUserNFTs(w.wallet_address, collectionIds))
    );

    const allNfts = nftResults
      .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);

    // Deduplicate by address
    const seen = new Set<string>();
    const uniqueNfts = allNfts.filter(nft => {
      if (seen.has(nft.address)) return false;
      seen.add(nft.address);
      return true;
    });

    return NextResponse.json({
      nfts: uniqueNfts,
      walletCount: wallets.length,
    });
  } catch (error) {
    console.error('Fetch collection NFTs error:', error);
    return NextResponse.json({ error: 'Failed to fetch NFTs' }, { status: 500 });
  }
}
