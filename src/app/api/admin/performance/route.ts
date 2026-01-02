import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth';
import { performanceMonitor } from '@/lib/services/performance-monitor';

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
    const operation = searchParams.get('operation');
    const service = searchParams.get('service');
    const limit = parseInt(searchParams.get('limit') || '50');
    const timeRangeParam = searchParams.get('timeRange');
    const type = searchParams.get('type'); // 'slow', 'failed', 'recent', or 'stats'
    
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

    let data;
    switch (type) {
      case 'slow':
        data = performanceMonitor.getSlowOperations(limit);
        break;
      case 'failed':
        data = performanceMonitor.getFailedOperations(limit);
        break;
      case 'recent':
        data = performanceMonitor.getRecentMetrics(limit);
        break;
      case 'stats':
      default:
        data = performanceMonitor.getPerformanceStats(operation || undefined, service || undefined, timeRange);
        break;
    }

    // Filter by time range if specified and not already filtered
    if (timeRange && type !== 'stats' && Array.isArray(data)) {
      data = data.filter((metric: any) => 
        metric.timestamp >= timeRange!.start && metric.timestamp <= timeRange!.end
      );
    }

    // Format response based on type
    if (type === 'stats') {
      return NextResponse.json({
        stats: data,
        totalCount: Array.isArray(data) ? data.length : 0,
      });
    } else {
      return NextResponse.json({
        metrics: Array.isArray(data) ? data.map((metric: any) => ({
          id: metric.id,
          operation: metric.operation,
          service: metric.service,
          duration: metric.duration,
          success: metric.success,
          timestamp: metric.timestamp.toISOString(),
          requestId: metric.requestId,
          metadata: metric.metadata,
        })) : [],
        totalCount: Array.isArray(data) ? data.length : 0,
      });
    }
  } catch (error) {
    console.error('Performance API error:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch performance data' },
      { status: 500 }
    );
  }
}