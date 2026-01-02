import { NextRequest, NextResponse } from 'next/server';
import { ReservationCleanupService } from '@/lib/services/reservation-cleanup';
import { verifyAdminSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const session = await verifyAdminSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const cleanupService = new ReservationCleanupService();
    const result = await cleanupService.cleanupExpiredReservations();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Admin cleanup error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const session = await verifyAdminSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const cleanupService = new ReservationCleanupService();
    const stats = await cleanupService.getReservationStats();

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Get reservation stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}