import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { query } from '@/lib/database';
import { z } from 'zod';

const traitSlotSchema = z.object({
  name: z.string().min(1, 'Slot name is required').max(100),
  layerOrder: z.number().int().positive(),
  required: z.boolean().default(false),
});

const updateSlotOrderSchema = z.object({
  slots: z.array(z.object({
    id: z.string(),
    layerOrder: z.number().int().positive(),
  })),
});

export async function GET(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Fetch from database
    const result = await query(`
      SELECT id, name, layer_order, rules_json, created_at
      FROM trait_slots 
      ORDER BY layer_order ASC
    `);

    const slots = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      layerOrder: row.layer_order,
      required: true, // Assume all are required for now
      rulesJson: row.rules_json,
      createdAt: row.created_at
    }));
    
    return NextResponse.json({
      slots: slots
    });

  } catch (error) {
    console.error('Get trait slots API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const slotData = traitSlotSchema.parse(body);

    // Check if name already exists
    const existingSlot = await query(`
      SELECT id FROM trait_slots WHERE LOWER(name) = LOWER($1)
    `, [slotData.name]);

    if (existingSlot.rows.length > 0) {
      return NextResponse.json(
        { error: 'Slot name already exists' },
        { status: 400 }
      );
    }

    // Insert new slot
    const result = await query(`
      INSERT INTO trait_slots (name, layer_order, rules_json)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [slotData.name, slotData.layerOrder, JSON.stringify({})]);

    const newSlot = {
      id: result.rows[0].id,
      name: result.rows[0].name,
      layerOrder: result.rows[0].layer_order,
      required: true,
      rulesJson: result.rows[0].rules_json,
      createdAt: result.rows[0].created_at
    };

    return NextResponse.json({
      slot: newSlot
    }, { status: 201 });

  } catch (error) {
    console.error('Create trait slot API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { slots } = updateSlotOrderSchema.parse(body);

    // Update layer orders in database
    for (const slotUpdate of slots) {
      await query(`
        UPDATE trait_slots 
        SET layer_order = $1 
        WHERE id = $2
      `, [slotUpdate.layerOrder, slotUpdate.id]);
    }

    // Fetch updated slots
    const result = await query(`
      SELECT id, name, layer_order, rules_json, created_at
      FROM trait_slots 
      ORDER BY layer_order ASC
    `);

    const updatedSlots = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      layerOrder: row.layer_order,
      required: true,
      rulesJson: row.rules_json,
      createdAt: row.created_at
    }));

    return NextResponse.json({
      slots: updatedSlots
    });

  } catch (error) {
    console.error('Update trait slots API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get('id');

    if (!slotId) {
      return NextResponse.json(
        { error: 'Slot ID is required' },
        { status: 400 }
      );
    }

    // Check if slot exists
    const existingSlot = await query(`
      SELECT id FROM trait_slots WHERE id = $1
    `, [slotId]);

    if (existingSlot.rows.length === 0) {
      return NextResponse.json(
        { error: 'Slot not found' },
        { status: 404 }
      );
    }

    // Check if there are traits using this slot
    const traitsUsingSlot = await query(`
      SELECT COUNT(*) as count FROM traits WHERE slot_id = $1
    `, [slotId]);

    if (parseInt(traitsUsingSlot.rows[0].count) > 0) {
      return NextResponse.json(
        { error: 'Cannot delete slot that has traits assigned to it' },
        { status: 400 }
      );
    }

    // Delete the slot
    await query(`DELETE FROM trait_slots WHERE id = $1`, [slotId]);

    // Fetch remaining slots
    const result = await query(`
      SELECT id, name, layer_order, rules_json, created_at
      FROM trait_slots 
      ORDER BY layer_order ASC
    `);

    const remainingSlots = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      layerOrder: row.layer_order,
      required: true,
      rulesJson: row.rules_json,
      createdAt: row.created_at
    }));

    return NextResponse.json({
      success: true,
      slots: remainingSlots
    });

  } catch (error) {
    console.error('Delete trait slot API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}