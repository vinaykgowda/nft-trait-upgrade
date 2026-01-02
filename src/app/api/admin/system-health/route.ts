import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth';
import { errorHandler } from '@/lib/services/error-handler';
import { performanceMonitor } from '@/lib/services/performance-monitor';
import { logger, LogLevel } from '@/lib/services/logger';

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
    const timeRangeParam = searchParams.get('timeRange');
    
    // Parse time range (default to last 24 hours)
    let timeRange: { start: Date; end: Date } | undefined;
    if (timeRangeParam) {
      const hours = parseInt(timeRangeParam);
      if (!isNaN(hours)) {
        timeRange = {
          start: new Date(Date.now() - hours * 60 * 60 * 1000),
          end: new Date(),
        };
      }
    } else {
      timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        end: new Date(),
      };
    }

    // Get error metrics
    const errorMetrics = errorHandler.getErrorMetrics(timeRange);
    const recentErrors = errorHandler.getRecentErrors(50);

    // Get performance metrics
    const performanceStats = performanceMonitor.getPerformanceStats(undefined, undefined, timeRange);
    const slowOperations = performanceMonitor.getSlowOperations(20);
    const failedOperations = performanceMonitor.getFailedOperations(20);

    // Get recent logs
    const recentLogs = logger.getRecentLogs(100);
    const errorLogs = logger.getLogsByLevel(LogLevel.ERROR, 50);
    const warnLogs = logger.getLogsByLevel(LogLevel.WARN, 50);

    // Calculate system health score (0-100)
    const totalErrors = errorMetrics.reduce((sum, metric) => sum + metric.count, 0);
    const totalOperations = performanceStats.reduce((sum, stat) => sum + stat.count, 0);
    const avgSuccessRate = totalOperations > 0 
      ? performanceStats.reduce((sum, stat) => sum + (stat.successRate * stat.count), 0) / totalOperations
      : 1;
    
    const healthScore = Math.max(0, Math.min(100, 
      (avgSuccessRate * 70) + // 70% weight for success rate
      (Math.max(0, 30 - totalErrors) * 1) // 30% weight for error count (fewer errors = better)
    ));

    const systemHealth = {
      healthScore: Math.round(healthScore),
      status: healthScore >= 90 ? 'healthy' : healthScore >= 70 ? 'warning' : 'critical',
      lastUpdated: new Date().toISOString(),
      timeRange: {
        start: timeRange?.start.toISOString() || '',
        end: timeRange?.end.toISOString() || '',
      },
      summary: {
        totalErrors,
        totalOperations,
        avgSuccessRate: Math.round(avgSuccessRate * 100),
        slowOperationsCount: slowOperations.length,
        failedOperationsCount: failedOperations.length,
      },
    };

    return NextResponse.json({
      systemHealth,
      errorMetrics,
      recentErrors: recentErrors.slice(0, 10), // Limit for API response
      performanceStats,
      slowOperations: slowOperations.slice(0, 10),
      failedOperations: failedOperations.slice(0, 10),
      recentLogs: recentLogs.slice(0, 20),
      errorLogs: errorLogs.slice(0, 10),
      warnLogs: warnLogs.slice(0, 10),
    });
  } catch (error) {
    console.error('System health API error:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch system health data' },
      { status: 500 }
    );
  }
}