import { NextRequest, NextResponse } from 'next/server';
import { SessionService } from '@/lib/auth/session';
import { TraitVoucherRepository } from '@/lib/repositories/trait-vouchers';
import { AuditLogRepository } from '@/lib/repositories/audit-logs';
import { z } from 'zod';

const updateVoucherSchema = z.object({
  userId: z.string().uuid().optional(),
  traitId: z.string().uuid().optional(),
  slotId: z.string().uuid().optional(),
  rarityTierId: z.string().uuid().optional(),
});

// Update voucher
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await SessionService.getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const voucherRepo = new TraitVoucherRepository();
    const auditRepo = new AuditLogRepository();

    const existing = await voucherRepo.findById(params.id);
    if (!existing) {
      return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });
    }
    if ((existing as any).status !== 'active') {
      return NextResponse.json({ error: 'Can only edit active vouchers' }, { status: 400 });
    }

    const body = await request.json();
    const updates = updateVoucherSchema.parse(body);

    const updateData: Record<string, any> = { updated_at: new Date() };
    if (updates.userId) updateData.user_id = updates.userId;
    if (updates.traitId) updateData.trait_id = updates.traitId;
    if (updates.slotId) updateData.slot_id = updates.slotId;
    if (updates.rarityTierId) updateData.rarity_tier_id = updates.rarityTierId;

    const updated = await voucherRepo.update(params.id, updateData);

    await auditRepo.logAction('admin', 'voucher_updated', {
      actorId: session.userId,
      payload: { voucherId: params.id, updates },
    });

    return NextResponse.json({ voucher: updated });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('Update voucher error:', error);
    return NextResponse.json({ error: 'Failed to update voucher' }, { status: 500 });
  }
}

// Delete (revoke) voucher
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await SessionService.getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const voucherRepo = new TraitVoucherRepository();
  const auditRepo = new AuditLogRepository();

  const revoked = await voucherRepo.revokeVoucher(params.id);
  if (!revoked) {
    return NextResponse.json({ error: 'Voucher not found or already used' }, { status: 404 });
  }

  await auditRepo.logAction('admin', 'voucher_revoked', {
    actorId: session.userId,
    payload: { voucherId: params.id },
  });

  return NextResponse.json({ success: true });
}
