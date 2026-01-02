import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getAuditLogRepository } from '@/lib/repositories';
import { z } from 'zod';

const settingsSchema = z.object({
  settings: z.object({
    maintenanceMode: z.boolean(),
    maxConcurrentReservations: z.number().int().min(1).max(100),
    reservationTtlMinutes: z.number().int().min(1).max(60),
    maxGiftBalancePerWallet: z.number().int().min(1).max(1000),
    enableRateLimiting: z.boolean(),
    maxRequestsPerMinute: z.number().int().min(10).max(1000),
  }),
  mfaToken: z.string().length(6, 'MFA token must be 6 digits'),
});

// Mock settings storage - in a real app this would be in database
let systemSettings = {
  maintenanceMode: false,
  maxConcurrentReservations: 10,
  reservationTtlMinutes: 15,
  maxGiftBalancePerWallet: 100,
  enableRateLimiting: true,
  maxRequestsPerMinute: 60,
};

export async function GET(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    return NextResponse.json({
      settings: systemSettings
    });

  } catch (error) {
    console.error('Get settings API error:', error);
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
    const { settings, mfaToken } = settingsSchema.parse(body);

    // Verify MFA for sensitive operation
    const mfaValid = await authService.verifyMFAToken(sessionData.userId, mfaToken);
    if (!mfaValid) {
      return NextResponse.json({ error: 'Invalid MFA token' }, { status: 400 });
    }

    const auditRepo = getAuditLogRepository();

    // Store previous settings for audit log
    const previousSettings = { ...systemSettings };
    
    // Update settings
    systemSettings = { ...settings };

    // Audit log
    await auditRepo.logAction('admin', 'settings_updated', {
      actorId: sessionData.userId,
      payload: {
        previousSettings,
        newSettings: settings,
        changedFields: Object.keys(settings).filter(
          key => previousSettings[key as keyof typeof previousSettings] !== settings[key as keyof typeof settings]
        ),
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      settings: systemSettings,
      message: 'Settings updated successfully'
    });

  } catch (error) {
    console.error('Update settings API error:', error);
    
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