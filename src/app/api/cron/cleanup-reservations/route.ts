import { NextRequest, NextResponse } from 'next/server';
import { ReservationCleanupService } from '@/lib/services/reservation-cleanup';

// This endpoint can be called by Vercel Cron Jobs or external schedulers
export async function POST(request: NextRequest) {
  try {
    // Verify the request is from a trusted source (Vercel Cron or admin)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const cleanupService = new ReservationCleanupService();
    const result = await cleanupService.cleanupExpiredReservations();

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${result.cleanedCount} expired reservations`,
      ...result,
    });
  } catch (error) {
    console.error('Cron cleanup error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Allow GET for health checks
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Reservation cleanup endpoint is healthy',
    timestamp: new Date().toISOString(),
  });
}