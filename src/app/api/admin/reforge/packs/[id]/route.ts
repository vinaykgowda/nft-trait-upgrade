import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { PackManager, UpdatePackInput } from '@/lib/services/pack-manager';
import { ReforgePackRepository } from '@/lib/repositories/reforge-packs';
import { z } from 'zod';

const updatePackSchema = z.object({
  tierName: z.enum(['silver', 'gold', 'diamond']).optional(),
  solPrice: z.number().positive('SOL price must be positive').optional(),
  minLdzEarning: z.number().min(0).optional(),
  maxLdzEarning: z.number().min(0).optional(),
  totalInventory: z.number().int().positive('Total inventory must be a positive integer').optional(),
  enabled: z.boolean().optional(),
});

/**
 * PUT /api/admin/reforge/packs/[id]
 * Update a reforge pack
 */
export async function PUT(
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

    const packId = params.id;
    const body = await request.json();
    const parsed = updatePackSchema.parse(body);

    const packManager = new PackManager();

    // Handle enabled/disabled toggle separately
    if (parsed.enabled !== undefined) {
      const { enabled, ...updateFields } = parsed;

      // If there are other fields to update, do that first
      let pack;
      if (Object.keys(updateFields).length > 0) {
        pack = await packManager.updatePack(packId, updateFields as UpdatePackInput);
      }

      // Then toggle enabled state
      if (enabled) {
        pack = await packManager.enablePack(packId);
      } else {
        pack = await packManager.disablePack(packId);
      }

      return NextResponse.json({ pack });
    }

    // Standard update without enabled toggle
    const pack = await packManager.updatePack(packId, parsed as UpdatePackInput);
    return NextResponse.json({ pack });
  } catch (error: any) {
    console.error('Admin PUT reforge pack error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'INVALID_PACK_CONFIG', message: error.errors[0]?.message || 'Invalid input', retryable: false },
        { status: 400 }
      );
    }

    if (error?.error === 'PACK_NOT_FOUND') {
      return NextResponse.json(
        { error: error.error, message: error.message, retryable: false },
        { status: 404 }
      );
    }

    if (error?.error === 'INVALID_PACK_CONFIG') {
      return NextResponse.json(
        { error: error.error, message: error.message, retryable: false },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/reforge/packs/[id]
 * Delete a reforge pack
 */
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

    const packId = params.id;
    const repository = new ReforgePackRepository();

    const existing = await repository.findById(packId);
    if (!existing) {
      return NextResponse.json(
        { error: 'PACK_NOT_FOUND', message: `Pack with id ${packId} not found`, retryable: false },
        { status: 404 }
      );
    }

    await repository.delete(packId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin DELETE reforge pack error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
