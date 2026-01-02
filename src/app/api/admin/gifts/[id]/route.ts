import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getGiftBalanceRepository, getAuditLogRepository } from '@/lib/repositories';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const giftId = params.id;
    const giftRepo = getGiftBalanceRepository();
    const auditRepo = getAuditLogRepository();

    // Get gift details before deletion for audit log
    const gift = await giftRepo.findById(giftId);
    if (!gift) {
      return NextResponse.json({ error: 'Gift not found' }, { status: 404 });
    }

    // Delete the gift
    await giftRepo.delete(giftId);

    // Audit log
    await auditRepo.logAction('admin', 'gift_revoked', {
      actorId: sessionData.userId,
      payload: {
        giftId: giftId,
        walletAddress: gift.wallet_address,
        traitId: gift.trait_id,
        quantity: gift.qty_available,
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete gift API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}