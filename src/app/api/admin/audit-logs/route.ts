import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getAuditLogRepository } from '@/lib/repositories';

export async function GET(request: NextRequest) {
  try {
    const sessionData = await authService.requireAuth(request);
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await authService.hasPermission(sessionData, 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const actorType = searchParams.get('actorType');
    const action = searchParams.get('action');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const filters: any = {};
    if (actorType) filters.actorType = actorType;
    if (action) filters.action = action;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    const auditRepo = getAuditLogRepository();
    const result = await auditRepo.findPaginated(filters, page, limit);
    
    return NextResponse.json({
      logs: result.logs.map((log: any) => auditRepo.toDomain(log)),
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    });

  } catch (error) {
    console.error('Get audit logs API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}