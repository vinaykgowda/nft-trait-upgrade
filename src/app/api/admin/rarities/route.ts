import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { query } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get actual rarities from database
    const result = await query('SELECT id, name, weight, display_order FROM rarity_tiers ORDER BY display_order');
    
    const rarities = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      weight: row.weight,
      displayOrder: row.display_order
    }));

    return NextResponse.json({
      rarities
    });

  } catch (error) {
    console.error('Get rarities API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}