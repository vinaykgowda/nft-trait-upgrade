import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth';
import { errorHandler, ErrorCategory } from '@/lib/services/error-handler';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as ErrorCategory | null;
    const limit = parseInt(searchParams.get('limit') || '50');
    const timeRangeParam = searchParams.get('timeRange');
    
    // Parse time range
    let timeRange: { start: Date; end: Date } | undefined;
    if (timeRangeParam) {
      const hours = parseInt(timeRangeParam);
      if (!isNaN(hours)) {
        timeRange = {
          start: new Date(Date.now() - hours * 60 * 60 * 1000),
          end: new Date(),
        };
      }
    }

    let errors;
    if (category) {
      errors = errorHandler.getErrorsByCategory(category, limit);
    } else {
      errors = errorHandler.getRecentErrors(limit);
    }

    // Filter by time range if specified
    if (timeRange) {
      errors = errors.filter(error => 
        error.timestamp >= timeRange!.start && error.timestamp <= timeRange!.end
      );
    }

    // Get error metrics for summary
    const errorMetrics = errorHandler.getErrorMetrics(timeRange);

    return NextResponse.json({
      errors: errors.map(error => ({
        id: error.id,
        category: error.category,
        severity: error.severity,
        message: error.message,
        timestamp: error.timestamp.toISOString(),
        requestId: error.requestId,
        userId: error.userId,
        context: error.context,
        // Don't include the full original error object for security
      })),
      metrics: errorMetrics,
      totalCount: errors.length,
    });
  } catch (error) {
    console.error('Errors API error:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch error data' },
      { status: 500 }
    );
  }
}