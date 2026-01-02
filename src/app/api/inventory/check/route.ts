import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { InventoryManager } from '@/lib/services/inventory-manager';

const inventoryCheckSchema = z.object({
  traitId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { traitId } = inventoryCheckSchema.parse(body);

    const inventoryManager = new InventoryManager();
    const result = await inventoryManager.checkInventoryAvailability(traitId);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Inventory check error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const traitId = searchParams.get('traitId');

    if (!traitId) {
      return NextResponse.json(
        { success: false, error: 'traitId parameter required' },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(traitId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid traitId format' },
        { status: 400 }
      );
    }

    const inventoryManager = new InventoryManager();
    const result = await inventoryManager.checkInventoryAvailability(traitId);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Inventory check error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}