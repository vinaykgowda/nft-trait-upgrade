import { NextRequest, NextResponse } from 'next/server';
import { createNFTService } from '@/lib/services/nft';
import { getProjectRepository } from '@/lib/repositories';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Get project configuration to get allowed collection IDs
    const projectRepo = getProjectRepository();
    const projects = await projectRepo.findAll();
    
    if (projects.length === 0) {
      return NextResponse.json(
        { error: 'No project configuration found' },
        { status: 500 }
      );
    }

    const project = projects[0]; // Assuming single project for now
    const domainProject = projectRepo.toDomain(project);
    const collectionIds = domainProject.collectionIds || [];

    if (collectionIds.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch NFTs for the wallet
    const nftService = createNFTService();
    const nfts = await nftService.fetchUserNFTs(walletAddress, collectionIds);

    return NextResponse.json(nfts);
  } catch (error) {
    console.error('Error fetching user NFTs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch NFTs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, assetId } = body;

    if (!walletAddress || !assetId) {
      return NextResponse.json(
        { error: 'Wallet address and asset ID are required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const nftService = createNFTService();
    const isOwner = await nftService.verifyOwnership(walletAddress, assetId);

    return NextResponse.json({ isOwner });
  } catch (error) {
    console.error('Error verifying ownership:', error);
    return NextResponse.json(
      { error: 'Failed to verify ownership' },
      { status: 500 }
    );
  }
}