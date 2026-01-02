import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getTraitRepository, getAuditLogRepository } from '@/lib/repositories';

export async function POST(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { updates } = await request.json();
    
    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: 'Updates must be an array' }, { status: 400 });
    }

    const traitRepo = getTraitRepository();
    const auditRepo = getAuditLogRepository();

    let updatedCount = 0;
    const results = [];

    for (const update of updates) {
      const { traitId, rarityTierId } = update;
      
      if (!traitId || !rarityTierId) {
        continue;
      }

      try {
        // Update the trait's rarity
        const updatedTrait = await traitRepo.update(traitId, {
          rarity_tier_id: rarityTierId
        });

        if (updatedTrait) {
          updatedCount++;
          results.push({
            traitId,
            rarityTierId,
            success: true
          });
        }
      } catch (error) {
        console.error(`Failed to update trait ${traitId}:`, error);
        results.push({
          traitId,
          rarityTierId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Audit log
    await auditRepo.logAction('admin', 'traits_bulk_rarity_update', {
      actorId: sessionData.userId,
      payload: {
        updatedCount,
        totalRequested: updates.length,
        results
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      updatedCount,
      results
    });

  } catch (error) {
    console.error('Bulk rarity update API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}